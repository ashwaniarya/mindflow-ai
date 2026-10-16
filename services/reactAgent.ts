import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { aiEnabled, complete, type ChatMessage } from "./aiClient";
import { Edge } from "reactflow";
import { MindMapNode } from "../types";
import { demoDraft, demoExpansions, predictColor } from "./demoContent";

export const MAX_STEPS = 10;

let idCounter = 5000;
const getId = () => `agent-node-${idCounter++}`;

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

export const AgentState = Annotation.Root({
  topic: Annotation<string>(),
  nodes: Annotation<MindMapNode[]>({ reducer: (_state, update) => update, default: () => [] }),
  edges: Annotation<Edge[]>({ reducer: (_state, update) => update, default: () => [] }),
  history: Annotation<ChatMessage[]>({ reducer: (state, update) => state.concat(update), default: () => [] }),
  pendingCalls: Annotation<(ToolCall & { id?: string })[]>({ reducer: (_state, update) => update, default: () => [] }),
  log: Annotation<string[]>({ reducer: (state, update) => state.concat(update), default: () => [] }),
  steps: Annotation<number>({ reducer: (_state, update) => update, default: () => 0 }),
});

type State = typeof AgentState.State;

// ---------- Tools: the map is the tool surface ----------

const plain = (label: string) => label.replace(/[*_`#]/g, '').split('\n')[0].trim().toLowerCase();

const findNode = (nodes: MindMapNode[], label: string) => {
  const needle = plain(label);
  return nodes.find((node) => plain(node.data.label) === needle) ?? nodes.find((node) => plain(node.data.label).includes(needle));
};

const summarize = (nodes: MindMapNode[], edges: Edge[]) => {
  const root = nodes.find((node) => node.data.isRoot);
  if (!root) return 'The map is empty.';
  const childrenOf = (id: string) => edges.filter((edge) => edge.source === id).map((edge) => nodes.find((node) => node.id === edge.target)).filter(Boolean) as MindMapNode[];
  const branches = childrenOf(root.id);
  const lines = branches.map((branch) => `- ${plain(branch.data.label)} (${childrenOf(branch.id).length} sub-topics)`);
  return `Root: ${plain(root.data.label)}\nBranches (${branches.length}):\n${lines.join('\n') || '- none yet'}`;
};

const runTool = (call: ToolCall, state: State): { nodes: MindMapNode[]; edges: Edge[]; result: string } => {
  const nodes = [...state.nodes];
  const edges = [...state.edges];
  const args = call.args as Record<string, any>;

  switch (call.name) {
    case 'inspect_map':
      return { nodes, edges, result: summarize(nodes, edges) };

    case 'add_branches': {
      let root = nodes.find((node) => node.data.isRoot);
      if (!root) {
        root = { id: getId(), type: 'custom', position: { x: 0, y: 0 }, data: { label: args.root_label || `**${state.topic}**`, isRoot: true } };
        nodes.push(root);
      }
      const existing = edges.filter((edge) => edge.source === root!.id).length;
      const labels: string[] = Array.isArray(args.labels) ? args.labels : [];
      labels.forEach((label, index) => {
        const color = predictColor(label, existing + index);
        const id = getId();
        nodes.push({ id, type: 'custom', position: { x: 460, y: (existing + index) * 300 }, data: { label, color } });
        edges.push({ id: `e-${root!.id}-${id}`, source: root!.id, target: id, type: 'smoothstep', animated: true, style: { stroke: color } });
      });
      return { nodes, edges, result: `Added ${labels.length} branches.\n${summarize(nodes, edges)}` };
    }

    case 'expand': {
      const parent = findNode(nodes, String(args.branch_label ?? ''));
      if (!parent) return { nodes, edges, result: `No node matches "${args.branch_label}". ${summarize(nodes, edges)}` };
      const subtopics: string[] = Array.isArray(args.subtopics) ? args.subtopics : [];
      const existing = edges.filter((edge) => edge.source === parent.id).length;
      subtopics.forEach((label, index) => {
        const id = getId();
        nodes.push({ id, type: 'custom', position: { x: parent.position.x + 440, y: parent.position.y + (existing + index) * 84 }, data: { label, color: parent.data.color } });
        edges.push({ id: `e-${parent.id}-${id}`, source: parent.id, target: id, type: 'smoothstep', animated: true, style: { stroke: parent.data.color ?? '#94a3b8' } });
      });
      return { nodes, edges, result: `Expanded "${plain(parent.data.label)}" with ${subtopics.length} sub-topics.` };
    }

    case 'rename': {
      const target = findNode(nodes, String(args.label ?? ''));
      if (!target) return { nodes, edges, result: `No node matches "${args.label}".` };
      const renamed = nodes.map((node) => node.id === target.id ? { ...node, data: { ...node.data, label: String(args.new_label ?? node.data.label) } } : node);
      return { nodes: renamed, edges, result: `Renamed "${plain(target.data.label)}" to "${args.new_label}".` };
    }

    default:
      return { nodes, edges, result: `Unknown tool ${call.name}.` };
  }
};

const fn = (name: string, description: string, properties: Record<string, unknown>, required: string[] = []) =>
  ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, required } } });
const strList = { type: 'array', items: { type: 'string' } };
const tools = [
  fn('inspect_map', 'Look at the current mind map: root, branches, and how many sub-topics each branch has.', {}),
  fn('add_branches', 'Add top-level branches under the root. Creates the root if the map is empty.', { root_label: { type: 'string', description: 'Short markdown label for the root, only when the map is empty' }, labels: { ...strList, description: '3 to 5 short branch labels, markdown allowed' } }, ['labels']),
  fn('expand', 'Add 2 to 4 short sub-topics under an existing branch.', { branch_label: { type: 'string' }, subtopics: strList }, ['branch_label', 'subtopics']),
  fn('rename', 'Rename a node to something sharper.', { label: { type: 'string' }, new_label: { type: 'string' } }, ['label', 'new_label']),
];

const systemInstruction = `You are a mind-map planner working in a ReAct loop. You can only change the map through tools.
Work step by step: inspect the map when unsure, add 3 to 5 branches, expand every branch with 2 to 4 sub-topics, rename anything weak, then stop calling tools and reply with one sentence summarizing the map.
Labels are short. Never call inspect_map twice in a row. Do not add more than 5 branches.`;

// ---------- Demo planner: emits the same tool calls without a key ----------

const scriptedPlanner = (state: State): ToolCall[] => {
  const root = state.nodes.find((node) => node.data.isRoot);
  if (state.steps === 0) return [{ name: 'inspect_map', args: {} }];
  if (!root) {
    const draft = demoDraft(state.topic);
    return [{ name: 'add_branches', args: { root_label: draft.rootLabel, labels: draft.branches } }];
  }
  const branches = state.edges.filter((edge) => edge.source === root.id).map((edge) => state.nodes.find((node) => node.id === edge.target)!).filter(Boolean);
  const thin = branches.find((branch) => !state.edges.some((edge) => edge.source === branch.id));
  if (thin) {
    const [expansion] = demoExpansions([{ label: thin.data.label }]).expansions;
    return [{ name: 'expand', args: { branch_label: thin.data.label, subtopics: expansion.subtopics } }];
  }
  return [];
};

// ---------- Graph nodes ----------

const describe = (call: ToolCall) => {
  if (call.name === 'add_branches') return `add_branches(${(call.args.labels as string[] | undefined)?.length ?? 0})`;
  if (call.name === 'expand') return `expand("${plain(String(call.args.branch_label ?? ''))}")`;
  if (call.name === 'rename') return `rename("${plain(String(call.args.label ?? ''))}")`;
  return `${call.name}()`;
};

async function agentNode(state: State) {
  if (!aiEnabled) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const calls = scriptedPlanner(state);
    return { pendingCalls: calls, log: calls.length ? [`Reason: ${calls[0].name === 'inspect_map' ? 'I should look at the map first' : calls[0].name === 'add_branches' ? 'the map is empty, draft the branches' : 'a branch has no detail yet'}`] : ['Reason: every branch has detail, done'] };
  }

  const history: ChatMessage[] = state.history.length ? state.history : [
    { role: 'system', content: systemInstruction },
    { role: 'user', content: `Build a mind map about: "${state.topic}".` },
  ];
  const { message } = await complete({ messages: history, tools });
  const calls = (message.tool_calls ?? []).map((call) => {
    let args: Record<string, unknown> = {};
    try { args = JSON.parse(call.function.arguments || '{}'); } catch { /* keep empty */ }
    return { id: call.id, name: call.function.name, args };
  });
  const thought = message.content?.trim();
  return {
    history: [...(state.history.length ? [] : history), message],
    pendingCalls: calls,
    log: [thought ? `Reason: ${thought}` : calls.length ? `Reason: calling ${calls.map(describe).join(', ')}` : 'Reason: done'],
  };
}

function toolsNode(state: State) {
  let nodes = state.nodes;
  let edges = state.edges;
  const responses: ChatMessage[] = [];
  const log: string[] = [];

  for (const call of state.pendingCalls) {
    const outcome = runTool(call, { ...state, nodes, edges });
    nodes = outcome.nodes;
    edges = outcome.edges;
    log.push(`Act: ${describe(call)} -> ${outcome.result.split('\n')[0]}`);
    responses.push({ role: 'tool', tool_call_id: call.id, content: outcome.result });
  }

  return { nodes, edges, history: aiEnabled ? responses : [], log, pendingCalls: [], steps: state.steps + 1 };
}

const shouldContinue = (state: State) => (state.pendingCalls.length > 0 && state.steps < MAX_STEPS ? 'tools' : END);

export const mindMapReactAgent = new StateGraph(AgentState)
  .addNode('agent', agentNode)
  .addNode('tools', toolsNode)
  .addEdge(START, 'agent')
  .addConditionalEdges('agent', shouldContinue, { tools: 'tools', [END]: END })
  .addEdge('tools', 'agent')
  .compile();

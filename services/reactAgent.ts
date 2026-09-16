import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { GoogleGenAI, Type, type Content, type FunctionDeclaration } from "@google/genai";
import { Edge } from "reactflow";
import { MindMapNode } from "../types";
import { demoDraft, demoExpansions, predictColor } from "./demoContent";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });
const MODEL = "gemini-3-flash-preview";
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
  history: Annotation<Content[]>({ reducer: (state, update) => state.concat(update), default: () => [] }),
  pendingCalls: Annotation<ToolCall[]>({ reducer: (_state, update) => update, default: () => [] }),
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

const functionDeclarations: FunctionDeclaration[] = [
  { name: 'inspect_map', description: 'Look at the current mind map: root, branches, and how many sub-topics each branch has.', parameters: { type: Type.OBJECT, properties: {} } },
  { name: 'add_branches', description: 'Add top-level branches under the root. Creates the root if the map is empty.', parameters: { type: Type.OBJECT, properties: { root_label: { type: Type.STRING, description: 'Short markdown label for the root, only when the map is empty' }, labels: { type: Type.ARRAY, items: { type: Type.STRING }, description: '3 to 5 short branch labels, markdown allowed' } }, required: ['labels'] } },
  { name: 'expand', description: 'Add 2 to 4 short sub-topics under an existing branch.', parameters: { type: Type.OBJECT, properties: { branch_label: { type: Type.STRING }, subtopics: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ['branch_label', 'subtopics'] } },
  { name: 'rename', description: 'Rename a node to something sharper.', parameters: { type: Type.OBJECT, properties: { label: { type: Type.STRING }, new_label: { type: Type.STRING } }, required: ['label', 'new_label'] } },
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
  if (!apiKey) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const calls = scriptedPlanner(state);
    return { pendingCalls: calls, log: calls.length ? [`Reason: ${calls[0].name === 'inspect_map' ? 'I should look at the map first' : calls[0].name === 'add_branches' ? 'the map is empty, draft the branches' : 'a branch has no detail yet'}`] : ['Reason: every branch has detail, done'] };
  }

  const history: Content[] = state.history.length ? state.history : [{ role: 'user', parts: [{ text: `Build a mind map about: "${state.topic}".` }] }];
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: history,
    config: { systemInstruction, tools: [{ functionDeclarations }] },
  });
  const modelContent = response.candidates?.[0]?.content;
  const calls: ToolCall[] = (response.functionCalls ?? []).map((call) => ({ name: call.name ?? 'unknown', args: (call.args ?? {}) as Record<string, unknown> }));
  const thought = response.text?.trim();
  return {
    history: [...(state.history.length ? [] : history), ...(modelContent ? [modelContent] : [])],
    pendingCalls: calls,
    log: [thought ? `Reason: ${thought}` : calls.length ? `Reason: calling ${calls.map(describe).join(', ')}` : 'Reason: done'],
  };
}

function toolsNode(state: State) {
  let nodes = state.nodes;
  let edges = state.edges;
  const responses: Content[] = [];
  const log: string[] = [];

  for (const call of state.pendingCalls) {
    const outcome = runTool(call, { ...state, nodes, edges });
    nodes = outcome.nodes;
    edges = outcome.edges;
    log.push(`Act: ${describe(call)} -> ${outcome.result.split('\n')[0]}`);
    responses.push({ role: 'user', parts: [{ functionResponse: { name: call.name, response: { result: outcome.result } } }] });
  }

  return { nodes, edges, history: apiKey ? responses : [], log, pendingCalls: [], steps: state.steps + 1 };
}

const shouldContinue = (state: State) => (state.pendingCalls.length > 0 && state.steps < MAX_STEPS ? 'tools' : END);

export const mindMapReactAgent = new StateGraph(AgentState)
  .addNode('agent', agentNode)
  .addNode('tools', toolsNode)
  .addEdge(START, 'agent')
  .addConditionalEdges('agent', shouldContinue, { tools: 'tools', [END]: END })
  .addEdge('tools', 'agent')
  .compile();

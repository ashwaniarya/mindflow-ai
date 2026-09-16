import React, { useCallback, useRef, useState, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  addEdge,
  Connection,
  Edge,
  Node,
  useReactFlow,
  Panel,
  BackgroundVariant,
} from 'reactflow';
import CustomNode from './CustomNode';
import { ContextMenu } from './ContextMenu';
import { generateSubTopics } from '../services/geminiService';
import { mindMapReactAgent } from '../services/reactAgent';
import { MindMapNode, AppState, SavedMap } from '../types';
import { demoSavedMaps } from '../services/demoContent';
import { smartAlign } from '../services/layout';
import { Loader2, Plus, Wand2 } from 'lucide-react';

const nodeTypes = {
  custom: CustomNode,
};

const openingMap = demoSavedMaps()[0];
const initialNodes: MindMapNode[] = openingMap.nodes;
const initialEdges: Edge[] = openingMap.edges;

let id = 1;
const getId = () => `node-${id++}`;

const MindMapContent = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [menu, setMenu] = useState<{ id: string; top: number; left: number; right: number; bottom: number; nodeId?: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, getNode, fitView, getNodes, getEdges } = useReactFlow();
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [isAligning, setIsAligning] = useState(false);

  // Tidy-tree layout: siblings never overlap, each branch keeps its column
  const runSmartAlign = useCallback(() => {
    setIsAligning(true);
    setNodes((current) => smartAlign(current as MindMapNode[], getEdges()));
    setTimeout(() => fitView({ padding: 0.15, duration: 600 }), 30);
    setTimeout(() => setIsAligning(false), 700);
  }, [setNodes, getEdges, fitView]);

  // Handle connections manually if user drags handles
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, type: 'smoothstep', animated: true }, eds)),
    [setEdges]
  );

  // Close context menu on click elsewhere
  const onPaneClick = useCallback(() => setMenu(null), []);

  // Open Context Menu
  const onContextMenu = useCallback(
    (event: React.MouseEvent, node?: Node) => {
      event.preventDefault();

      if (!ref.current) return;
      const pane = ref.current.getBoundingClientRect();

      setMenu({
        id: 'ctx-menu',
        top: event.clientY,
        left: event.clientX,
        right: pane.width - event.clientX,
        bottom: pane.height - event.clientY,
        nodeId: node?.id,
      });
    },
    []
  );

  // Add Node Helper
  const addNode = useCallback(
    (position: { x: number; y: number }, parentId?: string, label: string = 'New Idea') => {
      const parentColor = parentId ? getNode(parentId)?.data?.color : undefined;
      const newNode: MindMapNode = {
        id: getId(),
        type: 'custom',
        position,
        data: { label, color: parentColor },
      };

      setNodes((nds) => nds.concat(newNode));

      if (parentId) {
        setEdges((eds) =>
          eds.concat({
            id: `e${parentId}-${newNode.id}`,
            source: parentId,
            target: newNode.id,
            type: 'smoothstep', // nice curved edges
            animated: true,
            style: { stroke: parentColor ?? '#cbd5e1', strokeWidth: 1.5 },
          })
        );
      }
      return newNode;
    },
    [setNodes, setEdges, getNode]
  );

  // Tell the composer what is selected so Generate can extend it
  const onSelectionChange = useCallback(({ nodes: selected }: { nodes: Node[] }) => {
    const first = selected[0];
    window.dispatchEvent(new CustomEvent('mindmap:selection', {
      detail: { count: selected.length, label: first ? String(first.data?.label ?? '').replace(/[*_`#]/g, '').split('\n')[0] : '' },
    }));
  }, []);

  // Extend the selected nodes with guided sub-topics
  const extendSelection = useCallback(async (selected: Node[], guidance: string) => {
    setAppState(AppState.GENERATING);
    window.dispatchEvent(new CustomEvent('mindmap:agent-start'));
    window.dispatchEvent(new CustomEvent('mindmap:agent-progress', { detail: { progress: `Extending ${selected.length} node${selected.length > 1 ? 's' : ''}...` } }));
    try {
      const rowGap = 84;
      for (const node of selected) {
        const subTopics = await generateSubTopics(String(node.data?.label ?? ''), guidance);
        const childIds = new Set(getEdges().filter((edge) => edge.source === node.id).map((edge) => edge.target));
        const children = getNodes().filter((candidate) => childIds.has(candidate.id));
        const columnX = children.length > 0 ? Math.max(...children.map((child) => child.position.x)) : node.position.x + 320;
        const startY = children.length > 0
          ? Math.max(...children.map((child) => child.position.y)) + rowGap
          : node.position.y - ((subTopics.length - 1) / 2) * rowGap;
        subTopics.forEach((topic, index) => {
          addNode({ x: columnX, y: startY + index * rowGap }, node.id, topic);
        });
      }
      setTimeout(runSmartAlign, 80);
    } catch (e) {
      console.error(e);
      alert('Failed to extend the selection.');
    } finally {
      setAppState(AppState.IDLE);
      window.dispatchEvent(new CustomEvent('mindmap:agent-end'));
    }
  }, [addNode, getEdges, getNodes, runSmartAlign]);

  // Handle "Hover -> Add Child" interaction
  useEffect(() => {
    const handleAddChildEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { parentId } = customEvent.detail;
      const parentNode = getNode(parentId);

      if (parentNode) {
        // Calculate position for new node
        const childX = parentNode.position.x + 250;
        const childY = parentNode.position.y + (Math.random() - 0.5) * 150; 
        
        addNode({ x: childX, y: childY }, parentId);
      }
    };

    window.addEventListener('mindmap:add-child', handleAddChildEvent);
    return () => {
      window.removeEventListener('mindmap:add-child', handleAddChildEvent);
    };
  }, [addNode, getNode]);

  // Handle Agent Generation Request
  useEffect(() => {
    const handleAgentGenerate = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const { topic } = customEvent.detail;

      const selected = getNodes().filter((n) => n.selected);
      if (selected.length > 0) {
        await extendSelection(selected, topic);
        return;
      }
      
      setAppState(AppState.GENERATING);
      window.dispatchEvent(new CustomEvent('mindmap:agent-start'));
      window.dispatchEvent(new CustomEvent('mindmap:agent-progress', { detail: { progress: 'Initializing Agent...' } }));
      
      setNodes([]); // Clear existing
      setEdges([]);

      try {
        const stream = await mindMapReactAgent.stream({ topic });
        
        for await (const chunk of stream) {
          // chunk is an object keyed by the graph node that just completed: "agent" (reasoning) or "tools" (map changes)
          for (const [, output] of Object.entries(chunk as unknown as Record<string, { nodes?: MindMapNode[]; edges?: Edge[]; log?: string[] }>)) {
            const latest = output.log?.[output.log.length - 1];
            if (latest) {
               window.dispatchEvent(new CustomEvent('mindmap:agent-progress', { detail: { progress: latest } }));
            }

            if (output.nodes) {
              setNodes(nds => {
                // simple deduping based on ID since langgraph reducer might concat all
                const newNodes = [...nds, ...output.nodes];
                return Array.from(new Map(newNodes.map(item => [item.id, item])).values());
              });
            }
            if (output.edges) {
              setEdges(eds => {
                const newEdges = [...eds, ...output.edges];
                return Array.from(new Map(newEdges.map(item => [item.id, item])).values());
              });
            }
            // Animate view fit as nodes appear
            setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 50);
          }
        }
      } catch (err) {
        console.error(err);
        alert('Failed to generate agent flow. Check console and API key.');
      } finally {
        setAppState(AppState.IDLE);
        window.dispatchEvent(new CustomEvent('mindmap:agent-end'));
        
        setTimeout(() => {
          runSmartAlign();
          
          const newMap: SavedMap = {
            id: Date.now().toString(),
            topic,
            nodes: getNodes(),
            edges: getEdges(),
            createdAt: Date.now()
          };
          window.dispatchEvent(new CustomEvent('mindmap:save-map', { detail: newMap }));
        }, 100);
      }
    };

    window.addEventListener('mindmap:generate-agent', handleAgentGenerate);
    return () => window.removeEventListener('mindmap:generate-agent', handleAgentGenerate);
  }, [setNodes, setEdges, fitView, getNodes, getEdges, extendSelection, runSmartAlign]);

  // Handle Loading a Saved Map
  useEffect(() => {
    const handleLoadMap = (e: Event) => {
      const customEvent = e as CustomEvent<SavedMap>;
      const { nodes: loadedNodes, edges: loadedEdges } = customEvent.detail;
      setNodes(loadedNodes);
      setEdges(loadedEdges);
      setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 50);
    };

    window.addEventListener('mindmap:load-map', handleLoadMap);
    return () => window.removeEventListener('mindmap:load-map', handleLoadMap);
  }, [setNodes, setEdges, fitView]);

  const onDeleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  }, [setNodes, setEdges]);

  const onExpandAI = useCallback(async (nodeId: string) => {
    const node = getNode(nodeId);
    if (!node) return;

    setAppState(AppState.GENERATING);
    try {
      const subTopics = await generateSubTopics(node.data.label);
      
      subTopics.forEach((topic, index) => {
        const yOffset = (index - (subTopics.length - 1) / 2) * 100;
        const newX = node.position.x + 300;
        const newY = node.position.y + yOffset;

        addNode({ x: newX, y: newY }, nodeId, topic);
      });
    } catch (e) {
      console.error(e);
      alert('Failed to generate ideas.');
    } finally {
      setAppState(AppState.IDLE);
    }
  }, [addNode, getNode]);

  const onRename = useCallback((nodeId: string) => {
    const node = getNode(nodeId);
    if (!node) return;
    const newLabel = prompt("Enter new name:", node.data.label);
    if (newLabel !== null && newLabel.trim() !== "") {
      setNodes((nds) => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, label: newLabel }} : n));
    }
  }, [getNode, setNodes]);

  const onCanvasAddNode = useCallback((position: { x: number; y: number }) => {
     const flowPos = screenToFlowPosition(position);
     addNode(flowPos, undefined, "New Idea");
  }, [addNode, screenToFlowPosition]);

  return (
    <div className={`w-full h-full ${isAligning ? '[&_.react-flow__node]:transition-transform [&_.react-flow__node]:duration-500 [&_.react-flow__node]:ease-out' : ''}`} ref={ref}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        onSelectionChange={onSelectionChange}
        onPaneContextMenu={(e) => onContextMenu(e)}
        onNodeContextMenu={(e, node) => onContextMenu(e, node)}
        nodeTypes={nodeTypes}
        zoomOnDoubleClick={false}
        fitView
        className="bg-[#fbfbfa]"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
        <Controls showInteractive={false} className="!bg-white !border-slate-200 !shadow-sm !m-4" />
        <MiniMap 
          nodeColor={(n) => n.data?.isRoot ? '#0f172a' : (n.data?.color ?? '#e2e8f0')} 
          className="!bg-white !border-slate-200 !shadow-sm !rounded-lg !bottom-8 !right-8"
        />
        
        <Panel position="top-right" className="mt-4 mr-4">
          <button
            onClick={runSmartAlign}
            disabled={appState === AppState.GENERATING}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md shadow-sm text-xs font-semibold tracking-wide transition-colors disabled:opacity-50"
            title="Re-flow the tree so nothing overlaps"
          >
            <Wand2 size={14} />
            Smart Align
          </button>
        </Panel>

        <Panel position="top-center" className="bg-white/80 backdrop-blur-sm border border-slate-200 p-2 rounded-md shadow-sm text-xs text-slate-500 font-medium px-4 mt-4 pointer-events-none select-none tracking-wide">
          Double-click a node to edit markdown • Select a node, then Generate to extend it • Right-click for AI
        </Panel>

        {menu && (
          <ContextMenu
            {...menu}
            onClose={() => setMenu(null)}
            onAddNode={onCanvasAddNode}
            onDeleteNode={onDeleteNode}
            onExpandAI={onExpandAI}
            onRename={onRename}
          />
        )}
      </ReactFlow>
    </div>
  );
};

export default function MindMap() {
  return (
    <ReactFlowProvider>
      <MindMapContent />
    </ReactFlowProvider>
  );
}
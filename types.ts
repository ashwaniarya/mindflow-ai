import { Node, Edge } from 'reactflow';

export interface MindMapData {
  label: string;
  isRoot?: boolean;
  color?: string;
}

export type MindMapNode = Node<MindMapData>;
export type MindMapEdge = Edge;

export interface SavedMap {
  id: string;
  topic: string;
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  createdAt: number;
}

export interface ContextMenuProps {
  id: string;
  top: number;
  left: number;
  right: number;
  bottom: number;
  nodeId?: string;
  onClose: () => void;
  onAddNode: (position: { x: number; y: number }) => void;
  onDeleteNode: (nodeId: string) => void;
  onExpandAI: (nodeId: string) => void;
  onRename: (nodeId: string) => void;
}

export enum AppState {
  IDLE = 'IDLE',
  GENERATING = 'GENERATING',
}

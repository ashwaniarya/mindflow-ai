import { Edge } from 'reactflow';
import { MindMapNode } from '../types';

const fallbackWidth = 220;
const fallbackHeight = 56;
const rowGap = 28;
const columnGap = 120;
const treeGap = 160;

const nodeWidth = (node: MindMapNode) => node.width ?? fallbackWidth;
const nodeHeight = (node: MindMapNode) => node.height ?? fallbackHeight;

export const smartAlign = (nodes: MindMapNode[], edges: Edge[]): MindMapNode[] => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const children = new Map<string, string[]>();
  const hasParent = new Set<string>();

  edges.forEach((edge) => {
    if (!byId.has(edge.source) || !byId.has(edge.target) || hasParent.has(edge.target)) return;
    hasParent.add(edge.target);
    children.set(edge.source, [...(children.get(edge.source) ?? []), edge.target]);
  });

  const subtreeHeight = new Map<string, number>();
  const measure = (id: string, trail: Set<string>): number => {
    if (subtreeHeight.has(id)) return subtreeHeight.get(id)!;
    if (trail.has(id)) return nodeHeight(byId.get(id)!);
    trail.add(id);
    const kids = children.get(id) ?? [];
    const stacked = kids.reduce((sum, kid) => sum + measure(kid, trail), 0) + rowGap * Math.max(0, kids.length - 1);
    const height = Math.max(nodeHeight(byId.get(id)!), stacked);
    subtreeHeight.set(id, height);
    return height;
  };

  const positions = new Map<string, { x: number; y: number }>();
  const place = (id: string, x: number, top: number, trail: Set<string>) => {
    if (positions.has(id) || trail.has(id)) return;
    trail.add(id);
    const node = byId.get(id)!;
    const height = measure(id, new Set());
    positions.set(id, { x, y: top + (height - nodeHeight(node)) / 2 });
    let cursor = top;
    (children.get(id) ?? []).forEach((kid) => {
      place(kid, x + nodeWidth(node) + columnGap, cursor, trail);
      cursor += measure(kid, new Set()) + rowGap;
    });
  };

  const roots = nodes.filter((node) => !hasParent.has(node.id));
  const ordered = [...roots].sort((a, b) => (b.data.isRoot ? 1 : 0) - (a.data.isRoot ? 1 : 0) || a.position.y - b.position.y);
  let top = 0;
  ordered.forEach((root) => {
    place(root.id, 0, top, new Set());
    top += measure(root.id, new Set()) + treeGap;
  });

  return nodes.map((node) => {
    const next = positions.get(node.id);
    return next ? { ...node, position: { x: Math.round(next.x), y: Math.round(next.y) } } : node;
  });
};

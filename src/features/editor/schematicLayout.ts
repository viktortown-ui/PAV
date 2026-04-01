import { Edge, Node } from 'reactflow';
import { SoapEdge, SoapNodeData } from '../../domain/schemas/types';

type Point = { x: number; y: number };

export type SchematicLayoutState = {
  autoNodePositions: Record<string, Point>;
  manualNodePositions: Record<string, Point>;
};

export type SchematicRoute = {
  points: Point[];
};

const NODE_W = 164;
const NODE_H = 92;
const X_STEP = 260;
const Y_STEP = 148;

const isInlineEquipment = (node: Node<SoapNodeData>) => node.data.className === 'valve' || node.data.className === 'instrument' || node.data.ports.inline;

const classifyWeight = (node: Node<SoapNodeData>) => {
  if (node.data.className === 'terminal' || node.data.kind === 'source') return -2;
  if (node.data.className === 'line' || isInlineEquipment(node)) return -1;
  if (node.data.className === 'major') return 2;
  return 0;
};

const fallbackPoint = (node: Node<SoapNodeData>): Point => ({ x: node.position.x, y: node.position.y });

const rankNodes = (nodes: Node<SoapNodeData>[], edges: Edge[]) => {
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  const rank = new Map<string, number>();

  nodes.forEach((node) => {
    incoming.set(node.id, []);
    outgoing.set(node.id, []);
    indegree.set(node.id, 0);
    rank.set(node.id, 0);
  });

  edges.forEach((edge) => {
    incoming.get(edge.target)?.push(edge.source);
    outgoing.get(edge.source)?.push(edge.target);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  });

  const queue = nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id);
  const visited = new Set<string>();

  while (queue.length) {
    const id = queue.shift()!;
    visited.add(id);
    const currentRank = rank.get(id) ?? 0;
    (outgoing.get(id) ?? []).forEach((targetId) => {
      const nextRank = Math.max(rank.get(targetId) ?? 0, currentRank + 1);
      rank.set(targetId, nextRank);
      indegree.set(targetId, (indegree.get(targetId) ?? 0) - 1);
      if ((indegree.get(targetId) ?? 0) <= 0) queue.push(targetId);
    });
  }

  nodes.forEach((node) => {
    if (!visited.has(node.id)) {
      const incomingRank = Math.max(0, ...(incoming.get(node.id) ?? []).map((sourceId) => rank.get(sourceId) ?? 0));
      rank.set(node.id, incomingRank + (isInlineEquipment(node) ? 0 : 1));
    }
  });

  return rank;
};

const orthRoute = (source: Point, target: Point, edgeOffset = 0): SchematicRoute => {
  const sx = source.x + NODE_W;
  const sy = source.y + NODE_H / 2;
  const tx = target.x;
  const ty = target.y + NODE_H / 2;
  const middleX = sx + Math.max(44, ((tx - sx) * 0.5)) + edgeOffset;
  return {
    points: [
      { x: sx, y: sy },
      { x: middleX, y: sy },
      { x: middleX, y: ty },
      { x: tx, y: ty },
    ],
  };
};

export const buildSchematicLayout = (
  nodes: Node<SoapNodeData>[],
  edges: Edge[],
  layoutState?: Partial<SchematicLayoutState>,
): { positions: Record<string, Point>; routes: Record<string, SchematicRoute> } => {
  const rank = rankNodes(nodes, edges);
  const laneCursor = new Map<number, number>();
  const sortedNodes = [...nodes].sort((a, b) => {
    const rankDelta = (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0);
    if (rankDelta !== 0) return rankDelta;
    const weightDelta = classifyWeight(a) - classifyWeight(b);
    if (weightDelta !== 0) return weightDelta;
    return a.position.y - b.position.y;
  });

  const autoNodePositions: Record<string, Point> = {};
  sortedNodes.forEach((node) => {
    const xRank = rank.get(node.id) ?? 0;
    const lane = laneCursor.get(xRank) ?? 0;
    laneCursor.set(xRank, lane + 1);
    autoNodePositions[node.id] = {
      x: 80 + xRank * X_STEP,
      y: 90 + lane * Y_STEP,
    };
  });

  const manualNodePositions = layoutState?.manualNodePositions ?? {};
  const persistedAuto = layoutState?.autoNodePositions ?? {};
  const positions = Object.fromEntries(nodes.map((node) => {
    const point = manualNodePositions[node.id] ?? autoNodePositions[node.id] ?? persistedAuto[node.id] ?? fallbackPoint(node);
    return [node.id, point];
  }));

  const edgeLaneCounter = new Map<string, number>();
  const routes: Record<string, SchematicRoute> = {};
  edges.forEach((edge) => {
    const source = positions[edge.source];
    const target = positions[edge.target];
    if (!source || !target) return;
    const key = `${edge.source}:${edge.target}`;
    const index = edgeLaneCounter.get(key) ?? 0;
    edgeLaneCounter.set(key, index + 1);
    routes[edge.id] = orthRoute(source, target, index * 16);
  });

  return { positions, routes };
};

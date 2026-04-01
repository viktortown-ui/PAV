import ELK from 'elkjs/lib/elk.bundled.js';
import { Edge, Node } from 'reactflow';
import { SoapNodeData } from '../../domain/schemas/types';
import { getPortPoint, getSchematicSymbol, Point } from './schematicSymbols';

export type SchematicLayoutState = {
  autoNodePositions: Record<string, Point>;
  manualNodePositions: Record<string, Point>;
};

export type SchematicRoute = {
  points: Point[];
  labelPoint?: Point;
};

const X_STEP = 260;
const Y_STEP = 148;
const ELK_ENGINE_ENABLED = true;

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

const withManualOverrides = (
  nodes: Node<SoapNodeData>[],
  autoNodePositions: Record<string, Point>,
  layoutState?: Partial<SchematicLayoutState>,
) => {
  const manualNodePositions = layoutState?.manualNodePositions ?? {};
  const persistedAuto = layoutState?.autoNodePositions ?? {};
  return Object.fromEntries(nodes.map((node) => {
    const point = manualNodePositions[node.id] ?? autoNodePositions[node.id] ?? persistedAuto[node.id] ?? fallbackPoint(node);
    return [node.id, point];
  }));
};

export const resolveEdgeAnchors = (
  edge: Edge,
  sourceNode: Node<SoapNodeData>,
  targetNode: Node<SoapNodeData>,
) => ({
  source: getPortPoint(sourceNode, edge.sourceHandle),
  target: getPortPoint(targetNode, edge.targetHandle),
});

const buildOrthogonalRoute = (source: Point, target: Point, edgeOffset = 0): SchematicRoute => {
  const horizontalDistance = target.x - source.x;
  const middleX = source.x + Math.max(36, horizontalDistance * 0.5) + edgeOffset;
  const points = [
    source,
    { x: middleX, y: source.y },
    { x: middleX, y: target.y },
    target,
  ];
  const middleSegmentY = (source.y + target.y) / 2;
  return {
    points,
    labelPoint: { x: middleX + 16, y: middleSegmentY },
  };
};

const buildRoutes = (nodes: Node<SoapNodeData>[], edges: Edge[], positions: Record<string, Point>) => {
  const nodeById = new Map(nodes.map((node) => [node.id, { ...node, position: positions[node.id] ?? node.position }]));
  const edgeLaneCounter = new Map<string, number>();
  const routes: Record<string, SchematicRoute> = {};
  edges.forEach((edge) => {
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    if (!sourceNode || !targetNode) return;
    const { source, target } = resolveEdgeAnchors(edge, sourceNode, targetNode);
    const key = `${edge.source}:${edge.target}`;
    const index = edgeLaneCounter.get(key) ?? 0;
    edgeLaneCounter.set(key, index + 1);
    routes[edge.id] = buildOrthogonalRoute(source, target, index * 16);
  });
  return routes;
};

export const buildSchematicLayoutLightweight = (
  nodes: Node<SoapNodeData>[],
  edges: Edge[],
  layoutState?: Partial<SchematicLayoutState>,
): { positions: Record<string, Point>; routes: Record<string, SchematicRoute>; autoPositions: Record<string, Point> } => {
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

  const positions = withManualOverrides(nodes, autoNodePositions, layoutState);
  return { positions, routes: buildRoutes(nodes, edges, positions), autoPositions: autoNodePositions };
};

export const buildSchematicLayoutElk = async (
  nodes: Node<SoapNodeData>[],
  edges: Edge[],
  layoutState?: Partial<SchematicLayoutState>,
): Promise<{ positions: Record<string, Point>; routes: Record<string, SchematicRoute>; autoPositions: Record<string, Point> }> => {
  const elk = new ELK();
  const graph = {
    id: 'schematic-root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '54',
      'elk.layered.spacing.nodeNodeBetweenLayers': '84',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    },
    children: nodes.map((node) => {
      const symbol = getSchematicSymbol(node);
      return { id: node.id, width: symbol.size.width, height: symbol.size.height };
    }),
    edges: edges.map((edge) => ({ id: edge.id, sources: [edge.source], targets: [edge.target] })),
  };

  const elkResult = await elk.layout(graph as any);
  const autoNodePositions: Record<string, Point> = {};
  elkResult.children?.forEach((node) => {
    autoNodePositions[node.id] = { x: node.x ?? 0, y: node.y ?? 0 };
  });

  const positions = withManualOverrides(nodes, autoNodePositions, layoutState);
  return { positions, routes: buildRoutes(nodes, edges, positions), autoPositions: autoNodePositions };
};

export const buildSchematicLayout = (
  nodes: Node<SoapNodeData>[],
  edges: Edge[],
  layoutState?: Partial<SchematicLayoutState>,
) => buildSchematicLayoutLightweight(nodes, edges, layoutState);

export const shouldUseElkLayout = () => ELK_ENGINE_ENABLED;

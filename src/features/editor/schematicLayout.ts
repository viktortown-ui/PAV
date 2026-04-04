import { Edge, Node } from 'reactflow';
import { SoapNodeData } from '../../domain/schemas/types';
import { getPortPoint, getSchematicPorts, getSchematicSymbol, Point } from './schematicSymbols';

export type SchematicLayoutState = {
  autoNodePositions: Record<string, Point>;
};

export type CanonicalNodeClass = 'apparatus' | 'inline_device' | 'instrument' | 'terminal';

export type CanonicalProcessNode = {
  id: string;
  type: SoapNodeData['kind'];
  subtype?: string;
  displayName: string;
  tag: string;
  class: CanonicalNodeClass;
  ports: ReturnType<typeof getSchematicPorts>;
};

export type CanonicalProcessEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  medium: string;
  dn?: string;
  serviceTag?: string;
  flowDirection: string;
  lineClass?: string;
};

export type CanonicalProcessGraph = {
  nodes: CanonicalProcessNode[];
  edges: CanonicalProcessEdge[];
};

export type SchematicRoute = {
  points: Point[];
  labelPoint?: Point;
  secondaryLabelPoint?: Point;
  showSecondaryLabel?: boolean;
};

const X_STEP = 170;
const Y_STEP = 92;
const EDGE_LABEL_SIZE = { width: 90, height: 24 };
const SECONDARY_LABEL_SIZE = { width: 120, height: 18 };
const ELK_ENGINE_ENABLED = false;

const canonicalClassOrder: Record<CanonicalNodeClass, number> = {
  terminal: 0,
  apparatus: 1,
  inline_device: 2,
  instrument: 3,
};

const toCanonicalClass = (node: Node<SoapNodeData>): CanonicalNodeClass => {
  if (node.data.className === 'instrument') return 'instrument';
  if (node.data.className === 'terminal' || node.data.kind === 'source' || node.data.kind === 'consumer' || node.data.kind === 'utilityDrain' || node.data.kind === 'serviceTerminal') return 'terminal';
  if (node.data.className === 'major') return 'apparatus';
  return 'inline_device';
};

const nodeStableKey = (node: Node<SoapNodeData>) => [
  String(canonicalClassOrder[toCanonicalClass(node)]),
  node.data.technicalTag || '',
  node.data.shortName || node.data.visibleName || '',
  node.id,
].join('|');

const sortNodesCanonically = (nodes: Node<SoapNodeData>[]) => [...nodes].sort((a, b) => nodeStableKey(a).localeCompare(nodeStableKey(b)));

const pointNear = (a: Point, b: Point, threshold = 20) => Math.hypot(a.x - b.x, a.y - b.y) <= threshold;

const intersects = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }, pad = 0) => (
  a.x - pad < b.x + b.width && a.x + a.width + pad > b.x && a.y - pad < b.y + b.height && a.y + a.height + pad > b.y
);

const nodeBox = (node: Node<SoapNodeData>, pos: Point) => {
  const symbol = getSchematicSymbol({ ...node, position: pos });
  return { x: pos.x, y: pos.y, width: symbol.size.width, height: symbol.size.height };
};

const placeLabel = (
  routePoints: Point[],
  nodeBoxes: Array<{ x: number; y: number; width: number; height: number }>,
  usedLabels: Array<{ x: number; y: number; width: number; height: number }>,
) => {
  const segments = Array.from({ length: routePoints.length - 1 }, (_, i) => [routePoints[i], routePoints[i + 1]] as const);
  const candidates: Point[] = [];
  segments.slice(Math.max(0, Math.floor(segments.length / 2) - 1), Math.floor(segments.length / 2) + 1).forEach(([a, b]) => {
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    candidates.push(mid, { x: mid.x, y: mid.y - 18 }, { x: mid.x, y: mid.y + 18 });
  });

  for (const point of candidates) {
    const box = { x: point.x - EDGE_LABEL_SIZE.width / 2, y: point.y - EDGE_LABEL_SIZE.height / 2, width: EDGE_LABEL_SIZE.width, height: EDGE_LABEL_SIZE.height };
    const hitsNode = nodeBoxes.some((n) => intersects(box, n, 6));
    const hitsLabel = usedLabels.some((used) => intersects(box, used, 6));
    const nearBend = routePoints.slice(1, -1).some((bend) => pointNear(point, bend, 20));
    const nearPort = pointNear(point, routePoints[0], 24) || pointNear(point, routePoints[routePoints.length - 1], 24);
    if (!hitsNode && !hitsLabel && !nearBend && !nearPort) {
      usedLabels.push(box);
      return point;
    }
  }
  return undefined;
};

const buildOrthogonalRoute = (source: Point, target: Point, edgeOffset = 0): SchematicRoute => {
  const horizontalGap = target.x - source.x;
  const laneNudge = edgeOffset * 8;
  const sourceStub = Math.max(16, Math.min(30, Math.abs(horizontalGap) * 0.18));
  const targetStub = Math.max(14, Math.min(26, Math.abs(horizontalGap) * 0.16));
  const sourceStubPoint = { x: source.x + sourceStub, y: source.y };
  const targetStubPoint = { x: target.x - targetStub, y: target.y };
  const middleX = Math.max(sourceStubPoint.x + 10, (sourceStubPoint.x + targetStubPoint.x) / 2 + laneNudge);

  if (Math.abs(target.y - source.y) <= 10) {
    return { points: [source, sourceStubPoint, { x: targetStubPoint.x, y: source.y }, target] };
  }
  return {
    points: [
      source,
      sourceStubPoint,
      { x: middleX, y: source.y },
      { x: middleX, y: target.y },
      targetStubPoint,
      target,
    ],
  };
};

const findNearestFreeLane = (preferred: number, used: Set<number>) => {
  const base = Math.round(preferred);
  if (!used.has(base)) return base;
  for (let delta = 1; delta < 50; delta += 1) {
    const up = base - delta;
    if (!used.has(up)) return up;
    const down = base + delta;
    if (!used.has(down)) return down;
  }
  return base;
};

const buildTopologyMetadata = (nodes: Node<SoapNodeData>[], edges: Edge[]) => {
  const inMap = new Map(nodes.map((n) => [n.id, [] as string[]]));
  const outMap = new Map(nodes.map((n) => [n.id, [] as string[]]));
  edges.forEach((edge) => {
    inMap.get(edge.target)?.push(edge.source);
    outMap.get(edge.source)?.push(edge.target);
  });
  nodes.forEach((node) => {
    inMap.set(node.id, (inMap.get(node.id) ?? []).sort());
    outMap.set(node.id, (outMap.get(node.id) ?? []).sort());
  });
  return { inMap, outMap };
};

const buildTopologicalOrder = (nodes: Node<SoapNodeData>[], edges: Edge[]) => {
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  const { outMap } = buildTopologyMetadata(nodes, edges);
  edges.forEach((edge) => indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1));

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const queue = sortNodesCanonically(nodes.filter((n) => (indegree.get(n.id) ?? 0) === 0)).map((n) => n.id);
  const orderedIds: string[] = [];

  while (queue.length) {
    const id = queue.shift()!;
    orderedIds.push(id);
    const outgoing = [...(outMap.get(id) ?? [])].sort((a, b) => nodeStableKey(nodeById.get(a)!).localeCompare(nodeStableKey(nodeById.get(b)!)));
    outgoing.forEach((targetId) => {
      indegree.set(targetId, (indegree.get(targetId) ?? 0) - 1);
      if ((indegree.get(targetId) ?? 0) === 0) {
        queue.push(targetId);
        queue.sort((a, b) => nodeStableKey(nodeById.get(a)!).localeCompare(nodeStableKey(nodeById.get(b)!)));
      }
    });
  }

  if (orderedIds.length !== nodes.length) {
    const rest = nodes.filter((n) => !orderedIds.includes(n.id)).map((n) => n.id).sort();
    orderedIds.push(...rest);
  }
  return orderedIds;
};

const buildCanonicalLaneLayout = (nodes: Node<SoapNodeData>[], edges: Edge[]) => {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const order = buildTopologicalOrder(nodes, edges);
  const { inMap, outMap } = buildTopologyMetadata(nodes, edges);
  const rank = new Map(nodes.map((node) => [node.id, 0]));

  order.forEach((id) => {
    const parents = inMap.get(id) ?? [];
    const nodeRank = parents.length
      ? Math.max(...parents.map((p) => (rank.get(p) ?? 0) + 1))
      : 0;
    rank.set(id, nodeRank);
  });

  const lane = new Map<string, number>();
  const usedByRank = new Map<number, Set<number>>();

  order.forEach((id) => {
    const node = nodeById.get(id)!;
    const parents = inMap.get(id) ?? [];
    const myRank = rank.get(id) ?? 0;
    const used = usedByRank.get(myRank) ?? new Set<number>();

    let preferredLane = 0;
    if (parents.length) {
      const parentLanes = parents.map((p) => lane.get(p) ?? 0);
      preferredLane = parentLanes.reduce((sum, value) => sum + value, 0) / parentLanes.length;
      if (parents.length === 1) {
        const parentId = parents[0]!;
        const siblings = (outMap.get(parentId) ?? []).map((childId) => nodeById.get(childId)!).sort((a, b) => nodeStableKey(a).localeCompare(nodeStableKey(b)));
        const parentLane = lane.get(parentId) ?? 0;
        const siblingIndex = siblings.findIndex((child) => child.id === id);
        const branchOffset = siblingIndex - (siblings.length - 1) / 2;
        preferredLane = parentLane + branchOffset;
        const inline = toCanonicalClass(node) === 'inline_device' || toCanonicalClass(node) === 'instrument';
        if (inline && siblings.length === 1) preferredLane = parentLane;
      }
    }

    const finalLane = findNearestFreeLane(preferredLane, used);
    lane.set(id, finalLane);
    used.add(finalLane);
    usedByRank.set(myRank, used);
  });

  const laneValues = [...lane.values()];
  const laneShift = laneValues.length ? Math.min(...laneValues) : 0;
  const autoNodePositions: Record<string, Point> = {};

  nodes.forEach((node) => {
    const xRank = rank.get(node.id) ?? 0;
    const yLane = (lane.get(node.id) ?? 0) - laneShift;
    autoNodePositions[node.id] = { x: 80 + xRank * X_STEP, y: 90 + yLane * Y_STEP };
  });

  return autoNodePositions;
};

const buildRoutes = (nodes: Node<SoapNodeData>[], edges: Edge[], positions: Record<string, Point>) => {
  const nodeById = new Map(nodes.map((node) => [node.id, { ...node, position: positions[node.id] } as Node<SoapNodeData>]));
  const edgeLaneCounter = new Map<string, number>();
  const nodeBoxes = nodes.map((node) => nodeBox(node, positions[node.id]));
  const usedLabelBoxes: Array<{ x: number; y: number; width: number; height: number }> = [];
  const routes: Record<string, SchematicRoute> = {};

  edges.forEach((edge) => {
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    if (!sourceNode || !targetNode) return;
    const source = getPortPoint(sourceNode, edge.sourceHandle);
    const target = getPortPoint(targetNode, edge.targetHandle);
    const points = buildOrthogonalRoute(source, target, (edgeLaneCounter.get(`${edge.source}:${edge.target}`) ?? 0) * 10).points;
    const primary = placeLabel(points, nodeBoxes, usedLabelBoxes);
    const secondary = primary ? { x: primary.x, y: primary.y + 14 } : undefined;
    const canShowSecondary = Boolean(secondary) && !nodeBoxes.some((n) => intersects({ x: secondary!.x - SECONDARY_LABEL_SIZE.width / 2, y: secondary!.y - SECONDARY_LABEL_SIZE.height / 2, width: SECONDARY_LABEL_SIZE.width, height: SECONDARY_LABEL_SIZE.height }, n, 6));
    routes[edge.id] = { points, labelPoint: primary, secondaryLabelPoint: secondary, showSecondaryLabel: canShowSecondary };
    edgeLaneCounter.set(`${edge.source}:${edge.target}`, (edgeLaneCounter.get(`${edge.source}:${edge.target}`) ?? 0) + 1);
  });

  return routes;
};

export const buildCanonicalProcessGraph = (nodes: Node<SoapNodeData>[], edges: Edge[]): CanonicalProcessGraph => ({
  nodes: sortNodesCanonically(nodes).map((node) => ({
    id: node.id,
    type: node.data.kind,
    subtype: node.data.subtype,
    displayName: node.data.visibleName,
    tag: node.data.shortName || node.data.technicalTag,
    class: toCanonicalClass(node),
    ports: getSchematicPorts(node),
  })),
  edges: edges.map((edge) => ({
    id: edge.id,
    sourceId: edge.source,
    targetId: edge.target,
    medium: edge.data?.mediumType ?? edge.data?.medium ?? 'unknown',
    dn: edge.data?.nominalDiameter,
    serviceTag: edge.data?.serviceTag,
    flowDirection: edge.data?.flowDirection ?? 'forward',
    lineClass: edge.data?.lineRole,
  })),
});

export const buildCanonicalSchematic = (nodes: Node<SoapNodeData>[], edges: Edge[]) => {
  const canonicalGraph = buildCanonicalProcessGraph(nodes, edges);
  const autoPositions = buildCanonicalLaneLayout(nodes, edges);
  const routes = buildRoutes(nodes, edges, autoPositions);
  return {
    canonicalGraph,
    positions: autoPositions,
    routes,
    autoPositions,
  };
};

export const buildElkGraphFromProcessModel = (nodes: Node<SoapNodeData>[], edges: Edge[]) => ({
  id: 'schematic-root',
  layoutOptions: {
    'elk.algorithm': 'layered',
    'elk.direction': 'RIGHT',
    'elk.edgeRouting': 'ORTHOGONAL',
  },
  children: nodes.map((node) => {
    const symbol = getSchematicSymbol(node);
    return {
      id: node.id,
      width: symbol.size.width,
      height: symbol.size.height,
      ports: getSchematicPorts(node).map((port) => ({
        id: `${node.id}:${port.id}`,
        width: 6,
        height: 6,
      })),
    };
  }),
  edges: edges.map((edge) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
    sourcePort: `${edge.source}:${edge.sourceHandle ?? 'out-right'}`,
    targetPort: `${edge.target}:${edge.targetHandle ?? 'in-left'}`,
  })),
});

export const resolveEdgeAnchors = (edge: Edge, sourceNode: Node<SoapNodeData>, targetNode: Node<SoapNodeData>) => ({
  source: getPortPoint(sourceNode, edge.sourceHandle),
  target: getPortPoint(targetNode, edge.targetHandle),
});

export const buildSchematicLayoutLightweight = (nodes: Node<SoapNodeData>[], edges: Edge[]) => {
  const result = buildCanonicalSchematic(nodes, edges);
  return { positions: result.positions, routes: result.routes, autoPositions: result.autoPositions, canonicalGraph: result.canonicalGraph };
};

export const buildSchematicLayoutElk = async (nodes: Node<SoapNodeData>[], edges: Edge[]) => Promise.resolve(buildSchematicLayoutLightweight(nodes, edges));

export const buildSchematicLayout = (nodes: Node<SoapNodeData>[], edges: Edge[]) => buildSchematicLayoutLightweight(nodes, edges);
export const shouldUseElkLayout = () => ELK_ENGINE_ENABLED;

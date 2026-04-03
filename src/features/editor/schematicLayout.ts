import ELK from 'elkjs/lib/elk.bundled';
import { Edge, Node } from 'reactflow';
import { SoapNodeData } from '../../domain/schemas/types';
import { getPortPoint, getSchematicPorts, getSchematicSymbol, Point } from './schematicSymbols';

export type SchematicLayoutState = {
  autoNodePositions: Record<string, Point>;
  manualNodePositions: Record<string, Point>;
};

export type SchematicRoute = {
  points: Point[];
  labelPoint?: Point;
  secondaryLabelPoint?: Point;
  showSecondaryLabel?: boolean;
};

const X_STEP = 162;
const Y_STEP = 94;
const ELK_ENGINE_ENABLED = false;
const EDGE_LABEL_SIZE = { width: 90, height: 24 };
const SECONDARY_LABEL_SIZE = { width: 120, height: 18 };

const isInlineEquipment = (node: Node<SoapNodeData>) => node.data.className === 'valve' || node.data.className === 'instrument' || node.data.ports.inline;
const fallbackPoint = (node: Node<SoapNodeData>): Point => ({ x: node.position.x, y: node.position.y });
const classifyWeight = (node: Node<SoapNodeData>) => {
  if (node.data.className === 'terminal' || node.data.kind === 'source') return -2;
  if (node.data.className === 'line' || isInlineEquipment(node)) return -1;
  if (node.data.className === 'major') return 2;
  return 0;
};

const withManualOverrides = (nodes: Node<SoapNodeData>[], autoNodePositions: Record<string, Point>, layoutState?: Partial<SchematicLayoutState>) => {
  const manualNodePositions = layoutState?.manualNodePositions ?? {};
  const persistedAuto = layoutState?.autoNodePositions ?? {};
  return Object.fromEntries(nodes.map((node) => [node.id, manualNodePositions[node.id] ?? autoNodePositions[node.id] ?? persistedAuto[node.id] ?? fallbackPoint(node)]));
};

const rankNodes = (nodes: Node<SoapNodeData>[], edges: Edge[]) => {
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));
  const rank = new Map(nodes.map((node) => [node.id, 0]));
  edges.forEach((edge) => {
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
  });
  const queue = nodes.filter((n) => (indegree.get(n.id) ?? 0) === 0).map((n) => n.id);
  while (queue.length) {
    const id = queue.shift()!;
    for (const targetId of outgoing.get(id) ?? []) {
      rank.set(targetId, Math.max(rank.get(targetId) ?? 0, (rank.get(id) ?? 0) + 1));
      indegree.set(targetId, (indegree.get(targetId) ?? 0) - 1);
      if ((indegree.get(targetId) ?? 0) <= 0) queue.push(targetId);
    }
  }
  return rank;
};

const nodeBox = (node: Node<SoapNodeData>, pos: Point) => {
  const symbol = getSchematicSymbol({ ...node, position: pos });
  return { x: pos.x, y: pos.y, width: symbol.size.width, height: symbol.size.height };
};

const intersects = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }, pad = 0) => (
  a.x - pad < b.x + b.width && a.x + a.width + pad > b.x && a.y - pad < b.y + b.height && a.y + a.height + pad > b.y
);

const pointNear = (a: Point, b: Point, threshold = 20) => Math.hypot(a.x - b.x, a.y - b.y) <= threshold;

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
  segments.forEach(([a, b]) => candidates.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }));

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
  const deltaX = target.x - source.x;
  const middleX = source.x + Math.max(18, deltaX * 0.5) + edgeOffset;
  if (Math.abs(target.y - source.y) <= 14) return { points: [source, { x: middleX, y: source.y }, target] };
  return { points: [source, { x: middleX, y: source.y }, { x: middleX, y: target.y }, target] };
};

const mapElkSectionPoints = (section: any, source: Point, target: Point): Point[] => [source, ...(section?.bendPoints ?? []).map((p: any) => ({ x: p.x, y: p.y })), target];

export const resolveEdgeAnchors = (edge: Edge, sourceNode: Node<SoapNodeData>, targetNode: Node<SoapNodeData>) => ({
  source: getPortPoint(sourceNode, edge.sourceHandle),
  target: getPortPoint(targetNode, edge.targetHandle),
});

const buildRoutes = (nodes: Node<SoapNodeData>[], edges: Edge[], positions: Record<string, Point>, elkEdges?: Map<string, any>) => {
  const nodeById = new Map(nodes.map((node) => [node.id, { ...node, position: positions[node.id] ?? node.position }]));
  const edgeLaneCounter = new Map<string, number>();
  const nodeBoxes = nodes.map((node) => nodeBox(node, positions[node.id] ?? node.position));
  const usedLabelBoxes: Array<{ x: number; y: number; width: number; height: number }> = [];
  const routes: Record<string, SchematicRoute> = {};

  edges.forEach((edge) => {
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    if (!sourceNode || !targetNode) return;
    const { source, target } = resolveEdgeAnchors(edge, sourceNode, targetNode);
    const elkEdge = elkEdges?.get(edge.id);
    const points = elkEdge?.sections?.[0] ? mapElkSectionPoints(elkEdge.sections[0], source, target) : buildOrthogonalRoute(source, target, (edgeLaneCounter.get(`${edge.source}:${edge.target}`) ?? 0) * 10).points;
    const primary = placeLabel(points, nodeBoxes, usedLabelBoxes);
    const secondary = primary ? { x: primary.x, y: primary.y + 14 } : undefined;
    const canShowSecondary = Boolean(secondary) && !nodeBoxes.some((n) => intersects({ x: secondary!.x - SECONDARY_LABEL_SIZE.width / 2, y: secondary!.y - SECONDARY_LABEL_SIZE.height / 2, width: SECONDARY_LABEL_SIZE.width, height: SECONDARY_LABEL_SIZE.height }, n, 6));
    routes[edge.id] = { points, labelPoint: primary, secondaryLabelPoint: secondary, showSecondaryLabel: canShowSecondary };
    edgeLaneCounter.set(`${edge.source}:${edge.target}`, (edgeLaneCounter.get(`${edge.source}:${edge.target}`) ?? 0) + 1);
  });
  return routes;
};

export const buildElkGraphFromProcessModel = (nodes: Node<SoapNodeData>[], edges: Edge[]) => ({
  id: 'schematic-root',
  layoutOptions: {
    'elk.algorithm': 'layered',
    'elk.direction': 'RIGHT',
    'elk.edgeRouting': 'ORTHOGONAL',
    'org.eclipse.elk.portConstraints': 'FIXED_ORDER',
    'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    'elk.spacing.nodeNode': '18',
    'elk.layered.spacing.nodeNodeBetweenLayers': '30',
  },
  children: nodes.map((node) => {
    const symbol = getSchematicSymbol(node);
    return {
      id: node.id,
      width: symbol.size.width,
      height: symbol.size.height,
      layoutOptions: { 'org.eclipse.elk.portConstraints': 'FIXED_ORDER' },
      ports: getSchematicPorts(node).map((port) => ({
        id: `${node.id}:${port.id}`,
        width: 6,
        height: 6,
        properties: { side: port.side, role: port.role },
        layoutOptions: { 'org.eclipse.elk.port.side': port.side.toUpperCase() },
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

export const mapElkResultToSchematicLayout = (
  elkResult: any,
  nodes: Node<SoapNodeData>[],
  edges: Edge[],
  layoutState?: Partial<SchematicLayoutState>,
) => {
  const autoNodePositions: Record<string, Point> = {};
  elkResult.children?.forEach((node: any) => { autoNodePositions[node.id] = { x: node.x ?? 0, y: node.y ?? 0 }; });
  const positions = withManualOverrides(nodes, autoNodePositions, layoutState);
  const edgeMap = new Map<string, any>((elkResult.edges ?? []).map((edge: any) => [String(edge.id), edge] as [string, any]));
  return { positions, routes: buildRoutes(nodes, edges, positions, edgeMap), autoPositions: autoNodePositions };
};

export const buildSchematicLayoutLightweight = (nodes: Node<SoapNodeData>[], edges: Edge[], layoutState?: Partial<SchematicLayoutState>) => {
  const rank = rankNodes(nodes, edges);
  const laneCursor = new Map<number, number>();
  const sortedNodes = [...nodes].sort((a, b) => ((rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)) || (classifyWeight(a) - classifyWeight(b)) || (a.position.y - b.position.y));
  const autoNodePositions: Record<string, Point> = {};
  sortedNodes.forEach((node) => {
    const xRank = rank.get(node.id) ?? 0;
    const lane = laneCursor.get(xRank) ?? 0;
    laneCursor.set(xRank, lane + 1);
    autoNodePositions[node.id] = { x: 80 + xRank * X_STEP, y: 90 + lane * Y_STEP };
  });
  const positions = withManualOverrides(nodes, autoNodePositions, layoutState);
  return { positions, routes: buildRoutes(nodes, edges, positions), autoPositions: autoNodePositions };
};

export const buildSchematicLayoutElk = async (nodes: Node<SoapNodeData>[], edges: Edge[], layoutState?: Partial<SchematicLayoutState>) => {
  const elk = new ELK();
  const graph = buildElkGraphFromProcessModel(nodes, edges);
  const elkResult = await elk.layout(graph as any);
  return mapElkResultToSchematicLayout(elkResult, nodes, edges, layoutState);
};

export const buildSchematicLayout = (nodes: Node<SoapNodeData>[], edges: Edge[], layoutState?: Partial<SchematicLayoutState>) => buildSchematicLayoutLightweight(nodes, edges, layoutState);
export const shouldUseElkLayout = () => ELK_ENGINE_ENABLED;

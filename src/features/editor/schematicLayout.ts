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

export type SchematicSpine = {
  y: number;
  nodeIds: string[];
  segments: Array<{ from: Point; to: Point }>;
};

export type SchematicInlinePlacement = {
  nodeId: string;
  x: number;
  y: number;
  order: number;
};

export type SchematicApparatusPlacement = {
  nodeId: string;
  x: number;
  y: number;
  attachedToSpine: boolean;
  attachmentX: number;
  attachmentY: number;
};

export type SchematicBranchPlacement = {
  edgeId: string;
  sourceId: string;
  targetId: string;
  junction: Point;
  targetPoint: Point;
  points: Point[];
};

export type SchematicComposerModel = {
  spine: SchematicSpine;
  inlinePlacements: SchematicInlinePlacement[];
  apparatusPlacements: SchematicApparatusPlacement[];
  branchPlacements: SchematicBranchPlacement[];
  routes: Record<string, SchematicRoute>;
};

const X_GAP = 76;
const MAIN_SPINE_Y = 240;
const BASE_X = 120;
const LABEL_W = 90;
const LABEL_H = 24;
const SECONDARY_W = 120;
const SECONDARY_H = 18;
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

const isInlineClass = (klass: CanonicalNodeClass) => klass === 'inline_device' || klass === 'instrument';
const isApparatusClass = (klass: CanonicalNodeClass) => klass === 'apparatus' || klass === 'terminal';

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
    const box = { x: point.x - LABEL_W / 2, y: point.y - LABEL_H / 2, width: LABEL_W, height: LABEL_H };
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

const edgeByKey = (edges: Edge[]) => new Map(edges.map((edge) => [`${edge.source}->${edge.target}`, edge]));

const findMainSpinePath = (nodes: Node<SoapNodeData>[], edges: Edge[]) => {
  if (!nodes.length) return [] as string[];
  const order = buildTopologicalOrder(nodes, edges);
  const { inMap, outMap } = buildTopologyMetadata(nodes, edges);
  const score = new Map<string, number>();
  const prev = new Map<string, string | null>();

  order.forEach((id) => {
    const parents = inMap.get(id) ?? [];
    if (!parents.length) {
      score.set(id, 1);
      prev.set(id, null);
      return;
    }
    const ranked = [...parents].sort((a, b) => (score.get(b) ?? 0) - (score.get(a) ?? 0) || a.localeCompare(b));
    const best = ranked[0]!;
    score.set(id, (score.get(best) ?? 0) + 1);
    prev.set(id, best);
  });

  const sinks = order.filter((id) => (outMap.get(id)?.length ?? 0) === 0);
  const end = [...(sinks.length ? sinks : order)].sort((a, b) => (score.get(b) ?? 0) - (score.get(a) ?? 0) || a.localeCompare(b))[0];
  if (!end) return [order[0]!];
  const path: string[] = [];
  let cursor: string | null | undefined = end;
  while (cursor) {
    path.push(cursor);
    cursor = prev.get(cursor);
  }
  return path.reverse();
};

const centerNodeOnPortY = (node: Node<SoapNodeData>, desiredPortId: string, y: number) => {
  const symbol = getSchematicSymbol(node);
  const desired = symbol.ports.find((port) => port.id === desiredPortId)
    ?? symbol.ports.find((port) => port.side === 'left')
    ?? symbol.ports[0];
  const ratio = desired?.side === 'left' || desired?.side === 'right'
    ? desired.ratio
    : 0.5;
  return y - symbol.size.height * ratio;
};

const buildNodePositionsFromSpine = (nodes: Node<SoapNodeData>[], spineIds: string[]) => {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const positions: Record<string, Point> = {};
  const inlinePlacements: SchematicInlinePlacement[] = [];
  const apparatusPlacements: SchematicApparatusPlacement[] = [];

  let cursorX = BASE_X;
  spineIds.forEach((id, index) => {
    const node = nodeById.get(id);
    if (!node) return;
    const symbol = getSchematicSymbol(node);
    const klass = toCanonicalClass(node);
    const x = cursorX;
    const y = isInlineClass(klass)
      ? MAIN_SPINE_Y - symbol.size.height / 2
      : centerNodeOnPortY(node, 'in-left', MAIN_SPINE_Y);
    positions[id] = { x, y };
    if (isInlineClass(klass)) inlinePlacements.push({ nodeId: id, x, y, order: index });
    if (isApparatusClass(klass)) apparatusPlacements.push({ nodeId: id, x, y, attachedToSpine: true, attachmentX: x, attachmentY: MAIN_SPINE_Y });
    cursorX += symbol.size.width + X_GAP;
  });

  return { positions, inlinePlacements, apparatusPlacements };
};

const buildOrthogonalPipe = (source: Point, target: Point): Point[] => {
  if (Math.abs(source.y - target.y) <= 1) return [source, target];
  const midX = (source.x + target.x) / 2;
  return [source, { x: midX, y: source.y }, { x: midX, y: target.y }, target];
};

const buildPipeFirstComposer = (nodes: Node<SoapNodeData>[], edges: Edge[]) => {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const spineIds = findMainSpinePath(nodes, edges);
  const { positions, inlinePlacements, apparatusPlacements } = buildNodePositionsFromSpine(nodes, spineIds);
  const spineSet = new Set(spineIds);
  const { inMap } = buildTopologyMetadata(nodes, edges);

  const topological = buildTopologicalOrder(nodes, edges);
  const pending = topological.filter((id) => !spineSet.has(id));
  const branchYOffset = 150;

  pending.forEach((id, branchIndex) => {
    const node = nodeById.get(id);
    if (!node) return;
    const symbol = getSchematicSymbol(node);
    const parents = inMap.get(id) ?? [];
    const attachedParent = parents.find((p) => positions[p]) ?? spineIds[Math.max(0, spineIds.length - 1)];
    const parentPos = attachedParent ? positions[attachedParent] : { x: BASE_X, y: MAIN_SPINE_Y - symbol.size.height / 2 };
    const parentSymbol = attachedParent ? getSchematicSymbol(nodeById.get(attachedParent)!) : symbol;
    const parentAnchorX = parentPos.x + parentSymbol.size.width;
    const branchDirection = branchIndex % 2 === 0 ? 1 : -1;
    const x = parentAnchorX + X_GAP + branchIndex * 14;
    const y = MAIN_SPINE_Y + branchDirection * branchYOffset - symbol.size.height / 2;
    positions[id] = { x, y };
    if (isInlineClass(toCanonicalClass(node))) inlinePlacements.push({ nodeId: id, x, y, order: spineIds.length + branchIndex });
    else apparatusPlacements.push({ nodeId: id, x, y, attachedToSpine: Boolean(attachedParent), attachmentX: parentAnchorX, attachmentY: MAIN_SPINE_Y });
  });

  const routes: Record<string, SchematicRoute> = {};
  const branchPlacements: SchematicBranchPlacement[] = [];
  const edgeMap = edgeByKey(edges);

  for (let i = 0; i < spineIds.length - 1; i += 1) {
    const sourceId = spineIds[i]!;
    const targetId = spineIds[i + 1]!;
    const edge = edgeMap.get(`${sourceId}->${targetId}`);
    if (!edge) continue;
    const source = getPortPoint({ ...nodeById.get(sourceId)!, position: positions[sourceId] } as Node<SoapNodeData>, edge.sourceHandle);
    const target = getPortPoint({ ...nodeById.get(targetId)!, position: positions[targetId] } as Node<SoapNodeData>, edge.targetHandle);
    routes[edge.id] = { points: buildOrthogonalPipe(source, target), showSecondaryLabel: false };
  }

  edges.forEach((edge) => {
    if (routes[edge.id]) return;
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    if (!sourceNode || !targetNode) return;
    const source = getPortPoint({ ...sourceNode, position: positions[edge.source] } as Node<SoapNodeData>, edge.sourceHandle);
    const target = getPortPoint({ ...targetNode, position: positions[edge.target] } as Node<SoapNodeData>, edge.targetHandle);
    const points = buildOrthogonalPipe(source, target);
    routes[edge.id] = { points };
    if (spineSet.has(edge.source) && !spineSet.has(edge.target)) {
      branchPlacements.push({ edgeId: edge.id, sourceId: edge.source, targetId: edge.target, junction: { x: source.x, y: MAIN_SPINE_Y }, targetPoint: target, points });
    }
  });

  const spineSegments: Array<{ from: Point; to: Point }> = [];
  for (let i = 0; i < spineIds.length - 1; i += 1) {
    const fromId = spineIds[i]!;
    const toId = spineIds[i + 1]!;
    const edge = edgeMap.get(`${fromId}->${toId}`);
    const route = edge ? routes[edge.id] : undefined;
    if (route?.points?.length && route.points.length >= 2) {
      const from = route.points[0]!;
      const to = route.points[route.points.length - 1]!;
      spineSegments.push({ from, to });
    }
  }

  return {
    positions,
    model: {
      spine: { y: MAIN_SPINE_Y, nodeIds: spineIds, segments: spineSegments },
      inlinePlacements,
      apparatusPlacements,
      branchPlacements,
      routes,
    } as SchematicComposerModel,
  };
};

const applyLabelDeclutter = (nodes: Node<SoapNodeData>[], edges: Edge[], positions: Record<string, Point>, routes: Record<string, SchematicRoute>) => {
  const nodeBoxes = nodes.map((node) => nodeBox(node, positions[node.id]));
  const usedLabelBoxes: Array<{ x: number; y: number; width: number; height: number }> = [];

  edges.forEach((edge) => {
    const route = routes[edge.id];
    if (!route || route.points.length < 2) return;
    const primary = placeLabel(route.points, nodeBoxes, usedLabelBoxes);
    const secondary = primary ? { x: primary.x, y: primary.y + 14 } : undefined;
    const canShowSecondary = Boolean(secondary)
      && !nodeBoxes.some((n) => intersects({ x: secondary!.x - SECONDARY_W / 2, y: secondary!.y - SECONDARY_H / 2, width: SECONDARY_W, height: SECONDARY_H }, n, 6))
      && route.points.length > 3;
    routes[edge.id] = { ...route, labelPoint: primary, secondaryLabelPoint: secondary, showSecondaryLabel: Boolean(route.showSecondaryLabel) ? route.showSecondaryLabel : canShowSecondary };
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
  const composed = buildPipeFirstComposer(nodes, edges);
  const routes = applyLabelDeclutter(nodes, edges, composed.positions, composed.model.routes);
  return {
    canonicalGraph,
    positions: composed.positions,
    routes,
    autoPositions: composed.positions,
    composer: composed.model,
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
  return {
    positions: result.positions,
    routes: result.routes,
    autoPositions: result.autoPositions,
    canonicalGraph: result.canonicalGraph,
    composer: result.composer,
  };
};

export const buildSchematicLayoutElk = async (nodes: Node<SoapNodeData>[], edges: Edge[]) => Promise.resolve(buildSchematicLayoutLightweight(nodes, edges));

export const buildSchematicLayout = (nodes: Node<SoapNodeData>[], edges: Edge[]) => buildSchematicLayoutLightweight(nodes, edges);
export const shouldUseElkLayout = () => ELK_ENGINE_ENABLED;

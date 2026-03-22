import { Position } from 'reactflow';
import { ProjectDocument, SoapEdge, SoapNode, SoapNodeData } from '../schemas/types';

export type HandleRole = 'source' | 'target';
export type HandleSpec = { id: string; type: HandleRole; position: Position; className?: string };

export const DEFAULT_SOURCE_HANDLE = 'out-right';
export const DEFAULT_TARGET_HANDLE = 'in-left';

const TOPOLOGY_HANDLE_MAP: Partial<Record<SoapNodeData['kind'], HandleSpec[]>> = {
  tee: [
    { id: DEFAULT_TARGET_HANDLE, type: 'target', position: Position.Left, className: 'port-handle handle-left' },
    { id: DEFAULT_SOURCE_HANDLE, type: 'source', position: Position.Right, className: 'port-handle handle-right' },
    { id: 'out-top', type: 'source', position: Position.Top, className: 'port-handle branch-port-handle handle-top' },
  ],
  splitter: [
    { id: DEFAULT_TARGET_HANDLE, type: 'target', position: Position.Left, className: 'port-handle handle-left' },
    { id: DEFAULT_SOURCE_HANDLE, type: 'source', position: Position.Right, className: 'port-handle handle-right' },
    { id: 'out-top', type: 'source', position: Position.Top, className: 'port-handle branch-port-handle handle-top' },
  ],
  drainBranch: [
    { id: DEFAULT_TARGET_HANDLE, type: 'target', position: Position.Left, className: 'port-handle handle-left' },
    { id: DEFAULT_SOURCE_HANDLE, type: 'source', position: Position.Right, className: 'port-handle handle-right' },
    { id: 'out-top', type: 'source', position: Position.Top, className: 'port-handle branch-port-handle handle-top' },
  ],
  cross: [
    { id: DEFAULT_TARGET_HANDLE, type: 'target', position: Position.Left, className: 'port-handle handle-left' },
    { id: 'in-bottom', type: 'target', position: Position.Bottom, className: 'port-handle branch-port-handle handle-bottom' },
    { id: DEFAULT_SOURCE_HANDLE, type: 'source', position: Position.Right, className: 'port-handle handle-right' },
    { id: 'out-top', type: 'source', position: Position.Top, className: 'port-handle branch-port-handle handle-top' },
  ],
  collector: [
    { id: DEFAULT_TARGET_HANDLE, type: 'target', position: Position.Left, className: 'port-handle handle-left' },
    { id: 'in-top', type: 'target', position: Position.Top, className: 'port-handle branch-port-handle handle-top' },
    { id: DEFAULT_SOURCE_HANDLE, type: 'source', position: Position.Right, className: 'port-handle handle-right' },
  ],
  mixingJunction: [
    { id: DEFAULT_TARGET_HANDLE, type: 'target', position: Position.Left, className: 'port-handle handle-left' },
    { id: 'in-top', type: 'target', position: Position.Top, className: 'port-handle branch-port-handle handle-top' },
    { id: DEFAULT_SOURCE_HANDLE, type: 'source', position: Position.Right, className: 'port-handle handle-right' },
  ],
  samplePoint: [
    { id: DEFAULT_TARGET_HANDLE, type: 'target', position: Position.Left, className: 'port-handle handle-left' },
    { id: DEFAULT_SOURCE_HANDLE, type: 'source', position: Position.Right, className: 'port-handle handle-right' },
    { id: 'out-top', type: 'source', position: Position.Top, className: 'port-handle sample-port-handle handle-top' },
  ],
};

export const getHandleSpecs = (data: SoapNodeData): HandleSpec[] => {
  const topologyHandles = TOPOLOGY_HANDLE_MAP[data.kind];
  if (topologyHandles) return topologyHandles;

  const handles: HandleSpec[] = [];
  if (data.ports.inputs > 0 || data.className === 'topology') handles.push({ id: DEFAULT_TARGET_HANDLE, type: 'target', position: Position.Left, className: 'port-handle handle-left' });
  if (data.ports.outputs > 0 || data.className === 'topology') handles.push({ id: DEFAULT_SOURCE_HANDLE, type: 'source', position: Position.Right, className: 'port-handle handle-right' });
  return handles;
};

export const getHandleIds = (node: SoapNode, role: HandleRole) => getHandleSpecs(node.data).filter((handle) => handle.type === role).map((handle) => handle.id);

export const getDefaultHandleId = (node: SoapNode, role: HandleRole) => getHandleIds(node, role)[0] ?? (role === 'source' ? DEFAULT_SOURCE_HANDLE : DEFAULT_TARGET_HANDLE);

export const normalizeHandleForNode = (node: SoapNode, role: HandleRole, handleId: string | null | undefined) => {
  const ids = getHandleIds(node, role);
  if (!ids.length) return null;
  if (handleId && ids.includes(handleId)) return handleId;
  return getDefaultHandleId(node, role);
};

export const getUsedHandleIds = (edges: SoapEdge[], nodeId: string, role: HandleRole, excludeEdgeId?: string) => new Set(
  edges
    .filter((edge) => edge.id !== excludeEdgeId)
    .map((edge) => role === 'source' ? (edge.source === nodeId ? edge.sourceHandle : null) : (edge.target === nodeId ? edge.targetHandle : null))
    .filter((handleId): handleId is string => Boolean(handleId)),
);

export const getPreferredFreeHandleId = (node: SoapNode, role: HandleRole, edges: SoapEdge[], preferredHandleId?: string | null, excludeEdgeId?: string) => {
  const validIds = getHandleIds(node, role);
  if (!validIds.length) return null;
  const used = getUsedHandleIds(edges, node.id, role, excludeEdgeId);
  if (preferredHandleId && validIds.includes(preferredHandleId) && !used.has(preferredHandleId)) return preferredHandleId;
  return validIds.find((handleId) => !used.has(handleId)) ?? getDefaultHandleId(node, role);
};

export const normalizeProjectEdgeHandles = (project: ProjectDocument) => {
  const nodeById = new Map(project.nodes.map((node) => [node.id, node]));
  let changed = false;
  const edges = project.edges.map((edge) => {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) return edge;
    const sourceHandle = normalizeHandleForNode(source, 'source', edge.sourceHandle);
    const targetHandle = normalizeHandleForNode(target, 'target', edge.targetHandle);
    if (sourceHandle === edge.sourceHandle && targetHandle === edge.targetHandle) return edge;
    changed = true;
    return { ...edge, sourceHandle, targetHandle };
  });
  return changed ? { ...project, edges } : project;
};

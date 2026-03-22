import { buildEdge, buildNode, midPoint } from '../entities/projectFactory';
import { DEFAULT_SOURCE_HANDLE, DEFAULT_TARGET_HANDLE, getPreferredFreeHandleId, normalizeHandleForNode } from '../flow/handles';
import { ProjectDocument, SoapEdge, SoapNodeKind } from '../schemas/types';

const logEvent = (project: ProjectDocument, message: string, targetId?: string) => ({
  ...project,
  eventLog: [...project.eventLog, { id: crypto.randomUUID(), timestamp: new Date().toISOString(), type: 'editor', message, severity: 'info' as const, targetId }],
});

const getEdgeContext = (project: ProjectDocument, edgeId: string) => {
  const edge = project.edges.find((item) => item.id === edgeId);
  if (!edge) return null;
  const source = project.nodes.find((item) => item.id === edge.source);
  const target = project.nodes.find((item) => item.id === edge.target);
  if (!source || !target) return null;
  return { edge, source, target };
};

export const insertNodeIntoEdge = (project: ProjectDocument, edgeId: string, kind: SoapNodeKind) => {
  const ctx = getEdgeContext(project, edgeId);
  if (!ctx) return null;
  const { edge, source, target } = ctx;
  const node = buildNode(kind, midPoint(source, target));
  const upstreamHandle = normalizeHandleForNode(source, 'source', edge.sourceHandle) ?? DEFAULT_SOURCE_HANDLE;
  const downstreamHandle = normalizeHandleForNode(target, 'target', edge.targetHandle) ?? DEFAULT_TARGET_HANDLE;
  const insertTargetHandle = normalizeHandleForNode(node, 'target', DEFAULT_TARGET_HANDLE) ?? DEFAULT_TARGET_HANDLE;
  const insertSourceHandle = normalizeHandleForNode(node, 'source', DEFAULT_SOURCE_HANDLE) ?? DEFAULT_SOURCE_HANDLE;
  const newEdges = [
    buildEdge(source.id, node.id, edge.data?.medium ?? source.data.medium, edge.data?.nominalDiameter ?? 'DN50', { sourceHandle: upstreamHandle, targetHandle: insertTargetHandle }),
    buildEdge(node.id, target.id, edge.data?.medium ?? target.data.medium, edge.data?.nominalDiameter ?? 'DN50', { sourceHandle: insertSourceHandle, targetHandle: downstreamHandle }),
  ];
  const nextProject = logEvent({ ...project, nodes: [...project.nodes, node], edges: project.edges.filter((item) => item.id !== edge.id).concat(newEdges) }, `В линию вставлен элемент «${node.data.visibleName}».`, node.id);
  return { project: nextProject, nodeId: node.id };
};

export const createBranchFromEdge = (project: ProjectDocument, edgeId: string, kind: SoapNodeKind = 'tee') => {
  const ctx = getEdgeContext(project, edgeId);
  if (!ctx) return null;
  const { edge, source, target } = ctx;
  const branchNode = buildNode(kind, midPoint(source, target));
  const upstreamHandle = normalizeHandleForNode(source, 'source', edge.sourceHandle) ?? DEFAULT_SOURCE_HANDLE;
  const downstreamHandle = normalizeHandleForNode(target, 'target', edge.targetHandle) ?? DEFAULT_TARGET_HANDLE;
  const branchInputHandle = getPreferredFreeHandleId(branchNode, 'target', project.edges, DEFAULT_TARGET_HANDLE, edge.id) ?? normalizeHandleForNode(branchNode, 'target', DEFAULT_TARGET_HANDLE) ?? DEFAULT_TARGET_HANDLE;
  const inlineBranchEdge = buildEdge(source.id, branchNode.id, edge.data?.medium ?? source.data.medium, edge.data?.nominalDiameter ?? 'DN50', { sourceHandle: upstreamHandle, targetHandle: branchInputHandle });
  const selectedFreeSourceHandle = getPreferredFreeHandleId(branchNode, 'source', [inlineBranchEdge], DEFAULT_SOURCE_HANDLE) ?? normalizeHandleForNode(branchNode, 'source', DEFAULT_SOURCE_HANDLE) ?? DEFAULT_SOURCE_HANDLE;
  const newEdges = [
    inlineBranchEdge,
    buildEdge(branchNode.id, target.id, edge.data?.medium ?? target.data.medium, edge.data?.nominalDiameter ?? 'DN50', { sourceHandle: selectedFreeSourceHandle, targetHandle: downstreamHandle }),
  ];
  const nextProject = logEvent({ ...project, nodes: [...project.nodes, branchNode], edges: project.edges.filter((item) => item.id !== edge.id).concat(newEdges) }, `Создано ответвление через узел «${branchNode.data.visibleName}». Потяните свободный порт, чтобы сразу продолжить ветвь.`, branchNode.id);
  return { project: nextProject, nodeId: branchNode.id };
};

export const removeSegment = (project: ProjectDocument, edgeId: string) => logEvent({ ...project, edges: project.edges.filter((edge) => edge.id !== edgeId) }, 'Сегмент удалён.', edgeId);

export const reconnectSegment = (project: ProjectDocument, edgeId: string) => {
  const ctx = getEdgeContext(project, edgeId);
  if (!ctx) return null;
  const { edge, source, target } = ctx;
  const rerouted: SoapEdge = {
    ...edge,
    type: 'flowEdge',
    sourceHandle: normalizeHandleForNode(source, 'source', edge.sourceHandle),
    targetHandle: normalizeHandleForNode(target, 'target', edge.targetHandle),
    data: {
      ...edge.data!,
      stateLabel: 'Переподключён',
      medium: edge.data?.medium || 'water',
      flowActive: edge.data?.flowActive || false,
      blocked: edge.data?.blocked || false,
      routeState: edge.data?.routeState || 'idle',
      flowRate: edge.data?.flowRate || 0,
      pressure: edge.data?.pressure || 0,
    },
  };
  return logEvent({ ...project, edges: project.edges.map((item) => item.id === edge.id ? rerouted : item) }, `Сегмент «${source.data.shortName} → ${target.data.shortName}» отмечен для переподключения.`, edge.id);
};

import { ProjectDocument } from '../../domain/schemas/types';

export type BottomTab = 'overview' | 'control' | 'parameters' | 'diagnostics' | 'connections' | 'history';
export type BottomDockState = 'hidden' | 'peek' | 'expanded';

export interface BottomWorkbenchState {
  dock: BottomDockState;
  activeTab: BottomTab;
  targetType: 'node' | 'edge' | null;
  targetId?: string;
}

export const defaultBottomWorkbenchState: BottomWorkbenchState = {
  dock: 'hidden',
  activeTab: 'overview',
  targetType: null,
};

const traverse = (project: ProjectDocument, seedId: string, mode: 'upstream' | 'downstream') => {
  const visited = new Set<string>();
  const edgeIds: string[] = [];
  const queue = [seedId];
  while (queue.length) {
    const current = queue.shift()!;
    const linked = project.edges.filter((edge) => mode === 'upstream' ? edge.target === current : edge.source === current);
    linked.forEach((edge) => {
      const next = mode === 'upstream' ? edge.source : edge.target;
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
      edgeIds.push(edge.id);
    });
  }
  return { nodeIds: [...visited], edgeIds };
};

export const buildRouteTrace = (project: ProjectDocument, nodeId: string) => {
  const upstream = traverse(project, nodeId, 'upstream');
  const downstream = traverse(project, nodeId, 'downstream');
  return {
    upstream: upstream.nodeIds,
    downstream: downstream.nodeIds,
    edges: [...new Set([...upstream.edgeIds, ...downstream.edgeIds])],
  };
};

export const selectionOpensBottomPanel = (selectedNodeId?: string, selectedEdgeId?: string): BottomWorkbenchState => {
  if (selectedNodeId) return { dock: 'peek', activeTab: 'overview', targetType: 'node', targetId: selectedNodeId };
  if (selectedEdgeId) return { dock: 'peek', activeTab: 'connections', targetType: 'edge', targetId: selectedEdgeId };
  return defaultBottomWorkbenchState;
};

import { afterEach, describe, expect, it } from 'vitest';
import { cloneProject } from '../../domain/entities/projectFactory';
import { demoProject } from '../../domain/templates/templates';
import { useAppStore } from '../../store/useAppStore';

const resetStore = () => {
  useAppStore.setState({
    project: cloneProject(demoProject),
    projectRevision: 0,
    persistedRevision: 0,
    selectedNodeId: undefined,
    selectedEdgeId: undefined,
    inspectorTab: 'main',
    hoveredEdgeId: undefined,
    edgeEditorMode: undefined,
    lastCommand: undefined,
    startupState: 'ready',
    startupNotice: undefined,
    startupError: undefined,
  });
};

afterEach(() => {
  resetStore();
});

describe('inspector live updates', () => {
  it('pushes node edits into domain, summaries, and simulation mirrors immediately', () => {
    resetStore();
    const store = useAppStore.getState();
    const pump = store.project.nodes.find((node) => node.data.kind === 'pump')!;

    store.updateNodeField(pump.id, 'flowRate', 77);

    const updated = useAppStore.getState().project.nodes.find((node) => node.id === pump.id)!;
    expect((updated.data.process as any).flowRate).toBe(77);
    expect((updated.data.process as any).nominalFlowLpm).toBe(77);
    expect(updated.data.runtime.flowLpm).toBe(77);
    expect(updated.data.simulation.flowLpm).toBe(77);
    expect(useAppStore.getState().projectRevision).toBe(1);
  });

  it('applies edge inspector edits directly to live edge data', () => {
    resetStore();
    const store = useAppStore.getState();
    const edge = store.project.edges[0]!;

    store.updateEdgeField(edge.id, 'mediumType', 'cip');
    store.updateEdgeField(edge.id, 'nominalDiameter', 'DN80');

    const updated = useAppStore.getState().project.edges.find((item) => item.id === edge.id)!;
    expect(updated.data?.mediumType).toBe('cip');
    expect(updated.data?.medium).toBe('cip');
    expect(updated.data?.nominalDiameter).toBe('DN80');
  });
});

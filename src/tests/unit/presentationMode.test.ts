import { afterEach, describe, expect, it } from 'vitest';
import { cloneProject } from '../../domain/entities/projectFactory';
import { demoProject } from '../../domain/templates/templates';
import { restoreProjectDocument } from '../../domain/validation/validateProject';
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

describe('presentation mode', () => {
  it('uses schematic mode by default and restores safely for legacy projects', () => {
    const legacy = cloneProject(demoProject) as any;
    delete legacy.view.presentationMode;

    const restored = restoreProjectDocument(legacy);

    expect(restored.view.presentationMode).toBe('schematic');
  });


  it('stores and resets schematic manual overrides', () => {
    resetStore();
    const store = useAppStore.getState();
    const nodeId = store.project.nodes[0]!.id;

    store.setSchematicManualNodePosition(nodeId, { x: 333, y: 222 });
    expect(useAppStore.getState().project.view.schematicLayout?.manualNodePositions[nodeId]).toEqual({ x: 333, y: 222 });

    store.resetSchematicNodeOverride(nodeId);
    expect(useAppStore.getState().project.view.schematicLayout?.manualNodePositions[nodeId]).toBeUndefined();
  });

  it('switches between schematic and simulation without dropping selection', () => {
    resetStore();
    const store = useAppStore.getState();
    const nodeId = store.project.nodes[0]!.id;

    store.selectNode(nodeId);
    store.setPresentationMode('simulation');
    store.setPresentationMode('schematic');

    const next = useAppStore.getState();
    expect(next.selectedNodeId).toBe(nodeId);
    expect(next.project.view.presentationMode).toBe('schematic');
  });

  it('keeps orientation and symbol variant through sanitize restore', () => {
    const project = cloneProject(demoProject) as any;
    project.nodes[0].data.orientation = 'vertical';
    project.nodes[0].data.symbolVariant = 'heater';
    const restored = restoreProjectDocument(project);
    expect(restored.nodes[0].data.orientation).toBe('vertical');
    expect(restored.nodes[0].data.symbolVariant).toBe('heater');
  });
});

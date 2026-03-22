import { create, StateCreator } from 'zustand';
import { addEdge, applyEdgeChanges, applyNodeChanges, Connection, EdgeChange, NodeChange, Viewport } from 'reactflow';
import { componentMap } from '../domain/registry/componentRegistry';
import { demoProject, templates } from '../domain/templates/templates';
import { EdgeLabelMode, InspectorTab, ProjectDocument, SimulationSettings, SoapNode, SoapNodeKind, TemplateId, ValidationIssue } from '../domain/schemas/types';
import { clearPersistedState, loadStoredProject, saveStoredProject } from '../features/persistence/db';
import { runSimulationStep } from '../domain/simulation/engine';
import { restoreProjectDocument, validateProject } from '../domain/validation/validateProject';
import { instrumentCallsite } from '../utils/instrumentation';

interface StartupNotice {
  type: 'warning' | 'info';
  message: string;
}

type StartupState = 'booting' | 'ready';

interface AppState {
  project: ProjectDocument;
  projectRevision: number;
  persistedRevision: number;
  viewportNonce: number;
  selectedNodeId?: string;
  selectedEdgeId?: string;
  search: string;
  inspectorTab: InspectorTab;
  validationFocus: boolean;
  showProblematicOnly: boolean;
  hoveredEdgeId?: string;
  edgeLabelMode: EdgeLabelMode;
  issues: ValidationIssue[];
  pathSelection: { upstream: string[]; downstream: string[]; edges: string[] };
  startupState: StartupState;
  startupNotice?: StartupNotice;
  startupError?: string;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  setViewport: (viewport: Viewport, options?: { manual?: boolean }) => void;
  addNode: (type: SoapNodeKind, position?: { x: number; y: number }) => void;
  selectNode: (nodeId?: string) => void;
  selectEdge: (edgeId?: string) => void;
  updateNodeField: (nodeId: string, path: string, value: string | number | boolean) => void;
  setSearch: (search: string) => void;
  setInspectorTab: (tab: InspectorTab) => void;
  setSimulationRunning: (running: boolean) => void;
  setSimulationSpeed: (speed: number) => void;
  tickSimulation: (dt: number) => void;
  resetProject: () => Promise<void>;
  newProject: () => void;
  loadTemplate: (templateId: TemplateId) => Promise<void>;
  saveProject: (reason?: 'autosave' | 'manual') => Promise<void>;
  loadProject: (id?: string) => Promise<void>;
  exportProject: () => string;
  importProject: (json: string) => void;
  runValidation: () => void;
  toggleProblematicOnly: () => void;
  hoverEdge: (edgeId?: string) => void;
  setEdgeLabelMode: (mode: EdgeLabelMode) => void;
  clearLocalDataAndLoadDemo: () => Promise<void>;
  loadSafeDemo: () => Promise<void>;
  dismissStartupNotice: () => void;
  setStartupError: (message?: string) => void;
}

const clone = (project: ProjectDocument) => structuredClone(project);
const makeProject = () => clone(demoProject);
const limitedLog = (project: ProjectDocument) => ({ ...project, eventLog: project.eventLog.slice(-80) });
const VALIDATION_DEBOUNCE_MS = 120;
const VIEWPORT_EPSILON = 0.5;
const ZOOM_EPSILON = 0.001;

const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';
const perfLog = (scope: string, message: string, payload?: unknown) => {
  if (!isDev) return;
  if (payload === undefined) console.debug(`[perf:${scope}] ${message}`);
  else console.debug(`[perf:${scope}] ${message}`, payload);
};

const sameViewport = (a: Viewport, b: Viewport) => (
  Math.abs(a.x - b.x) < VIEWPORT_EPSILON
  && Math.abs(a.y - b.y) < VIEWPORT_EPSILON
  && Math.abs(a.zoom - b.zoom) < ZOOM_EPSILON
);

const sanitizeProjectState = (project: ProjectDocument, revision = 0, persistedRevision = revision, viewportNonce = 0) => ({
  project,
  projectRevision: revision,
  persistedRevision,
  viewportNonce,
  issues: validateProject(project),
  selectedNodeId: undefined,
  selectedEdgeId: undefined,
  pathSelection: { upstream: [], downstream: [], edges: [] },
});

const setByPath = (node: SoapNode, path: string, value: string | number | boolean) => {
  if (path === 'label' || path === 'description' || path === 'shortName') (node.data as any)[path] = String(value);
  else if (path === 'tag') node.data.tag = String(value);
  else if (path === 'medium') node.data.medium = value as any;
  else if (path === 'inputs' || path === 'outputs') (node.data.ports as any)[path] = Number(value);
  else if (path === 'accent' || path === 'fill' || path === 'enabled' || path === 'showLabel') (node.data.visual as any)[path] = value;
  else if (path === 'simEnabled') node.data.simulation.enabled = Boolean(value);
  else if (path === 'simActive') node.data.simulation.active = Boolean(value);
  else if (path === 'simFlow') node.data.simulation.flow = Number(value);
  else if (path === 'alarmText') node.data.simulation.alarmText = String(value);
  else if (path === 'routeState') node.data.simulation.routeState = value as any;
  else node.data.process[path] = value;
};

const computePathSelection = (project: ProjectDocument, nodeId?: string, edgeId?: string) => {
  instrumentCallsite('route recomputation', {
    callsite: 'useAppStore.computePathSelection',
    when: 'Runs whenever node or edge selection changes.',
    why: 'It recomputes upstream/downstream highlighting for the selected graph element.',
    repeatable: true,
    guidance: 'memoize',
    details: { nodeId, edgeId, edgeCount: project.edges.length },
  });
  const upstream = new Set<string>();
  const downstream = new Set<string>();
  const edges = new Set<string>();
  const sourceNodeId = edgeId ? project.edges.find((edge) => edge.id === edgeId)?.source : nodeId;
  const targetNodeId = edgeId ? project.edges.find((edge) => edge.id === edgeId)?.target : nodeId;
  const upstreamEdges = new Map<string, string[]>();
  const downstreamEdges = new Map<string, string[]>();

  project.edges.forEach((edge) => {
    const targetList = upstreamEdges.get(edge.target) ?? [];
    targetList.push(edge.id);
    upstreamEdges.set(edge.target, targetList);
    const sourceList = downstreamEdges.get(edge.source) ?? [];
    sourceList.push(edge.id);
    downstreamEdges.set(edge.source, sourceList);
  });

  const edgeById = new Map(project.edges.map((edge) => [edge.id, edge]));

  const visit = (seed: string | undefined, mode: 'up' | 'down') => {
    if (!seed) return;
    const queue = [seed];
    const seen = new Set<string>(queue);
    while (queue.length) {
      const current = queue.shift()!;
      const nextEdgeIds = mode === 'up' ? upstreamEdges.get(current) ?? [] : downstreamEdges.get(current) ?? [];
      nextEdgeIds.forEach((edgeId) => {
        const edge = edgeById.get(edgeId);
        if (!edge) return;
        const next = mode === 'up' ? edge.source : edge.target;
        edges.add(edge.id);
        (mode === 'up' ? upstream : downstream).add(next);
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      });
    }
  };

  visit(sourceNodeId, 'up');
  visit(targetNodeId, 'down');
  return { upstream: [...upstream], downstream: [...downstream], edges: [...edges] };
};

let validationTimer: number | undefined;
const scheduleValidation = (project: ProjectDocument) => {
  instrumentCallsite('graph validation', {
    callsite: 'useAppStore.scheduleValidation',
    when: 'Runs after graph mutations that replace the project document.',
    why: 'It debounces validation so edits do not pay immediate whole-graph validation cost.',
    repeatable: true,
    guidance: 'throttle',
    details: { nodeCount: project.nodes.length, edgeCount: project.edges.length },
  });
  if (typeof window === 'undefined') return;
  if (validationTimer) window.clearTimeout(validationTimer);
  validationTimer = window.setTimeout(() => {
    const startedAt = performance.now();
    const issues = validateProject(project);
    perfLog('validation', `validated ${project.nodes.length} nodes / ${project.edges.length} edges in ${(performance.now() - startedAt).toFixed(1)}ms`, { issues: issues.length });
    useAppStore.setState((state) => {
      if (state.project !== project) return state;
      return { issues };
    });
  }, VALIDATION_DEBOUNCE_MS);
};

type AppSet = Parameters<StateCreator<AppState>>[0];

const updateProjectState = (
  setState: AppSet,
  updater: (state: AppState) => Partial<AppState> | AppState,
  options?: { skipValidation?: boolean },
) => setState((state) => {
  const nextState = updater(state);
  const nextProject = nextState.project ?? state.project;
  if (!options?.skipValidation && nextProject !== state.project) scheduleValidation(nextProject);
  return nextState;
});

export const useAppStore = create<AppState>((set, get) => ({
  project: makeProject(),
  projectRevision: 0,
  persistedRevision: 0,
  viewportNonce: 0,
  selectedNodeId: undefined,
  selectedEdgeId: undefined,
  search: '',
  inspectorTab: 'main',
  validationFocus: false,
  showProblematicOnly: false,
  hoveredEdgeId: undefined,
  edgeLabelMode: 'selected',
  issues: validateProject(makeProject()),
  pathSelection: { upstream: [], downstream: [], edges: [] },
  startupState: 'booting',
  startupNotice: undefined,
  startupError: undefined,
  onNodesChange: (changes) => updateProjectState(set, (state) => {
    const project = { ...state.project, nodes: applyNodeChanges(changes, state.project.nodes) };
    return { project, projectRevision: state.projectRevision + 1 };
  }),
  onEdgesChange: (changes) => updateProjectState(set, (state) => {
    const project = { ...state.project, edges: applyEdgeChanges(changes, state.project.edges) };
    return { project, projectRevision: state.projectRevision + 1 };
  }),
  onConnect: (connection) => updateProjectState(set, (state) => {
    const source = state.project.nodes.find((node) => node.id === connection.source);
    const target = state.project.nodes.find((node) => node.id === connection.target);
    const project = {
      ...state.project,
      edges: addEdge({
        ...connection,
        type: 'flowEdge',
        animated: false,
        data: { flowActive: false, blocked: false, flowRate: 0, pressure: 0, routeState: 'idle', medium: target?.data.medium ?? source?.data.medium ?? 'water' },
      }, state.project.edges),
    };
    return { project, projectRevision: state.projectRevision + 1 };
  }),
  setViewport: (viewport, options) => updateProjectState(set, (state) => {
    instrumentCallsite('setViewport', {
      callsite: 'useAppStore.setViewport',
      when: options?.manual ? 'Runs after a user pan/zoom gesture ends.' : 'Runs after a programmatic curated viewport sync.',
      why: options?.manual ? 'It persists the viewport chosen by the user.' : 'It mirrors the latest curated viewport into project state.',
      repeatable: true,
      guidance: options?.manual ? 'none' : 'throttle',
      details: { viewport, manual: options?.manual ?? true },
    });
    if (sameViewport(state.project.view.viewport, viewport) && state.project.view.hasManualViewport === (options?.manual ?? true)) return state;
    perfLog('viewport', `store write (${options?.manual ? 'manual' : 'programmatic'})`, viewport);
    return {
      project: { ...state.project, view: { ...state.project.view, viewport, hasManualViewport: options?.manual ?? true } },
      projectRevision: options?.manual ? state.projectRevision + 1 : state.projectRevision,
    };
  }, { skipValidation: true }),
  addNode: (type, position = { x: 200, y: 200 }) => {
    const def = componentMap.get(type);
    if (!def) return;
    const id = crypto.randomUUID();
    const node: SoapNode = { id, type: 'processNode', position, data: { ...structuredClone(def.defaults), label: def.label, shortName: def.shortName, category: def.category, description: def.description } };
    updateProjectState(set, (state) => {
      const project = { ...state.project, nodes: [...state.project.nodes, node] };
      return { project, selectedNodeId: id, projectRevision: state.projectRevision + 1 };
    });
  },
  selectNode: (selectedNodeId) => set((state) => ({ selectedNodeId, selectedEdgeId: undefined, hoveredEdgeId: undefined, pathSelection: computePathSelection(state.project, selectedNodeId, undefined) })),
  selectEdge: (selectedEdgeId) => set((state) => ({ selectedEdgeId, selectedNodeId: undefined, hoveredEdgeId: selectedEdgeId ?? state.hoveredEdgeId, pathSelection: computePathSelection(state.project, undefined, selectedEdgeId) })),
  updateNodeField: (nodeId, path, value) => updateProjectState(set, (state) => {
    const project = { ...state.project, nodes: state.project.nodes.map((node) => {
      if (node.id !== nodeId) return node;
      const copy = structuredClone(node);
      setByPath(copy, path, value);
      return copy;
    }) };
    return { project, projectRevision: state.projectRevision + 1 };
  }),
  setSearch: (search) => set({ search }),
  setInspectorTab: (inspectorTab) => set({ inspectorTab }),
  setSimulationRunning: (running) => updateProjectState(set, (state) => ({ project: { ...state.project, simulation: { ...state.project.simulation, running } }, projectRevision: state.projectRevision + 1 }), { skipValidation: true }),
  setSimulationSpeed: (speed) => updateProjectState(set, (state) => ({ project: { ...state.project, simulation: { ...state.project.simulation, speed } }, projectRevision: state.projectRevision + 1 }), { skipValidation: true }),
  tickSimulation: (dt) => updateProjectState(set, (state) => {
    if (!state.project.simulation.running) return state;
    const startedAt = performance.now();
    const result = runSimulationStep(state.project, dt);
    const simulation: SimulationSettings = { ...state.project.simulation, tick: state.project.simulation.tick + 1, warnings: result.warnings, activeMedium: result.activeMedium, totalActiveFlow: result.totalActiveFlow, lastEvent: result.lastEvent };
    const project = limitedLog({ ...state.project, nodes: result.nodes, edges: result.edges, simulation, eventLog: [...state.project.eventLog, ...result.events] });
    perfLog('simulation', `tick completed in ${(performance.now() - startedAt).toFixed(1)}ms`, { tick: simulation.tick });
    return { project, projectRevision: state.projectRevision + 1 };
  }, { skipValidation: true }),
  resetProject: async () => {
    const project = makeProject();
    const revision = get().projectRevision + 1;
    set(sanitizeProjectState(project, revision, revision, get().viewportNonce + 1));
    await saveStoredProject(project);
    set({ persistedRevision: revision });
  },
  newProject: () => {
    const revision = get().projectRevision + 1;
    set(sanitizeProjectState(clone(templates['water-prep']), revision, get().persistedRevision, get().viewportNonce + 1));
  },
  loadTemplate: async (templateId) => {
    const project = clone(templates[templateId]);
    const revision = get().projectRevision + 1;
    perfLog('startup', `template load ${templateId}`);
    set((state) => ({ ...sanitizeProjectState(project, revision, revision, state.viewportNonce + 1), startupNotice: state.startupNotice, startupError: undefined }));
    await saveStoredProject(project);
    set({ persistedRevision: revision });
  },
  saveProject: async (reason = 'manual') => {
    const state = get();
    instrumentCallsite('autosave', {
      callsite: `useAppStore.saveProject(${reason})`,
      when: reason === 'autosave' ? 'Runs from the debounced app-level autosave effect when unsaved revisions exist.' : 'Runs when the user presses the manual save button.',
      why: 'It persists the current project into IndexedDB.',
      repeatable: true,
      guidance: reason === 'autosave' ? 'throttle' : 'user-triggered',
      details: { revision: state.projectRevision },
    });
    const startedAt = performance.now();
    await saveStoredProject(state.project);
    perfLog('autosave', `saved revision ${state.projectRevision} in ${(performance.now() - startedAt).toFixed(1)}ms`);
    set({ persistedRevision: state.projectRevision });
  },
  loadProject: async (id) => {
    set({ startupState: 'booting', startupError: undefined });
    instrumentCallsite('project restore', {
      callsite: 'useAppStore.loadProject',
      when: id ? `Runs when a restore is requested for project id ${id}.` : 'Runs on app startup and when the user presses the open button.',
      why: 'It loads the last persisted project or a safe fallback from IndexedDB.',
      repeatable: true,
      guidance: 'none',
      details: { id },
    });
    perfLog('startup', `restore requested${id ? ` (${id})` : ''}`);
    try {
      const result = await loadStoredProject(id);
      const revision = get().projectRevision + 1;
      if (result.project) {
        set((state) => ({
          ...sanitizeProjectState(result.project!, revision, revision, state.viewportNonce + 1),
          startupState: 'ready',
          startupNotice: result.recovered ? { type: 'warning', message: 'Обнаружены повреждённые локальные данные. Загружен безопасный проект.' } : state.startupNotice,
          startupError: undefined,
        }));
        if (result.recovered) await saveStoredProject(result.project);
        return;
      }

      const safeProject = makeProject();
      set((state) => ({
        ...sanitizeProjectState(safeProject, revision, revision, state.viewportNonce + 1),
        startupState: 'ready',
        startupNotice: result.recovered ? { type: 'warning', message: 'Обнаружены повреждённые локальные данные. Загружен безопасный проект.' } : state.startupNotice,
        startupError: undefined,
      }));
      await saveStoredProject(safeProject);
      set({ persistedRevision: revision });
    } catch (error) {
      console.error('Startup restore failed', error);
      await clearPersistedState();
      const safeProject = makeProject();
      const revision = get().projectRevision + 1;
      set({
        ...sanitizeProjectState(safeProject, revision, revision, get().viewportNonce + 1),
        startupState: 'ready',
        startupNotice: { type: 'warning', message: 'Обнаружены повреждённые локальные данные. Загружен безопасный проект.' },
        startupError: error instanceof Error ? error.message : 'Не удалось восстановить проект.',
      });
      await saveStoredProject(safeProject);
      set({ persistedRevision: revision });
    }
  },
  exportProject: () => JSON.stringify(get().project, null, 2),
  importProject: (json) => {
    instrumentCallsite('project restore', {
      callsite: 'useAppStore.importProject',
      when: 'Runs when the user imports a JSON project file.',
      why: 'It restores an external project payload into the normalized in-memory document.',
      repeatable: true,
      guidance: 'user-triggered',
    });
    const parsed = JSON.parse(json) as unknown;
    const restored = restoreProjectDocument(parsed);
    const revision = get().projectRevision + 1;
    set({ ...sanitizeProjectState(restored, revision, get().persistedRevision, get().viewportNonce + 1), startupError: undefined });
  },
  runValidation: () => {
    const state = get();
    instrumentCallsite('graph validation', {
      callsite: 'useAppStore.runValidation',
      when: 'Runs when the user presses the validation button.',
      why: 'It forces an immediate validation pass and focuses the issue panel.',
      repeatable: true,
      guidance: 'user-triggered',
      details: { nodeCount: state.project.nodes.length, edgeCount: state.project.edges.length },
    });
    const startedAt = performance.now();
    const issues = validateProject(state.project);
    perfLog('validation', `manual validation in ${(performance.now() - startedAt).toFixed(1)}ms`, { issues: issues.length });
    set({ issues, validationFocus: true });
  },
  toggleProblematicOnly: () => set((state) => ({ showProblematicOnly: !state.showProblematicOnly })),
  hoverEdge: (hoveredEdgeId) => set((state) => (state.hoveredEdgeId === hoveredEdgeId ? state : { hoveredEdgeId })),
  setEdgeLabelMode: (edgeLabelMode) => set({ edgeLabelMode }),
  clearLocalDataAndLoadDemo: async () => {
    await clearPersistedState();
    const project = makeProject();
    const revision = get().projectRevision + 1;
    set({
      ...sanitizeProjectState(project, revision, revision, get().viewportNonce + 1),
      startupNotice: { type: 'info', message: 'Локальные данные очищены. Загружен безопасный проект.' },
      startupError: undefined,
      startupState: 'ready',
    });
    await saveStoredProject(project);
    set({ persistedRevision: revision });
  },
  loadSafeDemo: async () => {
    const project = makeProject();
    const revision = get().projectRevision + 1;
    set((state) => ({
      ...sanitizeProjectState(project, revision, revision, state.viewportNonce + 1),
      startupNotice: state.startupNotice,
      startupError: undefined,
      startupState: 'ready',
    }));
    await saveStoredProject(project);
    set({ persistedRevision: revision });
  },
  dismissStartupNotice: () => set({ startupNotice: undefined }),
  setStartupError: (startupError) => set({ startupError }),
}));

import { create } from 'zustand';
import { addEdge, applyEdgeChanges, applyNodeChanges, Connection, EdgeChange, NodeChange, Viewport } from 'reactflow';
import { componentMap } from '../domain/registry/componentRegistry';
import { demoProject, templates } from '../domain/templates/templates';
import { InspectorTab, ProjectDocument, SimulationSettings, SoapNode, SoapNodeKind, TemplateId, ValidationIssue } from '../domain/schemas/types';
import { clearPersistedState, loadStoredProject, saveStoredProject } from '../features/persistence/db';
import { runSimulationStep } from '../domain/simulation/engine';
import { restoreProjectDocument, validateProject } from '../domain/validation/validateProject';

interface StartupNotice {
  type: 'warning' | 'info';
  message: string;
}

type StartupState = 'booting' | 'ready';

interface AppState {
  project: ProjectDocument;
  selectedNodeId?: string;
  selectedEdgeId?: string;
  search: string;
  inspectorTab: InspectorTab;
  validationFocus: boolean;
  showProblematicOnly: boolean;
  issues: ValidationIssue[];
  pathSelection: { upstream: string[]; downstream: string[]; edges: string[] };
  startupState: StartupState;
  startupNotice?: StartupNotice;
  startupError?: string;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  setViewport: (viewport: Viewport) => void;
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
  saveProject: () => Promise<void>;
  loadProject: (id?: string) => Promise<void>;
  exportProject: () => string;
  importProject: (json: string) => void;
  runValidation: () => void;
  toggleProblematicOnly: () => void;
  clearLocalDataAndLoadDemo: () => Promise<void>;
  loadSafeDemo: () => Promise<void>;
  dismissStartupNotice: () => void;
  setStartupError: (message?: string) => void;
}

const clone = (project: ProjectDocument) => structuredClone(project);
const makeProject = () => clone(demoProject);
const limitedLog = (project: ProjectDocument) => ({ ...project, eventLog: project.eventLog.slice(-80) });

const sanitizeProjectState = (project: ProjectDocument) => ({
  project,
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
  const upstream = new Set<string>();
  const downstream = new Set<string>();
  const edges = new Set<string>();
  const sourceNodeId = edgeId ? project.edges.find((edge) => edge.id === edgeId)?.source : nodeId;
  const targetNodeId = edgeId ? project.edges.find((edge) => edge.id === edgeId)?.target : nodeId;

  const visit = (seed: string | undefined, mode: 'up' | 'down') => {
    if (!seed) return;
    const queue = [seed];
    const seen = new Set<string>(queue);
    while (queue.length) {
      const current = queue.shift()!;
      project.edges.forEach((edge) => {
        const match = mode === 'up' ? edge.target === current : edge.source === current;
        const next = mode === 'up' ? edge.source : edge.target;
        if (!match) return;
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

export const useAppStore = create<AppState>((set, get) => ({
  project: makeProject(),
  selectedNodeId: undefined,
  selectedEdgeId: undefined,
  search: '',
  inspectorTab: 'main',
  validationFocus: false,
  showProblematicOnly: false,
  issues: validateProject(makeProject()),
  pathSelection: { upstream: [], downstream: [], edges: [] },
  startupState: 'booting',
  startupNotice: undefined,
  startupError: undefined,
  onNodesChange: (changes) => set((state) => {
    const project = { ...state.project, nodes: applyNodeChanges(changes, state.project.nodes) };
    return { project, issues: validateProject(project) };
  }),
  onEdgesChange: (changes) => set((state) => {
    const project = { ...state.project, edges: applyEdgeChanges(changes, state.project.edges) };
    return { project, issues: validateProject(project) };
  }),
  onConnect: (connection) => set((state) => {
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
    return { project, issues: validateProject(project) };
  }),
  setViewport: (viewport) => set((state) => ({ project: { ...state.project, viewport } })),
  addNode: (type, position = { x: 200, y: 200 }) => {
    const def = componentMap.get(type);
    if (!def) return;
    const id = crypto.randomUUID();
    const node: SoapNode = { id, type: 'processNode', position, data: { ...structuredClone(def.defaults), label: def.label, shortName: def.shortName, category: def.category, description: def.description } };
    set((state) => {
      const project = { ...state.project, nodes: [...state.project.nodes, node] };
      return { project, selectedNodeId: id, issues: validateProject(project) };
    });
  },
  selectNode: (selectedNodeId) => set((state) => ({ selectedNodeId, selectedEdgeId: undefined, pathSelection: computePathSelection(state.project, selectedNodeId, undefined) })),
  selectEdge: (selectedEdgeId) => set((state) => ({ selectedEdgeId, selectedNodeId: undefined, pathSelection: computePathSelection(state.project, undefined, selectedEdgeId) })),
  updateNodeField: (nodeId, path, value) => set((state) => {
    const project = { ...state.project, nodes: state.project.nodes.map((node) => {
      if (node.id !== nodeId) return node;
      const copy = structuredClone(node);
      setByPath(copy, path, value);
      return copy;
    }) };
    return { project, issues: validateProject(project) };
  }),
  setSearch: (search) => set({ search }),
  setInspectorTab: (inspectorTab) => set({ inspectorTab }),
  setSimulationRunning: (running) => set((state) => ({ project: { ...state.project, simulation: { ...state.project.simulation, running } } })),
  setSimulationSpeed: (speed) => set((state) => ({ project: { ...state.project, simulation: { ...state.project.simulation, speed } } })),
  tickSimulation: (dt) => set((state) => {
    if (!state.project.simulation.running) return state;
    const result = runSimulationStep(state.project, dt);
    const simulation: SimulationSettings = { ...state.project.simulation, tick: state.project.simulation.tick + 1, warnings: result.warnings, activeMedium: result.activeMedium, totalActiveFlow: result.totalActiveFlow, lastEvent: result.lastEvent };
    const project = limitedLog({ ...state.project, nodes: result.nodes, edges: result.edges, simulation, eventLog: [...state.project.eventLog, ...result.events] });
    return { project, issues: validateProject(project) };
  }),
  resetProject: async () => {
    const project = makeProject();
    set(sanitizeProjectState(project));
    await saveStoredProject(project);
  },
  newProject: () => set(() => sanitizeProjectState(clone(templates['water-prep']))),
  loadTemplate: async (templateId) => {
    const project = clone(templates[templateId]);
    set((state) => ({ ...sanitizeProjectState(project), startupNotice: state.startupNotice, startupError: undefined }));
    await saveStoredProject(project);
  },
  saveProject: async () => {
    const project = get().project;
    await saveStoredProject(project);
  },
  loadProject: async (id) => {
    set({ startupState: 'booting', startupError: undefined });
    try {
      const result = await loadStoredProject(id);
      if (result.project) {
        set((state) => ({
          ...sanitizeProjectState(result.project!),
          startupState: 'ready',
          startupNotice: result.recovered ? { type: 'warning', message: 'Обнаружены повреждённые локальные данные. Загружен безопасный проект.' } : state.startupNotice,
          startupError: undefined,
        }));
        if (result.recovered) await saveStoredProject(result.project);
        return;
      }

      const safeProject = makeProject();
      set((state) => ({
        ...sanitizeProjectState(safeProject),
        startupState: 'ready',
        startupNotice: result.recovered ? { type: 'warning', message: 'Обнаружены повреждённые локальные данные. Загружен безопасный проект.' } : state.startupNotice,
        startupError: undefined,
      }));
      await saveStoredProject(safeProject);
    } catch (error) {
      console.error('Startup restore failed', error);
      await clearPersistedState();
      const safeProject = makeProject();
      set({
        ...sanitizeProjectState(safeProject),
        startupState: 'ready',
        startupNotice: { type: 'warning', message: 'Обнаружены повреждённые локальные данные. Загружен безопасный проект.' },
        startupError: error instanceof Error ? error.message : 'Не удалось восстановить проект.',
      });
      await saveStoredProject(safeProject);
    }
  },
  exportProject: () => JSON.stringify(get().project, null, 2),
  importProject: (json) => {
    const parsed = JSON.parse(json) as unknown;
    const restored = restoreProjectDocument(parsed);
    set({ ...sanitizeProjectState(restored), startupError: undefined });
  },
  runValidation: () => set((state) => ({ issues: validateProject(state.project), validationFocus: true })),
  toggleProblematicOnly: () => set((state) => ({ showProblematicOnly: !state.showProblematicOnly })),
  clearLocalDataAndLoadDemo: async () => {
    await clearPersistedState();
    const project = makeProject();
    set({
      ...sanitizeProjectState(project),
      startupNotice: { type: 'info', message: 'Локальные данные очищены. Загружен безопасный проект.' },
      startupError: undefined,
      startupState: 'ready',
    });
    await saveStoredProject(project);
  },
  loadSafeDemo: async () => {
    const project = makeProject();
    set((state) => ({
      ...sanitizeProjectState(project),
      startupNotice: state.startupNotice,
      startupError: undefined,
      startupState: 'ready',
    }));
    await saveStoredProject(project);
  },
  dismissStartupNotice: () => set({ startupNotice: undefined }),
  setStartupError: (startupError) => set({ startupError }),
}));

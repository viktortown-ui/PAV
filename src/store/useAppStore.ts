import { create } from 'zustand';
import { addEdge, applyEdgeChanges, applyNodeChanges, Connection, EdgeChange, NodeChange, Viewport } from 'reactflow';
import { componentMap } from '../domain/registry/componentRegistry';
import { demoProject } from '../domain/registry/demoProject';
import { ProjectDocument, SimulationSettings, SoapEdge, SoapNode, SoapNodeKind } from '../domain/schemas/types';
import { db } from '../features/persistence/db';
import { runSimulationStep } from '../domain/simulation/engine';

interface AppState {
  project: ProjectDocument;
  selectedNodeId?: string;
  search: string;
  inspectorTab: 'general' | 'process' | 'visual' | 'ports' | 'simulation';
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  setViewport: (viewport: Viewport) => void;
  addNode: (type: SoapNodeKind, position?: { x: number; y: number }) => void;
  selectNode: (nodeId?: string) => void;
  updateNodeField: (nodeId: string, path: string, value: string | number | boolean) => void;
  setSearch: (search: string) => void;
  setInspectorTab: (tab: AppState['inspectorTab']) => void;
  setSimulationRunning: (running: boolean) => void;
  setSimulationSpeed: (speed: number) => void;
  tickSimulation: (dt: number) => void;
  resetProject: () => void;
  newProject: () => void;
  saveProject: () => Promise<void>;
  loadProject: (id?: string) => Promise<void>;
  exportProject: () => string;
  importProject: (json: string) => void;
}

const makeProject = (): ProjectDocument => structuredClone(demoProject);

const setByPath = (node: SoapNode, path: string, value: string | number | boolean) => {
  if (path === 'label' || path === 'description') {
    node.data[path] = String(value);
    return;
  }
  if (path === 'tag') {
    node.data.tag = String(value);
    return;
  }
  if (path in node.data.process) {
    node.data.process[path] = value;
    return;
  }
  if (path === 'accent' || path === 'fill' || path === 'enabled' || path === 'mixing') {
    (node.data.visual as Record<string, string | number | boolean>)[path] = value;
    return;
  }
  if (path === 'simEnabled') node.data.simulation.enabled = Boolean(value);
  if (path === 'simActive') node.data.simulation.active = Boolean(value);
  if (path === 'simFlow') node.data.simulation.flow = Number(value);
};

export const useAppStore = create<AppState>((set, get) => ({
  project: makeProject(),
  selectedNodeId: undefined,
  search: '',
  inspectorTab: 'general',
  onNodesChange: (changes) => set((state) => ({ project: { ...state.project, nodes: applyNodeChanges(changes, state.project.nodes) } })),
  onEdgesChange: (changes) => set((state) => ({ project: { ...state.project, edges: applyEdgeChanges(changes, state.project.edges) } })),
  onConnect: (connection) => set((state) => ({ project: { ...state.project, edges: addEdge({ ...connection, type: 'flowEdge', animated: false, data: { flowActive: false, blocked: false, flowRate: 0 } }, state.project.edges) } })),
  setViewport: (viewport) => set((state) => ({ project: { ...state.project, viewport } })),
  addNode: (type, position = { x: 200, y: 200 }) => {
    const def = componentMap.get(type);
    if (!def) return;
    const id = crypto.randomUUID();
    const node: SoapNode = {
      id,
      type: 'processNode',
      position,
      data: {
        ...structuredClone(def.defaults),
        label: def.label,
        category: def.category,
        description: def.description,
      },
    };
    set((state) => ({ project: { ...state.project, nodes: [...state.project.nodes, node] }, selectedNodeId: id }));
  },
  selectNode: (selectedNodeId) => set({ selectedNodeId }),
  updateNodeField: (nodeId, path, value) => set((state) => ({
    project: {
      ...state.project,
      nodes: state.project.nodes.map((node) => {
        if (node.id !== nodeId) return node;
        const copy = structuredClone(node);
        setByPath(copy, path, value);
        return copy;
      }),
    },
  })),
  setSearch: (search) => set({ search }),
  setInspectorTab: (inspectorTab) => set({ inspectorTab }),
  setSimulationRunning: (running) => set((state) => ({ project: { ...state.project, simulation: { ...state.project.simulation, running } } })),
  setSimulationSpeed: (speed) => set((state) => ({ project: { ...state.project, simulation: { ...state.project.simulation, speed } } })),
  tickSimulation: (dt) => set((state) => {
    if (!state.project.simulation.running) return state;
    const result = runSimulationStep(state.project.nodes, state.project.edges, state.project.simulation, dt);
    const simulation: SimulationSettings = {
      ...state.project.simulation,
      tick: state.project.simulation.tick + 1,
      warnings: result.warnings,
    };
    return { project: { ...state.project, nodes: result.nodes, edges: result.edges, simulation } };
  }),
  resetProject: () => set((state) => ({ project: { ...makeProject(), simulation: { ...state.project.simulation, running: false, tick: 0, warnings: [] } } })),
  newProject: () => set({ project: makeProject(), selectedNodeId: undefined }),
  saveProject: async () => {
    const project = get().project;
    await db.projects.put({ ...project, lastOpenedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  },
  loadProject: async (id) => {
    const stored = id ? await db.projects.get(id) : await db.projects.orderBy('lastOpenedAt').last();
    if (stored) set({ project: stored, selectedNodeId: undefined });
  },
  exportProject: () => JSON.stringify(get().project, null, 2),
  importProject: (json) => {
    const parsed = JSON.parse(json) as ProjectDocument;
    set({ project: parsed, selectedNodeId: undefined });
  },
}));

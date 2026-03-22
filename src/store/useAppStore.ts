import { create } from 'zustand';
import { addEdge, applyEdgeChanges, applyNodeChanges, Connection, EdgeChange, MarkerType, NodeChange, Viewport } from 'reactflow';
import { componentMap } from '../domain/registry/componentRegistry';
import { APP_SCHEMA_VERSION, PROJECT_SCHEMA_VERSION, demoProject, templates } from '../domain/templates/templates';
import { EdgeLabelMode, InspectorTab, ProjectDocument, SimulationSettings, SoapEdge, SoapNode, SoapNodeKind, TemplateId, ValidationIssue } from '../domain/schemas/types';
import { clearPersistedState, clearUserData, loadStoredProject, resetCurrentProjectState, saveStoredProject } from '../features/persistence/db';
import { runSimulationStep } from '../domain/simulation/engine';
import { restoreProjectDocument, validateProject } from '../domain/validation/validateProject';

interface StartupNotice { type: 'warning' | 'info'; message: string; }
type StartupState = 'booting' | 'ready';

const clone = (project: ProjectDocument) => structuredClone(project);
const makeProject = () => clone(demoProject);
const limitedLog = (project: ProjectDocument) => ({ ...project, eventLog: project.eventLog.slice(-80) });

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
  if (path === 'visibleName' || path === 'description' || path === 'shortName' || path === 'notes' || path === 'technicalTag') (node.data as any)[path] = String(value);
  else if (path === 'medium') node.data.medium = value as any;
  else if (path === 'inputs' || path === 'outputs' || path === 'preferredDirection' || path === 'inline') (node.data.ports as any)[path] = path === 'inputs' || path === 'outputs' ? Number(value) : value;
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
  const upstreamEdges = new Map<string, string[]>();
  const downstreamEdges = new Map<string, string[]>();
  project.edges.forEach((edge) => {
    upstreamEdges.set(edge.target, [...(upstreamEdges.get(edge.target) ?? []), edge.id]);
    downstreamEdges.set(edge.source, [...(downstreamEdges.get(edge.source) ?? []), edge.id]);
  });
  const edgeById = new Map(project.edges.map((edge) => [edge.id, edge]));
  const visit = (seed: string | undefined, mode: 'up' | 'down') => {
    if (!seed) return;
    const queue = [seed];
    const seen = new Set(queue);
    while (queue.length) {
      const current = queue.shift()!;
      const nextEdgeIds = mode === 'up' ? upstreamEdges.get(current) ?? [] : downstreamEdges.get(current) ?? [];
      nextEdgeIds.forEach((edgeId) => {
        const edge = edgeById.get(edgeId);
        if (!edge) return;
        const next = mode === 'up' ? edge.source : edge.target;
        edges.add(edge.id);
        (mode === 'up' ? upstream : downstream).add(next);
        if (!seen.has(next)) { seen.add(next); queue.push(next); }
      });
    }
  };
  visit(sourceNodeId, 'up');
  visit(targetNodeId, 'down');
  return { upstream: [...upstream], downstream: [...downstream], edges: [...edges] };
};

const midPoint = (source: SoapNode, target: SoapNode) => ({ x: (source.position.x + target.position.x) / 2, y: (source.position.y + target.position.y) / 2 });
const logEvent = (project: ProjectDocument, message: string, targetId?: string): ProjectDocument => ({ ...project, eventLog: [...project.eventLog, { id: crypto.randomUUID(), timestamp: new Date().toISOString(), type: 'editor', message, severity: 'info' as const, targetId }] });

const buildNode = (kind: SoapNodeKind, position: { x: number; y: number }): SoapNode => {
  const def = componentMap.get(kind)!;
  const id = crypto.randomUUID();
  return {
    id,
    type: 'processNode',
    position,
    data: {
      ...structuredClone(def.defaults),
      visibleName: def.label,
      shortName: def.shortName,
      technicalTag: `${def.technicalPrefix}-${String(Math.floor(Math.random() * 900) + 100)}`,
      category: def.category,
      description: def.description,
      className: def.className,
    },
  };
};

const buildEdge = (source: string, target: string, medium: NonNullable<SoapEdge['data']>['medium'] = 'water', nominalDiameter = 'DN50'): SoapEdge => ({
  id: crypto.randomUUID(),
  source,
  target,
  type: 'flowEdge',
  markerEnd: { type: MarkerType.ArrowClosed },
  animated: false,
  data: { medium, flowActive: false, blocked: false, routeState: 'idle', flowRate: 0, pressure: 0, nominalDiameter, direction: 'forward', stateLabel: 'Ожидание', segmentId: crypto.randomUUID() },
});

interface AppState {
  project: ProjectDocument; projectRevision: number; persistedRevision: number; viewportNonce: number; selectedNodeId?: string; selectedEdgeId?: string; search: string; inspectorTab: InspectorTab; showProblematicOnly: boolean; hoveredEdgeId?: string; edgeLabelMode: EdgeLabelMode; issues: ValidationIssue[]; pathSelection: { upstream: string[]; downstream: string[]; edges: string[] }; startupState: StartupState; startupNotice?: StartupNotice; startupError?: string;
  onNodesChange: (changes: NodeChange[]) => void; onEdgesChange: (changes: EdgeChange[]) => void; onConnect: (connection: Connection) => void; setViewport: (viewport: Viewport, options?: { manual?: boolean }) => void; addNode: (type: SoapNodeKind, position?: { x: number; y: number }) => void; selectNode: (nodeId?: string) => void; selectEdge: (edgeId?: string) => void; updateNodeField: (nodeId: string, path: string, value: string | number | boolean) => void; setSearch: (search: string) => void; setInspectorTab: (tab: InspectorTab) => void; setSimulationRunning: (running: boolean) => void; setSimulationSpeed: (speed: number) => void; tickSimulation: (dt: number) => void;
  resetProject: () => Promise<void>; resetUserData: () => Promise<void>; clearLocalDataAndLoadDemo: () => Promise<void>; newProject: () => void; loadTemplate: (templateId: TemplateId) => Promise<void>; saveProject: (reason?: 'autosave' | 'manual') => Promise<void>; loadProject: (id?: string) => Promise<void>; exportProject: () => string; importProject: (json: string) => void; runValidation: () => void; toggleProblematicOnly: () => void; hoverEdge: (edgeId?: string) => void; setEdgeLabelMode: (mode: EdgeLabelMode) => void; loadSafeDemo: () => Promise<void>; dismissStartupNotice: () => void; setStartupError: (message?: string) => void;
  insertNodeIntoEdge: (kind: SoapNodeKind) => void; createBranchFromEdge: (kind?: SoapNodeKind) => void; removeSelectedSegment: () => void; reconnectSelectedEdge: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  project: makeProject(), projectRevision: 0, persistedRevision: 0, viewportNonce: 0, selectedNodeId: undefined, selectedEdgeId: undefined, search: '', inspectorTab: 'main', showProblematicOnly: false, hoveredEdgeId: undefined, edgeLabelMode: 'selected', issues: validateProject(makeProject()), pathSelection: { upstream: [], downstream: [], edges: [] }, startupState: 'booting', startupNotice: undefined, startupError: undefined,
  onNodesChange: (changes) => set((state) => { const project = { ...state.project, nodes: applyNodeChanges(changes, state.project.nodes) }; return { project, issues: validateProject(project), projectRevision: state.projectRevision + 1 }; }),
  onEdgesChange: (changes) => set((state) => { const project = { ...state.project, edges: applyEdgeChanges(changes, state.project.edges) }; return { project, issues: validateProject(project), projectRevision: state.projectRevision + 1 }; }),
  onConnect: (connection) => set((state) => { const source = state.project.nodes.find((node) => node.id === connection.source); const target = state.project.nodes.find((node) => node.id === connection.target); if (!source || !target) return state; const project = { ...state.project, edges: addEdge({ ...buildEdge(source.id, target.id, target.data.medium || source.data.medium), sourceHandle: connection.sourceHandle, targetHandle: connection.targetHandle }, state.project.edges) }; return { project: logEvent(project, `Создан новый сегмент между «${source.data.visibleName}» и «${target.data.visibleName}».`), issues: validateProject(project), projectRevision: state.projectRevision + 1 }; }),
  setViewport: (viewport, options) => set((state) => ({ project: { ...state.project, view: { ...state.project.view, viewport, hasManualViewport: options?.manual ?? true } }, projectRevision: options?.manual ? state.projectRevision + 1 : state.projectRevision })),
  addNode: (type, position = { x: 200, y: 200 }) => set((state) => { const node = buildNode(type, position); const project = { ...state.project, nodes: [...state.project.nodes, node] }; return { project: logEvent(project, `Добавлен элемент «${node.data.visibleName}».`, node.id), selectedNodeId: node.id, issues: validateProject(project), projectRevision: state.projectRevision + 1 }; }),
  selectNode: (selectedNodeId) => set((state) => ({ selectedNodeId, selectedEdgeId: undefined, hoveredEdgeId: undefined, pathSelection: computePathSelection(state.project, selectedNodeId, undefined) })),
  selectEdge: (selectedEdgeId) => set((state) => ({ selectedEdgeId, selectedNodeId: undefined, hoveredEdgeId: selectedEdgeId ?? state.hoveredEdgeId, pathSelection: computePathSelection(state.project, undefined, selectedEdgeId) })),
  updateNodeField: (nodeId, path, value) => set((state) => { const project = { ...state.project, nodes: state.project.nodes.map((node) => node.id !== nodeId ? node : (() => { const copy = structuredClone(node); setByPath(copy, path, value); return copy; })()) }; return { project, issues: validateProject(project), projectRevision: state.projectRevision + 1 }; }),
  setSearch: (search) => set({ search }), setInspectorTab: (inspectorTab) => set({ inspectorTab }),
  setSimulationRunning: (running) => set((state) => ({ project: { ...state.project, simulation: { ...state.project.simulation, running } }, projectRevision: state.projectRevision + 1 })),
  setSimulationSpeed: (speed) => set((state) => ({ project: { ...state.project, simulation: { ...state.project.simulation, speed } }, projectRevision: state.projectRevision + 1 })),
  tickSimulation: (dt) => set((state) => { if (!state.project.simulation.running) return state; const result = runSimulationStep(state.project, dt); const simulation: SimulationSettings = { ...state.project.simulation, tick: state.project.simulation.tick + 1, warnings: result.warnings, activeMedium: result.activeMedium, totalActiveFlow: result.totalActiveFlow, lastEvent: result.lastEvent }; const project = limitedLog({ ...state.project, nodes: result.nodes, edges: result.edges, simulation, eventLog: [...state.project.eventLog, ...result.events] }); return { project, issues: validateProject(project), projectRevision: state.projectRevision + 1 }; }),
  resetProject: async () => { const state = get(); const project = { ...clone(demoProject), id: state.project.id, name: `${state.project.name} — чистый проект`, appSchemaVersion: APP_SCHEMA_VERSION, projectSchemaVersion: PROJECT_SCHEMA_VERSION }; const revision = state.projectRevision + 1; set(sanitizeProjectState(project, revision, state.persistedRevision, state.viewportNonce + 1)); await resetCurrentProjectState(); },
  resetUserData: async () => { await clearUserData(); const project = clone(demoProject); const revision = get().projectRevision + 1; set({ ...sanitizeProjectState(project, revision, revision, get().viewportNonce + 1), startupNotice: { type: 'info', message: 'Локальные проекты и восстановление вида удалены. Оболочка приложения сохранена.' } }); await saveStoredProject(project); },
  clearLocalDataAndLoadDemo: async () => { await clearPersistedState(); const project = clone(demoProject); const revision = get().projectRevision + 1; set({ ...sanitizeProjectState(project, revision, revision, get().viewportNonce + 1), startupState: 'ready', startupError: undefined, startupNotice: { type: 'warning', message: 'Обнаружены данные старой версии. Выполнен безопасный сброс.' } }); await saveStoredProject(project); },
  newProject: () => { const revision = get().projectRevision + 1; set(sanitizeProjectState(clone(templates['water-prep']), revision, get().persistedRevision, get().viewportNonce + 1)); },
  loadTemplate: async (templateId) => { const project = clone(templates[templateId]); const revision = get().projectRevision + 1; set({ ...sanitizeProjectState(project, revision, revision, get().viewportNonce + 1), startupNotice: { type: 'info', message: `Загружен шаблон «${project.name}».` }, startupError: undefined }); await saveStoredProject(project); set({ persistedRevision: revision }); },
  saveProject: async () => { const state = get(); await saveStoredProject({ ...state.project, updatedAt: new Date().toISOString(), appSchemaVersion: APP_SCHEMA_VERSION, projectSchemaVersion: PROJECT_SCHEMA_VERSION }); set({ persistedRevision: state.projectRevision }); },
  loadProject: async (id) => { const stored = await loadStoredProject(id); if (stored.project) { const revision = get().projectRevision + 1; set({ ...sanitizeProjectState(stored.project, revision, revision, get().viewportNonce + 1), startupState: 'ready', startupError: undefined, startupNotice: stored.recovered ? { type: 'warning', message: 'Данные частично восстановлены.' } : undefined }); return; } if (stored.recovered) { await get().clearLocalDataAndLoadDemo(); return; } const project = clone(demoProject); const revision = get().projectRevision + 1; set({ ...sanitizeProjectState(project, revision, revision, get().viewportNonce + 1), startupState: 'ready', startupError: undefined }); await saveStoredProject(project); },
  exportProject: () => JSON.stringify(get().project, null, 2),
  importProject: (json) => { const project = restoreProjectDocument(JSON.parse(json)); set((state) => ({ ...sanitizeProjectState(project, state.projectRevision + 1, state.persistedRevision, state.viewportNonce + 1), startupState: 'ready', startupNotice: { type: 'info', message: 'Проект импортирован.' } })); },
  runValidation: () => set((state) => ({ issues: validateProject(state.project) })), toggleProblematicOnly: () => set((state) => ({ showProblematicOnly: !state.showProblematicOnly })), hoverEdge: (hoveredEdgeId) => set({ hoveredEdgeId }), setEdgeLabelMode: (edgeLabelMode) => set({ edgeLabelMode }),
  loadSafeDemo: async () => { const project = clone(demoProject); const revision = get().projectRevision + 1; set({ ...sanitizeProjectState(project, revision, revision, get().viewportNonce + 1), startupState: 'ready', startupError: undefined }); await saveStoredProject(project); },
  dismissStartupNotice: () => set({ startupNotice: undefined }), setStartupError: (startupError) => set({ startupError }),
  insertNodeIntoEdge: (kind) => set((state) => {
    const edge = state.project.edges.find((item) => item.id === state.selectedEdgeId); if (!edge) return state;
    const source = state.project.nodes.find((item) => item.id === edge.source); const target = state.project.nodes.find((item) => item.id === edge.target); if (!source || !target) return state;
    const node = buildNode(kind, midPoint(source, target));
    const newEdges = [buildEdge(source.id, node.id, edge.data?.medium ?? source.data.medium, edge.data?.nominalDiameter ?? 'DN50'), buildEdge(node.id, target.id, edge.data?.medium ?? target.data.medium, edge.data?.nominalDiameter ?? 'DN50')];
    const project = logEvent({ ...state.project, nodes: [...state.project.nodes, node], edges: state.project.edges.filter((item) => item.id !== edge.id).concat(newEdges) }, `В линию вставлен элемент «${node.data.visibleName}».`, node.id);
    return { project, selectedNodeId: node.id, selectedEdgeId: undefined, issues: validateProject(project), projectRevision: state.projectRevision + 1 };
  }),
  createBranchFromEdge: (kind = 'tee') => set((state) => {
    const edge = state.project.edges.find((item) => item.id === state.selectedEdgeId); if (!edge) return state;
    const source = state.project.nodes.find((item) => item.id === edge.source); const target = state.project.nodes.find((item) => item.id === edge.target); if (!source || !target) return state;
    const center = midPoint(source, target); const branchNode = buildNode(kind, center); const branchSink = buildNode('consumer', { x: center.x + 240, y: center.y - 140 }); branchSink.data.visibleName = 'Новая ветвь'; branchSink.data.technicalTag = 'CU-NEW';
    const newEdges = [buildEdge(source.id, branchNode.id, edge.data?.medium ?? source.data.medium, edge.data?.nominalDiameter ?? 'DN50'), buildEdge(branchNode.id, target.id, edge.data?.medium ?? target.data.medium, edge.data?.nominalDiameter ?? 'DN50'), buildEdge(branchNode.id, branchSink.id, edge.data?.medium ?? target.data.medium, edge.data?.nominalDiameter ?? 'DN40')];
    const project = logEvent({ ...state.project, nodes: [...state.project.nodes, branchNode, branchSink], edges: state.project.edges.filter((item) => item.id !== edge.id).concat(newEdges) }, `Создано ответвление через узел «${branchNode.data.visibleName}».`, branchNode.id);
    return { project, selectedNodeId: branchNode.id, selectedEdgeId: undefined, issues: validateProject(project), projectRevision: state.projectRevision + 1 };
  }),
  removeSelectedSegment: () => set((state) => {
    if (!state.selectedEdgeId) return state; const project = logEvent({ ...state.project, edges: state.project.edges.filter((edge) => edge.id !== state.selectedEdgeId) }, 'Сегмент удалён.', state.selectedEdgeId); return { project, selectedEdgeId: undefined, issues: validateProject(project), projectRevision: state.projectRevision + 1 };
  }),
  reconnectSelectedEdge: () => set((state) => {
    const edge = state.project.edges.find((item) => item.id === state.selectedEdgeId); if (!edge) return state; const source = state.project.nodes.find((item) => item.id === edge.source); const target = state.project.nodes.find((item) => item.id === edge.target); if (!source || !target) return state; const rerouted: SoapEdge = { ...edge, type: 'flowEdge', data: { ...edge.data!, stateLabel: 'Переподключён', medium: edge.data?.medium || 'water', flowActive: edge.data?.flowActive || false, blocked: edge.data?.blocked || false, routeState: edge.data?.routeState || 'idle', flowRate: edge.data?.flowRate || 0, pressure: edge.data?.pressure || 0 } }; const project = logEvent({ ...state.project, edges: state.project.edges.map((item) => item.id === edge.id ? rerouted : item) }, `Сегмент «${source.data.shortName} → ${target.data.shortName}» отмечен для переподключения.`, edge.id); return { project, issues: validateProject(project), projectRevision: state.projectRevision + 1 };
  }),
}));

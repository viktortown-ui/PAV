import { create } from 'zustand';
import { addEdge, applyEdgeChanges, applyNodeChanges, Connection, EdgeChange, MarkerType, NodeChange, Viewport } from 'reactflow';
import { componentMap } from '../domain/registry/componentRegistry';
import { APP_SCHEMA_VERSION, PROJECT_SCHEMA_VERSION, demoProject, templates } from '../domain/templates/templates';
import { EdgeLabelMode, InspectorTab, ProjectDocument, SimulationSettings, SoapEdge, SoapNode, SoapNodeKind, TemplateId, ValidationIssue } from '../domain/schemas/types';
import { clearPersistedState, clearUserData, loadStoredProject, resetCurrentProjectState, saveStoredProject } from '../features/persistence/db';
import { runSimulationStep } from '../domain/simulation/engine';
import { restoreProjectDocument, validateProject } from '../domain/validation/validateProject';
import { DEFAULT_SOURCE_HANDLE, DEFAULT_TARGET_HANDLE, getPreferredFreeHandleId, normalizeHandleForNode, normalizeProjectEdgeHandles } from '../domain/flow/handles';

interface StartupNotice { type: 'warning' | 'info'; message: string; }
type StartupState = 'booting' | 'ready';
export type EdgeEditorMode = 'actions' | 'insert';
export type EdgeActionKind = 'insert:shutoffValve' | 'insert:gateValve' | 'insert:checkValve' | 'insert:flowMeter' | 'insert:pressureSensor' | 'insert:pump' | 'insert:inlineFilter' | 'insert:tee' | 'insert:cross' | 'insert:drainBranch' | 'insert:samplePoint' | 'branch:tee' | 'break' | 'reconnect' | 'delete';

const clone = (project: ProjectDocument) => structuredClone(project);
const makeProject = () => clone(demoProject);
const limitedLog = (project: ProjectDocument) => ({ ...project, eventLog: project.eventLog.slice(-80) });

const sanitizeProjectState = (project: ProjectDocument, revision = 0, persistedRevision = revision, viewportNonce = 0) => {
  const normalizedProject = normalizeProjectEdgeHandles(project);
  return {
    project: normalizedProject,
    projectRevision: revision,
    persistedRevision,
    viewportNonce,
    issues: validateProject(normalizedProject),
    selectedNodeId: undefined,
    selectedEdgeId: undefined,
    pathSelection: { upstream: [], downstream: [], edges: [] },
  };
};

const setByPath = (node: SoapNode, path: string, value: string | number | boolean) => {
  const data = node.data as any;
  if (['visibleName', 'description', 'shortName', 'notes', 'technicalTag', 'status', 'mode'].includes(path)) data[path] = value;
  else if (path === 'medium' || path === 'mediumType') { data.medium = value; data.mediumType = value; data.process.medium = value; data.process.mediumType = value; }
  else if (path === 'inputs' || path === 'outputs' || path === 'preferredDirection' || path === 'inline') data.ports[path] = path === 'inputs' || path === 'outputs' ? Number(value) : value;
  else if (path === 'accent' || path === 'fill' || path === 'enabled' || path === 'showLabel') { data.visual[path === 'enabled' ? 'enabled' : path] = value; if (path === 'enabled') data.isEnabled = Boolean(value); }
  else if (path === 'simEnabled') { data.simulation.enabled = Boolean(value); data.runtime.enabled = Boolean(value); data.simulationEnabled = Boolean(value); }
  else if (path === 'simActive') { data.simulation.active = Boolean(value); data.runtime.active = Boolean(value); }
  else if (path === 'simFlow') { data.simulation.flow = Number(value); data.runtime.flow = Number(value); data.runtime.flowLpm = Number(value); }
  else if (path === 'alarmText') { data.simulation.alarmText = String(value); data.runtime.alarmText = String(value); }
  else if (path === 'routeState') { data.simulation.routeState = value; data.runtime.routeState = value; }
  else data.process[path] = value;
  data.updatedAt = new Date().toISOString();
  data.revision = Number(data.revision ?? 0) + 1;
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
const leftHandleId = DEFAULT_TARGET_HANDLE;
const rightHandleId = DEFAULT_SOURCE_HANDLE;

const logEvent = (project: ProjectDocument, message: string, targetId?: string, severity: 'info' | 'warning' | 'error' = 'info', type = 'editor'): ProjectDocument => ({ ...project, eventLog: [...project.eventLog, { id: crypto.randomUUID(), timestamp: new Date().toISOString(), type, message, severity, targetId }] });

const buildNode = (kind: SoapNodeKind, position: { x: number; y: number }): SoapNode => {
  const def = componentMap.get(kind)!;
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  return {
    id,
    type: 'processNode',
    position,
    data: {
      ...structuredClone(def.defaults),
      id,
      type: kind,
      visibleName: def.label,
      shortName: def.shortName,
      technicalTag: `${def.technicalPrefix}-${String(Math.floor(Math.random() * 900) + 100)}`,
      category: def.category,
      description: def.description,
      className: def.className,
      createdAt: timestamp,
      updatedAt: timestamp,
      revision: 1,
    },
  };
};

const buildEdge = (
  source: string,
  target: string,
  medium: NonNullable<SoapEdge['data']>['medium'] = 'water',
  nominalDiameter = 'DN50',
  handles?: { sourceHandle?: string | null; targetHandle?: string | null },
): SoapEdge => ({
  id: crypto.randomUUID(),
  source,
  target,
  sourceHandle: handles?.sourceHandle ?? null,
  targetHandle: handles?.targetHandle ?? null,
  type: 'flowEdge',
  markerEnd: { type: MarkerType.ArrowClosed },
  animated: false,
  data: { mediumType: medium, medium, flowLpm: 0, flowRate: 0, flowActive: false, blocked: false, routeState: 'idle', pressure: 0, nominalDiameter, direction: 'forward', stateLabel: 'Ожидание', segmentId: crypto.randomUUID(), upstreamRef: source, downstreamRef: target },
});

interface AppState {
  project: ProjectDocument; projectRevision: number; persistedRevision: number; viewportNonce: number; selectedNodeId?: string; selectedEdgeId?: string; search: string; inspectorTab: InspectorTab; showProblematicOnly: boolean; hoveredEdgeId?: string; edgeLabelMode: EdgeLabelMode; edgeEditorMode?: EdgeEditorMode; issues: ValidationIssue[]; pathSelection: { upstream: string[]; downstream: string[]; edges: string[] }; startupState: StartupState; startupNotice?: StartupNotice; startupError?: string;
  onNodesChange: (changes: NodeChange[]) => void; onEdgesChange: (changes: EdgeChange[]) => void; onConnect: (connection: Connection) => void; setViewport: (viewport: Viewport, options?: { manual?: boolean }) => void; addNode: (type: SoapNodeKind, position?: { x: number; y: number }) => void; selectNode: (nodeId?: string) => void; selectEdge: (edgeId?: string) => void; updateNodeField: (nodeId: string, path: string, value: string | number | boolean) => void; setSearch: (search: string) => void; setInspectorTab: (tab: InspectorTab) => void; setSimulationRunning: (running: boolean) => void; setSimulationSpeed: (speed: number) => void; resetSimulation: () => void; tickSimulation: (dt: number) => void;
  resetProject: () => Promise<void>; resetUserData: () => Promise<void>; clearLocalDataAndLoadDemo: () => Promise<void>; newProject: () => void; loadTemplate: (templateId: TemplateId) => Promise<void>; saveProject: (reason?: 'autosave' | 'manual') => Promise<void>; loadProject: (id?: string) => Promise<void>; exportProject: () => string; importProject: (json: string) => void; runValidation: () => void; toggleProblematicOnly: () => void; hoverEdge: (edgeId?: string) => void; setEdgeLabelMode: (mode: EdgeLabelMode) => void; loadSafeDemo: () => Promise<void>; dismissStartupNotice: () => void; setStartupError: (message?: string) => void;
  updateEdgeField: (edgeId: string, field: string, value: string | number | boolean) => void; executeNodeAction: (nodeId: string, action: string) => void;
  setEdgeEditorMode: (mode?: EdgeEditorMode) => void; executeEdgeAction: (action: EdgeActionKind, edgeId?: string) => void; insertNodeIntoEdge: (kind: SoapNodeKind, edgeId?: string) => void; createBranchFromEdge: (kind?: SoapNodeKind, edgeId?: string) => void; removeSelectedSegment: (edgeId?: string) => void; reconnectSelectedEdge: (edgeId?: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  project: makeProject(), projectRevision: 0, persistedRevision: 0, viewportNonce: 0, selectedNodeId: undefined, selectedEdgeId: undefined, search: '', inspectorTab: 'main', showProblematicOnly: false, hoveredEdgeId: undefined, edgeLabelMode: 'selected', edgeEditorMode: undefined, issues: validateProject(makeProject()), pathSelection: { upstream: [], downstream: [], edges: [] }, startupState: 'booting', startupNotice: undefined, startupError: undefined,
  onNodesChange: (changes) => set((state) => { const project = normalizeProjectEdgeHandles({ ...state.project, nodes: applyNodeChanges(changes, state.project.nodes) }); return { project, issues: validateProject(project), projectRevision: state.projectRevision + 1 }; }),
  onEdgesChange: (changes) => set((state) => { const project = normalizeProjectEdgeHandles({ ...state.project, edges: applyEdgeChanges(changes, state.project.edges) }); return { project, issues: validateProject(project), projectRevision: state.projectRevision + 1 }; }),
  onConnect: (connection) => set((state) => { const source = state.project.nodes.find((node) => node.id === connection.source); const target = state.project.nodes.find((node) => node.id === connection.target); if (!source || !target) return state; const sourceHandle = getPreferredFreeHandleId(source, 'source', state.project.edges, connection.sourceHandle) ?? normalizeHandleForNode(source, 'source', connection.sourceHandle); const targetHandle = getPreferredFreeHandleId(target, 'target', state.project.edges, connection.targetHandle) ?? normalizeHandleForNode(target, 'target', connection.targetHandle); if (!sourceHandle || !targetHandle) return state; const project = { ...state.project, edges: addEdge(buildEdge(source.id, target.id, target.data.medium || source.data.medium, 'DN50', { sourceHandle, targetHandle }), state.project.edges) }; const loggedProject = logEvent(project, `Создан новый сегмент между «${source.data.visibleName}» и «${target.data.visibleName}».`, source.id); return { project: loggedProject, issues: validateProject(loggedProject), projectRevision: state.projectRevision + 1 }; }),
  setViewport: (viewport, options) => set((state) => ({ project: { ...state.project, view: { ...state.project.view, viewport, hasManualViewport: options?.manual ?? true } }, projectRevision: options?.manual ? state.projectRevision + 1 : state.projectRevision })),
  addNode: (type, position = { x: 200, y: 200 }) => set((state) => { const node = buildNode(type, position); const project = { ...state.project, nodes: [...state.project.nodes, node] }; return { project: logEvent(project, `Добавлен элемент «${node.data.visibleName}».`, node.id), selectedNodeId: node.id, issues: validateProject(project), projectRevision: state.projectRevision + 1 }; }),
  selectNode: (selectedNodeId) => set((state) => ({ selectedNodeId, selectedEdgeId: undefined, hoveredEdgeId: undefined, edgeEditorMode: undefined, pathSelection: computePathSelection(state.project, selectedNodeId, undefined) })),
  selectEdge: (selectedEdgeId) => set((state) => ({ selectedEdgeId, selectedNodeId: undefined, hoveredEdgeId: selectedEdgeId ?? state.hoveredEdgeId, edgeEditorMode: selectedEdgeId ? 'actions' : undefined, pathSelection: computePathSelection(state.project, undefined, selectedEdgeId) })),
  updateNodeField: (nodeId, path, value) => set((state) => { const project = normalizeProjectEdgeHandles({ ...state.project, nodes: state.project.nodes.map((node) => node.id !== nodeId ? node : (() => { const copy = structuredClone(node); setByPath(copy, path, value); return copy; })()) }); return { project, issues: validateProject(project), projectRevision: state.projectRevision + 1 }; }),
  setSearch: (search) => set({ search }), setInspectorTab: (inspectorTab) => set({ inspectorTab }),
  setSimulationRunning: (running) => set((state) => ({ project: { ...state.project, simulation: { ...state.project.simulation, running } }, projectRevision: state.projectRevision + 1 })),
  setSimulationSpeed: (speed) => set((state) => ({ project: { ...state.project, simulation: { ...state.project.simulation, speed } }, projectRevision: state.projectRevision + 1 })),
  resetSimulation: () => set((state) => {
    const project = clone(state.project);
    project.simulation = { ...project.simulation, running: false, tick: 0, warnings: [], activeMedium: 'none', totalActiveFlow: 0, lastEvent: 'Симуляция сброшена' };
    project.edges = project.edges.map((edge) => ({ ...edge, animated: false, data: { mediumType: edge.data?.mediumType ?? edge.data?.medium ?? 'water', medium: edge.data?.medium ?? edge.data?.mediumType ?? 'water', flowLpm: 0, flowRate: 0, flowActive: false, blocked: false, routeState: 'idle', pressure: 0, nominalDiameter: edge.data?.nominalDiameter ?? 'DN50', blockedBy: [], stateLabel: 'Ожидание', upstreamRef: edge.data?.upstreamRef, downstreamRef: edge.data?.downstreamRef, selectedPath: edge.data?.selectedPath, sourceLabel: edge.data?.sourceLabel, targetLabel: edge.data?.targetLabel, hovered: edge.data?.hovered, labelMode: edge.data?.labelMode, segmentId: edge.data?.segmentId, direction: edge.data?.direction } }));
    project.nodes = project.nodes.map((node) => ({ ...node, data: { ...node.data, status: node.data.visual.enabled ? (node.data.kind === 'pump' || node.data.kind === 'dosingPump' ? 'off' : 'idle') : 'disabled', alarms: [], visual: { ...node.data.visual, stateBadge: undefined }, runtime: { ...node.data.runtime, active: false, blocked: false, routeState: node.data.visual.enabled ? 'idle' : 'maintenance', flow: 0, flowLpm: 0, alarmText: '' }, simulation: { ...node.data.simulation, active: false, blocked: false, routeState: node.data.visual.enabled ? 'idle' : 'maintenance', flow: 0, flowLpm: 0, alarmText: '' } } }));
    return { project: logEvent(project, 'Симуляция сброшена.', undefined, 'info', 'simulation'), issues: validateProject(project), projectRevision: state.projectRevision + 1 };
  }),
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

  updateEdgeField: (edgeId, field, value) => set((state) => { const project = { ...state.project, edges: state.project.edges.map((edge) => { if (edge.id !== edgeId) return edge; const data: any = { ...(edge.data ?? {}) }; data[field] = value; if (field === 'mediumType') data.medium = value as any; if (field === 'flowLpm') data.flowRate = Number(value); return { ...edge, data } as SoapEdge; }) }; return { project, issues: validateProject(project), projectRevision: state.projectRevision + 1 }; }),
  executeNodeAction: (nodeId, action) => set((state) => {
    let eventMessage = '';
    let eventSeverity: 'info' | 'warning' | 'error' = 'info';
    let eventType = 'operation';
    const project = { ...state.project, nodes: state.project.nodes.map((node) => {
      if (node.id !== nodeId) return node;
      const copy = structuredClone(node); const p: any = copy.data.process; const d: any = copy.data;
      if (action === 'reactor:start') { d.status = 'running'; d.runtime.active = true; d.simulation.active = true; d.visual.enabled = true; d.isEnabled = true; d.runtime.enabled = true; d.simulation.enabled = true; eventMessage = `${d.visibleName}: реактор включён.`; }
      else if (action === 'reactor:stop') { d.status = 'off'; d.runtime.active = false; d.simulation.active = false; d.visual.enabled = true; eventMessage = `${d.visibleName}: реактор остановлен.`; }
      else if (action === 'reactor:heatingOn') { p.heatingOn = true; eventMessage = `${d.visibleName}: нагрев включён.`; }
      else if (action === 'reactor:heatingOff') { p.heatingOn = false; eventMessage = `${d.visibleName}: нагрев выключен.`; }
      else if (action === 'reactor:agitatorOn') { p.agitatorOn = true; p.mixingOn = true; eventMessage = `${d.visibleName}: мешалка включена.`; }
      else if (action === 'reactor:agitatorOff') { p.agitatorOn = false; p.mixingOn = false; eventMessage = `${d.visibleName}: мешалка выключена.`; }
      else if (action === 'reactor:setIdle') { d.status = 'idle'; eventMessage = `${d.visibleName}: реактор переведён в ожидание.`; }
      else if (action === 'reactor:setMaintenance') { d.status = 'maintenance'; d.visual.enabled = false; eventMessage = `${d.visibleName}: реактор переведён в ремонт.`; eventSeverity = 'warning'; }
      else if (action === 'pump:start') { d.status = 'running'; d.visual.enabled = true; d.isEnabled = true; d.runtime.enabled = true; d.simulation.enabled = true; p.pumpOn = true; p.actualFlowLpm = p.nominalFlowLpm ?? p.actualFlowLpm ?? p.flowRate; eventMessage = `${d.visibleName}: насос запущен.`; }
      else if (action === 'pump:stop') { d.status = 'off'; p.pumpOn = false; p.actualFlowLpm = 0; eventMessage = `${d.visibleName}: насос остановлен.`; }
      else if (action === 'pump:clearAlarm') { d.status = 'idle'; d.alarms = []; d.runtime.alarmText = ''; d.simulation.alarmText = ''; eventMessage = `${d.visibleName}: тревога насоса сброшена.`; }
      else if (action === 'valve:open') { p.isOpen = true; p.valveOpen = true; p.valveState = 'open'; d.status = 'running'; eventMessage = `${d.visibleName}: клапан открыт.`; }
      else if (action === 'valve:close') { p.isOpen = false; p.valveOpen = false; p.valveState = 'closed'; d.status = 'blocked'; eventMessage = `${d.visibleName}: клапан закрыт.`; }
      else if (action === 'valve:auto') { d.mode = 'auto'; p.manualOverride = false; p.valveMode = 'auto'; eventMessage = `${d.visibleName}: клапан переведён в авто.`; }
      else if (action === 'valve:manual') { d.mode = 'manual'; p.manualOverride = true; p.valveMode = 'manual'; eventMessage = `${d.visibleName}: клапан переведён в ручной режим.`; }
      else if (action === 'tank:enableReceive') { p.canReceive = true; eventMessage = `${d.visibleName}: приём разрешён.`; }
      else if (action === 'tank:disableReceive') { p.canReceive = false; eventMessage = `${d.visibleName}: приём запрещён.`; eventSeverity = 'warning'; }
      else if (action === 'tank:enableDischarge') { p.canDischarge = true; eventMessage = `${d.visibleName}: выдача разрешена.`; }
      else if (action === 'tank:disableDischarge') { p.canDischarge = false; eventMessage = `${d.visibleName}: выдача запрещена.`; eventSeverity = 'warning'; }
      else if (action === 'sensor:clearWarning') { d.status = 'idle'; d.alarms = []; d.runtime.alarmText = ''; d.simulation.alarmText = ''; eventMessage = `${d.visibleName}: предупреждение снято.`; }
      else if (action === 'sensor:enable') { d.isEnabled = true; d.visual.enabled = true; d.simulation.enabled = true; d.runtime.enabled = true; eventMessage = `${d.visibleName}: контроль включён.`; }
      else if (action === 'sensor:disable') { d.isEnabled = false; d.visual.enabled = false; d.simulation.enabled = false; d.runtime.enabled = false; eventMessage = `${d.visibleName}: контроль выключен.`; eventSeverity = 'warning'; }
      d.updatedAt = new Date().toISOString(); d.revision = Number(d.revision ?? 0) + 1; return copy;
    }) };
    const loggedProject = eventMessage ? logEvent({ ...project, simulation: { ...project.simulation, lastEvent: eventMessage } }, eventMessage, nodeId, eventSeverity, eventType) : project;
    return { project: limitedLog(loggedProject), issues: validateProject(loggedProject), projectRevision: state.projectRevision + 1 };
  }),
  setEdgeEditorMode: (edgeEditorMode) => set({ edgeEditorMode }),
  executeEdgeAction: (action, edgeId) => {
    if (action.startsWith('insert:')) get().insertNodeIntoEdge(action.replace('insert:', '') as SoapNodeKind, edgeId);
    else if (action === 'branch:tee') get().createBranchFromEdge('tee', edgeId);
    else if (action === 'break' || action === 'delete') get().removeSelectedSegment(edgeId);
    else if (action === 'reconnect') get().reconnectSelectedEdge(edgeId);
  },
  insertNodeIntoEdge: (kind, edgeId) => set((state) => {
    const activeEdgeId = edgeId ?? state.selectedEdgeId;
    const edge = state.project.edges.find((item) => item.id === activeEdgeId); if (!edge) return state;
    const source = state.project.nodes.find((item) => item.id === edge.source); const target = state.project.nodes.find((item) => item.id === edge.target); if (!source || !target) return state;
    const node = buildNode(kind, midPoint(source, target));
    const upstreamHandle = normalizeHandleForNode(source, 'source', edge.sourceHandle) ?? rightHandleId;
    const downstreamHandle = normalizeHandleForNode(target, 'target', edge.targetHandle) ?? leftHandleId;
    const insertTargetHandle = normalizeHandleForNode(node, 'target', leftHandleId) ?? leftHandleId;
    const insertSourceHandle = normalizeHandleForNode(node, 'source', rightHandleId) ?? rightHandleId;
    const newEdges = [buildEdge(source.id, node.id, edge.data?.medium ?? source.data.medium, edge.data?.nominalDiameter ?? 'DN50', { sourceHandle: upstreamHandle, targetHandle: insertTargetHandle }), buildEdge(node.id, target.id, edge.data?.medium ?? target.data.medium, edge.data?.nominalDiameter ?? 'DN50', { sourceHandle: insertSourceHandle, targetHandle: downstreamHandle })];
    const project = logEvent({ ...state.project, nodes: [...state.project.nodes, node], edges: state.project.edges.filter((item) => item.id !== edge.id).concat(newEdges) }, `В линию вставлен элемент «${node.data.visibleName}».`, node.id);
    return { project, selectedNodeId: node.id, selectedEdgeId: undefined, edgeEditorMode: undefined, pathSelection: computePathSelection(project, node.id, undefined), issues: validateProject(project), projectRevision: state.projectRevision + 1 };
  }),
  createBranchFromEdge: (kind = 'tee', edgeId) => set((state) => {
    const activeEdgeId = edgeId ?? state.selectedEdgeId;
    const edge = state.project.edges.find((item) => item.id === activeEdgeId); if (!edge) return state;
    const source = state.project.nodes.find((item) => item.id === edge.source); const target = state.project.nodes.find((item) => item.id === edge.target); if (!source || !target) return state;
    const center = midPoint(source, target); const branchNode = buildNode(kind, center);
    const upstreamHandle = normalizeHandleForNode(source, 'source', edge.sourceHandle) ?? rightHandleId;
    const downstreamHandle = normalizeHandleForNode(target, 'target', edge.targetHandle) ?? leftHandleId;
    const branchInputHandle = getPreferredFreeHandleId(branchNode, 'target', state.project.edges, leftHandleId, edge.id) ?? normalizeHandleForNode(branchNode, 'target', leftHandleId) ?? leftHandleId;
    const inlineBranchEdge = buildEdge(source.id, branchNode.id, edge.data?.medium ?? source.data.medium, edge.data?.nominalDiameter ?? 'DN50', { sourceHandle: upstreamHandle, targetHandle: branchInputHandle });
    const selectedFreeSourceHandle = getPreferredFreeHandleId(branchNode, 'source', [inlineBranchEdge], rightHandleId) ?? normalizeHandleForNode(branchNode, 'source', rightHandleId) ?? rightHandleId;
    const newEdges = [inlineBranchEdge, buildEdge(branchNode.id, target.id, edge.data?.medium ?? target.data.medium, edge.data?.nominalDiameter ?? 'DN50', { sourceHandle: selectedFreeSourceHandle, targetHandle: downstreamHandle })];
    const project = logEvent({ ...state.project, nodes: [...state.project.nodes, branchNode], edges: state.project.edges.filter((item) => item.id !== edge.id).concat(newEdges) }, `Создано ответвление через узел «${branchNode.data.visibleName}». Потяните свободный порт, чтобы сразу продолжить ветвь.`, branchNode.id);
    return { project, selectedNodeId: branchNode.id, selectedEdgeId: undefined, edgeEditorMode: undefined, pathSelection: computePathSelection(project, branchNode.id, undefined), issues: validateProject(project), projectRevision: state.projectRevision + 1 };
  }),
  removeSelectedSegment: (edgeId) => set((state) => {
    const activeEdgeId = edgeId ?? state.selectedEdgeId;
    if (!activeEdgeId) return state; const project = logEvent({ ...state.project, edges: state.project.edges.filter((edge) => edge.id !== activeEdgeId) }, 'Сегмент удалён.', activeEdgeId); return { project, selectedEdgeId: state.selectedEdgeId === activeEdgeId ? undefined : state.selectedEdgeId, edgeEditorMode: state.selectedEdgeId === activeEdgeId ? undefined : state.edgeEditorMode, issues: validateProject(project), projectRevision: state.projectRevision + 1 };
  }),
  reconnectSelectedEdge: (edgeId) => set((state) => {
    const activeEdgeId = edgeId ?? state.selectedEdgeId;
    const edge = state.project.edges.find((item) => item.id === activeEdgeId); if (!edge) return state; const source = state.project.nodes.find((item) => item.id === edge.source); const target = state.project.nodes.find((item) => item.id === edge.target); if (!source || !target) return state; const rerouted: SoapEdge = { ...edge, type: 'flowEdge', sourceHandle: normalizeHandleForNode(source, 'source', edge.sourceHandle), targetHandle: normalizeHandleForNode(target, 'target', edge.targetHandle), data: { ...edge.data!, stateLabel: 'Переподключён', medium: edge.data?.medium || 'water', flowActive: edge.data?.flowActive || false, blocked: edge.data?.blocked || false, routeState: edge.data?.routeState || 'idle', flowRate: edge.data?.flowRate || 0, pressure: edge.data?.pressure || 0 } }; const project = logEvent({ ...state.project, edges: state.project.edges.map((item) => item.id === edge.id ? rerouted : item) }, `Сегмент «${source.data.shortName} → ${target.data.shortName}» отмечен для переподключения.`, edge.id); return { project, issues: validateProject(project), projectRevision: state.projectRevision + 1 };
  }),
}));

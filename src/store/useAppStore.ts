import { create } from 'zustand';
import { addEdge, applyEdgeChanges, applyNodeChanges, Connection, EdgeChange, NodeChange, Viewport } from 'reactflow';
import { APP_SCHEMA_VERSION, PROJECT_SCHEMA_VERSION, demoProject, templates } from '../domain/templates/templates';
import { EdgeLabelMode, InspectorTab, MeasurementPoint, MeasurementPointType, PresentationMode, ProjectDocument, SimulationSettings, SoapEdge, SoapNode, SoapNodeKind, TemplateId, ValidationIssue } from '../domain/schemas/types';
import { clearPersistedState, clearUserData, loadStoredProject, saveStoredProject } from '../features/persistence/db';
import { mediumPalette } from '../ui/tokens/tokens';
import { runSimulationStep } from '../domain/simulation/engine';
import { restoreProjectDocument, validateProject } from '../domain/validation/validateProject';
import { DEFAULT_SOURCE_HANDLE, DEFAULT_TARGET_HANDLE, getPreferredFreeHandleId, normalizeHandleForNode, normalizeProjectEdgeHandles } from '../domain/flow/handles';
import { executeNodeCommand } from '../domain/commands/nodeCommands';
import { createBranchFromEdge as createBranchTopology, insertNodeIntoEdge as insertNodeTopology, reconnectSegment, removeSegment } from '../domain/topology/edgeOperations';
import { buildEdge, buildNode, cloneProject, makeProject, midPoint } from '../domain/entities/projectFactory';
import { EquipmentWizardGroupId, applyWizardValuesToNode, buildWizardInitialValues, generateTechnicalTag, inferWizardContext, wizardSubtypeMap } from '../features/equipmentWizard/schema';

interface StartupNotice { type: 'warning' | 'info'; message: string; }
type StartupState = 'booting' | 'ready';
export type EdgeEditorMode = 'actions' | 'insert';
export type EdgeActionKind = 'insert:shutoffValve' | 'insert:gateValve' | 'insert:checkValve' | 'insert:flowMeter' | 'insert:pressureSensor' | 'insert:pump' | 'insert:inlineFilter' | 'insert:tee' | 'insert:cross' | 'insert:drainBranch' | 'insert:samplePoint' | 'branch:tee' | 'break' | 'reconnect' | 'delete';
export type LibraryPickerMode = 'global' | 'context-insert';
export type LibraryPickerContext = { edgeId?: string };

const limitedLog = (project: ProjectDocument) => ({ ...project, eventLog: project.eventLog.slice(-80) });

type PersistenceStatus = 'saved' | 'dirty' | 'saving' | 'error';
const AUTOSAVE_DELAY_MS = 900;
let persistTimer: number | undefined;
let persistInFlight: Promise<void> = Promise.resolve();
let queuedSnapshot: ProjectDocument | undefined;
let queuedRevision: number | undefined;

const serializeProjectForStorage = (project: ProjectDocument): ProjectDocument => {
  const snapshot = cloneProject(project);
  snapshot.eventLog = snapshot.eventLog.slice(-120);
  snapshot.simulation = { ...snapshot.simulation, running: false };
  return snapshot;
};

const persistRevisionNow = (project: ProjectDocument, revision: number, reason: 'autosave' | 'manual' | 'flush') => {
  const snapshot = serializeProjectForStorage(project);
  persistInFlight = persistInFlight
    .catch(() => undefined)
    .then(async () => {
      useAppStore.setState({ persistenceStatus: 'saving' });
      await saveStoredProject({
        ...snapshot,
        updatedAt: new Date().toISOString(),
        appSchemaVersion: APP_SCHEMA_VERSION,
        projectSchemaVersion: PROJECT_SCHEMA_VERSION,
      });
      const current = useAppStore.getState();
      if (current.projectRevision === revision || reason !== 'autosave') {
        useAppStore.setState({ persistedRevision: revision, persistenceStatus: 'saved', lastSavedAt: new Date().toISOString(), persistenceError: undefined });
      }
    })
    .catch((error) => {
      console.error('[persistence] failed to save project snapshot', { reason, revision, error });
      useAppStore.setState({ persistenceStatus: 'error', persistenceError: 'Не удалось сохранить проект локально.' });
    });
  return persistInFlight;
};

const scheduleSafePersist = (project: ProjectDocument, revision: number) => {
  if (typeof window === 'undefined') return;
  queuedSnapshot = cloneProject(project);
  queuedRevision = revision;
  useAppStore.setState({ persistenceStatus: 'dirty' });
  if (persistTimer) window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    if (!queuedSnapshot || queuedRevision === undefined) return;
    const nextSnapshot = queuedSnapshot;
    const nextRevision = queuedRevision;
    queuedSnapshot = undefined;
    queuedRevision = undefined;
    void persistRevisionNow(nextSnapshot, nextRevision, 'autosave');
  }, AUTOSAVE_DELAY_MS);
};

const flushPendingPersistence = async () => {
  if (typeof window !== 'undefined' && persistTimer) {
    window.clearTimeout(persistTimer);
    persistTimer = undefined;
  }
  if (queuedSnapshot && queuedRevision !== undefined) {
    const snapshot = queuedSnapshot;
    const revision = queuedRevision;
    queuedSnapshot = undefined;
    queuedRevision = undefined;
    await persistRevisionNow(snapshot, revision, 'flush');
    return;
  }
  await persistInFlight;
};

const syncNodePresentation = (node: SoapNode) => {
  const process = node.data.process as any;
  if (node.data.orientation) node.data.ports.preferredDirection = node.data.orientation === 'vertical' ? 'ttb' : 'ltr';
  if (process.mediumType || process.medium) {
    const medium = (process.mediumType ?? process.medium ?? node.data.mediumType) as SoapNode['data']['medium'];
    node.data.medium = medium;
    node.data.mediumType = medium;
    process.medium = medium;
    process.mediumType = medium;
  }

  if (process.capacity !== undefined) process.capacityLiters = Number(process.capacity);
  if (process.capacityLiters !== undefined && process.capacity === undefined) process.capacity = Number(process.capacityLiters);
  if (process.level !== undefined) process.currentLevelLiters = Number(process.level);
  if (process.currentLevelLiters !== undefined && process.level === undefined) process.level = Number(process.currentLevelLiters);
  if (process.temperature !== undefined) process.temperatureC = Number(process.temperature);
  if (process.temperatureC !== undefined && process.temperature === undefined) process.temperature = Number(process.temperatureC);
  if (process.pressure !== undefined) process.pressureBar = Number(process.pressure);
  if (process.pressureBar !== undefined && process.pressure === undefined) process.pressure = Number(process.pressureBar);
  if (process.flowRate !== undefined) {
    const flow = Number(process.flowRate);
    if (node.data.kind === 'pump' || node.data.kind === 'dosingPump') {
      process.nominalFlowLpm = flow;
      if (process.pumpOn !== false) process.actualFlowLpm = flow;
    }
    node.data.runtime.flow = flow;
    node.data.runtime.flowLpm = flow;
    node.data.simulation.flow = flow;
    node.data.simulation.flowLpm = flow;
  }

  if (process.warningLow !== undefined) process.warnLow = Number(process.warningLow);
  if (process.warningHigh !== undefined) process.warnHigh = Number(process.warningHigh);
  if (process.signalUnit !== undefined) process.unit = process.signalUnit;
  if (process.unit !== undefined && process.signalUnit === undefined) process.signalUnit = process.unit;
  if (process.signalValue !== undefined) process.currentValue = Number(process.signalValue);
  if (process.currentValue !== undefined && process.signalValue === undefined) process.signalValue = Number(process.currentValue);
  if (process.signalType !== undefined && process.measuredProperty === undefined) process.measuredProperty = process.signalType;

  process.allowIntake = Boolean(process.allowIntake ?? process.canReceive ?? true);
  process.allowDischarge = Boolean(process.allowDischarge ?? process.canDischarge ?? true);
  process.isRunning = Boolean(process.isRunning ?? process.pumpOn ?? process.mixingOn ?? process.heatingOn ?? node.data.status === 'running');
  process.isBlocked = Boolean(process.isBlocked ?? false);
  process.processState = String(process.processState ?? 'idle');
  process.mode = String(process.mode ?? node.data.mode ?? 'auto');
  process.canReceive = process.allowIntake;
  process.canDischarge = process.allowDischarge;

  if (node.data.className === 'valve') {
    const valveOpen = Boolean(process.isOpen ?? process.valveOpen ?? process.valveState !== 'closed');
    process.isOpen = valveOpen;
    process.valveOpen = valveOpen;
    process.valveState = valveOpen ? 'open' : 'closed';
    node.data.status = valveOpen ? 'running' : 'blocked';
  }

  if (node.data.kind === 'pump' || node.data.kind === 'dosingPump') {
    const inferredPumpOn = process.pumpOn ?? ((Number(process.actualFlowLpm ?? 0) > 0) || (Number(process.flowRate ?? 0) > 0));
    const pumpOn = Boolean(inferredPumpOn);
    process.pumpOn = pumpOn;
    if (!pumpOn) process.actualFlowLpm = 0;
    else if (process.actualFlowLpm === undefined) process.actualFlowLpm = Number(process.nominalFlowLpm ?? process.flowRate ?? 0);
    node.data.status = pumpOn ? 'running' : 'off';
    process.isRunning = pumpOn;
    node.data.runtime.active = pumpOn;
    node.data.simulation.active = pumpOn;
  }

  const capacity = Number(process.capacityLiters ?? process.capacity ?? 0);
  const level = Number(process.currentLevelLiters ?? process.level ?? 0);
  process.levelPercent = capacity > 0 ? Math.max(0, Math.min(100, (level / capacity) * 100)) : 0;
  node.data.visual.fill = process.levelPercent ?? node.data.visual.fill;
  node.data.visual.accent = node.data.visual.accent || mediumPalette[node.data.medium].base;
  node.data.isEnabled = node.data.visual.enabled;
  node.data.runtime.enabled = node.data.visual.enabled && node.data.simulation.enabled;
  node.data.simulation.enabled = node.data.simulation.enabled && node.data.visual.enabled;
  node.data.simulationEnabled = node.data.simulation.enabled;
};

const reapplyDerivedState = (project: ProjectDocument) => {
  const simulationResult = runSimulationStep({ ...project, simulation: { ...project.simulation } }, 0);
  return {
    ...project,
    nodes: simulationResult.nodes,
    edges: simulationResult.edges,
    simulation: {
      ...project.simulation,
      warnings: simulationResult.warnings,
      activeMedium: simulationResult.activeMedium,
      totalActiveFlow: simulationResult.totalActiveFlow,
      lastEvent: simulationResult.lastEvent,
    },
  };
};

const sanitizeProjectState = (project: ProjectDocument, revision = 0, persistedRevision = revision, viewportNonce = 0) => {
  const normalizedProject = normalizeProjectEdgeHandles(project);
  normalizedProject.view = {
    ...normalizedProject.view,
    presentationMode: normalizedProject.view.presentationMode ?? 'schematic',
    schematicLayout: normalizedProject.view.schematicLayout ?? { autoNodePositions: {}, manualNodePositions: {} },
  };
  normalizedProject.simulation = {
    ...normalizedProject.simulation,
    status: normalizedProject.simulation.status ?? (normalizedProject.simulation.running ? 'running' : 'idle'),
    fluid: normalizedProject.simulation.fluid ?? { id: 'water', kind: 'water', name: 'Вода', densityKgPerM3: 998, dynamicViscosityPaS: 0.001002 },
    scenarioRevision: normalizedProject.simulation.scenarioRevision ?? 0,
  };
  return {
    project: normalizedProject,
    projectRevision: revision,
    persistedRevision,
    viewportNonce,
    issues: validateProject(normalizedProject),
    selectedNodeId: undefined,
    selectedEdgeId: undefined,
    selectedMeasurementPointId: undefined,
    pathSelection: { upstream: [], downstream: [], edges: [] },
  };
};

const setByPath = (node: SoapNode, path: string, value: string | number | boolean) => {
  const data = node.data as any;
  if (['visibleName', 'description', 'shortName', 'notes', 'technicalTag', 'status', 'mode', 'orientation', 'symbolVariant'].includes(path)) data[path] = value;
  else if (path === 'medium' || path === 'mediumType') { data.medium = value; data.mediumType = value; data.process.medium = value; data.process.mediumType = value; }
  else if (path === 'inputs' || path === 'outputs' || path === 'preferredDirection' || path === 'inline') data.ports[path] = path === 'inputs' || path === 'outputs' ? Number(value) : value;
  else if (path === 'accent' || path === 'fill' || path === 'enabled' || path === 'showLabel') {
    data.visual[path === 'enabled' ? 'enabled' : path] = value;
    if (path === 'enabled') {
      const enabled = Boolean(value);
      data.isEnabled = enabled;
      data.runtime.enabled = enabled && data.simulation.enabled;
      data.simulationEnabled = enabled && data.simulation.enabled;
    }
  }
  else if (path === 'simEnabled') {
    const enabled = Boolean(value);
    data.simulation.enabled = enabled;
    data.runtime.enabled = enabled && data.visual.enabled;
    data.simulationEnabled = enabled;
  }
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

const leftHandleId = DEFAULT_TARGET_HANDLE;
const rightHandleId = DEFAULT_SOURCE_HANDLE;

const logEvent = (project: ProjectDocument, message: string, targetId?: string, severity: 'info' | 'warning' | 'error' = 'info', type = 'editor'): ProjectDocument => ({ ...project, eventLog: [...project.eventLog, { id: crypto.randomUUID(), timestamp: new Date().toISOString(), type, message, severity, targetId }] });
const toSimulationStatus = (running: boolean): SimulationSettings['status'] => (running ? 'running' : 'paused');

interface AppState {
  project: ProjectDocument; projectRevision: number; persistedRevision: number; viewportNonce: number; selectedNodeId?: string; selectedEdgeId?: string; selectedMeasurementPointId?: string; search: string; inspectorTab: InspectorTab; showProblematicOnly: boolean; hoveredEdgeId?: string; edgeLabelMode: EdgeLabelMode; edgeEditorMode?: EdgeEditorMode; issues: ValidationIssue[]; pathSelection: { upstream: string[]; downstream: string[]; edges: string[] }; startupState: StartupState; startupNotice?: StartupNotice; startupError?: string; persistenceStatus: PersistenceStatus; lastSavedAt?: string; persistenceError?: string; lastCommand?: string; wizard: { open: boolean; groupId?: EquipmentWizardGroupId; kind?: SoapNodeKind; values: Record<string, string | number | boolean>; namingRule: string; }; libraryPicker: { open: boolean; mode: LibraryPickerMode; context?: LibraryPickerContext };
  onNodesChange: (changes: NodeChange[]) => void; onEdgesChange: (changes: EdgeChange[]) => void; onConnect: (connection: Connection) => void; setViewport: (viewport: Viewport, options?: { manual?: boolean }) => void; addNode: (type: SoapNodeKind, position?: { x: number; y: number }) => void; selectNode: (nodeId?: string) => void; selectEdge: (edgeId?: string) => void; selectMeasurementPoint: (pointId?: string) => void; addMeasurementPoint: (type: MeasurementPointType, anchor: { nodeId?: string; edgeId?: string; x?: number; y?: number; ratio?: number }) => void; updateMeasurementPoint: (id: string, patch: Partial<Pick<MeasurementPoint, 'shortTag' | 'label' | 'visible' | 'enabled' | 'notes'>>) => void; deleteMeasurementPoint: (id: string) => void; updateNodeField: (nodeId: string, path: string, value: string | number | boolean) => void; setSearch: (search: string) => void; setInspectorTab: (tab: InspectorTab) => void; setSimulationRunning: (running: boolean) => void; setSimulationSpeed: (speed: number) => void; setSimulationFluid: (fluid: SimulationSettings['fluid']) => void; runFluidScenario: () => void; resetSimulation: () => void; tickSimulation: (dt: number) => void;
  resetProject: () => Promise<void>; resetUserData: () => Promise<void>; clearLocalDataAndLoadDemo: () => Promise<void>; newProject: () => void; loadTemplate: (templateId: TemplateId) => Promise<void>; saveProject: (reason?: 'autosave' | 'manual') => Promise<void>; loadProject: (id?: string) => Promise<void>; exportProject: () => string; importProject: (json: string) => void; runValidation: () => void; toggleProblematicOnly: () => void; hoverEdge: (edgeId?: string) => void; setEdgeLabelMode: (mode: EdgeLabelMode) => void; setPresentationMode: (mode: PresentationMode) => void; setSchematicManualNodePosition: (nodeId: string, position: { x: number; y: number }) => void; resetSchematicNodeOverride: (nodeId: string) => void; resetAllSchematicOverrides: () => void; setSchematicAutoNodePositions: (positions: Record<string, { x: number; y: number }>) => void; loadSafeDemo: () => Promise<void>; dismissStartupNotice: () => void; setStartupError: (message?: string) => void; openEquipmentWizard: (options?: { groupId?: EquipmentWizardGroupId; kind?: SoapNodeKind }) => void; closeEquipmentWizard: () => void; setWizardGroup: (groupId: EquipmentWizardGroupId) => void; setWizardKind: (kind: SoapNodeKind) => void; updateWizardValue: (key: string, value: string | number | boolean) => void; regenerateWizardTag: () => void; createEquipmentFromWizard: () => void;
  updateEdgeField: (edgeId: string, field: string, value: string | number | boolean) => void; executeNodeAction: (nodeId: string, action: string) => void;
  setEdgeEditorMode: (mode?: EdgeEditorMode) => void; executeEdgeAction: (action: EdgeActionKind, edgeId?: string) => void; insertNodeIntoEdge: (kind: SoapNodeKind, edgeId?: string) => void; createBranchFromEdge: (kind?: SoapNodeKind, edgeId?: string) => void; removeSelectedSegment: (edgeId?: string) => void; reconnectSelectedEdge: (edgeId?: string) => void;
  openLibraryPicker: (mode: LibraryPickerMode, context?: LibraryPickerContext) => void; closeLibraryPicker: () => void; insertFromLibrary: (kind: SoapNodeKind) => void;
}

export type { AppState };

export const useAppStore = create<AppState>((set, get) => ({
  project: makeProject(), projectRevision: 0, persistedRevision: 0, viewportNonce: 0, selectedNodeId: undefined, selectedEdgeId: undefined, selectedMeasurementPointId: undefined, search: '', inspectorTab: 'main', showProblematicOnly: false, hoveredEdgeId: undefined, edgeLabelMode: 'selected', edgeEditorMode: undefined, issues: validateProject(makeProject()), pathSelection: { upstream: [], downstream: [], edges: [] }, startupState: 'booting', startupNotice: undefined, startupError: undefined, persistenceStatus: 'saved', lastSavedAt: undefined, persistenceError: undefined, lastCommand: undefined, wizard: { open: false, groupId: undefined, kind: undefined, values: {}, namingRule: '{prefix}-{seq}' }, libraryPicker: { open: false, mode: 'global' },
  onNodesChange: (changes) => set((state) => { const project = normalizeProjectEdgeHandles({ ...state.project, nodes: applyNodeChanges(changes, state.project.nodes) }); return { project, issues: validateProject(project), projectRevision: state.projectRevision + 1 }; }),
  onEdgesChange: (changes) => set((state) => { const project = normalizeProjectEdgeHandles({ ...state.project, edges: applyEdgeChanges(changes, state.project.edges) }); return { project, issues: validateProject(project), projectRevision: state.projectRevision + 1 }; }),
  onConnect: (connection) => set((state) => { const source = state.project.nodes.find((node) => node.id === connection.source); const target = state.project.nodes.find((node) => node.id === connection.target); if (!source || !target) return state; const sourceHandle = getPreferredFreeHandleId(source, 'source', state.project.edges, connection.sourceHandle) ?? normalizeHandleForNode(source, 'source', connection.sourceHandle); const targetHandle = getPreferredFreeHandleId(target, 'target', state.project.edges, connection.targetHandle) ?? normalizeHandleForNode(target, 'target', connection.targetHandle); if (!sourceHandle || !targetHandle) return state; const edgeContext = { selectedNode: source }; const project = { ...state.project, edges: addEdge(buildEdge(source.id, target.id, target.data.medium || source.data.medium, (source.data.process as any).diameterNominal ?? 'DN50', { sourceHandle, targetHandle }, state.project, edgeContext), state.project.edges) }; const loggedProject = logEvent(project, `Создан новый сегмент между «${source.data.visibleName}» и «${target.data.visibleName}».`, source.id); return { project: loggedProject, issues: validateProject(loggedProject), projectRevision: state.projectRevision + 1 }; }),
  setViewport: (viewport, options) => set((state) => ({ project: { ...state.project, view: { ...state.project.view, viewport, hasManualViewport: options?.manual ?? true } }, projectRevision: options?.manual ? state.projectRevision + 1 : state.projectRevision })),
  addNode: (type, position = { x: 200, y: 200 }) => set((state) => { const context = inferWizardContext(state.project, state.selectedNodeId, state.selectedEdgeId); const node = buildNode(type, position, state.project, { selectedNode: context.selectedNode, selectedEdge: context.selectedEdge, groupId: wizardSubtypeMap.get(type) }); const project = { ...state.project, nodes: [...state.project.nodes, node] }; return { project: logEvent(project, `Добавлен элемент «${node.data.visibleName}».`, node.id), selectedNodeId: node.id, issues: validateProject(project), projectRevision: state.projectRevision + 1 }; }),
  selectNode: (selectedNodeId) => set((state) => ({ selectedNodeId, selectedEdgeId: undefined, selectedMeasurementPointId: undefined, hoveredEdgeId: undefined, edgeEditorMode: undefined, pathSelection: computePathSelection(state.project, selectedNodeId, undefined) })),
  selectEdge: (selectedEdgeId) => set((state) => ({ selectedEdgeId, selectedNodeId: undefined, selectedMeasurementPointId: undefined, hoveredEdgeId: selectedEdgeId ?? state.hoveredEdgeId, edgeEditorMode: selectedEdgeId ? 'actions' : undefined, pathSelection: computePathSelection(state.project, undefined, selectedEdgeId) })),
  selectMeasurementPoint: (selectedMeasurementPointId) => set(() => ({ selectedMeasurementPointId, selectedNodeId: undefined, selectedEdgeId: undefined, hoveredEdgeId: undefined, edgeEditorMode: undefined, pathSelection: { upstream: [], downstream: [], edges: [] } })),
  addMeasurementPoint: (type, anchor) => set((state) => {
    const timestamp = new Date().toISOString();
    const anchorKind = anchor.nodeId ? 'node' : anchor.edgeId ? 'edge' : 'canvas';
    const shortTag = type === 'pressure' ? 'МН' : type === 'temperature' ? 'ТМ' : type === 'flow' ? 'РС' : 'КТ';
    const point: MeasurementPoint = {
      id: crypto.randomUUID(),
      type,
      shortTag,
      anchor: { kind: anchorKind, nodeId: anchor.nodeId, edgeId: anchor.edgeId, ratio: anchor.ratio ?? 0.5, x: anchor.x ?? 0, y: anchor.y ?? 0, offsetX: 14, offsetY: -14 },
      visible: true,
      enabled: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const project = { ...state.project, measurementPoints: [...state.project.measurementPoints, point] };
    return { project, selectedMeasurementPointId: point.id, selectedNodeId: undefined, selectedEdgeId: undefined, projectRevision: state.projectRevision + 1, issues: validateProject(project) };
  }),
  updateMeasurementPoint: (id, patch) => set((state) => {
    const project = {
      ...state.project,
      measurementPoints: state.project.measurementPoints.map((point) => point.id === id ? { ...point, ...patch, updatedAt: new Date().toISOString() } : point),
    };
    return { project, projectRevision: state.projectRevision + 1 };
  }),
  deleteMeasurementPoint: (id) => set((state) => {
    const project = { ...state.project, measurementPoints: state.project.measurementPoints.filter((point) => point.id !== id) };
    return { project, selectedMeasurementPointId: state.selectedMeasurementPointId === id ? undefined : state.selectedMeasurementPointId, projectRevision: state.projectRevision + 1 };
  }),
  updateNodeField: (nodeId, path, value) => set((state) => { const updatedRevision = state.projectRevision + 1; const project = reapplyDerivedState(normalizeProjectEdgeHandles({ ...state.project, nodes: state.project.nodes.map((node) => node.id !== nodeId ? node : (() => { const copy = structuredClone(node); setByPath(copy, path, value); syncNodePresentation(copy); return copy; })()) })); return { project, issues: validateProject(project), projectRevision: updatedRevision }; }),
  setSearch: (search) => set({ search }), setInspectorTab: (inspectorTab) => set({ inspectorTab }),
  setSimulationRunning: (running) => set((state) => {
    const currentStatus = state.project.simulation.status ?? (state.project.simulation.running ? 'running' : 'idle');
    const nextStatus: SimulationSettings['status'] = running
      ? 'running'
      : (currentStatus === 'running' ? 'paused' : currentStatus);
    if (state.project.simulation.running === running && currentStatus === nextStatus) return state;
    const nextEvent = running
      ? currentStatus === 'paused' ? 'Симуляция продолжена.' : 'Симуляция запущена.'
      : currentStatus === 'running' ? 'Симуляция на паузе.' : state.project.simulation.lastEvent;
    const freezeMotion = !running;
    return {
      project: {
        ...state.project,
        edges: state.project.edges.map((edge) => ({
          ...edge,
          animated: freezeMotion ? false : Boolean(edge.data?.flowActive),
        })),
        simulation: { ...state.project.simulation, running, status: nextStatus, lastEvent: nextEvent },
      },
      projectRevision: state.projectRevision + 1,
    };
  }),
  setSimulationSpeed: (speed) => set((state) => ({ project: { ...state.project, simulation: { ...state.project.simulation, speed } }, projectRevision: state.projectRevision + 1 })),
  setSimulationFluid: (fluid: SimulationSettings['fluid']) => set((state) => ({ project: { ...state.project, simulation: { ...state.project.simulation, fluid } }, projectRevision: state.projectRevision + 1 })),
  runFluidScenario: () => set((state) => ({ project: { ...state.project, simulation: { ...state.project.simulation, tick: 0, scenarioRevision: (state.project.simulation.scenarioRevision ?? 0) + 1, lastEvent: 'Сценарий жидкости запущен' } }, projectRevision: state.projectRevision + 1 })),
  resetSimulation: () => set((state) => {
    const project = cloneProject(state.project);
    project.simulation = { ...project.simulation, running: false, status: 'idle', tick: 0, warnings: [], activeMedium: 'none', totalActiveFlow: 0, lastEvent: 'Симуляция сброшена', scenarioRevision: project.simulation.scenarioRevision ?? 0 };
    project.edges = project.edges.map((edge) => ({ ...edge, animated: false, data: { mediumType: edge.data?.mediumType ?? edge.data?.medium ?? 'water', medium: edge.data?.medium ?? edge.data?.mediumType ?? 'water', flowLpm: 0, flowRate: 0, flowActive: false, blocked: false, routeState: 'idle', pressure: 0, directionMode: edge.data?.directionMode ?? 'derived', nominalDiameter: edge.data?.nominalDiameter ?? 'DN50', mediumMode: edge.data?.mediumMode ?? 'single', lineRole: edge.data?.lineRole ?? 'process', blockedBy: [], stateLabel: 'Ожидание', upstreamRef: edge.data?.upstreamRef, downstreamRef: edge.data?.downstreamRef, selectedPath: edge.data?.selectedPath, sourceLabel: edge.data?.sourceLabel, targetLabel: edge.data?.targetLabel, hovered: edge.data?.hovered, labelMode: edge.data?.labelMode, segmentId: edge.data?.segmentId, direction: edge.data?.direction, routeWarnings: [], composition: edge.data?.composition, mixedFlow: false, lengthM: edge.data?.lengthM ?? 12, innerDiameterMm: edge.data?.innerDiameterMm ?? 50, roughnessM: edge.data?.roughnessM ?? 0.000045, minorLossCoefficient: edge.data?.minorLossCoefficient ?? edge.data?.localResistanceZeta ?? 1.2, localResistanceZeta: edge.data?.localResistanceZeta ?? edge.data?.minorLossCoefficient ?? 1.2, hydraulicLossBar: 0, reynolds: 0, frictionFactor: 0, hydraulicConstraint: '', pumpHeadGainM: 0 } }));
    project.nodes = project.nodes.map((node) => ({ ...node, data: { ...node.data, status: node.data.visual.enabled ? (node.data.kind === 'pump' || node.data.kind === 'dosingPump' ? 'off' : 'idle') : 'disabled', alarms: [], visual: { ...node.data.visual, stateBadge: undefined }, runtime: { ...node.data.runtime, active: false, blocked: false, routeState: node.data.visual.enabled ? 'idle' : 'maintenance', flow: 0, flowLpm: 0, alarmText: '' }, simulation: { ...node.data.simulation, active: false, blocked: false, routeState: node.data.visual.enabled ? 'idle' : 'maintenance', flow: 0, flowLpm: 0, alarmText: '' } } }));
    return { project: logEvent(project, 'Симуляция сброшена.', undefined, 'info', 'simulation'), issues: validateProject(project), projectRevision: state.projectRevision + 1 };
  }),
  tickSimulation: (dt) => set((state) => {
    if ((state.project.simulation.status ?? toSimulationStatus(state.project.simulation.running)) !== 'running') return state;
    const result = runSimulationStep(state.project, dt);
    const simulation: SimulationSettings = {
      ...state.project.simulation,
      status: 'running',
      running: true,
      tick: state.project.simulation.tick + 1,
      warnings: result.warnings,
      activeMedium: result.activeMedium,
      totalActiveFlow: result.totalActiveFlow,
      lastEvent: result.lastEvent,
    };
    const project = limitedLog({ ...state.project, nodes: result.nodes, edges: result.edges, simulation, eventLog: [...state.project.eventLog, ...result.events] });
    return { project, issues: validateProject(project), projectRevision: state.projectRevision + 1 };
  }),
  resetProject: async () => { const state = get(); const project = { ...cloneProject(demoProject), id: state.project.id, name: `${state.project.name} — чистый проект`, appSchemaVersion: APP_SCHEMA_VERSION, projectSchemaVersion: PROJECT_SCHEMA_VERSION }; const revision = state.projectRevision + 1; set(sanitizeProjectState(project, revision, state.persistedRevision, state.viewportNonce + 1)); await persistRevisionNow(project, revision, 'manual'); },
  resetUserData: async () => { await clearUserData(); const project = cloneProject(demoProject); const revision = get().projectRevision + 1; set({ ...sanitizeProjectState(project, revision, revision, get().viewportNonce + 1), startupNotice: { type: 'info', message: 'Локальные проекты и восстановление вида удалены. Оболочка приложения сохранена.' } }); await persistRevisionNow(project, revision, 'manual'); },
  clearLocalDataAndLoadDemo: async () => { await clearPersistedState(); const project = cloneProject(demoProject); const revision = get().projectRevision + 1; set({ ...sanitizeProjectState(project, revision, revision, get().viewportNonce + 1), startupState: 'ready', startupError: undefined, startupNotice: { type: 'warning', message: 'Обнаружены данные старой версии. Выполнен безопасный сброс.' } }); await persistRevisionNow(project, revision, 'manual'); },
  newProject: () => { const revision = get().projectRevision + 1; set(sanitizeProjectState(cloneProject(templates['water-prep']), revision, get().persistedRevision, get().viewportNonce + 1)); },
  loadTemplate: async (templateId) => { const project = cloneProject(templates[templateId]); const revision = get().projectRevision + 1; set({ ...sanitizeProjectState(project, revision, revision, get().viewportNonce + 1), startupNotice: { type: 'info', message: `Загружен шаблон «${project.name}».` }, startupError: undefined }); await persistRevisionNow(project, revision, 'manual'); },
  saveProject: async () => { await flushPendingPersistence(); const state = get(); await persistRevisionNow(state.project, state.projectRevision, 'manual'); },
  loadProject: async (id) => { const stored = await loadStoredProject(id); if (stored.project) { const revision = get().projectRevision + 1; set({ ...sanitizeProjectState(stored.project, revision, revision, get().viewportNonce + 1), startupState: 'ready', startupError: undefined, startupNotice: stored.recovered ? { type: 'warning', message: 'Данные частично восстановлены.' } : undefined, persistenceStatus: 'saved', lastSavedAt: stored.project.updatedAt, persistenceError: undefined }); return; } if (stored.recovered) { await get().clearLocalDataAndLoadDemo(); return; } const project = cloneProject(demoProject); const revision = get().projectRevision + 1; set({ ...sanitizeProjectState(project, revision, revision, get().viewportNonce + 1), startupState: 'ready', startupError: undefined, persistenceStatus: 'saved', persistenceError: undefined }); await persistRevisionNow(project, revision, 'manual'); },
  exportProject: () => JSON.stringify(get().project, null, 2),
  importProject: (json) => { const project = restoreProjectDocument(JSON.parse(json)); set((state) => ({ ...sanitizeProjectState(project, state.projectRevision + 1, state.persistedRevision, state.viewportNonce + 1), startupState: 'ready', startupNotice: { type: 'info', message: 'Проект импортирован.' } })); },
  runValidation: () => set((state) => ({ issues: validateProject(state.project) })), toggleProblematicOnly: () => set((state) => ({ showProblematicOnly: !state.showProblematicOnly })), hoverEdge: (hoveredEdgeId) => set({ hoveredEdgeId }), setEdgeLabelMode: (edgeLabelMode) => set({ edgeLabelMode }),
  setPresentationMode: (presentationMode) => set((state) => {
    if (state.project.view.presentationMode === presentationMode) return state;
    return {
      project: { ...state.project, view: { ...state.project.view, presentationMode } },
      projectRevision: state.projectRevision + 1,
    };
  }),
  setSchematicManualNodePosition: (nodeId: string, position: { x: number; y: number }) => set((state) => {
    if (state.project.view.presentationMode !== 'schematic') return state;
    const schematicLayout = state.project.view.schematicLayout ?? { autoNodePositions: {}, manualNodePositions: {} };
    return {
      project: {
        ...state.project,
        view: {
          ...state.project.view,
          schematicLayout: {
            ...schematicLayout,
            manualNodePositions: { ...schematicLayout.manualNodePositions, [nodeId]: position },
          },
        },
      },
      projectRevision: state.projectRevision + 1,
    };
  }),
  resetSchematicNodeOverride: (nodeId: string) => set((state) => {
    const schematicLayout = state.project.view.schematicLayout ?? { autoNodePositions: {}, manualNodePositions: {} };
    if (!schematicLayout.manualNodePositions[nodeId]) return state;
    const nextManual = { ...schematicLayout.manualNodePositions };
    delete nextManual[nodeId];
    return {
      project: { ...state.project, view: { ...state.project.view, schematicLayout: { ...schematicLayout, manualNodePositions: nextManual } } },
      projectRevision: state.projectRevision + 1,
    };
  }),
  resetAllSchematicOverrides: () => set((state) => {
    const schematicLayout = state.project.view.schematicLayout ?? { autoNodePositions: {}, manualNodePositions: {} };
    if (!Object.keys(schematicLayout.manualNodePositions).length) return state;
    return {
      project: { ...state.project, view: { ...state.project.view, schematicLayout: { ...schematicLayout, manualNodePositions: {} } } },
      projectRevision: state.projectRevision + 1,
    };
  }),
  setSchematicAutoNodePositions: (positions: Record<string, { x: number; y: number }>) => set((state) => {
    if (state.project.view.presentationMode !== 'schematic') return state;
    const schematicLayout = state.project.view.schematicLayout ?? { autoNodePositions: {}, manualNodePositions: {} };
    const current = schematicLayout.autoNodePositions;
    const keys = Object.keys(positions);
    const unchanged = keys.length === Object.keys(current).length && keys.every((key) => current[key]?.x === positions[key]?.x && current[key]?.y === positions[key]?.y);
    if (unchanged) return state;
    return {
      project: { ...state.project, view: { ...state.project.view, schematicLayout: { ...schematicLayout, autoNodePositions: positions } } },
      projectRevision: state.projectRevision + 1,
    };
  }),
  loadSafeDemo: async () => { const project = cloneProject(demoProject); const revision = get().projectRevision + 1; set({ ...sanitizeProjectState(project, revision, revision, get().viewportNonce + 1), startupState: 'ready', startupError: undefined }); await persistRevisionNow(project, revision, 'manual'); },
  dismissStartupNotice: () => set({ startupNotice: undefined }), setStartupError: (startupError) => set({ startupError }),
  openEquipmentWizard: (options) => set((state) => {
    const groupId = options?.groupId ?? (options?.kind ? wizardSubtypeMap.get(options.kind) : undefined) ?? state.wizard.groupId ?? 'pumps';
    const kind = options?.kind ?? state.wizard.kind ?? (groupId ? [...wizardSubtypeMap.entries()].find(([, value]) => value === groupId)?.[0] : undefined) ?? 'pump';
    const context = inferWizardContext(state.project, state.selectedNodeId, state.selectedEdgeId);
    return { wizard: { open: true, groupId, kind, namingRule: context.namingRule, values: buildWizardInitialValues(state.project, groupId, kind, context) } };
  }),
  closeEquipmentWizard: () => set((state) => ({ wizard: { ...state.wizard, open: false } })),
  setWizardGroup: (groupId) => set((state) => {
    const kind = [...wizardSubtypeMap.entries()].find(([, value]) => value === groupId)?.[0] ?? 'pump';
    const context = inferWizardContext(state.project, state.selectedNodeId, state.selectedEdgeId);
    return { wizard: { ...state.wizard, open: true, groupId, kind, namingRule: context.namingRule, values: buildWizardInitialValues(state.project, groupId, kind, context) } };
  }),
  setWizardKind: (kind) => set((state) => {
    const groupId = wizardSubtypeMap.get(kind) ?? state.wizard.groupId ?? 'pumps';
    const context = inferWizardContext(state.project, state.selectedNodeId, state.selectedEdgeId);
    return { wizard: { ...state.wizard, open: true, groupId, kind, namingRule: context.namingRule, values: buildWizardInitialValues(state.project, groupId, kind, context) } };
  }),
  updateWizardValue: (key, value) => set((state) => ({ wizard: { ...state.wizard, values: { ...state.wizard.values, [key]: value } } })),
  regenerateWizardTag: () => set((state) => {
    if (!state.wizard.kind) return state;
    const context = inferWizardContext(state.project, state.selectedNodeId, state.selectedEdgeId);
    return { wizard: { ...state.wizard, values: { ...state.wizard.values, technicalTag: generateTechnicalTag(state.project, state.wizard.kind, context.namingRule) }, namingRule: context.namingRule } };
  }),
  createEquipmentFromWizard: () => set((state) => {
    const { groupId, kind, values } = state.wizard;
    if (!groupId || !kind) return state;
    const selectedNode = state.project.nodes.find((node) => node.id === state.selectedNodeId);
    const selectedEdge = state.project.edges.find((edge) => edge.id === state.selectedEdgeId);
    const position = selectedEdge ? (() => {
      const source = state.project.nodes.find((node) => node.id === selectedEdge.source);
      const target = state.project.nodes.find((node) => node.id === selectedEdge.target);
      return source && target ? midPoint(source, target) : { x: 280, y: 220 };
    })() : selectedNode ? { x: selectedNode.position.x + 220, y: selectedNode.position.y } : { x: 280, y: 220 };
    let node = buildNode(kind, position, state.project, { selectedNode, selectedEdge, groupId });
    node = applyWizardValuesToNode(node, values);
    const updatedRevision = state.projectRevision + 1;
    const project = reapplyDerivedState({ ...state.project, nodes: [...state.project.nodes, node] });
    return { project: logEvent(project, `Добавлен элемент «${node.data.visibleName}» через мастер.`, node.id), selectedNodeId: node.id, selectedEdgeId: undefined, wizard: { ...state.wizard, open: false }, issues: validateProject(project), projectRevision: updatedRevision, inspectorTab: 'main' };
  }),

  updateEdgeField: (edgeId, field, value) => set((state) => { const updatedRevision = state.projectRevision + 1; const project = reapplyDerivedState({ ...state.project, edges: state.project.edges.map((edge) => { if (edge.id !== edgeId) return edge; const data: any = { ...(edge.data ?? {}) }; data[field] = value; if (field === 'mediumType') { data.medium = value as any; data.composition = { [value as string]: 1 }; data.mixedFlow = false; } if (field === 'flowLpm') data.flowRate = Number(value); if (field === 'directionMode' && value !== 'derived') data.direction = value; if (field === 'innerDiameterMm') data.nominalDiameter = `DN${Math.max(1, Math.round(Number(value) || 0))}`; if (field === 'localResistanceZeta') data.minorLossCoefficient = Number(value); if (field === 'minorLossCoefficient') data.localResistanceZeta = Number(value); return { ...edge, data } as SoapEdge; }) }); return { project, issues: validateProject(project), projectRevision: updatedRevision }; }),
  executeNodeAction: (nodeId, action) => set((state) => {
    const result = executeNodeCommand(state.project, nodeId, action);
    if (!result.changed) return state;
    const updatedRevision = state.projectRevision + 1;
    const project = reapplyDerivedState(result.project);
    return { project, issues: validateProject(project), projectRevision: updatedRevision, lastCommand: result.lastCommand };
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
    if (!activeEdgeId) return state;
    const result = insertNodeTopology(state.project, activeEdgeId, kind);
    if (!result) return state;
    const updatedRevision = state.projectRevision + 1;
    const project = reapplyDerivedState(result.project);
    return { project, selectedNodeId: result.nodeId, selectedEdgeId: undefined, edgeEditorMode: undefined, pathSelection: computePathSelection(project, result.nodeId, undefined), issues: validateProject(project), projectRevision: updatedRevision, lastCommand: `insert:${kind}` };
  }),
  createBranchFromEdge: (kind = 'tee', edgeId) => set((state) => {
    const activeEdgeId = edgeId ?? state.selectedEdgeId;
    if (!activeEdgeId) return state;
    const result = createBranchTopology(state.project, activeEdgeId, kind);
    if (!result) return state;
    const updatedRevision = state.projectRevision + 1;
    const project = reapplyDerivedState(result.project);
    return { project, selectedNodeId: result.nodeId, selectedEdgeId: undefined, edgeEditorMode: undefined, pathSelection: computePathSelection(project, result.nodeId, undefined), issues: validateProject(project), projectRevision: updatedRevision, lastCommand: `branch:${kind}` };
  }),
  removeSelectedSegment: (edgeId) => set((state) => {
    const activeEdgeId = edgeId ?? state.selectedEdgeId;
    if (!activeEdgeId) return state; const updatedRevision = state.projectRevision + 1; const project = reapplyDerivedState(removeSegment(state.project, activeEdgeId)); return { project, selectedEdgeId: state.selectedEdgeId === activeEdgeId ? undefined : state.selectedEdgeId, edgeEditorMode: state.selectedEdgeId === activeEdgeId ? undefined : state.edgeEditorMode, issues: validateProject(project), projectRevision: updatedRevision, lastCommand: 'edge:delete' };
  }),
  reconnectSelectedEdge: (edgeId) => set((state) => {
    const activeEdgeId = edgeId ?? state.selectedEdgeId;
    if (!activeEdgeId) return state;
    const project = reconnectSegment(state.project, activeEdgeId);
    if (!project) return state;
    const updatedRevision = state.projectRevision + 1;
    const liveProject = reapplyDerivedState(project);
    return { project: liveProject, issues: validateProject(liveProject), projectRevision: updatedRevision, lastCommand: 'edge:reconnect' };
  }),
  openLibraryPicker: (mode, context) => set({ libraryPicker: { open: true, mode, context } }),
  closeLibraryPicker: () => set((state) => ({ libraryPicker: { ...state.libraryPicker, open: false, context: undefined } })),
  insertFromLibrary: (kind) => {
    const state = get();
    const edgeId = state.libraryPicker.mode === 'context-insert' ? state.libraryPicker.context?.edgeId : undefined;
    if (edgeId) state.insertNodeIntoEdge(kind, edgeId);
    else state.addNode(kind);
    get().closeLibraryPicker();
  },
}));

useAppStore.subscribe((state, previous) => {
  if (state.startupState !== 'ready') return;
  if (state.projectRevision === previous.projectRevision) return;
  if (state.projectRevision === state.persistedRevision) return;
  scheduleSafePersist(state.project, state.projectRevision);
});

if (typeof window !== 'undefined') {
  const flushOnBackground = () => { void flushPendingPersistence(); };
  window.addEventListener('pagehide', flushOnBackground);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushOnBackground();
  });
}

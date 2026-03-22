import { componentMap } from '../registry/componentRegistry';
import { demoProject } from '../templates/templates';
import { getHandleIds, normalizeProjectEdgeHandles } from '../flow/handles';
import { EventLogEntry, MediumType, ProjectDocument, ProjectViewState, RouteState, Severity, SimulationSettings, SoapEdge, SoapNode, SoapNodeData, SoapNodeKind, TemplateId, TemplateViewMetadata, ValidationIssue } from '../schemas/types';

const TEMPLATE_IDS = new Set(['water-prep', 'soap-line', 'cip-fragment'] as const);
const MEDIUM_TYPES = new Set<MediumType>(['water', 'product', 'cip', 'waste']);
const ROUTE_STATES = new Set<RouteState>(['idle', 'primed', 'flowing', 'blocked', 'starved', 'draining', 'cip', 'alarm', 'offline']);
const NODE_KINDS = new Set<SoapNodeKind>(componentMap.keys() as Iterable<SoapNodeKind>);
const STATUSES = new Set(['normal', 'active', 'warning', 'alarm', 'disabled']);

const TOPOLOGY_NODES = new Set<SoapNodeKind>(['tee', 'cross', 'collector', 'splitter', 'mixingJunction', 'drainBranch', 'samplePoint']);
const MERGE_NODES = new Set<SoapNodeKind>(['collector', 'mixingJunction', 'cross']);
const BRANCH_NODES = new Set<SoapNodeKind>(['tee', 'cross', 'splitter', 'drainBranch']);

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const asString = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;
const asBoolean = (value: unknown, fallback = false) => typeof value === 'boolean' ? value : fallback;
const asNumber = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const asSeverity = (value: unknown, fallback: Severity = 'info'): Severity => value === 'warning' || value === 'error' || value === 'info' ? value : fallback;
const asMedium = (value: unknown, fallback: MediumType = 'water'): MediumType => typeof value === 'string' && MEDIUM_TYPES.has(value as MediumType) ? value as MediumType : fallback;
const asRouteState = (value: unknown, fallback: RouteState = 'idle'): RouteState => typeof value === 'string' && ROUTE_STATES.has(value as RouteState) ? value as RouteState : fallback;

const sanitizeViewport = (value: unknown) => {
  const viewport = isObject(value) ? value : {};
  return { x: asNumber(viewport.x, 60), y: asNumber(viewport.y, 40), zoom: Math.min(2, Math.max(0.2, asNumber(viewport.zoom, 0.82))) };
};

const sanitizeTemplateViewMetadata = (value: unknown, fallback: TemplateViewMetadata): TemplateViewMetadata => {
  const view = isObject(value) ? value : {};
  const center = isObject(view.center) ? view.center : {};
  const focusBounds = isObject(view.focusBounds) ? view.focusBounds : undefined;
  return {
    defaultZoom: Math.min(2, Math.max(0.2, asNumber(view.defaultZoom, fallback.defaultZoom))),
    minZoom: Math.min(2, Math.max(0.2, asNumber(view.minZoom, fallback.minZoom ?? fallback.defaultZoom))),
    maxZoom: Math.min(2, Math.max(0.2, asNumber(view.maxZoom, fallback.maxZoom ?? fallback.defaultZoom))),
    preferredPadding: Math.min(0.35, Math.max(0.04, asNumber(view.preferredPadding, fallback.preferredPadding))),
    center: { x: asNumber(center.x, fallback.center.x), y: asNumber(center.y, fallback.center.y) },
    focusNodeId: typeof view.focusNodeId === 'string' ? view.focusNodeId : fallback.focusNodeId,
    focusBounds: focusBounds ? { x: asNumber(focusBounds.x, fallback.focusBounds?.x ?? 0), y: asNumber(focusBounds.y, fallback.focusBounds?.y ?? 0), width: Math.max(80, asNumber(focusBounds.width, fallback.focusBounds?.width ?? 240)), height: Math.max(80, asNumber(focusBounds.height, fallback.focusBounds?.height ?? 240)) } : fallback.focusBounds,
  };
};

const sanitizeView = (value: unknown, fallback: ProjectViewState): ProjectViewState => ({ viewport: sanitizeViewport(isObject(value) ? value.viewport : undefined), metadata: sanitizeTemplateViewMetadata(isObject(value) ? value.metadata : undefined, fallback.metadata), hasManualViewport: asBoolean(isObject(value) ? value.hasManualViewport : undefined, fallback.hasManualViewport) });
const sanitizeSimulation = (value: unknown, fallback: SimulationSettings): SimulationSettings => ({ running: asBoolean(isObject(value) ? value.running : undefined, false), speed: Math.min(3, Math.max(0.5, asNumber(isObject(value) ? value.speed : undefined, fallback.speed))), tick: Math.max(0, asNumber(isObject(value) ? value.tick : undefined, fallback.tick)), warnings: Array.isArray(isObject(value) ? value.warnings : undefined) ? (value as any).warnings.filter((item: unknown) => typeof item === 'string').slice(0, 50) : fallback.warnings, activeMedium: (isObject(value) && (value.activeMedium === 'mixed' || value.activeMedium === 'none')) ? value.activeMedium as any : asMedium(isObject(value) ? value.activeMedium : undefined, fallback.activeMedium === 'mixed' || fallback.activeMedium === 'none' ? 'water' : fallback.activeMedium), totalActiveFlow: Math.max(0, asNumber(isObject(value) ? value.totalActiveFlow : undefined, fallback.totalActiveFlow)), lastEvent: asString(isObject(value) ? value.lastEvent : undefined, fallback.lastEvent) });
const sanitizeEventLog = (value: unknown, fallback: EventLogEntry[]) => Array.isArray(value) ? value.filter(isObject).map((entry, index) => ({ id: asString(entry.id, `event-${index}`), timestamp: asString(entry.timestamp, new Date().toISOString()), type: asString(entry.type, 'restore'), message: asString(entry.message, 'Восстановлено состояние проекта'), severity: asSeverity(entry.severity), targetId: typeof entry.targetId === 'string' ? entry.targetId : undefined })).slice(-80) : fallback;

const sanitizeNode = (value: unknown): SoapNode | null => {
  if (!isObject(value) || typeof value.id !== 'string' || !isObject(value.position) || !isObject(value.data)) return null;
  const kind = typeof value.data.kind === 'string' && NODE_KINDS.has(value.data.kind as SoapNodeKind) ? value.data.kind as SoapNodeKind : undefined;
  if (!kind) return null;
  const definition = componentMap.get(kind);
  if (!definition) return null;
  const visual = isObject(value.data.visual) ? value.data.visual : {};
  const ports = isObject(value.data.ports) ? value.data.ports : {};
  const simulation = isObject(value.data.simulation) ? value.data.simulation : {};
  const process = isObject(value.data.process) ? value.data.process : {};
  const sanitizedData: SoapNodeData = {
    ...structuredClone(definition.defaults),
    kind,
    visibleName: asString(value.data.visibleName ?? value.data.label, definition.label),
    shortName: asString(value.data.shortName, definition.shortName),
    technicalTag: asString(value.data.technicalTag ?? value.data.tag, `${definition.technicalPrefix}-101`),
    category: asString(value.data.category, definition.category),
    description: asString(value.data.description, definition.description),
    className: definition.className,
    status: typeof value.data.status === 'string' && STATUSES.has(value.data.status) ? value.data.status as SoapNodeData['status'] : definition.defaults.status,
    rotation: asNumber(value.data.rotation, definition.defaults.rotation),
    medium: asMedium(value.data.medium, definition.defaults.medium),
    notes: asString(value.data.notes, ''),
    process: Object.fromEntries(Object.entries(process).filter(([, entry]) => ['string', 'number', 'boolean'].includes(typeof entry))) as Record<string, string | number | boolean>,
    visual: { accent: asString(visual.accent, definition.defaults.visual.accent), fill: Math.min(100, Math.max(0, asNumber(visual.fill, definition.defaults.visual.fill))), enabled: asBoolean(visual.enabled, definition.defaults.visual.enabled), semanticSize: ['major', 'line', 'valve', 'instrument', 'topology'].includes(String(visual.semanticSize)) ? visual.semanticSize as any : definition.defaults.visual.semanticSize, showLabel: asBoolean(visual.showLabel, definition.defaults.visual.showLabel) },
    ports: { inputs: Math.max(0, Math.round(asNumber(ports.inputs, definition.defaults.ports.inputs))), outputs: Math.max(0, Math.round(asNumber(ports.outputs, definition.defaults.ports.outputs))), preferredDirection: ports.preferredDirection === 'ttb' ? 'ttb' : 'ltr', inline: asBoolean(ports.inline, definition.defaults.ports.inline) },
    simulation: { enabled: asBoolean(simulation.enabled, definition.defaults.simulation.enabled), active: asBoolean(simulation.active, definition.defaults.simulation.active), blocked: asBoolean(simulation.blocked, definition.defaults.simulation.blocked), routeState: asRouteState(simulation.routeState, definition.defaults.simulation.routeState), flow: Math.max(0, asNumber(simulation.flow, definition.defaults.simulation.flow)), lastEvent: typeof simulation.lastEvent === 'string' ? simulation.lastEvent : definition.defaults.simulation.lastEvent, alarmText: typeof simulation.alarmText === 'string' ? simulation.alarmText : definition.defaults.simulation.alarmText },
  };
  return { id: value.id, type: 'processNode', position: { x: asNumber(value.position.x, 0), y: asNumber(value.position.y, 0) }, data: sanitizedData };
};

const sanitizeEdge = (value: unknown, nodeIds: Set<string>): SoapEdge | null => {
  if (!isObject(value) || typeof value.id !== 'string' || typeof value.source !== 'string' || typeof value.target !== 'string') return null;
  if (!nodeIds.has(value.source) || !nodeIds.has(value.target)) return null;
  const edgeData = isObject(value.data) ? value.data : {};
  return { id: value.id, source: value.source, target: value.target, sourceHandle: typeof value.sourceHandle === 'string' ? value.sourceHandle : null, targetHandle: typeof value.targetHandle === 'string' ? value.targetHandle : null, type: 'flowEdge', animated: asBoolean(value.animated, false), markerEnd: value.markerEnd as SoapEdge['markerEnd'], data: { medium: asMedium(edgeData.medium, 'water'), flowActive: asBoolean(edgeData.flowActive, false), blocked: asBoolean(edgeData.blocked, false), routeState: asRouteState(edgeData.routeState, 'idle'), flowRate: Math.max(0, asNumber(edgeData.flowRate, 0)), pressure: asNumber(edgeData.pressure, 0), selectedPath: asBoolean(edgeData.selectedPath, false), sourceLabel: typeof edgeData.sourceLabel === 'string' ? edgeData.sourceLabel : undefined, targetLabel: typeof edgeData.targetLabel === 'string' ? edgeData.targetLabel : undefined, blockedBy: Array.isArray(edgeData.blockedBy) ? edgeData.blockedBy.filter((item): item is string => typeof item === 'string') : undefined, segmentId: asString(edgeData.segmentId, value.id), direction: edgeData.direction === 'reverse' || edgeData.direction === 'bidirectional' ? edgeData.direction : 'forward', nominalDiameter: asString(edgeData.nominalDiameter, 'DN50'), stateLabel: asString(edgeData.stateLabel, 'Ожидание') } };
};

export const restoreProjectDocument = (value: unknown): ProjectDocument => {
  if (!isObject(value)) throw new Error('Сохранённый проект не является объектом.');
  const fallback = structuredClone(demoProject);
  const nodes = Array.isArray(value.nodes) ? value.nodes.map(sanitizeNode).filter((n): n is SoapNode => n !== null) : [];
  if (!nodes.length) throw new Error('Сохранённый проект не содержит корректных узлов.');
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = Array.isArray(value.edges) ? value.edges.map((edge) => sanitizeEdge(edge, nodeIds)).filter((e): e is SoapEdge => e !== null) : [];
  const templateId: TemplateId = typeof value.templateId === 'string' && TEMPLATE_IDS.has(value.templateId as TemplateId) ? value.templateId as TemplateId : fallback.templateId;
  return normalizeProjectEdgeHandles({ id: asString(value.id, fallback.id), name: asString(value.name, fallback.name), templateId, updatedAt: asString(value.updatedAt, new Date().toISOString()), appSchemaVersion: asNumber(value.appSchemaVersion, fallback.appSchemaVersion), projectSchemaVersion: asNumber(value.projectSchemaVersion, fallback.projectSchemaVersion), nodes, edges, view: sanitizeView(value.view, fallback.view), simulation: sanitizeSimulation(value.simulation, fallback.simulation), eventLog: sanitizeEventLog(value.eventLog, fallback.eventLog) });
};

export const validateProject = (project: ProjectDocument): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const incoming = new Map<string, SoapEdge[]>();
  const outgoing = new Map<string, SoapEdge[]>();
  project.edges.forEach((edge) => {
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge]);
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
  });

  project.nodes.forEach((node) => {
    const inputs = incoming.get(node.id) ?? [];
    const outputs = outgoing.get(node.id) ?? [];
    if (node.data.kind === 'source' && outputs.length === 0) issues.push({ id: `source-${node.id}`, severity: 'warning', message: `Источник «${node.data.visibleName}» не имеет выходящей линии.`, nodeIds: [node.id] });
    if ((node.data.kind === 'consumer' || node.data.kind === 'utilityDrain' || node.data.kind === 'fillingStation') && inputs.length === 0) issues.push({ id: `sink-${node.id}`, severity: 'warning', message: `Приёмник «${node.data.visibleName}» не подключён по входу.`, nodeIds: [node.id] });
    if (!['source', 'consumer', 'utilityDrain', 'fillingStation'].includes(node.data.kind) && inputs.length + outputs.length === 0) issues.push({ id: `isolated-${node.id}`, severity: 'error', message: `Элемент «${node.data.visibleName}» не подключён к процессу.`, nodeIds: [node.id] });
    if (node.data.className === 'valve' && inputs.length + outputs.length < 2) issues.push({ id: `valve-${node.id}`, severity: 'error', message: `Арматура «${node.data.visibleName}» должна стоять на реальной линии.`, nodeIds: [node.id] });
    if (node.data.className === 'instrument' && inputs.length + outputs.length < 1) issues.push({ id: `instrument-${node.id}`, severity: 'warning', message: `КИП «${node.data.visibleName}» не привязан к линии или аппарату.`, nodeIds: [node.id] });
    if (BRANCH_NODES.has(node.data.kind) && outputs.length < 2) issues.push({ id: `branch-${node.id}`, severity: 'warning', message: `Узел «${node.data.visibleName}» ожидает минимум две выходящие ветви.`, nodeIds: [node.id] });
    if (MERGE_NODES.has(node.data.kind) && inputs.length < 2) issues.push({ id: `merge-${node.id}`, severity: 'warning', message: `Узел «${node.data.visibleName}» ожидает минимум две входящие линии.`, nodeIds: [node.id] });

    const incomingHandleIds = new Map<string, number>();
    const outgoingHandleIds = new Map<string, number>();
    inputs.forEach((edge) => {
      if (edge.targetHandle) incomingHandleIds.set(edge.targetHandle, (incomingHandleIds.get(edge.targetHandle) ?? 0) + 1);
    });
    outputs.forEach((edge) => {
      if (edge.sourceHandle) outgoingHandleIds.set(edge.sourceHandle, (outgoingHandleIds.get(edge.sourceHandle) ?? 0) + 1);
    });
    getHandleIds(node, 'target').forEach((handleId) => {
      if ((incomingHandleIds.get(handleId) ?? 0) > 1) issues.push({ id: `target-handle-${node.id}-${handleId}`, severity: 'error', message: `Входной порт «${handleId}» узла «${node.data.visibleName}» подключён более одного раза.`, nodeIds: [node.id] });
    });
    getHandleIds(node, 'source').forEach((handleId) => {
      if ((outgoingHandleIds.get(handleId) ?? 0) > 1) issues.push({ id: `source-handle-${node.id}-${handleId}`, severity: 'error', message: `Выходной порт «${handleId}» узла «${node.data.visibleName}» подключён более одного раза.`, nodeIds: [node.id] });
    });
  });

  project.edges.forEach((edge) => {
    const src = project.nodes.find((node) => node.id === edge.source);
    const dst = project.nodes.find((node) => node.id === edge.target);
    if (!src || !dst) {
      issues.push({ id: `dangling-${edge.id}`, severity: 'error', message: `Сегмент ${edge.id} потерял источник или приёмник.`, edgeIds: [edge.id] });
      return;
    }
    if ((incoming.get(dst.id)?.length ?? 0) > 1 && !MERGE_NODES.has(dst.data.kind)) issues.push({ id: `ambiguous-merge-${edge.id}`, severity: 'error', message: `Слияние в «${dst.data.visibleName}» допускается только через явный трубный узел.`, edgeIds: [edge.id], nodeIds: [dst.id] });
    if ((outgoing.get(src.id)?.length ?? 0) > 1 && !BRANCH_NODES.has(src.data.kind)) issues.push({ id: `ambiguous-branch-${edge.id}`, severity: 'error', message: `Ответвление из «${src.data.visibleName}» допускается только через тройник, крестовину или распределительный узел.`, edgeIds: [edge.id], nodeIds: [src.id] });
    if (src.position.x > dst.position.x + 160 && src.data.ports.preferredDirection === 'ltr') issues.push({ id: `direction-${edge.id}`, severity: 'info', message: `Сегмент «${src.data.shortName} → ${dst.data.shortName}» идёт против основной оси и может ухудшать читаемость.`, edgeIds: [edge.id] });
    if (src.data.className === 'topology' && dst.data.className === 'topology' && !TOPOLOGY_NODES.has(src.data.kind)) issues.push({ id: `topology-${edge.id}`, severity: 'warning', message: `Проверьте корректность цепочки трубных узлов между «${src.data.visibleName}» и «${dst.data.visibleName}».`, edgeIds: [edge.id] });
  });
  return issues;
};

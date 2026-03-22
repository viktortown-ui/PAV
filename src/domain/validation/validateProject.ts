import { componentMap } from '../registry/componentRegistry';
import { demoProject } from '../templates/templates';
import { EventLogEntry, MediumType, ProjectDocument, ProjectViewState, RouteState, Severity, SimulationSettings, SoapEdge, SoapNode, SoapNodeData, SoapNodeKind, TemplateId, TemplateViewMetadata, ValidationIssue } from '../schemas/types';

const TEMPLATE_IDS = new Set(['water-prep', 'soap-line', 'cip-fragment'] as const);
const MEDIUM_TYPES = new Set<MediumType>(['water', 'product', 'cip', 'waste']);
const ROUTE_STATES = new Set<RouteState>(['idle', 'primed', 'flowing', 'blocked', 'starved', 'draining', 'cip', 'alarm', 'offline']);
const NODE_KINDS = new Set<SoapNodeKind>(['inlet', 'filter', 'ro', 'tank', 'reactor', 'heatedReactor', 'pump', 'valve', 'sensor', 'filling', 'drain']);
const STATUSES = new Set(['normal', 'active', 'warning', 'alarm', 'disabled']);
const PERSISTENCE_SCHEMA_VERSION = 3;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const asString = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;
const asBoolean = (value: unknown, fallback = false) => typeof value === 'boolean' ? value : fallback;
const asNumber = (value: unknown, fallback = 0) => isFiniteNumber(value) ? value : fallback;
const asSeverity = (value: unknown, fallback: Severity = 'info'): Severity => value === 'warning' || value === 'error' || value === 'info' ? value : fallback;
const asMedium = (value: unknown, fallback: MediumType = 'water'): MediumType => typeof value === 'string' && MEDIUM_TYPES.has(value as MediumType) ? value as MediumType : fallback;
const asRouteState = (value: unknown, fallback: RouteState = 'idle'): RouteState => typeof value === 'string' && ROUTE_STATES.has(value as RouteState) ? value as RouteState : fallback;

const sanitizeViewport = (value: unknown) => {
  const viewport = isObject(value) ? value : {};
  return {
    x: asNumber(viewport.x, 60),
    y: asNumber(viewport.y, 40),
    zoom: Math.min(2, Math.max(0.2, asNumber(viewport.zoom, 0.82))),
  };
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
    focusBounds: focusBounds ? {
      x: asNumber(focusBounds.x, fallback.focusBounds?.x ?? fallback.center.x - 120),
      y: asNumber(focusBounds.y, fallback.focusBounds?.y ?? fallback.center.y - 120),
      width: Math.max(80, asNumber(focusBounds.width, fallback.focusBounds?.width ?? 240)),
      height: Math.max(80, asNumber(focusBounds.height, fallback.focusBounds?.height ?? 240)),
    } : fallback.focusBounds,
  };
};

const sanitizeView = (value: unknown, fallback: ProjectViewState): ProjectViewState => {
  const view = isObject(value) ? value : {};
  return {
    viewport: sanitizeViewport(view.viewport),
    metadata: sanitizeTemplateViewMetadata(view.metadata, fallback.metadata),
    hasManualViewport: asBoolean(view.hasManualViewport, fallback.hasManualViewport),
  };
};

const sanitizeSimulation = (value: unknown, fallback: SimulationSettings): SimulationSettings => {
  const simulation = isObject(value) ? value : {};
  return {
    running: asBoolean(simulation.running, false),
    speed: Math.min(3, Math.max(0.5, asNumber(simulation.speed, fallback.speed))),
    tick: Math.max(0, asNumber(simulation.tick, fallback.tick)),
    warnings: Array.isArray(simulation.warnings) ? simulation.warnings.filter((warning): warning is string => typeof warning === 'string').slice(0, 50) : fallback.warnings,
    activeMedium: simulation.activeMedium === 'mixed' || simulation.activeMedium === 'none' ? simulation.activeMedium : asMedium(simulation.activeMedium, fallback.activeMedium === 'mixed' || fallback.activeMedium === 'none' ? 'water' : fallback.activeMedium),
    totalActiveFlow: Math.max(0, asNumber(simulation.totalActiveFlow, fallback.totalActiveFlow)),
    lastEvent: asString(simulation.lastEvent, fallback.lastEvent),
  };
};

const sanitizeEventLog = (value: unknown, fallback: EventLogEntry[]) => {
  if (!Array.isArray(value)) return fallback;
  return value
    .filter(isObject)
    .map((entry, index) => ({
      id: asString(entry.id, `event-${index}`),
      timestamp: asString(entry.timestamp, new Date().toISOString()),
      type: asString(entry.type, 'restore'),
      message: asString(entry.message, 'Восстановлено состояние проекта'),
      severity: asSeverity(entry.severity),
      targetId: typeof entry.targetId === 'string' ? entry.targetId : undefined,
    }))
    .slice(-80);
};

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
    label: asString(value.data.label, definition.label),
    shortName: asString(value.data.shortName, definition.shortName),
    tag: asString(value.data.tag, definition.defaults.tag),
    category: asString(value.data.category, definition.category),
    description: asString(value.data.description, definition.description),
    status: typeof value.data.status === 'string' && STATUSES.has(value.data.status) ? value.data.status as SoapNodeData['status'] : definition.defaults.status,
    rotation: asNumber(value.data.rotation, definition.defaults.rotation),
    medium: asMedium(value.data.medium, definition.defaults.medium),
    process: Object.fromEntries(Object.entries(process).filter(([, entry]) => ['string', 'number', 'boolean'].includes(typeof entry))) as Record<string, string | number | boolean>,
    visual: {
      accent: asString(visual.accent, definition.defaults.visual.accent),
      fill: Math.min(100, Math.max(0, asNumber(visual.fill, definition.defaults.visual.fill))),
      enabled: asBoolean(visual.enabled, definition.defaults.visual.enabled),
      semanticSize: visual.semanticSize === 'inline' || visual.semanticSize === 'instrument' || visual.semanticSize === 'main' ? visual.semanticSize : definition.defaults.visual.semanticSize,
      showLabel: asBoolean(visual.showLabel, definition.defaults.visual.showLabel),
    },
    ports: {
      inputs: Math.max(0, Math.round(asNumber(ports.inputs, definition.defaults.ports.inputs))),
      outputs: Math.max(0, Math.round(asNumber(ports.outputs, definition.defaults.ports.outputs))),
    },
    simulation: {
      enabled: asBoolean(simulation.enabled, definition.defaults.simulation.enabled),
      active: asBoolean(simulation.active, definition.defaults.simulation.active),
      blocked: asBoolean(simulation.blocked, definition.defaults.simulation.blocked),
      routeState: asRouteState(simulation.routeState, definition.defaults.simulation.routeState),
      flow: Math.max(0, asNumber(simulation.flow, definition.defaults.simulation.flow)),
      lastEvent: typeof simulation.lastEvent === 'string' ? simulation.lastEvent : definition.defaults.simulation.lastEvent,
      alarmText: typeof simulation.alarmText === 'string' ? simulation.alarmText : definition.defaults.simulation.alarmText,
    },
  };

  return {
    id: value.id,
    type: value.type === 'processNode' ? 'processNode' : 'processNode',
    position: { x: asNumber(value.position.x, 0), y: asNumber(value.position.y, 0) },
    data: sanitizedData,
  };
};

const sanitizeEdge = (value: unknown, nodeIds: Set<string>): SoapEdge | null => {
  if (!isObject(value) || typeof value.id !== 'string' || typeof value.source !== 'string' || typeof value.target !== 'string') return null;
  if (!nodeIds.has(value.source) || !nodeIds.has(value.target)) return null;
  const edgeData = isObject(value.data) ? value.data : {};
  return {
    id: value.id,
    source: value.source,
    target: value.target,
    type: 'flowEdge',
    animated: asBoolean(value.animated, false),
    markerEnd: isObject(value.markerEnd) ? value.markerEnd as SoapEdge['markerEnd'] : undefined,
    data: {
      medium: asMedium(edgeData.medium, 'water'),
      flowActive: asBoolean(edgeData.flowActive, false),
      blocked: asBoolean(edgeData.blocked, false),
      routeState: asRouteState(edgeData.routeState, 'idle'),
      flowRate: Math.max(0, asNumber(edgeData.flowRate, 0)),
      pressure: asNumber(edgeData.pressure, 0),
      selectedPath: asBoolean(edgeData.selectedPath, false),
      sourceLabel: typeof edgeData.sourceLabel === 'string' ? edgeData.sourceLabel : undefined,
      targetLabel: typeof edgeData.targetLabel === 'string' ? edgeData.targetLabel : undefined,
      blockedBy: Array.isArray(edgeData.blockedBy) ? edgeData.blockedBy.filter((item): item is string => typeof item === 'string') : undefined,
    },
  };
};

export const restoreProjectDocument = (value: unknown): ProjectDocument => {
  if (!isObject(value)) throw new Error('Сохранённый проект не является объектом.');

  const fallback = structuredClone(demoProject);
  const nodes = Array.isArray(value.nodes) ? value.nodes.map(sanitizeNode).filter((node): node is SoapNode => node !== null) : [];
  if (!nodes.length) throw new Error('Сохранённый проект не содержит корректных узлов.');
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = Array.isArray(value.edges) ? value.edges.map((edge) => sanitizeEdge(edge, nodeIds)).filter((edge): edge is SoapEdge => edge !== null) : [];

  const templateId: TemplateId = typeof value.templateId === 'string' && TEMPLATE_IDS.has(value.templateId as TemplateId) ? value.templateId as TemplateId : fallback.templateId;
  const restored: ProjectDocument = {
    id: asString(value.id, fallback.id),
    name: asString(value.name, fallback.name),
    templateId,
    updatedAt: asString(value.updatedAt, new Date().toISOString()),
    nodes,
    edges,
    view: sanitizeView(value.view, fallback.view),
    simulation: sanitizeSimulation(value.simulation, fallback.simulation),
    eventLog: sanitizeEventLog(value.eventLog, fallback.eventLog),
  };

  return restored;
};

export const getPersistenceSchemaVersion = () => PERSISTENCE_SCHEMA_VERSION;

export const validateProject = (project: ProjectDocument): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();

  project.edges.forEach((edge) => {
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
    outgoing.set(edge.source, (outgoing.get(edge.source) ?? 0) + 1);
  });

  project.nodes.forEach((node) => {
    const inCount = incoming.get(node.id) ?? 0;
    const outCount = outgoing.get(node.id) ?? 0;
    if (node.data.kind === 'inlet' && outCount === 0) issues.push({ id: `source-${node.id}`, severity: 'warning', message: `Источник «${node.data.label}» не имеет выходящей линии.`, nodeIds: [node.id] });
    if ((node.data.kind === 'filling' || node.data.kind === 'drain') && inCount === 0) issues.push({ id: `sink-${node.id}`, severity: 'warning', message: `Приёмник «${node.data.label}» не подключён по входу.`, nodeIds: [node.id] });
    if (!['inlet', 'filling', 'drain'].includes(node.data.kind) && inCount + outCount === 0) issues.push({ id: `isolated-${node.id}`, severity: 'error', message: `Элемент «${node.data.label}» не подключён к процессу.`, nodeIds: [node.id] });
    if (node.data.kind === 'valve' && inCount + outCount < 2) issues.push({ id: `valve-${node.id}`, severity: 'error', message: `Клапан «${node.data.label}» должен стоять на реальной линии.`, nodeIds: [node.id] });
    if (node.data.kind === 'sensor' && inCount + outCount === 0) issues.push({ id: `sensor-${node.id}`, severity: 'warning', message: `Датчик «${node.data.label}» не привязан к линии или оборудованию.`, nodeIds: [node.id] });
  });

  project.edges.forEach((edge) => {
    const src = project.nodes.find((node) => node.id === edge.source);
    const dst = project.nodes.find((node) => node.id === edge.target);
    if (!src || !dst) {
      issues.push({ id: `dangling-${edge.id}`, severity: 'error', message: `Линия ${edge.id} потеряла источник или приёмник.`, edgeIds: [edge.id] });
      return;
    }
    if (src.position.x > dst.position.x + 120) issues.push({ id: `direction-${edge.id}`, severity: 'info', message: `Линия «${src.data.shortName} → ${dst.data.shortName}» идёт против основной оси и может ухудшать читаемость.`, edgeIds: [edge.id] });
  });

  return issues;
};

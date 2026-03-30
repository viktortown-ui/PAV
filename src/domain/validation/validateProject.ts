import { componentMap } from '../registry/componentRegistry';
import { getHandleIds, normalizeProjectEdgeHandles } from '../flow/handles';
import { demoProject } from '../templates/templates';
import { CompositeMediumType, DefaultValueMap, EventLogEntry, FlowDirection, FlowDirectionMode, LineRole, MediumMode, MediumType, ProjectDefaults, ProjectDocument, ProjectViewState, RouteState, Severity, SimulationSettings, SoapEdge, SoapNode, SoapNodeData, SoapNodeKind, TemplateId, TemplateViewMetadata, ValidationIssue } from '../schemas/types';

const TEMPLATE_IDS = new Set(['water-prep', 'soap-line', 'cip-fragment'] as const);
const MEDIUM_TYPES = new Set<MediumType>(['water', 'product', 'cip', 'waste']);
const COMPOSITE_MEDIA = new Set<CompositeMediumType>(['water', 'product', 'cip', 'waste', 'composite']);
const ROUTE_STATES = new Set<RouteState>(['idle', 'primed', 'flowing', 'blocked', 'starved', 'draining', 'cip', 'alarm', 'maintenance', 'offline']);
const NODE_KINDS = new Set<SoapNodeKind>(componentMap.keys() as Iterable<SoapNodeKind>);
const STATUSES = new Set(['off', 'idle', 'standby', 'running', 'blocked', 'alarm', 'maintenance', 'normal', 'active', 'warning', 'disabled']);
const DIRECTION_MODES = new Set<FlowDirectionMode>(['forward', 'reverse', 'bidirectional', 'derived']);
const DIRECTIONS = new Set<FlowDirection>(['forward', 'reverse', 'bidirectional']);
const MEDIUM_MODES = new Set<MediumMode>(['single', 'mixed', 'unknown']);
const LINE_ROLES = new Set<LineRole>(['process', 'drain', 'CIP', 'utility', 'recycle']);

const TOPOLOGY_NODES = new Set<SoapNodeKind>(['tee', 'cross', 'collector', 'splitter', 'mixingJunction', 'drainBranch', 'samplePoint', 'offPageConnector', 'serviceTerminal']);
const MERGE_NODES = new Set<SoapNodeKind>(['collector', 'mixingJunction', 'cross']);
const BRANCH_NODES = new Set<SoapNodeKind>(['tee', 'cross', 'splitter', 'drainBranch']);
const MIXING_NODES = new Set<SoapNodeKind>(['mixingJunction']);

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const asString = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;
const asBoolean = (value: unknown, fallback = false) => typeof value === 'boolean' ? value : fallback;
const asNumber = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const asSeverity = (value: unknown, fallback: Severity = 'info'): Severity => value === 'warning' || value === 'error' || value === 'info' ? value : fallback;
const asMedium = (value: unknown, fallback: MediumType = 'water'): MediumType => typeof value === 'string' && MEDIUM_TYPES.has(value as MediumType) ? value as MediumType : fallback;
const asCompositeMedium = (value: unknown, fallback: CompositeMediumType = 'water'): CompositeMediumType => typeof value === 'string' && COMPOSITE_MEDIA.has(value as CompositeMediumType) ? value as CompositeMediumType : fallback;
const asRouteState = (value: unknown, fallback: RouteState = 'idle'): RouteState => typeof value === 'string' && ROUTE_STATES.has(value as RouteState) ? value as RouteState : fallback;
const asDirectionMode = (value: unknown, fallback: FlowDirectionMode = 'derived'): FlowDirectionMode => typeof value === 'string' && DIRECTION_MODES.has(value as FlowDirectionMode) ? value as FlowDirectionMode : fallback;
const asDirection = (value: unknown, fallback: FlowDirection = 'forward'): FlowDirection => typeof value === 'string' && DIRECTIONS.has(value as FlowDirection) ? value as FlowDirection : fallback;
const asMediumMode = (value: unknown, fallback: MediumMode = 'single'): MediumMode => typeof value === 'string' && MEDIUM_MODES.has(value as MediumMode) ? value as MediumMode : fallback;
const asLineRole = (value: unknown, fallback: LineRole = 'process'): LineRole => typeof value === 'string' && LINE_ROLES.has(value as LineRole) ? value as LineRole : fallback;

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

const sanitizeView = (value: unknown, fallback: ProjectViewState): ProjectViewState => ({
  viewport: sanitizeViewport(isObject(value) ? value.viewport : undefined),
  metadata: sanitizeTemplateViewMetadata(isObject(value) ? value.metadata : undefined, fallback.metadata),
  hasManualViewport: asBoolean(isObject(value) ? value.hasManualViewport : undefined, fallback.hasManualViewport),
  presentationMode: isObject(value) && (value.presentationMode === 'schematic' || value.presentationMode === 'simulation')
    ? value.presentationMode
    : fallback.presentationMode,
});
const sanitizeSimulation = (value: unknown, fallback: SimulationSettings): SimulationSettings => {
  const running = asBoolean(isObject(value) ? value.running : undefined, false);
  const status = isObject(value) && (value.status === 'idle' || value.status === 'running' || value.status === 'paused')
    ? value.status
    : running ? 'running' : fallback.status ?? 'idle';
  return {
    status,
    running: status === 'running',
    speed: Math.min(3, Math.max(0.5, asNumber(isObject(value) ? value.speed : undefined, fallback.speed))),
    tick: Math.max(0, asNumber(isObject(value) ? value.tick : undefined, fallback.tick)),
    warnings: Array.isArray(isObject(value) ? value.warnings : undefined) ? (value as any).warnings.filter((item: unknown) => typeof item === 'string').slice(0, 50) : fallback.warnings,
    activeMedium: (isObject(value) && (value.activeMedium === 'mixed' || value.activeMedium === 'none')) ? value.activeMedium as any : asMedium(isObject(value) ? value.activeMedium : undefined, fallback.activeMedium === 'mixed' || fallback.activeMedium === 'none' ? 'water' : fallback.activeMedium),
    totalActiveFlow: Math.max(0, asNumber(isObject(value) ? value.totalActiveFlow : undefined, fallback.totalActiveFlow)),
    lastEvent: asString(isObject(value) ? value.lastEvent : undefined, fallback.lastEvent),
    fluid: isObject(value) && isObject(value.fluid) ? {
      id: asString(value.fluid.id, fallback.fluid.id),
      kind: (value.fluid.kind === 'water' || value.fluid.kind === 'oil' || value.fluid.kind === 'glycol' || value.fluid.kind === 'custom') ? value.fluid.kind : fallback.fluid.kind,
      name: asString(value.fluid.name, fallback.fluid.name),
      densityKgPerM3: Math.max(1, asNumber(value.fluid.densityKgPerM3, fallback.fluid.densityKgPerM3)),
      dynamicViscosityPaS: Math.max(0.000001, asNumber(value.fluid.dynamicViscosityPaS, fallback.fluid.dynamicViscosityPaS)),
      bulkModulusPa: value.fluid.bulkModulusPa === undefined ? fallback.fluid.bulkModulusPa : asNumber(value.fluid.bulkModulusPa, fallback.fluid.bulkModulusPa ?? 0),
    } : fallback.fluid,
    scenarioRevision: Math.max(0, asNumber(isObject(value) ? value.scenarioRevision : undefined, fallback.scenarioRevision)),
  };
};
const sanitizeEventLog = (value: unknown, fallback: EventLogEntry[]) => Array.isArray(value) ? value.filter(isObject).map((entry, index) => ({ id: asString(entry.id, `event-${index}`), timestamp: asString(entry.timestamp, new Date().toISOString()), type: asString(entry.type, 'restore'), message: asString(entry.message, 'Восстановлено состояние проекта'), severity: asSeverity(entry.severity), targetId: typeof entry.targetId === 'string' ? entry.targetId : undefined })).slice(-80) : fallback;
const sanitizeDefaultValueMap = (value: unknown, fallback: DefaultValueMap = {}): DefaultValueMap => {
  if (!isObject(value)) return fallback;
  return {
    visibleName: typeof value.visibleName === 'string' ? value.visibleName : fallback.visibleName,
    technicalTag: typeof value.technicalTag === 'string' ? value.technicalTag : fallback.technicalTag,
    namingRule: typeof value.namingRule === 'string' ? value.namingRule : fallback.namingRule,
    medium: typeof value.medium === 'string' ? asMedium(value.medium, fallback.medium as MediumType | undefined) : fallback.medium,
    mediumType: typeof value.mediumType === 'string' ? asMedium(value.mediumType, fallback.mediumType as MediumType | undefined) : fallback.mediumType,
    nominalDiameter: typeof value.nominalDiameter === 'string' ? value.nominalDiameter : fallback.nominalDiameter,
    diameterNominal: typeof value.diameterNominal === 'string' ? value.diameterNominal : fallback.diameterNominal,
    lineRole: typeof value.lineRole === 'string' ? asLineRole(value.lineRole, fallback.lineRole as LineRole | undefined) : fallback.lineRole,
    status: typeof value.status === 'string' && STATUSES.has(value.status) ? value.status as any : fallback.status,
    mode: value.mode === 'manual' || value.mode === 'auto' ? value.mode : fallback.mode,
    requiredFields: Array.isArray(value.requiredFields) ? value.requiredFields.filter((item): item is string => typeof item === 'string') : fallback.requiredFields,
    process: isObject(value.process) ? Object.fromEntries(Object.entries(value.process).filter(([, entry]) => ['string', 'number', 'boolean'].includes(typeof entry))) as Record<string, string | number | boolean> : fallback.process,
  };
};
const sanitizeDefaultRuleLayer = (value: unknown, fallback: ProjectDefaults['project']) => ({
  all: sanitizeDefaultValueMap(isObject(value) ? value.all : undefined, fallback.all),
  edges: sanitizeDefaultValueMap(isObject(value) ? value.edges : undefined, fallback.edges),
  groups: isObject(isObject(value) ? value.groups : undefined) ? Object.fromEntries(Object.entries((value as any).groups).map(([key, item]) => [key, sanitizeDefaultValueMap(item)])) : fallback.groups,
  kinds: isObject(isObject(value) ? value.kinds : undefined) ? Object.fromEntries(Object.entries((value as any).kinds).map(([key, item]) => [key, sanitizeDefaultValueMap(item)])) : fallback.kinds,
});
const sanitizeProjectDefaults = (value: unknown, fallback: ProjectDefaults): ProjectDefaults => ({
  project: sanitizeDefaultRuleLayer(isObject(value) ? value.project : undefined, fallback.project),
  template: sanitizeDefaultRuleLayer(isObject(value) ? value.template : undefined, fallback.template),
});

const sanitizeNode = (value: unknown): SoapNode | null => {
  if (!isObject(value) || typeof value.id !== 'string' || !isObject(value.position) || !isObject(value.data)) return null;
  const kind = typeof value.data.kind === 'string' && NODE_KINDS.has(value.data.kind as SoapNodeKind) ? value.data.kind as SoapNodeKind : undefined;
  if (!kind) return null;
  const definition = componentMap.get(kind);
  if (!definition) return null;
  const visual = isObject(value.data.visual) ? value.data.visual : {};
  const ports = isObject(value.data.ports) ? value.data.ports : {};
  const portDetails = isObject(ports.details) ? ports.details : {};
  const simulation = isObject(value.data.simulation) ? value.data.simulation : {};
  const process = isObject(value.data.process) ? value.data.process : {};
  const sanitizedData: SoapNodeData = {
    ...structuredClone(definition.defaults),
    kind,
    id: asString(value.data.id, value.id),
    type: kind,
    visibleName: asString(value.data.visibleName ?? value.data.label, definition.label),
    shortName: asString(value.data.shortName, definition.shortName),
    technicalTag: asString(value.data.technicalTag ?? value.data.tag, `${definition.technicalPrefix}-101`),
    category: asString(value.data.category, definition.category),
    description: asString(value.data.description, definition.description),
    className: definition.className,
    status: typeof value.data.status === 'string' && STATUSES.has(value.data.status) ? value.data.status as SoapNodeData['status'] : definition.defaults.status,
    mode: value.data.mode === 'manual' ? 'manual' : 'auto',
    rotation: asNumber(value.data.rotation, definition.defaults.rotation),
    mediumType: asMedium(value.data.mediumType ?? value.data.medium, definition.defaults.mediumType),
    medium: asMedium(value.data.medium, definition.defaults.medium),
    notes: asString(value.data.notes, ''),
    alarms: Array.isArray(value.data.alarms) ? value.data.alarms.filter((item: unknown): item is string => typeof item === 'string') : [],
    isEnabled: asBoolean(value.data.isEnabled, true),
    isInteractive: asBoolean(value.data.isInteractive, true),
    simulationEnabled: asBoolean(value.data.simulationEnabled, true),
    createdAt: asString(value.data.createdAt, new Date().toISOString()),
    updatedAt: asString(value.data.updatedAt, new Date().toISOString()),
    revision: Math.max(1, asNumber(value.data.revision, 1)),
    process: Object.fromEntries(Object.entries(process).filter(([, entry]) => ['string', 'number', 'boolean'].includes(typeof entry))) as Record<string, string | number | boolean>,
    visual: { accent: asString(visual.accent, definition.defaults.visual.accent), fill: Math.min(100, Math.max(0, asNumber(visual.fill, definition.defaults.visual.fill))), enabled: asBoolean(visual.enabled, definition.defaults.visual.enabled), semanticSize: ['major', 'line', 'valve', 'instrument', 'topology'].includes(String(visual.semanticSize)) ? visual.semanticSize as any : definition.defaults.visual.semanticSize, showLabel: asBoolean(visual.showLabel, definition.defaults.visual.showLabel), stateBadge: typeof visual.stateBadge === 'string' ? visual.stateBadge : definition.defaults.visual.stateBadge },
    ports: {
      inputs: Math.max(0, Math.round(asNumber(ports.inputs, definition.defaults.ports.inputs))),
      outputs: Math.max(0, Math.round(asNumber(ports.outputs, definition.defaults.ports.outputs))),
      preferredDirection: ports.preferredDirection === 'ttb' ? 'ttb' : 'ltr',
      inline: asBoolean(ports.inline, definition.defaults.ports.inline),
      details: Object.keys(definition.defaults.ports.details).reduce((acc, key) => ({
        ...acc,
        [key]: {
          ...definition.defaults.ports.details[key],
          ...(isObject(portDetails[key]) ? {
            portRole: asString(portDetails[key].portRole, definition.defaults.ports.details[key].portRole) as any,
            occupied: asString(portDetails[key].occupied, definition.defaults.ports.details[key].occupied) as any,
            mediaGroup: asString(portDetails[key].mediaGroup, definition.defaults.ports.details[key].mediaGroup) as any,
            allowMixing: asBoolean(portDetails[key].allowMixing, definition.defaults.ports.details[key].allowMixing),
          } : {}),
        },
      }), {} as SoapNodeData['ports']['details']),
    },
    runtime: { enabled: asBoolean(simulation.enabled, definition.defaults.runtime.enabled), active: asBoolean(simulation.active, definition.defaults.runtime.active), blocked: asBoolean(simulation.blocked, definition.defaults.runtime.blocked), routeState: asRouteState(simulation.routeState, definition.defaults.runtime.routeState), flow: Math.max(0, asNumber(simulation.flow, definition.defaults.runtime.flow)), flowLpm: Math.max(0, asNumber((simulation as any).flowLpm ?? simulation.flow, definition.defaults.runtime.flowLpm)), lastEvent: typeof simulation.lastEvent === 'string' ? simulation.lastEvent : definition.defaults.runtime.lastEvent, alarmText: typeof simulation.alarmText === 'string' ? simulation.alarmText : definition.defaults.runtime.alarmText },
    simulation: { enabled: asBoolean(simulation.enabled, definition.defaults.runtime.enabled), active: asBoolean(simulation.active, definition.defaults.runtime.active), blocked: asBoolean(simulation.blocked, definition.defaults.runtime.blocked), routeState: asRouteState(simulation.routeState, definition.defaults.runtime.routeState), flow: Math.max(0, asNumber(simulation.flow, definition.defaults.runtime.flow)), flowLpm: Math.max(0, asNumber((simulation as any).flowLpm ?? simulation.flow, definition.defaults.runtime.flowLpm)), lastEvent: typeof simulation.lastEvent === 'string' ? simulation.lastEvent : definition.defaults.runtime.lastEvent, alarmText: typeof simulation.alarmText === 'string' ? simulation.alarmText : definition.defaults.runtime.alarmText },
  };
  return { id: value.id, type: 'processNode', position: { x: asNumber(value.position.x, 0), y: asNumber(value.position.y, 0) }, data: sanitizedData };
};

const sanitizeEdge = (value: unknown, nodeIds: Set<string>): SoapEdge | null => {
  if (!isObject(value) || typeof value.id !== 'string' || typeof value.source !== 'string' || typeof value.target !== 'string') return null;
  if (!nodeIds.has(value.source) || !nodeIds.has(value.target)) return null;
  const edgeData = isObject(value.data) ? value.data : {};
  return {
    id: value.id,
    source: value.source,
    target: value.target,
    sourceHandle: typeof value.sourceHandle === 'string' ? value.sourceHandle : null,
    targetHandle: typeof value.targetHandle === 'string' ? value.targetHandle : null,
    type: 'flowEdge',
    animated: asBoolean(value.animated, false),
    markerEnd: value.markerEnd as SoapEdge['markerEnd'],
    data: {
      mediumType: asCompositeMedium(edgeData.mediumType ?? edgeData.medium, 'water'),
      medium: asCompositeMedium(edgeData.medium, 'water'),
      flowLpm: Math.max(0, asNumber(edgeData.flowLpm ?? edgeData.flowRate, 0)),
      flowRate: Math.max(0, asNumber(edgeData.flowRate ?? edgeData.flowLpm, 0)),
      flowActive: asBoolean(edgeData.flowActive, false),
      blocked: asBoolean(edgeData.blocked, false),
      routeState: asRouteState(edgeData.routeState, 'idle'),
      pressure: asNumber(edgeData.pressure, 0),
      directionMode: asDirectionMode(edgeData.directionMode, 'derived'),
      nominalDiameter: asString(edgeData.nominalDiameter, 'DN50'),
      mediumMode: asMediumMode(edgeData.mediumMode, 'single'),
      lineRole: asLineRole(edgeData.lineRole, 'process'),
      selectedPath: asBoolean(edgeData.selectedPath, false),
      sourceLabel: typeof edgeData.sourceLabel === 'string' ? edgeData.sourceLabel : undefined,
      targetLabel: typeof edgeData.targetLabel === 'string' ? edgeData.targetLabel : undefined,
      blockedBy: Array.isArray(edgeData.blockedBy) ? edgeData.blockedBy.filter((item): item is string => typeof item === 'string') : [],
      segmentId: asString(edgeData.segmentId, value.id),
      direction: asDirection(edgeData.direction, 'forward'),
      stateLabel: asString(edgeData.stateLabel, 'Ожидание'),
      upstreamRef: asString(edgeData.upstreamRef, value.source),
      downstreamRef: asString(edgeData.downstreamRef, value.target),
      routeWarnings: Array.isArray(edgeData.routeWarnings) ? edgeData.routeWarnings.filter((item): item is string => typeof item === 'string') : [],
      composition: isObject(edgeData.composition) ? Object.fromEntries(Object.entries(edgeData.composition).filter(([key, val]) => MEDIUM_TYPES.has(key as MediumType) && typeof val === 'number')) : undefined,
      mixedFlow: asBoolean(edgeData.mixedFlow, false),
    },
  };
};

export const restoreProjectDocument = (value: unknown): ProjectDocument => {
  if (!isObject(value)) throw new Error('Сохранённый проект не является объектом.');
  const fallback = structuredClone(demoProject);
  const nodes = Array.isArray(value.nodes) ? value.nodes.map(sanitizeNode).filter((n): n is SoapNode => n !== null) : [];
  if (!nodes.length) throw new Error('Сохранённый проект не содержит корректных узлов.');
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = Array.isArray(value.edges) ? value.edges.map((edge) => sanitizeEdge(edge, nodeIds)).filter((e): e is SoapEdge => e !== null) : [];
  const templateId: TemplateId = typeof value.templateId === 'string' && TEMPLATE_IDS.has(value.templateId as TemplateId) ? value.templateId as TemplateId : fallback.templateId;
  return normalizeProjectEdgeHandles({ id: asString(value.id, fallback.id), name: asString(value.name, fallback.name), templateId, updatedAt: asString(value.updatedAt, new Date().toISOString()), appSchemaVersion: asNumber(value.appSchemaVersion, fallback.appSchemaVersion), projectSchemaVersion: asNumber(value.projectSchemaVersion, fallback.projectSchemaVersion), nodes, edges, view: sanitizeView(value.view, fallback.view), simulation: sanitizeSimulation(value.simulation, fallback.simulation), eventLog: sanitizeEventLog(value.eventLog, fallback.eventLog), defaults: sanitizeProjectDefaults(value.defaults, fallback.defaults) });
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
    const process = node.data.process as Record<string, unknown>;
    const splitAllowed = Boolean(process.splitAllowed ?? BRANCH_NODES.has(node.data.kind));
    const mergeAllowed = Boolean(process.mergeAllowed ?? MERGE_NODES.has(node.data.kind));
    const mixingAllowed = Boolean(process.mixingAllowed ?? MIXING_NODES.has(node.data.kind));

    if (node.data.kind === 'source' && outputs.length === 0) issues.push({ id: `source-${node.id}`, severity: 'warning', message: `Источник «${node.data.visibleName}» не имеет выходящей линии.`, nodeIds: [node.id] });
    if ((node.data.kind === 'consumer' || node.data.kind === 'utilityDrain' || node.data.kind === 'fillingStation') && inputs.length === 0) issues.push({ id: `sink-${node.id}`, severity: 'warning', message: `Приёмник «${node.data.visibleName}» не подключён по входу.`, nodeIds: [node.id] });
    if (!['source', 'consumer', 'utilityDrain', 'fillingStation'].includes(node.data.kind) && inputs.length + outputs.length === 0) issues.push({ id: `isolated-${node.id}`, severity: 'error', message: `Элемент «${node.data.visibleName}» не подключён к процессу.`, nodeIds: [node.id] });
    if (node.data.className === 'valve' && inputs.length + outputs.length < 2) issues.push({ id: `valve-${node.id}`, severity: 'error', message: `Арматура «${node.data.visibleName}» должна стоять на реальной линии.`, nodeIds: [node.id] });
    if (node.data.className === 'instrument' && inputs.length + outputs.length < 1) issues.push({ id: `instrument-${node.id}`, severity: 'warning', message: `КИП «${node.data.visibleName}» не привязан к линии или аппарату.`, nodeIds: [node.id] });
    if (splitAllowed && outputs.length < 2) issues.push({ id: `branch-${node.id}`, severity: 'warning', message: `Узел «${node.data.visibleName}» ожидает минимум две выходящие ветви.`, nodeIds: [node.id] });
    if (mergeAllowed && inputs.length < 2) issues.push({ id: `merge-${node.id}`, severity: 'warning', message: `Узел «${node.data.visibleName}» ожидает минимум две входящие линии.`, nodeIds: [node.id] });
    if (!mergeAllowed && inputs.length > 1) issues.push({ id: `hidden-merge-${node.id}`, severity: 'error', message: `Скрытое слияние в «${node.data.visibleName}» запрещено: используйте явный узел merge/mixing.`, nodeIds: [node.id] });
    if (!splitAllowed && outputs.length > 1) issues.push({ id: `hidden-split-${node.id}`, severity: 'error', message: `Скрытое ответвление из «${node.data.visibleName}» запрещено: используйте явный branching node.`, nodeIds: [node.id] });
    if (!mixingAllowed && inputs.length > 1) {
      const incomingMedia = new Set(inputs.map((edge) => edge.data?.mediumType ?? edge.data?.medium));
      if (incomingMedia.size > 1) issues.push({ id: `mixing-${node.id}`, severity: 'error', message: `Смешение в «${node.data.visibleName}» допускается только через mixing-capable node.`, nodeIds: [node.id] });
    }

    const incomingHandleIds = new Map<string, number>();
    const outgoingHandleIds = new Map<string, number>();
    inputs.forEach((edge) => { if (edge.targetHandle) incomingHandleIds.set(edge.targetHandle, (incomingHandleIds.get(edge.targetHandle) ?? 0) + 1); });
    outputs.forEach((edge) => { if (edge.sourceHandle) outgoingHandleIds.set(edge.sourceHandle, (outgoingHandleIds.get(edge.sourceHandle) ?? 0) + 1); });
    getHandleIds(node, 'target').forEach((handleId) => { if ((incomingHandleIds.get(handleId) ?? 0) > 1) issues.push({ id: `target-handle-${node.id}-${handleId}`, severity: 'error', message: `Входной порт «${handleId}» узла «${node.data.visibleName}» подключён более одного раза.`, nodeIds: [node.id] }); });
    getHandleIds(node, 'source').forEach((handleId) => { if ((outgoingHandleIds.get(handleId) ?? 0) > 1) issues.push({ id: `source-handle-${node.id}-${handleId}`, severity: 'error', message: `Выходной порт «${handleId}» узла «${node.data.visibleName}» подключён более одного раза.`, nodeIds: [node.id] }); });
  });

  project.edges.forEach((edge) => {
    const src = project.nodes.find((node) => node.id === edge.source);
    const dst = project.nodes.find((node) => node.id === edge.target);
    if (!src || !dst) {
      issues.push({ id: `dangling-${edge.id}`, severity: 'error', message: `Сегмент ${edge.id} потерял источник или приёмник.`, edgeIds: [edge.id] });
      return;
    }
    const directionMode = edge.data?.directionMode ?? 'derived';
    const direction = edge.data?.direction ?? 'forward';
    if ((incoming.get(dst.id)?.length ?? 0) > 1 && !MERGE_NODES.has(dst.data.kind)) issues.push({ id: `ambiguous-merge-${edge.id}`, severity: 'error', message: `Слияние в «${dst.data.visibleName}» допускается только через явный трубный узел.`, edgeIds: [edge.id], nodeIds: [dst.id] });
    if ((outgoing.get(src.id)?.length ?? 0) > 1 && !BRANCH_NODES.has(src.data.kind)) issues.push({ id: `ambiguous-branch-${edge.id}`, severity: 'error', message: `Ответвление из «${src.data.visibleName}» допускается только через тройник, крестовину или распределительный узел.`, edgeIds: [edge.id], nodeIds: [src.id] });
    if (src.position.x > dst.position.x + 160 && src.data.ports.preferredDirection === 'ltr') issues.push({ id: `direction-${edge.id}`, severity: 'info', message: `Сегмент «${src.data.shortName} → ${dst.data.shortName}» идёт против основной оси и может ухудшать читаемость.`, edgeIds: [edge.id] });
    if (src.position.x > dst.position.x + 260 && directionMode === 'bidirectional') issues.push({ id: `readability-${edge.id}`, severity: 'warning', message: `Сегмент «${src.data.shortName} ↔ ${dst.data.shortName}» двунаправлен и идёт против основной оси: читаемость деградирует.`, edgeIds: [edge.id] });
    if (src.data.className === 'topology' && dst.data.className === 'topology' && !TOPOLOGY_NODES.has(src.data.kind)) issues.push({ id: `topology-${edge.id}`, severity: 'warning', message: `Проверьте корректность цепочки трубных узлов между «${src.data.visibleName}» и «${dst.data.visibleName}».`, edgeIds: [edge.id] });
    if ((src.data.kind === 'checkValve' || dst.data.kind === 'checkValve') && direction === 'reverse') issues.push({ id: `check-valve-${edge.id}`, severity: 'error', message: `Обратный поток через check valve на сегменте «${src.data.shortName} → ${dst.data.shortName}» невозможен.`, edgeIds: [edge.id], nodeIds: [src.data.kind === 'checkValve' ? src.id : dst.id] });
    if (edge.data?.mixedFlow && !MIXING_NODES.has(src.data.kind) && !MIXING_NODES.has(dst.data.kind)) issues.push({ id: `hidden-mix-${edge.id}`, severity: 'error', message: `Composite medium на сегменте «${src.data.shortName} → ${dst.data.shortName}» должен появляться только после явного mixing node.`, edgeIds: [edge.id] });
  });
  return issues;
};

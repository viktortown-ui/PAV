import { mediumPalette } from '../../ui/tokens/tokens';
import { EventLogEntry, MediumType, ProjectDocument, RouteState, SimulationSettings, SoapEdge, SoapNode, SoapNodeData } from '../schemas/types';
import { instrumentCallsite } from '../../utils/instrumentation';

interface SimulationResult {
  nodes: SoapNode[];
  edges: SoapEdge[];
  warnings: string[];
  events: EventLogEntry[];
  activeMedium: SimulationSettings['activeMedium'];
  totalActiveFlow: number;
  lastEvent: string;
}

interface EdgeEvaluation {
  active: boolean;
  blocked: boolean;
  routeState: RouteState;
  flowRate: number;
  pressure: number;
  blockedBy: string[];
  stateLabel: string;
  sourceSupplyAvailable: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const vesselKinds = new Set(['source', 'tank', 'bufferTank', 'reactor', 'heatedReactor']);
const tankKinds = new Set(['source', 'tank', 'bufferTank']);
const pumpKinds = new Set(['pump', 'dosingPump']);
const reactorKinds = new Set(['reactor', 'heatedReactor']);
const sensorKinds = new Set(['flowMeter', 'pressureSensor', 'temperatureSensor', 'levelSensor', 'phSensor', 'conductivitySensor', 'indicator']);

const isTankLike = (node: SoapNode) => tankKinds.has(node.data.kind) || reactorKinds.has(node.data.kind);
const isPump = (node: SoapNode) => pumpKinds.has(node.data.kind);
const isSensor = (node: SoapNode) => sensorKinds.has(node.data.kind);
const isValve = (node: SoapNode) => node.data.className === 'valve';

const getCapacity = (node: SoapNode) => Number((node.data.process as any).capacityLiters ?? (node.data.process as any).capacity ?? 0);
const getLevel = (node: SoapNode) => Number((node.data.process as any).currentLevelLiters ?? (node.data.process as any).level ?? 0);
const setLevel = (node: SoapNode, value: number) => {
  const capacity = getCapacity(node);
  const safe = clamp(value, 0, capacity > 0 ? capacity : Math.max(0, value));
  (node.data.process as any).currentLevelLiters = safe;
  (node.data.process as any).level = safe;
  (node.data.process as any).levelPercent = capacity > 0 ? clamp((safe / capacity) * 100, 0, 100) : 0;
  node.data.visual.fill = capacity > 0 ? clamp((safe / capacity) * 100, 0, 100) : 0;
};

const pushEvent = (events: EventLogEntry[], type: string, message: string, severity: EventLogEntry['severity'], targetId?: string) => {
  events.push({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), type, message, severity, targetId });
};

const getIncomingEdges = (nodeId: string, edges: SoapEdge[]) => edges.filter((edge) => edge.target === nodeId);
const getOutgoingEdges = (nodeId: string, edges: SoapEdge[]) => edges.filter((edge) => edge.source === nodeId);

const routeStateLabel = (state: RouteState) => ({
  idle: 'Ожидание',
  primed: 'Подготовлен',
  flowing: 'Поток',
  blocked: 'Блокирован',
  starved: 'Нет подпитки',
  draining: 'Слив',
  cip: 'CIP',
  alarm: 'Авария',
  maintenance: 'Ремонт',
  offline: 'Отключён',
}[state]);

const getNodeBaseFlow = (node: SoapNode) => Number((node.data.process as any).actualFlowLpm ?? (node.data.process as any).nominalFlowLpm ?? (node.data.process as any).flowRate ?? node.data.runtime.flowLpm ?? node.data.simulation.flowLpm ?? 0);

const canValvePass = (node: SoapNode, edge: SoapEdge) => {
  if (!isValve(node)) return { pass: true, reason: '' };
  const process = node.data.process as any;
  const isOpen = Boolean(process.isOpen ?? process.valveOpen ?? process.valveState !== 'closed');
  if (!isOpen) return { pass: false, reason: 'Клапан закрыт' };
  if (node.data.kind === 'checkValve' && (edge.data?.direction ?? 'forward') === 'reverse') return { pass: false, reason: 'Обратный клапан блокирует направление' };
  return { pass: true, reason: '' };
};

const getNodeModeRouteState = (node: SoapNode): RouteState | undefined => {
  if (!node.data.visual.enabled || !node.data.runtime.enabled || !node.data.simulation.enabled) return 'maintenance';
  if (node.data.status === 'maintenance') return 'maintenance';
  return undefined;
};

const evaluateEdge = (edge: SoapEdge, nodeMap: Map<string, SoapNode>, allEdges: SoapEdge[], speed: number): EdgeEvaluation => {
  const source = nodeMap.get(edge.source)!;
  const target = nodeMap.get(edge.target)!;
  const sourceMaintenance = getNodeModeRouteState(source);
  const targetMaintenance = getNodeModeRouteState(target);
  if (sourceMaintenance || targetMaintenance) {
    return { active: false, blocked: false, routeState: 'maintenance', flowRate: 0, pressure: 0, blockedBy: ['Оборудование в ремонте'], stateLabel: 'Ремонт', sourceSupplyAvailable: false };
  }

  const sourceLevel = getLevel(source);
  const targetLevel = getLevel(target);
  const targetCapacity = getCapacity(target);
  const sourceCanDischarge = !isTankLike(source) || Boolean((source.data.process as any).canDischarge ?? true);
  const targetCanReceive = target.data.kind === 'utilityDrain' || !isTankLike(target) || Boolean((target.data.process as any).canReceive ?? true);
  const sourceHasMaterial = !isTankLike(source) || sourceLevel > 0;
  const sourceIsExternallyFed = getIncomingEdges(source.id, allEdges).some((candidate) => candidate.data?.flowActive);
  const sourceSupplyAvailable = sourceHasMaterial || sourceIsExternallyFed;
  const targetHasSpace = target.data.kind === 'utilityDrain' || targetCapacity <= 0 || targetLevel < targetCapacity;
  const sourceValve = canValvePass(source, edge);
  const targetValve = canValvePass(target, edge);
  const sourcePumpReady = !isPump(source) || Boolean((source.data.process as any).pumpOn);
  const targetPumpReady = !isPump(target) || Boolean((target.data.process as any).pumpOn);
  const reactorSourceAllowed = !reactorKinds.has(source.data.kind) || Boolean((source.data.process as any).canDischarge ?? true);
  const reactorTargetAllowed = !reactorKinds.has(target.data.kind) || Boolean((target.data.process as any).canReceive ?? true);
  const sourceOperational = source.data.status !== 'off' && source.data.status !== 'maintenance';
  const targetOperational = target.data.status !== 'maintenance';

  const blockedBy: string[] = [];
  if (!sourceOperational) blockedBy.push('Источник отключён');
  if (!targetOperational) blockedBy.push('Приёмник недоступен');
  if (!sourceSupplyAvailable) blockedBy.push('Источник пуст');
  if (!sourceCanDischarge) blockedBy.push('Выдача запрещена');
  if (!targetCanReceive) blockedBy.push('Приём запрещён');
  if (!targetHasSpace) blockedBy.push('Приёмник заполнен');
  if (!sourceValve.pass) blockedBy.push(sourceValve.reason);
  if (!targetValve.pass) blockedBy.push(targetValve.reason);
  if (!sourcePumpReady) blockedBy.push('Насос выключен');
  if (!targetPumpReady && isPump(target)) blockedBy.push('Насос-приёмник выключен');
  if (!reactorSourceAllowed) blockedBy.push('Реактор не разрешает выдачу');
  if (!reactorTargetAllowed) blockedBy.push('Реактор не разрешает приём');

  const active = blockedBy.length === 0;
  const blocked = !active && (sourceOperational || sourceSupplyAvailable || isPump(source));
  const flowRate = active ? getNodeBaseFlow(source) * speed : 0;
  const medium = (edge.data?.mediumType ?? edge.data?.medium ?? source.data.mediumType) as MediumType;
  const routeState: RouteState = active
    ? medium === 'cip' ? 'cip' : medium === 'waste' ? 'draining' : 'flowing'
    : sourceMaintenance || targetMaintenance ? 'maintenance'
    : !sourceSupplyAvailable ? 'starved'
    : blocked ? (blockedBy.some((reason) => reason.includes('авари')) ? 'alarm' : 'blocked') : 'idle';
  return {
    active,
    blocked,
    routeState,
    flowRate,
    pressure: active ? Number((source.data.process as any).pressureBar ?? (source.data.process as any).pressure ?? 1) : blocked ? Number((source.data.process as any).pressureBar ?? (source.data.process as any).pressure ?? 1.8) : 0,
    blockedBy,
    stateLabel: routeStateLabel(routeState),
    sourceSupplyAvailable,
  };
};

const syncNodeRuntime = (node: SoapNode) => {
  node.data.runtime = {
    ...node.data.runtime,
    enabled: node.data.visual.enabled,
    active: node.data.simulation.active,
    blocked: node.data.simulation.blocked,
    routeState: node.data.simulation.routeState,
    flow: node.data.simulation.flow,
    flowLpm: node.data.simulation.flowLpm,
    lastEvent: node.data.simulation.lastEvent,
    alarmText: node.data.simulation.alarmText,
  };
};

const updateSensorReading = (node: SoapNode, nodeMap: Map<string, SoapNode>, edges: SoapEdge[], warnings: string[], events: EventLogEntry[], previousNode?: SoapNode) => {
  if (!isSensor(node)) return;
  const process = node.data.process as any;
  const enabled = node.data.isEnabled && node.data.visual.enabled;
  const relatedIn = getIncomingEdges(node.id, edges);
  const relatedOut = getOutgoingEdges(node.id, edges);
  const linkedEdge = relatedIn.find((edge) => edge.data?.flowActive || edge.data?.blocked) ?? relatedOut.find((edge) => edge.data?.flowActive || edge.data?.blocked) ?? relatedIn[0] ?? relatedOut[0];
  const upstreamNode = linkedEdge ? nodeMap.get(linkedEdge.source) : undefined;
  const downstreamNode = linkedEdge ? nodeMap.get(linkedEdge.target) : undefined;
  let currentValue = Number(process.currentValue ?? process.signalValue ?? 0);
  const property = String(process.measuredProperty ?? process.signalType ?? node.data.kind);

  if (enabled && linkedEdge) {
    if (property.includes('flow') || node.data.kind === 'flowMeter') currentValue = Number(linkedEdge.data?.flowRate ?? 0);
    else if (property.includes('pressure') || node.data.kind === 'pressureSensor') currentValue = Number(linkedEdge.data?.pressure ?? 0);
    else if (property.includes('temperature') || node.data.kind === 'temperatureSensor') currentValue = Number((upstreamNode?.data.process as any)?.temperatureC ?? (upstreamNode?.data.process as any)?.temperature ?? 0);
    else if (property.includes('level') || node.data.kind === 'levelSensor') currentValue = getLevel(upstreamNode ?? downstreamNode ?? node);
    else currentValue = linkedEdge.data?.flowActive ? 1 : 0;
  }

  process.currentValue = currentValue;
  process.signalValue = currentValue;
  node.data.simulation.flow = currentValue;
  node.data.simulation.flowLpm = currentValue;

  const warnLow = Number(process.warnLow ?? process.warningLow ?? Number.NEGATIVE_INFINITY);
  const warnHigh = Number(process.warnHigh ?? process.warningHigh ?? Number.POSITIVE_INFINITY);
  const alarmLow = Number(process.alarmLow ?? process.alarmLow ?? Number.NEGATIVE_INFINITY);
  const alarmHigh = Number(process.alarmHigh ?? process.alarmHigh ?? Number.POSITIVE_INFINITY);
  const prevAlarm = previousNode?.data.alarms?.join('|') ?? '';

  node.data.alarms = [];
  node.data.runtime.alarmText = '';
  node.data.simulation.alarmText = '';
  if (!enabled) {
    node.data.status = 'disabled';
    node.data.visual.stateBadge = 'Контроль выкл';
  } else if (currentValue <= alarmLow || currentValue >= alarmHigh) {
    node.data.status = 'alarm';
    node.data.alarms = ['Аварийный порог датчика'];
    node.data.runtime.alarmText = 'Аварийный порог датчика';
    node.data.simulation.alarmText = 'Аварийный порог датчика';
    node.data.visual.stateBadge = 'ALM';
    warnings.push(`${node.data.visibleName}: аварийный порог датчика.`);
  } else if (currentValue <= warnLow || currentValue >= warnHigh) {
    node.data.status = 'warning';
    node.data.alarms = ['Предупредительный порог датчика'];
    node.data.runtime.alarmText = 'Предупредительный порог датчика';
    node.data.simulation.alarmText = 'Предупредительный порог датчика';
    node.data.visual.stateBadge = 'WARN';
    warnings.push(`${node.data.visibleName}: предупредительный порог датчика.`);
  } else {
    node.data.visual.stateBadge = linkedEdge?.data?.flowActive ? 'OK' : 'IDLE';
    if (node.data.status !== 'disabled') node.data.status = linkedEdge?.data?.flowActive ? 'active' : 'idle';
  }

  if (prevAlarm !== node.data.alarms.join('|')) {
    if (node.data.alarms.length > 0) pushEvent(events, 'alarm', `${node.data.visibleName}: сработала сигнализация.`, 'warning', node.id);
    else if (prevAlarm) pushEvent(events, 'alarm', `${node.data.visibleName}: сигнализация снята.`, 'info', node.id);
  }
};

export const runSimulationStep = (project: ProjectDocument, dt: number): SimulationResult => {
  instrumentCallsite('route recomputation', {
    callsite: 'runSimulationStep',
    when: 'Runs on every animation-frame simulation tick while simulation is enabled.',
    why: 'It recomputes edge flow, blockage, and route-state propagation across the graph.',
    repeatable: true,
    guidance: 'throttle',
    details: { dt, running: project.simulation.running, edgeCount: project.edges.length },
  });
  const warnings: string[] = [];
  const events: EventLogEntry[] = [];
  const nextNodes = project.nodes.map((node) => structuredClone(node));
  const nextEdges = project.edges.map((edge) => structuredClone(edge));
  const nodeMap = new Map(nextNodes.map((node) => [node.id, node]));
  const previousNodeMap = new Map(project.nodes.map((node) => [node.id, node]));
  const previousEdgeMap = new Map(project.edges.map((edge) => [edge.id, edge]));
  let totalActiveFlow = 0;
  const activeMediums = new Set<string>();

  nextNodes.forEach((node) => {
    node.data.simulation.active = false;
    node.data.simulation.blocked = false;
    node.data.simulation.routeState = getNodeModeRouteState(node) ?? 'idle';
    node.data.simulation.flow = 0;
    node.data.simulation.flowLpm = 0;
    node.data.runtime.alarmText = '';
    node.data.simulation.alarmText = '';
    node.data.alarms = [];
    node.data.visual.stateBadge = undefined;
    node.data.status = node.data.visual.enabled ? (reactorKinds.has(node.data.kind) && node.data.status === 'maintenance' ? 'maintenance' : 'idle') : 'disabled';
    if (isTankLike(node)) setLevel(node, getLevel(node));
  });

  for (let pass = 0; pass < Math.max(2, nextEdges.length); pass += 1) {
    let changed = false;
    nextEdges.forEach((edge) => {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) return;
      const evaluation = evaluateEdge(edge, nodeMap, nextEdges, project.simulation.speed);
      const previousState = edge.data?.routeState;
      const currentEdgeData = edge.data ?? { mediumType: source.data.mediumType, medium: source.data.medium, flowLpm: 0, flowRate: 0, flowActive: false, blocked: false, routeState: 'idle', pressure: 0, nominalDiameter: 'DN50' as const };
      edge.animated = evaluation.active;
      edge.data = {
        ...currentEdgeData,
        mediumType: currentEdgeData.mediumType ?? source.data.mediumType,
        medium: currentEdgeData.medium ?? source.data.medium,
        flowActive: evaluation.active,
        blocked: evaluation.blocked,
        routeState: evaluation.routeState,
        flowLpm: evaluation.flowRate,
        flowRate: evaluation.flowRate,
        pressure: evaluation.pressure,
        sourceLabel: source.data.visibleName,
        targetLabel: target.data.visibleName,
        blockedBy: evaluation.blockedBy,
        stateLabel: evaluation.stateLabel,
      };
      if (previousState !== evaluation.routeState) changed = true;

      source.data.simulation.routeState = evaluation.active ? evaluation.routeState : source.data.simulation.routeState;
      target.data.simulation.routeState = evaluation.routeState;
      if (evaluation.active) {
        totalActiveFlow += evaluation.flowRate;
        activeMediums.add((edge.data.mediumType ?? edge.data.medium) || source.data.mediumType);
        source.data.simulation.active = true;
        target.data.simulation.active = true;
        source.data.simulation.flow = Math.max(source.data.simulation.flow, evaluation.flowRate);
        source.data.simulation.flowLpm = Math.max(source.data.simulation.flowLpm, evaluation.flowRate);
        target.data.simulation.flow = Math.max(target.data.simulation.flow, evaluation.flowRate);
        target.data.simulation.flowLpm = Math.max(target.data.simulation.flowLpm, evaluation.flowRate);
        if (source.data.status !== 'maintenance') source.data.status = isPump(source) ? 'running' : 'active';
        if (target.data.status !== 'maintenance') target.data.status = reactorKinds.has(target.data.kind) ? 'running' : 'active';
        const delta = (evaluation.flowRate * dt) / 60;
        if (vesselKinds.has(source.data.kind)) setLevel(source, getLevel(source) - delta);
        if (vesselKinds.has(target.data.kind)) setLevel(target, getLevel(target) + delta);
      } else if (evaluation.blocked) {
        source.data.simulation.blocked = true;
        target.data.simulation.blocked = true;
        if (source.data.status !== 'maintenance') source.data.status = evaluation.routeState === 'starved' ? 'warning' : 'blocked';
        if (target.data.status !== 'maintenance') target.data.status = evaluation.routeState === 'starved' ? 'warning' : 'blocked';
        warnings.push(`${source.data.shortName} → ${target.data.shortName}: ${evaluation.blockedBy[0] ?? 'Маршрут недоступен'}`);
      }
    });
    if (!changed) break;
  }

  nextNodes.forEach((node) => {
    const previousNode = previousNodeMap.get(node.id);
    const capacity = getCapacity(node);
    const level = getLevel(node);
    const process = node.data.process as any;
    process.medium = process.medium ?? node.data.medium;
    process.mediumType = process.mediumType ?? node.data.mediumType;

    if (reactorKinds.has(node.data.kind)) {
      const heatingOn = Boolean(process.heatingOn);
      const agitatorOn = Boolean(process.agitatorOn ?? process.mixingOn);
      process.agitatorOn = agitatorOn;
      process.mixingOn = agitatorOn;
      if (node.data.status !== 'maintenance' && node.data.status !== 'disabled') {
        if (node.data.status === 'off') node.data.simulation.routeState = 'idle';
        node.data.visual.stateBadge = !node.data.visual.enabled ? 'OFF' : heatingOn && agitatorOn ? 'HEAT+MIX' : heatingOn ? 'HEAT' : agitatorOn ? 'MIX' : node.data.status === 'running' ? 'RUN' : 'IDLE';
      }
    }

    if (isPump(node)) {
      const pumpOn = Boolean(process.pumpOn);
      if (!pumpOn) {
        node.data.status = node.data.visual.enabled ? 'off' : 'disabled';
        node.data.simulation.routeState = node.data.visual.enabled ? 'idle' : 'maintenance';
        node.data.visual.stateBadge = 'OFF';
      } else if (!process.suctionAvailable && getIncomingEdges(node.id, nextEdges).every((edge) => !edge.data?.flowActive) && level <= 0) {
        node.data.status = 'warning';
        node.data.simulation.routeState = 'alarm';
        node.data.runtime.alarmText = 'Сухой ход / нет подпитки';
        node.data.simulation.alarmText = 'Сухой ход / нет подпитки';
        node.data.visual.stateBadge = 'DRY';
        warnings.push(`${node.data.visibleName}: сухой ход / нет подпитки.`);
      } else if (pumpOn && node.data.status !== 'running') {
        node.data.status = 'running';
        node.data.visual.stateBadge = 'RUN';
      }
    }

    if (isTankLike(node)) {
      if (level <= 0 && previousNode && getLevel(previousNode) > 0) pushEvent(events, 'material', `${node.data.visibleName}: источник опустошён.`, 'warning', node.id);
      if (capacity > 0 && level >= capacity && Boolean(process.overflowAlarm)) {
        node.data.status = 'alarm';
        node.data.runtime.alarmText = 'Переполнение';
        node.data.simulation.alarmText = 'Переполнение';
        warnings.push(`${node.data.visibleName}: переполнение.`);
      }
      if (node.data.kind === 'tank' || node.data.kind === 'bufferTank' || node.data.kind === 'source') {
        const canReceive = Boolean(process.canReceive ?? true);
        const canDischarge = Boolean(process.canDischarge ?? true);
        node.data.visual.stateBadge = !canReceive ? 'NO-IN' : !canDischarge ? 'NO-OUT' : level <= 0 ? 'EMPTY' : node.data.visual.stateBadge;
      }
    }

    updateSensorReading(node, nodeMap, nextEdges, warnings, events, previousNode);
    syncNodeRuntime(node);
  });

  nextEdges.forEach((edge) => {
    const previousEdge = previousEdgeMap.get(edge.id);
    if ((previousEdge?.data?.routeState ?? 'idle') !== edge.data?.routeState) {
      if (edge.data?.routeState === 'blocked' || edge.data?.routeState === 'starved' || edge.data?.routeState === 'alarm') {
        pushEvent(events, 'route', `${edge.data?.sourceLabel} → ${edge.data?.targetLabel}: маршрут заблокирован.`, 'warning', edge.id);
      }
      if ((previousEdge?.data?.routeState === 'blocked' || previousEdge?.data?.routeState === 'starved' || previousEdge?.data?.routeState === 'alarm') && edge.data?.routeState === 'flowing') {
        pushEvent(events, 'route', `${edge.data?.sourceLabel} → ${edge.data?.targetLabel}: маршрут восстановлен.`, 'info', edge.id);
      }
    }
  });

  const latestEvent = events.length > 0 ? events[events.length - 1] : undefined;
  const lastEvent = latestEvent?.message ?? warnings[0] ?? (totalActiveFlow > 0 ? `Активный поток ${Math.round(totalActiveFlow)} л/мин` : 'Схема в режиме ожидания');
  if (project.simulation.lastEvent !== lastEvent) {
    pushEvent(events, 'simulation', lastEvent, warnings.length ? 'warning' : 'info');
  }

  return {
    nodes: nextNodes,
    edges: nextEdges,
    warnings: Array.from(new Set(warnings)),
    events,
    activeMedium: activeMediums.size === 0 ? 'none' : activeMediums.size === 1 ? [...activeMediums][0] as any : 'mixed',
    totalActiveFlow,
    lastEvent,
  };
};

export const getMediumColor = (medium: SoapNodeData['medium']) => mediumPalette[medium].base;

import { mediumPalette } from '../visual/tokens';
import { EventLogEntry, ProjectDocument, RouteState, SimulationSettings, SoapEdge, SoapNode } from '../schemas/types';
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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const vesselKinds = new Set(['inlet', 'tank', 'reactor', 'heatedReactor']);

const routeStateFor = (active: boolean, blocked: boolean, sourceLevel: number, medium: import('../schemas/types').MediumType): RouteState => {
  if (blocked) return sourceLevel <= 0 ? 'starved' : 'blocked';
  if (!active) return 'idle';
  if (medium === 'cip') return 'cip';
  if (medium === 'waste') return 'draining';
  return 'flowing';
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
  let totalActiveFlow = 0;
  const activeMediums = new Set<string>();

  nextNodes.forEach((node) => {
    node.data.simulation.active = false;
    node.data.simulation.blocked = false;
    node.data.simulation.routeState = 'idle';
    node.data.status = node.data.visual.enabled ? 'normal' : 'disabled';
  });

  nextEdges.forEach((edge) => {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) return;

    const sourceLevel = Number(source.data.process.level ?? 0);
    const sourceEnabled = Boolean(source.data.simulation.enabled) && source.data.visual.enabled;
    const valveOpen = source.data.kind !== 'valve' || Boolean(source.data.process.valveOpen);
    const targetValveOpen = target.data.kind !== 'valve' || Boolean(target.data.process.valveOpen);
    const pumpReady = source.data.kind !== 'pump' || Boolean(source.data.process.pumpOn);
    const targetCanReceive = target.data.kind === 'drain' || Number(target.data.process.capacity ?? Infinity) === 0 || Number(target.data.process.level ?? 0) < Number(target.data.process.capacity ?? Infinity);
    const active = sourceEnabled && sourceLevel > 0 && valveOpen && targetValveOpen && pumpReady && targetCanReceive;
    const blocked = !active && (sourceEnabled || sourceLevel > 0);
    const flowRate = active ? Number(source.data.process.flowRate ?? source.data.simulation.flow ?? 0) * project.simulation.speed : 0;
    const routeState = routeStateFor(active, blocked, sourceLevel, edge.data?.medium ?? source.data.medium);

    edge.animated = active;
    edge.data = {
      ...edge.data,
      medium: edge.data?.medium ?? source.data.medium,
      flowActive: active,
      blocked,
      routeState,
      flowRate,
      pressure: active ? Number(source.data.process.pressure ?? 1) : blocked ? Number(source.data.process.pressure ?? 1.8) : 0,
      sourceLabel: source.data.label,
      targetLabel: target.data.label,
      blockedBy: blocked && (!valveOpen || !targetValveOpen) ? ['Закрытый клапан'] : blocked && !pumpReady ? ['Насос выключен'] : blocked && !targetCanReceive ? ['Приёмник заполнен'] : blocked && sourceLevel <= 0 ? ['Источник пуст'] : [],
    };

    if (active) {
      totalActiveFlow += flowRate;
      activeMediums.add(edge.data.medium);
      source.data.simulation.active = true;
      target.data.simulation.active = true;
      source.data.status = 'active';
      target.data.status = 'active';
      source.data.simulation.routeState = routeState;
      target.data.simulation.routeState = routeState;
      const delta = (flowRate * dt) / 60;
      if (vesselKinds.has(source.data.kind)) source.data.process.level = clamp(Number(source.data.process.level ?? 0) - delta, 0, Number(source.data.process.capacity ?? sourceLevel));
      if (vesselKinds.has(target.data.kind)) target.data.process.level = clamp(Number(target.data.process.level ?? 0) + delta, 0, Number(target.data.process.capacity ?? Infinity));
      if ((target.data.kind === 'reactor' || target.data.kind === 'heatedReactor') && Boolean(target.data.process.mixingOn)) target.data.process.rpm = Math.max(120, Number(target.data.process.rpm ?? 120));
    } else if (blocked) {
      source.data.simulation.blocked = true;
      target.data.simulation.blocked = true;
      source.data.status = sourceLevel <= 0 ? 'warning' : 'alarm';
      target.data.status = !targetCanReceive ? 'alarm' : 'warning';
      source.data.simulation.routeState = routeState;
      target.data.simulation.routeState = routeState;
      const reason = edge.data.blockedBy?.[0] ?? 'Маршрут недоступен';
      warnings.push(`${source.data.shortName} → ${target.data.shortName}: ${reason}`);
    }
  });

  nextNodes.forEach((node) => {
    const capacity = Number(node.data.process.capacity ?? 0);
    const level = Number(node.data.process.level ?? 0);
    if (capacity > 0) node.data.visual.fill = clamp((level / capacity) * 100, 0, 100);
    node.data.medium = (node.data.process.medium as any) ?? node.data.medium;
    if (node.data.kind === 'pump' && Boolean(node.data.process.pumpOn) && level <= 0 && Boolean(node.data.process.dryRunWarning)) {
      node.data.status = 'warning';
      node.data.simulation.alarmText = 'Риск сухого хода';
      warnings.push(`${node.data.label}: риск сухого хода.`);
    }
    if (capacity > 0 && level >= capacity && Boolean(node.data.process.overflowAlarm)) {
      node.data.status = 'alarm';
      node.data.simulation.alarmText = 'Переполнение';
      warnings.push(`${node.data.label}: переполнение.`);
    }
  });

  const lastEvent = warnings[0] ?? (totalActiveFlow > 0 ? `Активный поток ${Math.round(totalActiveFlow)} л/мин` : 'Схема в режиме ожидания');
  if (project.simulation.lastEvent !== lastEvent) {
    events.push({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), type: 'simulation', message: lastEvent, severity: warnings.length ? 'warning' : 'info' });
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

export const getMediumColor = (medium: SoapNode['data']['medium']) => mediumPalette[medium].base;

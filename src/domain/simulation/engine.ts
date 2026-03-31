import { mediumPalette } from '../../ui/tokens/tokens';
import { EventLogEntry, FlowDirection, MediumType, ProjectDocument, RouteState, SimulationSettings, SoapEdge, SoapNode, SoapNodeData } from '../schemas/types';
import { PhysicsSimulationEngine } from '../physics/simulationEngine';
import { FluidProperties as PhysicsFluidProperties, HydraulicEdge, HydraulicNetworkInput, HydraulicNode } from '../physics/types';
import { FLUID_PRESETS } from '../physics/fluids';

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
const toFiniteNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const tankKinds = new Set(['source', 'tank', 'bufferTank', 'reactor', 'heatedReactor']);
const pumpKinds = new Set(['pump', 'dosingPump']);
const valveKinds = new Set(['manualValve', 'shutoffValve', 'solenoidValve', 'checkValve', 'controlValve', 'gateValve', 'drainValve', 'reliefValve']);
const sensorKinds = new Set(['flowMeter', 'pressureSensor', 'temperatureSensor', 'levelSensor', 'phSensor', 'conductivitySensor', 'indicator']);
const reactorKinds = new Set(['reactor', 'heatedReactor']);
const intakeControlledKinds = new Set(['tank', 'bufferTank', 'reactor', 'heatedReactor', 'fillingStation', 'consumer', 'utilityDrain']);

const parseDnToMeters = (dn?: string) => {
  const parsed = Number(String(dn ?? 'DN50').replace(/[^\d.]/g, ''));
  return clamp((Number.isFinite(parsed) && parsed > 0 ? parsed : 50) / 1000, 0.01, 0.6);
};
const parseDiameterFromEdgeData = (edge: SoapEdge) => {
  const explicitMm = Number(edge.data?.innerDiameterMm);
  if (Number.isFinite(explicitMm) && explicitMm > 0) return clamp(explicitMm / 1000, 0.005, 0.6);
  return parseDnToMeters(edge.data?.nominalDiameter);
};

const metersFromLiters = (liters: number) => Math.max(0, Number(liters) || 0) / 1000;
const litersFromM3 = (m3: number) => Math.max(0, Number(m3) || 0) * 1000;

const resolveFluid = (project: ProjectDocument): PhysicsFluidProperties => {
  const custom = project.simulation.fluid;
  if (custom) {
    return {
      id: custom.id,
      kind: custom.kind,
      name: custom.name,
      densityKgPerM3: Number(custom.densityKgPerM3),
      dynamicViscosityPaS: Number(custom.dynamicViscosityPaS),
      bulkModulusPa: custom.bulkModulusPa,
    };
  }
  const preset = FLUID_PRESETS[0];
  return {
    id: preset.id,
    kind: preset.id === 'water' ? 'water' : preset.id === 'ethylene-glycol' ? 'glycol' : 'custom',
    name: preset.name,
    densityKgPerM3: preset.density_kg_m3,
    dynamicViscosityPaS: preset.dynamicViscosity_Pa_s,
  };
};

const buildHydraulicNetwork = (project: ProjectDocument): HydraulicNetworkInput => {
  const nodes: HydraulicNode[] = project.nodes.map((node) => {
    const process = node.data.process as any;
    const elevationM = Number(process.elevationM ?? 0);
    if (tankKinds.has(node.data.kind)) {
      const capacityM3 = metersFromLiters(process.capacityLiters ?? process.capacity ?? 0);
      const volumeM3 = metersFromLiters(process.currentLevelLiters ?? process.level ?? 0);
      const area = Math.max(Number(process.crossSectionAreaM2 ?? 1), 0.1);
      return {
        id: node.id,
        kind: 'tank',
        elevationM,
        volumeM3,
        liquidLevelM: volumeM3 / area,
        crossSectionAreaM2: area,
        minVolumeM3: 0,
        maxVolumeM3: Math.max(capacityM3, 0.001),
      };
    }
    return { id: node.id, kind: 'junction', elevationM };
  });

  const edges: HydraulicEdge[] = project.edges.map((edge) => {
    const source = project.nodes.find((node) => node.id === edge.source);
    const target = project.nodes.find((node) => node.id === edge.target);
    const sx = source?.position.x ?? 0;
    const sy = source?.position.y ?? 0;
    const tx = target?.position.x ?? sx + 100;
    const ty = target?.position.y ?? sy;
    const lengthM = Math.max(1, Number(edge.data?.lengthM ?? Math.hypot(tx - sx, ty - sy) / 30));
    const innerDiameterM = parseDiameterFromEdgeData(edge);

    if (source && pumpKinds.has(source.data.kind)) {
      const p = source.data.process as any;
      return {
        id: edge.id,
        kind: 'pump',
        fromNodeId: edge.source,
        toNodeId: edge.target,
        ratedFlowM3PerS: Math.max(0, Number(p.nominalFlowLpm ?? p.flowRate ?? 0) / 60000),
        ratedHeadM: Math.max(1, Number(p.nominalHeadM ?? p.ratedHeadM ?? 20)),
        efficiency: clamp(Number(p.efficiency ?? 0.75), 0.1, 1),
        speedRatio: Boolean(p.pumpOn ?? true) ? clamp(Number(p.speedFactor ?? p.speedRatio ?? 1), 0, 2) : 0,
      };
    }

    if (source?.data.kind === 'source') {
      const p = source.data.process as any;
      const ratedFlowLpm = Math.max(0, Number(p.actualFlowLpm ?? p.flowRate ?? p.nominalFlowLpm ?? 0));
      if (ratedFlowLpm > 0) {
        return {
          id: edge.id,
          kind: 'pump',
          fromNodeId: edge.source,
          toNodeId: edge.target,
          ratedFlowM3PerS: ratedFlowLpm / 60000,
          ratedHeadM: Math.max(1, Number(p.nominalHeadM ?? p.ratedHeadM ?? 12)),
          efficiency: clamp(Number(p.efficiency ?? 0.75), 0.1, 1),
          speedRatio: Boolean(p.allowDischarge ?? p.canDischarge ?? true) ? 1 : 0,
        };
      }
    }

    const sourceValve = source && valveKinds.has(source.data.kind);
    const targetValve = target && valveKinds.has(target.data.kind);
    if (sourceValve || targetValve) {
      const valveNode = sourceValve ? source : target;
      const p = (valveNode!.data.process as any);
      return {
        id: edge.id,
        kind: 'valve',
        fromNodeId: edge.source,
        toNodeId: edge.target,
        kvM3PerHour: Math.max(0.1, Number(p.kvM3PerHour ?? p.kv ?? 12)),
        openingRatio: Boolean(p.isOpen ?? p.valveOpen ?? true) ? 1 : 0,
        isCheckValve: valveNode!.data.kind === 'checkValve',
      };
    }

    return {
      id: edge.id,
      kind: 'pipe',
      fromNodeId: edge.source,
      toNodeId: edge.target,
      lengthM,
      innerDiameterM,
      roughnessM: Number(edge.data?.roughnessM ?? 0.000045),
      minorLossCoefficient: Number(edge.data?.localResistanceZeta ?? edge.data?.minorLossCoefficient ?? 1.2),
    };
  });

  return { id: project.id, fluid: resolveFluid(project), nodes, edges };
};

const mapRouteState = (flow: number, blocked: boolean): RouteState => (blocked ? 'blocked' : flow > 0.001 ? 'flowing' : 'idle');

const pushEvent = (events: EventLogEntry[], type: string, message: string, severity: EventLogEntry['severity'], targetId?: string) => {
  events.push({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), type, message, severity, targetId });
};

const syncProcessCommandState = (node: SoapNode) => {
  const process = node.data.process as any;
  process.allowIntake = Boolean(process.allowIntake ?? process.canReceive ?? true);
  process.allowDischarge = Boolean(process.allowDischarge ?? process.canDischarge ?? true);
  process.isRunning = Boolean(process.isRunning ?? process.pumpOn ?? process.mixingOn ?? process.heatingOn ?? node.data.status === 'running');
  process.isBlocked = Boolean(process.isBlocked ?? false);
  process.processState = String(process.processState ?? 'idle');
  process.mode = String(process.mode ?? node.data.mode ?? 'auto');
  process.canReceive = process.allowIntake;
  process.canDischarge = process.allowDischarge;
};

type RouteSegment = {
  id: string;
  sourceId: string;
  targetId: string;
};

type RouteCandidate = {
  nodeIds: string[];
  edgeIds: string[];
};

type PhysicalNodeRole = 'source' | 'accumulator' | 'transfer' | 'sink' | 'blocker';
type PhysicalEdgeRole = 'pumpingElement' | 'valveElement' | 'passiveResistance';

type ExecutableNode = {
  node: SoapNode;
  role: PhysicalNodeRole;
};

type ExecutableEdge = {
  edge: SoapEdge;
  role: PhysicalEdgeRole;
};

type ExecutableRoute = {
  candidate: RouteCandidate;
  nodes: ExecutableNode[];
  edges: ExecutableEdge[];
};

type RouteEvaluation = {
  route: ExecutableRoute;
  requestedFlowLpm: number;
  actualFlowLpm: number;
  blockers: string[];
  active: boolean;
};

const resolveNodeRole = (node: SoapNode): PhysicalNodeRole => {
  if (tankKinds.has(node.data.kind) && node.data.kind === 'source') return 'source';
  if (tankKinds.has(node.data.kind)) return 'accumulator';
  if (node.data.kind === 'consumer' || node.data.kind === 'utilityDrain' || node.data.kind === 'fillingStation') return 'sink';
  if (pumpKinds.has(node.data.kind) || valveKinds.has(node.data.kind)) return 'transfer';
  return 'transfer';
};

const resolveEdgeRole = (edge: SoapEdge, nodeById: Map<string, SoapNode>): PhysicalEdgeRole => {
  const source = nodeById.get(edge.source);
  const target = nodeById.get(edge.target);
  if ((source && pumpKinds.has(source.data.kind)) || (target && pumpKinds.has(target.data.kind))) return 'pumpingElement';
  if ((source && valveKinds.has(source.data.kind)) || (target && valveKinds.has(target.data.kind))) return 'valveElement';
  return 'passiveResistance';
};

const buildExecutableRoutes = (nodes: SoapNode[], edges: SoapEdge[]): ExecutableRoute[] => {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edgeById = new Map(edges.map((edge) => [edge.id, edge]));
  return enumerateRoutes(nodes, edges).map((candidate) => ({
    candidate,
    nodes: candidate.nodeIds.map((nodeId) => ({ node: nodeById.get(nodeId)!, role: resolveNodeRole(nodeById.get(nodeId)!) })),
    edges: candidate.edgeIds.map((edgeId) => ({ edge: edgeById.get(edgeId)!, role: resolveEdgeRole(edgeById.get(edgeId)!, nodeById) })),
  }));
};

const nodeAcceptsFlow = (node: SoapNode) => {
  const process = node.data.process as any;
  syncProcessCommandState(node);
  if (!Boolean(node.data.isEnabled ?? true)) return false;
  if (tankKinds.has(node.data.kind)) return Boolean(process.allowIntake) && toFiniteNumber(process.currentLevelLiters ?? process.level, 0) < toFiniteNumber(process.capacityLiters ?? process.capacity, 0);
  if (node.data.kind === 'consumer' || node.data.kind === 'utilityDrain' || node.data.kind === 'fillingStation') return Boolean(process.allowIntake);
  return Boolean(process.allowIntake);
};

const nodeCanPassFlow = (node: SoapNode) => {
  const process = node.data.process as any;
  syncProcessCommandState(node);
  if (!Boolean(node.data.isEnabled ?? true) || !Boolean(node.data.simulationEnabled ?? true)) {
    return { pass: false, reason: `${node.data.visibleName}: элемент отключён` };
  }
  if (pumpKinds.has(node.data.kind)) {
    const pumpOn = Boolean(process.isRunning ?? process.pumpOn ?? process.isOn ?? process.enabled ?? node.data.status === 'running');
    const startAllowed = Boolean(process.startAllowed ?? true);
    const suctionAvailable = Boolean(process.suctionAvailable ?? true);
    if (!pumpOn) return { pass: false, reason: `${node.data.visibleName}: насос выключен` };
    if (!startAllowed) return { pass: false, reason: `${node.data.visibleName}: пуск насоса запрещён` };
    if (!suctionAvailable) return { pass: false, reason: `${node.data.visibleName}: нет подпитки на всасе` };
  }
  if (valveKinds.has(node.data.kind)) {
    const isOpen = Boolean(process.isOpen ?? process.valveOpen ?? process.valveState !== 'closed');
    if (!isOpen) return { pass: false, reason: `${node.data.visibleName}: клапан закрыт` };
  }
  if (tankKinds.has(node.data.kind) && Boolean(process.allowDischarge) === false) {
    return { pass: false, reason: `${node.data.visibleName}: выдача запрещена` };
  }
  if (reactorKinds.has(node.data.kind) && Boolean(process.isRunning ?? true) === false) {
    return { pass: false, reason: `${node.data.visibleName}: реактор в ожидании` };
  }
  return { pass: true, reason: '' };
};

const enumerateRoutes = (nodes: SoapNode[], edges: SoapEdge[]): RouteCandidate[] => {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, RouteSegment[]>();
  edges.forEach((edge) => {
    const list = outgoing.get(edge.source) ?? [];
    list.push({ id: edge.id, sourceId: edge.source, targetId: edge.target });
    outgoing.set(edge.source, list);
  });

  const routes: RouteCandidate[] = [];
  const maxDepth = Math.max(1, edges.length + 1);
  const sourceNodes = nodes.filter((node) => tankKinds.has(node.data.kind));

  const dfs = (currentNodeId: string, visitedNodes: Set<string>, nodeIds: string[], edgeIds: string[]) => {
    if (edgeIds.length > maxDepth) return;
    const currentNode = nodeById.get(currentNodeId);
    if (!currentNode) return;
    const nextEdges = outgoing.get(currentNodeId) ?? [];
    const isSinkKind = currentNode.data.kind === 'fillingStation' || currentNode.data.kind === 'consumer' || currentNode.data.kind === 'utilityDrain';
    const isTerminalReceiver = nodeIds.length > 1 && nodeAcceptsFlow(currentNode) && (isSinkKind || nextEdges.length === 0);
    if (isTerminalReceiver) {
      routes.push({ nodeIds: [...nodeIds], edgeIds: [...edgeIds] });
      return;
    }

    nextEdges.forEach((segment) => {
      if (visitedNodes.has(segment.targetId)) return;
      visitedNodes.add(segment.targetId);
      nodeIds.push(segment.targetId);
      edgeIds.push(segment.id);
      dfs(segment.targetId, visitedNodes, nodeIds, edgeIds);
      edgeIds.pop();
      nodeIds.pop();
      visitedNodes.delete(segment.targetId);
    });
  };

  sourceNodes.forEach((sourceNode) => {
    const visited = new Set<string>([sourceNode.id]);
    dfs(sourceNode.id, visited, [sourceNode.id], []);
  });

  return routes;
};

export const runSimulationStep = (project: ProjectDocument, dt: number): SimulationResult => {
  const events: EventLogEntry[] = [];
  const warnings: string[] = [];
  const nextNodes = project.nodes.map((node) => structuredClone(node));
  const nextEdges = project.edges.map((edge) => structuredClone(edge));

  const network = buildHydraulicNetwork({ ...project, nodes: nextNodes, edges: nextEdges });
  const engine = new PhysicsSimulationEngine(network);
  const speedRatio = Math.max(0, project.simulation.speed);
  const pumpSpeedRatioById: Record<string, number> = {};
  network.edges.forEach((edge) => {
    if (edge.kind !== 'pump') return;
    pumpSpeedRatioById[edge.id] = Math.max(0, (edge.speedRatio ?? 1) * speedRatio);
  });
  const uiResult = engine.step({
    dtSeconds: Math.max(0.01, dt * speedRatio),
    overrides: { pumpSpeedRatioById },
  });
  const edgeResultById = new Map(uiResult.edges.map((edge) => [edge.edgeId, edge]));
  const nodeResultById = new Map(uiResult.nodes.map((node) => [node.nodeId, node]));
  const nodeById = new Map(nextNodes.map((node) => [node.id, node]));

  nextNodes.forEach((node) => {
    syncProcessCommandState(node);
    node.data.simulation.flowLpm = 0;
    node.data.simulation.flow = 0;
    node.data.simulation.active = false;
    node.data.simulation.blocked = false;
    node.data.simulation.routeState = 'idle';
  });

  let totalActiveFlow = 0;
  const activeMediums = new Set<string>();
  const dtSeconds = Math.max(0.01, dt * project.simulation.speed);

  const edgeFlowById = new Map<string, number>();
  const edgeBlockedBy = new Map<string, string[]>();
  nextEdges.forEach((edge) => {
    let flowLpm = Math.max(0, toFiniteNumber(edgeResultById.get(edge.id)?.flowLpm, 0));
    const reasons: string[] = [];
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) reasons.push('маршрут разорван');
    if (source) {
      const sourceGate = nodeCanPassFlow(source);
      if (!sourceGate.pass) reasons.push(sourceGate.reason);
    }
    if (target) {
      const targetGate = nodeCanPassFlow(target);
      if (!targetGate.pass) reasons.push(targetGate.reason);
      if (!nodeAcceptsFlow(target)) reasons.push(`${target.data.visibleName}: приём запрещён downstream`);
    }
    if (reasons.length > 0) flowLpm = 0;
    edgeFlowById.set(edge.id, flowLpm);
    if (flowLpm <= 0.001 && reasons.length === 0) reasons.push('гидравлика: Q = 0');
    edgeBlockedBy.set(edge.id, Array.from(new Set(reasons)));
  });

  const qInByNodeId = new Map<string, number>();
  const qOutByNodeId = new Map<string, number>();
  nextEdges.forEach((edge) => {
    const flow = edgeFlowById.get(edge.id) ?? 0;
    if (flow <= 0.001) return;
    qOutByNodeId.set(edge.source, (qOutByNodeId.get(edge.source) ?? 0) + flow);
    qInByNodeId.set(edge.target, (qInByNodeId.get(edge.target) ?? 0) + flow);
  });

  nextEdges.forEach((edge) => {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) return;
    const flowLpm = Math.max(0, toFiniteNumber(edgeFlowById.get(edge.id), 0));
    const blockedReasons = Array.from(new Set(edgeBlockedBy.get(edge.id) ?? []));
    if (flowLpm <= 0.001 && blockedReasons.length === 0) {
      const sourceGate = nodeCanPassFlow(source);
      const targetGate = nodeCanPassFlow(target);
      if (!sourceGate.pass) blockedReasons.push(sourceGate.reason);
      if (!targetGate.pass) blockedReasons.push(targetGate.reason);
      if (!nodeAcceptsFlow(target)) blockedReasons.push(`${target.data.visibleName}: приём запрещён downstream`);
      if (!blockedReasons.length) blockedReasons.push('маршрут в ожидании: Q = 0');
    }
    const blocked = flowLpm <= 0.001 && blockedReasons.length > 0;
    const routeState = mapRouteState(flowLpm, blocked);
    const hydraulic = edgeResultById.get(edge.id);
    edge.animated = flowLpm > 0.001;
    edge.data = {
      ...edge.data,
      flowLpm,
      flowRate: flowLpm,
      flowActive: flowLpm > 0.001,
      blocked,
      routeState,
      pressure: Number(hydraulic?.pressureDropBar ?? 0),
      velocityMPerS: Number(hydraulic?.velocityMPerS ?? 0),
      hydraulicLossBar: Number(hydraulic?.pressureDropBar ?? 0),
      reynolds: Number(hydraulic?.reynolds ?? 0),
      frictionFactor: Number(hydraulic?.frictionFactor ?? 0),
      lengthM: Number(hydraulic?.lengthM ?? edge.data?.lengthM ?? 0),
      innerDiameterMm: Number((hydraulic?.diameterM ?? parseDiameterFromEdgeData(edge)) * 1000),
      roughnessM: Number(edge.data?.roughnessM ?? 0.000045),
      localResistanceZeta: Number(hydraulic?.localResistanceZeta ?? edge.data?.localResistanceZeta ?? edge.data?.minorLossCoefficient ?? 0),
      minorLossCoefficient: Number(hydraulic?.localResistanceZeta ?? edge.data?.localResistanceZeta ?? edge.data?.minorLossCoefficient ?? 0),
      pumpHeadGainM: Number(hydraulic?.pumpHeadGainM ?? 0),
      hydraulicConstraint: String(hydraulic?.hydraulicConstraint ?? ''),
      sourceLabel: source.data.visibleName,
      targetLabel: target.data.visibleName,
      stateLabel: routeState === 'flowing' ? 'Поток' : blocked ? 'Блокировка' : 'Ожидание',
      direction: (edge.data?.direction ?? 'forward') as FlowDirection,
      routeWarnings: blockedReasons,
      blockedBy: blockedReasons,
    } as any;

    totalActiveFlow += flowLpm;
    activeMediums.add(String(edge.data?.mediumType ?? source.data.mediumType));
  });

  const nodeBlockedReasons = new Map<string, string[]>();
  nextEdges.forEach((edge) => {
    const reasons = edgeBlockedBy.get(edge.id) ?? [];
    if (!reasons.length) return;
    nodeBlockedReasons.set(edge.source, [...(nodeBlockedReasons.get(edge.source) ?? []), ...reasons]);
    nodeBlockedReasons.set(edge.target, [...(nodeBlockedReasons.get(edge.target) ?? []), ...reasons]);
  });

  nextNodes.forEach((node) => {
    const process = node.data.process as any;
    const result = nodeResultById.get(node.id);
    const qInLpm = qInByNodeId.get(node.id) ?? 0;
    const qOutLpm = qOutByNodeId.get(node.id) ?? 0;
    const netFlowLpm = qInLpm - qOutLpm;
    const localGate = nodeCanPassFlow(node);
    const reason = Array.from(new Set(nodeBlockedReasons.get(node.id) ?? []))[0] ?? '';

    process.pressureBar = Number(result?.pressureBar ?? process.pressureBar ?? 0);
    process.pressure = process.pressureBar;
    node.data.simulation.flowLpm = Math.max(0, qInLpm + qOutLpm);
    node.data.simulation.flow = node.data.simulation.flowLpm;
    node.data.simulation.active = qInLpm > 0.001 || qOutLpm > 0.001;
    node.data.simulation.blocked = !localGate.pass || (!node.data.simulation.active && reason.length > 0);
    node.data.simulation.routeState = node.data.simulation.active ? 'flowing' : node.data.simulation.blocked ? 'blocked' : 'idle';

    process.commandState = Boolean(process.isRunning) ? 'команда-вкл' : 'команда-выкл';
    process.actualState = node.data.simulation.active ? 'факт-поток' : node.data.simulation.blocked ? 'факт-блок' : 'факт-ожидание';
    process.stateReason = reason || (node.data.simulation.active ? 'маршрут активен' : 'ожидание подачи');

    if (tankKinds.has(node.data.kind)) {
      const currentVolumeLiters = Math.max(0, toFiniteNumber(process.currentLevelLiters ?? process.level, 0));
      const capacityLiters = Math.max(1, toFiniteNumber(process.capacityLiters ?? process.capacity, 1));
      const nextVolumeLiters = clamp(currentVolumeLiters + (netFlowLpm * dtSeconds) / 60, 0, capacityLiters);
      const levelPercent = (nextVolumeLiters / capacityLiters) * 100;
      const remainingToFillL = Math.max(0, capacityLiters - nextVolumeLiters);
      const remainingToDrainL = Math.max(0, nextVolumeLiters);
      process.levelPercent = levelPercent;
      process.currentLevelLiters = nextVolumeLiters;
      process.level = nextVolumeLiters;
      process.fillTimeSeconds = netFlowLpm > 0.001 ? (remainingToFillL / netFlowLpm) * 60 : null;
      process.drainTimeSeconds = netFlowLpm < -0.001 ? (remainingToDrainL / Math.abs(netFlowLpm)) * 60 : null;
      process.netFlowLpm = netFlowLpm;
      node.data.visual.fill = levelPercent;
      if (levelPercent >= 99.9) warnings.push(`${node.data.visibleName}: ёмкость заполнена.`);
    }

    if (sensorKinds.has(node.data.kind)) {
      const measured = String(process.measuredProperty ?? process.signalType ?? 'flow');
      if (measured.includes('flow')) process.currentValue = node.data.simulation.flowLpm;
      if (measured.includes('pressure')) process.currentValue = process.pressureBar;
      if (measured.includes('level')) process.currentValue = Number(process.levelPercent ?? 0);
      process.signalValue = Number(process.currentValue ?? 0);
    }

    process.isBlocked = node.data.simulation.blocked;
    if (!Boolean(node.data.simulationEnabled ?? true)) process.processState = 'offline';
    else if (node.data.simulation.blocked) process.processState = 'blocked';
    else if (node.data.simulation.active) process.processState = 'transferring';
    else if (Boolean(process.isRunning)) process.processState = 'waiting';
    else process.processState = 'idle';

    if (pumpKinds.has(node.data.kind)) {
      const pumpOn = Boolean(process.isRunning ?? process.pumpOn ?? process.isOn ?? process.enabled ?? node.data.status === 'running');
      node.data.status = !pumpOn ? 'off' : node.data.simulation.active ? 'running' : 'blocked';
    } else if (valveKinds.has(node.data.kind)) {
      const isOpen = Boolean(process.isOpen ?? process.valveOpen ?? process.valveState !== 'closed');
      node.data.status = !isOpen ? 'blocked' : node.data.simulation.active ? 'active' : 'idle';
    } else if (tankKinds.has(node.data.kind)) {
      node.data.status = Math.abs(netFlowLpm) > 0.001 ? 'running' : 'idle';
    }
    if (intakeControlledKinds.has(node.data.kind)) {
      process.canReceive = process.allowIntake;
      process.canDischarge = process.allowDischarge;
    }
    node.data.runtime.lastEvent = reason;
    node.data.runtime.alarmText = reason;
    node.data.simulation.lastEvent = reason;
    node.data.simulation.alarmText = reason;
    node.data.runtime = { ...node.data.runtime, ...node.data.simulation };
  });

  warnings.push(...uiResult.warnings);
  warnings.forEach((warning) => pushEvent(events, 'physics', warning, 'warning'));
  const activeMedium = activeMediums.size === 0 ? 'none' : activeMediums.size === 1 ? [...activeMediums][0] as any : 'mixed';
  const lastEvent = warnings[0] ?? (totalActiveFlow > 0 ? `Физический расход ${Math.round(totalActiveFlow)} л/мин` : 'Схема в режиме ожидания');
  pushEvent(events, 'simulation', lastEvent, warnings.length ? 'warning' : 'info');

  return { nodes: nextNodes, edges: nextEdges, warnings: Array.from(new Set(warnings)), events, activeMedium, totalActiveFlow, lastEvent };
};

export const getMediumColor = (medium: SoapNodeData['medium']) => mediumPalette[medium].base;

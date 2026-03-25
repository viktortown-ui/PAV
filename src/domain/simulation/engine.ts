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
const tankKinds = new Set(['source', 'tank', 'bufferTank', 'reactor', 'heatedReactor']);
const pumpKinds = new Set(['pump', 'dosingPump']);
const valveKinds = new Set(['manualValve', 'shutoffValve', 'solenoidValve', 'checkValve', 'controlValve', 'gateValve', 'drainValve', 'reliefValve']);
const sensorKinds = new Set(['flowMeter', 'pressureSensor', 'temperatureSensor', 'levelSensor', 'phSensor', 'conductivitySensor', 'indicator']);

const parseDnToMeters = (dn?: string) => {
  const parsed = Number(String(dn ?? 'DN50').replace(/[^\d.]/g, ''));
  return clamp((Number.isFinite(parsed) && parsed > 0 ? parsed : 50) / 1000, 0.01, 0.6);
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
    const innerDiameterM = parseDnToMeters(edge.data?.nominalDiameter);

    if (source && pumpKinds.has(source.data.kind)) {
      const p = source.data.process as any;
      return {
        id: edge.id,
        kind: 'pump',
        fromNodeId: edge.source,
        toNodeId: edge.target,
        ratedFlowM3PerS: Math.max(0, Number(p.nominalFlowLpm ?? p.flowRate ?? 0) / 60000),
        ratedHeadM: Math.max(1, Number(p.ratedHeadM ?? 20)),
        efficiency: clamp(Number(p.efficiency ?? 0.75), 0.1, 1),
        speedRatio: Boolean(p.pumpOn ?? true) ? clamp(Number(p.speedRatio ?? 1), 0, 2) : 0,
      };
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
      minorLossCoefficient: Number(edge.data?.minorLossCoefficient ?? 1.2),
    };
  });

  return { id: project.id, fluid: resolveFluid(project), nodes, edges };
};

const mapRouteState = (flow: number, blocked: boolean): RouteState => (blocked ? 'blocked' : flow > 0.001 ? 'flowing' : 'idle');

const pushEvent = (events: EventLogEntry[], type: string, message: string, severity: EventLogEntry['severity'], targetId?: string) => {
  events.push({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), type, message, severity, targetId });
};

export const runSimulationStep = (project: ProjectDocument, dt: number): SimulationResult => {
  const events: EventLogEntry[] = [];
  const warnings: string[] = [];
  const nextNodes = project.nodes.map((node) => structuredClone(node));
  const nextEdges = project.edges.map((edge) => structuredClone(edge));

  const network = buildHydraulicNetwork({ ...project, nodes: nextNodes, edges: nextEdges });
  const engine = new PhysicsSimulationEngine(network);
  const uiResult = engine.step({ dtSeconds: Math.max(0.01, dt * project.simulation.speed) });
  const edgeResultById = new Map(uiResult.edges.map((edge) => [edge.edgeId, edge]));
  const nodeResultById = new Map(uiResult.nodes.map((node) => [node.nodeId, node]));
  const fallbackSourceFlowLpm = project.nodes.reduce((maxFlow, node) => {
    const process = node.data.process as any;
    return Math.max(maxFlow, Number(process.actualFlowLpm ?? process.flowRate ?? 0));
  }, 0) * project.simulation.speed;

  let totalActiveFlow = 0;
  const activeMediums = new Set<string>();

  nextEdges.forEach((edge) => {
    const result = edgeResultById.get(edge.id);
    const source = nextNodes.find((node) => node.id === edge.source);
    const target = nextNodes.find((node) => node.id === edge.target);
    if (!result || !source || !target) return;

    const flowFromSolver = Math.max(0, Number(result.flowLpm));
    const flowLpm = flowFromSolver > 0.001 ? flowFromSolver : (fallbackSourceFlowLpm > 0 && nextEdges.length === 1 ? fallbackSourceFlowLpm : 0);
    const blocked = flowLpm <= 0.001 && (pumpKinds.has(source.data.kind) || valveKinds.has(source.data.kind) || valveKinds.has(target.data.kind));
    const routeState = mapRouteState(flowLpm, blocked);
    edge.animated = flowLpm > 0.001;
    edge.data = {
      ...edge.data,
      flowLpm,
      flowRate: flowLpm,
      flowActive: flowLpm > 0.001,
      blocked,
      routeState,
      pressure: Number(result.pressureDropBar),
      velocityMPerS: Number(result.velocityMPerS ?? 0),
      sourceLabel: source.data.visibleName,
      targetLabel: target.data.visibleName,
      stateLabel: routeState === 'flowing' ? 'Поток' : blocked ? 'Блокировка' : 'Ожидание',
      direction: (edge.data?.direction ?? 'forward') as FlowDirection,
      routeWarnings: blocked ? ['Нулевой расход по расчёту'] : [],
    } as any;

    source.data.simulation.flowLpm = Math.max(source.data.simulation.flowLpm, flowLpm);
    target.data.simulation.flowLpm = Math.max(target.data.simulation.flowLpm, flowLpm);
    source.data.simulation.flow = source.data.simulation.flowLpm;
    target.data.simulation.flow = target.data.simulation.flowLpm;
    source.data.simulation.active = source.data.simulation.flowLpm > 0.001;
    target.data.simulation.active = target.data.simulation.flowLpm > 0.001;
    source.data.simulation.routeState = source.data.simulation.active ? routeState : 'idle';
    target.data.simulation.routeState = target.data.simulation.active ? routeState : 'idle';
    source.data.runtime = { ...source.data.runtime, ...source.data.simulation };
    target.data.runtime = { ...target.data.runtime, ...target.data.simulation };
    totalActiveFlow += flowLpm;
    activeMediums.add(String(edge.data?.mediumType ?? source.data.mediumType));
  });

  nextNodes.forEach((node) => {
    const process = node.data.process as any;
    const result = nodeResultById.get(node.id);
    if (!result) return;

    process.pressureBar = Number(result.pressureBar ?? process.pressureBar ?? 0);
    process.pressure = process.pressureBar;

    if (tankKinds.has(node.data.kind)) {
      const levelPercent = Number(result.levelPercent ?? 0);
      const volumeLiters = litersFromM3(Number(result.volumeM3 ?? 0));
      process.levelPercent = levelPercent;
      process.currentLevelLiters = volumeLiters;
      process.level = volumeLiters;
      process.fillTimeSeconds = result.fillTimeSeconds ?? null;
      process.drainTimeSeconds = result.drainTimeSeconds ?? null;
      process.netFlowLpm = Number(result.netFlowLpm ?? 0);
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
  });

  warnings.push(...uiResult.warnings);
  warnings.forEach((warning) => pushEvent(events, 'physics', warning, 'warning'));
  const activeMedium = activeMediums.size === 0 ? 'none' : activeMediums.size === 1 ? [...activeMediums][0] as any : 'mixed';
  const lastEvent = warnings[0] ?? (totalActiveFlow > 0 ? `Физический расход ${Math.round(totalActiveFlow)} л/мин` : 'Схема в режиме ожидания');
  pushEvent(events, 'simulation', lastEvent, warnings.length ? 'warning' : 'info');

  return { nodes: nextNodes, edges: nextEdges, warnings: Array.from(new Set(warnings)), events, activeMedium, totalActiveFlow, lastEvent };
};

export const getMediumColor = (medium: SoapNodeData['medium']) => mediumPalette[medium].base;

import { ENGINE_LIMITS, PHYSICS_CONSTANTS } from './constants';
import { darcyFrictionFactor } from './frictionFactor';
import { flowVelocityMPerS } from './flowVelocity';
import { localResistancePressureLossPa } from './localResistance';
import { validatePhysicsInput } from './physicsInputValidation';
import { pumpHeadMAtFlow } from './pumpCurve';
import { darcyWeisbachPressureLossPa } from './pressureLoss';
import { classifyFlowRegime, reynoldsNumber } from './reynolds';
import { advanceSimulationClock, createInitialSimulationState, setSolverSnapshot } from './state';
import {
  HydraulicEdge,
  HydraulicNetworkInput,
  PipeEdge,
  SimulationState,
  SimulationStepInput,
  SimulationUiResult,
  SolverSnapshot,
  TankNode,
  TankState,
} from './types';
import { convertM3PerSToLpm, convertPaToBar } from './units';

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export class PhysicsSimulationEngine {
  private state: SimulationState;

  constructor(input: HydraulicNetworkInput) {
    const issues = validatePhysicsInput(input);
    if (issues.length > 0) {
      const lines = issues.map((issue) => `${issue.code}: ${issue.message}`).join('\n');
      throw new Error(`Invalid hydraulic network:\n${lines}`);
    }

    this.state = createInitialSimulationState(input);
  }

  getState(): SimulationState {
    return this.state;
  }

  step(stepInput: SimulationStepInput): SimulationUiResult {
    const dtSeconds = clamp(stepInput.dtSeconds, ENGINE_LIMITS.minTimeStepSeconds, ENGINE_LIMITS.maxTimeStepSeconds);
    const network = this.buildNetwork(stepInput);
    const networkWithFluid = this.applyFluidProperties(network);
    this.state = {
      ...this.state,
      network: networkWithFluid,
    };

    const snapshot = this.solveSteadyStateFlow(networkWithFluid);
    const tankWarnings = this.updateTankVolumes(snapshot, dtSeconds, stepInput);
    this.state = setSolverSnapshot(this.state, {
      ...snapshot,
      warnings: [...snapshot.warnings, ...tankWarnings],
    });
    this.state = advanceSimulationClock(this.state, dtSeconds);

    return this.toUiResult(this.state.latestSnapshot);
  }

  private buildNetwork(stepInput: SimulationStepInput): HydraulicNetworkInput {
    const overrides = stepInput.overrides;
    if (!overrides) return this.state.network;

    return {
      ...this.state.network,
      fluid: overrides.fluid ?? this.state.network.fluid,
      edges: this.state.network.edges.map((edge) => {
        if (edge.kind === 'pump' && overrides.pumpSpeedRatioById?.[edge.id] !== undefined) {
          return {
            ...edge,
            speedRatio: clamp(overrides.pumpSpeedRatioById[edge.id], 0, 2),
          };
        }

        if (edge.kind === 'valve' && overrides.valveOpeningRatioById?.[edge.id] !== undefined) {
          return {
            ...edge,
            openingRatio: clamp(overrides.valveOpeningRatioById[edge.id], 0, 1),
          };
        }

        return edge;
      }),
    };
  }

  private applyFluidProperties(network: HydraulicNetworkInput): HydraulicNetworkInput {
    return network;
  }

  private solveSteadyStateFlow(network: HydraulicNetworkInput): SolverSnapshot {
    const { densityKgPerM3, dynamicViscosityPaS } = network.fluid;
    const seriesCapable = this.isSeriesNetwork(network);
    const flowM3PerS = seriesCapable ? this.solveSeriesNetworkFlow(network) : 0;
    const edgeResults = network.edges.map((edge) => this.solveEdge(edge, densityKgPerM3, dynamicViscosityPaS, flowM3PerS));
    const nodeResults = network.nodes.map((node) => ({
      nodeId: node.id,
      pressurePa: PHYSICS_CONSTANTS.atmosphericPressurePa,
      headM: node.elevationM,
    }));

    return {
      nodeResults,
      edgeResults,
      warnings: seriesCapable
        ? []
        : ['Steady-state solver currently supports series hydraulic chains without branching; non-series graphs return zero flow.'],
    };
  }

  private solveEdge(
    edge: HydraulicEdge,
    fluidDensity: number,
    dynamicViscosityPaS: number,
    flowM3PerS: number,
  ) {
    if (edge.kind === 'pipe') {
      const velocityMPerS = flowVelocityMPerS(flowM3PerS, edge.innerDiameterM);
      const re = reynoldsNumber(fluidDensity, velocityMPerS, edge.innerDiameterM, dynamicViscosityPaS);
      const frictionFactor = darcyFrictionFactor(re, edge.roughnessM, edge.innerDiameterM);
      const frictionLossPa = darcyWeisbachPressureLossPa(
        frictionFactor,
        edge.lengthM,
        edge.innerDiameterM,
        fluidDensity,
        velocityMPerS,
      );
      const minorLossPa = localResistancePressureLossPa(edge.minorLossCoefficient ?? 0, fluidDensity, velocityMPerS);
      const pressureDropPa = frictionLossPa + minorLossPa;

      return {
        edgeId: edge.id,
        flowM3PerS,
        pressureDropPa,
        velocityMPerS,
        flowRegime: classifyFlowRegime(re),
      };
    }

    if (edge.kind === 'pump') {
      const headGainM = pumpHeadMAtFlow(edge, flowM3PerS);
      const pressureDropPa = -fluidDensity * PHYSICS_CONSTANTS.gravityMps2 * headGainM;

      return {
        edgeId: edge.id,
        flowM3PerS,
        pressureDropPa,
      };
    }

    const openingRatio = clamp(edge.openingRatio, 0, 1);
    if (openingRatio <= 0) {
      return {
        edgeId: edge.id,
        flowM3PerS: 0,
        pressureDropPa: PHYSICS_CONSTANTS.atmosphericPressurePa,
      };
    }
    const qM3PerHour = Math.abs(flowM3PerS) * 3600;
    const kvEffective = Math.max(edge.kvM3PerHour * openingRatio, 1e-9);
    const baseDropPa = ((qM3PerHour / kvEffective) ** 2) * 100_000;
    const pressureDropPa = baseDropPa;

    return {
      edgeId: edge.id,
      flowM3PerS,
      pressureDropPa,
    };
  }

  private isSeriesNetwork(network: HydraulicNetworkInput): boolean {
    const byNode = new Map<string, { incoming: number; outgoing: number }>();
    network.nodes.forEach((node) => byNode.set(node.id, { incoming: 0, outgoing: 0 }));
    network.edges.forEach((edge) => {
      const source = byNode.get(edge.fromNodeId);
      const target = byNode.get(edge.toNodeId);
      if (source) source.outgoing += 1;
      if (target) target.incoming += 1;
    });

    const branching = Array.from(byNode.values()).some((entry) => entry.incoming > 1 || entry.outgoing > 1);
    return !branching;
  }

  private solveSeriesNetworkFlow(network: HydraulicNetworkInput): number {
    const pumps = network.edges.filter((edge): edge is Extract<HydraulicEdge, { kind: 'pump' }> => edge.kind === 'pump');
    const commandedFlow = pumps.length > 0
      ? Math.min(...pumps.map((pump) => Math.max(0, pump.ratedFlowM3PerS * Math.max(pump.speedRatio ?? 1, 0))))
      : 0;
    const qUpper = Math.max(
      pumps.length > 0
        ? pumps.reduce((sum, pump) => sum + Math.max(0, pump.ratedFlowM3PerS * Math.max(pump.speedRatio ?? 1, 0)), 0) * 2
        : 0.05,
      PHYSICS_CONSTANTS.minimumPositiveFlowM3PerS,
    );

    const rootResidual = (flow: number): number => {
      const pumpHead = pumps.reduce((sum, pump) => sum + pumpHeadMAtFlow(pump, flow), 0);
      const lossHead = network.edges.reduce((sum, edge) => sum + this.edgeLossHeadM(edge, flow, network), 0);
      const staticHead = this.computeStaticHeadM(network);
      return pumpHead - staticHead - lossHead;
    };

    if (rootResidual(0) <= 0) return 0;
    if (commandedFlow > 0 && rootResidual(commandedFlow) >= 0) return commandedFlow;

    let low = 0;
    let high = commandedFlow > 0 ? commandedFlow : qUpper;
    for (let i = 0; i < 40; i += 1) {
      const mid = 0.5 * (low + high);
      const residual = rootResidual(mid);
      if (Math.abs(residual) < 1e-6) return mid;
      if (residual > 0) low = mid;
      else high = mid;
    }
    return 0.5 * (low + high);
  }

  private edgeLossHeadM(edge: HydraulicEdge, flowM3PerS: number, network: HydraulicNetworkInput): number {
    const fluidDensity = network.fluid.densityKgPerM3;
    const fluidViscosity = network.fluid.dynamicViscosityPaS;
    const gravity = PHYSICS_CONSTANTS.gravityMps2;

    if (edge.kind === 'pump') return 0;
    if (edge.kind === 'valve') {
      const opening = clamp(edge.openingRatio, 0, 1);
      if (opening <= 0) return Number.POSITIVE_INFINITY;
      const qM3PerHour = Math.abs(flowM3PerS) * 3600;
      const kvEffective = Math.max(edge.kvM3PerHour * opening, 1e-9);
      const dropPa = ((qM3PerHour / kvEffective) ** 2) * 100_000;
      return dropPa / (fluidDensity * gravity);
    }

    return this.pipeLossHeadM(edge, flowM3PerS, fluidDensity, fluidViscosity);
  }

  private pipeLossHeadM(
    pipe: PipeEdge,
    flowM3PerS: number,
    densityKgPerM3: number,
    dynamicViscosityPaS: number,
  ): number {
    const velocity = flowVelocityMPerS(flowM3PerS, pipe.innerDiameterM);
    const re = reynoldsNumber(densityKgPerM3, velocity, pipe.innerDiameterM, dynamicViscosityPaS);
    const frictionFactor = darcyFrictionFactor(re, pipe.roughnessM, pipe.innerDiameterM);
    const pressureLoss = darcyWeisbachPressureLossPa(
      frictionFactor,
      pipe.lengthM,
      pipe.innerDiameterM,
      densityKgPerM3,
      velocity,
    ) + localResistancePressureLossPa(pipe.minorLossCoefficient ?? 0, densityKgPerM3, velocity);
    return pressureLoss / (densityKgPerM3 * PHYSICS_CONSTANTS.gravityMps2);
  }

  private computeStaticHeadM(network: HydraulicNetworkInput): number {
    const nodeById = new Map(network.nodes.map((node) => [node.id, node]));
    const startNode = network.nodes.find((candidate) => !network.edges.some((edge) => edge.toNodeId === candidate.id));
    const endNode = network.nodes.find((candidate) => !network.edges.some((edge) => edge.fromNodeId === candidate.id));
    if (!startNode || !endNode) return 0;
    const start = nodeById.get(startNode.id);
    const end = nodeById.get(endNode.id);
    if (!start || !end) return 0;
    return end.elevationM - start.elevationM;
  }

  private updateTankVolumes(snapshot: SolverSnapshot, dtSeconds: number, stepInput: SimulationStepInput): string[] {
    const qInByTankId = new Map<string, number>();
    const qOutByTankId = new Map<string, number>();
    const warnings: string[] = [];

    snapshot.edgeResults.forEach((edgeResult) => {
      const edge = this.state.network.edges.find((candidate) => candidate.id === edgeResult.edgeId);
      if (!edge) return;

      const flow = edgeResult.flowM3PerS;
      if (flow >= 0) {
        const targetNode = this.state.network.nodes.find((node) => node.id === edge.toNodeId);
        if (targetNode?.kind === 'tank') {
          qInByTankId.set(targetNode.id, (qInByTankId.get(targetNode.id) ?? 0) + flow);
        }
        const sourceNode = this.state.network.nodes.find((node) => node.id === edge.fromNodeId);
        if (sourceNode?.kind === 'tank') {
          qOutByTankId.set(sourceNode.id, (qOutByTankId.get(sourceNode.id) ?? 0) + flow);
        }
      } else {
        const reverseFlow = Math.abs(flow);
        const sourceNode = this.state.network.nodes.find((node) => node.id === edge.fromNodeId);
        if (sourceNode?.kind === 'tank') {
          qInByTankId.set(sourceNode.id, (qInByTankId.get(sourceNode.id) ?? 0) + reverseFlow);
        }
        const targetNode = this.state.network.nodes.find((node) => node.id === edge.toNodeId);
        if (targetNode?.kind === 'tank') {
          qOutByTankId.set(targetNode.id, (qOutByTankId.get(targetNode.id) ?? 0) + reverseFlow);
        }
      }
    });

    Object.entries(this.state.tankStates).forEach(([tankId, tankState]) => {
      const node = this.state.network.nodes.find((candidate): candidate is TankNode => candidate.id === tankId && candidate.kind === 'tank');
      if (!node) return;

      const qIn = qInByTankId.get(tankId) ?? 0;
      const qOut = qOutByTankId.get(tankId) ?? 0;
      const boundaryFlow = stepInput.overrides?.tankBoundaryFlowM3PerSByNodeId?.[tankId] ?? 0;
      const netFlow = qIn - qOut + boundaryFlow;
      const deltaVolume = netFlow * dtSeconds;
      const unclampedVolume = tankState.volumeM3 + deltaVolume;
      const nextVolume = clamp(unclampedVolume, tankState.minVolumeM3, tankState.maxVolumeM3);
      const area = Math.max(node.crossSectionAreaM2, ENGINE_LIMITS.minTankCrossSectionM2);
      const nextLevel = nextVolume / area;

      const fillTimeSeconds = netFlow > PHYSICS_CONSTANTS.minimumPositiveFlowM3PerS && Number.isFinite(tankState.maxVolumeM3)
        ? Math.max(0, (tankState.maxVolumeM3 - nextVolume) / netFlow)
        : null;
      const drainTimeSeconds = netFlow < -PHYSICS_CONSTANTS.minimumPositiveFlowM3PerS
        ? Math.max(0, (nextVolume - tankState.minVolumeM3) / Math.abs(netFlow))
        : null;

      if (nextVolume === tankState.maxVolumeM3 && netFlow > 0) {
        warnings.push(`Tank ${tankId} reached max volume limit.`);
      }
      if (nextVolume === tankState.minVolumeM3 && netFlow < 0) {
        warnings.push(`Tank ${tankId} reached min volume limit.`);
      }

      this.state.tankStates[tankId] = {
        ...tankState,
        volumeM3: nextVolume,
        liquidLevelM: nextLevel,
        qInM3PerS: qIn + Math.max(boundaryFlow, 0),
        qOutM3PerS: qOut + Math.max(-boundaryFlow, 0),
        netFlowM3PerS: netFlow,
        fillTimeSeconds,
        drainTimeSeconds,
      };
    });

    return warnings;
  }

  private toUiResult(snapshot: SolverSnapshot): SimulationUiResult {
    const nodes = snapshot.nodeResults.map((nodeResult) => {
      const tank = this.state.tankStates[nodeResult.nodeId];
      const networkNode = this.state.network.nodes.find((node) => node.id === nodeResult.nodeId);
      const levelPercent = networkNode?.kind === 'tank' && tank
        ? Number.isFinite(tank.maxVolumeM3)
          ? Math.max(0, Math.min(100, (tank.volumeM3 / Math.max(tank.maxVolumeM3, 1e-6)) * 100))
          : undefined
        : undefined;

      return {
        nodeId: nodeResult.nodeId,
        pressureBar: convertPaToBar(nodeResult.pressurePa),
        levelPercent,
        liquidLevelM: tank?.liquidLevelM,
        volumeM3: tank?.volumeM3,
        netFlowLpm: tank ? convertM3PerSToLpm(tank.netFlowM3PerS) : undefined,
        fillTimeSeconds: tank?.fillTimeSeconds,
        drainTimeSeconds: tank?.drainTimeSeconds,
      };
    });

    const edges = snapshot.edgeResults.map((edgeResult) => ({
      edgeId: edgeResult.edgeId,
      flowLpm: convertM3PerSToLpm(edgeResult.flowM3PerS),
      pressureDropBar: convertPaToBar(edgeResult.pressureDropPa),
      velocityMPerS: edgeResult.velocityMPerS,
    }));

    return {
      nodes,
      edges,
      warnings: snapshot.warnings,
    };
  }
}

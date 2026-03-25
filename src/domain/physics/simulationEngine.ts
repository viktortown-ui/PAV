import { ENGINE_LIMITS, PHYSICS_CONSTANTS } from './constants';
import { validatePhysicsInput } from './physicsInputValidation';
import { advanceSimulationClock, createInitialSimulationState, setSolverSnapshot } from './state';
import {
  HydraulicEdge,
  HydraulicNetworkInput,
  SimulationState,
  SimulationStepInput,
  SimulationUiResult,
  SolverSnapshot,
  TankNode,
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

    const network = this.buildNetwork();
    const networkWithFluid = this.applyFluidProperties(network);
    const snapshot = this.solveSteadyStateFlow(networkWithFluid);
    this.updateTankVolumes(snapshot, dtSeconds);
    this.state = setSolverSnapshot(this.state, snapshot);
    this.state = advanceSimulationClock(this.state, dtSeconds);

    return this.toUiResult(snapshot);
  }

  private buildNetwork(): HydraulicNetworkInput {
    return this.state.network;
  }

  private applyFluidProperties(network: HydraulicNetworkInput): HydraulicNetworkInput {
    return network;
  }

  private solveSteadyStateFlow(network: HydraulicNetworkInput): SolverSnapshot {
    const fluidDensity = network.fluid.densityKgPerM3;

    const edgeResults = network.edges.map((edge) => this.solveEdge(edge, fluidDensity));
    const nodeResults = network.nodes.map((node) => ({
      nodeId: node.id,
      pressurePa: PHYSICS_CONSTANTS.atmosphericPressurePa,
      headM: node.elevationM,
    }));

    return {
      nodeResults,
      edgeResults,
      warnings: ['Steady-state solver currently uses baseline placeholders for pressure/flow.'],
    };
  }

  private solveEdge(edge: HydraulicEdge, fluidDensity: number) {
    if (edge.kind === 'pipe') {
      const area = Math.PI * (edge.innerDiameterM ** 2) * 0.25;
      const nominalVelocity = 1;
      const flowM3PerS = area * nominalVelocity;
      const pressureDropPa = fluidDensity * PHYSICS_CONSTANTS.gravityMps2 * edge.lengthM * 0.01;

      return {
        edgeId: edge.id,
        flowM3PerS,
        pressureDropPa,
        velocityMPerS: nominalVelocity,
      };
    }

    if (edge.kind === 'pump') {
      const speedRatio = edge.speedRatio ?? 1;
      const flowM3PerS = edge.ratedFlowM3PerS * speedRatio;
      const pressureDropPa = -fluidDensity * PHYSICS_CONSTANTS.gravityMps2 * edge.ratedHeadM * speedRatio;

      return {
        edgeId: edge.id,
        flowM3PerS,
        pressureDropPa,
      };
    }

    const openingRatio = clamp(edge.openingRatio, 0, 1);
    const flowM3PerS = (edge.kvM3PerHour / 3600) * openingRatio;
    const pressureDropPa = openingRatio > 0 ? fluidDensity * PHYSICS_CONSTANTS.gravityMps2 * (1 - openingRatio) : PHYSICS_CONSTANTS.atmosphericPressurePa;

    return {
      edgeId: edge.id,
      flowM3PerS,
      pressureDropPa,
    };
  }

  private updateTankVolumes(snapshot: SolverSnapshot, dtSeconds: number): void {
    const inflowByTankId = new Map<string, number>();
    snapshot.edgeResults.forEach((edgeResult) => {
      const edge = this.state.network.edges.find((candidate) => candidate.id === edgeResult.edgeId);
      if (!edge) return;

      const targetNode = this.state.network.nodes.find((node) => node.id === edge.toNodeId);
      if (!targetNode || targetNode.kind !== 'tank') return;

      inflowByTankId.set(targetNode.id, (inflowByTankId.get(targetNode.id) ?? 0) + edgeResult.flowM3PerS);
    });

    Object.entries(this.state.tankStates).forEach(([tankId, tankState]) => {
      const node = this.state.network.nodes.find((candidate): candidate is TankNode => candidate.id === tankId && candidate.kind === 'tank');
      if (!node) return;

      const deltaVolume = (inflowByTankId.get(tankId) ?? 0) * dtSeconds;
      const nextVolume = Math.max(0, tankState.volumeM3 + deltaVolume);
      const nextLevel = nextVolume / Math.max(node.crossSectionAreaM2, ENGINE_LIMITS.minTankCrossSectionM2);

      this.state.tankStates[tankId] = {
        nodeId: tankId,
        volumeM3: nextVolume,
        liquidLevelM: nextLevel,
      };
    });
  }

  private toUiResult(snapshot: SolverSnapshot): SimulationUiResult {
    const nodes = snapshot.nodeResults.map((nodeResult) => {
      const tank = this.state.tankStates[nodeResult.nodeId];
      const networkNode = this.state.network.nodes.find((node) => node.id === nodeResult.nodeId);
      const levelPercent = networkNode?.kind === 'tank' && tank
        ? Math.max(0, Math.min(100, (tank.liquidLevelM / Math.max(networkNode.liquidLevelM, 1e-6)) * 100))
        : undefined;

      return {
        nodeId: nodeResult.nodeId,
        pressureBar: convertPaToBar(nodeResult.pressurePa),
        levelPercent,
      };
    });

    const edges = snapshot.edgeResults.map((edgeResult) => ({
      edgeId: edgeResult.edgeId,
      flowLpm: convertM3PerSToLpm(edgeResult.flowM3PerS),
      pressureDropBar: convertPaToBar(edgeResult.pressureDropPa),
    }));

    return {
      nodes,
      edges,
      warnings: snapshot.warnings,
    };
  }
}

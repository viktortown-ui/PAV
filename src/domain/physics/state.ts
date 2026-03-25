import { ENGINE_LIMITS, PHYSICS_CONSTANTS } from './constants';
import { HydraulicNetworkInput, SimulationState, SolverSnapshot, TankState, TankNode } from './types';

const emptySnapshot = (): SolverSnapshot => ({
  nodeResults: [],
  edgeResults: [],
  warnings: [],
});

const resolveTankLimits = (node: TankNode): Pick<TankState, 'minVolumeM3' | 'maxVolumeM3'> => {
  const area = Math.max(node.crossSectionAreaM2, ENGINE_LIMITS.minTankCrossSectionM2);
  const minFromLevel = Math.max(0, (node.minLiquidLevelM ?? 0) * area);
  const maxFromLevel = (node.maxLiquidLevelM ?? Number.POSITIVE_INFINITY) * area;
  const minVolume = Math.max(0, node.minVolumeM3 ?? minFromLevel);
  const maxVolume = Math.max(minVolume, Math.min(node.maxVolumeM3 ?? Number.POSITIVE_INFINITY, maxFromLevel));
  return {
    minVolumeM3: minVolume,
    maxVolumeM3: Number.isFinite(maxVolume) ? maxVolume : Number.POSITIVE_INFINITY,
  };
};

export const buildTankStates = (network: HydraulicNetworkInput): Record<string, TankState> => {
  return Object.fromEntries(
    network.nodes
      .filter((node) => node.kind === 'tank')
      .map((node) => {
        const limits = resolveTankLimits(node);
        const initialVolume = Math.min(limits.maxVolumeM3, Math.max(limits.minVolumeM3, node.volumeM3));
        const initialLevel = initialVolume / Math.max(node.crossSectionAreaM2, ENGINE_LIMITS.minTankCrossSectionM2);

        return [
          node.id,
          {
            nodeId: node.id,
            volumeM3: initialVolume,
            liquidLevelM: initialLevel,
            minVolumeM3: limits.minVolumeM3,
            maxVolumeM3: limits.maxVolumeM3,
            qInM3PerS: 0,
            qOutM3PerS: 0,
            netFlowM3PerS: 0,
            fillTimeSeconds: null,
            drainTimeSeconds: null,
          },
        ];
      }),
  );
};

export const createInitialSimulationState = (network: HydraulicNetworkInput): SimulationState => ({
  network,
  timeSeconds: 0,
  tankStates: buildTankStates(network),
  latestSnapshot: emptySnapshot(),
});

export const advanceSimulationClock = (
  state: SimulationState,
  dtSeconds: number = PHYSICS_CONSTANTS.defaultTimeStepSeconds,
): SimulationState => ({
  ...state,
  timeSeconds: state.timeSeconds + dtSeconds,
});

export const setSolverSnapshot = (state: SimulationState, snapshot: SolverSnapshot): SimulationState => ({
  ...state,
  latestSnapshot: snapshot,
});

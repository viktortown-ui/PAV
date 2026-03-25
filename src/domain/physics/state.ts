import { PHYSICS_CONSTANTS } from './constants';
import { HydraulicNetworkInput, SimulationState, SolverSnapshot, TankState } from './types';

const emptySnapshot = (): SolverSnapshot => ({
  nodeResults: [],
  edgeResults: [],
  warnings: [],
});

export const buildTankStates = (network: HydraulicNetworkInput): Record<string, TankState> => {
  return Object.fromEntries(
    network.nodes
      .filter((node) => node.kind === 'tank')
      .map((node) => [
        node.id,
        {
          nodeId: node.id,
          volumeM3: node.volumeM3,
          liquidLevelM: node.liquidLevelM,
        },
      ]),
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

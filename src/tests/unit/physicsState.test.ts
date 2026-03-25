import { describe, expect, it } from 'vitest';
import { createInitialSimulationState } from '../../domain/physics/state';
import { HydraulicNetworkInput } from '../../domain/physics/types';

const networkFixture: HydraulicNetworkInput = {
  id: 'net-1',
  fluid: {
    id: 'fluid-water',
    kind: 'water',
    name: 'Water',
    densityKgPerM3: 997,
    dynamicViscosityPaS: 0.00089,
  },
  nodes: [
    { id: 'n1', kind: 'junction', elevationM: 0 },
    { id: 'tank-1', kind: 'tank', elevationM: 1, volumeM3: 2, liquidLevelM: 1, crossSectionAreaM2: 2, minVolumeM3: 0.5, maxVolumeM3: 3 },
  ],
  edges: [
    {
      id: 'pipe-1',
      kind: 'pipe',
      fromNodeId: 'n1',
      toNodeId: 'tank-1',
      lengthM: 10,
      innerDiameterM: 0.05,
      roughnessM: 0.0001,
    },
  ],
};

describe('physics state factory', () => {
  it('builds tank states and initializes empty snapshot', () => {
    const state = createInitialSimulationState(networkFixture);

    expect(state.timeSeconds).toBe(0);
    expect(state.latestSnapshot.nodeResults).toEqual([]);
    expect(state.tankStates['tank-1']).toMatchObject({ volumeM3: 2, liquidLevelM: 1, minVolumeM3: 0.5, maxVolumeM3: 3 });
  });
});

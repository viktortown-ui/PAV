import { describe, expect, it } from 'vitest';
import { PhysicsSimulationEngine } from './simulationEngine';
import { HydraulicNetworkInput } from './types';

const baseFluid = {
  id: 'water',
  kind: 'water' as const,
  name: 'Вода',
  densityKgPerM3: 998,
  dynamicViscosityPaS: 0.001,
};

const edgeFlow = (result: ReturnType<PhysicsSimulationEngine['step']>, edgeId: string) => {
  return result.edges.find((edge) => edge.edgeId === edgeId)?.flowLpm ?? 0;
};

describe('PhysicsSimulationEngine branched solver', () => {
  it('делит поток между параллельными ветками по сопротивлению', () => {
    const network: HydraulicNetworkInput = {
      id: 'split',
      fluid: baseFluid,
      nodes: [
        { id: 'source', kind: 'tank', elevationM: 0, volumeM3: 4, liquidLevelM: 2, crossSectionAreaM2: 2, minVolumeM3: 0, maxVolumeM3: 8 },
        { id: 'j1', kind: 'junction', elevationM: 0 },
        { id: 'sinkA', kind: 'tank', elevationM: 0, volumeM3: 1, liquidLevelM: 1, crossSectionAreaM2: 1, minVolumeM3: 0, maxVolumeM3: 10 },
        { id: 'sinkB', kind: 'tank', elevationM: 0, volumeM3: 1, liquidLevelM: 1, crossSectionAreaM2: 1, minVolumeM3: 0, maxVolumeM3: 10 },
      ],
      edges: [
        { id: 'e0', kind: 'pump', fromNodeId: 'source', toNodeId: 'j1', ratedFlowM3PerS: 0.002, ratedHeadM: 25, efficiency: 0.75, speedRatio: 1 },
        { id: 'eA', kind: 'pipe', fromNodeId: 'j1', toNodeId: 'sinkA', lengthM: 8, innerDiameterM: 0.08, roughnessM: 0.000045, minorLossCoefficient: 1.2 },
        { id: 'eB', kind: 'pipe', fromNodeId: 'j1', toNodeId: 'sinkB', lengthM: 40, innerDiameterM: 0.04, roughnessM: 0.000045, minorLossCoefficient: 2.4 },
      ],
    };

    const engine = new PhysicsSimulationEngine(network);
    const result = engine.step({ dtSeconds: 1 });

    const qA = edgeFlow(result, 'eA');
    const qB = edgeFlow(result, 'eB');
    const qIn = edgeFlow(result, 'e0');

    expect(qA).toBeGreaterThan(qB);
    expect(qB).toBeGreaterThan(0);
    expect(qIn).toBeCloseTo(qA + qB, 2);
  });

  it('закрытая ветка получает нулевой расход и поток перераспределяется', () => {
    const network: HydraulicNetworkInput = {
      id: 'split-valve',
      fluid: baseFluid,
      nodes: [
        { id: 'source', kind: 'tank', elevationM: 0, volumeM3: 3, liquidLevelM: 1.5, crossSectionAreaM2: 2, minVolumeM3: 0, maxVolumeM3: 8 },
        { id: 'j1', kind: 'junction', elevationM: 0 },
        { id: 'sinkA', kind: 'tank', elevationM: 0, volumeM3: 1, liquidLevelM: 1, crossSectionAreaM2: 1, minVolumeM3: 0, maxVolumeM3: 10 },
        { id: 'sinkB', kind: 'tank', elevationM: 0, volumeM3: 1, liquidLevelM: 1, crossSectionAreaM2: 1, minVolumeM3: 0, maxVolumeM3: 10 },
      ],
      edges: [
        { id: 'feed', kind: 'pump', fromNodeId: 'source', toNodeId: 'j1', ratedFlowM3PerS: 0.0015, ratedHeadM: 20, efficiency: 0.75, speedRatio: 1 },
        { id: 'openBranch', kind: 'pipe', fromNodeId: 'j1', toNodeId: 'sinkA', lengthM: 10, innerDiameterM: 0.06, roughnessM: 0.000045, minorLossCoefficient: 1 },
        { id: 'closedValve', kind: 'valve', fromNodeId: 'j1', toNodeId: 'sinkB', kvM3PerHour: 20, openingRatio: 0, isCheckValve: false },
      ],
    };

    const engine = new PhysicsSimulationEngine(network);
    const result = engine.step({ dtSeconds: 1 });

    expect(edgeFlow(result, 'closedValve')).toBeCloseTo(0, 4);
    expect(edgeFlow(result, 'openBranch')).toBeGreaterThan(0);
    expect(edgeFlow(result, 'feed')).toBeCloseTo(edgeFlow(result, 'openBranch'), 2);
  });

  it('на узле слияния сохраняется массовый баланс', () => {
    const network: HydraulicNetworkInput = {
      id: 'merge',
      fluid: baseFluid,
      nodes: [
        { id: 's1', kind: 'tank', elevationM: 0, volumeM3: 3, liquidLevelM: 3, crossSectionAreaM2: 1, minVolumeM3: 0, maxVolumeM3: 10 },
        { id: 's2', kind: 'tank', elevationM: 0, volumeM3: 3, liquidLevelM: 3, crossSectionAreaM2: 1, minVolumeM3: 0, maxVolumeM3: 10 },
        { id: 'mergeNode', kind: 'junction', elevationM: 0 },
        { id: 'sink', kind: 'tank', elevationM: 0, volumeM3: 1, liquidLevelM: 1, crossSectionAreaM2: 1, minVolumeM3: 0, maxVolumeM3: 10 },
      ],
      edges: [
        { id: 'a', kind: 'pump', fromNodeId: 's1', toNodeId: 'mergeNode', ratedFlowM3PerS: 0.001, ratedHeadM: 18, efficiency: 0.75, speedRatio: 1 },
        { id: 'b', kind: 'pump', fromNodeId: 's2', toNodeId: 'mergeNode', ratedFlowM3PerS: 0.0012, ratedHeadM: 18, efficiency: 0.75, speedRatio: 1 },
        { id: 'out', kind: 'pipe', fromNodeId: 'mergeNode', toNodeId: 'sink', lengthM: 12, innerDiameterM: 0.08, roughnessM: 0.000045, minorLossCoefficient: 1.4 },
      ],
    };

    const engine = new PhysicsSimulationEngine(network);
    const result = engine.step({ dtSeconds: 1 });

    const qA = edgeFlow(result, 'a');
    const qB = edgeFlow(result, 'b');
    const qOut = edgeFlow(result, 'out');

    expect(qA).toBeGreaterThan(0);
    expect(qB).toBeGreaterThan(0);
    expect(qOut).toBeCloseTo(qA + qB, 2);
  });
});

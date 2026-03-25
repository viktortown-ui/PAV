import { describe, expect, it } from 'vitest';
import { PhysicsSimulationEngine } from '../../domain/physics/simulationEngine';
import { HydraulicNetworkInput } from '../../domain/physics/types';

const fixture: HydraulicNetworkInput = {
  id: 'tank-dyn',
  fluid: {
    id: 'fluid-water',
    kind: 'water',
    name: 'Water',
    densityKgPerM3: 997,
    dynamicViscosityPaS: 0.00089,
  },
  nodes: [
    { id: 'j1', kind: 'junction', elevationM: 0 },
    { id: 'tank-1', kind: 'tank', elevationM: 0, volumeM3: 1, liquidLevelM: 0.5, crossSectionAreaM2: 2, minVolumeM3: 0, maxVolumeM3: 2 },
  ],
  edges: [
    { id: 'pipe-1', kind: 'pipe', fromNodeId: 'j1', toNodeId: 'tank-1', lengthM: 2, innerDiameterM: 0.05, roughnessM: 0.0001 },
  ],
};

describe('tank dt dynamics', () => {
  it('updates V and h from net Qin-Qout and reports fill/drain metrics', () => {
    const engine = new PhysicsSimulationEngine(fixture);

    const fillStep = engine.step({ dtSeconds: 10, overrides: { tankBoundaryFlowM3PerSByNodeId: { 'tank-1': 0.01 } } });
    const tankNode = fillStep.nodes.find((node) => node.nodeId === 'tank-1');
    expect(tankNode?.volumeM3).toBeCloseTo(1.1, 6);
    expect(tankNode?.liquidLevelM).toBeCloseTo(0.55, 6);
    expect(tankNode?.fillTimeSeconds).toBeCloseTo(90, 6);

    const drainStep = engine.step({ dtSeconds: 20, overrides: { tankBoundaryFlowM3PerSByNodeId: { 'tank-1': -0.02 } } });
    const drained = drainStep.nodes.find((node) => node.nodeId === 'tank-1');
    expect(drained?.volumeM3).toBeCloseTo(0.7, 6);
    expect(drained?.liquidLevelM).toBeCloseTo(0.35, 6);
    expect(drained?.drainTimeSeconds).toBeCloseTo(35, 6);
  });

  it('clamps volume to min/max and emits warnings', () => {
    const engine = new PhysicsSimulationEngine(fixture);

    const overfill = engine.step({ dtSeconds: 1000, overrides: { tankBoundaryFlowM3PerSByNodeId: { 'tank-1': 1 } } });
    const tank = overfill.nodes.find((node) => node.nodeId === 'tank-1');
    expect(tank?.volumeM3).toBe(2);
    expect(overfill.warnings.join(' ')).toContain('max volume limit');

    const overdain = engine.step({ dtSeconds: 1000, overrides: { tankBoundaryFlowM3PerSByNodeId: { 'tank-1': -1 } } });
    const emptied = overdain.nodes.find((node) => node.nodeId === 'tank-1');
    expect(emptied?.volumeM3).toBe(0);
    expect(overdain.warnings.join(' ')).toContain('min volume limit');
  });
});

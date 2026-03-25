import { describe, expect, it } from 'vitest';
import { PhysicsSimulationEngine } from '../../domain/physics/simulationEngine';
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
    { id: 'tank-1', kind: 'tank', elevationM: 1, volumeM3: 2, liquidLevelM: 1, crossSectionAreaM2: 2 },
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

describe('physics simulation engine skeleton', () => {
  it('runs pipeline and returns UI-ready projections', () => {
    const engine = new PhysicsSimulationEngine(networkFixture);
    const result = engine.step({ dtSeconds: 1 });

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].flowLpm).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('placeholder');
  });

  it('rejects invalid input during construction', () => {
    expect(() => {
      new PhysicsSimulationEngine({
        ...networkFixture,
        fluid: {
          ...networkFixture.fluid,
          densityKgPerM3: 0,
        },
      });
    }).toThrow('FLUID_DENSITY_INVALID');
  });
});

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
    expect(result.edges[0].flowLpm).toBe(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('matches physically consistent Q/v/ΔP for 20 L/min pump baseline', () => {
    const qRated = 20 / 1000 / 60;
    const engine = new PhysicsSimulationEngine({
      ...networkFixture,
      edges: [
        {
          id: 'pump-1',
          kind: 'pump',
          fromNodeId: 'n1',
          toNodeId: 'n2',
          ratedFlowM3PerS: qRated,
          ratedHeadM: 18,
          efficiency: 0.7,
        },
        {
          id: 'pipe-1',
          kind: 'pipe',
          fromNodeId: 'n2',
          toNodeId: 'tank-1',
          lengthM: 10,
          innerDiameterM: 0.02,
          roughnessM: 0.0001,
          minorLossCoefficient: 2,
        },
      ],
      nodes: [
        { id: 'n1', kind: 'junction', elevationM: 0 },
        { id: 'n2', kind: 'junction', elevationM: 0 },
        { id: 'tank-1', kind: 'tank', elevationM: 0, volumeM3: 2, liquidLevelM: 1, crossSectionAreaM2: 2 },
      ],
    });

    const result = engine.step({ dtSeconds: 1 });
    const pipe = result.edges.find((edge) => edge.edgeId === 'pipe-1');
    expect(pipe).toBeDefined();
    expect(pipe!.flowLpm).toBeGreaterThan(15);
    expect(pipe!.flowLpm).toBeLessThan(25);
    expect(pipe!.pressureDropBar).toBeGreaterThan(0);
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

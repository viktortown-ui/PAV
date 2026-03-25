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
    { id: 'tank-1', kind: 'tank', elevationM: 1, volumeM3: 2, liquidLevelM: 1, crossSectionAreaM2: 2, minVolumeM3: 0, maxVolumeM3: 4 },
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
        { id: 'tank-1', kind: 'tank', elevationM: 0, volumeM3: 2, liquidLevelM: 1, crossSectionAreaM2: 2, maxVolumeM3: 5 },
      ],
    });

    const result = engine.step({ dtSeconds: 1 });
    const pipe = result.edges.find((edge) => edge.edgeId === 'pipe-1');
    expect(pipe).toBeDefined();
    expect(pipe!.flowLpm).toBeGreaterThan(15);
    expect(pipe!.flowLpm).toBeLessThan(25);
    expect(pipe!.pressureDropBar).toBeGreaterThan(0);
    expect(pipe!.velocityMPerS).toBeGreaterThan(0);
  });

  it('supports dynamic scenarios: pump off, valve throttling and fluid swap', () => {
    const qRated = 30 / 1000 / 60;
    const engine = new PhysicsSimulationEngine({
      id: 'dyn-1',
      fluid: {
        id: 'water',
        kind: 'water',
        name: 'Water',
        densityKgPerM3: 997,
        dynamicViscosityPaS: 0.00089,
      },
      nodes: [
        { id: 'n1', kind: 'junction', elevationM: 0 },
        { id: 'n2', kind: 'junction', elevationM: 0 },
        { id: 'tank-1', kind: 'tank', elevationM: 0, volumeM3: 1, liquidLevelM: 1, crossSectionAreaM2: 1, minVolumeM3: 0, maxVolumeM3: 3 },
      ],
      edges: [
        { id: 'pump-1', kind: 'pump', fromNodeId: 'n1', toNodeId: 'n2', ratedFlowM3PerS: qRated, ratedHeadM: 15, efficiency: 0.7, speedRatio: 1 },
        { id: 'valve-1', kind: 'valve', fromNodeId: 'n2', toNodeId: 'tank-1', kvM3PerHour: 3, openingRatio: 1 },
      ],
    });

    const flowing = engine.step({ dtSeconds: 1 });
    const flowingRate = flowing.edges.find((edge) => edge.edgeId === 'valve-1')!.flowLpm;
    expect(flowingRate).toBeGreaterThan(0);

    const pumpOff = engine.step({ dtSeconds: 1, overrides: { pumpSpeedRatioById: { 'pump-1': 0 } } });
    const stoppedRate = pumpOff.edges.find((edge) => edge.edgeId === 'valve-1')!.flowLpm;
    expect(stoppedRate).toBe(0);

    const throttled = engine.step({ dtSeconds: 1, overrides: { pumpSpeedRatioById: { 'pump-1': 1 }, valveOpeningRatioById: { 'valve-1': 0.2 } } });
    const throttledRate = throttled.edges.find((edge) => edge.edgeId === 'valve-1')!.flowLpm;
    expect(throttledRate).toBeLessThan(flowingRate);

    const oilStep = engine.step({
      dtSeconds: 1,
      overrides: {
        fluid: {
          id: 'oil',
          kind: 'oil',
          name: 'Oil',
          densityKgPerM3: 860,
          dynamicViscosityPaS: 0.05,
        },
      },
    });
    const oilPressure = oilStep.edges.find((edge) => edge.edgeId === 'valve-1')!.pressureDropBar;
    const waterPressure = throttled.edges.find((edge) => edge.edgeId === 'valve-1')!.pressureDropBar;
    expect(oilPressure).toBeLessThan(waterPressure);
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

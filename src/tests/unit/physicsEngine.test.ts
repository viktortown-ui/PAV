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

  it('rejects non-physical geometry and tank capacity input', () => {
    expect(() => {
      new PhysicsSimulationEngine({
        ...networkFixture,
        nodes: [
          { id: 'n1', kind: 'junction', elevationM: 0 },
          {
            id: 'tank-1',
            kind: 'tank',
            elevationM: 0,
            volumeM3: 1,
            liquidLevelM: 0.2,
            crossSectionAreaM2: 1,
            minVolumeM3: 0,
            maxVolumeM3: 0,
          },
        ],
        edges: [
          {
            id: 'pipe-1',
            kind: 'pipe',
            fromNodeId: 'n1',
            toNodeId: 'tank-1',
            lengthM: 0,
            innerDiameterM: 0,
            roughnessM: 0.0001,
          },
        ],
      });
    }).toThrow(/PIPE_DIAMETER_INVALID|PIPE_LENGTH_INVALID|TANK_CAPACITY_INVALID|TANK_LEVEL_VOLUME_INCONSISTENT/);
  });

  it('keeps Q->v consistency for pipe result', () => {
    const qRated = 20 / 1000 / 60;
    const diameter = 0.02;
    const engine = new PhysicsSimulationEngine({
      ...networkFixture,
      nodes: [
        { id: 'src', kind: 'junction', elevationM: 0 },
        { id: 'mid', kind: 'junction', elevationM: 0 },
        { id: 'dst', kind: 'tank', elevationM: 0, volumeM3: 1, liquidLevelM: 1, crossSectionAreaM2: 1, maxVolumeM3: 3 },
      ],
      edges: [
        { id: 'pump-1', kind: 'pump', fromNodeId: 'src', toNodeId: 'mid', ratedFlowM3PerS: qRated, ratedHeadM: 15, efficiency: 0.7 },
        { id: 'pipe-1', kind: 'pipe', fromNodeId: 'mid', toNodeId: 'dst', lengthM: 6, innerDiameterM: diameter, roughnessM: 0.0001 },
      ],
    });
    const step = engine.step({ dtSeconds: 1 });
    const edge = step.edges.find((item) => item.edgeId === 'pipe-1')!;
    const flowM3PerS = edge.flowLpm / 1000 / 60;
    const area = Math.PI * diameter * diameter * 0.25;
    expect(edge.velocityMPerS).toBeCloseTo(flowM3PerS / area, 8);
  });

  it('changing fluid viscosity changes hydraulic result', () => {
    const baseNetwork: HydraulicNetworkInput = {
      id: 'viscosity-net',
      fluid: { id: 'water', kind: 'water', name: 'Water', densityKgPerM3: 997, dynamicViscosityPaS: 0.00089 },
      nodes: [
        { id: 'src', kind: 'junction', elevationM: 0 },
        { id: 'mid', kind: 'junction', elevationM: 0 },
        { id: 'dst', kind: 'tank', elevationM: 0, volumeM3: 1, liquidLevelM: 1, crossSectionAreaM2: 1, maxVolumeM3: 2 },
      ],
      edges: [
        { id: 'pump-1', kind: 'pump', fromNodeId: 'src', toNodeId: 'mid', ratedFlowM3PerS: 30 / 1000 / 60, ratedHeadM: 20, efficiency: 0.7 },
        { id: 'pipe-1', kind: 'pipe', fromNodeId: 'mid', toNodeId: 'dst', lengthM: 20, innerDiameterM: 0.02, roughnessM: 0.0001 },
      ],
    };

    const engine = new PhysicsSimulationEngine(baseNetwork);
    const water = engine.step({ dtSeconds: 1 });
    const oil = engine.step({
      dtSeconds: 1,
      overrides: {
        fluid: { id: 'oil', kind: 'oil', name: 'Oil', densityKgPerM3: 860, dynamicViscosityPaS: 0.05 },
      },
    });

    const waterLoss = water.edges.find((item) => item.edgeId === 'pipe-1')!.pressureDropBar;
    const oilLoss = oil.edges.find((item) => item.edgeId === 'pipe-1')!.pressureDropBar;
    expect(oilLoss).not.toBeCloseTo(waterLoss, 6);
  });

  it('changing diameter changes velocity and hydraulic loss', () => {
    const create = (diameter: number) => new PhysicsSimulationEngine({
      id: `diam-${diameter}`,
      fluid: { id: 'water', kind: 'water', name: 'Water', densityKgPerM3: 997, dynamicViscosityPaS: 0.00089 },
      nodes: [
        { id: 'src', kind: 'junction', elevationM: 0 },
        { id: 'mid', kind: 'junction', elevationM: 0 },
        { id: 'dst', kind: 'tank', elevationM: 0, volumeM3: 1, liquidLevelM: 1, crossSectionAreaM2: 1, maxVolumeM3: 2 },
      ],
      edges: [
        { id: 'pump-1', kind: 'pump', fromNodeId: 'src', toNodeId: 'mid', ratedFlowM3PerS: 25 / 1000 / 60, ratedHeadM: 20, efficiency: 0.7 },
        { id: 'pipe-1', kind: 'pipe', fromNodeId: 'mid', toNodeId: 'dst', lengthM: 20, innerDiameterM: diameter, roughnessM: 0.0001 },
      ],
    });
    const dn20 = create(0.02).step({ dtSeconds: 1 }).edges.find((item) => item.edgeId === 'pipe-1')!;
    const dn50 = create(0.05).step({ dtSeconds: 1 }).edges.find((item) => item.edgeId === 'pipe-1')!;

    expect((dn20.velocityMPerS ?? 0)).toBeGreaterThan(dn50.velocityMPerS ?? 0);
    expect(dn20.pressureDropBar).toBeGreaterThan(dn50.pressureDropBar);
  });

  it('emits warnings for unrealistic velocity and cavitation placeholder', () => {
    const engine = new PhysicsSimulationEngine({
      id: 'warn-net',
      fluid: { id: 'water', kind: 'water', name: 'Water', densityKgPerM3: 997, dynamicViscosityPaS: 0.00089 },
      nodes: [
        { id: 'n1', kind: 'junction', elevationM: 0 },
        { id: 'n2', kind: 'junction', elevationM: 0 },
        { id: 'tank', kind: 'tank', elevationM: 0, volumeM3: 1, liquidLevelM: 1, crossSectionAreaM2: 1, maxVolumeM3: 2 },
      ],
      edges: [
        { id: 'pump', kind: 'pump', fromNodeId: 'n1', toNodeId: 'n2', ratedFlowM3PerS: 80 / 1000 / 60, ratedHeadM: 25, efficiency: 0.75 },
        { id: 'tiny-pipe', kind: 'pipe', fromNodeId: 'n2', toNodeId: 'tank', lengthM: 2, innerDiameterM: 0.002, roughnessM: 0.0001 },
      ],
    });
    const step = engine.step({ dtSeconds: 1 });
    expect(step.warnings.some((item) => item.includes('скорость') && item.includes('вне рабочего диапазона'))).toBe(true);
    expect(step.warnings.some((item) => item.includes('Проверка кавитационного риска пока упрощённая'))).toBe(true);
  });
});

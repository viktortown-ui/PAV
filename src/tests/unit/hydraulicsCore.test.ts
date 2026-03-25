import { describe, expect, it } from 'vitest';
import { darcyFrictionFactor } from '../../domain/physics/frictionFactor';
import { flowVelocityMPerS } from '../../domain/physics/flowVelocity';
import { localResistancePressureLossPa } from '../../domain/physics/localResistance';
import { pumpHeadMAtFlow } from '../../domain/physics/pumpCurve';
import { darcyWeisbachPressureLossPa } from '../../domain/physics/pressureLoss';
import { classifyFlowRegime, reynoldsNumber } from '../../domain/physics/reynolds';
import { PumpEdge } from '../../domain/physics/types';

const pumpFixture: PumpEdge = {
  id: 'pump-1',
  kind: 'pump',
  fromNodeId: 'n1',
  toNodeId: 'n2',
  ratedFlowM3PerS: 20 / 1000 / 60,
  ratedHeadM: 15,
  efficiency: 0.7,
};

describe('hydraulics core formulas', () => {
  it('computes velocity from Q and diameter', () => {
    const q = 20 / 1000 / 60;
    const velocity = flowVelocityMPerS(q, 0.02);
    expect(velocity).toBeGreaterThan(1);
    expect(velocity).toBeLessThan(1.2);
  });

  it('computes Reynolds and regime', () => {
    const re = reynoldsNumber(997, 1.05, 0.02, 0.00089);
    expect(re).toBeGreaterThan(20_000);
    expect(classifyFlowRegime(re)).toBe('turbulent');
  });

  it('computes Darcy-Weisbach and local losses', () => {
    const f = darcyFrictionFactor(25_000, 1e-4, 0.02);
    const linearLoss = darcyWeisbachPressureLossPa(f, 12, 0.02, 997, 1.05);
    const localLoss = localResistancePressureLossPa(3, 997, 1.05);
    expect(linearLoss).toBeGreaterThan(10_000);
    expect(localLoss).toBeGreaterThan(1_000);
  });

  it('pump curve decreases head with flow', () => {
    const headAtZero = pumpHeadMAtFlow(pumpFixture, 0);
    const headAtRated = pumpHeadMAtFlow(pumpFixture, pumpFixture.ratedFlowM3PerS);
    expect(headAtZero).toBeGreaterThan(headAtRated);
    expect(headAtRated).toBeGreaterThan(0);
  });
});

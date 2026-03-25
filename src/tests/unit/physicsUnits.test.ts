import { describe, expect, it } from 'vitest';
import {
  convertFlowToM3PerS,
  convertM3PerSToLpm,
  convertPaToBar,
  convertPressureToPa,
  convertVolumeToM3,
  flowUnits,
  pressureUnits,
  volumeUnits,
} from '../../domain/physics/units';

describe('physics units', () => {
  it('converts pressure between bar and Pa', () => {
    expect(convertPressureToPa(1, pressureUnits.bar)).toBe(100_000);
    expect(convertPaToBar(250_000)).toBe(2.5);
  });

  it('converts flow between L/min and m3/s', () => {
    expect(convertFlowToM3PerS(60, flowUnits.litersPerMinute)).toBeCloseTo(0.001);
    expect(convertM3PerSToLpm(0.002)).toBeCloseTo(120);
  });

  it('converts volume between liters and m3', () => {
    expect(convertVolumeToM3(1000, volumeUnits.liter)).toBe(1);
    expect(convertVolumeToM3(1.5, volumeUnits.m3)).toBe(1.5);
  });
});

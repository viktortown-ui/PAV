import { velocityHeadPa } from './pressureLoss';

export const localResistancePressureLossPa = (
  zeta: number,
  densityKgPerM3: number,
  velocityMPerS: number,
): number => {
  if (zeta <= 0) return 0;
  return zeta * velocityHeadPa(densityKgPerM3, velocityMPerS);
};

export const effectiveZetaForValve = (baseZeta: number, openingRatio: number): number => {
  const opening = Math.max(0.01, Math.min(1, openingRatio));
  return baseZeta / (opening ** 2);
};

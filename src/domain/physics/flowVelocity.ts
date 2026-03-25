import { ENGINE_LIMITS } from './constants';

export const computePipeAreaM2 = (innerDiameterM: number): number => Math.PI * (innerDiameterM ** 2) * 0.25;

export const flowVelocityMPerS = (flowM3PerS: number, innerDiameterM: number): number => {
  const area = computePipeAreaM2(Math.max(innerDiameterM, ENGINE_LIMITS.minPipeDiameterM));
  if (area <= 0) return 0;
  return flowM3PerS / area;
};

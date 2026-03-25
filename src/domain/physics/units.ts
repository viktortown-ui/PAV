export type UnitCategory = 'pressure' | 'flow' | 'volume' | 'length' | 'time';

const BAR_TO_PA = 100_000;
const LITER_TO_M3 = 0.001;

export const flowUnits = {
  m3PerS: 'm3/s',
  litersPerMinute: 'L/min',
} as const;

export const pressureUnits = {
  pascal: 'Pa',
  bar: 'bar',
} as const;

export const volumeUnits = {
  m3: 'm3',
  liter: 'L',
} as const;

export const convertPressureToPa = (value: number, unit: (typeof pressureUnits)[keyof typeof pressureUnits]): number => {
  if (unit === pressureUnits.pascal) return value;
  return value * BAR_TO_PA;
};

export const convertFlowToM3PerS = (value: number, unit: (typeof flowUnits)[keyof typeof flowUnits]): number => {
  if (unit === flowUnits.m3PerS) return value;
  return (value * LITER_TO_M3) / 60;
};

export const convertVolumeToM3 = (value: number, unit: (typeof volumeUnits)[keyof typeof volumeUnits]): number => {
  if (unit === volumeUnits.m3) return value;
  return value * LITER_TO_M3;
};

export const convertM3ToLiters = (m3: number): number => m3 / LITER_TO_M3;
export const convertPaToBar = (pa: number): number => pa / BAR_TO_PA;
export const convertM3PerSToLpm = (m3PerS: number): number => (m3PerS / LITER_TO_M3) * 60;

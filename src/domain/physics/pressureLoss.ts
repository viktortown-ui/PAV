export const velocityHeadPa = (densityKgPerM3: number, velocityMPerS: number): number => {
  return 0.5 * densityKgPerM3 * (velocityMPerS ** 2);
};

export const darcyWeisbachPressureLossPa = (
  frictionFactor: number,
  lengthM: number,
  diameterM: number,
  densityKgPerM3: number,
  velocityMPerS: number,
): number => {
  if (diameterM <= 0 || lengthM <= 0 || frictionFactor <= 0) return 0;
  return frictionFactor * (lengthM / diameterM) * velocityHeadPa(densityKgPerM3, velocityMPerS);
};

export type FlowRegime = 'laminar' | 'transitional' | 'turbulent';

export const reynoldsNumber = (
  densityKgPerM3: number,
  velocityMPerS: number,
  hydraulicDiameterM: number,
  dynamicViscosityPaS: number,
): number => {
  if (dynamicViscosityPaS <= 0) return 0;
  return (densityKgPerM3 * Math.abs(velocityMPerS) * hydraulicDiameterM) / dynamicViscosityPaS;
};

export const classifyFlowRegime = (re: number): FlowRegime => {
  if (re < 2_300) return 'laminar';
  if (re < 4_000) return 'transitional';
  return 'turbulent';
};

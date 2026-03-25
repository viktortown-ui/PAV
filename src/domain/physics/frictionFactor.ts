const swameeJain = (re: number, roughnessM: number, diameterM: number): number => {
  const relativeRoughness = Math.max(roughnessM, 0) / Math.max(diameterM, 1e-9);
  const term = (relativeRoughness / 3.7) + (5.74 / (re ** 0.9));
  return 0.25 / (Math.log10(Math.max(term, 1e-12)) ** 2);
};

export const darcyFrictionFactor = (re: number, roughnessM: number, diameterM: number): number => {
  if (re <= 1e-9) return 0;
  if (re < 2_300) return 64 / re;

  const turbulent = swameeJain(re, roughnessM, diameterM);
  if (re >= 4_000) return turbulent;

  const laminar = 64 / re;
  const blend = (re - 2_300) / (4_000 - 2_300);
  return laminar * (1 - blend) + turbulent * blend;
};

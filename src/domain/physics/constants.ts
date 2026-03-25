export const PHYSICS_CONSTANTS = {
  gravityMps2: 9.80665,
  atmosphericPressurePa: 101_325,
  waterDensityKgPerM3: 997,
  waterDynamicViscosityPaS: 0.00089,
  minimumPositiveFlowM3PerS: 1e-9,
  defaultTimeStepSeconds: 1,
} as const;

export const ENGINE_LIMITS = {
  minTimeStepSeconds: 0.001,
  maxTimeStepSeconds: 60,
  minTankCrossSectionM2: 1e-6,
  minPipeDiameterM: 1e-4,
  unrealisticVelocityMPerS: 2,
} as const;

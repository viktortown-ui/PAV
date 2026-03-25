import type { FluidProperties, FluidTemperatureViscosityModel } from './types';

const clamp = (value: number, min?: number, max?: number) => {
  if (typeof min === 'number' && value < min) {
    return min;
  }
  if (typeof max === 'number' && value > max) {
    return max;
  }
  return value;
};

export const calculateTemperatureCorrectedViscosity = (
  fluid: Pick<FluidProperties, 'dynamicViscosity_Pa_s' | 'temperature_C' | 'referenceTemperature_C'>,
  model?: FluidTemperatureViscosityModel,
): number => {
  if (!model) {
    return fluid.dynamicViscosity_Pa_s;
  }

  if (model.kind === 'exponential') {
    const deltaT = fluid.temperature_C - fluid.referenceTemperature_C;
    const corrected = fluid.dynamicViscosity_Pa_s * Math.exp(-model.coefficientPerC * deltaT);
    return clamp(corrected, model.minViscosityPaS, model.maxViscosityPaS);
  }

  return fluid.dynamicViscosity_Pa_s;
};

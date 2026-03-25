import { FLUID_PRESETS } from './presets';
import { calculateTemperatureCorrectedViscosity } from './temperature';
import type { EditableFluidModel, FluidId, FluidOverrides, FluidPreset, FluidProperties } from './types';

const fluidById = new Map<FluidId, FluidPreset>(FLUID_PRESETS.map((fluid) => [fluid.id, fluid]));

export const getFluidById = (id: FluidId): FluidPreset | undefined => fluidById.get(id);

export const cloneFluidPreset = (id: FluidId): EditableFluidModel => {
  const preset = getFluidById(id);
  if (!preset) {
    throw new Error(`Unknown fluid preset: ${id}`);
  }

  return {
    ...preset,
    sourcePresetId: id,
    viscosityModel: preset.viscosityModel ? { ...preset.viscosityModel } : undefined,
  };
};

export const applyFluidOverrides = (fluid: EditableFluidModel, overrides: FluidOverrides = {}): EditableFluidModel => {
  const result: EditableFluidModel = {
    ...fluid,
    ...overrides,
    viscosityModel:
      overrides.viscosityModel === null
        ? undefined
        : overrides.viscosityModel
          ? { ...overrides.viscosityModel }
          : fluid.viscosityModel
            ? { ...fluid.viscosityModel }
            : undefined,
  };

  return normalizeFluidProperties(result);
};

export const normalizeFluidProperties = <T extends FluidProperties>(fluid: T): T => {
  const normalizedDensity = Number.isFinite(fluid.density_kg_m3) && fluid.density_kg_m3 > 0 ? fluid.density_kg_m3 : 1;
  const normalizedViscosity =
    Number.isFinite(fluid.dynamicViscosity_Pa_s) && fluid.dynamicViscosity_Pa_s > 0 ? fluid.dynamicViscosity_Pa_s : 1e-6;
  const normalizedTemperature = Number.isFinite(fluid.temperature_C) ? fluid.temperature_C : fluid.referenceTemperature_C;
  const normalizedReferenceTemperature =
    Number.isFinite(fluid.referenceTemperature_C) ? fluid.referenceTemperature_C : normalizedTemperature;

  return {
    ...fluid,
    density_kg_m3: normalizedDensity,
    dynamicViscosity_Pa_s: normalizedViscosity,
    temperature_C: normalizedTemperature,
    referenceTemperature_C: normalizedReferenceTemperature,
    notes: fluid.notes?.trim() ?? '',
  };
};

export const getEffectiveFluidProperties = (fluid: EditableFluidModel): FluidProperties => {
  const normalized = normalizeFluidProperties(fluid);

  return {
    density_kg_m3: normalized.density_kg_m3,
    dynamicViscosity_Pa_s: calculateTemperatureCorrectedViscosity(normalized, fluid.viscosityModel),
    temperature_C: normalized.temperature_C,
    referenceTemperature_C: normalized.referenceTemperature_C,
    isNewtonian: normalized.isNewtonian,
    notes: normalized.notes,
  };
};

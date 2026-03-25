import { describe, expect, it } from 'vitest';
import {
  FLUID_PRESETS,
  applyFluidOverrides,
  calculateTemperatureCorrectedViscosity,
  cloneFluidPreset,
  getEffectiveFluidProperties,
  getFluidById,
  normalizeFluidProperties,
} from '../../../domain/physics/fluids';

describe('fluid preset library', () => {
  it('contains 10 standard fluids', () => {
    expect(FLUID_PRESETS).toHaveLength(10);
    expect(FLUID_PRESETS.map((fluid) => fluid.id)).toEqual([
      'water',
      'hydrochloric-acid',
      'caustic-soda',
      'ethylene-glycol',
      'ethanol',
      'acetone',
      'diesel-fuel',
      'mineral-oil',
      'glycerin',
      'custom',
    ]);
  });

  it('returns preset by id', () => {
    expect(getFluidById('water')?.name).toBe('Вода');
    expect(getFluidById('custom')?.name).toBe('Пользовательская жидкость');
  });

  it('clones preset into editable model', () => {
    const water = cloneFluidPreset('water');
    water.notes = 'Edited';

    expect(getFluidById('water')?.notes).toBe('Чистая вода при ~20°C.');
    expect(water.sourcePresetId).toBe('water');
  });
});

describe('fluid overrides and normalization', () => {
  it('applies manual overrides and keeps engine-ready values normalized', () => {
    const preset = cloneFluidPreset('diesel-fuel');

    const updated = applyFluidOverrides(preset, {
      density_kg_m3: 845,
      dynamicViscosity_Pa_s: 0,
      temperature_C: 35,
      notes: ' user test ',
      viscosityModel: null,
    });

    expect(updated.density_kg_m3).toBe(845);
    expect(updated.dynamicViscosity_Pa_s).toBe(1e-6);
    expect(updated.temperature_C).toBe(35);
    expect(updated.notes).toBe('user test');
    expect(updated.viscosityModel).toBeUndefined();
  });

  it('normalizes invalid primitive values', () => {
    const normalized = normalizeFluidProperties({
      density_kg_m3: Number.NaN,
      dynamicViscosity_Pa_s: -1,
      referenceTemperature_C: 20,
      temperature_C: Number.NaN,
      isNewtonian: false,
      notes: '',
    });

    expect(normalized.density_kg_m3).toBe(1);
    expect(normalized.dynamicViscosity_Pa_s).toBe(1e-6);
    expect(normalized.temperature_C).toBe(20);
  });
});

describe('temperature correction', () => {
  it('decreases viscosity at higher temperatures for exponential model', () => {
    const water = cloneFluidPreset('water');
    const corrected = calculateTemperatureCorrectedViscosity(
      {
        dynamicViscosity_Pa_s: water.dynamicViscosity_Pa_s,
        referenceTemperature_C: water.referenceTemperature_C,
        temperature_C: 60,
      },
      water.viscosityModel,
    );

    expect(corrected).toBeLessThan(water.dynamicViscosity_Pa_s);
  });

  it('uses temperature-adjusted viscosity in effective properties', () => {
    const glycerin = applyFluidOverrides(cloneFluidPreset('glycerin'), { temperature_C: 40 });
    const effective = getEffectiveFluidProperties(glycerin);

    expect(effective.dynamicViscosity_Pa_s).toBeLessThan(glycerin.dynamicViscosity_Pa_s);
  });
});

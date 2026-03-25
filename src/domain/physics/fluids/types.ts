export type FluidId =
  | 'water'
  | 'hydrochloric-acid'
  | 'caustic-soda'
  | 'ethylene-glycol'
  | 'ethanol'
  | 'acetone'
  | 'diesel-fuel'
  | 'mineral-oil'
  | 'glycerin'
  | 'custom';

export interface FluidTemperatureViscosityModel {
  /**
   * Dynamic viscosity dependence on temperature modeled as
   * μ(T) = μ_ref * exp( -k * (T - T_ref) ).
   * k has units 1/°C and can be tuned per fluid.
   */
  kind: 'exponential';
  coefficientPerC: number;
  minViscosityPaS?: number;
  maxViscosityPaS?: number;
}

export interface FluidProperties {
  density_kg_m3: number;
  dynamicViscosity_Pa_s: number;
  temperature_C: number;
  referenceTemperature_C: number;
  isNewtonian: boolean;
  notes: string;
}

export interface FluidPreset extends FluidProperties {
  id: FluidId;
  name: string;
  viscosityModel?: FluidTemperatureViscosityModel;
}

export interface EditableFluidModel extends FluidPreset {
  sourcePresetId: FluidId;
}

export type FluidOverrides = Partial<FluidProperties> & {
  name?: string;
  viscosityModel?: FluidTemperatureViscosityModel | null;
};

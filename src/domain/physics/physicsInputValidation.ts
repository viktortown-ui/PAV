import { ENGINE_LIMITS } from './constants';
import { HydraulicNetworkInput } from './types';

export interface ValidationIssue {
  code: string;
  message: string;
  targetId?: string;
}

export const validatePhysicsInput = (network: HydraulicNetworkInput): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set(network.nodes.map((node) => node.id));

  if (network.fluid.densityKgPerM3 <= 0) {
    issues.push({ code: 'FLUID_DENSITY_INVALID', message: 'Fluid density must be positive.', targetId: network.fluid.id });
  }

  if (network.fluid.dynamicViscosityPaS <= 0) {
    issues.push({ code: 'FLUID_VISCOSITY_INVALID', message: 'Dynamic viscosity must be positive.', targetId: network.fluid.id });
  }

  network.nodes.forEach((node) => {
    if (node.kind === 'tank') {
      if (node.crossSectionAreaM2 < ENGINE_LIMITS.minTankCrossSectionM2) {
        issues.push({ code: 'TANK_AREA_TOO_SMALL', message: 'Tank cross section is too small.', targetId: node.id });
      }

      if (node.volumeM3 < 0 || node.liquidLevelM < 0) {
        issues.push({ code: 'TANK_STATE_INVALID', message: 'Tank state must be non-negative.', targetId: node.id });
      }
      const expectedLevelM = node.volumeM3 / Math.max(node.crossSectionAreaM2, ENGINE_LIMITS.minTankCrossSectionM2);
      if (Math.abs(expectedLevelM - node.liquidLevelM) > 1e-6) {
        issues.push({
          code: 'TANK_LEVEL_VOLUME_INCONSISTENT',
          message: 'Tank liquid level and volume are inconsistent with the declared cross section area.',
          targetId: node.id,
        });
      }

      const minVolume = Math.max(0, node.minVolumeM3 ?? 0);
      const maxVolume = node.maxVolumeM3 ?? Number.POSITIVE_INFINITY;
      if (maxVolume <= 0) {
        issues.push({ code: 'TANK_CAPACITY_INVALID', message: 'Tank capacity must be positive.', targetId: node.id });
      }
      if (maxVolume < minVolume) {
        issues.push({ code: 'TANK_LIMITS_INVALID', message: 'Tank max volume must be greater than or equal to min volume.', targetId: node.id });
      }

      if (node.maxLiquidLevelM !== undefined && node.minLiquidLevelM !== undefined && node.maxLiquidLevelM < node.minLiquidLevelM) {
        issues.push({ code: 'TANK_LEVEL_LIMITS_INVALID', message: 'Tank max liquid level must be greater than or equal to min level.', targetId: node.id });
      }
    }
  });

  network.edges.forEach((edge) => {
    if (!nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId)) {
      issues.push({ code: 'EDGE_NODE_NOT_FOUND', message: 'Edge references unknown node.', targetId: edge.id });
    }

    if (edge.fromNodeId === edge.toNodeId) {
      issues.push({ code: 'EDGE_SELF_LOOP', message: 'Edge cannot connect node to itself.', targetId: edge.id });
    }

    if (edge.kind === 'pipe') {
      if (edge.innerDiameterM <= 0) {
        issues.push({ code: 'PIPE_DIAMETER_INVALID', message: 'Pipe diameter must be positive.', targetId: edge.id });
      } else if (edge.innerDiameterM < ENGINE_LIMITS.minPipeDiameterM) {
        issues.push({ code: 'PIPE_DIAMETER_TOO_SMALL', message: 'Pipe diameter is too small.', targetId: edge.id });
      }

      if (edge.lengthM <= 0) {
        issues.push({ code: 'PIPE_LENGTH_INVALID', message: 'Pipe length must be positive.', targetId: edge.id });
      }
    }

    if (edge.kind === 'pump' && edge.efficiency <= 0) {
      issues.push({ code: 'PUMP_EFFICIENCY_INVALID', message: 'Pump efficiency must be positive.', targetId: edge.id });
    }

    if (edge.kind === 'valve' && (edge.openingRatio < 0 || edge.openingRatio > 1)) {
      issues.push({ code: 'VALVE_OPENING_INVALID', message: 'Valve opening ratio must be within [0..1].', targetId: edge.id });
    }
  });

  return issues;
};

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
    }
  });

  network.edges.forEach((edge) => {
    if (!nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId)) {
      issues.push({ code: 'EDGE_NODE_NOT_FOUND', message: 'Edge references unknown node.', targetId: edge.id });
    }

    if (edge.fromNodeId === edge.toNodeId) {
      issues.push({ code: 'EDGE_SELF_LOOP', message: 'Edge cannot connect node to itself.', targetId: edge.id });
    }

    if (edge.kind === 'pipe' && edge.innerDiameterM < ENGINE_LIMITS.minPipeDiameterM) {
      issues.push({ code: 'PIPE_DIAMETER_TOO_SMALL', message: 'Pipe diameter is too small.', targetId: edge.id });
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

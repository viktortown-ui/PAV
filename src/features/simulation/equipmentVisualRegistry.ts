import { SoapNodeData, SoapNodeKind, SymbolFamily } from '../../domain/schemas/types';
import { componentMap } from '../../domain/registry/componentRegistry';

export type EquipmentStateIndicator = 'running' | 'off' | 'standby' | 'alarm' | 'blocked' | 'manual' | 'maintenance' | 'unknown';
export type LodLevel = 'far' | 'medium' | 'near';

export interface EquipmentVisualProfile {
  kind: SoapNodeKind;
  family: SymbolFamily;
  svgVariant: string;
  categoryColor: string;
  strokeColor: string;
  stateIndicator: EquipmentStateIndicator;
  shortLabel: string;
  showName: boolean;
  showSecondary: boolean;
}

const familyColor: Record<SymbolFamily, { fill: string; stroke: string }> = {
  vessel: { fill: '#4f79c5', stroke: '#bfd3ff' },
  machinery: { fill: '#bb7f32', stroke: '#ffe1b8' },
  valve: { fill: '#977f36', stroke: '#f8e6b6' },
  instrument: { fill: '#2f8b79', stroke: '#bff8eb' },
  topology: { fill: '#5e6d87', stroke: '#d5e1f2' },
  terminal: { fill: '#5f738e', stroke: '#d4e4f7' },
};

export const resolveStateIndicator = (node: SoapNodeData): EquipmentStateIndicator => {
  const process = node.process as Record<string, unknown>;
  const mode = String(process.mode ?? node.mode ?? 'auto').toLowerCase();
  if (node.status === 'alarm' || node.simulation.routeState === 'alarm') return 'alarm';
  if (node.status === 'blocked' || node.simulation.routeState === 'blocked') return 'blocked';
  if (node.status === 'maintenance' || node.simulation.routeState === 'maintenance') return 'maintenance';
  if (mode === 'manual') return 'manual';
  if (node.status === 'running' || node.simulation.routeState === 'flowing' || node.simulation.routeState === 'cip') return 'running';
  if (node.status === 'standby' || node.status === 'idle') return 'standby';
  if (node.status === 'off' || node.simulation.routeState === 'offline') return 'off';
  return 'unknown';
};

export const resolveLodLevel = (zoom: number, selected = false): LodLevel => {
  if (selected || zoom > 1.1) return 'near';
  if (zoom < 0.72) return 'far';
  return 'medium';
};

export const getEquipmentVisualProfile = (node: SoapNodeData, lod: LodLevel): EquipmentVisualProfile => {
  const definition = componentMap.get(node.kind);
  const family = definition?.family ?? 'topology';
  const palette = familyColor[family];
  return {
    kind: node.kind,
    family,
    svgVariant: `${family}:${node.kind}`,
    categoryColor: palette.fill,
    strokeColor: palette.stroke,
    stateIndicator: resolveStateIndicator(node),
    shortLabel: lod === 'far' ? node.shortName : node.visibleName,
    showName: lod !== 'far',
    showSecondary: lod === 'near',
  };
};

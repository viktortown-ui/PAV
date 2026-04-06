import { SoapNodeData, SoapNodeKind, SymbolFamily } from '../../domain/schemas/types';
import { componentMap } from '../../domain/registry/componentRegistry';

export type EquipmentStateIndicator = 'running' | 'off' | 'standby' | 'alarm' | 'blocked' | 'manual' | 'maintenance' | 'unknown';
export type LodLevel = 'far' | 'medium' | 'near';

export interface EquipmentVisualProfile {
  kind: SoapNodeKind;
  family: SymbolFamily;
  svgVariant: string;
  spriteComponent: string;
  categoryColor: string;
  strokeColor: string;
  stateIndicator: EquipmentStateIndicator;
  shortLabel: string;
  showName: boolean;
  showSecondary: boolean;
}

const familyColor: Record<SymbolFamily, { fill: string; stroke: string }> = {
  vessel: { fill: '#5b89d6', stroke: '#d0e2ff' },
  machinery: { fill: '#ca8b3a', stroke: '#ffe5bf' },
  valve: { fill: '#b89a42', stroke: '#f6e7bc' },
  instrument: { fill: '#35a38f', stroke: '#ccfff4' },
  topology: { fill: '#7f8fa8', stroke: '#d5e1f2' },
  terminal: { fill: '#8a9db8', stroke: '#dce9f8' },
};

const spriteByKind: Record<SoapNodeKind, string> = {
  tank: 'TankSprite',
  bufferTank: 'BufferTankSprite',
  reactor: 'ReactorSprite',
  heatedReactor: 'ReactorSprite',
  pump: 'PumpSprite',
  dosingPump: 'PumpSprite',
  manualValve: 'ValveSprite',
  shutoffValve: 'ValveSprite',
  solenoidValve: 'ValveSprite',
  controlValve: 'ValveSprite',
  drainValve: 'ValveSprite',
  reliefValve: 'ValveSprite',
  gateValve: 'GateValveSprite',
  checkValve: 'CheckValveSprite',
  flowMeter: 'FlowmeterSprite',
  waterFilter: 'FilterSprite',
  filterUnit: 'FilterSprite',
  inlineFilter: 'FilterSprite',
  pressureSensor: 'InstrumentSprite',
  temperatureSensor: 'InstrumentSprite',
  levelSensor: 'InstrumentSprite',
  phSensor: 'InstrumentSprite',
  conductivitySensor: 'InstrumentSprite',
  indicator: 'InstrumentSprite',
  heatExchanger: 'HeatExchangerSprite',
  inlineMixer: 'HeatExchangerSprite',
  roSkid: 'CoolerSprite',
  fillingStation: 'FillingStationSprite',
  source: 'SourceSinkSprite',
  consumer: 'SourceSinkSprite',
  utilityDrain: 'TerminalSprite',
  offPageConnector: 'TerminalSprite',
  serviceTerminal: 'TerminalSprite',
  samplePoint: 'TerminalSprite',
  tee: 'TerminalSprite',
  cross: 'TerminalSprite',
  collector: 'TerminalSprite',
  splitter: 'TerminalSprite',
  mixingJunction: 'TerminalSprite',
  drainBranch: 'TerminalSprite',
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
  if (selected || zoom > 1.12) return 'near';
  if (zoom < 0.7) return 'far';
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
    spriteComponent: spriteByKind[node.kind] ?? 'TerminalSprite',
    categoryColor: palette.fill,
    strokeColor: palette.stroke,
    stateIndicator: resolveStateIndicator(node),
    shortLabel: lod === 'far' ? node.shortName : node.visibleName,
    showName: lod !== 'far',
    showSecondary: lod === 'near',
  };
};

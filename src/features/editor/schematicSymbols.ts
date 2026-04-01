import { Node } from 'reactflow';
import { SoapNodeData } from '../../domain/schemas/types';

export type PortSide = 'left' | 'right' | 'top' | 'bottom';
export type Point = { x: number; y: number };

export type SchematicPort = {
  id: string;
  side: PortSide;
  ratio: number;
  role: 'source' | 'target' | 'bidir';
};

export type LabelPlacement = 'east' | 'west' | 'north' | 'south';

export type SchematicSymbolDefinition = {
  shape: 'inline' | 'pump' | 'vessel' | 'reactor' | 'valve' | 'instrument' | 'filter' | 'mixer' | 'heater' | 'terminal' | 'generic';
  variant?: string;
  size: { width: number; height: number };
  ports: SchematicPort[];
  labelPlacement: { primary: LabelPlacement; secondary: LabelPlacement };
  orientation?: 'horizontal' | 'vertical';
};

const INLINE_PORTS: SchematicPort[] = [
  { id: 'in-left', side: 'left', ratio: 0.5, role: 'target' },
  { id: 'out-right', side: 'right', ratio: 0.5, role: 'source' },
];

const VESSEL_PORTS: SchematicPort[] = [
  { id: 'in-left', side: 'left', ratio: 0.45, role: 'target' },
  { id: 'out-right', side: 'right', ratio: 0.55, role: 'source' },
  { id: 'in-top', side: 'top', ratio: 0.5, role: 'target' },
  { id: 'out-bottom', side: 'bottom', ratio: 0.5, role: 'source' },
];

const symbolByKind: Partial<Record<SoapNodeData['kind'], SchematicSymbolDefinition>> = {
  tank: { shape: 'vessel', size: { width: 180, height: 112 }, ports: VESSEL_PORTS, labelPlacement: { primary: 'east', secondary: 'south' }, orientation: 'vertical' },
  bufferTank: { shape: 'vessel', size: { width: 180, height: 112 }, ports: VESSEL_PORTS, labelPlacement: { primary: 'east', secondary: 'south' }, orientation: 'vertical' },
  reactor: { shape: 'reactor', size: { width: 188, height: 120 }, ports: VESSEL_PORTS, labelPlacement: { primary: 'east', secondary: 'south' }, orientation: 'vertical' },
  heatedReactor: { shape: 'reactor', variant: 'heated', size: { width: 192, height: 122 }, ports: VESSEL_PORTS, labelPlacement: { primary: 'east', secondary: 'south' }, orientation: 'vertical' },
  pump: { shape: 'pump', size: { width: 164, height: 88 }, ports: INLINE_PORTS, labelPlacement: { primary: 'east', secondary: 'south' }, orientation: 'horizontal' },
  dosingPump: { shape: 'pump', variant: 'dosing', size: { width: 164, height: 88 }, ports: INLINE_PORTS, labelPlacement: { primary: 'east', secondary: 'south' }, orientation: 'horizontal' },
  manualValve: { shape: 'valve', size: { width: 148, height: 76 }, ports: INLINE_PORTS, labelPlacement: { primary: 'east', secondary: 'south' }, orientation: 'horizontal' },
  shutoffValve: { shape: 'valve', size: { width: 148, height: 76 }, ports: INLINE_PORTS, labelPlacement: { primary: 'east', secondary: 'south' }, orientation: 'horizontal' },
  solenoidValve: { shape: 'valve', size: { width: 148, height: 76 }, ports: INLINE_PORTS, labelPlacement: { primary: 'east', secondary: 'south' }, orientation: 'horizontal' },
  checkValve: { shape: 'valve', variant: 'check', size: { width: 148, height: 76 }, ports: INLINE_PORTS, labelPlacement: { primary: 'east', secondary: 'south' }, orientation: 'horizontal' },
  controlValve: { shape: 'valve', variant: 'control', size: { width: 148, height: 76 }, ports: INLINE_PORTS, labelPlacement: { primary: 'east', secondary: 'south' }, orientation: 'horizontal' },
  gateValve: { shape: 'valve', size: { width: 148, height: 76 }, ports: INLINE_PORTS, labelPlacement: { primary: 'east', secondary: 'south' }, orientation: 'horizontal' },
  drainValve: { shape: 'valve', variant: 'drain', size: { width: 148, height: 76 }, ports: INLINE_PORTS, labelPlacement: { primary: 'east', secondary: 'south' }, orientation: 'horizontal' },
  reliefValve: { shape: 'valve', variant: 'relief', size: { width: 148, height: 76 }, ports: INLINE_PORTS, labelPlacement: { primary: 'east', secondary: 'south' }, orientation: 'horizontal' },
  flowMeter: { shape: 'instrument', variant: 'flow', size: { width: 150, height: 78 }, ports: INLINE_PORTS, labelPlacement: { primary: 'east', secondary: 'north' }, orientation: 'horizontal' },
  pressureSensor: { shape: 'instrument', variant: 'pressure', size: { width: 148, height: 80 }, ports: INLINE_PORTS, labelPlacement: { primary: 'east', secondary: 'north' }, orientation: 'horizontal' },
  temperatureSensor: { shape: 'instrument', variant: 'temperature', size: { width: 148, height: 80 }, ports: INLINE_PORTS, labelPlacement: { primary: 'east', secondary: 'north' }, orientation: 'horizontal' },
  levelSensor: { shape: 'instrument', variant: 'level', size: { width: 148, height: 80 }, ports: INLINE_PORTS, labelPlacement: { primary: 'east', secondary: 'north' }, orientation: 'horizontal' },
  inlineFilter: { shape: 'filter', size: { width: 154, height: 80 }, ports: INLINE_PORTS, labelPlacement: { primary: 'east', secondary: 'south' }, orientation: 'horizontal' },
  filterUnit: { shape: 'filter', variant: 'housing', size: { width: 168, height: 92 }, ports: INLINE_PORTS, labelPlacement: { primary: 'east', secondary: 'south' }, orientation: 'horizontal' },
  inlineMixer: { shape: 'mixer', size: { width: 154, height: 80 }, ports: INLINE_PORTS, labelPlacement: { primary: 'east', secondary: 'south' }, orientation: 'horizontal' },
  heatExchanger: { shape: 'heater', variant: 'heat-exchanger', size: { width: 176, height: 94 }, ports: INLINE_PORTS, labelPlacement: { primary: 'east', secondary: 'south' }, orientation: 'horizontal' },
  source: { shape: 'terminal', variant: 'source', size: { width: 150, height: 84 }, ports: [{ id: 'out-right', side: 'right', ratio: 0.5, role: 'source' }], labelPlacement: { primary: 'east', secondary: 'south' } },
  consumer: { shape: 'terminal', variant: 'sink', size: { width: 150, height: 84 }, ports: [{ id: 'in-left', side: 'left', ratio: 0.5, role: 'target' }], labelPlacement: { primary: 'west', secondary: 'south' } },
  utilityDrain: { shape: 'terminal', variant: 'sink', size: { width: 150, height: 84 }, ports: [{ id: 'in-left', side: 'left', ratio: 0.5, role: 'target' }], labelPlacement: { primary: 'west', secondary: 'south' } },
  serviceTerminal: { shape: 'terminal', variant: 'external', size: { width: 150, height: 82 }, ports: INLINE_PORTS, labelPlacement: { primary: 'east', secondary: 'south' } },
  offPageConnector: { shape: 'terminal', variant: 'external', size: { width: 150, height: 82 }, ports: INLINE_PORTS, labelPlacement: { primary: 'east', secondary: 'south' } },
};

const FALLBACK_SYMBOL: SchematicSymbolDefinition = {
  shape: 'generic',
  size: { width: 164, height: 90 },
  ports: INLINE_PORTS,
  labelPlacement: { primary: 'east', secondary: 'south' },
};

export const getSchematicSymbol = (node: Node<SoapNodeData>): SchematicSymbolDefinition => {
  const mapped = symbolByKind[node.data.kind];
  if (mapped) return mapped;
  if (node.data.className === 'major') return { ...FALLBACK_SYMBOL, shape: 'vessel', size: { width: 178, height: 106 }, ports: VESSEL_PORTS };
  return FALLBACK_SYMBOL;
};

export const getSchematicPorts = (node: Node<SoapNodeData>) => getSchematicSymbol(node).ports;

export const getPortPoint = (node: Node<SoapNodeData>, portId?: string | null): Point => {
  const symbol = getSchematicSymbol(node);
  const port = symbol.ports.find((item) => item.id === portId) ?? symbol.ports[0];
  const { x, y } = node.position;
  if (!port) return { x: x + symbol.size.width / 2, y: y + symbol.size.height / 2 };
  if (port.side === 'left') return { x, y: y + symbol.size.height * port.ratio };
  if (port.side === 'right') return { x: x + symbol.size.width, y: y + symbol.size.height * port.ratio };
  if (port.side === 'top') return { x: x + symbol.size.width * port.ratio, y };
  return { x: x + symbol.size.width * port.ratio, y: y + symbol.size.height };
};

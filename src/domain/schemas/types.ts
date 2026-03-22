import type { Edge, Node, Viewport } from 'reactflow';

export type SoapNodeKind =
  | 'source'
  | 'waterFilter'
  | 'roSkid'
  | 'tank'
  | 'bufferTank'
  | 'reactor'
  | 'heatedReactor'
  | 'fillingStation'
  | 'filterUnit'
  | 'pump'
  | 'dosingPump'
  | 'inlineFilter'
  | 'inlineMixer'
  | 'heatExchanger'
  | 'manualValve'
  | 'shutoffValve'
  | 'solenoidValve'
  | 'checkValve'
  | 'controlValve'
  | 'gateValve'
  | 'drainValve'
  | 'reliefValve'
  | 'flowMeter'
  | 'pressureSensor'
  | 'temperatureSensor'
  | 'levelSensor'
  | 'phSensor'
  | 'conductivitySensor'
  | 'indicator'
  | 'tee'
  | 'cross'
  | 'collector'
  | 'splitter'
  | 'mixingJunction'
  | 'drainBranch'
  | 'samplePoint'
  | 'consumer'
  | 'utilityDrain';

export type MediumType = 'water' | 'product' | 'cip' | 'waste';
export type NodeStatus = 'normal' | 'active' | 'warning' | 'alarm' | 'disabled';
export type RouteState = 'idle' | 'primed' | 'flowing' | 'blocked' | 'starved' | 'draining' | 'cip' | 'alarm' | 'offline';
export type InspectorTab = 'main' | 'process' | 'ports' | 'signals' | 'appearance' | 'alarms' | 'simulation';
export type PropertyFieldType = 'text' | 'number' | 'toggle' | 'select' | 'textarea';
export type Severity = 'info' | 'warning' | 'error';
export type TemplateId = 'water-prep' | 'soap-line' | 'cip-fragment';
export type EdgeLabelMode = 'hidden' | 'selected' | 'active' | 'all';
export type EquipmentClass = 'major' | 'line' | 'valve' | 'instrument' | 'topology';
export type ValveMode = 'manual' | 'auto';
export type FailPosition = 'open' | 'closed' | 'hold';
export type SignalType = 'analogue' | 'digital' | 'pulse';
export type TopologyMode = 'distribution' | 'collection' | 'mixing' | 'drain';

export interface PropertyField {
  key: string;
  label: string;
  type: PropertyFieldType;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ label: string; value: string }>;
}

export interface TemplateViewportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TemplateViewMetadata {
  defaultZoom: number;
  minZoom?: number;
  maxZoom?: number;
  preferredPadding: number;
  center: { x: number; y: number };
  focusNodeId?: string;
  focusBounds?: TemplateViewportBounds;
}

export interface ProjectViewState {
  viewport: Viewport;
  metadata: TemplateViewMetadata;
  hasManualViewport: boolean;
}

export interface SoapNodeData {
  kind: SoapNodeKind;
  visibleName: string;
  shortName: string;
  technicalTag: string;
  category: string;
  description: string;
  className: EquipmentClass;
  status: NodeStatus;
  rotation: number;
  medium: MediumType;
  notes?: string;
  process: Record<string, number | string | boolean>;
  visual: {
    accent: string;
    fill: number;
    enabled: boolean;
    semanticSize: 'major' | 'line' | 'valve' | 'instrument' | 'topology';
    showLabel: boolean;
  };
  ports: {
    inputs: number;
    outputs: number;
    preferredDirection: 'ltr' | 'ttb';
    inline: boolean;
  };
  simulation: {
    enabled: boolean;
    active: boolean;
    blocked: boolean;
    routeState: RouteState;
    flow: number;
    lastEvent?: string;
    alarmText?: string;
  };
}

export interface SoapEdgeData {
  medium: MediumType;
  flowActive: boolean;
  blocked: boolean;
  routeState: RouteState;
  flowRate: number;
  pressure: number;
  selectedPath?: boolean;
  sourceLabel?: string;
  targetLabel?: string;
  blockedBy?: string[];
  hovered?: boolean;
  labelMode?: EdgeLabelMode;
  segmentId?: string;
  direction?: 'forward' | 'reverse' | 'bidirectional';
  nominalDiameter?: string;
  stateLabel?: string;
}

export type SoapNode = Node<SoapNodeData>;
export type SoapEdge = Edge<SoapEdgeData>;

export interface ComponentDefinition {
  type: SoapNodeKind;
  label: string;
  shortName: string;
  technicalPrefix: string;
  category: string;
  description: string;
  className: EquipmentClass;
  defaults: Omit<SoapNodeData, 'visibleName' | 'shortName' | 'technicalTag' | 'category' | 'description' | 'className'>;
  fields: Record<InspectorTab, PropertyField[]>;
}

export interface ValidationIssue {
  id: string;
  severity: Severity;
  message: string;
  nodeIds?: string[];
  edgeIds?: string[];
}

export interface EventLogEntry {
  id: string;
  timestamp: string;
  type: string;
  message: string;
  severity: Severity;
  targetId?: string;
}

export interface SimulationSettings {
  running: boolean;
  speed: number;
  tick: number;
  warnings: string[];
  activeMedium: MediumType | 'mixed' | 'none';
  totalActiveFlow: number;
  lastEvent: string;
}

export interface ProjectDocument {
  id: string;
  name: string;
  templateId: TemplateId;
  updatedAt: string;
  appSchemaVersion: number;
  projectSchemaVersion: number;
  nodes: SoapNode[];
  edges: SoapEdge[];
  view: ProjectViewState;
  simulation: SimulationSettings;
  eventLog: EventLogEntry[];
}

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
  | 'utilityDrain'
  | 'offPageConnector'
  | 'serviceTerminal';

export type MediumType = 'water' | 'product' | 'cip' | 'waste';
export type CompositeMediumType = MediumType | 'composite';
export type FlowDirectionMode = 'forward' | 'reverse' | 'bidirectional' | 'derived';
export type FlowDirection = 'forward' | 'reverse' | 'bidirectional';
export type MediumMode = 'single' | 'mixed' | 'unknown';
export type LineRole = 'process' | 'drain' | 'CIP' | 'utility' | 'recycle';
export type PortRole = 'inlet' | 'outlet' | 'branch' | 'bidirectional';
export type SchematicOrientation = 'horizontal' | 'vertical';
export type PortOccupancy = 'occupied' | 'free';
export type MediaGroup = 'water' | 'product' | 'cip' | 'waste' | 'utility' | 'any' | 'unknown' | 'composite';
export type DirectionPolicy = 'inherited' | 'lockedForward' | 'lockedReverse' | 'bidirectional' | 'routeDriven';
export type EquipmentStatus = 'off' | 'idle' | 'standby' | 'running' | 'blocked' | 'alarm' | 'maintenance' | 'normal' | 'active' | 'warning' | 'disabled';
export type EquipmentMode = 'manual' | 'auto';
export type InspectorTab = 'main' | 'process' | 'ports' | 'signals' | 'appearance' | 'alarms' | 'simulation' | 'actions';
export type PropertyFieldType = 'text' | 'number' | 'toggle' | 'select' | 'textarea';
export type Severity = 'info' | 'warning' | 'error';
export type TemplateId = 'water-prep' | 'soap-line' | 'cip-fragment';
export type EdgeLabelMode = 'hidden' | 'selected' | 'active' | 'all';
export type PresentationMode = 'schematic' | 'simulation';
export type MeasurementPointType = 'pressure' | 'temperature' | 'flow' | 'probe';
export type MeasurementAnchorKind = 'node' | 'edge' | 'canvas';
export type EquipmentClass = 'major' | 'line' | 'valve' | 'instrument' | 'topology' | 'terminal';
export type SymbolFamily = 'vessel' | 'machinery' | 'valve' | 'instrument' | 'topology' | 'terminal';
export type FailPosition = 'open' | 'closed' | 'hold';
export type SignalQuality = 'good' | 'uncertain' | 'bad';
export type TopologyMode = 'distribution' | 'collection' | 'mixing' | 'drain';
export type ValveType = 'manual' | 'shutoff' | 'solenoid' | 'check' | 'control' | 'gate' | 'drain' | 'relief';
export type JunctionType = 'tee' | 'cross' | 'collector' | 'splitter' | 'mixing' | 'drain' | 'sample';
export type RouteState = 'idle' | 'primed' | 'flowing' | 'blocked' | 'starved' | 'draining' | 'cip' | 'alarm' | 'maintenance' | 'offline';
export type DefaultsGroupId = 'sources' | 'waterPrep' | 'vessels' | 'reactors' | 'pumps' | 'valves' | 'instrumentation' | 'pipework' | 'consumers' | 'utilities';

export interface PropertyField {
  key: string;
  label: string;
  type: PropertyFieldType;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ label: string; value: string }>;
}

export interface DefaultValueMap {
  visibleName?: string;
  technicalTag?: string;
  namingRule?: string;
  medium?: MediumType;
  mediumType?: MediumType;
  nominalDiameter?: string;
  diameterNominal?: string;
  lineRole?: LineRole;
  status?: EquipmentStatus;
  mode?: EquipmentMode;
  requiredFields?: string[];
  process?: Record<string, string | number | boolean>;
}

export interface DefaultRuleLayer {
  all?: DefaultValueMap;
  edges?: DefaultValueMap;
  groups?: Partial<Record<DefaultsGroupId, DefaultValueMap>>;
  kinds?: Partial<Record<SoapNodeKind, DefaultValueMap>>;
}

export interface ProjectDefaults {
  project: DefaultRuleLayer;
  template: DefaultRuleLayer;
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
  presentationMode: PresentationMode;
  schematicLayout?: {
    autoNodePositions: Record<string, { x: number; y: number }>;
    manualNodePositions: Record<string, { x: number; y: number }>;
  };
}

export interface BaseEquipmentProcess {
  mediumType?: MediumType;
  medium?: MediumType;
  [key: string]: string | number | boolean | string[] | undefined;
}

export interface TankProcess extends BaseEquipmentProcess {
  capacityLiters: number;
  currentLevelLiters: number;
  levelPercent: number;
  canReceive: boolean;
  canDischarge: boolean;
  temperatureC: number;
}

export interface ReactorProcess extends TankProcess {
  agitatorOn: boolean;
  heatingOn: boolean;
  batchStage: string;
  recipeName?: string;
}

export interface PumpProcess extends BaseEquipmentProcess {
  nominalFlowLpm: number;
  actualFlowLpm: number;
  nominalHeadM?: number;
  speedFactor?: number;
  powerKw: number;
  rpm: number;
  startAllowed: boolean;
  dryRunProtection: boolean;
  suctionAvailable: boolean;
}

export interface ValveProcess extends BaseEquipmentProcess {
  valveType: ValveType;
  isOpen: boolean;
  failPosition: FailPosition;
  manualOverride: boolean;
  normallyOpen: boolean;
  normallyClosed: boolean;
}

export interface SensorProcess extends BaseEquipmentProcess {
  measuredProperty: string;
  unit: string;
  currentValue: number;
  warnLow: number;
  warnHigh: number;
  alarmLow: number;
  alarmHigh: number;
  signalQuality: SignalQuality;
}

export interface TopologyProcess extends BaseEquipmentProcess {
  junctionType: JunctionType;
  allowedDirections: string;
  mixingAllowed: boolean;
  splitAllowed: boolean;
  mergeAllowed: boolean;
  branchPriority: number;
  directionPolicy: DirectionPolicy;
  topologyMode: TopologyMode;
}

export interface GenericProcess extends BaseEquipmentProcess {
  nominalFlowLpm?: number;
  actualFlowLpm?: number;
  powerKw?: number;
  rpm?: number;
  temperatureC?: number;
  pressureBar?: number;
  activityLabel?: string;
}

export type EquipmentProcess = TankProcess | ReactorProcess | PumpProcess | ValveProcess | SensorProcess | TopologyProcess | GenericProcess;

export interface SoapNodeData {
  kind: SoapNodeKind;
  id: string;
  type: SoapNodeKind;
  visibleName: string;
  shortName: string;
  technicalTag: string;
  notes?: string;
  category: string;
  mediumType: MediumType;
  medium: MediumType;
  status: EquipmentStatus;
  mode: EquipmentMode;
  alarms: string[];
  isEnabled: boolean;
  isInteractive: boolean;
  simulationEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  revision: number;
  description: string;
  className: EquipmentClass;
  subtype?: string;
  orientation?: SchematicOrientation;
  rotation: number;
  process: EquipmentProcess;
  visual: {
    accent: string;
    fill: number;
    enabled: boolean;
    semanticSize: 'major' | 'line' | 'valve' | 'instrument' | 'topology';
    showLabel: boolean;
    stateBadge?: string;
  };
  ports: {
    inputs: number;
    outputs: number;
    preferredDirection: 'ltr' | 'ttb';
    inline: boolean;
    details: Record<string, {
      portRole: PortRole;
      occupied: PortOccupancy;
      mediaGroup: MediaGroup;
      allowMixing: boolean;
    }>;
  };
  runtime: {
    enabled: boolean;
    active: boolean;
    blocked: boolean;
    routeState: RouteState;
    flow: number;
    flowLpm: number;
    lastEvent?: string;
    alarmText?: string;
  };
  simulation: SoapNodeData['runtime'];
}

export interface SoapEdgeData {
  mediumType: CompositeMediumType;
  medium: CompositeMediumType;
  flowLpm: number;
  flowRate: number;
  directionMode: FlowDirectionMode;
  nominalDiameter: string;
  routeState: RouteState;
  mediumMode: MediumMode;
  lineRole: LineRole;
  serviceTag?: string;
  upstreamRef?: string;
  downstreamRef?: string;
  flowActive: boolean;
  blocked: boolean;
  pressure: number;
  selectedPath?: boolean;
  sourceLabel?: string;
  targetLabel?: string;
  blockedBy?: string[];
  hovered?: boolean;
  labelMode?: EdgeLabelMode;
  segmentId?: string;
  direction?: FlowDirection;
  flowDirection?: FlowDirection;
  stateLabel?: string;
  routeWarnings?: string[];
  composition?: Partial<Record<MediumType, number>>;
  mixedFlow?: boolean;
  velocityMPerS?: number;
  lengthM?: number;
  innerDiameterMm?: number;
  roughnessM?: number;
  minorLossCoefficient?: number;
  localResistanceZeta?: number;
  hydraulicLossBar?: number;
  reynolds?: number;
  frictionFactor?: number;
  hydraulicConstraint?: string;
  pumpHeadGainM?: number;
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
  family: SymbolFamily;
  familyLabel: string;
  subtype: string;
  subtypeLabel: string;
  libraryTags: string[];
  tags: string[];
  aliases: string[];
  synonyms: string[];
  insertionContextHints: string[];
  compatibilityHints: string[];
  searchMetadata: string[];
  ruDescriptionShort: string;
  placementNote?: string;
  auditNote: string;
  defaults: Omit<SoapNodeData, 'id' | 'type' | 'visibleName' | 'shortName' | 'technicalTag' | 'category' | 'description' | 'className' | 'createdAt' | 'updatedAt' | 'revision'>;
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

export interface SimulationFluidSettings {
  id: string;
  kind: 'water' | 'oil' | 'glycol' | 'custom';
  name: string;
  densityKgPerM3: number;
  dynamicViscosityPaS: number;
  bulkModulusPa?: number;
}

export interface SimulationSettings {
  status: 'idle' | 'running' | 'paused';
  running: boolean;
  speed: number;
  tick: number;
  warnings: string[];
  activeMedium: MediumType | 'mixed' | 'none';
  totalActiveFlow: number;
  lastEvent: string;
  fluid: SimulationFluidSettings;
  scenarioRevision: number;
}

export interface MeasurementPoint {
  id: string;
  type: MeasurementPointType;
  shortTag: string;
  label?: string;
  anchor: {
    kind: MeasurementAnchorKind;
    nodeId?: string;
    edgeId?: string;
    ratio?: number;
    x?: number;
    y?: number;
    offsetX?: number;
    offsetY?: number;
  };
  visible: boolean;
  enabled: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
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
  measurementPoints: MeasurementPoint[];
  defaults: ProjectDefaults;
}

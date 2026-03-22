import type { Edge, Node, Viewport } from 'reactflow';

export type SoapNodeKind =
  | 'inlet'
  | 'filter'
  | 'ro'
  | 'tank'
  | 'reactor'
  | 'heatedReactor'
  | 'pump'
  | 'valve'
  | 'sensor'
  | 'filling'
  | 'drain';

export type MediumType = 'water' | 'product' | 'cip' | 'waste';
export type NodeStatus = 'normal' | 'active' | 'warning' | 'alarm' | 'disabled';
export type RouteState = 'idle' | 'primed' | 'flowing' | 'blocked' | 'starved' | 'draining' | 'cip' | 'alarm' | 'offline';
export type InspectorTab = 'main' | 'process' | 'ports' | 'signals' | 'appearance' | 'alarms' | 'simulation';
export type PropertyFieldType = 'text' | 'number' | 'toggle' | 'select' | 'textarea';
export type Severity = 'info' | 'warning' | 'error';
export type TemplateId = 'water-prep' | 'soap-line' | 'cip-fragment';
export type EdgeLabelMode = 'hidden' | 'selected' | 'active' | 'all';

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
  label: string;
  shortName: string;
  tag: string;
  category: string;
  description: string;
  status: NodeStatus;
  rotation: number;
  medium: MediumType;
  process: Record<string, number | string | boolean>;
  visual: {
    accent: string;
    fill: number;
    enabled: boolean;
    semanticSize: 'main' | 'inline' | 'instrument';
    showLabel: boolean;
  };
  ports: {
    inputs: number;
    outputs: number;
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
}

export type SoapNode = Node<SoapNodeData>;
export type SoapEdge = Edge<SoapEdgeData>;

export interface ComponentDefinition {
  type: SoapNodeKind;
  label: string;
  shortName: string;
  category: string;
  description: string;
  defaults: Omit<SoapNodeData, 'label' | 'shortName' | 'category' | 'description'>;
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
  nodes: SoapNode[];
  edges: SoapEdge[];
  view: ProjectViewState;
  simulation: SimulationSettings;
  eventLog: EventLogEntry[];
}

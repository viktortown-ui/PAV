import type { Edge, Node } from 'reactflow';

export type SoapNodeKind =
  | 'inlet'
  | 'filter'
  | 'ro'
  | 'tank'
  | 'reactor'
  | 'pump'
  | 'valve'
  | 'sensor'
  | 'filling'
  | 'utility';

export type NodeStatus = 'normal' | 'active' | 'warning' | 'alarm' | 'disabled';

export type PropertyFieldType = 'text' | 'number' | 'toggle' | 'select' | 'textarea';

export interface PropertyField {
  key: string;
  label: string;
  type: PropertyFieldType;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ label: string; value: string }>;
}

export interface SoapNodeData {
  label: string;
  tag: string;
  category: string;
  description: string;
  status: NodeStatus;
  alarm?: string;
  rotation: number;
  process: Record<string, number | string | boolean>;
  visual: {
    accent: string;
    fill: number;
    enabled: boolean;
    mixing: boolean;
  };
  ports: {
    inputs: number;
    outputs: number;
  };
  simulation: {
    enabled: boolean;
    active: boolean;
    flow: number;
    blocked: boolean;
  };
}

export type SoapNode = Node<SoapNodeData>;
export type SoapEdge = Edge<{ flowActive?: boolean; blocked?: boolean; flowRate?: number }>;

export interface ComponentDefinition {
  type: SoapNodeKind;
  label: string;
  category: string;
  description: string;
  defaults: Omit<SoapNodeData, 'label' | 'category' | 'description'>;
  fields: {
    general: PropertyField[];
    process: PropertyField[];
    visual: PropertyField[];
    simulation: PropertyField[];
  };
}

export interface ProjectDocument {
  id: string;
  name: string;
  updatedAt: string;
  nodes: SoapNode[];
  edges: SoapEdge[];
  viewport: { x: number; y: number; zoom: number };
  simulation: SimulationSettings;
}

export interface SimulationSettings {
  running: boolean;
  speed: number;
  tick: number;
  warnings: string[];
}

export type PhysicsId = string;

export type FluidKind = 'water' | 'oil' | 'glycol' | 'custom';

export interface FluidProperties {
  id: PhysicsId;
  kind: FluidKind;
  name: string;
  densityKgPerM3: number;
  dynamicViscosityPaS: number;
  bulkModulusPa?: number;
}

export interface JunctionNode {
  id: PhysicsId;
  kind: 'junction';
  elevationM: number;
  demandM3PerS?: number;
}

export interface TankNode {
  id: PhysicsId;
  kind: 'tank';
  elevationM: number;
  volumeM3: number;
  liquidLevelM: number;
  crossSectionAreaM2: number;
}

export type HydraulicNode = JunctionNode | TankNode;

export interface BaseEdge {
  id: PhysicsId;
  fromNodeId: PhysicsId;
  toNodeId: PhysicsId;
}

export interface PipeEdge extends BaseEdge {
  kind: 'pipe';
  lengthM: number;
  innerDiameterM: number;
  roughnessM: number;
  minorLossCoefficient?: number;
}

export interface PumpEdge extends BaseEdge {
  kind: 'pump';
  ratedFlowM3PerS: number;
  ratedHeadM: number;
  efficiency: number;
  speedRatio?: number;
}

export interface ValveEdge extends BaseEdge {
  kind: 'valve';
  kvM3PerHour: number;
  openingRatio: number;
  isCheckValve?: boolean;
}

export type HydraulicEdge = PipeEdge | PumpEdge | ValveEdge;

export interface HydraulicNetworkInput {
  id: PhysicsId;
  fluid: FluidProperties;
  nodes: HydraulicNode[];
  edges: HydraulicEdge[];
}

export interface EdgeHydraulicResult {
  edgeId: PhysicsId;
  flowM3PerS: number;
  pressureDropPa: number;
  velocityMPerS?: number;
}

export interface NodeHydraulicResult {
  nodeId: PhysicsId;
  pressurePa: number;
  headM: number;
}

export interface TankState {
  nodeId: PhysicsId;
  volumeM3: number;
  liquidLevelM: number;
}

export interface SolverSnapshot {
  nodeResults: NodeHydraulicResult[];
  edgeResults: EdgeHydraulicResult[];
  warnings: string[];
}

export interface SimulationUiNodeResult {
  nodeId: PhysicsId;
  pressureBar: number;
  levelPercent?: number;
}

export interface SimulationUiEdgeResult {
  edgeId: PhysicsId;
  flowLpm: number;
  pressureDropBar: number;
}

export interface SimulationUiResult {
  nodes: SimulationUiNodeResult[];
  edges: SimulationUiEdgeResult[];
  warnings: string[];
}

export interface SimulationStepInput {
  dtSeconds: number;
}

export interface SimulationState {
  network: HydraulicNetworkInput;
  timeSeconds: number;
  tankStates: Record<PhysicsId, TankState>;
  latestSnapshot: SolverSnapshot;
}

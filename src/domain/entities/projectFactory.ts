import { MarkerType } from 'reactflow';
import { resolveEdgeDefaults, resolveNodeDefaults, type DefaultsContext } from '../defaults/defaults';
import { componentMap } from '../registry/componentRegistry';
import { demoProject } from '../templates/templates';
import { ProjectDocument, SoapEdge, SoapNode, SoapNodeKind } from '../schemas/types';

export const cloneProject = (project: ProjectDocument) => structuredClone(project);
export const makeProject = () => cloneProject(demoProject);

export const buildNode = (kind: SoapNodeKind, position: { x: number; y: number }, project: ProjectDocument = demoProject, context: DefaultsContext = {}): SoapNode => {
  const def = componentMap.get(kind)!;
  const resolved = resolveNodeDefaults(project, kind, context);
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  return {
    id,
    type: 'processNode',
    position,
    data: {
      ...structuredClone(def.defaults),
      id,
      type: kind,
      visibleName: def.label,
      shortName: def.shortName,
      technicalTag: resolved.technicalTag ?? `${def.technicalPrefix}-${String(Math.floor(Math.random() * 900) + 100)}`,
      category: def.category,
      description: def.description,
      className: def.className,
      medium: resolved.medium,
      mediumType: resolved.medium,
      status: resolved.status,
      mode: resolved.mode,
      process: { ...structuredClone(def.defaults.process), ...resolved.process, medium: resolved.medium, mediumType: resolved.medium, diameterNominal: resolved.nominalDiameter, lineRole: resolved.lineRole },
      createdAt: timestamp,
      updatedAt: timestamp,
      revision: 1,
    },
  };
};

export const buildEdge = (
  source: string,
  target: string,
  medium: NonNullable<SoapEdge['data']>['medium'] = 'water',
  nominalDiameter = 'DN50',
  handles?: { sourceHandle?: string | null; targetHandle?: string | null },
  project: ProjectDocument = demoProject,
  context: DefaultsContext = {},
): SoapEdge => {
  const resolved = resolveEdgeDefaults(project, context);
  const selectedMedium = medium ?? resolved.medium;
  const selectedDiameter = nominalDiameter ?? resolved.nominalDiameter;
  return {
    id: crypto.randomUUID(),
    source,
    target,
    sourceHandle: handles?.sourceHandle ?? null,
    targetHandle: handles?.targetHandle ?? null,
    type: 'flowEdge',
    markerEnd: { type: MarkerType.ArrowClosed },
    animated: false,
    data: {
      mediumType: selectedMedium,
      medium: selectedMedium,
      flowLpm: 0,
      flowRate: 0,
      flowActive: false,
      blocked: false,
      routeState: 'idle',
      pressure: 0,
      directionMode: 'derived',
      nominalDiameter: selectedDiameter,
      mediumMode: 'single',
      lineRole: resolved.lineRole,
      direction: 'forward',
      stateLabel: 'Ожидание',
      routeWarnings: [],
      composition: { [selectedMedium]: 1 },
      mixedFlow: false,
      segmentId: crypto.randomUUID(),
      upstreamRef: source,
      downstreamRef: target,
    },
  };
};

export const midPoint = (source: SoapNode, target: SoapNode) => ({
  x: (source.position.x + target.position.x) / 2,
  y: (source.position.y + target.position.y) / 2,
});

import { MarkerType } from 'reactflow';
import { componentMap } from '../registry/componentRegistry';
import { demoProject } from '../templates/templates';
import { ProjectDocument, SoapEdge, SoapNode, SoapNodeKind } from '../schemas/types';

export const cloneProject = (project: ProjectDocument) => structuredClone(project);
export const makeProject = () => cloneProject(demoProject);

export const buildNode = (kind: SoapNodeKind, position: { x: number; y: number }): SoapNode => {
  const def = componentMap.get(kind)!;
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
      technicalTag: `${def.technicalPrefix}-${String(Math.floor(Math.random() * 900) + 100)}`,
      category: def.category,
      description: def.description,
      className: def.className,
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
): SoapEdge => ({
  id: crypto.randomUUID(),
  source,
  target,
  sourceHandle: handles?.sourceHandle ?? null,
  targetHandle: handles?.targetHandle ?? null,
  type: 'flowEdge',
  markerEnd: { type: MarkerType.ArrowClosed },
  animated: false,
  data: {
    mediumType: medium,
    medium,
    flowLpm: 0,
    flowRate: 0,
    flowActive: false,
    blocked: false,
    routeState: 'idle',
    pressure: 0,
    nominalDiameter,
    direction: 'forward',
    stateLabel: 'Ожидание',
    segmentId: crypto.randomUUID(),
    upstreamRef: source,
    downstreamRef: target,
  },
});

export const midPoint = (source: SoapNode, target: SoapNode) => ({
  x: (source.position.x + target.position.x) / 2,
  y: (source.position.y + target.position.y) / 2,
});

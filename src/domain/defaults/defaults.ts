import { componentMap } from '../registry/componentRegistry';
import { DefaultRuleLayer, DefaultValueMap, DefaultsGroupId, LineRole, MediumType, ProjectDocument, SoapEdge, SoapNode, SoapNodeKind } from '../schemas/types';

export interface DefaultsContext {
  selectedNode?: SoapNode;
  selectedEdge?: SoapEdge;
  groupId?: DefaultsGroupId;
}

export interface ResolvedNodeDefaults extends DefaultValueMap {
  namingRule: string;
  medium: MediumType;
  nominalDiameter: string;
  lineRole: LineRole;
  status: NonNullable<DefaultValueMap['status']>;
  mode: NonNullable<DefaultValueMap['mode']>;
  requiredFields: string[];
  process: Record<string, string | number | boolean>;
}

export interface ResolvedEdgeDefaults extends DefaultValueMap {
  medium: MediumType;
  nominalDiameter: string;
  lineRole: LineRole;
}

const mergeDefaults = (...layers: Array<DefaultValueMap | undefined>): DefaultValueMap => {
  const merged: DefaultValueMap = {};
  layers.forEach((layer) => {
    if (!layer) return;
    Object.assign(merged, layer);
    merged.process = { ...(merged.process ?? {}), ...(layer.process ?? {}) };
    if (layer.requiredFields) merged.requiredFields = [...layer.requiredFields];
  });
  return merged;
};

const inferNodeContext = (node?: SoapNode): DefaultValueMap | undefined => {
  if (!node) return undefined;
  const process = node.data.process as Record<string, string | number | boolean | undefined>;
  return {
    medium: (process.mediumType ?? process.medium ?? node.data.medium) as MediumType,
    mediumType: (process.mediumType ?? process.medium ?? node.data.medium) as MediumType,
    nominalDiameter: (process.diameterNominal as string | undefined) ?? 'DN50',
    diameterNominal: (process.diameterNominal as string | undefined) ?? 'DN50',
    status: node.data.status,
    mode: node.data.mode,
    process: {
      medium: (process.mediumType ?? process.medium ?? node.data.medium) as MediumType,
      mediumType: (process.mediumType ?? process.medium ?? node.data.medium) as MediumType,
      diameterNominal: (process.diameterNominal as string | undefined) ?? 'DN50',
      ...(process.lineRole ? { lineRole: String(process.lineRole) } : {}),
    },
  };
};

const inferEdgeContext = (edge?: SoapEdge): DefaultValueMap | undefined => edge?.data ? {
  medium: (edge.data.mediumType === 'composite' ? 'product' : edge.data.mediumType ?? edge.data.medium) as MediumType,
  mediumType: (edge.data.mediumType === 'composite' ? 'product' : edge.data.mediumType ?? edge.data.medium) as MediumType,
  nominalDiameter: edge.data.nominalDiameter,
  diameterNominal: edge.data.nominalDiameter,
  lineRole: edge.data.lineRole,
  process: {
    medium: (edge.data.mediumType === 'composite' ? 'product' : edge.data.mediumType ?? edge.data.medium) as MediumType,
    mediumType: (edge.data.mediumType === 'composite' ? 'product' : edge.data.mediumType ?? edge.data.medium) as MediumType,
    diameterNominal: edge.data.nominalDiameter,
    lineRole: edge.data.lineRole,
  },
} : undefined;

const extractLayerDefaults = (layer: DefaultRuleLayer, kind: SoapNodeKind, groupId?: DefaultsGroupId) => mergeDefaults(
  layer.all,
  groupId ? layer.groups?.[groupId] : undefined,
  layer.kinds?.[kind],
);

export const resolveNodeDefaults = (project: ProjectDocument, kind: SoapNodeKind, context: DefaultsContext = {}): ResolvedNodeDefaults => {
  const definition = componentMap.get(kind)!;
  const typeDefaults: DefaultValueMap = {
    namingRule: '{prefix}-{seq}',
    medium: definition.defaults.medium,
    mediumType: definition.defaults.mediumType,
    nominalDiameter: String((definition.defaults.process as Record<string, string | number | boolean | undefined>).diameterNominal ?? 'DN50'),
    diameterNominal: String((definition.defaults.process as Record<string, string | number | boolean | undefined>).diameterNominal ?? 'DN50'),
    lineRole: definition.defaults.medium === 'cip' ? 'CIP' : definition.defaults.medium === 'waste' ? 'drain' : 'process',
    status: definition.defaults.status,
    mode: definition.defaults.mode,
    process: definition.defaults.process as Record<string, string | number | boolean>,
  };
  const merged = mergeDefaults(
    typeDefaults,
    extractLayerDefaults(project.defaults.project, kind, context.groupId),
    extractLayerDefaults(project.defaults.template, kind, context.groupId),
    inferNodeContext(context.selectedNode),
    inferEdgeContext(context.selectedEdge),
  );
  return {
    ...merged,
    namingRule: merged.namingRule ?? '{prefix}-{seq}',
    medium: (merged.mediumType ?? merged.medium ?? definition.defaults.medium) as MediumType,
    nominalDiameter: String(merged.nominalDiameter ?? merged.diameterNominal ?? 'DN50'),
    lineRole: (merged.lineRole ?? typeDefaults.lineRole ?? 'process') as LineRole,
    status: (merged.status ?? definition.defaults.status),
    mode: (merged.mode ?? definition.defaults.mode),
    requiredFields: merged.requiredFields ?? [],
    process: merged.process ?? {},
  };
};

export const resolveEdgeDefaults = (project: ProjectDocument, context: DefaultsContext = {}): ResolvedEdgeDefaults => {
  const base: DefaultValueMap = { medium: 'water', mediumType: 'water', nominalDiameter: 'DN50', diameterNominal: 'DN50', lineRole: 'process' };
  const merged = mergeDefaults(
    base,
    project.defaults.project.all,
    project.defaults.project.edges,
    context.groupId ? project.defaults.project.groups?.[context.groupId] : undefined,
    project.defaults.template.all,
    project.defaults.template.edges,
    context.groupId ? project.defaults.template.groups?.[context.groupId] : undefined,
    inferNodeContext(context.selectedNode),
    inferEdgeContext(context.selectedEdge),
  );
  const medium = (merged.mediumType ?? merged.medium ?? 'water') as MediumType;
  return {
    ...merged,
    medium,
    nominalDiameter: String(merged.nominalDiameter ?? merged.diameterNominal ?? 'DN50'),
    lineRole: (merged.lineRole ?? (medium === 'cip' ? 'CIP' : medium === 'waste' ? 'drain' : 'process')) as LineRole,
  };
};

import { componentMap, componentRegistry } from '../../domain/registry/componentRegistry';
import { resolveNodeDefaults } from '../../domain/defaults/defaults';
import { DefaultsGroupId, MediumType, PropertyFieldType, SoapEdge, SoapNode, SoapNodeData, SoapNodeKind, ProjectDocument } from '../../domain/schemas/types';

export type EquipmentWizardGroupId = DefaultsGroupId;

export interface EquipmentWizardField {
  key: string;
  label: string;
  type: Exclude<PropertyFieldType, 'textarea'>;
  required: boolean;
  options?: Array<{ label: string; value: string }>;
  source: 'top-level' | 'process';
  unitHint?: string;
}

export interface EquipmentWizardSubtype {
  kind: SoapNodeKind;
  label: string;
  description: string;
}

export interface EquipmentWizardGroup {
  id: EquipmentWizardGroupId;
  label: string;
  description: string;
  subtypeKinds: SoapNodeKind[];
  defaults: Partial<Record<string, string | number | boolean>>;
}

export interface EquipmentWizardContext {
  selectedNode?: SoapNode;
  selectedEdge?: SoapEdge;
  namingRule: string;
  inferredMedium?: MediumType;
  inferredDiameter?: string;
}

export interface EquipmentWizardDraft {
  groupId: EquipmentWizardGroupId;
  kind: SoapNodeKind;
  values: Record<string, string | number | boolean>;
}

const select = (label: string, value: string) => ({ label, value });

export const wizardGroups: EquipmentWizardGroup[] = [
  { id: 'sources', label: 'Источники', description: 'Подача исходных сред и входные точки.', subtypeKinds: ['source'], defaults: { medium: 'water' } },
  { id: 'waterPrep', label: 'Подготовка воды', description: 'Блоки фильтрации и мембранной очистки.', subtypeKinds: ['waterFilter', 'roSkid', 'filterUnit'], defaults: { medium: 'water' } },
  { id: 'vessels', label: 'Ёмкости', description: 'Накопление, буферизация и хранение.', subtypeKinds: ['tank', 'bufferTank'], defaults: { medium: 'product' } },
  { id: 'reactors', label: 'Реакторы', description: 'Реакционные и смешивающие аппараты.', subtypeKinds: ['reactor', 'heatedReactor'], defaults: { medium: 'product', agitatorOn: true } },
  { id: 'pumps', label: 'Насосы', description: 'Перекачка и дозирование среды.', subtypeKinds: ['pump', 'dosingPump'], defaults: { flowRate: 25, dryRunProtection: true } },
  { id: 'valves', label: 'Арматура', description: 'Запорная, регулирующая и защитная арматура.', subtypeKinds: ['manualValve', 'shutoffValve', 'solenoidValve', 'checkValve', 'controlValve', 'gateValve', 'drainValve', 'reliefValve'], defaults: { normallyOpen: false, failPosition: 'closed' } },
  { id: 'instrumentation', label: 'КИП', description: 'Измерение, индикация и сигнализация.', subtypeKinds: ['flowMeter', 'pressureSensor', 'temperatureSensor', 'levelSensor', 'phSensor', 'conductivitySensor', 'indicator'], defaults: { warningLow: 0, warningHigh: 0 } },
  { id: 'pipework', label: 'Трубные узлы', description: 'Соединения, распределение и сервисные точки.', subtypeKinds: ['inlineFilter', 'inlineMixer', 'heatExchanger', 'tee', 'cross', 'collector', 'splitter', 'mixingJunction', 'drainBranch', 'samplePoint', 'offPageConnector', 'serviceTerminal'], defaults: { diameterNominal: 'DN50' } },
  { id: 'consumers', label: 'Потребители', description: 'Финальные приёмники среды.', subtypeKinds: ['consumer', 'fillingStation'], defaults: { medium: 'product' } },
  { id: 'utilities', label: 'Утилиты', description: 'Слив, дренаж и вспомогательные узлы.', subtypeKinds: ['utilityDrain', 'serviceTerminal'], defaults: { medium: 'waste' } },
];

export const wizardSubtypeMap = new Map<SoapNodeKind, EquipmentWizardGroupId>(wizardGroups.flatMap((group) => group.subtypeKinds.map((kind) => [kind, group.id] as const)));

const mediumOptions = [select('Вода', 'water'), select('Продукт', 'product'), select('CIP', 'cip'), select('Сток', 'waste')];
const modeOptions = [select('Авто', 'auto'), select('Ручной', 'manual')];
const failPositionOptions = [select('Открыт', 'open'), select('Закрыт', 'closed'), select('Удержание', 'hold')];
const onOffOptions = [select('Да', 'true'), select('Нет', 'false')];
const signalOptions = [select('Расход', 'flow'), select('Давление', 'pressure'), select('Температура', 'temperature'), select('Уровень', 'level'), select('pH', 'ph'), select('Проводимость', 'conductivity')];

const commonFields: EquipmentWizardField[] = [
  { key: 'visibleName', label: 'Название', type: 'text', required: true, source: 'top-level' },
  { key: 'technicalTag', label: 'Тег', type: 'text', required: true, source: 'top-level' },
];

const wizardFieldMap: Partial<Record<SoapNodeKind, EquipmentWizardField[]>> = {
  pump: [...commonFields, { key: 'flowRate', label: 'Номинальный расход', type: 'number', required: true, source: 'process', unitHint: 'л/мин' }, { key: 'powerKw', label: 'Мощность', type: 'number', required: true, source: 'process', unitHint: 'кВт' }, { key: 'mode', label: 'Режим', type: 'select', required: true, source: 'top-level', options: modeOptions }, { key: 'dryRunProtection', label: 'Защита от сухого хода', type: 'select', required: true, source: 'process', options: onOffOptions }],
  dosingPump: [...commonFields, { key: 'flowRate', label: 'Номинальный расход', type: 'number', required: true, source: 'process', unitHint: 'л/мин' }, { key: 'powerKw', label: 'Мощность', type: 'number', required: true, source: 'process', unitHint: 'кВт' }, { key: 'mode', label: 'Режим', type: 'select', required: true, source: 'top-level', options: modeOptions }, { key: 'dryRunProtection', label: 'Защита от сухого хода', type: 'select', required: true, source: 'process', options: onOffOptions }],
  manualValve: [...commonFields, { key: 'valveType', label: 'Тип клапана', type: 'text', required: true, source: 'process' }, { key: 'normallyOpen', label: 'Нормально открыт/закрыт', type: 'select', required: true, source: 'process', options: [select('Нормально открыт', 'true'), select('Нормально закрыт', 'false')] }, { key: 'failPosition', label: 'Fail position', type: 'select', required: true, source: 'process', options: failPositionOptions }],
  shutoffValve: [...commonFields, { key: 'valveType', label: 'Тип клапана', type: 'text', required: true, source: 'process' }, { key: 'normallyOpen', label: 'Нормально открыт/закрыт', type: 'select', required: true, source: 'process', options: [select('Нормально открыт', 'true'), select('Нормально закрыт', 'false')] }, { key: 'failPosition', label: 'Fail position', type: 'select', required: true, source: 'process', options: failPositionOptions }],
  solenoidValve: [...commonFields, { key: 'valveType', label: 'Тип клапана', type: 'text', required: true, source: 'process' }, { key: 'normallyOpen', label: 'Нормально открыт/закрыт', type: 'select', required: true, source: 'process', options: [select('Нормально открыт', 'true'), select('Нормально закрыт', 'false')] }, { key: 'failPosition', label: 'Fail position', type: 'select', required: true, source: 'process', options: failPositionOptions }],
  checkValve: [...commonFields, { key: 'valveType', label: 'Тип клапана', type: 'text', required: true, source: 'process' }, { key: 'normallyOpen', label: 'Нормально открыт/закрыт', type: 'select', required: true, source: 'process', options: [select('Нормально открыт', 'true'), select('Нормально закрыт', 'false')] }, { key: 'failPosition', label: 'Fail position', type: 'select', required: true, source: 'process', options: failPositionOptions }],
  controlValve: [...commonFields, { key: 'valveType', label: 'Тип клапана', type: 'text', required: true, source: 'process' }, { key: 'normallyOpen', label: 'Нормально открыт/закрыт', type: 'select', required: true, source: 'process', options: [select('Нормально открыт', 'true'), select('Нормально закрыт', 'false')] }, { key: 'failPosition', label: 'Fail position', type: 'select', required: true, source: 'process', options: failPositionOptions }],
  gateValve: [...commonFields, { key: 'valveType', label: 'Тип клапана', type: 'text', required: true, source: 'process' }, { key: 'normallyOpen', label: 'Нормально открыт/закрыт', type: 'select', required: true, source: 'process', options: [select('Нормально открыт', 'true'), select('Нормально закрыт', 'false')] }, { key: 'failPosition', label: 'Fail position', type: 'select', required: true, source: 'process', options: failPositionOptions }],
  drainValve: [...commonFields, { key: 'valveType', label: 'Тип клапана', type: 'text', required: true, source: 'process' }, { key: 'normallyOpen', label: 'Нормально открыт/закрыт', type: 'select', required: true, source: 'process', options: [select('Нормально открыт', 'true'), select('Нормально закрыт', 'false')] }, { key: 'failPosition', label: 'Fail position', type: 'select', required: true, source: 'process', options: failPositionOptions }],
  reliefValve: [...commonFields, { key: 'valveType', label: 'Тип клапана', type: 'text', required: true, source: 'process' }, { key: 'normallyOpen', label: 'Нормально открыт/закрыт', type: 'select', required: true, source: 'process', options: [select('Нормально открыт', 'true'), select('Нормально закрыт', 'false')] }, { key: 'failPosition', label: 'Fail position', type: 'select', required: true, source: 'process', options: failPositionOptions }],
  reactor: [...commonFields, { key: 'capacity', label: 'Объём', type: 'number', required: true, source: 'process', unitHint: 'л' }, { key: 'temperature', label: 'Температура', type: 'number', required: true, source: 'process', unitHint: '°C' }, { key: 'heatingOn', label: 'Нагрев', type: 'select', required: true, source: 'process', options: onOffOptions }, { key: 'agitatorOn', label: 'Мешалка', type: 'select', required: true, source: 'process', options: onOffOptions }],
  heatedReactor: [...commonFields, { key: 'capacity', label: 'Объём', type: 'number', required: true, source: 'process', unitHint: 'л' }, { key: 'temperature', label: 'Температура', type: 'number', required: true, source: 'process', unitHint: '°C' }, { key: 'heatingOn', label: 'Нагрев', type: 'select', required: true, source: 'process', options: onOffOptions }, { key: 'agitatorOn', label: 'Мешалка', type: 'select', required: true, source: 'process', options: onOffOptions }],
  pressureSensor: [...commonFields, { key: 'measuredProperty', label: 'Измеряемый параметр', type: 'select', required: true, source: 'process', options: signalOptions }, { key: 'unit', label: 'Единица', type: 'text', required: true, source: 'process' }, { key: 'warnLow', label: 'Порог нижний', type: 'number', required: true, source: 'process' }, { key: 'warnHigh', label: 'Порог верхний', type: 'number', required: true, source: 'process' }],
  flowMeter: [...commonFields, { key: 'measuredProperty', label: 'Измеряемый параметр', type: 'select', required: true, source: 'process', options: signalOptions }, { key: 'unit', label: 'Единица', type: 'text', required: true, source: 'process' }, { key: 'warnLow', label: 'Порог нижний', type: 'number', required: true, source: 'process' }, { key: 'warnHigh', label: 'Порог верхний', type: 'number', required: true, source: 'process' }],
  temperatureSensor: [...commonFields, { key: 'measuredProperty', label: 'Измеряемый параметр', type: 'select', required: true, source: 'process', options: signalOptions }, { key: 'unit', label: 'Единица', type: 'text', required: true, source: 'process' }, { key: 'warnLow', label: 'Порог нижний', type: 'number', required: true, source: 'process' }, { key: 'warnHigh', label: 'Порог верхний', type: 'number', required: true, source: 'process' }],
  levelSensor: [...commonFields, { key: 'measuredProperty', label: 'Измеряемый параметр', type: 'select', required: true, source: 'process', options: signalOptions }, { key: 'unit', label: 'Единица', type: 'text', required: true, source: 'process' }, { key: 'warnLow', label: 'Порог нижний', type: 'number', required: true, source: 'process' }, { key: 'warnHigh', label: 'Порог верхний', type: 'number', required: true, source: 'process' }],
  phSensor: [...commonFields, { key: 'measuredProperty', label: 'Измеряемый параметр', type: 'select', required: true, source: 'process', options: signalOptions }, { key: 'unit', label: 'Единица', type: 'text', required: true, source: 'process' }, { key: 'warnLow', label: 'Порог нижний', type: 'number', required: true, source: 'process' }, { key: 'warnHigh', label: 'Порог верхний', type: 'number', required: true, source: 'process' }],
  conductivitySensor: [...commonFields, { key: 'measuredProperty', label: 'Измеряемый параметр', type: 'select', required: true, source: 'process', options: signalOptions }, { key: 'unit', label: 'Единица', type: 'text', required: true, source: 'process' }, { key: 'warnLow', label: 'Порог нижний', type: 'number', required: true, source: 'process' }, { key: 'warnHigh', label: 'Порог верхний', type: 'number', required: true, source: 'process' }],
  indicator: [...commonFields, { key: 'measuredProperty', label: 'Измеряемый параметр', type: 'select', required: true, source: 'process', options: signalOptions }, { key: 'unit', label: 'Единица', type: 'text', required: true, source: 'process' }, { key: 'warnLow', label: 'Порог нижний', type: 'number', required: true, source: 'process' }, { key: 'warnHigh', label: 'Порог верхний', type: 'number', required: true, source: 'process' }],
};

const toBoolean = (value: string | number | boolean) => value === true || value === 'true' || value === 1;
const toNumber = (value: string | number | boolean) => typeof value === 'number' ? value : Number(value);

const defaultsFromNode = (node?: SoapNode) => {
  if (!node) return {};
  const process = node.data.process as Record<string, string | number | boolean | undefined>;
  return {
    medium: (process.medium ?? process.mediumType ?? node.data.medium) as string | undefined,
    diameterNominal: (process.diameterNominal as string | undefined) ?? 'DN50',
  };
};

const defaultsFromEdge = (edge?: SoapEdge) => ({
  medium: edge?.data?.medium ?? edge?.data?.mediumType,
  diameterNominal: edge?.data?.nominalDiameter,
});

export const inferWizardContext = (project: ProjectDocument, selectedNodeId?: string, selectedEdgeId?: string): EquipmentWizardContext => {
  const selectedNode = project.nodes.find((node) => node.id === selectedNodeId);
  const selectedEdge = project.edges.find((edge) => edge.id === selectedEdgeId);
  const nodeDefaults = defaultsFromNode(selectedNode);
  const edgeDefaults = defaultsFromEdge(selectedEdge);
  const inferred = resolveNodeDefaults(project, selectedNode?.data.kind ?? 'pump', { selectedNode, selectedEdge });
  return {
    selectedNode,
    selectedEdge,
    namingRule: inferred.namingRule,
    inferredMedium: (edgeDefaults.medium ?? nodeDefaults.medium ?? inferred.medium ?? 'water') as MediumType,
    inferredDiameter: (edgeDefaults.diameterNominal ?? nodeDefaults.diameterNominal ?? inferred.nominalDiameter ?? 'DN50') as string,
  };
};

export const getWizardSubtypes = (groupId: EquipmentWizardGroupId): EquipmentWizardSubtype[] => {
  const group = wizardGroups.find((item) => item.id === groupId);
  if (!group) return [];
  return group.subtypeKinds.map((kind) => {
    const definition = componentMap.get(kind)!;
    return { kind, label: definition.label, description: definition.ruDescriptionShort };
  });
};

export const getWizardFields = (project: ProjectDocument, groupId: EquipmentWizardGroupId, kind: SoapNodeKind, context?: EquipmentWizardContext): EquipmentWizardField[] => {
  const baseFields = wizardFieldMap[kind] ?? [
    ...commonFields,
    { key: 'medium', label: 'Среда', type: 'select', required: true, source: 'process', options: mediumOptions },
    { key: 'diameterNominal', label: 'Диаметр', type: 'text', required: false, source: 'process' },
    { key: 'mode', label: 'Режим', type: 'select', required: true, source: 'top-level', options: modeOptions },
    { key: 'activityLabel', label: 'Назначение', type: 'text', required: false, source: 'process' },
  ];
  const requiredFields = new Set(resolveNodeDefaults(project, kind, { groupId, selectedNode: context?.selectedNode, selectedEdge: context?.selectedEdge }).requiredFields);
  return baseFields.map((field) => ({ ...field, required: field.required || requiredFields.has(field.key) }));
};

export const nextTagSequence = (project: ProjectDocument, prefix: string) => {
  const numbers = project.nodes
    .map((node) => node.data.technicalTag)
    .filter((tag) => tag.startsWith(`${prefix}-`))
    .map((tag) => Number(tag.split('-').pop()))
    .filter((value) => Number.isFinite(value));
  return (numbers.length ? Math.max(...numbers) : 100) + 1;
};

export const generateTechnicalTag = (project: ProjectDocument, kind: SoapNodeKind, namingRule = '{prefix}-{seq}') => {
  const definition = componentMap.get(kind)!;
  const seq = String(nextTagSequence(project, definition.technicalPrefix)).padStart(3, '0');
  return namingRule.replace(/\{prefix\}/g, definition.technicalPrefix).replace(/\{seq\}/g, seq).replace(/\{kind\}/g, kind);
};

export const buildWizardInitialValues = (project: ProjectDocument, groupId: EquipmentWizardGroupId, kind: SoapNodeKind, context: EquipmentWizardContext) => {
  const definition = componentMap.get(kind)!;
  const groupDefaults = wizardGroups.find((item) => item.id === groupId)?.defaults ?? {};
  const resolvedDefaults = resolveNodeDefaults(project, kind, { groupId, selectedNode: context.selectedNode, selectedEdge: context.selectedEdge });
  const fields = getWizardFields(project, groupId, kind, context);
  const process = { ...(definition.defaults.process as Record<string, string | number | boolean | undefined>), ...resolvedDefaults.process };
  const base: Record<string, string | number | boolean> = {
    visibleName: definition.label,
    technicalTag: generateTechnicalTag(project, kind, resolvedDefaults.namingRule),
    mode: resolvedDefaults.mode,
    medium: context.inferredMedium ?? resolvedDefaults.medium,
    diameterNominal: context.inferredDiameter ?? resolvedDefaults.nominalDiameter,
  };
  fields.forEach((field) => {
    if (field.key in base) return;
    const value = process[field.key] ?? (resolvedDefaults as unknown as Record<string, string | number | boolean | undefined>)[field.key] ?? groupDefaults[field.key];
    if (value !== undefined) base[field.key] = value;
  });
  if ('medium' in base) base.medium = context.inferredMedium ?? (groupDefaults.medium as MediumType | undefined) ?? resolvedDefaults.medium;
  if ('diameterNominal' in base) base.diameterNominal = context.inferredDiameter ?? (groupDefaults.diameterNominal as string | undefined) ?? resolvedDefaults.nominalDiameter;
  if (kind === 'pump' || kind === 'dosingPump') {
    base.dryRunProtection = groupDefaults.dryRunProtection ?? process.dryRunProtection ?? true;
    base.powerKw = process.powerKw ?? 5.5;
  }
  if (kind === 'reactor' || kind === 'heatedReactor') {
    base.agitatorOn = process.agitatorOn ?? true;
    base.heatingOn = kind === 'heatedReactor' ? true : (process.heatingOn ?? false);
  }
  if (componentMap.get(kind)?.className === 'instrument') {
    base.measuredProperty = process.measuredProperty ?? process.signalType ?? 'flow';
    base.unit = process.unit ?? process.signalUnit ?? 'ед.';
    base.warnLow = process.warnLow ?? process.warningLow ?? 0;
    base.warnHigh = process.warnHigh ?? process.warningHigh ?? 100;
  }
  if (componentMap.get(kind)?.className === 'valve') {
    base.valveType = String(process.valveType ?? definition.label);
    base.normallyOpen = process.normallyOpen ?? false;
    base.failPosition = String(process.failPosition ?? 'closed');
  }
  return base;
};

export const applyWizardValuesToNode = (node: SoapNode, values: Record<string, string | number | boolean>) => {
  const copy: SoapNode = structuredClone(node);
  const process = copy.data.process as Record<string, string | number | boolean | undefined>;
  Object.entries(values).forEach(([key, rawValue]) => {
    const value = rawValue;
    if (key === 'visibleName' || key === 'technicalTag' || key === 'mode') (copy.data as unknown as Record<string, string | number | boolean>)[key] = value;
    else if (key === 'medium') {
      copy.data.medium = value as MediumType;
      copy.data.mediumType = value as MediumType;
      process.medium = value as MediumType;
      process.mediumType = value as MediumType;
    } else if (key === 'diameterNominal') process.diameterNominal = String(value);
    else if (['dryRunProtection', 'normallyOpen', 'heatingOn', 'agitatorOn'].includes(key)) process[key] = toBoolean(value);
    else if (['flowRate', 'capacity', 'temperature', 'powerKw', 'warnLow', 'warnHigh'].includes(key)) process[key] = toNumber(value);
    else process[key] = value;
  });
  return copy;
};

export const getWizardLaunchLabel = (kind?: SoapNodeKind) => kind ? `Создать: ${componentMap.get(kind)?.label ?? kind}` : 'Мастер оборудования';
export const hasWizardSubtype = (kind: SoapNodeKind) => componentRegistry.some((item) => item.type === kind) && wizardSubtypeMap.has(kind);

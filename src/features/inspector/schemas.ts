import { EdgeLabelMode, FlowDirectionMode, LineRole, MediumMode, MediumType, RouteState, SoapEdge } from '../../domain/schemas/types';

export interface EdgeInspectorSchema {
  mediumType: MediumType;
  flowLpm: number;
  nominalDiameter: string;
  routeState: RouteState;
  directionMode: FlowDirectionMode;
  mediumMode: MediumMode;
  lineRole: LineRole;
  upstreamRef: string;
  downstreamRef: string;
}

export const edgeInspectorFields: Array<{ key: keyof EdgeInspectorSchema; label: string; type: 'text' | 'number' | 'select'; options?: Array<{ value: string; label: string }> }> = [
  {
    key: 'mediumType',
    label: 'Среда',
    type: 'select',
    options: [
      { value: 'water', label: 'Вода' },
      { value: 'product', label: 'Продукт' },
      { value: 'cip', label: 'СИП' },
      { value: 'waste', label: 'Сток' },
    ],
  },
  { key: 'flowLpm', label: 'Расход, л/мин', type: 'number' },
  { key: 'nominalDiameter', label: 'Диаметр', type: 'text' },
  {
    key: 'routeState',
    label: 'Состояние',
    type: 'select',
    options: [
      { value: 'idle', label: 'Ожидание' },
      { value: 'primed', label: 'Подготовлен' },
      { value: 'flowing', label: 'Поток' },
      { value: 'blocked', label: 'Блокировка' },
      { value: 'starved', label: 'Нет подпитки' },
      { value: 'draining', label: 'Слив' },
      { value: 'cip', label: 'СИП' },
      { value: 'alarm', label: 'Авария' },
      { value: 'maintenance', label: 'Ремонт' },
      { value: 'offline', label: 'Отключён' },
    ],
  },
  {
    key: 'directionMode',
    label: 'Направление',
    type: 'select',
    options: [
      { value: 'forward', label: 'Прямое' },
      { value: 'reverse', label: 'Обратное' },
      { value: 'bidirectional', label: 'Двунаправленное' },
      { value: 'derived', label: 'Автоопределение' },
    ],
  },
  {
    key: 'mediumMode',
    label: 'Режим среды',
    type: 'select',
    options: [
      { value: 'single', label: 'Одна среда' },
      { value: 'mixed', label: 'Смешанная' },
      { value: 'unknown', label: 'Не определено' },
    ],
  },
  {
    key: 'lineRole',
    label: 'Роль линии',
    type: 'select',
    options: [
      { value: 'process', label: 'Основная' },
      { value: 'drain', label: 'Дренаж' },
      { value: 'CIP', label: 'СИП' },
      { value: 'utility', label: 'Служебная' },
      { value: 'recycle', label: 'Рециркуляция' },
    ],
  },
  { key: 'upstreamRef', label: 'Откуда', type: 'text' },
  { key: 'downstreamRef', label: 'Куда', type: 'text' },
];

export const createEdgeInspectorSchema = (edge: SoapEdge, fallbackRefs: { upstream: string; downstream: string }): EdgeInspectorSchema => ({
  mediumType: (edge.data?.mediumType === 'composite' ? 'product' : edge.data?.mediumType) ?? 'water',
  flowLpm: edge.data?.flowLpm ?? 0,
  nominalDiameter: edge.data?.nominalDiameter ?? 'DN50',
  routeState: edge.data?.routeState ?? 'idle',
  directionMode: edge.data?.directionMode ?? 'derived',
  mediumMode: edge.data?.mediumMode ?? 'single',
  lineRole: edge.data?.lineRole ?? 'process',
  upstreamRef: edge.data?.upstreamRef ?? fallbackRefs.upstream,
  downstreamRef: edge.data?.downstreamRef ?? fallbackRefs.downstream,
});

export const edgeLabelModes: Array<{ value: EdgeLabelMode; label: string }> = [
  { value: 'hidden', label: 'Скрыть подписи' },
  { value: 'selected', label: 'Только выбранные' },
  { value: 'active', label: 'Только активные' },
  { value: 'all', label: 'Все сегменты' },
];

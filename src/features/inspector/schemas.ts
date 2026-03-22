import { EdgeLabelMode, MediumType, RouteState, SoapEdge } from '../../domain/schemas/types';

export interface EdgeInspectorSchema {
  mediumType: MediumType;
  flowLpm: number;
  nominalDiameter: string;
  routeState: RouteState;
  upstreamRef: string;
  downstreamRef: string;
}

export const edgeInspectorFields: Array<{ key: keyof EdgeInspectorSchema; label: string; type: 'text' | 'number' | 'select'; options?: Array<{ value: string; label: string }> }> = [
  { key: 'mediumType', label: 'Среда', type: 'select', options: [
    { value: 'water', label: 'Вода' },
    { value: 'product', label: 'Продукт' },
    { value: 'cip', label: 'CIP' },
    { value: 'waste', label: 'Сток' },
  ] },
  { key: 'flowLpm', label: 'Расход, л/мин', type: 'number' },
  { key: 'nominalDiameter', label: 'Диаметр', type: 'text' },
  { key: 'routeState', label: 'Состояние', type: 'select', options: [
    'idle','primed','flowing','blocked','starved','draining','cip','alarm','maintenance','offline',
  ].map((value) => ({ value, label: value })) },
  { key: 'upstreamRef', label: 'Upstream', type: 'text' },
  { key: 'downstreamRef', label: 'Downstream', type: 'text' },
];

export const createEdgeInspectorSchema = (edge: SoapEdge, fallbackRefs: { upstream: string; downstream: string }): EdgeInspectorSchema => ({
  mediumType: edge.data?.mediumType ?? 'water',
  flowLpm: edge.data?.flowLpm ?? 0,
  nominalDiameter: edge.data?.nominalDiameter ?? 'DN50',
  routeState: edge.data?.routeState ?? 'idle',
  upstreamRef: edge.data?.upstreamRef ?? fallbackRefs.upstream,
  downstreamRef: edge.data?.downstreamRef ?? fallbackRefs.downstream,
});

export const edgeLabelModes: Array<{ value: EdgeLabelMode; label: string }> = [
  { value: 'hidden', label: 'Скрыть подписи' },
  { value: 'selected', label: 'Только выбранные' },
  { value: 'active', label: 'Только активные' },
  { value: 'all', label: 'Все сегменты' },
];

import { MarkerType, Viewport } from 'reactflow';
import { componentMap } from '../registry/componentRegistry';
import { ProjectDocument, SoapEdge, SoapNode, SoapNodeKind, TemplateId, TemplateViewMetadata } from '../schemas/types';

export const APP_SCHEMA_VERSION = 2;
export const PROJECT_SCHEMA_VERSION = 2;

const node = (id: string, type: SoapNodeKind, x: number, y: number, visibleName?: string, technicalTag?: string): SoapNode => {
  const def = componentMap.get(type)!;
  return {
    id,
    type: 'processNode',
    position: { x, y },
    data: {
      ...structuredClone(def.defaults),
      visibleName: visibleName ?? def.label,
      shortName: def.shortName,
      technicalTag: technicalTag ?? `${def.technicalPrefix}-${id.replace(/[^0-9]/g, '').slice(-3) || '101'}`,
      category: def.category,
      description: def.description,
      className: def.className,
    },
  };
};

const edge = (id: string, source: string, target: string, medium: import('../schemas/types').MediumType = 'water', nominalDiameter = 'DN50'): SoapEdge => ({
  id,
  source,
  target,
  type: 'flowEdge',
  markerEnd: { type: MarkerType.ArrowClosed },
  data: { medium, flowActive: false, blocked: false, routeState: 'idle', flowRate: 0, pressure: 0, nominalDiameter, direction: 'forward', stateLabel: 'Ожидание', segmentId: id },
  animated: false,
});

const createInitialViewport = (metadata: TemplateViewMetadata): Viewport => ({
  x: 420 - metadata.center.x * metadata.defaultZoom,
  y: 240 - metadata.center.y * metadata.defaultZoom,
  zoom: metadata.defaultZoom,
});

const makeProject = (id: TemplateId, name: string, nodes: SoapNode[], edges: SoapEdge[], metadata: TemplateViewMetadata): ProjectDocument => ({
  id: `template-${id}`,
  name,
  templateId: id,
  updatedAt: new Date().toISOString(),
  appSchemaVersion: APP_SCHEMA_VERSION,
  projectSchemaVersion: PROJECT_SCHEMA_VERSION,
  view: { metadata, viewport: createInitialViewport(metadata), hasManualViewport: false },
  simulation: { running: false, speed: 1, tick: 0, warnings: [], activeMedium: 'none', totalActiveFlow: 0, lastEvent: 'Проект загружен' },
  eventLog: [{ id: crypto.randomUUID(), timestamp: new Date().toISOString(), type: 'template', message: `Загружен шаблон: ${name}`, severity: 'info' }],
  nodes, edges,
});

export const templates: Record<TemplateId, ProjectDocument> = {
  'water-prep': makeProject('water-prep', 'Подготовка воды', [
    node('w1', 'source', 120, 250, 'Сырая вода', 'SRC-101'),
    node('w2', 'waterFilter', 360, 220, 'Фильтр грубой очистки', 'WF-101'),
    node('w3', 'roSkid', 650, 220, 'Блок обратного осмоса', 'RO-101'),
    node('w4', 'tank', 960, 170, 'Танк чистой воды', 'TK-101'),
  ], [edge('we1', 'w1', 'w2', 'water', 'DN80'), edge('we2', 'w2', 'w3', 'water', 'DN65'), edge('we3', 'w3', 'w4', 'water', 'DN65')], {
    defaultZoom: 0.98, minZoom: 0.72, maxZoom: 1.12, preferredPadding: 0.18, center: { x: 560, y: 245 }, focusNodeId: 'w3', focusBounds: { x: 80, y: 148, width: 990, height: 220 },
  }),
  'soap-line': makeProject('soap-line', 'Линия ПАВ', [
    node('s1', 'tank', 100, 220, 'Танк воды', 'TK-201'),
    node('s2', 'pump', 330, 280, 'Насос подачи', 'P-201'),
    node('s3', 'heatedReactor', 610, 170, 'Реактор ПАВ', 'R-201'),
    node('s4', 'flowMeter', 900, 270, 'Расходомер', 'FIT-201'),
    node('s5', 'shutoffValve', 1110, 270, 'Клапан отсечной', 'XV-201'),
    node('s6', 'bufferTank', 1330, 190, 'Буферная ёмкость', 'TK-202'),
    node('s7', 'fillingStation', 1620, 220, 'Станция розлива', 'FL-201'),
  ], [edge('se1', 's1', 's2', 'water', 'DN65'), edge('se2', 's2', 's3', 'product', 'DN65'), edge('se3', 's3', 's4', 'product', 'DN50'), edge('se4', 's4', 's5', 'product', 'DN50'), edge('se5', 's5', 's6', 'product', 'DN50'), edge('se6', 's6', 's7', 'product', 'DN50')], {
    defaultZoom: 0.76, minZoom: 0.58, maxZoom: 0.88, preferredPadding: 0.16, center: { x: 905, y: 252 }, focusNodeId: 's3', focusBounds: { x: 60, y: 140, width: 1710, height: 250 },
  }),
  'cip-fragment': makeProject('cip-fragment', 'CIP-фрагмент', [
    node('c1', 'tank', 140, 220, 'Танк CIP', 'TK-CIP'),
    node('c2', 'pump', 392, 276, 'CIP-насос', 'P-CIP'),
    node('c3', 'manualValve', 652, 278, 'Клапан CIP', 'XV-CIP'),
    node('c4', 'reactor', 932, 178, 'Реактор / спрей-хед', 'R-CIP'),
    node('c5', 'utilityDrain', 1220, 282, 'Обратный слив', 'DR-1'),
  ], [edge('ce1', 'c1', 'c2', 'cip', 'DN50'), edge('ce2', 'c2', 'c3', 'cip', 'DN50'), edge('ce3', 'c3', 'c4', 'cip', 'DN50'), edge('ce4', 'c4', 'c5', 'waste', 'DN50')], {
    defaultZoom: 0.86, minZoom: 0.66, maxZoom: 0.98, preferredPadding: 0.18, center: { x: 700, y: 252 }, focusNodeId: 'c4', focusBounds: { x: 90, y: 156, width: 1270, height: 238 },
  }),
};

export const demoProject = templates['soap-line'];

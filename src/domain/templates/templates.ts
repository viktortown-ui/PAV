import { MarkerType } from 'reactflow';
import { componentMap } from '../registry/componentRegistry';
import { ProjectDocument, SoapEdge, SoapNode, SoapNodeKind, TemplateId } from '../schemas/types';

const node = (id: string, type: SoapNodeKind, x: number, y: number, label?: string, shortName?: string): SoapNode => {
  const def = componentMap.get(type)!;
  return {
    id,
    type: 'processNode',
    position: { x, y },
    data: { ...structuredClone(def.defaults), label: label ?? def.label, shortName: shortName ?? def.shortName, category: def.category, description: def.description },
  };
};

const edge = (id: string, source: string, target: string, medium: import('../schemas/types').MediumType = 'water'): SoapEdge => ({
  id, source, target, type: 'flowEdge', markerEnd: { type: MarkerType.ArrowClosed },
  data: { medium, flowActive: false, blocked: false, routeState: 'idle', flowRate: 0, pressure: 0 }, animated: false,
});

const makeProject = (id: TemplateId, name: string, nodes: SoapNode[], edges: SoapEdge[]): ProjectDocument => ({
  id: `template-${id}`,
  name,
  templateId: id,
  updatedAt: new Date().toISOString(),
  viewport: { x: 60, y: 40, zoom: 0.82 },
  simulation: { running: false, speed: 1, tick: 0, warnings: [], activeMedium: 'none', totalActiveFlow: 0, lastEvent: 'Проект загружен' },
  eventLog: [{ id: crypto.randomUUID(), timestamp: new Date().toISOString(), type: 'template', message: `Загружен шаблон: ${name}`, severity: 'info' }],
  nodes, edges,
});

export const templates: Record<TemplateId, ProjectDocument> = {
  'water-prep': makeProject('water-prep', 'A. Подготовка воды', [
    node('w1', 'inlet', 60, 180, 'Сырая вода', 'Ввод'),
    node('w2', 'filter', 260, 165, 'Угольный фильтр', 'CF'),
    node('w3', 'ro', 520, 160, 'Обратный осмос', 'RO'),
    node('w4', 'tank', 820, 115, 'Танк чистой воды', 'TK-101'),
  ], [edge('we1', 'w1', 'w2', 'water'), edge('we2', 'w2', 'w3', 'water'), edge('we3', 'w3', 'w4', 'water')]),
  'soap-line': makeProject('soap-line', 'B. Небольшая линия ПАВ / мыла', [
    node('s1', 'tank', 80, 120, 'Танк воды', 'TK-201'),
    node('s2', 'pump', 300, 220, 'Насос подачи', 'P-201'),
    node('s3', 'heatedReactor', 560, 90, 'Нагреваемый реактор', 'R-201'),
    node('s4', 'sensor', 820, 240, 'Расходомер', 'FIT-201'),
    node('s5', 'valve', 1040, 240, 'Отсечной клапан', 'XV-201'),
    node('s6', 'tank', 1180, 110, 'Буферный танк', 'TK-202'),
    node('s7', 'filling', 1460, 120, 'Линия розлива', 'F-201'),
  ], [edge('se1', 's1', 's2', 'water'), edge('se2', 's2', 's3', 'product'), edge('se3', 's3', 's4', 'product'), edge('se4', 's4', 's5', 'product'), edge('se5', 's5', 's6', 'product'), edge('se6', 's6', 's7', 'product')]),
  'cip-fragment': makeProject('cip-fragment', 'C. CIP-фрагмент', [
    node('c1', 'tank', 90, 130, 'Танк CIP', 'TK-CIP'),
    node('c2', 'pump', 320, 220, 'CIP-насос', 'P-CIP'),
    node('c3', 'valve', 560, 240, 'Клапан CIP', 'XV-CIP'),
    node('c4', 'reactor', 780, 90, 'Реактор / спрей-хед', 'R-CIP'),
    node('c5', 'drain', 1060, 250, 'Обратный слив', 'DR-1'),
  ], [edge('ce1', 'c1', 'c2', 'cip'), edge('ce2', 'c2', 'c3', 'cip'), edge('ce3', 'c3', 'c4', 'cip'), edge('ce4', 'c4', 'c5', 'waste')]),
};

export const demoProject = templates['soap-line'];

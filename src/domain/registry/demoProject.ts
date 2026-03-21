import { MarkerType } from 'reactflow';
import { componentMap } from './componentRegistry';
import { ProjectDocument, SoapEdge, SoapNode, SoapNodeKind } from '../schemas/types';

const createNode = (id: string, type: SoapNodeKind, x: number, y: number, label?: string): SoapNode => {
  const def = componentMap.get(type)!;
  return {
    id,
    type: 'processNode',
    position: { x, y },
    data: {
      ...structuredClone(def.defaults),
      label: label ?? def.label,
      category: def.category,
      description: def.description,
    },
  };
};

const edge = (id: string, source: string, target: string): SoapEdge => ({
  id,
  source,
  target,
  type: 'flowEdge',
  markerEnd: { type: MarkerType.ArrowClosed },
  data: { flowActive: false, blocked: false, flowRate: 0 },
  animated: false,
});

export const demoProject: ProjectDocument = {
  id: 'demo-soapflow',
  name: 'Демо-линия SoapFlow Studio',
  updatedAt: new Date().toISOString(),
  viewport: { x: 40, y: 40, zoom: 0.9 },
  simulation: {
    running: false,
    speed: 1,
    tick: 0,
    warnings: [],
  },
  nodes: [
    createNode('n1', 'inlet', 40, 140, 'Сырьевая вода'),
    createNode('n2', 'filter', 260, 140, 'Угольный фильтр'),
    createNode('n3', 'ro', 500, 140, 'RO блок'),
    createNode('n4', 'tank', 760, 110, 'Танк чистой воды'),
    createNode('n5', 'pump', 760, 320, 'Насос подачи'),
    createNode('n6', 'reactor', 1020, 110, 'Реактор ПАВ'),
    createNode('n7', 'valve', 1250, 260, 'Клапан линии'),
    createNode('n8', 'tank', 1460, 110, 'Буфер / отстойник'),
    createNode('n9', 'sensor', 1460, 320, 'Flow sensor'),
    createNode('n10', 'filling', 1700, 140, 'Участок розлива'),
  ],
  edges: [
    edge('e1', 'n1', 'n2'),
    edge('e2', 'n2', 'n3'),
    edge('e3', 'n3', 'n4'),
    edge('e4', 'n4', 'n5'),
    edge('e5', 'n5', 'n6'),
    edge('e6', 'n6', 'n7'),
    edge('e7', 'n7', 'n8'),
    edge('e8', 'n8', 'n9'),
    edge('e9', 'n9', 'n10'),
  ],
};

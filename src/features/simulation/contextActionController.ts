import { SoapNode, SoapEdge } from '../../domain/schemas/types';
import { getEquipmentCapability } from './equipmentCapabilityRegistry';

export interface ContextActionItem {
  id: string;
  label: string;
  disabled?: boolean;
}

export const buildNodeContextActions = (node: SoapNode, hasSource: boolean, hasTarget: boolean): ContextActionItem[] => {
  const capability = getEquipmentCapability(node.data.kind);
  const process = node.data.process as Record<string, unknown>;
  const isOpen = Boolean(process.isOpen ?? process.valveOpen ?? process.valveState !== 'closed');
  const running = Boolean(process.pumpOn ?? process.isRunning ?? node.data.status === 'running');
  const isAuto = String(process.mode ?? node.data.mode).toLowerCase() !== 'manual';

  const items: ContextActionItem[] = [];
  if (capability.canStartStop) {
    items.push({ id: 'start', label: 'Включить', disabled: running });
    items.push({ id: 'stop', label: 'Выключить', disabled: !running });
  }
  if (capability.canOpenClose) {
    items.push({ id: 'open', label: 'Открыть', disabled: isOpen });
    items.push({ id: 'close', label: 'Закрыть', disabled: !isOpen });
  }
  if (capability.supportsAutoManual) {
    items.push({ id: 'auto', label: 'Авто', disabled: isAuto });
    items.push({ id: 'manual', label: 'Ручной', disabled: !isAuto });
  }
  if (capability.actions.includes('isolate')) items.push({ id: 'isolate', label: 'Изолировать' });
  items.push({ id: 'clear-alarm', label: 'Сбросить тревогу' });
  items.push({ id: 'replace', label: 'Заменить оборудование' });
  if (hasSource) items.push({ id: 'jump-source', label: 'Перейти к источнику' });
  if (hasTarget) items.push({ id: 'jump-target', label: 'Перейти к приёмнику' });
  items.push({ id: 'trace', label: 'Подсветить маршрут' });
  items.push({ id: 'diagnostics', label: 'Открыть диагностику' });
  return items;
};

export const buildEdgeContextActions = (edge: SoapEdge): ContextActionItem[] => {
  const routeBlocked = Boolean(edge.data?.blocked || (edge.data?.blockedBy?.length ?? 0) > 0);
  return [
    { id: 'jump-source', label: 'Перейти к источнику' },
    { id: 'jump-target', label: 'Перейти к приёмнику' },
    { id: 'trace', label: 'Подсветить маршрут' },
    { id: 'diagnostics', label: 'Открыть диагностику' },
    { id: 'clear-block', label: 'Сбросить блокировку', disabled: !routeBlocked },
  ];
};

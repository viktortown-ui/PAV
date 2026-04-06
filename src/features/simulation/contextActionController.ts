import { SoapNode, SoapEdge } from '../../domain/schemas/types';
import { getEquipmentCapability } from './equipmentCapabilityRegistry';

export interface ContextActionItem {
  id: string;
  label: string;
  disabled?: boolean;
  secondary?: boolean;
}

export const buildNodeContextActions = (node: SoapNode, hasSource: boolean, hasTarget: boolean): ContextActionItem[] => {
  const capability = getEquipmentCapability(node.data.kind);
  const process = node.data.process as Record<string, unknown>;
  const isOpen = Boolean(process.isOpen ?? process.valveOpen ?? process.valveState !== 'closed');
  const running = Boolean(process.pumpOn ?? process.isRunning ?? node.data.status === 'running');
  const isAuto = String(process.mode ?? node.data.mode).toLowerCase() !== 'manual';

  const primary: ContextActionItem[] = [];
  if (capability.canStartStop) primary.push({ id: running ? 'stop' : 'start', label: running ? 'Остановить' : 'Включить' });
  if (capability.canOpenClose) primary.push({ id: isOpen ? 'close' : 'open', label: isOpen ? 'Закрыть' : 'Открыть' });
  if (capability.supportsAutoManual) primary.push({ id: isAuto ? 'manual' : 'auto', label: isAuto ? 'Ручной режим' : 'Авто режим' });
  if (capability.actions.includes('isolate')) primary.push({ id: 'isolate', label: 'Изолировать' });
  primary.push({ id: 'diagnostics', label: 'Диагностика' });
  primary.push({ id: 'replace', label: 'Заменить' });

  const moreHint = hasSource || hasTarget ? 'Ещё…' : 'Маршрут';
  if (hasSource || hasTarget) primary.push({ id: 'more', label: moreHint, secondary: true });
  else primary.push({ id: 'trace', label: 'Подсветить маршрут', secondary: true });

  return primary.slice(0, 6);
};

export const buildEdgeContextActions = (edge: SoapEdge): ContextActionItem[] => {
  const routeBlocked = Boolean(edge.data?.blocked || (edge.data?.blockedBy?.length ?? 0) > 0);
  return [
    { id: 'jump-source', label: 'К источнику' },
    { id: 'jump-target', label: 'К приёмнику' },
    { id: 'trace', label: 'Подсветить маршрут' },
    { id: 'diagnostics', label: 'Диагностика' },
    { id: 'clear-block', label: 'Сбросить блокировку', disabled: !routeBlocked },
  ];
};

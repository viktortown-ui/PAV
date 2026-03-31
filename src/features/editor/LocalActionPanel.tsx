import { useMemo } from 'react';
import { EquipmentStatus, PresentationMode, RouteState, SoapEdge, SoapNode } from '../../domain/schemas/types';
import { useAppStore } from '../../store/useAppStore';

type PanelAnchor = {
  x: number;
  y: number;
  viewportWidth: number;
  viewportHeight: number;
};

type ActionItem = {
  label: string;
  action: string;
  active?: boolean;
  disabled?: boolean;
  tone?: 'base' | 'warn' | 'danger';
  reason?: string;
};

const PANEL_WIDTH = 248;
const PANEL_MAX_HEIGHT = 216;
const PANEL_GAP = 14;
const PANEL_PADDING = 10;

const ruStatus: Record<EquipmentStatus, string> = {
  off: 'Остановлен',
  idle: 'Ожидание',
  standby: 'Готовность',
  running: 'Работает',
  blocked: 'Блокировка',
  alarm: 'Авария',
  maintenance: 'Ремонт',
  normal: 'Норма',
  active: 'Активен',
  warning: 'Предупреждение',
  disabled: 'Отключён',
};

const ruRouteState: Record<RouteState, string> = {
  idle: 'Ожидание',
  primed: 'Подготовлен',
  flowing: 'Поток',
  blocked: 'Блокировка',
  starved: 'Нет подпитки',
  draining: 'Слив',
  cip: 'СИП',
  alarm: 'Авария',
  maintenance: 'Ремонт',
  offline: 'Отключён',
};

const toneByStatus = (status: string): 'ok' | 'warn' | 'alarm' | 'idle' => {
  if (status === 'running' || status === 'flowing' || status === 'active') return 'ok';
  if (status === 'alarm') return 'alarm';
  if (status === 'blocked' || status === 'warning' || status === 'maintenance' || status === 'starved') return 'warn';
  return 'idle';
};

const buildNodeActions = (node: SoapNode): ActionItem[] => {
  const process = node.data.process as any;
  const running = Boolean(process.isRunning ?? process.pumpOn ?? node.data.status === 'running');
  const intake = Boolean(process.allowIntake ?? process.canReceive ?? true);
  const discharge = Boolean(process.allowDischarge ?? process.canDischarge ?? true);
  const valveOpen = Boolean(process.isOpen ?? process.valveOpen ?? process.valveState !== 'closed');
  const autoMode = (process.valveMode ?? process.mode ?? node.data.mode) === 'auto';

  if (node.data.kind === 'reactor' || node.data.kind === 'heatedReactor') {
    return [
      { label: 'Включить', action: 'reactor:start', active: running, disabled: running, reason: running ? 'Реактор уже работает.' : undefined },
      { label: 'Остановить', action: 'reactor:stop', active: !running, tone: 'warn', disabled: !running, reason: !running ? 'Реактор уже остановлен.' : undefined },
      { label: 'Ожидание', action: 'reactor:setIdle', active: node.data.status === 'idle', disabled: node.data.status === 'idle' },
      { label: 'Ремонт', action: 'reactor:setMaintenance', active: node.data.status === 'maintenance', tone: 'warn', disabled: node.data.status === 'maintenance' },
    ];
  }

  if (node.data.kind === 'pump' || node.data.kind === 'dosingPump') {
    const hasAlarm = Boolean(node.data.alarms?.length || node.data.runtime.alarmText || node.data.simulation.alarmText);
    return [
      { label: 'Включить', action: 'pump:start', active: running, disabled: running, reason: running ? 'Насос уже работает.' : undefined },
      { label: 'Остановить', action: 'pump:stop', active: !running, tone: 'warn', disabled: !running, reason: !running ? 'Насос уже остановлен.' : undefined },
      { label: 'Сброс тревоги', action: 'pump:clearAlarm', disabled: !hasAlarm, reason: !hasAlarm ? 'Активных тревог нет.' : undefined },
    ];
  }

  if (node.data.className === 'valve') {
    return [
      { label: 'Открыт', action: 'valve:open', active: valveOpen, disabled: valveOpen, reason: valveOpen ? 'Клапан уже открыт.' : undefined },
      { label: 'Закрыт', action: 'valve:close', active: !valveOpen, tone: 'warn', disabled: !valveOpen, reason: !valveOpen ? 'Клапан уже закрыт.' : undefined },
      { label: 'Автомат', action: 'valve:auto', active: autoMode, disabled: autoMode },
      { label: 'Ручной', action: 'valve:manual', active: !autoMode, disabled: !autoMode },
    ];
  }

  if (node.data.kind === 'tank' || node.data.kind === 'bufferTank') {
    return [
      { label: 'Приём разрешён', action: 'tank:enableReceive', active: intake, disabled: intake, reason: intake ? 'Приём уже разрешён.' : undefined },
      { label: 'Приём запрещён', action: 'tank:disableReceive', active: !intake, tone: 'warn', disabled: !intake, reason: !intake ? 'Приём уже запрещён.' : undefined },
      { label: 'Выдача разрешена', action: 'tank:enableDischarge', active: discharge, disabled: discharge, reason: discharge ? 'Выдача уже разрешена.' : undefined },
      { label: 'Выдача запрещена', action: 'tank:disableDischarge', active: !discharge, tone: 'warn', disabled: !discharge, reason: !discharge ? 'Выдача уже запрещена.' : undefined },
    ];
  }

  if (node.data.kind === 'fillingStation') {
    return [
      { label: 'Приём разрешён', action: 'station:enableIntake', active: intake, disabled: intake },
      { label: 'Приём запрещён', action: 'station:disableIntake', active: !intake, tone: 'warn', disabled: !intake },
    ];
  }

  return [];
};

const formatPanelPosition = (anchor: PanelAnchor) => {
  const rightCandidate = anchor.x + PANEL_GAP;
  const leftCandidate = anchor.x - PANEL_WIDTH - PANEL_GAP;
  const placeLeft = rightCandidate + PANEL_WIDTH > anchor.viewportWidth - PANEL_PADDING && leftCandidate >= PANEL_PADDING;
  const left = Math.max(PANEL_PADDING, Math.min(anchor.viewportWidth - PANEL_WIDTH - PANEL_PADDING, placeLeft ? leftCandidate : rightCandidate));
  const top = Math.max(PANEL_PADDING, Math.min(anchor.viewportHeight - PANEL_MAX_HEIGHT - PANEL_PADDING, anchor.y - PANEL_MAX_HEIGHT / 2));
  return { left, top, placeLeft };
};

export const LocalActionPanel = ({
  selectedNode,
  selectedEdge,
  anchor,
  presentationMode,
}: {
  selectedNode?: SoapNode;
  selectedEdge?: SoapEdge;
  anchor?: PanelAnchor;
  presentationMode: PresentationMode;
}) => {
  const executeNodeAction = useAppStore((state) => state.executeNodeAction);
  const executeEdgeAction = useAppStore((state) => state.executeEdgeAction);
  const selectNode = useAppStore((state) => state.selectNode);
  const setInspectorTab = useAppStore((state) => state.setInspectorTab);
  const project = useAppStore((state) => state.project);

  const panelPosition = useMemo(() => (anchor ? formatPanelPosition(anchor) : undefined), [anchor]);

  if (!anchor || (!selectedNode && !selectedEdge) || !panelPosition) return null;

  if (selectedNode) {
    const actions = buildNodeActions(selectedNode);
    if (!actions.length) return null;
    const simulationFlow = Number(selectedNode.data.simulation.flowLpm ?? selectedNode.data.runtime.flowLpm ?? 0);
    const process = selectedNode.data.process as any;
    const processState = String(process.processState ?? selectedNode.data.status);

    return (
      <aside className={`local-action-panel ${panelPosition.placeLeft ? 'is-flipped' : ''}`} style={{ left: panelPosition.left, top: panelPosition.top }}>
        <header className="local-action-panel__head">
          <strong>{selectedNode.data.shortName || selectedNode.data.visibleName}</strong>
          <span>{selectedNode.data.visibleName}</span>
        </header>
        <div className="local-action-panel__status-row">
          <span className={`local-status tone-${toneByStatus(selectedNode.data.status)}`}>{ruStatus[selectedNode.data.status] ?? selectedNode.data.status}</span>
          <span className={`local-status tone-${toneByStatus(processState)}`}>{processState === selectedNode.data.status ? 'Режим штатный' : `Режим: ${processState}`}</span>
          {presentationMode === 'simulation' ? <span className="local-status">Поток {simulationFlow > 0.01 ? 'есть' : 'нет'}</span> : null}
        </div>
        <div className="local-action-grid">
          {actions.map((item) => (
            <button
              key={item.action}
              type="button"
              className={`local-action-btn ${item.active ? 'is-active' : ''} ${item.tone === 'warn' ? 'is-warning' : ''} ${item.tone === 'danger' ? 'is-danger' : ''}`}
              disabled={item.disabled}
              title={item.disabled ? item.reason : undefined}
              onClick={() => executeNodeAction(selectedNode.id, item.action)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </aside>
    );
  }

  if (!selectedEdge) return null;
  const source = project.nodes.find((node) => node.id === selectedEdge.source);
  const target = project.nodes.find((node) => node.id === selectedEdge.target);
  const routeLabel = `${source?.data.shortName ?? source?.data.visibleName ?? 'Источник'} → ${target?.data.shortName ?? target?.data.visibleName ?? 'Приёмник'}`;
  const flow = Number(selectedEdge.data?.flowLpm ?? selectedEdge.data?.flowRate ?? 0);
  const hasBlockedReason = Boolean(selectedEdge.data?.blockedBy?.length);

  const lineActions: ActionItem[] = [
    { label: 'К источнику', action: 'go:source', disabled: !source, reason: 'Источник не найден.' },
    { label: 'К приёмнику', action: 'go:target', disabled: !target, reason: 'Приёмник не найден.' },
    { label: 'В инспектор', action: 'open:inspector' },
    { label: 'Удалить сегмент', action: 'delete', tone: 'danger' },
  ];

  return (
    <aside className={`local-action-panel ${panelPosition.placeLeft ? 'is-flipped' : ''}`} style={{ left: panelPosition.left, top: panelPosition.top }}>
      <header className="local-action-panel__head">
        <strong>Линия</strong>
        <span>{routeLabel}</span>
      </header>
      <div className="local-action-panel__status-row">
        <span className={`local-status tone-${toneByStatus(selectedEdge.data?.routeState ?? 'idle')}`}>{ruRouteState[selectedEdge.data?.routeState ?? 'idle'] ?? selectedEdge.data?.routeState ?? 'Ожидание'}</span>
        <span className="local-status">{flow > 0.01 ? 'Поток есть' : 'Нет потока'}</span>
        {hasBlockedReason ? <span className="local-status tone-warn">Блокировка</span> : null}
      </div>
      {hasBlockedReason ? <div className="local-action-panel__hint">Причина: {selectedEdge.data?.blockedBy?.join(', ')}.</div> : null}
      <div className="local-action-grid">
        {lineActions.map((item) => (
          <button
            key={item.action}
            type="button"
            className={`local-action-btn ${item.active ? 'is-active' : ''} ${item.tone === 'warn' ? 'is-warning' : ''} ${item.tone === 'danger' ? 'is-danger' : ''}`}
            disabled={item.disabled}
            title={item.disabled ? item.reason : undefined}
            onClick={() => {
              if (item.action === 'go:source' && source) selectNode(source.id);
              else if (item.action === 'go:target' && target) selectNode(target.id);
              else if (item.action === 'open:inspector') setInspectorTab('main');
              else if (item.action === 'delete') executeEdgeAction('delete', selectedEdge.id);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </aside>
  );
};

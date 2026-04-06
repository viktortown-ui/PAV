import { useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { BottomTab } from './selectionController';
import { getEquipmentCapability } from './equipmentCapabilityRegistry';

const tabs: Array<{ id: BottomTab; label: string }> = [
  { id: 'overview', label: 'Обзор' },
  { id: 'control', label: 'Управление' },
  { id: 'parameters', label: 'Параметры' },
  { id: 'mediumPhysics', label: 'Среда и физика' },
  { id: 'diagnostics', label: 'Диагностика' },
  { id: 'connections', label: 'Связи' },
  { id: 'history', label: 'История' },
];

const statusLabel = (status?: string) => ({
  running: 'Работает',
  blocked: 'Блокировка',
  alarm: 'Авария',
  maintenance: 'Обслуживание',
  standby: 'Готовность',
  idle: 'Ожидание',
  off: 'Остановлено',
}[status ?? 'idle'] ?? 'Ожидание');

const modeLabel = (mode?: string) => String(mode ?? 'auto').toLowerCase() === 'manual' ? 'Ручной' : 'Автоматический';
const flowStateLabel = (state?: string) => ({
  flowing: 'Поток идёт',
  blocked: 'Блокировка',
  starved: 'Нет подпитки',
  draining: 'Слив',
  alarm: 'Авария',
  maintenance: 'Обслуживание',
  cip: 'Промывка',
  offline: 'Нет связи',
  idle: 'Ожидание',
}[state ?? 'idle'] ?? 'Ожидание');

const mediumLabel = (medium?: string) => ({
  water: 'Вода',
  product: 'Продукт',
  cip: 'Промывка (CIP)',
  waste: 'Сток',
  mixed: 'Смешанная',
  none: 'Не задано',
}[medium ?? 'none'] ?? 'Не задано');

const yesNo = (value?: boolean) => value ? 'Да' : 'Нет';
const formatNumber = (value: unknown, unit?: string, digits = 1) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return `${num.toLocaleString('ru-RU', { maximumFractionDigits: digits, minimumFractionDigits: digits > 0 ? 1 : 0 })}${unit ? ` ${unit}` : ''}`;
};

const kv = (label: string, value: string) => ({ label, value });

export const BottomWorkbenchPanel = () => {
  const project = useAppStore((state) => state.project);
  const selectedNodeId = useAppStore((state) => state.selectedNodeId);
  const pathSelection = useAppStore((state) => state.pathSelection);
  const selectNode = useAppStore((state) => state.selectNode);
  const executeNodeAction = useAppStore((state) => state.executeNodeAction);
  const setInspectorTab = useAppStore((state) => state.setInspectorTab);
  const bottomWorkbench = useAppStore((state) => state.bottomWorkbench);
  const setBottomWorkbenchDock = useAppStore((state) => state.setBottomWorkbenchDock);
  const setBottomWorkbenchTab = useAppStore((state) => state.setBottomWorkbenchTab);
  const closeBottomWorkbench = useAppStore((state) => state.closeBottomWorkbench);

  const node = project.nodes.find((item) => item.id === selectedNodeId);
  const capability = node ? getEquipmentCapability(node.data.kind) : undefined;

  const history = useMemo(
    () => project.eventLog
      .filter((event) => !node || event.targetId === node.id || event.message.toLowerCase().includes(node.data.technicalTag.toLowerCase()))
      .slice(-12)
      .reverse(),
    [node, project.eventLog],
  );

  if (!node || bottomWorkbench.dock === 'hidden') return null;

  const process = node.data.process as Record<string, string | number | boolean | undefined>;
  const processState = String(process.processState ?? 'idle');
  const isValve = node.data.className === 'valve';
  const isPump = node.data.kind === 'pump' || node.data.kind === 'dosingPump';
  const isVessel = ['tank', 'bufferTank', 'reactor', 'heatedReactor'].includes(node.data.kind);
  const isSensor = node.data.className === 'instrument' || node.data.kind === 'flowMeter';

  const keyMetrics = [
    kv('Расход', formatNumber(process.actualFlowLpm ?? process.flowRate ?? node.data.runtime.flowLpm, 'л/мин')),
    kv('Давление', formatNumber(process.pressureBar ?? process.pressure, 'бар')),
    kv('Температура', formatNumber(process.temperatureC ?? process.temperature, '°C')),
    kv('Уровень', formatNumber(process.levelPercent, '%', 0)),
  ].filter((row) => row.value !== '—').slice(0, 4);

  const commonParams = [
    kv('Скорость потока', formatNumber(process.flowVelocityMps ?? process.velocity, 'м/с')),
    kv('Состояние среды', mediumLabel(String(process.mediumType ?? process.medium ?? node.data.mediumType))),
    kv('DN / диаметр', String(process.diameterNominal ?? process.dn ?? '—')),
    kv('Текущий режим работы', modeLabel(String(process.mode ?? node.data.mode))),
    kv('Состояние потока', flowStateLabel(node.data.simulation.routeState)),
  ];

  const equipmentSpecific = isPump
    ? [
      kv('Ток / нагрузка', formatNumber(process.motorLoadPct ?? process.loadPercent, '%', 0)),
      kv('Сухой ход', yesNo(Boolean(process.dryRun))),
      kv('Перегрузка', yesNo(Boolean(process.overload))),
      kv('Ограничение напора', yesNo(Boolean(process.headLimit))),
    ]
    : isVessel
      ? [
        kv('Объём', formatNumber(process.capacityLiters ?? process.capacity, 'л', 0)),
        kv('Разрешён приём', yesNo(Boolean(process.allowIntake ?? process.canReceive ?? true))),
        kv('Разрешена выдача', yesNo(Boolean(process.allowDischarge ?? process.canDischarge ?? true))),
        kv('Переполнение / резерв', String(process.overflowState ?? (Number(process.levelPercent ?? 0) > 95 ? 'Переполнение' : Number(process.levelPercent ?? 0) < 10 ? 'Пусто' : 'Норма'))),
      ]
      : isValve
        ? [
          kv('Положение клапана', String(process.valveState === 'closed' ? 'Закрыт' : 'Открыт')),
          kv('Процент открытия', formatNumber(process.openPercent ?? (process.valveState === 'closed' ? 0 : 100), '%', 0)),
          kv('Положение при отказе', String(process.failPosition === 'open' ? 'Открыт' : process.failPosition === 'hold' ? 'Удержание' : 'Закрыт')),
          kv('Блокировка', yesNo(Boolean(process.isBlocked))),
        ]
        : isSensor
          ? [
            kv('Измеряемый параметр', String(process.measuredProperty ?? process.signalType ?? 'Технологический сигнал')),
            kv('Текущее значение', formatNumber(process.currentValue ?? process.signalValue, String(process.signalUnit ?? process.unit ?? ''))),
            kv('Статус сигнала', String(process.signalStatus ?? 'Норма')),
            kv('Калибровка / ошибка', String(process.calibrationState ?? process.calibration ?? 'Норма')),
          ]
          : [];

  const mediumPhysics = [
    kv('Жидкость / среда', mediumLabel(String(process.mediumType ?? process.medium ?? node.data.mediumType))),
    kv('Технологическая роль', String(process.activityLabel ?? node.data.description ?? 'Технологический узел')),
    kv('Тип линии', String(process.lineType ?? process.pipelineClass ?? 'Технологическая линия')),
    kv('Состояние потока', flowStateLabel(String(node.data.simulation.routeState))),
    kv('Ограничения', String(process.constraints ?? process.limits ?? 'Нет активных ограничений')),
    kv('Причина отсутствия потока', String(process.noFlowReason ?? (node.data.simulation.routeState === 'blocked' ? 'Блокировка линии или узла' : 'Не указана'))),
  ];

  const diagnosticsRows = [
    kv('Ошибки', String(node.data.alarms?.length ?? 0)),
    kv('Предупреждения', String(process.warningCount ?? (node.data.alarms?.length ? node.data.alarms.length : 0))),
    kv('Межблокировки', String(process.interlocks ?? process.interlockState ?? 'Нет')),
    kv('Причина остановки', String(process.stopReason ?? node.data.runtime.alarmText ?? 'Не указана')),
    kv('Тех. замечания', String(process.maintenanceNote ?? process.techNote ?? 'Нет')),
  ];

  const quickActions = [
    capability?.canStartStop ? { label: 'Пуск / Стоп', onClick: () => executeNodeAction(node.id, isPump ? (Boolean(process.pumpOn) ? 'pump:stop' : 'pump:start') : 'reactor:start') } : null,
    capability?.canOpenClose ? { label: 'Открыть / Закрыть', onClick: () => executeNodeAction(node.id, process.valveState === 'closed' ? 'valve:open' : 'valve:close') } : null,
    capability?.supportsAutoManual ? { label: 'Авто / Ручной', onClick: () => executeNodeAction(node.id, String(process.mode ?? node.data.mode).toLowerCase() === 'manual' ? 'valve:auto' : 'valve:manual') } : null,
  ].filter(Boolean) as Array<{ label: string; onClick: () => void }>;

  return (
    <section className={`bottom-workbench dock-${bottomWorkbench.dock}`} aria-label="Нижняя рабочая панель">
      <header className="bottom-workbench__header">
        <div>
          <strong>{node.data.visibleName}</strong>
          <small>{node.data.technicalTag} · {statusLabel(node.data.status)}</small>
        </div>
        <div className="bottom-workbench__actions">
          {bottomWorkbench.dock === 'peek' ? <button type="button" onClick={() => setBottomWorkbenchDock('expanded')}>Развернуть</button> : null}
          {bottomWorkbench.dock === 'expanded' ? <button type="button" onClick={() => setBottomWorkbenchDock('peek')}>Свернуть</button> : null}
          <button type="button" onClick={() => closeBottomWorkbench()}>Закрыть</button>
        </div>
      </header>

      {bottomWorkbench.dock === 'peek' ? (
        <div className="bottom-workbench__peek">
          <div className="workbench-kpi-inline">
            <span>Состояние: <b>{statusLabel(node.data.status)}</b></span>
            {keyMetrics.slice(0, 2).map((row) => <span key={row.label}>{row.label}: <b>{row.value}</b></span>)}
          </div>
          <div className="workbench-actions">
            {quickActions.slice(0, 3).map((action) => <button key={action.label} type="button" onClick={action.onClick}>{action.label}</button>)}
          </div>
        </div>
      ) : (
        <>
          <div className="bottom-workbench__tabs" role="tablist" aria-label="Вкладки рабочей панели">
            {tabs.map((tab) => (
              <button key={tab.id} type="button" className={tab.id === bottomWorkbench.activeTab ? 'is-active' : ''} onClick={() => setBottomWorkbenchTab(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="bottom-workbench__grid">
            {bottomWorkbench.activeTab === 'overview' ? (
              <>
                <article className="workbench-card"><h4>Сводка</h4><p>{node.data.description}</p><div className="workbench-list">{keyMetrics.map((row) => <div key={row.label} className="workbench-kv"><span>{row.label}</span><b>{row.value}</b></div>)}</div></article>
                <article className="workbench-card"><h4>Режим и ограничения</h4><div className="workbench-list">{commonParams.slice(2).map((row) => <div key={row.label} className="workbench-kv"><span>{row.label}</span><b>{row.value}</b></div>)}</div></article>
              </>
            ) : null}
            {bottomWorkbench.activeTab === 'control' ? (
              <>
                <article className="workbench-card"><h4>Управление</h4><div className="workbench-actions">{quickActions.map((action) => <button key={action.label} type="button" onClick={action.onClick}>{action.label}</button>)}<button type="button" onClick={() => setInspectorTab('actions')}>Сервисные команды</button><button type="button" onClick={() => setInspectorTab('alarms')}>Разрешения / блокировки</button></div></article>
                <article className="workbench-card"><h4>Уставки</h4><div className="workbench-list"><div className="workbench-kv"><span>Уставка расхода</span><b>{formatNumber(process.flowSetpointLpm ?? process.flowRate, 'л/мин')}</b></div><div className="workbench-kv"><span>Уставка давления</span><b>{formatNumber(process.pressureSetpointBar ?? process.pressure, 'бар')}</b></div><div className="workbench-kv"><span>Уставка температуры</span><b>{formatNumber(process.temperatureSetpointC ?? process.temperature, '°C')}</b></div></div></article>
              </>
            ) : null}
            {bottomWorkbench.activeTab === 'parameters' ? <article className="workbench-card"><h4>Технологические параметры</h4><div className="workbench-list">{[...keyMetrics, ...commonParams, ...equipmentSpecific].map((row) => <div key={row.label} className="workbench-kv"><span>{row.label}</span><b>{row.value}</b></div>)}</div></article> : null}
            {bottomWorkbench.activeTab === 'mediumPhysics' ? <article className="workbench-card"><h4>Среда и физика</h4><div className="workbench-list">{mediumPhysics.map((row) => <div key={row.label} className="workbench-kv"><span>{row.label}</span><b>{row.value}</b></div>)}</div></article> : null}
            {bottomWorkbench.activeTab === 'diagnostics' ? <article className="workbench-card"><h4>Диагностика</h4><div className="workbench-list">{diagnosticsRows.map((row) => <div key={row.label} className="workbench-kv"><span>{row.label}</span><b>{row.value}</b></div>)}</div><ul>{(capability?.diagnostics ?? []).map((item) => <li key={item}>{item === 'dry-run' ? 'Сухой ход' : item === 'head-limit' ? 'Ограничение напора' : item === 'interlock' ? 'Межблокировка' : item === 'fail-state' ? 'Положение при отказе' : item === 'communication' ? 'Связь с датчиком' : item === 'calibration' ? 'Калибровка' : item === 'signal' ? 'Качество сигнала' : item}</li>)}</ul></article> : null}
            {bottomWorkbench.activeTab === 'connections' ? <article className="workbench-card"><h4>Связи</h4><div className="workbench-kv"><span>Источники (вход)</span><b>{pathSelection.upstream.length}</b></div><div className="workbench-kv"><span>Приёмники (выход)</span><b>{pathSelection.downstream.length}</b></div><div className="workbench-kv"><span>Причина остановки потока</span><b>{String(process.stopReason ?? process.noFlowReason ?? (processState === 'blocked' ? 'Линия заблокирована' : 'Нет'))}</b></div><button type="button" onClick={() => pathSelection.upstream[0] && selectNode(pathSelection.upstream[0])}>Перейти к источнику</button><button type="button" onClick={() => pathSelection.downstream[0] && selectNode(pathSelection.downstream[0])}>Перейти к приёмнику</button></article> : null}
            {bottomWorkbench.activeTab === 'history' ? <article className="workbench-card"><h4>История событий</h4><div className="workbench-history">{history.map((event) => <div key={event.id}><span>{new Date(event.timestamp).toLocaleTimeString('ru-RU')}</span><small>{event.message}</small></div>)}</div></article> : null}
          </div>
        </>
      )}
    </section>
  );
};

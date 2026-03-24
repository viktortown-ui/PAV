import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MiniMap, useReactFlow } from 'reactflow';
import { useAppStore } from '../../store/useAppStore';
import {
  DiagnosticsPanelState,
  coerceDiagnosticsPanelState,
  diagnosticsPanelLastOpenStateStorageKey,
  diagnosticsPanelStateMachineDefinition,
  diagnosticsPanelStateStorageKey,
  getDiagnosticsPanelStepLabel,
  getDiagnosticsPanelViewportClassName,
  getLastOpenDiagnosticsPanelState,
  transitionDiagnosticsPanelState,
} from './panelMode';

type SimulationPanelProps = {
  focusMode?: boolean;
};

const speedOptions = [0.5, 1, 1.5, 2, 3];

const mediumLabel: Record<string, string> = {
  none: 'нет',
  mixed: 'смешанная',
  water: 'вода',
  product: 'продукт',
  cip: 'CIP',
  waste: 'сток',
};

const formatEventTime = (timestamp: string | number) => new Date(timestamp).toLocaleTimeString('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: 'UTC',
});

export const SimulationPanel = ({ focusMode = false }: SimulationPanelProps) => {
  const flow = useReactFlow();
  const project = useAppStore((state) => state.project);
  const dockRef = useRef<HTMLElement>(null);
  const selectedNodeId = useAppStore((state) => state.selectedNodeId);
  const selectedEdgeId = useAppStore((state) => state.selectedEdgeId);
  const setSimulationRunning = useAppStore((state) => state.setSimulationRunning);
  const setSimulationSpeed = useAppStore((state) => state.setSimulationSpeed);
  const edgeLabelMode = useAppStore((state) => state.edgeLabelMode);
  const setEdgeLabelMode = useAppStore((state) => state.setEdgeLabelMode);
  const resetSimulation = useAppStore((state) => state.resetSimulation);
  const toggleProblematicOnly = useAppStore((state) => state.toggleProblematicOnly);
  const issues = useAppStore((state) => state.issues);
  const showProblematicOnly = useAppStore((state) => state.showProblematicOnly);
  const [panelState, setPanelState] = useState<DiagnosticsPanelState>(() => {
    if (typeof window === 'undefined') return 'miniDock';
    return coerceDiagnosticsPanelState(window.sessionStorage.getItem(diagnosticsPanelStateStorageKey), 'miniDock');
  });
  const [lastOpenPanelState, setLastOpenPanelState] = useState<Exclude<DiagnosticsPanelState, 'hidden'>>(() => {
    if (typeof window === 'undefined') return 'miniDock';
    return getLastOpenDiagnosticsPanelState(window.sessionStorage.getItem(diagnosticsPanelLastOpenStateStorageKey));
  });
  const [isNavigatorVisible, setIsNavigatorVisible] = useState(true);

  useEffect(() => {
    console.info(diagnosticsPanelStateMachineDefinition);
  }, []);

  useEffect(() => {
    window.sessionStorage.setItem(diagnosticsPanelStateStorageKey, panelState);
    if (panelState !== 'hidden') {
      window.sessionStorage.setItem(diagnosticsPanelLastOpenStateStorageKey, panelState);
      setLastOpenPanelState(panelState);
    }
  }, [panelState]);

  useEffect(() => {
    const handleHotkey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (event.key.toLowerCase() !== 'd' || !(event.altKey || event.metaKey)) return;
      event.preventDefault();
      setPanelState((currentState) => {
        if (currentState === 'hidden') return transitionDiagnosticsPanelState(currentState, 'launcher');
        if (currentState === 'miniDock' || currentState === 'compact') return transitionDiagnosticsPanelState(currentState, 'step-expand');
        return transitionDiagnosticsPanelState(currentState, 'step-collapse');
      });
    };

    window.addEventListener('keydown', handleHotkey);
    return () => window.removeEventListener('keydown', handleHotkey);
  }, []);

  const selectedNode = project.nodes.find((node) => node.id === selectedNodeId);
  const selectedEdge = project.edges.find((edge) => edge.id === selectedEdgeId);
  const warningCount = issues.filter((issue) => issue.severity !== 'info').length;
  const activeWarnings = useMemo(() => project.simulation.warnings.slice(0, 4), [project.simulation.warnings]);
  const recentEvents = useMemo(() => project.eventLog.slice(-8).reverse(), [project.eventLog]);
  const latestEvent = recentEvents[0];
  const selectionLabel = selectedNode
    ? `${selectedNode.data.visibleName} • ${selectedNode.data.technicalTag}`
    : selectedEdge
      ? `${selectedEdge.data?.sourceLabel} → ${selectedEdge.data?.targetLabel}`
      : 'ничего не выбрано';
  const filterLabel = showProblematicOnly ? 'Только проблемные' : 'Все';
  const simulationStatus = project.simulation.status ?? (project.simulation.running ? 'running' : 'idle');
  const modeSummary = simulationStatus === 'running'
    ? 'Симуляция выполняется'
    : simulationStatus === 'paused'
      ? 'Симуляция на паузе'
      : 'Базовое состояние';
  const modeChipLabel = simulationStatus === 'running' ? 'RUN' : simulationStatus === 'paused' ? 'PAUSE' : 'IDLE';
  const modeChipReadableLabel = simulationStatus === 'running' ? 'В работе' : simulationStatus === 'paused' ? 'Пауза' : 'Ожидание';

  const panelClassName = getDiagnosticsPanelViewportClassName(panelState);
  const canClose = panelState === 'compact' || panelState === 'expanded';
  const canExpand = panelState === 'miniDock' || panelState === 'compact';
  const canCollapse = panelState === 'expanded';
  const isMiniDock = panelState === 'miniDock';
  const isCompact = panelState === 'compact';
  const isExpanded = panelState === 'expanded';
  const isRunning = simulationStatus === 'running';
  const isPaused = simulationStatus === 'paused';

  const handleFitToView = useCallback(async () => {
    await flow.fitView({ padding: 0.2, duration: 220 });
  }, [flow]);

  const handleReturnToDiagram = useCallback(async () => {
    await flow.fitView({ padding: 0.17, duration: 180 });
  }, [flow]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dockNode = dockRef.current;
    if (!dockNode) return;
    const syncDockHeight = () => {
      const rect = dockNode.getBoundingClientRect();
      const isHidden = panelState === 'hidden';
      document.documentElement.style.setProperty('--simulation-dock-height', `${Math.ceil(rect.height)}px`);
      document.documentElement.style.setProperty('--simulation-dock-visible-height', isHidden ? '0px' : `${Math.ceil(rect.height)}px`);
    };
    syncDockHeight();
    const observer = new ResizeObserver(syncDockHeight);
    observer.observe(dockNode);
    return () => {
      observer.disconnect();
    };
  }, [panelState]);

  return (
    <section ref={dockRef} className={`simulation-dock sim-${simulationStatus} ${panelClassName} ${focusMode ? 'is-focus-mode' : ''}`} data-panel-mode={panelState} aria-label="Нижняя панель симуляции и диагностики">
      <div className="simulation-dock-launcher" aria-hidden={panelState !== 'hidden'}>
        <button
          type="button"
          className="simulation-launcher-button"
          onClick={() => setPanelState(transitionDiagnosticsPanelState('hidden', 'launcher'))}
          aria-expanded={panelState !== 'hidden'}
          aria-label={`Открыть нижнюю панель: ${getDiagnosticsPanelStepLabel(lastOpenPanelState)}`}
        >
          <span className="launcher-title">Диагностика</span>
          <span className="launcher-meta">{warningCount} предупрежд. • {Math.round(project.simulation.totalActiveFlow)} л/мин</span>
        </button>
      </div>

      <div className="simulation-dock-panel">
        {isExpanded ? <div className="simulation-dock-grab" aria-hidden="true" /> : null}

        {isExpanded ? (
          <div className="simulation-dock-toolbar" role="toolbar" aria-label="Состояние нижней панели">
            <div className="simulation-dock-titleblock">
              <span className="simulation-dock-kicker">Диагностика</span>
              <strong>Управление потоком</strong>
              <small>{modeSummary}</small>
            </div>
            <div className="simulation-dock-toolbar-actions">
              <span className={`simulation-status-chip is-${simulationStatus}`}>{modeChipLabel}</span>
              <span className="simulation-dock-state-label">{getDiagnosticsPanelStepLabel(panelState)}</span>
              <button type="button" className="simulation-dock-close" onClick={() => setPanelState((currentState) => transitionDiagnosticsPanelState(currentState, 'close'))}>Скрыть</button>
            </div>
          </div>
        ) : null}

        <div className="simulation-dock-row simulation-dock-row-primary">
          <div className="dock-zone dock-zone-controls" aria-label="Управление симуляцией">
            <span className="dock-zone-label">Управление</span>
            <div className="dock-controls-cluster">
              <button type="button" className="is-primary" onClick={() => setSimulationRunning(true)} disabled={isRunning} title={isPaused ? 'Продолжить симуляцию' : 'Запустить симуляцию'}>
                {isPaused ? '▶ Продолжить' : '▶ Пуск'}
              </button>
              <button type="button" onClick={() => setSimulationRunning(false)} disabled={!isRunning} title={isRunning ? 'Поставить симуляцию на паузу' : 'Пауза доступна только при запущенной симуляции'}>❚❚ Пауза</button>
              <button
                type="button"
                onClick={resetSimulation}
                title="Сбросить поток, предупреждения, анимацию линий и статусы узлов к исходному состоянию"
              >
                ↺ Сброс
              </button>
            </div>
            <div className="dock-speed-field" aria-label="Управление скоростью симуляции">
              <span className="dock-field-label">Скорость</span>
              <div className="dock-speed-options">
                {speedOptions.map((speed) => (
                  <button
                    type="button"
                    key={speed}
                    className={project.simulation.speed === speed ? 'is-selected' : ''}
                    onClick={() => setSimulationSpeed(speed)}
                  >
                    {speed.toFixed(speed % 1 === 0 ? 0 : 1)}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="dock-zone dock-zone-status" aria-label="Живой статус симуляции">
            <span className="dock-zone-label">Сводка</span>
            <div className="dock-status-strip">
              <div className="dock-status-item">
                <span className="metric-label">Поток</span>
                <strong>{Math.round(project.simulation.totalActiveFlow)} л/мин</strong>
              </div>
              <div className="dock-status-item warning-state">
                <span className="metric-label">Сигналы</span>
                <strong>{warningCount}</strong>
              </div>
              <div className={`dock-status-item dock-status-state is-${simulationStatus}`}>
                <span className="metric-label">Режим</span>
                <strong>{modeChipReadableLabel}</strong>
              </div>
              {!isMiniDock ? (
                <>
                  <div className="dock-status-item dock-status-item-wide">
                    <span className="metric-label">Выбор</span>
                    <strong>{selectionLabel}</strong>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <div className="dock-zone dock-zone-expand">
            <span className="dock-zone-label">Навигатор / Панель</span>
            <div className="dock-navigator-card" aria-label="Навигатор схемы">
              <div className="dock-navigator-head">
                <div className="dock-navigator-titleblock">
                  <strong>Навигатор</strong>
                  <span>Обзор схемы и быстрый переход</span>
                </div>
                <button
                  type="button"
                  className="dock-navigator-toggle"
                  title={isNavigatorVisible ? 'Скрыть навигатор' : 'Показать навигатор'}
                  aria-label={isNavigatorVisible ? 'Скрыть навигатор' : 'Показать навигатор'}
                  onClick={() => setIsNavigatorVisible((current) => !current)}
                >
                  {isNavigatorVisible ? 'Свернуть' : 'Развернуть'}
                </button>
              </div>
              {isNavigatorVisible ? (
                <>
                  <div className="dock-navigator-actions" role="group" aria-label="Быстрые действия навигатора">
                    <button type="button" className="dock-navigator-action" title="Вернуться к текущей схеме" aria-label="Вернуться к текущей схеме" onClick={() => void handleReturnToDiagram()}>К схеме</button>
                    <button type="button" className="dock-navigator-action dock-navigator-action--secondary" title="Вписать всю схему" aria-label="Вписать всю схему" onClick={() => void handleFitToView()}>Вписать</button>
                    <button type="button" className="dock-navigator-action dock-navigator-action--ghost" title={edgeLabelMode === 'hidden' ? 'Показать подписи линий' : 'Скрыть подписи линий'} onClick={() => setEdgeLabelMode(edgeLabelMode === 'hidden' ? 'selected' : 'hidden')}>{edgeLabelMode === 'hidden' ? 'Показать подписи' : 'Скрыть подписи'}</button>
                  </div>
                  <div className="dock-navigator-viewport" aria-label="Миникарта схемы">
                    <MiniMap
                      pannable
                      zoomable
                      className="dock-navigator-map"
                      maskColor="rgba(5,10,16,0.74)"
                      style={{ backgroundColor: 'transparent' }}
                      nodeColor="#7fb3ff"
                      nodeStrokeColor="#d9e8ff"
                    />
                  </div>
                </>
              ) : (
                <div className="dock-navigator-collapsed">Навигатор свернут. Разверните его для обзора схемы.</div>
              )}
            </div>
            <div className="dock-expand-actions">
              <button
                type="button"
                className="dock-expand-button"
                onClick={() => setPanelState((currentState) => {
                  if (currentState === 'miniDock' || currentState === 'compact') return transitionDiagnosticsPanelState(currentState, 'step-expand');
                  if (currentState === 'expanded') return transitionDiagnosticsPanelState(currentState, 'step-collapse');
                  return currentState;
                })}
                aria-expanded={panelState === 'expanded'}
                disabled={!canExpand && !canCollapse}
              >
                <span>{panelState === 'expanded' ? 'Свернуть до компактного вида' : panelState === 'compact' ? 'Развернуть до полного вида' : 'Открыть компактный вид'}</span>
                <strong>{panelState === 'expanded' ? '▾' : '▴'}</strong>
              </button>
              {canClose ? (
                <button type="button" className="simulation-dock-close simulation-dock-close-inline" onClick={() => setPanelState((currentState) => transitionDiagnosticsPanelState(currentState, 'close'))}>Скрыть</button>
              ) : null}
            </div>
          </div>
        </div>

        {(isCompact || isExpanded) ? (
          <div className="simulation-dock-row simulation-dock-row-summary">
            <div className="dock-zone dock-zone-summary" aria-label="Сводка панели">
              <span className="dock-zone-label">Контекст</span>
              <div className="dock-summary-grid">
                <div>
                  <span className="metric-label">Среда</span>
                  <strong>{mediumLabel[project.simulation.activeMedium]}</strong>
                </div>
                <div>
                  <span className="metric-label">Фильтр</span>
                  <strong>{filterLabel}</strong>
                </div>
                <div className="is-wide">
                  <span className="metric-label">Выбор</span>
                  <strong>{selectionLabel}</strong>
                </div>
                <div className="is-wide">
                  <span className="metric-label">Режим</span>
                  <strong>{modeSummary}</strong>
                </div>
              </div>
            </div>
            <div className="dock-zone dock-zone-filters" aria-label="Фильтры и режимы">
              <span className="dock-zone-label">Фильтры</span>
              <div className="dock-filter-chips">
                <button type="button" className={!showProblematicOnly ? 'is-active' : ''} onClick={() => showProblematicOnly && toggleProblematicOnly()}>Все</button>
                <button type="button" className={showProblematicOnly ? 'is-active' : ''} onClick={() => !showProblematicOnly && toggleProblematicOnly()}>Только проблемные</button>
                <button type="button" className={(selectedNode || selectedEdge) ? 'is-active' : ''} disabled>Выбранное</button>
              </div>
            </div>
            <div className="dock-zone dock-zone-alert" aria-label="Текущее предупреждение">
              <span className="dock-zone-label">Активное предупреждение</span>
              <div className="dock-alert-card">
                <strong>{activeWarnings[0] ?? 'Нет активных предупреждений'}</strong>
                <span>Скорость: {project.simulation.speed.toFixed(project.simulation.speed % 1 === 0 ? 0 : 1)}x</span>
              </div>
            </div>
          </div>
        ) : null}

        {isExpanded ? (
          <div className="simulation-dock-sheet">
            <div className="simulation-sheet-main">
              <div className="sheet-section sheet-section-overview">
                <div className="sheet-section-head">
                  <div>
                    <span className="dock-zone-label">Консоль</span>
                    <strong>Диагностическая сводка</strong>
                  </div>
                  <button type="button" className="sheet-focus-button" onClick={toggleProblematicOnly}>
                    {showProblematicOnly ? 'Показать всю схему' : 'Фокус на проблемах'}
                  </button>
                </div>
                <div className="sheet-overview-grid">
                  <div>
                    <span className="metric-label">Режим</span>
                    <strong>{modeSummary}</strong>
                  </div>
                  <div>
                    <span className="metric-label">Среда</span>
                    <strong>{mediumLabel[project.simulation.activeMedium]}</strong>
                  </div>
                  <div className="is-wide">
                    <span className="metric-label">Выбор</span>
                    <strong>{selectionLabel}</strong>
                  </div>
                  <div className="is-wide">
                    <span className="metric-label">Предупреждения</span>
                    <strong>{activeWarnings.join(' • ') || 'Нет активных предупреждений'}</strong>
                  </div>
                </div>
              </div>

              <div className="sheet-section sheet-section-log">
                <div className="sheet-section-head">
                  <div>
                    <strong>Журнал событий</strong>
                    <span>Последние записи технологического контура</span>
                  </div>
                  <span className="sheet-section-meta">Буфер: {project.eventLog.length}</span>
                </div>
                <div className="sheet-journal-list">
                  {recentEvents.map((event) => (
                    <article key={event.id} className={`sheet-journal-item severity-${event.severity}`}>
                      <span className="sheet-journal-time">{formatEventTime(event.timestamp)}</span>
                      <strong className="sheet-journal-message">{event.message}</strong>
                      <small className="sheet-journal-type">{event.type}</small>
                    </article>
                  ))}
                </div>
              </div>
            </div>

            <aside className="simulation-sheet-side">
              <div className="sheet-section">
                <div className="sheet-section-head">
                  <div>
                    <strong>Предупреждения</strong>
                    <span>Приоритетные сигналы и отклонения</span>
                  </div>
                </div>
                <div className="sheet-warning-list">
                  {activeWarnings.length
                    ? activeWarnings.map((warning) => <div key={warning} className="sheet-warning-item">{warning}</div>)
                    : <div className="sheet-warning-item is-idle">Активных предупреждений нет</div>}
                </div>
              </div>

              <div className="sheet-section">
                <div className="sheet-section-head">
                  <div>
                    <strong>Последнее событие</strong>
                    <span>{latestEvent ? formatEventTime(latestEvent.timestamp) : 'Нет записей'}</span>
                  </div>
                </div>
                <div className="sheet-last-event">
                  <span className="metric-label">Состояние</span>
                  <strong>{latestEvent?.message ?? project.simulation.lastEvent}</strong>
                  <span>{latestEvent?.type ?? 'система'}</span>
                </div>
              </div>
            </aside>
          </div>
        ) : null}
      </div>
    </section>
  );
};

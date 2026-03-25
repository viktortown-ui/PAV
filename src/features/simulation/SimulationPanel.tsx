import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MiniMap, useReactFlow } from 'reactflow';
import { useAppStore } from '../../store/useAppStore';
import { FLUID_PRESETS } from '../../domain/physics/fluids';
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
  rightPanelVisible?: boolean;
  activeRightTab?: string | null;
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

export const SimulationPanel = ({ focusMode = false, rightPanelVisible = false, activeRightTab = null }: SimulationPanelProps) => {
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
  const setSimulationFluid = useAppStore((state) => state.setSimulationFluid);
  const runFluidScenario = useAppStore((state) => state.runFluidScenario);
  const toggleProblematicOnly = useAppStore((state) => state.toggleProblematicOnly);
  const issues = useAppStore((state) => state.issues);
  const showProblematicOnly = useAppStore((state) => state.showProblematicOnly);
  const [panelState, setPanelState] = useState<DiagnosticsPanelState>(() => {
    if (typeof window === 'undefined') return 'compact';
    return coerceDiagnosticsPanelState(window.sessionStorage.getItem(diagnosticsPanelStateStorageKey), 'compact');
  });
  const [lastOpenPanelState, setLastOpenPanelState] = useState<Exclude<DiagnosticsPanelState, 'hidden'>>(() => {
    if (typeof window === 'undefined') return 'compact';
    return getLastOpenDiagnosticsPanelState(window.sessionStorage.getItem(diagnosticsPanelLastOpenStateStorageKey));
  });
  const [isNavigatorVisible, setIsNavigatorVisible] = useState(true);

  useEffect(() => {
    console.info(diagnosticsPanelStateMachineDefinition);
  }, []);

  useEffect(() => {
    if (!rightPanelVisible) {
      setPanelState((currentState) => (currentState === 'full' ? 'standard' : currentState));
    }
  }, [rightPanelVisible]);

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
        if (currentState === 'compact' || currentState === 'standard') return transitionDiagnosticsPanelState(currentState, 'step-expand');
        return transitionDiagnosticsPanelState(currentState, 'step-collapse');
      });
    };

    window.addEventListener('keydown', handleHotkey);
    return () => window.removeEventListener('keydown', handleHotkey);
  }, []);

  const selectedNode = project.nodes.find((node) => node.id === selectedNodeId);
  const selectedEdge = project.edges.find((edge) => edge.id === selectedEdgeId);
  const warningCount = issues.filter((issue) => issue.severity !== 'info').length;
  const activeWarnings = useMemo(() => project.simulation.warnings.slice(0, 6), [project.simulation.warnings]);
  const recentEvents = useMemo(() => project.eventLog.slice(-10).reverse(), [project.eventLog]);
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
  const modeChipLabel = simulationStatus === 'running' ? 'РАБОТА' : simulationStatus === 'paused' ? 'ПАУЗА' : 'ОЖИДАНИЕ';
  const modeChipReadableLabel = simulationStatus === 'running' ? 'В работе' : simulationStatus === 'paused' ? 'Пауза' : 'Ожидание';

  const panelClassName = getDiagnosticsPanelViewportClassName(panelState);
  const isCompact = panelState === 'compact';
  const isStandard = panelState === 'standard';
  const isFull = panelState === 'full';
  const isRunning = simulationStatus === 'running';
  const isPaused = simulationStatus === 'paused';
  const currentFluid = project.simulation.fluid ?? { id: 'water', kind: 'water', name: 'Вода', densityKgPerM3: 998, dynamicViscosityPaS: 0.001002 };

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
    const rootStyle = document.documentElement.style;
    if (panelState === 'hidden') {
      rootStyle.setProperty('--simulation-dock-height', '0px');
      rootStyle.setProperty('--simulation-dock-visible-height', '0px');
    }
    const syncDockHeight = () => {
      const rect = dockNode.getBoundingClientRect();
      const isHidden = panelState === 'hidden';
      const resolvedHeight = isHidden ? 0 : Math.ceil(rect.height);
      rootStyle.setProperty('--simulation-dock-height', `${resolvedHeight}px`);
      rootStyle.setProperty('--simulation-dock-visible-height', `${resolvedHeight}px`);
    };
    const rafId = window.requestAnimationFrame(syncDockHeight);
    const observer = new ResizeObserver(syncDockHeight);
    observer.observe(dockNode);
    return () => {
      window.cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [activeRightTab, panelState, rightPanelVisible]);

  const renderControlZone = () => (
    <section className="dock-zone dock-zone-control" aria-label="Управление симуляцией">
      <header className="dock-zone-head">
        <span className="dock-zone-label">Управление</span>
      </header>
      <div className="dock-controls-row">
        <button type="button" className="is-primary" onClick={() => setSimulationRunning(true)} disabled={isRunning}>
          {isPaused ? '▶ Продолжить' : '▶ Пуск'}
        </button>
        <button type="button" onClick={() => setSimulationRunning(false)} disabled={!isRunning}>❚❚ Пауза</button>
        <button type="button" onClick={resetSimulation}>↺ Сброс</button>
      </div>
      <div className="dock-fluid-block" aria-label="Параметры жидкости">
        <span className="dock-field-label">Жидкость</span>
        <select
          value={currentFluid.id}
          onChange={(event) => {
            const preset = FLUID_PRESETS.find((item) => item.id === event.target.value);
            if (!preset) return;
            setSimulationFluid({
              id: preset.id,
              kind: preset.id === 'water' ? 'water' : preset.id === 'ethylene-glycol' ? 'glycol' : 'custom',
              name: preset.name,
              densityKgPerM3: preset.density_kg_m3,
              dynamicViscosityPaS: preset.dynamicViscosity_Pa_s,
            });
          }}
        >
          {FLUID_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
        </select>
        <label className="dock-field-label">Плотность, кг/м³
          <input type="number" value={Number(project.simulation.fluid?.densityKgPerM3 ?? 998)} onChange={(event) => setSimulationFluid({ ...currentFluid, densityKgPerM3: Number(event.target.value) })} />
        </label>
        <label className="dock-field-label">Вязкость, Па·с
          <input type="number" step={0.0001} value={Number(project.simulation.fluid?.dynamicViscosityPaS ?? 0.001)} onChange={(event) => setSimulationFluid({ ...currentFluid, dynamicViscosityPaS: Number(event.target.value) })} />
        </label>
        <button type="button" onClick={runFluidScenario}>Запустить сценарий</button>
      </div>
      <div className="dock-speed-block" aria-label="Скорость симуляции">
        <span className="dock-field-label">Скорость</span>
        <div className="dock-speed-options">
          {speedOptions.map((speed) => (
            <button
              type="button"
              key={speed}
              className={project.simulation.speed === speed ? 'is-selected' : ''}
              onClick={() => setSimulationSpeed(speed)}
            >
              {speed.toFixed(speed % 1 === 0 ? 0 : 1)}×
            </button>
          ))}
        </div>
      </div>
    </section>
  );

  const renderSummaryZone = (withSelection: boolean) => (
    <section className="dock-zone dock-zone-summary" aria-label="Сводка">
      <header className="dock-zone-head">
        <span className="dock-zone-label">Сводка</span>
        <span className={`simulation-status-chip is-${simulationStatus}`}>{modeChipLabel}</span>
      </header>
      <div className="dock-summary-grid">
        <div className="dock-summary-item">
          <span className="metric-label">Поток</span>
          <strong>{Math.round(project.simulation.totalActiveFlow)} л/мин</strong>
        </div>
        <div className="dock-summary-item warning-state">
          <span className="metric-label">Сигналы</span>
          <strong>{warningCount}</strong>
        </div>
        <div className="dock-summary-item">
          <span className="metric-label">Режим</span>
          <strong>{modeChipReadableLabel}</strong>
        </div>
        {withSelection ? (
          <div className="dock-summary-item is-wide">
            <span className="metric-label">Выбор</span>
            <strong>{selectionLabel}</strong>
          </div>
        ) : null}
      </div>
    </section>
  );

  const renderNavigatorZone = (compactView = false) => (
    <section className="dock-zone dock-zone-navigator" aria-label="Навигатор">
      <header className="dock-zone-head dock-zone-head--between">
        <span className="dock-zone-label">Навигатор</span>
        <button
          type="button"
          className="dock-inline-button"
          title={isNavigatorVisible ? 'Скрыть навигатор' : 'Показать навигатор'}
          onClick={() => setIsNavigatorVisible((current) => !current)}
        >
          {isNavigatorVisible ? 'Свернуть' : 'Развернуть'}
        </button>
      </header>
      <div className="dock-navigator-actions" role="group" aria-label="Быстрые действия навигатора">
        <button type="button" className="dock-navigator-action" onClick={() => void handleReturnToDiagram()}>К схеме</button>
        <button type="button" className="dock-navigator-action" onClick={() => void handleFitToView()}>Вписать</button>
        <button type="button" className="dock-navigator-action" onClick={() => setEdgeLabelMode(edgeLabelMode === 'hidden' ? 'selected' : 'hidden')}>
          {edgeLabelMode === 'hidden' ? 'Показать подписи' : 'Скрыть подписи'}
        </button>
      </div>
      {isNavigatorVisible ? (
        <div className={`dock-navigator-preview-shell ${compactView ? 'is-compact' : ''}`}>
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
        </div>
      ) : (
        <div className="dock-navigator-collapsed">Навигатор скрыт</div>
      )}
      <div className="dock-mode-actions">
        <button
          type="button"
          className="dock-mode-button"
          onClick={() => setPanelState(isCompact ? 'standard' : 'compact')}
        >
          {isCompact ? 'Стандартная' : 'Компактная'}
        </button>
        <button
          type="button"
          className="dock-mode-button dock-mode-button--primary"
          onClick={() => setPanelState(isFull ? 'standard' : 'full')}
        >
          {isFull ? 'Закрыть консоль' : 'Полная диагностика'}
        </button>
      </div>
    </section>
  );

  const dockContent = (
    <section ref={dockRef} className={`simulation-dock sim-${simulationStatus} ${panelClassName} ${focusMode ? 'is-focus-mode' : ''} ${rightPanelVisible ? 'is-right-panel-open' : 'is-right-panel-collapsed'}`} data-panel-mode={panelState} aria-label="Нижняя панель симуляции и диагностики">
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
        <div className="dock-topline">
          <div className="simulation-dock-titleblock">
            <span className="simulation-dock-kicker">Конструктор техсхем</span>
            <strong>{isCompact ? 'Компактная панель' : 'Стандартная панель'}</strong>
            <small>{modeSummary}</small>
          </div>
          <div className="simulation-dock-toolbar-actions">
            <span className="simulation-dock-state-label">{getDiagnosticsPanelStepLabel(panelState)}</span>
            <button type="button" className="simulation-dock-close" onClick={() => setPanelState((currentState) => transitionDiagnosticsPanelState(currentState, 'close'))}>Скрыть</button>
          </div>
        </div>

        {isCompact ? (
          <div className="dock-layout-compact">
            {renderControlZone()}
            {renderSummaryZone(false)}
            {renderNavigatorZone(true)}
          </div>
        ) : null}

        {isStandard || isFull ? (
          <>
            <div className="dock-layout-standard-top">
              {renderControlZone()}
              {renderSummaryZone(true)}
              {renderNavigatorZone(false)}
            </div>
            <div className="dock-layout-standard-bottom">
              <section className="dock-zone">
                <span className="dock-zone-label">Контекст</span>
                <div className="dock-detail-grid">
                  <div>
                    <span className="metric-label">Среда</span>
                    <strong>{mediumLabel[project.simulation.activeMedium]}</strong>
                  </div>
                  <div>
                    <span className="metric-label">Выбор</span>
                    <strong>{selectionLabel}</strong>
                  </div>
                </div>
              </section>
              <section className="dock-zone">
                <span className="dock-zone-label">Фильтры</span>
                <div className="dock-filter-chips">
                  <button type="button" className={!showProblematicOnly ? 'is-active' : ''} onClick={() => showProblematicOnly && toggleProblematicOnly()}>Все</button>
                  <button type="button" className={showProblematicOnly ? 'is-active' : ''} onClick={() => !showProblematicOnly && toggleProblematicOnly()}>Только проблемные</button>
                  <button type="button" className={(selectedNode || selectedEdge) ? 'is-active' : ''} disabled>Выбранное</button>
                </div>
                <small className="dock-help-line">Текущий фильтр: {filterLabel}</small>
              </section>
              <section className="dock-zone">
                <span className="dock-zone-label">Активное предупреждение</span>
                <div className="dock-alert-card">
                  <strong>{activeWarnings[0] ?? 'Нет активных предупреждений'}</strong>
                  <span>Скорость: {project.simulation.speed.toFixed(project.simulation.speed % 1 === 0 ? 0 : 1)}×</span>
                </div>
              </section>
            </div>
          </>
        ) : null}
      </div>

      {isFull ? (
        <aside className="dock-full-console" aria-label="Панель полной диагностики">
          <header className="dock-full-console-header">
            <div>
              <span className="dock-zone-label">Режим полной диагностики</span>
              <strong>Консоль диагностики</strong>
              <small>{modeSummary}</small>
            </div>
            <div className="dock-full-console-actions">
              <button type="button" className="dock-inline-button" onClick={() => setPanelState('standard')}>Свернуть до стандартной</button>
              <button type="button" className="dock-inline-button" onClick={() => setPanelState('hidden')}>Скрыть панель</button>
            </div>
          </header>
          <div className="dock-full-console-content">
            <section className="console-column console-column-main">
              <div className="console-card">
                <span className="dock-zone-label">Контекст и сигналы</span>
                <div className="dock-detail-grid">
                  <div><span className="metric-label">Режим</span><strong>{modeSummary}</strong></div>
                  <div><span className="metric-label">Фильтр</span><strong>{filterLabel}</strong></div>
                  <div><span className="metric-label">Предупреждений</span><strong>{warningCount}</strong></div>
                  <div><span className="metric-label">Последнее событие</span><strong>{latestEvent?.message ?? project.simulation.lastEvent}</strong></div>
                </div>
              </div>
              <div className="console-card console-journal-card">
                <div className="console-card-head">
                  <strong>Журнал событий</strong>
                  <span>Буфер: {project.eventLog.length}</span>
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
            </section>
            <section className="console-column console-column-side">
              <div className="console-card">
                <div className="console-card-head">
                  <strong>Предупреждения</strong>
                  <span>Приоритет</span>
                </div>
                <div className="sheet-warning-list">
                  {activeWarnings.length
                    ? activeWarnings.map((warning) => <div key={warning} className="sheet-warning-item">{warning}</div>)
                    : <div className="sheet-warning-item is-idle">Активных предупреждений нет</div>}
                </div>
              </div>
              <div className="console-card">
                <span className="dock-zone-label">Последнее событие</span>
                <div className="sheet-last-event">
                  <span className="metric-label">Время</span>
                  <strong>{latestEvent ? formatEventTime(latestEvent.timestamp) : 'Нет записей'}</strong>
                  <span>{latestEvent?.type ?? 'система'}</span>
                </div>
              </div>
            </section>
          </div>
        </aside>
      ) : null}
    </section>
  );

  if (typeof document === 'undefined') return dockContent;
  return createPortal(dockContent, document.body);
};

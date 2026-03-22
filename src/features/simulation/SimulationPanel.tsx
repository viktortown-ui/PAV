import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';

type SimulationPanelMode = 'compact' | 'expanded' | 'hidden';
type SimulationPanelPlacement = 'left' | 'center' | 'right';

type SimulationPanelProps = {
  placement?: SimulationPanelPlacement;
};

const speedOptions = [0.5, 1, 1.5, 2, 3];
const panelModeOrder: SimulationPanelMode[] = ['hidden', 'compact', 'expanded'];
const panelModeStorageKey = 'simulation-panel-mode';

const mediumLabel: Record<string, string> = {
  none: 'нет',
  mixed: 'смешанная',
  water: 'вода',
  product: 'продукт',
  cip: 'CIP',
  waste: 'сток',
};

const cyclePanelMode = (mode: SimulationPanelMode) => {
  const currentIndex = panelModeOrder.indexOf(mode);
  return panelModeOrder[(currentIndex + 1) % panelModeOrder.length];
};

export const SimulationPanel = ({ placement = 'center' }: SimulationPanelProps) => {
  const project = useAppStore((state) => state.project);
  const selectedNodeId = useAppStore((state) => state.selectedNodeId);
  const selectedEdgeId = useAppStore((state) => state.selectedEdgeId);
  const setSimulationRunning = useAppStore((state) => state.setSimulationRunning);
  const setSimulationSpeed = useAppStore((state) => state.setSimulationSpeed);
  const resetSimulation = useAppStore((state) => state.resetSimulation);
  const toggleProblematicOnly = useAppStore((state) => state.toggleProblematicOnly);
  const issues = useAppStore((state) => state.issues);
  const showProblematicOnly = useAppStore((state) => state.showProblematicOnly);
  const [panelMode, setPanelMode] = useState<SimulationPanelMode>(() => {
    if (typeof window === 'undefined') return 'compact';
    const storedMode = window.sessionStorage.getItem(panelModeStorageKey);
    return storedMode === 'expanded' || storedMode === 'hidden' || storedMode === 'compact' ? storedMode : 'compact';
  });

  useEffect(() => {
    window.sessionStorage.setItem(panelModeStorageKey, panelMode);
  }, [panelMode]);

  useEffect(() => {
    const handleHotkey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (event.key.toLowerCase() !== 'd' || !(event.altKey || event.metaKey)) return;
      event.preventDefault();
      setPanelMode((currentMode) => cyclePanelMode(currentMode));
    };

    window.addEventListener('keydown', handleHotkey);
    return () => window.removeEventListener('keydown', handleHotkey);
  }, []);

  const selectedNode = project.nodes.find((node) => node.id === selectedNodeId);
  const selectedEdge = project.edges.find((edge) => edge.id === selectedEdgeId);
  const warningCount = issues.filter((issue) => issue.severity !== 'info').length;
  const recentEvents = useMemo(() => project.eventLog.slice(-6).reverse(), [project.eventLog]);
  const activeWarnings = useMemo(() => project.simulation.warnings.slice(0, 4), [project.simulation.warnings]);
  const selectionLabel = selectedNode
    ? `${selectedNode.data.visibleName} • ${selectedNode.data.technicalTag}`
    : selectedEdge
      ? `${selectedEdge.data?.sourceLabel} → ${selectedEdge.data?.targetLabel}`
      : 'ничего не выбрано';

  const modeLabel = panelMode === 'expanded' ? 'Свернуть диагностику' : panelMode === 'compact' ? 'Развернуть диагностику' : 'Показать док';
  const modeIcon = panelMode === 'expanded' ? '▾' : panelMode === 'compact' ? '▴' : '◱';

  return (
    <div className={`simulation-panel-shell placement-${placement} mode-${panelMode}`} data-panel-mode={panelMode}>
      <div className="simulation-panel-toggle-rail" role="toolbar" aria-label="Режим панели диагностики">
        <button
          type="button"
          className="simulation-panel-toggle"
          onClick={() => setPanelMode(panelMode === 'expanded' ? 'compact' : 'expanded')}
          aria-expanded={panelMode === 'expanded'}
        >
          <span className="toggle-icon" aria-hidden="true">{modeIcon}</span>
          <span>{modeLabel}</span>
        </button>
        <button type="button" className="simulation-panel-toggle is-secondary" onClick={() => setPanelMode(panelMode === 'hidden' ? 'compact' : 'hidden')}>
          <span className="toggle-icon" aria-hidden="true">{panelMode === 'hidden' ? '◰' : '—'}</span>
          <span>{panelMode === 'hidden' ? 'Показать панель' : 'Скрыть панель'}</span>
        </button>
      </div>

      {panelMode !== 'hidden' && (
        <div className={`simulation-panel mode-${panelMode}`}>
          <div className="sim-compact-bar">
            <div className="sim-control-group sim-control-group-primary">
              <button type="button" onClick={() => setSimulationRunning(true)} disabled={project.simulation.running}>▶ Пуск</button>
              <button type="button" onClick={() => setSimulationRunning(false)} disabled={!project.simulation.running}>❚❚ Пауза</button>
              <button type="button" onClick={resetSimulation}>↺ Сброс</button>
            </div>

            <div className="sim-compact-metrics">
              <div className="compact-metric">
                <span>Скорость</span>
                <div className="sim-speed-group">
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
              <div className="compact-metric"><span>Поток</span><strong>{Math.round(project.simulation.totalActiveFlow)} л/мин</strong></div>
              <div className="compact-metric"><span>Предупреждения</span><strong>{warningCount}</strong></div>
              <div className="compact-metric compact-metric-event"><span>Последнее событие</span><strong>{project.simulation.lastEvent}</strong></div>
            </div>
          </div>

          {panelMode === 'expanded' && (
            <div className="sim-expanded-content">
              <div className="sim-header">
                <div>
                  <strong>Диагностика технологической схемы</strong>
                  <span>Панель расширяется только по запросу, чтобы сохранить читаемость канвы и мгновенно вернуть компактный док.</span>
                </div>
                <div className="sim-pills">
                  <span className="sim-pill">{project.simulation.running ? 'Симуляция включена' : 'Режим редактирования'}</span>
                  <span className="sim-pill">Среда: {mediumLabel[project.simulation.activeMedium]}</span>
                  <span className="sim-pill">Выбор: {selectionLabel}</span>
                </div>
              </div>

              <div className="status-grid diagnostics-grid">
                <div className="status-card">
                  <span>Активные предупреждения</span>
                  <strong>{warningCount}</strong>
                  <small>{activeWarnings[0] ?? 'Нет активных предупреждений'}</small>
                </div>
                <div className="status-card">
                  <span>Среда</span>
                  <strong>{mediumLabel[project.simulation.activeMedium]}</strong>
                </div>
                <div className="status-card">
                  <span>Выбор</span>
                  <strong>{selectionLabel}</strong>
                </div>
                <div className="status-card">
                  <span>Режим фильтра</span>
                  <strong>{showProblematicOnly ? 'Только проблемные' : 'Вся схема'}</strong>
                  <small>Упростите обзор без потери управления.</small>
                </div>
              </div>

              <div className="warning-strip">
                {activeWarnings.length
                  ? activeWarnings.map((warning) => <span key={warning} className="warning-pill">{warning}</span>)
                  : <span className="warning-pill is-idle">Активных предупреждений нет</span>}
              </div>

              <div className="sim-diagnostics-actions">
                <button type="button" onClick={toggleProblematicOnly}>{showProblematicOnly ? 'Показать всю схему' : 'Фокус на проблемных узлах'}</button>
                <span>Горячая клавиша: Alt/⌘ + D</span>
              </div>

              <div className="event-log-card">
                <div className="event-log-head">
                  <strong>Журнал событий</strong>
                  <span>Буфер: {project.eventLog.length}</span>
                </div>
                <div className="event-log-list">
                  {recentEvents.map((event) => (
                    <div key={event.id} className={`event-log-item severity-${event.severity}`}>
                      <span>{new Date(event.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' })}</span>
                      <strong>{event.message}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

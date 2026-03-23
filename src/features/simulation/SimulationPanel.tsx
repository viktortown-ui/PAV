import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';

type SimulationPanelMode = 'hidden' | 'mini' | 'compact' | 'expanded';

type SimulationPanelProps = {
  focusMode?: boolean;
};

const speedOptions = [0.5, 1, 1.5, 2, 3];
const panelModeOrder: SimulationPanelMode[] = ['hidden', 'mini', 'compact', 'expanded'];
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

const formatEventTime = (timestamp: string | number) => new Date(timestamp).toLocaleTimeString('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: 'UTC',
});

export const SimulationPanel = ({ focusMode = false }: SimulationPanelProps) => {
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
    if (typeof window === 'undefined') return 'mini';
    const storedMode = window.sessionStorage.getItem(panelModeStorageKey);
    return storedMode === 'hidden' || storedMode === 'mini' || storedMode === 'compact' || storedMode === 'expanded' ? storedMode : 'mini';
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
  const activeWarnings = useMemo(() => project.simulation.warnings.slice(0, 4), [project.simulation.warnings]);
  const recentEvents = useMemo(() => project.eventLog.slice(-8).reverse(), [project.eventLog]);
  const latestEvent = recentEvents[0];
  const selectionLabel = selectedNode
    ? `${selectedNode.data.visibleName} • ${selectedNode.data.technicalTag}`
    : selectedEdge
      ? `${selectedEdge.data?.sourceLabel} → ${selectedEdge.data?.targetLabel}`
      : 'ничего не выбрано';
  const filterLabel = showProblematicOnly ? 'Только проблемные' : 'Все';
  const modeSummary = project.simulation.running ? 'Симуляция включена' : 'Редактирование';

  const modeButtons: Array<{ mode: SimulationPanelMode; label: string }> = [
    { mode: 'hidden', label: 'Скрыто' },
    { mode: 'mini', label: 'Dock' },
    { mode: 'compact', label: 'Сводка' },
    { mode: 'expanded', label: 'Лист' },
  ];

  return (
    <section className={`simulation-dock is-${panelMode} ${focusMode ? 'is-focus-mode' : ''}`} data-panel-mode={panelMode} aria-label="Нижняя панель симуляции и диагностики">
      <div className="simulation-dock-launcher" aria-hidden={panelMode !== 'hidden'}>
        <button type="button" className="simulation-launcher-button" onClick={() => setPanelMode('mini')} aria-expanded={panelMode !== 'hidden'}>
          <span className="launcher-title">Диагностика</span>
          <span className="launcher-meta">{warningCount} предупрежд. • {Math.round(project.simulation.totalActiveFlow)} л/мин</span>
        </button>
      </div>

      <div className="simulation-dock-panel">
        <div className="simulation-dock-grab" aria-hidden="true" />
        <div className="simulation-dock-toolbar" role="toolbar" aria-label="Состояние нижней панели">
          <div className="simulation-dock-titleblock">
            <span className="simulation-dock-kicker">Нижняя панель</span>
            <strong>Управление потоком и диагностика</strong>
          </div>
          <div className="simulation-dock-mode-switch">
            {modeButtons.map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                className={panelMode === mode ? 'is-active' : ''}
                onClick={() => setPanelMode(mode)}
                aria-pressed={panelMode === mode}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="simulation-dock-row simulation-dock-row-primary">
          <div className="dock-zone dock-zone-controls" aria-label="Управление симуляцией">
            <span className="dock-zone-label">Zone A • Controls</span>
            <div className="dock-controls-cluster">
              <button type="button" className="is-primary" onClick={() => setSimulationRunning(true)} disabled={project.simulation.running}>▶ Пуск</button>
              <button type="button" onClick={() => setSimulationRunning(false)} disabled={!project.simulation.running}>❚❚ Пауза</button>
              <button type="button" onClick={resetSimulation}>↺ Сброс</button>
              <div className="dock-speed-field">
                <span>Скорость</span>
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
          </div>

          <div className="dock-zone dock-zone-status" aria-label="Живой статус симуляции">
            <span className="dock-zone-label">Zone B • Live status</span>
            <div className="dock-status-strip">
              <div className="dock-status-item">
                <span>Поток</span>
                <strong>{Math.round(project.simulation.totalActiveFlow)} л/мин</strong>
              </div>
              <div className="dock-status-item warning-state">
                <span>Предупреждения</span>
                <strong>{warningCount}</strong>
              </div>
              <div className="dock-status-item dock-status-item-wide">
                <span>Последнее событие</span>
                <strong>{project.simulation.lastEvent}</strong>
              </div>
              <div className="dock-status-item">
                <span>Режим</span>
                <strong>{modeSummary}</strong>
              </div>
            </div>
          </div>

          <div className="dock-zone dock-zone-expand">
            <span className="dock-zone-label">Панель</span>
            <button
              type="button"
              className="dock-expand-button"
              onClick={() => setPanelMode(panelMode === 'expanded' ? 'compact' : panelMode === 'compact' ? 'mini' : 'expanded')}
              aria-expanded={panelMode === 'expanded'}
            >
              <span>{panelMode === 'expanded' ? 'Свернуть' : panelMode === 'compact' ? 'Мини-dock' : 'Развернуть'}</span>
              <strong>{panelMode === 'expanded' ? '▾' : '▴'}</strong>
            </button>
          </div>
        </div>

        <div className="simulation-dock-row simulation-dock-row-summary">
          <div className="dock-zone dock-zone-filters" aria-label="Фильтры и режимы">
            <span className="dock-zone-label">Zone C • Filters / mode</span>
            <div className="dock-filter-chips">
              <button type="button" className={!showProblematicOnly ? 'is-active' : ''} onClick={() => showProblematicOnly && toggleProblematicOnly()}>Все</button>
              <button type="button" className={showProblematicOnly ? 'is-active' : ''} onClick={() => !showProblematicOnly && toggleProblematicOnly()}>Только проблемные</button>
              <button type="button" className={(selectedNode || selectedEdge) ? 'is-active' : ''} disabled>Выбранное</button>
              <button type="button" disabled>Текущая линия</button>
            </div>
          </div>

          <div className="dock-zone dock-zone-summary" aria-label="Сводка панели">
            <span className="dock-zone-label">Сводка</span>
            <div className="dock-summary-grid">
              <div>
                <span>Среда</span>
                <strong>{mediumLabel[project.simulation.activeMedium]}</strong>
              </div>
              <div>
                <span>Фильтр</span>
                <strong>{filterLabel}</strong>
              </div>
              <div className="is-wide">
                <span>Выбор</span>
                <strong>{selectionLabel}</strong>
              </div>
              <div className="is-wide">
                <span>Активное предупреждение</span>
                <strong>{activeWarnings[0] ?? 'Нет активных предупреждений'}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="simulation-dock-sheet">
          <div className="simulation-sheet-main">
            <div className="sheet-section sheet-section-overview">
              <div className="sheet-section-head">
                <div>
                  <span className="dock-zone-label">Zone D • Journal</span>
                  <strong>Диагностический лист</strong>
                </div>
                <button type="button" className="sheet-focus-button" onClick={toggleProblematicOnly}>
                  {showProblematicOnly ? 'Показать всю схему' : 'Фокус на проблемах'}
                </button>
              </div>
              <div className="sheet-overview-grid">
                <div>
                  <span>Mode</span>
                  <strong>{modeSummary}</strong>
                </div>
                <div>
                  <span>Medium</span>
                  <strong>{mediumLabel[project.simulation.activeMedium]}</strong>
                </div>
                <div className="is-wide">
                  <span>Selection summary</span>
                  <strong>{selectionLabel}</strong>
                </div>
                <div className="is-wide">
                  <span>Warnings</span>
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
                    <span>{formatEventTime(event.timestamp)}</span>
                    <strong>{event.message}</strong>
                    <small>{event.type}</small>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <aside className="simulation-sheet-side">
            <div className="sheet-section">
              <div className="sheet-section-head">
                <div>
                  <strong>Активные предупреждения</strong>
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
                <strong>{latestEvent?.message ?? project.simulation.lastEvent}</strong>
                <span>{latestEvent?.type ?? 'system'}</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
};

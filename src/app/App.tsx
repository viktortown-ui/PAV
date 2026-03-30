import { Component, ErrorInfo, ReactNode, useEffect, useMemo, useState } from 'react';
import { useReactFlow } from 'reactflow';
import { CanvasEditor } from '../features/editor/CanvasEditor';
import { TopToolbar } from '../features/editor/TopToolbar';
import { InspectorPanel } from '../features/inspector/InspectorPanel';
import { ToolboxPanel } from '../features/toolbox/ToolboxPanel';
import { LeftShellState, defaultLeftShellState, leftShellStateMachineDefinition, restoreLeftShellState, serializeLeftShellState, transitionLeftShell } from '../features/toolbox/leftShellState';
import { EquipmentWizard } from '../features/equipmentWizard/EquipmentWizard';
import { SimulationPanel } from '../features/simulation/SimulationPanel';
import { useAppStore } from '../store/useAppStore';
import { buildSegmentList, summarizeDiagnostics } from '../features/editor/lineList';
import { EdgeLabelMode, TemplateId } from '../domain/schemas/types';
import { edgeLabelModes } from '../features/inspector/schemas';
import { LibraryPicker } from '../features/library/LibraryPicker';
import { compactEvents, formatEventTime, severityTitle } from '../features/inspector/presentation';

class EditorErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  public state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Editor render failed', error, info); useAppStore.getState().setStartupError(error.message); }
  private handleReset = async () => { this.setState({ error: undefined }); await useAppStore.getState().clearLocalDataAndLoadDemo(); };
  render() { if (this.state.error) return <div className="startup-fallback" role="alert"><h2>Ошибка запуска приложения</h2><p>{this.state.error.message}</p><div className="startup-actions"><button onClick={() => void this.handleReset()}>Полный сброс версии</button></div></div>; return this.props.children; }
}

type RightPanelKey = 'inspector' | 'diagnostics' | 'lines' | 'events' | 'datasheet' | null;
type PaletteAction = { id: string; title: string; subtitle: string; keywords: string; group: string; hint?: string; run: () => void; };

const shellStateKey = 'pav-shell-state';
const commandPaletteKey = 'k';
const datasheetMediumLabel: Record<string, string> = { water: 'Вода', product: 'Продукт', cip: 'СИП', waste: 'Сток', none: 'Нет', mixed: 'Смешанная' };
const datasheetRouteLabel: Record<string, string> = { idle: 'Ожидание', primed: 'Подготовлен', flowing: 'Поток', blocked: 'Блокировка', starved: 'Нет подпитки', draining: 'Слив', cip: 'СИП', alarm: 'Авария', maintenance: 'Ремонт', offline: 'Отключён' };
const datasheetStatusLabel: Record<string, string> = {
  off: 'Выключен',
  idle: 'Ожидание',
  standby: 'Готовность',
  running: 'Работает',
  blocked: 'Блокирован',
  alarm: 'Авария',
  maintenance: 'Ремонт',
  normal: 'Норма',
  active: 'Активен',
  warning: 'Предупреждение',
  disabled: 'Отключён',
};
const inlineInsertActions = [
  { id: 'inline-shutoff', title: 'Вставить запорный клапан', subtitle: 'На линию • запорная арматура', keywords: 'insert inline valve shutoff клапан арматура on line', kind: 'shutoffValve' },
  { id: 'inline-flowmeter', title: 'Вставить расходомер', subtitle: 'На линию • контроль расхода', keywords: 'insert inline flow meter расходомер кип line', kind: 'flowMeter' },
  { id: 'inline-sensor', title: 'Вставить датчик давления', subtitle: 'На линию • контроль давления', keywords: 'insert inline pressure sensor датчик давления кип', kind: 'pressureSensor' },
  { id: 'inline-filter', title: 'Вставить линейный фильтр', subtitle: 'На линию • фильтрация потока', keywords: 'insert inline filter фильтр line', kind: 'inlineFilter' },
  { id: 'inline-tee', title: 'Вставить тройник', subtitle: 'На линию • ответвление потока', keywords: 'insert inline tee topology тройник branch', kind: 'tee' },
] as const;

const DiagnosticsPanel = () => {
  const issues = useAppStore((state) => state.issues);
  const project = useAppStore((state) => state.project);
  const selectNode = useAppStore((state) => state.selectNode);
  const selectEdge = useAppStore((state) => state.selectEdge);
  const summary = summarizeDiagnostics(issues);
  const recentIssues = issues.slice(0, 8);
  const segmentList = buildSegmentList(project, issues).slice(0, 6);

  return <div className="shell-side-panel"><div className="panel-title">Диагностика</div><div className="shell-panel-section"><strong>Что проверяет блок</strong><span className="panel-caption">Состояние объекта и линии, совместимость сегмента, блокировки маршрута, причины отсутствия потока и предупреждения по физике.</span><div className="diagnostics-summary"><span><b>{summary.errors}</b> ошибок</span><span><b>{summary.warnings}</b> предупреждений</span><span><b>{summary.infos}</b> подсказок</span></div></div><div className="shell-panel-section"><strong>Активные причины и блокировки</strong><div className="issue-list-detailed">{recentIssues.length ? recentIssues.map((issue) => <button key={issue.id} type="button" className={`issue-card severity-${issue.severity}`} onClick={() => { if (issue.edgeIds?.[0]) selectEdge(issue.edgeIds[0]); else if (issue.nodeIds?.[0]) selectNode(issue.nodeIds[0]); }}><strong>{severityTitle(issue.severity)}</strong><span>{issue.message}</span></button>) : <div className="issue-card severity-info"><strong>Физических замечаний не найдено</strong><span>Поток не заблокирован: ошибок и предупреждений не выявлено.</span></div>}</div></div><div className="shell-panel-section"><strong>Сегменты маршрута (для перехода)</strong><span className="panel-caption">Показывает состояние и применимость линии для текущего маршрута.</span><div className="segment-list">{segmentList.map((segment) => <button key={segment.edgeId} type="button" className={`segment-card severity-${segment.severity === 'ok' ? 'info' : segment.severity}`} onClick={() => selectEdge(segment.edgeId)}><strong>{segment.lineTag}</strong><span>{segment.sourceName} → {segment.targetName}</span><span>{segment.mediumLabel} • {segment.nominalDiameter} • {segment.routeStateLabel}</span><span>{segment.issueCount ? `Есть замечания: ${segment.issueCount}` : 'Маршрут совместим'}</span></button>)}</div></div></div>;
};

const LineListPanel = () => {
  const project = useAppStore((state) => state.project);
  const issues = useAppStore((state) => state.issues);
  const selectEdge = useAppStore((state) => state.selectEdge);
  const segments = buildSegmentList(project, issues);

  return <div className="shell-side-panel"><div className="panel-title">Линии</div><div className="shell-panel-section"><strong>Список линий</strong><span className="panel-caption">Выберите линию, чтобы быстро перейти к её параметрам.</span><div className="segment-list">{segments.map((segment) => <button key={segment.edgeId} type="button" className={`segment-card severity-${segment.severity === 'ok' ? 'info' : segment.severity}`} onClick={() => selectEdge(segment.edgeId)}><strong>{segment.lineTag}</strong><span>{segment.sourceName} → {segment.targetName}</span><span>{segment.mediumLabel} • {segment.nominalDiameter}</span><span>Маршрут: {segment.routeStateLabel} • Замечаний: {segment.issueCount}</span></button>)}</div></div></div>;
};

const EventLogPanel = () => {
  const project = useAppStore((state) => state.project);
  const events = compactEvents([...project.eventLog].slice(-24).reverse());
  return <div className="shell-side-panel"><div className="panel-title">События</div><div className="shell-panel-section"><strong>Последние события</strong><div className="event-log-list shell-event-log-list">{events.length ? events.map((event) =>
    <div key={event.id} className={`event-log-item severity-${event.severity}`}><span>{formatEventTime(event.timestamp)}</span><strong>{event.uiMessage}</strong><small>{event.uiType}</small></div>,
  ) : <div className="issue-card severity-info"><strong>События</strong><span>Записей пока нет.</span></div>}</div></div></div>;
};

const DatasheetPanel = () => {
  const project = useAppStore((state) => state.project);
  const selectedNodeId = useAppStore((state) => state.selectedNodeId);
  const selectedEdgeId = useAppStore((state) => state.selectedEdgeId);
  const node = project.nodes.find((item) => item.id === selectedNodeId);
  const edge = project.edges.find((item) => item.id === selectedEdgeId);
  const rows = node ? [
    ['Имя', node.data.visibleName],
    ['Тег', node.data.technicalTag],
    ['Категория', node.data.category],
    ['Среда', datasheetMediumLabel[node.data.mediumType] ?? node.data.mediumType],
    ['Статус', datasheetStatusLabel[node.data.status] ?? node.data.status],
  ] : edge ? [
    ['Сегмент', edge.data?.segmentId ?? `${edge.data?.sourceLabel ?? edge.source} → ${edge.data?.targetLabel ?? edge.target}`],
    ['Среда', datasheetMediumLabel[edge.data?.medium ?? 'water'] ?? edge.data?.medium ?? 'Вода'],
    ['DN', edge.data?.nominalDiameter ?? 'DN50'],
    ['Маршрут', datasheetRouteLabel[edge.data?.routeState ?? 'idle'] ?? edge.data?.routeState ?? 'Ожидание'],
    ['Источник', edge.data?.sourceLabel ?? edge.source],
  ] : [];
  return <div className="shell-side-panel"><div className="panel-title">Паспорт</div><div className="shell-panel-section"><strong>{node ? 'Карточка оборудования' : edge ? 'Карточка сегмента' : 'Нет выбора'}</strong>{rows.length ? <dl className="datasheet-grid">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{String(value)}</dd></div>)}</dl> : <p className="empty-state">Выберите объект или линию, чтобы открыть паспорт.</p>}</div></div>;
};

const CommandPalette = ({ open, onClose, actions }: { open: boolean; onClose: () => void; actions: PaletteAction[] }) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  const filteredActions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const candidates = normalized
      ? actions.filter((action) => `${action.title} ${action.subtitle} ${action.keywords}`.toLowerCase().includes(normalized))
      : actions;
    return candidates.slice(0, 12);
  }, [actions, query]);

  useEffect(() => {
    if (activeIndex >= filteredActions.length) setActiveIndex(0);
  }, [activeIndex, filteredActions.length]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (!filteredActions.length) return;
      if (event.key === 'ArrowDown' || (event.ctrlKey && event.key.toLowerCase() === 'j')) {
        event.preventDefault();
        setActiveIndex((value) => (value + 1) % filteredActions.length);
      }
      if (event.key === 'ArrowUp' || (event.ctrlKey && event.key.toLowerCase() === 'k')) {
        event.preventDefault();
        setActiveIndex((value) => (value - 1 + filteredActions.length) % filteredActions.length);
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        filteredActions[activeIndex]?.run();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, filteredActions, onClose, open]);

  if (!open) return null;
  return <div className="command-palette-backdrop" onClick={onClose}><div className="command-palette" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Командная палитра"><div className="command-palette-head"><div><strong>Командная палитра</strong><span className="panel-caption">Быстрый доступ к действиям и панелям • Ctrl/⌘K</span></div><button type="button" onClick={onClose}>Esc</button></div><input autoFocus className="panel-search command-palette-search" placeholder="Команда, панель, оборудование, шаблон…" value={query} onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }} /><div className="command-palette-meta"><span>↑ ↓ переход</span><span>Enter выбрать</span><span>Shift+F режим схемы</span></div><div className="command-palette-list">{filteredActions.length ? filteredActions.map((action, index) => <button key={action.id} type="button" className={`command-palette-item ${index === activeIndex ? 'is-active' : ''}`} onMouseEnter={() => setActiveIndex(index)} onClick={() => { action.run(); onClose(); }}><div><strong>{action.title}</strong><span>{action.subtitle}</span></div><div className="command-palette-item-meta"><small>{action.group}</small>{action.hint ? <kbd>{action.hint}</kbd> : null}</div></button>) : <div className="command-palette-empty"><strong>Ничего не найдено</strong><span>Попробуйте «диагностика», «линии» или «шаблон».</span></div>}</div></div></div>;
};

export const App = () => {
  const rf = useReactFlow();
  const loadProject = useAppStore((state) => state.loadProject); const startupState = useAppStore((state) => state.startupState); const startupNotice = useAppStore((state) => state.startupNotice); const dismissStartupNotice = useAppStore((state) => state.dismissStartupNotice);
  const openEquipmentWizard = useAppStore((state) => state.openEquipmentWizard);
  const openLibraryPicker = useAppStore((state) => state.openLibraryPicker);
  const setInspectorTab = useAppStore((state) => state.setInspectorTab);
  const setEdgeLabelMode = useAppStore((state) => state.setEdgeLabelMode);
  const edgeLabelMode = useAppStore((state) => state.edgeLabelMode);
  const presentationMode = useAppStore((state) => state.project.view.presentationMode);
  const setPresentationMode = useAppStore((state) => state.setPresentationMode);
  const loadTemplate = useAppStore((state) => state.loadTemplate);
  const addNode = useAppStore((state) => state.addNode);
  const [leftShell, setLeftShell] = useState<LeftShellState>(() => defaultLeftShellState());
  const [rightPanel, setRightPanel] = useState<RightPanelKey>('inspector');
  const [activeCanvasTool, setActiveCanvasTool] = useState<'select' | 'connect'>('select');
  const [gridEnabled, setGridEnabled] = useState(true);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => { void loadProject(); }, [loadProject]);

  useEffect(() => {
    const raw = window.sessionStorage.getItem(shellStateKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { leftShell?: Partial<LeftShellState>; rightPanel?: RightPanelKey };
      setLeftShell(restoreLeftShellState(parsed.leftShell));
      setRightPanel(parsed.rightPanel ?? 'inspector');
    } catch {
      window.sessionStorage.removeItem(shellStateKey);
    }
  }, []);

  useEffect(() => {
    window.sessionStorage.setItem(shellStateKey, JSON.stringify({ leftShell: serializeLeftShellState(leftShell), rightPanel }));
  }, [leftShell, rightPanel]);

  useEffect(() => {
    console.info(leftShellStateMachineDefinition.trim());
  }, []);

  const focusMode = leftShell.mode === 'focus';

  const updateLeftShell = (event: Parameters<typeof transitionLeftShell>[1]) => {
    setLeftShell((current) => transitionLeftShell(current, event));
  };

  const toggleFocusMode = () => {
    setLeftShell((current) => {
      const enteringFocus = current.mode !== 'focus';
      if (enteringFocus) setRightPanel(null);
      return transitionLeftShell(current, { type: enteringFocus ? 'enter-focus' : 'exit-focus' });
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === commandPaletteKey) {
        event.preventDefault();
        setCommandPaletteOpen((value) => !value);
      }
      if (event.shiftKey && key === 'f') {
        event.preventDefault();
        toggleFocusMode();
      }
      if (event.altKey && key === '1') updateLeftShell({ type: 'toggle-drawer' });
      if (event.altKey && key === '2') setRightPanel((current) => current === 'inspector' ? null : 'inspector');
      if (event.altKey && key === '3') setRightPanel((current) => current === 'diagnostics' ? null : 'diagnostics');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleFocusMode, updateLeftShell]);

  const openPanel = (panel: Exclude<RightPanelKey, null>) => {
    setLeftShell((current) => current.mode === 'focus' ? transitionLeftShell(current, { type: 'exit-focus' }) : current);
    setRightPanel(panel);
  };

  const togglePanel = (panel: 'lines' | 'diagnostics') => {
    setLeftShell((current) => current.mode === 'focus' ? transitionLeftShell(current, { type: 'exit-focus' }) : current);
    setRightPanel((current) => current === panel ? null : panel);
  };

  const toggleLabels = () => {
    const currentIndex = edgeLabelModes.findIndex((mode) => mode.value === edgeLabelMode);
    const nextMode = edgeLabelModes[(currentIndex + 1) % edgeLabelModes.length]?.value ?? 'selected';
    setEdgeLabelMode(nextMode as EdgeLabelMode);
  };

  const commandActions = useMemo<PaletteAction[]>(() => {
    const templateActions: PaletteAction[] = [
      { id: 'template-water', title: 'Переключить шаблон: Водоподготовка', subtitle: 'Шаблон • схема водоподготовки', keywords: 'template water вода водоподготовка water-prep', group: 'Шаблоны', run: () => void loadTemplate('water-prep' satisfies TemplateId) },
      { id: 'template-soap', title: 'Переключить шаблон: Линия ПАВ', subtitle: 'Шаблон • базовая схема линии ПАВ', keywords: 'template soap пав line шаблон soap-line', group: 'Шаблоны', run: () => void loadTemplate('soap-line' satisfies TemplateId) },
      { id: 'template-cip', title: 'Переключить шаблон: CIP-фрагмент', subtitle: 'Шаблон • базовый CIP-контур', keywords: 'template cip шаблон cip-fragment', group: 'Шаблоны', run: () => void loadTemplate('cip-fragment' satisfies TemplateId) },
    ];

    const inlineActions: PaletteAction[] = inlineInsertActions.map((action) => ({
      id: action.id,
      title: action.title,
      subtitle: action.subtitle,
      keywords: action.keywords,
      group: 'Линия',
      run: () => { addNode(action.kind); updateLeftShell({ type: 'quick-add-complete' }); },
    }));

    return [
      { id: 'add-equipment', title: 'Добавить оборудование', subtitle: 'Открыть форму и добавить оборудование', keywords: 'add equipment оборудование мастер wizard', group: 'Действия', hint: 'A', run: () => openEquipmentWizard() },
      { id: 'open-library', title: 'Открыть библиотеку', subtitle: 'Полноэкранный режим выбора элемента', keywords: 'library picker библиотека', group: 'Режимы', run: () => openLibraryPicker('global') },
      { id: 'open-diagnostics', title: 'Открыть диагностику', subtitle: 'Показать ошибки, предупреждения и критичные сегменты', keywords: 'diagnostics диагностика ошибки предупреждения issues', group: 'Панели', run: () => openPanel('diagnostics') },
      { id: 'open-lines', title: 'Открыть список линий', subtitle: 'Показать все линии схемы', keywords: 'line list линии сегменты list', group: 'Панели', run: () => openPanel('lines') },
      { id: 'open-inspector', title: 'Открыть инспектор', subtitle: 'Вернуть правую панель свойств и действий', keywords: 'inspector инспектор свойства', group: 'Панели', run: () => { setInspectorTab('main'); openPanel('inspector'); } },
      { id: 'fit-view', title: 'Вписать схему', subtitle: 'Показать всю схему в рабочей области', keywords: 'fit view вписать zoom canvas', group: 'Вид схемы', hint: 'F', run: () => void rf.fitView({ padding: 0.2, duration: 220 }) },
      { id: 'mode-schematic', title: 'Режим отображения: Схема', subtitle: 'Статичный инженерный вид без процессного шума', keywords: 'режим схема инженерный статичный', group: 'Вид схемы', run: () => setPresentationMode('schematic') },
      { id: 'mode-simulation', title: 'Режим отображения: Симуляция', subtitle: 'Живой процессный вид со статусами и потоком', keywords: 'режим симуляция процесс поток', group: 'Вид схемы', run: () => setPresentationMode('simulation') },
      { id: 'toggle-labels', title: 'Переключить подписи линий', subtitle: `Сейчас: ${edgeLabelModes.find((mode) => mode.value === edgeLabelMode)?.label ?? edgeLabelMode}` , keywords: 'labels подписи линии toggle labels', group: 'Вид схемы', run: toggleLabels },
      { id: 'toggle-focus', title: focusMode ? 'Выйти из режима схемы' : 'Включить режим схемы', subtitle: 'Работа со схемой без боковых панелей', keywords: 'focus mode фокус режим canvas first', group: 'Вид схемы', hint: 'Shift+F', run: toggleFocusMode },
      ...inlineActions,
      ...templateActions,
    ];
  }, [addNode, edgeLabelMode, focusMode, leftShell.quickAddCloseBehavior, loadTemplate, openEquipmentWizard, openLibraryPicker, rf, setPresentationMode]);

  const rightPanelNode = useMemo(() => {
    if (rightPanel === null || focusMode) return null;
    switch (rightPanel) {
      case 'inspector': return <InspectorPanel compact />;
      case 'diagnostics': return <DiagnosticsPanel />;
      case 'lines': return <LineListPanel />;
      case 'events': return <EventLogPanel />;
      case 'datasheet': return <DatasheetPanel />;
      default: return null;
    }
  }, [focusMode, rightPanel]);
  const isRightPanelVisible = rightPanel !== null && !focusMode;

  return <div className={`app-shell shell-refactor mode-${presentationMode} ${focusMode ? 'is-focus-mode' : ''}`}><TopToolbar focusMode={focusMode} onToggleFocusMode={toggleFocusMode} onOpenLibrary={() => openLibraryPicker('global')} onOpenCommandPalette={() => setCommandPaletteOpen(true)} />{startupNotice && <div className={`startup-banner startup-banner-${startupNotice.type}`} role="status"><span>{startupNotice.message}</span><button onClick={dismissStartupNotice}>Закрыть</button></div>}{startupState !== 'ready' ? <div className="startup-fallback"><h2>Запуск редактора</h2><p>Подготавливаем данные проекта и восстанавливаем рабочее состояние.</p></div> : <EditorErrorBoundary><div className="workspace-shell"><ToolboxPanel leftShell={leftShell} stateMachineDefinition={leftShellStateMachineDefinition} onEvent={updateLeftShell} onOpenLibrary={() => openLibraryPicker('global')} activeCanvasTool={activeCanvasTool} gridEnabled={gridEnabled} activeRightPanel={rightPanel === 'lines' || rightPanel === 'diagnostics' ? rightPanel : null} onSelectTool={setActiveCanvasTool} onToggleGrid={() => setGridEnabled((current) => !current)} onTogglePanel={togglePanel} /><div className="center-stage"><CanvasEditor focusMode={focusMode} activeTool={activeCanvasTool} gridEnabled={gridEnabled} /><div className={`right-rail ${isRightPanelVisible ? 'is-drawer-open' : 'is-drawer-collapsed'}`}><div className="shell-rail shell-rail-right"><button type="button" className={rightPanel === 'inspector' ? 'is-active' : ''} onClick={() => setRightPanel((value) => value === 'inspector' ? null : 'inspector')} title="Инспектор">И</button><button type="button" className={rightPanel === 'diagnostics' ? 'is-active' : ''} onClick={() => setRightPanel((value) => value === 'diagnostics' ? null : 'diagnostics')} title="Диагностика">Д</button><button type="button" className={rightPanel === 'lines' ? 'is-active' : ''} onClick={() => setRightPanel((value) => value === 'lines' ? null : 'lines')} title="Линии">Л</button><button type="button" className={rightPanel === 'events' ? 'is-active' : ''} onClick={() => setRightPanel((value) => value === 'events' ? null : 'events')} title="События">С</button><button type="button" className={rightPanel === 'datasheet' ? 'is-active' : ''} onClick={() => setRightPanel((value) => value === 'datasheet' ? null : 'datasheet')} title="Паспорт">П</button></div>{isRightPanelVisible && rightPanelNode ? <aside className="shell-right-drawer" key={rightPanel}>{rightPanelNode}</aside> : null}</div></div></div><SimulationPanel focusMode={focusMode} rightPanelVisible={isRightPanelVisible} activeRightTab={rightPanel} /></EditorErrorBoundary>}<EquipmentWizard /><LibraryPicker /><CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} actions={commandActions} /></div>;
};

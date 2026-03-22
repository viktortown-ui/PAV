import { Component, ErrorInfo, ReactNode, useEffect, useMemo, useState } from 'react';
import { CanvasEditor } from '../features/editor/CanvasEditor';
import { TopToolbar } from '../features/editor/TopToolbar';
import { InspectorPanel } from '../features/inspector/InspectorPanel';
import { ToolboxPanel } from '../features/toolbox/ToolboxPanel';
import { EquipmentWizard } from '../features/equipmentWizard/EquipmentWizard';
import { useAppStore } from '../store/useAppStore';
import { buildSegmentList, summarizeDiagnostics } from '../features/editor/lineList';

class EditorErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  public state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Editor render failed', error, info); useAppStore.getState().setStartupError(error.message); }
  private handleReset = async () => { this.setState({ error: undefined }); await useAppStore.getState().clearLocalDataAndLoadDemo(); };
  render() { if (this.state.error) return <div className="startup-fallback" role="alert"><h2>Ошибка запуска приложения</h2><p>{this.state.error.message}</p><div className="startup-actions"><button onClick={() => void this.handleReset()}>Полный сброс версии</button></div></div>; return this.props.children; }
}

type RightPanelKey = 'inspector' | 'diagnostics' | 'lines' | 'events' | 'datasheet' | null;

const shellStateKey = 'pav-shell-state';
const commandPaletteKey = 'k';

const DiagnosticsPanel = () => {
  const issues = useAppStore((state) => state.issues);
  const project = useAppStore((state) => state.project);
  const selectNode = useAppStore((state) => state.selectNode);
  const selectEdge = useAppStore((state) => state.selectEdge);
  const summary = summarizeDiagnostics(issues);
  const recentIssues = issues.slice(0, 8);
  const segmentList = buildSegmentList(project, issues).slice(0, 6);

  return <div className="shell-side-panel"><div className="panel-title">Диагностика</div><div className="shell-panel-section"><div className="diagnostics-summary"><span><b>{summary.errors}</b> ошибок</span><span><b>{summary.warnings}</b> предупреждений</span><span><b>{summary.infos}</b> подсказок</span></div></div><div className="shell-panel-section"><strong>Критичные замечания</strong><div className="issue-list-detailed">{recentIssues.length ? recentIssues.map((issue) => <button key={issue.id} type="button" className={`issue-card severity-${issue.severity}`} onClick={() => { if (issue.edgeIds?.[0]) selectEdge(issue.edgeIds[0]); else if (issue.nodeIds?.[0]) selectNode(issue.nodeIds[0]); }}><strong>{issue.severity === 'error' ? 'Ошибка' : issue.severity === 'warning' ? 'Предупреждение' : 'Подсказка'}</strong><span>{issue.message}</span></button>) : <div className="issue-card severity-info"><strong>Проверка</strong><span>Активных замечаний нет.</span></div>}</div></div><div className="shell-panel-section"><strong>Совместимые сегменты</strong><div className="segment-list">{segmentList.map((segment) => <button key={segment.edgeId} type="button" className={`segment-card severity-${segment.severity === 'ok' ? 'info' : segment.severity}`} onClick={() => selectEdge(segment.edgeId)}><strong>{segment.lineTag}</strong><span>{segment.sourceName} → {segment.targetName}</span><span>{segment.mediumLabel} • {segment.nominalDiameter} • {segment.routeStateLabel}</span></button>)}</div></div></div>;
};

const LineListPanel = () => {
  const project = useAppStore((state) => state.project);
  const issues = useAppStore((state) => state.issues);
  const selectEdge = useAppStore((state) => state.selectEdge);
  const segments = buildSegmentList(project, issues);

  return <div className="shell-side-panel"><div className="panel-title">Линии</div><div className="shell-panel-section"><strong>Line list</strong><span className="panel-caption">Список сегментов сгруппирован для быстрого выбора без отдельного крупного модуля.</span><div className="segment-list">{segments.map((segment) => <button key={segment.edgeId} type="button" className={`segment-card severity-${segment.severity === 'ok' ? 'info' : segment.severity}`} onClick={() => selectEdge(segment.edgeId)}><strong>{segment.lineTag}</strong><span>{segment.sourceName} → {segment.targetName}</span><span>{segment.mediumLabel} • {segment.nominalDiameter}</span><span>Маршрут: {segment.routeStateLabel} • Замечаний: {segment.issueCount}</span></button>)}</div></div></div>;
};

const EventLogPanel = () => {
  const project = useAppStore((state) => state.project);
  const events = [...project.eventLog].slice(-18).reverse();
  return <div className="shell-side-panel"><div className="panel-title">События</div><div className="shell-panel-section"><strong>Последние события</strong><div className="event-log-list shell-event-log-list">{events.map((event) => <div key={event.id} className={`event-log-item severity-${event.severity}`}><span>{new Date(event.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span><strong>{event.message}</strong><small>{event.type}</small></div>)}</div></div></div>;
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
    ['Среда', node.data.mediumType],
    ['Статус', node.data.status],
  ] : edge ? [
    ['Segment ID', edge.data?.segmentId ?? edge.id],
    ['Среда', edge.data?.medium ?? 'water'],
    ['DN', edge.data?.nominalDiameter ?? 'DN50'],
    ['Маршрут', edge.data?.routeState ?? 'idle'],
    ['Источник', edge.data?.sourceLabel ?? edge.source],
  ] : [];
  return <div className="shell-side-panel"><div className="panel-title">Datasheet</div><div className="shell-panel-section"><strong>{node ? 'Карточка оборудования' : edge ? 'Карточка сегмента' : 'Нет выбора'}</strong>{rows.length ? <dl className="datasheet-grid">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{String(value)}</dd></div>)}</dl> : <p className="empty-state">Выберите объект или линию, чтобы открыть компактный datasheet.</p>}</div></div>;
};

const CommandPalette = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [query, setQuery] = useState('');
  const saveProject = useAppStore((state) => state.saveProject);
  const loadProject = useAppStore((state) => state.loadProject);
  const newProject = useAppStore((state) => state.newProject);
  const runValidation = useAppStore((state) => state.runValidation);
  const openEquipmentWizard = useAppStore((state) => state.openEquipmentWizard);
  const setSearch = useAppStore((state) => state.setSearch);

  useEffect(() => { if (!open) setQuery(''); }, [open]);

  const actions = [
    { id: 'new', label: 'Новый проект', run: () => newProject() },
    { id: 'open', label: 'Открыть проект', run: () => void loadProject() },
    { id: 'save', label: 'Сохранить проект', run: () => void saveProject('manual') },
    { id: 'equip', label: 'Добавить оборудование', run: () => openEquipmentWizard() },
    { id: 'validate', label: 'Проверить схему', run: () => runValidation() },
    { id: 'search', label: 'Фокус на поиске библиотеки', run: () => setSearch(query) },
  ].filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));

  if (!open) return null;
  return <div className="command-palette-backdrop" onClick={onClose}><div className="command-palette" onClick={(e) => e.stopPropagation()}><div className="command-palette-head"><strong>Командная палитра</strong><button type="button" onClick={onClose}>Esc</button></div><input autoFocus className="panel-search" placeholder="Поиск команды или оборудования" value={query} onChange={(e) => setQuery(e.target.value)} /><div className="command-palette-list">{actions.map((action) => <button key={action.id} type="button" className="command-palette-item" onClick={() => { action.run(); onClose(); }}><strong>{action.label}</strong></button>)}</div></div></div>;
};

export const App = () => {
  const loadProject = useAppStore((state) => state.loadProject); const saveProject = useAppStore((state) => state.saveProject); const projectRevision = useAppStore((state) => state.projectRevision); const persistedRevision = useAppStore((state) => state.persistedRevision); const startupState = useAppStore((state) => state.startupState); const startupNotice = useAppStore((state) => state.startupNotice); const dismissStartupNotice = useAppStore((state) => state.dismissStartupNotice);
  const [focusMode, setFocusMode] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [rightPanel, setRightPanel] = useState<RightPanelKey>('inspector');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => { void loadProject(); }, [loadProject]);
  useEffect(() => { if (startupState !== 'ready' || projectRevision === persistedRevision) return; const handle = window.setTimeout(() => { void saveProject('autosave'); }, 1200); return () => window.clearTimeout(handle); }, [persistedRevision, projectRevision, saveProject, startupState]);

  useEffect(() => {
    const raw = window.sessionStorage.getItem(shellStateKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { focusMode?: boolean; libraryOpen?: boolean; rightPanel?: RightPanelKey };
      setFocusMode(Boolean(parsed.focusMode));
      setLibraryOpen(parsed.libraryOpen ?? true);
      setRightPanel(parsed.rightPanel ?? 'inspector');
    } catch {
      window.sessionStorage.removeItem(shellStateKey);
    }
  }, []);

  useEffect(() => {
    window.sessionStorage.setItem(shellStateKey, JSON.stringify({ focusMode, libraryOpen, rightPanel }));
  }, [focusMode, libraryOpen, rightPanel]);

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
        setFocusMode((value) => !value);
      }
      if (event.altKey && key === '1') setLibraryOpen((value) => !value);
      if (event.altKey && key === '2') setRightPanel((current) => current === 'inspector' ? null : 'inspector');
      if (event.altKey && key === '3') setRightPanel((current) => current === 'diagnostics' ? null : 'diagnostics');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const rightPanelNode = useMemo(() => {
    switch (rightPanel) {
      case 'inspector': return <InspectorPanel compact />;
      case 'diagnostics': return <DiagnosticsPanel />;
      case 'lines': return <LineListPanel />;
      case 'events': return <EventLogPanel />;
      case 'datasheet': return <DatasheetPanel />;
      default: return null;
    }
  }, [rightPanel]);

  return <div className={`app-shell shell-refactor ${focusMode ? 'is-focus-mode' : ''}`}><TopToolbar focusMode={focusMode} onToggleFocusMode={() => setFocusMode((value) => !value)} onToggleLibrary={() => setLibraryOpen((value) => !value)} onOpenCommandPalette={() => setCommandPaletteOpen(true)} />{startupNotice && <div className={`startup-banner startup-banner-${startupNotice.type}`} role="status"><span>{startupNotice.message}</span><button onClick={dismissStartupNotice}>Закрыть</button></div>}{startupState !== 'ready' ? <div className="startup-fallback"><h2>Запуск редактора</h2><p>Проверяем версии локальных данных, схем проекта и безопасное восстановление интерфейса.</p></div> : <EditorErrorBoundary><div className="workspace-shell"><ToolboxPanel collapsed={focusMode} drawerOpen={libraryOpen && !focusMode} onToggleDrawer={() => setLibraryOpen((value) => !value)} /><div className="center-stage"><CanvasEditor focusMode={focusMode} /><div className="right-rail"><div className="shell-rail shell-rail-right"><button type="button" className={rightPanel === 'inspector' ? 'is-active' : ''} onClick={() => setRightPanel((value) => value === 'inspector' ? null : 'inspector')} title="Инспектор">И</button><button type="button" className={rightPanel === 'diagnostics' ? 'is-active' : ''} onClick={() => setRightPanel((value) => value === 'diagnostics' ? null : 'diagnostics')} title="Диагностика">Д</button><button type="button" className={rightPanel === 'lines' ? 'is-active' : ''} onClick={() => setRightPanel((value) => value === 'lines' ? null : 'lines')} title="Линии">Л</button><button type="button" className={rightPanel === 'events' ? 'is-active' : ''} onClick={() => setRightPanel((value) => value === 'events' ? null : 'events')} title="События">С</button><button type="button" className={rightPanel === 'datasheet' ? 'is-active' : ''} onClick={() => setRightPanel((value) => value === 'datasheet' ? null : 'datasheet')} title="Datasheet">DS</button></div>{!focusMode && rightPanelNode ? <aside className="shell-right-drawer">{rightPanelNode}</aside> : null}</div></div></div></EditorErrorBoundary>}<EquipmentWizard /><CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} /></div>;
};

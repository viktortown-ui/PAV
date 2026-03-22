import { Component, ErrorInfo, ReactNode, useEffect } from 'react';
import { CanvasEditor } from '../features/editor/CanvasEditor';
import { TopToolbar } from '../features/editor/TopToolbar';
import { InspectorPanel } from '../features/inspector/InspectorPanel';
import { ToolboxPanel } from '../features/toolbox/ToolboxPanel';
import { useAppStore } from '../store/useAppStore';

class EditorErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  public state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Editor render failed', error, info);
    useAppStore.getState().setStartupError(error.message);
  }

  private handleReset = async () => {
    this.setState({ error: undefined });
    await useAppStore.getState().clearLocalDataAndLoadDemo();
  };

  private handleLoadDemo = async () => {
    this.setState({ error: undefined });
    await useAppStore.getState().loadSafeDemo();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="startup-fallback" role="alert">
          <h2>Ошибка запуска приложения</h2>
          <p>{this.state.error.message}</p>
          <div className="startup-actions">
            <button onClick={() => void this.handleReset()}>Сбросить локальные данные</button>
            <button onClick={() => void this.handleLoadDemo()}>Загрузить демо-проект</button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const App = () => {
  const loadProject = useAppStore((state) => state.loadProject);
  const saveProject = useAppStore((state) => state.saveProject);
  const projectRevision = useAppStore((state) => state.projectRevision);
  const persistedRevision = useAppStore((state) => state.persistedRevision);
  const startupState = useAppStore((state) => state.startupState);
  const startupNotice = useAppStore((state) => state.startupNotice);
  const dismissStartupNotice = useAppStore((state) => state.dismissStartupNotice);

  useEffect(() => { void loadProject(); }, [loadProject]);
  useEffect(() => {
    if (startupState !== 'ready') return;
    if (projectRevision === persistedRevision) return;
    const handle = window.setTimeout(() => { void saveProject('autosave'); }, 1200);
    return () => window.clearTimeout(handle);
  }, [persistedRevision, projectRevision, saveProject, startupState]);

  return (
    <div className="app-shell">
      <TopToolbar />
      {startupNotice && (
        <div className={`startup-banner startup-banner-${startupNotice.type}`} role="status">
          <span>{startupNotice.message}</span>
          <button onClick={dismissStartupNotice}>Закрыть</button>
        </div>
      )}
      {startupState !== 'ready' ? (
        <div className="startup-fallback">
          <h2>Запуск редактора</h2>
          <p>Проверяем локальные данные и подготавливаем безопасный проект.</p>
        </div>
      ) : (
        <EditorErrorBoundary>
          <div className="workspace-grid">
            <ToolboxPanel />
            <CanvasEditor />
            <InspectorPanel />
          </div>
        </EditorErrorBoundary>
      )}
    </div>
  );
};

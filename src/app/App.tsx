import { useEffect } from 'react';
import { CanvasEditor } from '../features/editor/CanvasEditor';
import { TopToolbar } from '../features/editor/TopToolbar';
import { InspectorPanel } from '../features/inspector/InspectorPanel';
import { ToolboxPanel } from '../features/toolbox/ToolboxPanel';
import { useAppStore } from '../store/useAppStore';

export const App = () => {
  const loadProject = useAppStore((state) => state.loadProject);
  const saveProject = useAppStore((state) => state.saveProject);
  const project = useAppStore((state) => state.project);

  useEffect(() => { void loadProject(); }, [loadProject]);
  useEffect(() => {
    const handle = window.setTimeout(() => { void saveProject(); }, 1000);
    return () => window.clearTimeout(handle);
  }, [project, saveProject]);

  return (
    <div className="app-shell">
      <TopToolbar />
      <div className="workspace-grid">
        <ToolboxPanel />
        <CanvasEditor />
        <InspectorPanel />
      </div>
    </div>
  );
};

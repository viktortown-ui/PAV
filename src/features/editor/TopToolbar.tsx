import { useReactFlow } from 'reactflow';
import { useAppStore } from '../../store/useAppStore';

export const TopToolbar = () => {
  const rf = useReactFlow();
  const newProject = useAppStore((state) => state.newProject);
  const saveProject = useAppStore((state) => state.saveProject);
  const loadProject = useAppStore((state) => state.loadProject);
  const exportProject = useAppStore((state) => state.exportProject);
  const importProject = useAppStore((state) => state.importProject);
  const simulation = useAppStore((state) => state.project.simulation);
  const setSimulationRunning = useAppStore((state) => state.setSimulationRunning);
  const resetProject = useAppStore((state) => state.resetProject);

  const onExport = () => {
    const blob = new Blob([exportProject()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'soapflow-project.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <header className="top-toolbar">
      <div className="brand"><span>SoapFlow Studio</span><small>Process visualization builder</small></div>
      <div className="toolbar-actions">
        <button onClick={newProject}>Новый</button>
        <button onClick={() => void saveProject()}>Сохранить</button>
        <button onClick={() => void loadProject()}>Открыть</button>
        <button onClick={onExport}>Экспорт JSON</button>
        <label className="import-button">Импорт JSON<input type="file" accept="application/json" onChange={(e) => e.target.files?.[0]?.text().then(importProject)} hidden /></label>
        <button onClick={() => rf.fitView({ padding: 0.2 })}>Fit view</button>
        <button onClick={() => setSimulationRunning(!simulation.running)}>{simulation.running ? 'Пауза' : 'Пуск'}</button>
        <button onClick={resetProject}>Reset</button>
      </div>
    </header>
  );
};

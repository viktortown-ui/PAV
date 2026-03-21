import { useReactFlow } from 'reactflow';
import { useAppStore } from '../../store/useAppStore';

export const TopToolbar = () => {
  const rf = useReactFlow();
  const saveProject = useAppStore((state) => state.saveProject);
  const loadProject = useAppStore((state) => state.loadProject);
  const exportProject = useAppStore((state) => state.exportProject);
  const importProject = useAppStore((state) => state.importProject);
  const loadTemplate = useAppStore((state) => state.loadTemplate);
  const runValidation = useAppStore((state) => state.runValidation);
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
      <div className="brand"><span>SoapFlow Studio</span><small>Конструктор технологических схем и учебной симуляции</small></div>
      <div className="toolbar-actions">
        <button onClick={() => loadTemplate('water-prep')}>Шаблон воды</button>
        <button onClick={() => loadTemplate('soap-line')}>Шаблон ПАВ</button>
        <button onClick={() => loadTemplate('cip-fragment')}>Шаблон CIP</button>
        <button onClick={() => void saveProject()}>Сохранить</button>
        <button onClick={() => void loadProject()}>Открыть</button>
        <button onClick={onExport}>Экспорт JSON</button>
        <label className="import-button">Импорт JSON<input type="file" accept="application/json" onChange={(e) => e.target.files?.[0]?.text().then(importProject)} hidden /></label>
        <button onClick={() => rf.fitView({ padding: 0.22, duration: 500 })}>Вписать схему</button>
        <button onClick={runValidation}>Проверить</button>
        <button onClick={resetProject}>Сброс</button>
      </div>
    </header>
  );
};

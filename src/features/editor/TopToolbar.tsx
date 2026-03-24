import { useCallback } from 'react';
import { useReactFlow } from 'reactflow';
import { EdgeLabelMode } from '../../domain/schemas/types';
import { useAppStore } from '../../store/useAppStore';
import { edgeLabelModes } from '../inspector/schemas';

type TopToolbarProps = {
  focusMode: boolean;
  onToggleFocusMode: () => void;
  onOpenLibrary: () => void;
  onOpenCommandPalette: () => void;
};

export const TopToolbar = ({ focusMode, onToggleFocusMode, onOpenLibrary, onOpenCommandPalette }: TopToolbarProps) => {
  const rf = useReactFlow();
  const saveProject = useAppStore((state) => state.saveProject);
  const loadProject = useAppStore((state) => state.loadProject);
  const exportProject = useAppStore((state) => state.exportProject);
  const importProject = useAppStore((state) => state.importProject);
  const loadTemplate = useAppStore((state) => state.loadTemplate);
  const runValidation = useAppStore((state) => state.runValidation);
  const resetProject = useAppStore((state) => state.resetProject);
  const resetUserData = useAppStore((state) => state.resetUserData);
  const clearLocalDataAndLoadDemo = useAppStore((state) => state.clearLocalDataAndLoadDemo);
  const edgeLabelMode = useAppStore((state) => state.edgeLabelMode);
  const setEdgeLabelMode = useAppStore((state) => state.setEdgeLabelMode);
  const onExport = useCallback(() => { const blob = new Blob([exportProject()], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'pav-project.json'; link.click(); URL.revokeObjectURL(url); }, [exportProject]);

  return <header className="top-toolbar top-toolbar-refactor"><div className="brand brand-compact"><span>Конструктор техсхем</span><small>Редактор технологических схем для оператора и инженера.</small></div><div className="toolbar-clusters toolbar-clusters-compact"><div className="toolbar-group toolbar-group-quick"><button className="primary" onClick={onOpenCommandPalette}>Команды</button><button onClick={() => void rf.fitView({ padding: 0.22, duration: 250 })}>Схема</button><button className="primary" onClick={onOpenLibrary}>Библиотека</button><button onClick={onToggleFocusMode}>{focusMode ? 'Выйти из режима схемы' : 'Режим схемы'}</button></div><div className="toolbar-group toolbar-group-compact-actions"><details className="toolbar-menu"><summary>Файл</summary><div className="toolbar-menu-sheet"><button onClick={() => void loadProject()}>Открыть проект</button><button className="primary" onClick={() => void saveProject('manual')}>Сохранить</button><button onClick={onExport}>Экспорт JSON</button><label className="import-button">Импорт JSON<input type="file" accept="application/json" onChange={(e) => e.target.files?.[0]?.text().then(importProject)} hidden /></label></div></details><details className="toolbar-menu"><summary>Шаблоны</summary><div className="toolbar-menu-sheet"><button onClick={() => loadTemplate('water-prep')}>Водоподготовка</button><button onClick={() => loadTemplate('soap-line')}>Линия ПАВ</button><button onClick={() => loadTemplate('cip-fragment')}>CIP-контур</button></div></details><details className="toolbar-menu"><summary>Вид</summary><div className="toolbar-menu-sheet"><label className="toolbar-select"><span>Подписи линий</span><select value={edgeLabelMode} onChange={(e) => setEdgeLabelMode(e.target.value as EdgeLabelMode)}>{edgeLabelModes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select></label><button onClick={runValidation}>Проверить схему</button></div></details><details className="toolbar-menu"><summary>Сервис</summary><div className="toolbar-menu-sheet"><button onClick={() => void resetProject()}>Очистить схему</button><button onClick={() => void resetUserData()}>Очистить локальные данные</button><button onClick={() => void clearLocalDataAndLoadDemo()}>Восстановить демо-схему</button></div></details></div></div></header>;
};

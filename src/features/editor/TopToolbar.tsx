import { useCallback } from 'react';
import { useReactFlow } from 'reactflow';
import { EdgeLabelMode } from '../../domain/schemas/types';
import { useAppStore } from '../../store/useAppStore';
import { edgeLabelModes } from '../inspector/schemas';

export const TopToolbar = () => {
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
  const openEquipmentWizard = useAppStore((state) => state.openEquipmentWizard);
  const onExport = useCallback(() => { const blob = new Blob([exportProject()], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'pav-project.json'; link.click(); URL.revokeObjectURL(url); }, [exportProject]);

  return <header className="top-toolbar"><div className="brand"><span>Конструктор P&ID ПАВ</span><small>Русскоязычный инженерный редактор технологических схем</small></div><div className="toolbar-actions"><button onClick={() => openEquipmentWizard()}>Добавить оборудование</button><button onClick={() => loadTemplate('water-prep')}>Шаблон воды</button><button onClick={() => loadTemplate('soap-line')}>Шаблон ПАВ</button><button onClick={() => loadTemplate('cip-fragment')}>Шаблон CIP</button><button onClick={() => void saveProject('manual')}>Сохранить</button><button onClick={() => void loadProject()}>Открыть</button><button onClick={onExport}>Экспорт JSON</button><label className="import-button">Импорт JSON<input type="file" accept="application/json" onChange={(e) => e.target.files?.[0]?.text().then(importProject)} hidden /></label><label className="toolbar-select"><span>Подписи линий</span><select value={edgeLabelMode} onChange={(e) => setEdgeLabelMode(e.target.value as EdgeLabelMode)}>{edgeLabelModes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select></label><button onClick={() => void rf.fitView({ padding: 0.22, duration: 250 })}>Вписать схему</button><button onClick={runValidation}>Проверить</button><button onClick={() => void resetProject()}>Сбросить проект</button><button onClick={() => void resetUserData()}>Сбросить данные пользователя</button><button onClick={() => void clearLocalDataAndLoadDemo()}>Полный сброс версии</button></div></header>;
};

import { useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { BottomTab } from './selectionController';
import { getEquipmentCapability } from './equipmentCapabilityRegistry';

const tabs: Array<{ id: BottomTab; label: string }> = [
  { id: 'overview', label: 'Обзор' },
  { id: 'control', label: 'Управление' },
  { id: 'parameters', label: 'Параметры' },
  { id: 'diagnostics', label: 'Диагностика' },
  { id: 'connections', label: 'Связи' },
  { id: 'history', label: 'История' },
];

const stat = (status?: string) => ({
  running: 'Работает',
  blocked: 'Блокировка',
  alarm: 'Авария',
  maintenance: 'Сервис',
  standby: 'Готов',
  idle: 'Ожидание',
  off: 'Отключён',
}[status ?? 'idle'] ?? status ?? 'Ожидание');

export const BottomWorkbenchPanel = () => {
  const project = useAppStore((state) => state.project);
  const selectedNodeId = useAppStore((state) => state.selectedNodeId);
  const pathSelection = useAppStore((state) => state.pathSelection);
  const selectNode = useAppStore((state) => state.selectNode);
  const bottomWorkbench = useAppStore((state) => state.bottomWorkbench);
  const setBottomWorkbenchDock = useAppStore((state) => state.setBottomWorkbenchDock);
  const setBottomWorkbenchTab = useAppStore((state) => state.setBottomWorkbenchTab);
  const closeBottomWorkbench = useAppStore((state) => state.closeBottomWorkbench);

  const node = project.nodes.find((item) => item.id === selectedNodeId);
  const capability = node ? getEquipmentCapability(node.data.kind) : undefined;
  const history = useMemo(() => project.eventLog.slice(-10).reverse(), [project.eventLog]);

  if (!node || bottomWorkbench.dock === 'hidden') return null;

  const process = node.data.process as Record<string, string | number | boolean | undefined>;
  const parameterRows = Object.entries(process)
    .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
    .slice(0, 10);

  return (
    <section className={`bottom-workbench dock-${bottomWorkbench.dock}`} aria-label="Нижняя рабочая панель">
      <header className="bottom-workbench__header">
        <div>
          <strong>{node.data.visibleName}</strong>
          <small>{node.data.technicalTag} · {stat(node.data.status)}</small>
        </div>
        <div className="bottom-workbench__actions">
          {bottomWorkbench.dock === 'peek' ? <button type="button" onClick={() => setBottomWorkbenchDock('expanded')}>Развернуть</button> : null}
          {bottomWorkbench.dock === 'expanded' ? <button type="button" onClick={() => setBottomWorkbenchDock('peek')}>Свернуть</button> : null}
          <button type="button" onClick={() => closeBottomWorkbench()}>Закрыть</button>
        </div>
      </header>

      {bottomWorkbench.dock === 'peek' ? (
        <div className="bottom-workbench__peek">
          <span>Статус: <b>{stat(node.data.status)}</b></span>
          <div className="workbench-actions">
            {capability?.canStartStop ? <button type="button">Пуск/Стоп</button> : null}
            {capability?.canOpenClose ? <button type="button">Открыть/Закрыть</button> : null}
            {capability?.supportsAutoManual ? <button type="button">Авто/Ручной</button> : null}
          </div>
        </div>
      ) : (
        <>
          <div className="bottom-workbench__tabs" role="tablist" aria-label="Вкладки рабочей панели">
            {tabs.map((tab) => (
              <button key={tab.id} type="button" className={tab.id === bottomWorkbench.activeTab ? 'is-active' : ''} onClick={() => setBottomWorkbenchTab(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="bottom-workbench__grid">
            {bottomWorkbench.activeTab === 'overview' ? <article className="workbench-card"><h4>Обзор</h4><p>{node.data.description}</p></article> : null}
            {bottomWorkbench.activeTab === 'control' ? <article className="workbench-card"><h4>Управление</h4><div className="workbench-actions">{capability?.canStartStop ? <button type="button">Включить / Выключить</button> : null}{capability?.canOpenClose ? <button type="button">Открыть / Закрыть</button> : null}{capability?.supportsAutoManual ? <button type="button">Авто / Ручной</button> : null}<button type="button">Изолировать</button></div></article> : null}
            {bottomWorkbench.activeTab === 'parameters' ? <article className="workbench-card"><h4>Параметры</h4><div className="workbench-list">{parameterRows.map(([key, value]) => <div key={key} className="workbench-kv"><span>{key}</span><b>{String(value)}</b></div>)}</div></article> : null}
            {bottomWorkbench.activeTab === 'diagnostics' ? <article className="workbench-card"><h4>Диагностика</h4><ul>{(capability?.diagnostics ?? []).map((item) => <li key={item}>{item}</li>)}</ul></article> : null}
            {bottomWorkbench.activeTab === 'connections' ? <article className="workbench-card"><h4>Связи</h4><div className="workbench-kv"><span>Upstream</span><b>{pathSelection.upstream.length}</b></div><div className="workbench-kv"><span>Downstream</span><b>{pathSelection.downstream.length}</b></div><button type="button" onClick={() => pathSelection.upstream[0] && selectNode(pathSelection.upstream[0])}>Перейти к источнику</button></article> : null}
            {bottomWorkbench.activeTab === 'history' ? <article className="workbench-card"><h4>История</h4><div className="workbench-history">{history.map((event) => <div key={event.id}><span>{event.type}</span><small>{event.message}</small></div>)}</div></article> : null}
          </div>
        </>
      )}
    </section>
  );
};

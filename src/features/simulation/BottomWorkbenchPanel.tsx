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

export const BottomWorkbenchPanel = () => {
  const project = useAppStore((state) => state.project);
  const selectedNodeId = useAppStore((state) => state.selectedNodeId);
  const pathSelection = useAppStore((state) => state.pathSelection);
  const selectNode = useAppStore((state) => state.selectNode);

  const node = project.nodes.find((item) => item.id === selectedNodeId);
  const capability = node ? getEquipmentCapability(node.data.kind) : undefined;
  const history = useMemo(() => project.eventLog.slice(-10).reverse(), [project.eventLog]);

  if (!node) return null;

  const process = node.data.process as Record<string, string | number | boolean | undefined>;
  const parameterRows = Object.entries(process)
    .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
    .slice(0, 12);

  return (
    <section className="bottom-workbench" aria-label="Нижняя рабочая панель">
      <header className="bottom-workbench__header">
        <div>
          <strong>{node.data.visibleName}</strong>
          <small>{node.data.technicalTag} · {node.data.kind}</small>
        </div>
        <div className="bottom-workbench__tabs" role="tablist" aria-label="Вкладки рабочей панели">
          {tabs.map((tab) => <button key={tab.id} type="button" className={tab.id === 'overview' ? 'is-active' : ''}>{tab.label}</button>)}
        </div>
      </header>

      <div className="bottom-workbench__grid">
        <article className="workbench-card">
          <h4>Обзор</h4>
          <p>{node.data.description}</p>
          <div className="workbench-kv"><span>Статус</span><b>{node.data.status}</b></div>
          <div className="workbench-kv"><span>Режим</span><b>{node.data.mode}</b></div>
          <div className="workbench-kv"><span>Роль</span><b>{node.data.category}</b></div>
        </article>

        <article className="workbench-card">
          <h4>Управление</h4>
          <div className="workbench-actions">
            {capability?.canStartStop ? <button type="button">Включить / Выключить</button> : null}
            {capability?.canOpenClose ? <button type="button">Открыть / Закрыть</button> : null}
            {capability?.supportsAutoManual ? <button type="button">Авто / Ручной</button> : null}
            <button type="button">Разрешения / Блокировки</button>
          </div>
        </article>

        <article className="workbench-card">
          <h4>Параметры</h4>
          <div className="workbench-list">
            {parameterRows.map(([key, value]) => <div key={key} className="workbench-kv"><span>{key}</span><b>{String(value)}</b></div>)}
          </div>
        </article>

        <article className="workbench-card">
          <h4>Диагностика</h4>
          <ul>
            {(capability?.diagnostics ?? []).map((item) => <li key={item}>{item}</li>)}
          </ul>
        </article>

        <article className="workbench-card">
          <h4>Связи</h4>
          <div className="workbench-kv"><span>Upstream</span><b>{pathSelection.upstream.length}</b></div>
          <div className="workbench-kv"><span>Downstream</span><b>{pathSelection.downstream.length}</b></div>
          <button type="button" onClick={() => pathSelection.upstream[0] && selectNode(pathSelection.upstream[0])}>Перейти к источнику</button>
        </article>

        <article className="workbench-card">
          <h4>История</h4>
          <div className="workbench-history">
            {history.map((event) => <div key={event.id}><span>{event.type}</span><small>{event.message}</small></div>)}
          </div>
        </article>
      </div>
    </section>
  );
};

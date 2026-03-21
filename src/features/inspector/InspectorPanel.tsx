import { componentMap } from '../../domain/registry/componentRegistry';
import { InspectorTab, PropertyField } from '../../domain/schemas/types';
import { useAppStore } from '../../store/useAppStore';

const tabs: Array<[InspectorTab, string]> = [
  ['main', 'Основное'],
  ['process', 'Процесс'],
  ['ports', 'Порты'],
  ['signals', 'Сигналы'],
  ['appearance', 'Внешний вид'],
  ['alarms', 'Аварии'],
  ['simulation', 'Симуляция'],
];

const getValue = (node: any, field: PropertyField) => {
  if (field.key in node.data) return node.data[field.key];
  if (field.key in node.data.ports) return node.data.ports[field.key];
  if (field.key in node.data.visual) return node.data.visual[field.key];
  if (field.key === 'simEnabled') return node.data.simulation.enabled;
  if (field.key === 'simActive') return node.data.simulation.active;
  if (field.key === 'simFlow') return node.data.simulation.flow;
  if (field.key === 'alarmText') return node.data.simulation.alarmText ?? '';
  if (field.key === 'routeState') return node.data.simulation.routeState;
  if (field.key === 'medium') return node.data.medium;
  return node.data.process[field.key] ?? '';
};

export const InspectorPanel = () => {
  const selectedNodeId = useAppStore((state) => state.selectedNodeId);
  const selectedEdgeId = useAppStore((state) => state.selectedEdgeId);
  const project = useAppStore((state) => state.project);
  const inspectorTab = useAppStore((state) => state.inspectorTab);
  const setInspectorTab = useAppStore((state) => state.setInspectorTab);
  const updateNodeField = useAppStore((state) => state.updateNodeField);
  const issues = useAppStore((state) => state.issues);
  const node = project.nodes.find((item) => item.id === selectedNodeId);
  const edge = project.edges.find((item) => item.id === selectedEdgeId);

  if (!node && !edge) {
    return <aside className="panel inspector-panel"><div className="panel-title">Инспектор</div><p className="empty-state">Выберите оборудование или линию, чтобы увидеть параметры, маршрут и предупреждения.</p><div className="issue-list">{issues.slice(0, 6).map((issue) => <div key={issue.id} className={`issue-card severity-${issue.severity}`}>{issue.message}</div>)}</div></aside>;
  }

  if (edge) {
    return (
      <aside className="panel inspector-panel">
        <div className="panel-title">Инспектор линии</div>
        <div className="route-card">
          <strong>{edge.data?.sourceLabel} → {edge.data?.targetLabel}</strong>
          <span>Среда: {edge.data?.medium}</span>
          <span>Поток: {Math.round(Number(edge.data?.flowRate ?? 0))} л/мин</span>
          <span>Состояние: {edge.data?.routeState}</span>
          {edge.data?.blockedBy?.length ? <span>Блокеры: {edge.data.blockedBy.join(', ')}</span> : <span>Блокеров не обнаружено</span>}
        </div>
      </aside>
    );
  }

  const definition = componentMap.get(node!.data.kind) ?? componentMap.get('tank')!;
  const fields = definition.fields[inspectorTab];

  return (
    <aside className="panel inspector-panel">
      <div className="panel-title">Инспектор</div>
      <div className="inspector-head">
        <strong>{node!.data.label}</strong>
        <span>{node!.data.category} • {node!.data.simulation.routeState}</span>
      </div>
      <div className="tabs">
        {tabs.map(([id, label]) => <button key={id} className={inspectorTab === id ? 'is-active' : ''} onClick={() => setInspectorTab(id)}>{label}</button>)}
      </div>
      <div className="inspector-content">
        {fields.map((field) => {
          const value = getValue(node, field);
          return (
            <label key={field.key} className="field">
              <span>{field.label}</span>
              {field.type === 'textarea' ? <textarea value={String(value)} onChange={(e) => updateNodeField(node!.id, field.key, e.target.value)} />
                : field.type === 'toggle' ? <input type="checkbox" checked={Boolean(value)} onChange={(e) => updateNodeField(node!.id, field.key, e.target.checked)} />
                : field.type === 'select' ? <select value={String(value)} onChange={(e) => updateNodeField(node!.id, field.key, e.target.value)}>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                : <input type={field.type === 'number' ? 'number' : 'text'} value={String(value)} min={field.min} max={field.max} step={field.step} onChange={(e) => updateNodeField(node!.id, field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)} />}
            </label>
          );
        })}
        <div className="route-card">
          <strong>Краткая сводка</strong>
          <span>Среда: {node!.data.medium}</span>
          <span>Текущий уровень: {Math.round(Number(node!.data.process.level ?? 0))} л</span>
          <span>Активность: {node!.data.simulation.active ? 'активен' : 'ожидание'}</span>
          {node!.data.simulation.alarmText ? <span>Авария: {node!.data.simulation.alarmText}</span> : <span>Аварий нет</span>}
        </div>
      </div>
    </aside>
  );
};

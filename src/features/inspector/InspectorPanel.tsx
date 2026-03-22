import { componentMap } from '../../domain/registry/componentRegistry';
import { InspectorTab, PropertyField, SoapNode } from '../../domain/schemas/types';
import { useAppStore } from '../../store/useAppStore';

const tabs: Array<[InspectorTab, string]> = [['main', 'Основное'], ['process', 'Процесс'], ['ports', 'Порты'], ['signals', 'КИП'], ['appearance', 'Вид'], ['alarms', 'Арматура'], ['simulation', 'Симуляция']];
const ruMedium: Record<string, string> = { water: 'Вода', product: 'Продукт', cip: 'CIP', waste: 'Сток' };
const ruState: Record<string, string> = { idle: 'Ожидание', primed: 'Подготовлен', flowing: 'Поток', blocked: 'Блокировка', starved: 'Нет подпитки', draining: 'Слив', cip: 'CIP', alarm: 'Авария', offline: 'Отключён' };

const getValue = (node: SoapNode, field: PropertyField) => {
  if (field.key in node.data) return (node.data as any)[field.key];
  if (field.key in node.data.ports) return (node.data.ports as any)[field.key];
  if (field.key in node.data.visual) return (node.data.visual as any)[field.key];
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
  const insertNodeIntoEdge = useAppStore((state) => state.insertNodeIntoEdge);
  const createBranchFromEdge = useAppStore((state) => state.createBranchFromEdge);
  const removeSelectedSegment = useAppStore((state) => state.removeSelectedSegment);
  const reconnectSelectedEdge = useAppStore((state) => state.reconnectSelectedEdge);
  const node = project.nodes.find((item) => item.id === selectedNodeId);
  const edge = project.edges.find((item) => item.id === selectedEdgeId);

  if (!node && !edge) return <aside className="panel inspector-panel"><div className="panel-title">Инспектор</div><p className="empty-state">Выберите оборудование или сегмент трубопровода, чтобы управлять параметрами и инженерными действиями.</p><div className="issue-list">{issues.slice(0, 6).map((issue) => <div key={issue.id} className={`issue-card severity-${issue.severity}`}>{issue.message}</div>)}</div></aside>;

  if (edge) {
    const source = project.nodes.find((item) => item.id === edge.source);
    const target = project.nodes.find((item) => item.id === edge.target);
    return <aside className="panel inspector-panel"><div className="panel-title">Инспектор сегмента</div><div className="route-card"><strong>{source?.data.visibleName} → {target?.data.visibleName}</strong><span>Среда: {ruMedium[edge.data?.medium ?? 'water']}</span><span>Состояние: {ruState[edge.data?.routeState ?? 'idle']}</span><span>Расход: {Math.round(Number(edge.data?.flowRate ?? 0))} л/мин</span><span>Направление: {edge.data?.direction === 'reverse' ? 'Обратное' : edge.data?.direction === 'bidirectional' ? 'Двунаправленное' : 'Прямое'}</span><span>Диаметр условный: {edge.data?.nominalDiameter ?? 'DN50'}</span><span>Upstream объект: {source?.data.technicalTag ?? '—'}</span><span>Downstream объект: {target?.data.technicalTag ?? '—'}</span></div><div className="line-actions"><strong>Действия с линией</strong><div className="action-grid"><button onClick={() => insertNodeIntoEdge('shutoffValve')}>Вставить клапан</button><button onClick={() => insertNodeIntoEdge('gateValve')}>Вставить задвижку</button><button onClick={() => insertNodeIntoEdge('checkValve')}>Вставить обратный клапан</button><button onClick={() => insertNodeIntoEdge('flowMeter')}>Вставить расходомер</button><button onClick={() => insertNodeIntoEdge('pressureSensor')}>Вставить датчик</button><button onClick={() => insertNodeIntoEdge('pump')}>Вставить насос</button><button onClick={() => insertNodeIntoEdge('inlineFilter')}>Вставить фильтр</button><button onClick={() => insertNodeIntoEdge('tee')}>Вставить тройник</button><button onClick={() => insertNodeIntoEdge('cross')}>Вставить крестовину</button><button onClick={() => insertNodeIntoEdge('drainBranch')}>Вставить дренаж</button><button onClick={() => insertNodeIntoEdge('samplePoint')}>Вставить точку отбора</button><button onClick={() => createBranchFromEdge('tee')}>Сделать ответвление</button><button onClick={reconnectSelectedEdge}>Переподключить</button><button onClick={removeSelectedSegment}>Удалить сегмент</button></div></div></aside>;
  }

  const definition = componentMap.get(node!.data.kind);
  if (!definition) return null;
  const fields = definition.fields[inspectorTab];
  return <aside className="panel inspector-panel"><div className="panel-title">Инспектор</div><div className="inspector-head"><strong>{node!.data.visibleName}</strong><span>{node!.data.category} • {node!.data.technicalTag}</span></div><div className="tabs">{tabs.map(([id, label]) => <button key={id} className={inspectorTab === id ? 'is-active' : ''} onClick={() => setInspectorTab(id)}>{label}</button>)}</div><div className="inspector-content">{fields.map((field) => { const value = getValue(node!, field); return <label key={field.key} className="field"><span>{field.label}</span>{field.type === 'textarea' ? <textarea value={String(value)} onChange={(e) => updateNodeField(node!.id, field.key, e.target.value)} /> : field.type === 'toggle' ? <input type="checkbox" checked={Boolean(value)} onChange={(e) => updateNodeField(node!.id, field.key, e.target.checked)} /> : field.type === 'select' ? <select value={String(value)} onChange={(e) => updateNodeField(node!.id, field.key, e.target.value)}>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input type={field.type === 'number' ? 'number' : 'text'} value={String(value)} min={field.min} max={field.max} step={field.step} onChange={(e) => updateNodeField(node!.id, field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)} />}</label>; })}<div className="route-card"><strong>Техническая сводка</strong><span>Название: {node!.data.visibleName}</span><span>Тег: {node!.data.technicalTag}</span><span>Среда: {ruMedium[node!.data.medium]}</span><span>Уровень: {Math.round(Number(node!.data.process.level ?? 0))} л</span><span>Температура: {Math.round(Number(node!.data.process.temperature ?? 0))} °C</span><span>Активность: {node!.data.simulation.active ? 'Активен' : 'Ожидание'}</span><span>Аварии: {node!.data.simulation.alarmText || 'Нет'}</span></div></div></aside>;
};

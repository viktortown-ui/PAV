import { componentMap } from '../../domain/registry/componentRegistry';
import { EquipmentStatus, InspectorTab, PropertyField, SoapNode } from '../../domain/schemas/types';
import { EdgeActionKind, useAppStore } from '../../store/useAppStore';

const tabs: Array<[InspectorTab, string]> = [['main', 'Основное'], ['process', 'Процесс'], ['ports', 'Порты'], ['signals', 'КИП'], ['appearance', 'Вид'], ['alarms', 'Состояние'], ['simulation', 'Симуляция'], ['actions', 'Действия']];
const ruMedium: Record<string, string> = { water: 'Вода', product: 'Продукт', cip: 'CIP', waste: 'Сток' };
const ruState: Record<string, string> = { idle: 'Ожидание', primed: 'Подготовлен', flowing: 'Поток', blocked: 'Блокировка', starved: 'Нет подпитки', draining: 'Слив', cip: 'CIP', alarm: 'Авария', offline: 'Отключён' };
const ruStatus: Record<EquipmentStatus, string> = { off: 'Выключен', idle: 'Ожидание', standby: 'Готовность', running: 'Работает', blocked: 'Блокирован', alarm: 'Авария', maintenance: 'Ремонт', normal: 'Норма', active: 'Активен', warning: 'Предупреждение', disabled: 'Отключён' };
const edgeActionButtons: Array<{ label: string; action: EdgeActionKind }> = [
  { label: 'Вставить клапан', action: 'insert:shutoffValve' }, { label: 'Вставить задвижку', action: 'insert:gateValve' }, { label: 'Вставить обратный клапан', action: 'insert:checkValve' }, { label: 'Вставить расходомер', action: 'insert:flowMeter' }, { label: 'Вставить датчик', action: 'insert:pressureSensor' }, { label: 'Вставить насос', action: 'insert:pump' }, { label: 'Вставить фильтр', action: 'insert:inlineFilter' }, { label: 'Вставить тройник', action: 'insert:tee' }, { label: 'Вставить крестовину', action: 'insert:cross' }, { label: 'Вставить дренаж', action: 'insert:drainBranch' }, { label: 'Вставить точку отбора', action: 'insert:samplePoint' }, { label: 'Сделать ответвление', action: 'branch:tee' }, { label: 'Разорвать сегмент', action: 'break' }, { label: 'Переподключить', action: 'reconnect' }, { label: 'Удалить сегмент', action: 'delete' },
];

const getValue = (node: SoapNode, field: PropertyField) => {
  const data = node.data as any;
  if (field.key in data) return data[field.key];
  if (field.key in data.ports) return data.ports[field.key];
  if (field.key in data.visual) return data.visual[field.key];
  if (field.key in data.runtime) return data.runtime[field.key];
  return data.process[field.key] ?? '';
};

const nodeActions = (node: SoapNode) => {
  const kind = node.data.kind;
  if (kind === 'reactor' || kind === 'heatedReactor') return [
    ['Пуск', 'reactor:start'], ['Стоп', 'reactor:stop'], ['Нагрев вкл/выкл', 'reactor:toggleHeating'], ['Мешалка вкл/выкл', 'reactor:toggleAgitator'], ['Ожидание', 'reactor:setIdle'], ['Ремонт', 'reactor:setMaintenance'],
  ] as const;
  if (kind === 'pump' || kind === 'dosingPump') return [
    ['Пуск', 'pump:start'], ['Стоп', 'pump:stop'], ['Вкл/выкл', 'pump:toggleEnabled'], ['Авария', 'pump:setAlarm'], ['Сброс аварии', 'pump:clearAlarm'],
  ] as const;
  if (node.data.className === 'valve') return [
    ['Открыть', 'valve:open'], ['Закрыть', 'valve:close'], ['Ручной/авто', 'valve:toggleMode'], ['Сменить fail-position', 'valve:toggleFailPosition'],
  ] as const;
  if (kind === 'tank' || kind === 'bufferTank') return [
    ['Приём вкл/выкл', 'tank:toggleReceive'], ['Выдача вкл/выкл', 'tank:toggleDischarge'],
  ] as const;
  if (node.data.className === 'instrument') return [
    ['Предупреждение', 'sensor:simulateWarning'], ['Сброс', 'sensor:clearWarning'], ['Вкл/выкл', 'sensor:toggleEnabled'],
  ] as const;
  return [] as const;
};

export const InspectorPanel = () => {
  const selectedNodeId = useAppStore((state) => state.selectedNodeId);
  const selectedEdgeId = useAppStore((state) => state.selectedEdgeId);
  const project = useAppStore((state) => state.project);
  const inspectorTab = useAppStore((state) => state.inspectorTab);
  const setInspectorTab = useAppStore((state) => state.setInspectorTab);
  const updateNodeField = useAppStore((state) => state.updateNodeField);
  const updateEdgeField = useAppStore((state) => state.updateEdgeField);
  const executeNodeAction = useAppStore((state) => state.executeNodeAction);
  const issues = useAppStore((state) => state.issues);
  const executeEdgeAction = useAppStore((state) => state.executeEdgeAction);
  const node = project.nodes.find((item) => item.id === selectedNodeId);
  const edge = project.edges.find((item) => item.id === selectedEdgeId);

  if (!node && !edge) return <aside className="panel inspector-panel"><div className="panel-title">Инспектор</div><p className="empty-state">Выберите оборудование или сегмент трубопровода, чтобы управлять параметрами и инженерными действиями.</p><div className="issue-list">{issues.slice(0, 6).map((issue) => <div key={issue.id} className={`issue-card severity-${issue.severity}`}>{issue.message}</div>)}</div></aside>;

  if (edge) {
    const source = project.nodes.find((item) => item.id === edge.source);
    const target = project.nodes.find((item) => item.id === edge.target);
    return <aside className="panel inspector-panel"><div className="panel-title">Инспектор сегмента</div><div className="route-card"><strong>{source?.data.visibleName} → {target?.data.visibleName}</strong><label className="field"><span>Среда</span><select value={edge.data?.mediumType ?? 'water'} onChange={(e) => updateEdgeField(edge.id, 'mediumType', e.target.value)}><option value="water">Вода</option><option value="product">Продукт</option><option value="cip">CIP</option><option value="waste">Сток</option></select></label><label className="field"><span>Расход, л/мин</span><input type="number" value={edge.data?.flowLpm ?? 0} onChange={(e) => updateEdgeField(edge.id, 'flowLpm', Number(e.target.value))} /></label><label className="field"><span>Диаметр</span><input type="text" value={edge.data?.nominalDiameter ?? 'DN50'} onChange={(e) => updateEdgeField(edge.id, 'nominalDiameter', e.target.value)} /></label><label className="field"><span>Состояние</span><select value={edge.data?.routeState ?? 'idle'} onChange={(e) => updateEdgeField(edge.id, 'routeState', e.target.value)}>{Object.entries(ruState).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="field"><span>Upstream</span><input type="text" value={edge.data?.upstreamRef ?? source?.data.technicalTag ?? ''} onChange={(e) => updateEdgeField(edge.id, 'upstreamRef', e.target.value)} /></label><label className="field"><span>Downstream</span><input type="text" value={edge.data?.downstreamRef ?? target?.data.technicalTag ?? ''} onChange={(e) => updateEdgeField(edge.id, 'downstreamRef', e.target.value)} /></label></div><div className="line-actions"><strong>Действия с линией</strong><div className="action-grid">{edgeActionButtons.map((item) => <button key={item.action} onClick={() => executeEdgeAction(item.action, edge.id)}>{item.label}</button>)}</div></div></aside>;
  }

  const definition = componentMap.get(node!.data.kind);
  if (!definition) return null;
  const fields = definition.fields[inspectorTab] ?? [];
  const summaryLevel = Number((node!.data.process as any).currentLevelLiters ?? (node!.data.process as any).level ?? 0);
  const summaryTemp = Number((node!.data.process as any).temperatureC ?? (node!.data.process as any).temperature ?? 0);

  return <aside className="panel inspector-panel"><div className="panel-title">Инспектор</div><div className="inspector-head"><strong>{node!.data.visibleName}</strong><span>{node!.data.category} • {node!.data.technicalTag}</span></div><div className="tabs">{tabs.filter(([id]) => id === 'actions' ? nodeActions(node!).length > 0 : (definition.fields[id]?.length ?? 0) > 0).map(([id, label]) => <button key={id} className={inspectorTab === id ? 'is-active' : ''} onClick={() => setInspectorTab(id)}>{label}</button>)}</div><div className="inspector-content">{inspectorTab === 'actions' ? <div className="line-actions"><strong>Команды оборудования</strong><div className="action-grid">{nodeActions(node!).map(([label, action]) => <button key={action} onClick={() => executeNodeAction(node!.id, action)}>{label}</button>)}</div></div> : fields.map((field) => { const value = getValue(node!, field); return <label key={field.key} className="field"><span>{field.label}</span>{field.type === 'textarea' ? <textarea value={String(value)} onChange={(e) => updateNodeField(node!.id, field.key, e.target.value)} /> : field.type === 'toggle' ? <input type="checkbox" checked={Boolean(value)} onChange={(e) => updateNodeField(node!.id, field.key, e.target.checked)} /> : field.type === 'select' ? <select value={String(value)} onChange={(e) => updateNodeField(node!.id, field.key, e.target.value)}>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input type={field.type === 'number' ? 'number' : 'text'} value={String(value)} min={field.min} max={field.max} step={field.step} onChange={(e) => updateNodeField(node!.id, field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)} />}</label>; })}<div className="route-card"><strong>Техническая сводка</strong><span>Название: {node!.data.visibleName}</span><span>Тег: {node!.data.technicalTag}</span><span>Среда: {ruMedium[node!.data.mediumType]}</span><span>Уровень: {Math.round(summaryLevel)} л</span><span>Температура: {Math.round(summaryTemp)} °C</span><span>Статус: {ruStatus[node!.data.status]}</span><span>Режим: {node!.data.mode === 'auto' ? 'Авто' : 'Ручной'}</span><span>Сигнал/аварии: {node!.data.alarms.join(', ') || node!.data.runtime.alarmText || 'Нет'}</span></div></div></aside>;
};

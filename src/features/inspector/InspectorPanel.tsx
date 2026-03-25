import { componentMap } from '../../domain/registry/componentRegistry';
import { EquipmentStatus, EventLogEntry, PropertyField, SoapNode, ValidationIssue } from '../../domain/schemas/types';
import { EdgeActionKind, useAppStore } from '../../store/useAppStore';
import { createEdgeInspectorSchema, edgeInspectorFields } from './schemas';
import { buildSegmentList, summarizeDiagnostics } from '../editor/lineList';

const ruMedium: Record<string, string> = { water: 'Вода', product: 'Продукт', cip: 'СИП', waste: 'Сток', composite: 'Смесь' };
const ruState: Record<string, string> = { idle: 'Ожидание', primed: 'Подготовлен', flowing: 'Поток', blocked: 'Блокировка', starved: 'Нет подпитки', draining: 'Слив', cip: 'СИП', alarm: 'Авария', maintenance: 'Ремонт', offline: 'Отключён' };
const ruStatus: Record<EquipmentStatus, string> = { off: 'Выключен', idle: 'Ожидание', standby: 'Готовность', running: 'Работает', blocked: 'Блокирован', alarm: 'Авария', maintenance: 'Ремонт', normal: 'Норма', active: 'Активен', warning: 'Предупреждение', disabled: 'Отключён' };
const ruProcessState: Record<string, string> = { idle: 'Ожидание', waiting: 'Ожидание', transferring: 'Передача', blocked: 'Блокировка', running: 'Работает', fault: 'Авария', offline: 'Отключён' };
const ruEventType: Record<string, string> = { editor: 'Команда', simulation: 'Симуляция', physics: 'Физика', route: 'Маршрут', warning: 'Предупреждение', alarm: 'Авария', template: 'Шаблон' };

const edgeActionButtons: Array<{ label: string; action: EdgeActionKind; tone?: 'base' | 'danger' }> = [
  { label: 'Вставить клапан', action: 'insert:shutoffValve' },
  { label: 'Вставить задвижку', action: 'insert:gateValve' },
  { label: 'Вставить обратный клапан', action: 'insert:checkValve' },
  { label: 'Вставить расходомер', action: 'insert:flowMeter' },
  { label: 'Вставить датчик давления', action: 'insert:pressureSensor' },
  { label: 'Вставить насос', action: 'insert:pump' },
  { label: 'Вставить фильтр', action: 'insert:inlineFilter' },
  { label: 'Сделать ответвление', action: 'branch:tee' },
  { label: 'Разорвать сегмент', action: 'break', tone: 'danger' },
  { label: 'Удалить сегмент', action: 'delete', tone: 'danger' },
];

const getValue = (node: SoapNode, field: PropertyField) => {
  const data = node.data as any;
  if (field.key in data) return data[field.key];
  if (field.key in data.ports) return data.ports[field.key];
  if (field.key in data.visual) return data.visual[field.key];
  if (field.key in data.runtime) return data.runtime[field.key];
  return data.process[field.key] ?? '';
};

const issueTitle = (issue: ValidationIssue) => {
  if (issue.edgeIds?.length) return 'Линия';
  if (issue.nodeIds?.length) return 'Оборудование';
  return 'Проверка';
};

const statusTone = (status: string) => {
  if (status === 'running' || status === 'active') return 'ok';
  if (status === 'alarm') return 'alarm';
  if (status === 'blocked' || status === 'warning') return 'warn';
  return 'idle';
};

const formatTime = (timestamp: string) => new Date(timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' });

const DiagnosticsSection = () => {
  const project = useAppStore((state) => state.project);
  const issues = useAppStore((state) => state.issues);
  const selectNode = useAppStore((state) => state.selectNode);
  const selectEdge = useAppStore((state) => state.selectEdge);
  const summary = summarizeDiagnostics(issues);
  const segmentList = buildSegmentList(project, issues).slice(0, 7);

  return <div className="inspector-stack">
    <section className="route-card inspector-card">
      <strong>Диагностический обзор</strong>
      <div className="diagnostics-summary">
        <span><b>{summary.errors}</b> ошибок</span>
        <span><b>{summary.warnings}</b> предупреждений</span>
        <span><b>{summary.infos}</b> подсказок</span>
      </div>
      <div className="issue-list issue-list-detailed">
        {issues.slice(0, 6).map((issue) => (
          <button key={issue.id} type="button" className={`issue-card severity-${issue.severity}`} onClick={() => {
            if (issue.edgeIds?.[0]) selectEdge(issue.edgeIds[0]);
            else if (issue.nodeIds?.[0]) selectNode(issue.nodeIds[0]);
          }}>
            <strong>{issueTitle(issue)}</strong>
            <span>{issue.message}</span>
          </button>
        ))}
        {!issues.length ? <div className="issue-card severity-info"><strong>Проверка</strong><span>Критичных замечаний нет.</span></div> : null}
      </div>
    </section>

    <section className="route-card inspector-card">
      <strong>Линии схемы</strong>
      <div className="segment-list">
        {segmentList.map((segment) => (
          <button key={segment.edgeId} type="button" className={`segment-card severity-${segment.severity === 'ok' ? 'info' : segment.severity}`} onClick={() => selectEdge(segment.edgeId)}>
            <strong>{segment.lineTag}</strong>
            <span>{segment.sourceName} → {segment.targetName}</span>
            <span>{segment.mediumLabel} • {segment.nominalDiameter} • {segment.routeStateLabel}</span>
            <span>Замечаний: {segment.issueCount} • Предупреждений: {segment.warningCount}</span>
          </button>
        ))}
      </div>
    </section>
  </div>;
};

const buildNodeActions = (node: SoapNode) => {
  const process = node.data.process as any;
  const running = Boolean(process.isRunning ?? process.pumpOn ?? node.data.status === 'running');
  const intake = Boolean(process.allowIntake ?? process.canReceive ?? true);
  const discharge = Boolean(process.allowDischarge ?? process.canDischarge ?? true);
  const valveOpen = Boolean(process.isOpen ?? process.valveOpen ?? process.valveState !== 'closed');
  const autoMode = (process.valveMode ?? process.mode ?? node.data.mode) === 'auto';

  if (node.data.kind === 'reactor' || node.data.kind === 'heatedReactor') {
    return [
      { label: 'Пуск', action: 'reactor:start', active: running },
      { label: 'Стоп', action: 'reactor:stop', active: !running, tone: 'warn' as const },
      { label: 'Ожидание', action: 'reactor:setIdle', active: node.data.status === 'idle' },
      { label: 'Ремонт', action: 'reactor:setMaintenance', active: node.data.status === 'maintenance', tone: 'warn' as const },
    ];
  }

  if (node.data.kind === 'pump' || node.data.kind === 'dosingPump') {
    return [
      { label: 'Включить', action: 'pump:start', active: running },
      { label: 'Остановить', action: 'pump:stop', active: !running, tone: 'warn' as const },
      { label: 'Сброс тревоги', action: 'pump:clearAlarm', active: false },
    ];
  }

  if (node.data.className === 'valve') {
    return [
      { label: 'Открыть', action: 'valve:open', active: valveOpen },
      { label: 'Закрыть', action: 'valve:close', active: !valveOpen, tone: 'warn' as const },
      { label: 'Автомат', action: 'valve:auto', active: autoMode },
      { label: 'Ручной', action: 'valve:manual', active: !autoMode },
    ];
  }

  if (node.data.kind === 'tank' || node.data.kind === 'bufferTank') {
    return [
      { label: 'Приём разрешён', action: 'tank:enableReceive', active: intake },
      { label: 'Приём закрыт', action: 'tank:disableReceive', active: !intake, tone: 'warn' as const },
      { label: 'Выдача разрешена', action: 'tank:enableDischarge', active: discharge },
      { label: 'Выдача закрыта', action: 'tank:disableDischarge', active: !discharge, tone: 'warn' as const },
    ];
  }

  if (node.data.kind === 'fillingStation') {
    return [
      { label: 'Приём разрешён', action: 'station:enableIntake', active: intake },
      { label: 'Приём закрыт', action: 'station:disableIntake', active: !intake, tone: 'warn' as const },
    ];
  }

  if (node.data.className === 'instrument') {
    const enabled = Boolean(process.sensorEnabled ?? true);
    return [
      { label: 'Контроль включён', action: 'sensor:enable', active: enabled },
      { label: 'Контроль отключён', action: 'sensor:disable', active: !enabled, tone: 'warn' as const },
      { label: 'Сброс предупреждения', action: 'sensor:clearWarning', active: false },
    ];
  }

  return [];
};

const EventList = ({ events }: { events: EventLogEntry[] }) => (
  <section className="route-card inspector-card">
    <strong>События</strong>
    <div className="segment-list">
      {events.map((event) => (
        <div key={event.id} className={`issue-card severity-${event.severity}`}>
          <strong>{ruEventType[event.type] ?? 'Событие'}</strong>
          <span>{event.message}</span>
          <span>{formatTime(event.timestamp)}</span>
        </div>
      ))}
      {!events.length ? <div className="issue-card severity-info"><strong>События</strong><span>Записей пока нет.</span></div> : null}
    </div>
  </section>
);

export const InspectorPanel = ({ compact = false }: { compact?: boolean }) => {
  const selectedNodeId = useAppStore((state) => state.selectedNodeId);
  const selectedEdgeId = useAppStore((state) => state.selectedEdgeId);
  const project = useAppStore((state) => state.project);
  const updateNodeField = useAppStore((state) => state.updateNodeField);
  const updateEdgeField = useAppStore((state) => state.updateEdgeField);
  const executeNodeAction = useAppStore((state) => state.executeNodeAction);
  const issues = useAppStore((state) => state.issues);
  const executeEdgeAction = useAppStore((state) => state.executeEdgeAction);
  const node = project.nodes.find((item) => item.id === selectedNodeId);
  const edge = project.edges.find((item) => item.id === selectedEdgeId);

  if (!node && !edge) return <aside className={`panel inspector-panel ${compact ? 'is-compact' : ''}`}><div className="panel-title">Инспектор</div><p className="empty-state">Выберите оборудование или линию, чтобы увидеть управление, параметры и диагностику.</p><DiagnosticsSection /></aside>;

  if (edge) {
    const source = project.nodes.find((item) => item.id === edge.source);
    const target = project.nodes.find((item) => item.id === edge.target);
    const schema = createEdgeInspectorSchema(edge, { upstream: source?.data.technicalTag ?? '', downstream: target?.data.technicalTag ?? '' });
    const relatedIssues = issues.filter((issue) => issue.edgeIds?.includes(edge.id));
    const mediumName = ruMedium[schema.mediumType] ?? schema.mediumType;
    const lineTag = `ЛИНИЯ ${schema.upstreamRef || source?.data.technicalTag || 'A'} → ${schema.downstreamRef || target?.data.technicalTag || 'B'} · ${schema.nominalDiameter}`;
    const events = project.eventLog.filter((event) => event.targetId === edge.id).slice(-6).reverse();

    return <aside className={`panel inspector-panel ${compact ? 'is-compact' : ''}`}>
      <div className="panel-title">Инспектор линии</div>
      <section className="route-card inspector-card inspector-hero">
        <div className="inspector-hero-title">
          <strong>{lineTag}</strong>
          <span>{source?.data.visibleName} → {target?.data.visibleName}</span>
        </div>
        <div className="status-pill-row">
          <span className={`status-pill tone-${statusTone(schema.routeState)}`}>{ruState[schema.routeState] ?? schema.routeState}</span>
          <span className="status-pill">{mediumName}</span>
          <span className="status-pill">{schema.lineRole === 'CIP' ? 'СИП' : schema.lineRole}</span>
        </div>
      </section>

      <section className="route-card inspector-card">
        <strong>Паспорт линии</strong>
        {edgeInspectorFields.map((field) => <label key={field.key} className="field">
          <span>{field.label}</span>
          {field.type === 'number'
            ? <input type="number" value={schema[field.key]} onChange={(e) => updateEdgeField(edge.id, field.key, Number(e.target.value))} />
            : field.type === 'select'
              ? <select value={String(schema[field.key])} onChange={(e) => updateEdgeField(edge.id, field.key, e.target.value)}>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
              : <input type="text" value={String(schema[field.key])} onChange={(e) => updateEdgeField(edge.id, field.key, e.target.value)} />}
        </label>)}
        <details className="service-details"><summary>Служебные данные</summary><span>Внутренний идентификатор: {edge.id}</span><span>Идентификатор сегмента: {edge.data?.segmentId ?? 'не задан'}</span></details>
      </section>

      <section className="route-card inspector-card">
        <strong>Действия с линией</strong>
        <div className="control-group">
          {edgeActionButtons.map((item) => <button key={item.action} className={`control-button ${item.tone === 'danger' ? 'is-danger' : ''}`} onClick={() => executeEdgeAction(item.action, edge.id)}>{item.label}</button>)}
        </div>
      </section>

      <section className="route-card inspector-card">
        <strong>Диагностика линии</strong>
        {relatedIssues.length ? relatedIssues.map((issue) => <div key={issue.id} className={`issue-card severity-${issue.severity}`}><strong>{issueTitle(issue)}</strong><span>{issue.message}</span></div>) : <div className="issue-card severity-info"><strong>Проверка</strong><span>Для выбранной линии критичных замечаний нет.</span></div>}
      </section>

      <EventList events={events} />
    </aside>;
  }

  const definition = componentMap.get(node!.data.kind);
  if (!definition) return null;
  const fields = [...(definition.fields.main ?? []), ...(definition.fields.process ?? [])];
  const process = node!.data.process as any;
  const summaryLevel = Number(process.currentLevelLiters ?? process.level ?? 0);
  const summaryTemp = Number(process.temperatureC ?? process.temperature ?? 0);
  const summaryFlow = Number(node!.data.simulation.flowLpm ?? process.actualFlowLpm ?? process.flowRate ?? 0);
  const pressure = Number(process.pressureBar ?? process.pressure ?? 0);
  const viscosity = Number(process.dynamicViscosityPaS ?? project.simulation.fluid.dynamicViscosityPaS ?? 0);
  const density = Number(process.densityKgPerM3 ?? project.simulation.fluid.densityKgPerM3 ?? 0);
  const commandIntake = Boolean(process.allowIntake ?? process.canReceive ?? true);
  const commandDischarge = Boolean(process.allowDischarge ?? process.canDischarge ?? true);
  const commandRunning = Boolean(process.isRunning ?? process.pumpOn ?? node!.data.status === 'running');
  const commandBlocked = Boolean(process.isBlocked ?? false);
  const processState = String(process.processState ?? 'idle');
  const statusReason = String(node!.data.runtime.alarmText ?? node!.data.runtime.lastEvent ?? '').trim();
  const actions = buildNodeActions(node!);
  const events = project.eventLog.filter((event) => event.targetId === node!.id).slice(-8).reverse();

  return <aside className={`panel inspector-panel ${compact ? 'is-compact' : ''}`}>
    <div className="panel-title">Инспектор оборудования</div>

    <section className="route-card inspector-card inspector-hero">
      <div className="inspector-hero-title">
        <strong>{node!.data.visibleName}</strong>
        <span>{node!.data.category} • {node!.data.technicalTag}</span>
      </div>
      <div className="status-pill-row">
        <span className={`status-pill tone-${statusTone(node!.data.status)}`}>{ruStatus[node!.data.status]}</span>
        <span className="status-pill">{node!.data.mode === 'auto' ? 'Автомат' : 'Ручной'}</span>
        <span className="status-pill">{ruMedium[node!.data.mediumType]}</span>
      </div>
      <div className="kpi-grid">
        <div><span>Поток</span><strong>{summaryFlow.toFixed(1)} л/мин</strong></div>
        <div className={summaryTemp >= 80 ? 'is-alert' : ''}><span>Температура</span><strong>{summaryTemp.toFixed(1)} °C</strong></div>
        <div><span>Уровень</span><strong>{Math.round(summaryLevel)} л</strong></div>
        <div><span>Давление</span><strong>{pressure.toFixed(2)} бар</strong></div>
      </div>
    </section>

    <section className="route-card inspector-card">
      <strong>Панель управления</strong>
      <div className="control-group">
        {actions.map((item) => <button key={item.action} className={`control-button ${item.active ? 'is-active' : ''} ${item.tone === 'warn' ? 'is-warning' : ''}`} onClick={() => executeNodeAction(node!.id, item.action)}>{item.label}</button>)}
      </div>
    </section>

    <section className="route-card inspector-card">
      <strong>Живые параметры</strong>
      <div className="live-grid">
        <span>Режим процесса: <b>{ruProcessState[processState] ?? processState}</b></span>
        <span>Командный статус: <b>приём {commandIntake ? 'разрешён' : 'закрыт'} • выдача {commandDischarge ? 'разрешена' : 'закрыта'} • привод {commandRunning ? 'включён' : 'остановлен'} • блок {commandBlocked ? 'да' : 'нет'}</b></span>
        <span>Статус потока: <b>{summaryFlow > 0.001 ? 'Поток есть' : 'Поток отсутствует'}</b></span>
        <span>Причина: <b>{statusReason || 'Ограничений нет'}</b></span>
      </div>
    </section>

    <section className="route-card inspector-card">
      <strong>Диагностический блок</strong>
      <div className="gauge-grid">
        <div className="gauge"><span>Термометр</span><div className="gauge-track"><i style={{ width: `${Math.max(0, Math.min(100, summaryTemp))}%` }} /></div><small>{summaryTemp.toFixed(1)} °C</small></div>
        <div className="gauge"><span>Манометр</span><div className="gauge-track"><i style={{ width: `${Math.max(0, Math.min(100, pressure * 10))}%` }} /></div><small>{pressure.toFixed(2)} бар</small></div>
        <div className="gauge"><span>Расходомер</span><div className="gauge-track"><i style={{ width: `${Math.max(0, Math.min(100, summaryFlow))}%` }} /></div><small>{summaryFlow.toFixed(1)} л/мин</small></div>
        <div className="gauge"><span>Вязкость</span><div className="gauge-track"><i style={{ width: `${Math.max(0, Math.min(100, viscosity * 10000))}%` }} /></div><small>{viscosity.toFixed(4)} Па·с</small></div>
        <div className="gauge"><span>Плотность</span><div className="gauge-track"><i style={{ width: `${Math.max(0, Math.min(100, density / 15))}%` }} /></div><small>{Math.round(density)} кг/м³</small></div>
        <div className="gauge"><span>Уровень</span><div className="gauge-track"><i style={{ width: `${Math.max(0, Math.min(100, Number(process.levelPercent ?? 0)))}%` }} /></div><small>{Math.round(Number(process.levelPercent ?? 0))} %</small></div>
      </div>
      {!!issues.filter((issue) => issue.nodeIds?.includes(node!.id)).length && <div className="issue-list issue-list-detailed">
        {issues.filter((issue) => issue.nodeIds?.includes(node!.id)).slice(0, 4).map((issue) => <div key={issue.id} className={`issue-card severity-${issue.severity}`}><strong>{issueTitle(issue)}</strong><span>{issue.message}</span></div>)}
      </div>}
    </section>

    <section className="route-card inspector-card">
      <strong>Паспорт оборудования</strong>
      {fields.map((field) => {
        const value = getValue(node!, field);
        return <label key={field.key} className="field">
          <span>{field.label}</span>
          {field.type === 'textarea' ? <textarea value={String(value)} onChange={(e) => updateNodeField(node!.id, field.key, e.target.value)} />
            : field.type === 'toggle' ? <input type="checkbox" checked={Boolean(value)} onChange={(e) => updateNodeField(node!.id, field.key, e.target.checked)} />
              : field.type === 'select' ? <select value={String(value)} onChange={(e) => updateNodeField(node!.id, field.key, e.target.value)}>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                : <input type={field.type === 'number' ? 'number' : 'text'} value={String(value)} min={field.min} max={field.max} step={field.step} onChange={(e) => updateNodeField(node!.id, field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)} />}
        </label>;
      })}
      <details className="service-details"><summary>Служебные данные</summary><span>Внутренний идентификатор: {node!.id}</span><span>Ревизия: {node!.data.revision}</span></details>
    </section>

    <EventList events={events} />
  </aside>;
};

import { componentMap } from '../../domain/registry/componentRegistry';
import { EquipmentStatus, EventLogEntry, PropertyField, SoapNode, ValidationIssue } from '../../domain/schemas/types';
import { EdgeActionKind, useAppStore } from '../../store/useAppStore';
import { createEdgeInspectorSchema, edgeInspectorFields } from './schemas';
import { buildSegmentList, summarizeDiagnostics } from '../editor/lineList';
import { compactEvents, formatEventTime, formatSmartNumber } from './presentation';
import { getAvailableSymbolVariants } from '../editor/schematicSymbols';

const ruMedium: Record<string, string> = { water: 'Вода', product: 'Продукт', cip: 'СИП', waste: 'Сток', composite: 'Смесь' };
const ruState: Record<string, string> = { idle: 'Ожидание', primed: 'Подготовлен', flowing: 'Поток', blocked: 'Блокировка', starved: 'Нет подпитки', draining: 'Слив', cip: 'СИП', alarm: 'Авария', maintenance: 'Ремонт', offline: 'Отключён' };
const ruStatus: Record<EquipmentStatus, string> = { off: 'Выключен', idle: 'Ожидание', standby: 'Готовность', running: 'Работает', blocked: 'Блокирован', alarm: 'Авария', maintenance: 'Ремонт', normal: 'Норма', active: 'Активен', warning: 'Предупреждение', disabled: 'Отключён' };
const ruProcessState: Record<string, string> = { idle: 'Ожидание', waiting: 'Ожидание', transferring: 'Передача', blocked: 'Блокировка', running: 'Работает', fault: 'Авария', offline: 'Отключён' };

const edgeActionButtons: Array<{ label: string; action: EdgeActionKind; tone?: 'base' | 'danger' }> = [
  { label: 'Вставить клапан', action: 'insert:shutoffValve' },
  { label: 'Вставить задвижку', action: 'insert:gateValve' },
  { label: 'Вставить обратный клапан', action: 'insert:checkValve' },
  { label: 'Вставить расходомер', action: 'insert:flowMeter' },
  { label: 'Вставить датчик давления', action: 'insert:pressureSensor' },
  { label: 'Вставить насос', action: 'insert:pump' },
  { label: 'Вставить фильтр', action: 'insert:inlineFilter' },
  { label: 'Сделать ответвление', action: 'branch:tee' },
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

type DiagnosticBand = {
  min: number;
  max: number;
  state: 'Норма' | 'Риск' | 'Тревога';
};

const clampPercent = (value: number, min: number, max: number) => {
  if (max <= min) return 0;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
};

const resolveBand = (value: number, bands: DiagnosticBand[]) => bands.find((band) => value >= band.min && value <= band.max) ?? bands[bands.length - 1];
const bandTone = (band: DiagnosticBand['state']) => band === 'Норма' ? 'ok' : band === 'Риск' ? 'warn' : 'alarm';

const pressureBands: DiagnosticBand[] = [
  { min: 0, max: 1.7, state: 'Норма' },
  { min: 1.7, max: 2.8, state: 'Риск' },
  { min: 2.8, max: 4, state: 'Тревога' },
];

const temperatureBands: DiagnosticBand[] = [
  { min: 0, max: 70, state: 'Норма' },
  { min: 70, max: 85, state: 'Риск' },
  { min: 85, max: 100, state: 'Тревога' },
];

const flowBands: DiagnosticBand[] = [
  { min: 0, max: 0.1, state: 'Риск' },
  { min: 0.1, max: 60, state: 'Норма' },
  { min: 60, max: 100, state: 'Тревога' },
];

const levelBands: DiagnosticBand[] = [
  { min: 0, max: 15, state: 'Риск' },
  { min: 15, max: 90, state: 'Норма' },
  { min: 90, max: 100, state: 'Тревога' },
];

const readableState = (state: string) => ruProcessState[state] ?? state;

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
  type ActionSpec = { label: string; action: string; active: boolean; tone?: 'warn'; disabled?: boolean };
  const process = node.data.process as any;
  const running = Boolean(process.isRunning ?? process.pumpOn ?? node.data.status === 'running');
  const intake = Boolean(process.allowIntake ?? process.canReceive ?? true);
  const discharge = Boolean(process.allowDischarge ?? process.canDischarge ?? true);
  const valveOpen = Boolean(process.isOpen ?? process.valveOpen ?? process.valveState !== 'closed');
  const autoMode = (process.valveMode ?? process.mode ?? node.data.mode) === 'auto';

  if (node.data.kind === 'reactor' || node.data.kind === 'heatedReactor') {
    return [
      { label: 'Пуск', action: 'reactor:start', active: running, disabled: running },
      { label: 'Стоп', action: 'reactor:stop', active: !running, tone: 'warn' as const, disabled: !running },
      { label: 'Ожидание', action: 'reactor:setIdle', active: node.data.status === 'idle', disabled: node.data.status === 'idle' },
      { label: 'Ремонт', action: 'reactor:setMaintenance', active: node.data.status === 'maintenance', tone: 'warn' as const, disabled: node.data.status === 'maintenance' },
    ] as ActionSpec[];
  }

  if (node.data.kind === 'pump' || node.data.kind === 'dosingPump') {
    const hasAlarm = Boolean(node.data.alarms?.length || node.data.runtime.alarmText || node.data.simulation.alarmText);
    return [
      { label: 'Включить', action: 'pump:start', active: running, disabled: running },
      { label: 'Остановить', action: 'pump:stop', active: !running, tone: 'warn' as const, disabled: !running },
      { label: 'Сброс тревоги', action: 'pump:clearAlarm', active: false, disabled: !hasAlarm },
    ] as ActionSpec[];
  }

  if (node.data.className === 'valve') {
    return [
      { label: 'Открыть', action: 'valve:open', active: valveOpen, disabled: valveOpen },
      { label: 'Закрыть', action: 'valve:close', active: !valveOpen, tone: 'warn' as const, disabled: !valveOpen },
      { label: 'Автомат', action: 'valve:auto', active: autoMode, disabled: autoMode },
      { label: 'Ручной', action: 'valve:manual', active: !autoMode, disabled: !autoMode },
    ] as ActionSpec[];
  }

  if (node.data.kind === 'tank' || node.data.kind === 'bufferTank') {
    return [
      { label: 'Приём разрешён', action: 'tank:enableReceive', active: intake, disabled: intake },
      { label: 'Приём закрыт', action: 'tank:disableReceive', active: !intake, tone: 'warn' as const, disabled: !intake },
      { label: 'Выдача разрешена', action: 'tank:enableDischarge', active: discharge, disabled: discharge },
      { label: 'Выдача закрыта', action: 'tank:disableDischarge', active: !discharge, tone: 'warn' as const, disabled: !discharge },
    ] as ActionSpec[];
  }

  if (node.data.kind === 'fillingStation') {
    return [
      { label: 'Приём разрешён', action: 'station:enableIntake', active: intake, disabled: intake },
      { label: 'Приём закрыт', action: 'station:disableIntake', active: !intake, tone: 'warn' as const, disabled: !intake },
    ] as ActionSpec[];
  }

  if (node.data.className === 'instrument') {
    const enabled = Boolean(process.sensorEnabled ?? true);
    const hasAlarm = Boolean(node.data.alarms?.length || node.data.runtime.alarmText || node.data.simulation.alarmText);
    return [
      { label: 'Контроль включён', action: 'sensor:enable', active: enabled, disabled: enabled },
      { label: 'Контроль отключён', action: 'sensor:disable', active: !enabled, tone: 'warn' as const, disabled: !enabled },
      { label: 'Сброс предупреждения', action: 'sensor:clearWarning', active: false, disabled: !hasAlarm },
    ] as ActionSpec[];
  }

  return [];
};

const EventList = ({ events }: { events: EventLogEntry[] }) => {
  const normalized = compactEvents(events);
  return (
  <section className="route-card inspector-card">
    <strong>События</strong>
    <div className="segment-list">
      {normalized.map((event) => {
        return <div key={event.id} className={`issue-card severity-${event.severity}`}>
          <strong>{event.uiType}</strong>
          <span>{event.uiMessage}</span>
          <small>{formatEventTime(event.timestamp)}</small>
        </div>;
      })}
      {!normalized.length ? <div className="issue-card severity-info"><strong>События</strong><span>Записей пока нет.</span></div> : null}
    </div>
  </section>
);
};

const liveRows = (params: {
  processState: string;
  commandIntake: boolean;
  commandDischarge: boolean;
  commandRunning: boolean;
  commandBlocked: boolean;
  summaryFlow: number;
  statusReason: string;
  mediumType: string;
  routeDirection?: string;
  routeState?: string;
}) => {
  const commandSummary = [
    `приём ${params.commandIntake ? 'разрешён' : 'закрыт'}`,
    `выдача ${params.commandDischarge ? 'разрешена' : 'закрыта'}`,
    `привод ${params.commandRunning ? 'включён' : 'остановлен'}`,
  ].join(' • ');

  return [
    { label: 'Режим', value: readableState(params.processState) },
    { label: 'Командный статус', value: commandSummary },
    { label: 'Фактический статус', value: params.summaryFlow > 0.001 ? 'Поток есть' : 'Потока нет' },
    { label: 'Поток', value: `${formatSmartNumber(params.summaryFlow, 1)} л/мин` },
    { label: 'Причина', value: params.statusReason || (params.commandBlocked ? 'Узел заблокирован командой' : 'Ограничений не обнаружено') },
    { label: 'Активное ограничение', value: params.commandBlocked ? 'Блокировка включена' : 'Нет активных блокировок' },
    { label: 'Среда', value: ruMedium[params.mediumType] ?? params.mediumType },
    ...(params.routeDirection ? [{ label: 'Маршрут', value: params.routeDirection }] : []),
    ...(params.routeState ? [{ label: 'Состояние маршрута', value: params.routeState }] : []),
  ];
};

export const InspectorPanel = ({ compact = false }: { compact?: boolean }) => {
  const selectedNodeId = useAppStore((state) => state.selectedNodeId);
  const selectedEdgeId = useAppStore((state) => state.selectedEdgeId);
  const selectedMeasurementPointId = useAppStore((state) => state.selectedMeasurementPointId);
  const project = useAppStore((state) => state.project);
  const updateNodeField = useAppStore((state) => state.updateNodeField);
  const updateEdgeField = useAppStore((state) => state.updateEdgeField);
  const updateMeasurementPoint = useAppStore((state) => state.updateMeasurementPoint);
  const presentationMode = useAppStore((state) => state.project.view.presentationMode);
  const deleteMeasurementPoint = useAppStore((state) => state.deleteMeasurementPoint);
  const executeNodeAction = useAppStore((state) => state.executeNodeAction);
  const issues = useAppStore((state) => state.issues);
  const executeEdgeAction = useAppStore((state) => state.executeEdgeAction);
  const node = project.nodes.find((item) => item.id === selectedNodeId);
  const edge = project.edges.find((item) => item.id === selectedEdgeId);
  const measurementPoint = project.measurementPoints.find((item) => item.id === selectedMeasurementPointId);

  if (!node && !edge && !measurementPoint) return <aside className={`panel inspector-panel ${compact ? 'is-compact' : ''}`}><div className="panel-title">Инспектор</div><p className="empty-state">Выберите оборудование, линию или точку измерения.</p><DiagnosticsSection /></aside>;

  if (measurementPoint) {
    const edgeRef = measurementPoint.anchor.edgeId ? project.edges.find((item) => item.id === measurementPoint.anchor.edgeId) : undefined;
    const nodeRef = measurementPoint.anchor.nodeId ? project.nodes.find((item) => item.id === measurementPoint.anchor.nodeId) : undefined;
    const process = nodeRef?.data.process as Record<string, number | string | boolean> | undefined;
    const pressure = edgeRef?.data?.pressure ?? (typeof process?.pressureBar === 'number' ? process.pressureBar : undefined);
    const temperature = typeof process?.temperatureC === 'number' ? process.temperatureC : undefined;
    const flow = edgeRef?.data?.flowLpm ?? edgeRef?.data?.flowRate ?? nodeRef?.data.runtime.flowLpm;
    const velocity = edgeRef?.data?.velocityMPerS;
    const medium = edgeRef?.data?.medium ?? nodeRef?.data.medium;
    const anchorText = nodeRef ? `Узел: ${nodeRef.data.visibleName}` : edgeRef ? `Линия: ${edgeRef.data?.sourceLabel ?? edgeRef.source} → ${edgeRef.data?.targetLabel ?? edgeRef.target}` : 'Свободная точка';
    return <aside className={`panel inspector-panel ${compact ? 'is-compact' : ''}`}>
      <div className="panel-title">Измерительная точка</div>
      <section className="route-card inspector-card">
        <strong>{measurementPoint.type === 'pressure' ? 'Манометр' : measurementPoint.type === 'temperature' ? 'Термометр' : measurementPoint.type === 'flow' ? 'Расходомер' : 'Универсальная контрольная точка'}</strong>
        <span>{anchorText}</span>
      </section>
      <section className="route-card inspector-card">
        <strong>Паспорт точки</strong>
        <label className="field"><span>Короткий тег</span><input type="text" value={measurementPoint.shortTag} onChange={(e) => updateMeasurementPoint(measurementPoint.id, { shortTag: e.target.value })} /></label>
        <label className="field"><span>Название</span><input type="text" value={measurementPoint.label ?? ''} onChange={(e) => updateMeasurementPoint(measurementPoint.id, { label: e.target.value })} /></label>
        <label className="field"><span>Включена</span><input type="checkbox" checked={measurementPoint.enabled} onChange={(e) => updateMeasurementPoint(measurementPoint.id, { enabled: e.target.checked })} /></label>
        <label className="field"><span>Видимая</span><input type="checkbox" checked={measurementPoint.visible} onChange={(e) => updateMeasurementPoint(measurementPoint.id, { visible: e.target.checked })} /></label>
        <button className="control-button is-danger" onClick={() => deleteMeasurementPoint(measurementPoint.id)}>Удалить точку</button>
      </section>
      <section className="route-card inspector-card">
        <strong>Текущие показания</strong>
        <div className="issue-list issue-list-detailed">
          <div className="issue-card severity-info"><strong>Давление</strong><span>{pressure != null ? `${formatSmartNumber(Number(pressure), 2)} бар` : 'Нет расчёта'}</span></div>
          <div className="issue-card severity-info"><strong>Температура</strong><span>{temperature != null ? `${formatSmartNumber(Number(temperature), 1)} °C` : 'Нет расчёта'}</span></div>
          <div className="issue-card severity-info"><strong>Расход</strong><span>{flow != null ? `${formatSmartNumber(Number(flow), 1)} л/мин` : 'Нет расчёта'}</span></div>
          {measurementPoint.type === 'probe' ? <>
            <div className="issue-card severity-info"><strong>Скорость</strong><span>{velocity != null ? `${formatSmartNumber(Number(velocity), 2)} м/с` : 'Пока не рассчитывается'}</span></div>
            <div className="issue-card severity-info"><strong>Среда</strong><span>{medium ? (ruMedium[medium] ?? medium) : 'Нет данных'}</span></div>
          </> : null}
        </div>
      </section>
    </aside>;
  }

  if (edge) {
    const source = project.nodes.find((item) => item.id === edge.source);
    const target = project.nodes.find((item) => item.id === edge.target);
    const schema = createEdgeInspectorSchema(edge, { upstream: source?.data.technicalTag ?? '', downstream: target?.data.technicalTag ?? '' });
    const relatedIssues = issues.filter((issue) => issue.edgeIds?.includes(edge.id));
    const mediumName = ruMedium[schema.mediumType] ?? schema.mediumType;
    const lineTag = `ЛИНИЯ ${schema.upstreamRef || source?.data.technicalTag || 'A'} → ${schema.downstreamRef || target?.data.technicalTag || 'B'} · ${schema.nominalDiameter}`;
    const events = project.eventLog.filter((event) => event.targetId === edge.id).slice(-6).reverse();
    const edgeFlow = Number(edge.data?.flowLpm ?? edge.data?.flowRate ?? 0);
    const edgeVelocity = Number(edge.data?.velocityMPerS ?? 0);
    const edgeLoss = Number(edge.data?.hydraulicLossBar ?? edge.data?.pressure ?? 0);
    const hydraulicConstraint = String(edge.data?.hydraulicConstraint ?? '').trim();
    const routeStateLabel = ruState[schema.routeState] ?? schema.routeState;
    const stopReason = edge.data?.blockedBy?.length
      ? `Поток остановлен: ${edge.data?.blockedBy?.join(', ')}.`
      : schema.routeState === 'blocked'
        ? 'Поток остановлен: маршрут сейчас заблокирован.'
        : edgeFlow <= 0.01
          ? 'Поток отсутствует: нет перепада или активной подачи.'
          : 'Поток идёт без блокировок.';
    const routeRef = `${schema.upstreamRef || source?.data.shortName || source?.data.visibleName} → ${schema.downstreamRef || target?.data.shortName || target?.data.visibleName}`;

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
        <span className="panel-caption">Показывает совместимость сегмента, блокировки маршрута и причины отсутствия потока.</span>
        <div className="issue-list issue-list-detailed">
          <div className={`issue-card severity-${relatedIssues.length ? 'warning' : 'info'}`}>
            <strong>Совместимость сегмента: {relatedIssues.length ? 'риск' : 'норма'}</strong>
            <span>{relatedIssues.length ? 'Есть замечания по валидации линии или связанного узла.' : 'Диаметр, направление и тип среды согласованы с текущим маршрутом.'}</span>
          </div>
          <div className={`issue-card severity-${schema.routeState === 'blocked' ? 'warning' : 'info'}`}>
            <strong>Состояние маршрута: {routeStateLabel}</strong>
            <span>{stopReason}</span>
          </div>
          <div className={`issue-card severity-${edgeFlow <= 0.01 ? 'warning' : 'info'}`}>
            <strong>Наличие потока: {edgeFlow <= 0.01 ? 'нет' : 'есть'}</strong>
            <span>Текущий расход: {formatSmartNumber(edgeFlow, 1)} л/мин. Связанный маршрут: {routeRef}.</span>
          </div>
          <div className={`issue-card severity-${edgeLoss > 0.8 ? 'warning' : 'info'}`}>
            <strong>Потери и скорость: {edgeLoss > 0.8 ? 'риск' : 'норма'}</strong>
            <span>Потери давления: {formatSmartNumber(edgeLoss, 3)} бар, скорость: {formatSmartNumber(edgeVelocity, 3)} м/с.</span>
          </div>
          <div className={`issue-card severity-${hydraulicConstraint ? 'warning' : 'info'}`}>
            <strong>Гидравлический зажим: {hydraulicConstraint ? 'обнаружен' : 'нет'}</strong>
            <span>{hydraulicConstraint || 'Участок не является основным ограничением для текущего маршрута.'}</span>
          </div>
        </div>
        {relatedIssues.length ? relatedIssues.map((issue) => <div key={issue.id} className={`issue-card severity-${issue.severity}`}><strong>{issueTitle(issue)}</strong><span>{issue.message}</span></div>) : <div className="issue-card severity-info"><strong>Маршрут совместим</strong><span>Блокировок потока и физических замечаний для выбранной линии не выявлено.</span></div>}
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
  const routeState = String(node!.data.runtime.routeState ?? node!.data.simulation.routeState ?? '');
  const routeDirection = String(process.direction ?? process.directionMode ?? '');
  const levelPercent = Math.max(0, Math.min(100, Number(process.levelPercent ?? ((summaryLevel / Math.max(1, Number(process.capacity ?? 0))) * 100))));
  const actions = buildNodeActions(node!);
  const events = project.eventLog.filter((event) => event.targetId === node!.id).slice(-8).reverse();
  const nodeIssues = issues.filter((issue) => issue.nodeIds?.includes(node!.id));
  const liveSummary = liveRows({
    processState,
    commandIntake,
    commandDischarge,
    commandRunning,
    commandBlocked,
    summaryFlow,
    statusReason,
    mediumType: node!.data.mediumType,
    routeDirection: routeDirection === 'forward' ? 'Прямое' : routeDirection === 'reverse' ? 'Обратное' : routeDirection === 'bidirectional' ? 'Двунаправленное' : undefined,
    routeState: routeState ? (ruState[routeState] ?? routeState) : undefined,
  });
  const passportMainKeys = new Set(['visibleName', 'shortName', 'technicalTag', 'notes']);
  const passportBaseKeys = new Set(['capacity', 'flowRate', 'temperature', 'pressure', 'diameterNominal', 'activityLabel']);
  const passportFields = fields.filter((field) => passportMainKeys.has(field.key) || passportBaseKeys.has(field.key));
  const tempBand = resolveBand(summaryTemp, temperatureBands);
  const pressureBand = resolveBand(pressure, pressureBands);
  const flowBand = resolveBand(summaryFlow, flowBands);
  const levelBand = resolveBand(levelPercent, levelBands);
  const bandSummary = [
    { label: 'Температура', state: tempBand.state, reason: summaryTemp > 85 ? 'температура выше целевого диапазона' : summaryTemp < 0 ? 'значение ниже физически допустимого диапазона' : 'температура в рабочей зоне' },
    { label: 'Давление', state: pressureBand.state, reason: pressure > 2.8 ? 'давление близко к аварийному порогу' : pressure < 0.2 ? 'давление низкое, возможна нехватка подпитки' : 'давление стабильно' },
    { label: 'Расход', state: flowBand.state, reason: summaryFlow < 0.1 ? 'поток практически остановлен' : summaryFlow > 60 ? 'расход выше расчётного диапазона' : 'расход в допустимом коридоре' },
    { label: 'Уровень', state: levelBand.state, reason: levelPercent > 90 ? 'резервуар близок к переполнению' : levelPercent < 15 ? 'уровень низкий, возможен срыв подачи' : 'уровень в рабочем диапазоне' },
  ];
  const schematicNodeStub = { id: node!.id, data: node!.data, position: node!.position } as any;
  const variantOptions = getAvailableSymbolVariants(schematicNodeStub);
  const showOrientationControl = node!.data.className !== 'topology';

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
        <span className={`status-pill tone-${statusTone(processState)}`}>Режим: {readableState(processState)}</span>
      </div>
      <div className="kpi-grid">
        <div><span>Поток</span><strong>{formatSmartNumber(summaryFlow, 1)} л/мин</strong></div>
        <div className={summaryTemp >= 80 ? 'is-alert' : ''}><span>Температура</span><strong>{formatSmartNumber(summaryTemp, 1)} °C</strong></div>
        <div><span>Уровень</span><strong>{Math.round(summaryLevel)} л</strong></div>
        <div><span>Давление</span><strong>{formatSmartNumber(pressure, 2)} бар</strong></div>
      </div>
    </section>

    <section className="route-card inspector-card">
      <strong>Панель управления</strong>
      <div className="control-group">
        {actions.map((item) => <button key={item.action} className={`control-button ${item.active ? 'is-active' : ''} ${item.tone === 'warn' ? 'is-warning' : ''}`} disabled={item.disabled} onClick={() => executeNodeAction(node!.id, item.action)}>{item.label}</button>)}
      </div>
    </section>

    <section className="route-card inspector-card">
      <strong>Живые параметры</strong>
      <div className="live-summary-grid">
        {liveSummary.map((item) => <div key={item.label} className="live-item"><span>{item.label}</span><b>{item.value}</b></div>)}
      </div>
    </section>

    <section className="route-card inspector-card">
      <strong>Диагностика состояния</strong>
      <span className="panel-caption">Показывает, что проверяется, текущую оценку, причину и уровень: норма, риск или тревога.</span>
      <div className="instrument-grid">
        <div className={`instrument-card band-${bandTone(tempBand.state)}`}><div className="instrument-head"><span>Температура</span><strong>{formatSmartNumber(summaryTemp, 1)} °C</strong></div><div className="instrument-track"><i style={{ width: `${clampPercent(summaryTemp, 0, 100)}%` }} /></div><small>Норма 0–70 • риск 70–85 • тревога &gt;85</small></div>
        <div className={`instrument-card band-${bandTone(pressureBand.state)}`}><div className="instrument-head"><span>Давление</span><strong>{formatSmartNumber(pressure, 2)} бар</strong></div><div className="instrument-track"><i style={{ width: `${clampPercent(pressure, 0, 4)}%` }} /></div><small>Норма 0–1.7 • риск 1.7–2.8 • тревога &gt;2.8</small></div>
        <div className={`instrument-card band-${bandTone(flowBand.state)}`}><div className="instrument-head"><span>Расход</span><strong>{formatSmartNumber(summaryFlow, 1)} л/мин</strong></div><div className="instrument-track"><i style={{ width: `${clampPercent(summaryFlow, 0, 100)}%` }} /></div><small>Норма 0.1–60 • риск низкий &lt;0.1 • тревога &gt;60</small></div>
        <div className={`instrument-card band-${bandTone(levelBand.state)}`}><div className="instrument-head"><span>Уровень</span><strong>{Math.round(levelPercent)} %</strong></div><div className="instrument-track"><i style={{ width: `${levelPercent}%` }} /></div><small>Норма 15–90 • риск низкий &lt;15 • тревога &gt;90</small></div>
      </div>
      <div className="issue-list issue-list-detailed">
        {bandSummary.map((item) => <div key={item.label} className={`issue-card severity-${item.state === 'Тревога' ? 'error' : item.state === 'Риск' ? 'warning' : 'info'}`}>
          <strong>{item.label}: {item.state}</strong>
          <span>Проверка: {item.label.toLowerCase()} в рабочем диапазоне. Оценка: {item.state.toLowerCase()}. Причина: {item.reason}.</span>
        </div>)}
        <div className="issue-card severity-info">
          <strong>Физическая проверка</strong>
          <span>Часть расчётов выполняется в упрощённом режиме. Это явно показывается в событиях и не скрывает ограничение модели.</span>
        </div>
      </div>
      <div className="aux-grid">
        <div className="aux-card"><span>Вязкость</span><strong>{formatSmartNumber(viscosity, 4)} Па·с</strong></div>
        <div className="aux-card"><span>Плотность</span><strong>{Math.round(density)} кг/м³</strong></div>
      </div>
      {!!nodeIssues.length && <div className="issue-list issue-list-detailed">
        {nodeIssues.slice(0, 4).map((issue) => <div key={issue.id} className={`issue-card severity-${issue.severity}`}><strong>{issueTitle(issue)}</strong><span>{issue.message}</span></div>)}
      </div>}
    </section>

    <section className="route-card inspector-card">
      <strong>Паспорт оборудования</strong>
      {presentationMode === 'schematic' ? <div className="inspector-stack">
        {showOrientationControl ? <label className="field">
          <span>Ориентация (Schematic)</span>
          <select value={node!.data.orientation ?? 'horizontal'} onChange={(e) => updateNodeField(node!.id, 'orientation', e.target.value)}>
            <option value="horizontal">Горизонтальная</option>
            <option value="vertical">Вертикальная</option>
          </select>
        </label> : null}
        {variantOptions.length ? <label className="field">
          <span>Вариант символа</span>
          <select value={node!.data.symbolVariant ?? variantOptions[0]} onChange={(e) => updateNodeField(node!.id, 'symbolVariant', e.target.value)}>
            {variantOptions.map((variant) => <option key={variant} value={variant}>{variant}</option>)}
          </select>
        </label> : null}
      </div> : null}
      {passportFields.map((field) => {
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

import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getSmoothStepPath, useStore } from 'reactflow';
import { MediumType, RouteState } from '../../domain/schemas/types';
import { mediumPalette, routeTone } from '../tokens/tokens';
import { EdgeActionKind, useAppStore } from '../../store/useAppStore';

const routeStateLabel: Record<RouteState, string> = { idle: 'Ожидание', primed: 'Подготовлен', flowing: 'Поток', blocked: 'Блокировка', starved: 'Нет подпитки', draining: 'Слив', cip: 'CIP', alarm: 'Авария', maintenance: 'Ремонт', offline: 'Отключён' };
const routeParticleMode: Record<RouteState, string> = { idle: 'idle', primed: 'waiting', flowing: 'flowing', blocked: 'blocked', starved: 'starved', draining: 'draining', cip: 'cip', alarm: 'alarm', maintenance: 'idle', offline: 'idle' };
const mediumLabel: Record<MediumType | 'composite', string> = { water: 'Вода', product: 'Продукт', cip: 'CIP', waste: 'Сток', composite: 'Смесь' };
const directionGlyph: Record<string, string> = { forward: '→', reverse: '←', bidirectional: '↔' };
const directionModeLabel: Record<string, string> = { derived: 'Авто', forward: 'Прямое', reverse: 'Обратное', bidirectional: 'Двунапр.' };
const lineRoleLabel: Record<string, string> = { process: 'Технологическая', drain: 'Дренаж', utility: 'Сервисная', recycle: 'Рециркуляция', CIP: 'CIP' };
const insertableActions: Array<{ label: string; action: EdgeActionKind }> = [
  { label: 'Клапан', action: 'insert:shutoffValve' },
  { label: 'Задвижка', action: 'insert:gateValve' },
  { label: 'Обратный клапан', action: 'insert:checkValve' },
  { label: 'Расходомер', action: 'insert:flowMeter' },
  { label: 'Датчик', action: 'insert:pressureSensor' },
  { label: 'Насос', action: 'insert:pump' },
  { label: 'Фильтр', action: 'insert:inlineFilter' },
  { label: 'Тройник', action: 'insert:tee' },
  { label: 'Крестовина', action: 'insert:cross' },
  { label: 'Дренаж', action: 'insert:drainBranch' },
  { label: 'Пробоотбор', action: 'insert:samplePoint' },
];

const stopCanvasGesture = (event: React.MouseEvent<HTMLElement>) => {
  event.preventDefault();
  event.stopPropagation();
};

const FlowEdgeComponent = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected }: EdgeProps) => {
  const [path, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 18, offset: 18 });
  const zoom = useStore((state) => state.transform[2]);
  const { selectedEdgeId, edgeEditorMode, selectEdge, setEdgeEditorMode, executeEdgeAction, simulationStatus, simulationSpeed } = useAppStore((state) => ({
    selectedEdgeId: state.selectedEdgeId,
    edgeEditorMode: state.edgeEditorMode,
    selectEdge: state.selectEdge,
    setEdgeEditorMode: state.setEdgeEditorMode,
    executeEdgeAction: state.executeEdgeAction,
    simulationStatus: state.project.simulation.status ?? (state.project.simulation.running ? 'running' : 'idle'),
    simulationSpeed: state.project.simulation.speed,
  }));
  const mediumKey = (data?.medium ?? 'water') as MediumType | 'composite';
  const routeKey = (data?.routeState ?? 'idle') as RouteState;
  const medium = mediumPalette[mediumKey === 'composite' ? 'product' : mediumKey];
  const routeColor = routeTone[routeKey];
  const active = Boolean(data?.flowActive);
  const blocked = Boolean(data?.blocked);
  const mixedFlow = Boolean(data?.mixedFlow) || data?.mediumMode === 'mixed';
  const isAlarm = routeKey === 'alarm';
  const isStarved = routeKey === 'starved';
  const emphasis = Boolean(data?.selectedPath || selected);
  const hovered = Boolean(data?.hovered);
  const visibleMode = data?.labelMode ?? 'selected';
  const shouldShowBadge = zoom >= 0.72 && (visibleMode === 'all' || (visibleMode === 'active' && (active || blocked)) || (visibleMode === 'selected' && (selected || hovered || emphasis)));
  const isSelected = selectedEdgeId === id;
  const showToolbar = isSelected && zoom >= 0.58;
  const direction = data?.direction ?? 'forward';
  const warnings = (data?.routeWarnings ?? []).slice(0, 2);
  const isRunningSimulation = simulationStatus === 'running';
  const isPausedSimulation = simulationStatus === 'paused';
  const shouldAnimateFlow = isRunningSimulation && active;
  const effectiveSpeed = Math.max(0.5, simulationSpeed || 1);
  const primaryBase = Math.max(0.65, 2.6 - Number(data?.flowRate ?? 0) / 36);
  const secondaryBase = Math.max(0.85, 3.2 - Number(data?.flowRate ?? 0) / 44);
  const directionMode = directionModeLabel[data?.directionMode ?? 'derived'] ?? 'Авто';
  const lineRole = lineRoleLabel[data?.lineRole ?? 'process'] ?? String(data?.lineRole ?? 'Технологическая');

  return <>
    <BaseEdge id={id} path={path} style={{ stroke: '#122131', strokeWidth: 14, opacity: emphasis ? 1 : 0.55 }} />
    <BaseEdge id={`${id}-pipe`} path={path} style={{ stroke: routeColor, strokeWidth: active ? 8 : 6, opacity: emphasis ? 1 : simulationStatus === 'idle' ? 0.48 : 0.8, strokeDasharray: mixedFlow ? '10 6' : undefined }} />
    <path d={path} className={`pipe-shell route-${routeKey} sim-${simulationStatus} ${hovered ? 'is-hovered' : ''}`} style={{ stroke: routeColor }} />
    <path d={path} className={`pipe-glow sim-${simulationStatus} ${shouldAnimateFlow ? 'is-active' : ''} ${blocked ? 'is-blocked' : ''} ${isAlarm ? 'is-alarm' : ''}`} style={{ stroke: mixedFlow ? '#f3b6ff' : medium.glow }} />
    <path d={path} className={`pipe-fluid sim-${simulationStatus} mode-${routeParticleMode[routeKey]} ${shouldAnimateFlow ? 'is-active' : ''} ${blocked ? 'is-blocked' : ''} ${isStarved ? 'is-starved' : ''} ${isAlarm ? 'is-alarm' : ''} ${isPausedSimulation ? 'is-paused' : ''}`} style={{ stroke: mixedFlow ? '#f0b7ff' : medium.base, ['--flow-speed' as string]: `${primaryBase / effectiveSpeed}s` }} />
    <path d={path} className={`pipe-fluid pipe-fluid-secondary sim-${simulationStatus} mode-${routeParticleMode[routeKey]} ${shouldAnimateFlow ? 'is-active' : ''} ${blocked ? 'is-blocked' : ''} ${isStarved ? 'is-starved' : ''} ${isAlarm ? 'is-alarm' : ''} ${isPausedSimulation ? 'is-paused' : ''}`} style={{ stroke: mixedFlow ? '#fff0ff' : medium.glow, ['--flow-speed' as string]: `${secondaryBase / effectiveSpeed}s` }} />
    <EdgeLabelRenderer>
      <button type="button" className={`edge-hitbox nodrag nopan ${isSelected ? 'is-selected' : ''}`} style={{ left: labelX, top: labelY, transform: 'translate(-50%, -50%)' }} onMouseDown={stopCanvasGesture} onClick={(event) => { stopCanvasGesture(event); selectEdge(id); }} />
    </EdgeLabelRenderer>
    {shouldShowBadge ? <EdgeLabelRenderer><div style={{ left: labelX, top: labelY - (showToolbar ? 74 : 0), transform: 'translate(-50%, -50%)' }} className={`edge-badge sim-${simulationStatus} ${emphasis ? 'is-focus' : ''} ${active ? 'is-active' : ''} ${blocked ? 'is-warning' : ''} ${mixedFlow ? 'is-focus' : ''}`}><strong>{directionGlyph[direction]} {Math.round(Number(data?.flowRate ?? 0))} л/мин • {data?.nominalDiameter ?? 'DN50'}</strong><span>{routeStateLabel[routeKey]} • {mediumLabel[mediumKey]}</span>{data?.lineRole ? <span>{lineRole} • {directionMode}</span> : null}{warnings.length ? <span>{warnings.join(' · ')}</span> : null}</div></EdgeLabelRenderer> : null}
    {showToolbar ? (
      <EdgeLabelRenderer>
        <div className="edge-editor-popover nodrag nopan" style={{ left: labelX, top: labelY + 12, transform: 'translate(-50%, 0)' }} onPointerDown={stopCanvasGesture} onMouseDown={stopCanvasGesture} onClick={stopCanvasGesture}>
          {edgeEditorMode === 'insert' ? (
            <div className="edge-picker">
              {insertableActions.map((item) => (
                <button key={item.action} type="button" className="nodrag nopan" onMouseDown={stopCanvasGesture} onClick={(event) => { stopCanvasGesture(event); executeEdgeAction(item.action, id); }}>{item.label}</button>
              ))}
              <button type="button" className="is-secondary nodrag nopan" onMouseDown={stopCanvasGesture} onClick={(event) => { stopCanvasGesture(event); setEdgeEditorMode('actions'); }}>Назад</button>
            </div>
          ) : (
            <div className="edge-toolbar">
              <button type="button" className="nodrag nopan" onMouseDown={stopCanvasGesture} onClick={(event) => { stopCanvasGesture(event); setEdgeEditorMode('insert'); }}>Вставить</button>
              <button type="button" className="nodrag nopan" onMouseDown={stopCanvasGesture} onClick={(event) => { stopCanvasGesture(event); executeEdgeAction('branch:tee', id); }}>Ответвить</button>
              <button type="button" className="nodrag nopan" onMouseDown={stopCanvasGesture} onClick={(event) => { stopCanvasGesture(event); executeEdgeAction('break', id); }}>Разорвать</button>
              <button type="button" className="nodrag nopan" onMouseDown={stopCanvasGesture} onClick={(event) => { stopCanvasGesture(event); executeEdgeAction('reconnect', id); }}>Переподключить</button>
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    ) : null}
  </>;
};

export const FlowEdge = memo(FlowEdgeComponent);

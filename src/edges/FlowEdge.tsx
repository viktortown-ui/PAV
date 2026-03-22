import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getSmoothStepPath, useStore } from 'reactflow';
import { MediumType, RouteState, SoapNodeKind } from '../domain/schemas/types';
import { mediumPalette, routeTone } from '../domain/visual/tokens';
import { useAppStore } from '../store/useAppStore';

const routeStateLabel: Record<RouteState, string> = { idle: 'Ожидание', primed: 'Подготовлен', flowing: 'Поток', blocked: 'Блокировка', starved: 'Нет подпитки', draining: 'Слив', cip: 'CIP', alarm: 'Авария', offline: 'Отключён' };
const mediumLabel: Record<MediumType, string> = { water: 'Вода', product: 'Продукт', cip: 'CIP', waste: 'Сток' };
const insertableKinds: Array<{ label: string; kind: SoapNodeKind }> = [
  { label: 'Клапан', kind: 'manualValve' },
  { label: 'Задвижка', kind: 'gateValve' },
  { label: 'Обратный клапан', kind: 'checkValve' },
  { label: 'Расходомер', kind: 'flowMeter' },
  { label: 'Датчик', kind: 'pressureSensor' },
  { label: 'Насос', kind: 'pump' },
  { label: 'Фильтр', kind: 'inlineFilter' },
  { label: 'Тройник', kind: 'tee' },
  { label: 'Дренаж', kind: 'drainBranch' },
];

const FlowEdgeComponent = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected }: EdgeProps) => {
  const [path, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 18, offset: 18 });
  const zoom = useStore((state) => state.transform[2]);
  const { selectedEdgeId, edgeEditorMode, selectEdge, setEdgeEditorMode, insertNodeIntoEdge, createBranchFromEdge, removeSelectedSegment, reconnectSelectedEdge } = useAppStore((state) => ({
    selectedEdgeId: state.selectedEdgeId,
    edgeEditorMode: state.edgeEditorMode,
    selectEdge: state.selectEdge,
    setEdgeEditorMode: state.setEdgeEditorMode,
    insertNodeIntoEdge: state.insertNodeIntoEdge,
    createBranchFromEdge: state.createBranchFromEdge,
    removeSelectedSegment: state.removeSelectedSegment,
    reconnectSelectedEdge: state.reconnectSelectedEdge,
  }));
  const mediumKey = (data?.medium ?? 'water') as MediumType;
  const routeKey = (data?.routeState ?? 'idle') as RouteState;
  const medium = mediumPalette[mediumKey];
  const routeColor = routeTone[routeKey];
  const active = Boolean(data?.flowActive);
  const blocked = Boolean(data?.blocked);
  const emphasis = Boolean(data?.selectedPath || selected);
  const hovered = Boolean(data?.hovered);
  const visibleMode = data?.labelMode ?? 'selected';
  const shouldShowBadge = zoom >= 0.72 && (visibleMode === 'all' || (visibleMode === 'active' && (active || blocked)) || (visibleMode === 'selected' && (selected || hovered || emphasis)));
  const isSelected = selectedEdgeId === id;
  const showToolbar = isSelected && zoom >= 0.58;

  return <>
    <BaseEdge id={id} path={path} style={{ stroke: '#122131', strokeWidth: 14, opacity: emphasis ? 1 : 0.55 }} />
    <BaseEdge id={`${id}-pipe`} path={path} style={{ stroke: routeColor, strokeWidth: active ? 8 : 6, opacity: emphasis ? 1 : 0.8 }} />
    <path d={path} className={`pipe-glow ${active ? 'is-active' : ''} ${blocked ? 'is-blocked' : ''}`} style={{ stroke: medium.glow }} />
    <path d={path} className={`pipe-fluid ${active ? 'is-active' : ''} ${blocked ? 'is-blocked' : ''}`} style={{ stroke: medium.base, ['--flow-speed' as string]: `${Math.max(0.6, 2.4 - Number(data?.flowRate ?? 0) / 30)}s` }} />
    <EdgeLabelRenderer>
      <button
        type="button"
        className={`edge-hitbox ${isSelected ? 'is-selected' : ''}`}
        style={{ left: labelX, top: labelY, transform: 'translate(-50%, -50%)' }}
        onClick={(event) => {
          event.stopPropagation();
          selectEdge(id);
        }}
      />
    </EdgeLabelRenderer>
    {shouldShowBadge ? <EdgeLabelRenderer><div style={{ left: labelX, top: labelY - (showToolbar ? 74 : 0), transform: 'translate(-50%, -50%)' }} className={`edge-badge ${emphasis ? 'is-focus' : ''} ${active ? 'is-active' : ''} ${blocked ? 'is-warning' : ''}`}><strong>{Math.round(Number(data?.flowRate ?? 0))} л/мин • {data?.nominalDiameter ?? 'DN50'}</strong><span>{routeStateLabel[routeKey]} • {mediumLabel[mediumKey]}</span></div></EdgeLabelRenderer> : null}
    {showToolbar ? (
      <EdgeLabelRenderer>
        <div
          className="edge-editor-popover"
          style={{ left: labelX, top: labelY + 12, transform: 'translate(-50%, 0)' }}
          onClick={(event) => event.stopPropagation()}
        >
          {edgeEditorMode === 'insert' ? (
            <div className="edge-picker">
              {insertableKinds.map((item) => (
                <button
                  key={item.kind}
                  type="button"
                  onClick={() => {
                    insertNodeIntoEdge(item.kind);
                  }}
                >
                  {item.label}
                </button>
              ))}
              <button type="button" className="is-secondary" onClick={() => setEdgeEditorMode('actions')}>Назад</button>
            </div>
          ) : (
            <div className="edge-toolbar">
              <button type="button" onClick={() => setEdgeEditorMode('insert')}>Вставить</button>
              <button type="button" onClick={() => createBranchFromEdge('tee')}>Ответвить</button>
              <button type="button" onClick={() => removeSelectedSegment()}>Разорвать</button>
              <button type="button" onClick={() => reconnectSelectedEdge()}>Переподключить</button>
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    ) : null}
  </>;
};

export const FlowEdge = memo(FlowEdgeComponent);

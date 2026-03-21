import { BaseEdge, EdgeLabelRenderer, EdgeProps, getSmoothStepPath } from 'reactflow';
import { mediumPalette, routeTone } from '../domain/visual/tokens';

export const FlowEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected }: EdgeProps) => {
  const [path, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 18, offset: 18 });
  const mediumKey = (data?.medium ?? 'water') as keyof typeof mediumPalette;
  const routeKey = (data?.routeState ?? 'idle') as keyof typeof routeTone;
  const medium = mediumPalette[mediumKey];
  const routeColor = routeTone[routeKey];
  const active = Boolean(data?.flowActive);
  const blocked = Boolean(data?.blocked);
  const emphasis = Boolean(data?.selectedPath || selected);
  return (
    <>
      <BaseEdge id={id} path={path} style={{ stroke: '#122131', strokeWidth: 14, opacity: emphasis ? 1 : 0.55 }} />
      <BaseEdge id={`${id}-pipe`} path={path} style={{ stroke: routeColor, strokeWidth: active ? 8 : 6, opacity: emphasis ? 1 : 0.8 }} />
      <path d={path} className={`pipe-glow ${active ? 'is-active' : ''} ${blocked ? 'is-blocked' : ''}`} style={{ stroke: medium.glow }} />
      <path d={path} className={`pipe-fluid ${active ? 'is-active' : ''} ${blocked ? 'is-blocked' : ''}`} style={{ stroke: medium.base, ['--flow-speed' as string]: `${Math.max(0.6, 2.4 - Number(data?.flowRate ?? 0) / 30)}s` }} />
      <EdgeLabelRenderer>
        <div style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }} className={`edge-badge ${emphasis ? 'is-focus' : ''}`}>
          <strong>{Math.round(Number(data?.flowRate ?? 0))} л/мин</strong>
          <span>{blocked ? 'Блокировка' : active ? 'Маршрут активен' : 'Линия ожидания'}</span>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

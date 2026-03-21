import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath } from 'reactflow';

export const FlowEdge = ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, data }: EdgeProps) => {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const active = Boolean(data?.flowActive);
  const blocked = Boolean(data?.blocked);
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ ...style, stroke: blocked ? '#ff9f43' : active ? '#69dbff' : '#62748a', strokeWidth: active ? 4 : 3 }} />
      <path d={path} className={`flow-edge-overlay ${active ? 'is-active' : ''} ${blocked ? 'is-blocked' : ''}`} />
      <EdgeLabelRenderer>
        <div style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }} className="edge-badge">
          {active ? `${Math.round(Number(data?.flowRate ?? 0))} л/мин` : blocked ? 'Нет потока' : 'Линия'}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

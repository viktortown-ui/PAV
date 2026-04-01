import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, EdgeProps } from 'reactflow';

const buildPath = (points?: Array<{ x: number; y: number }>) => {
  if (!points || points.length < 2) return '';
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
};

export const SchematicEdge = memo(({ id, sourceX, sourceY, targetX, targetY, data, selected }: EdgeProps) => {
  const points = data?.schematicRoute?.points as Array<{ x: number; y: number }> | undefined;
  const path = buildPath(points) || `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  const labelPoint = points?.[Math.floor((points.length - 1) / 2)] ?? { x: (sourceX + targetX) / 2, y: (sourceY + targetY) / 2 };
  const dn = String(data?.nominalDiameter ?? 'DN50');

  return (
    <>
      <BaseEdge id={`${id}-base`} path={path} style={{ stroke: '#7b8ca3', strokeWidth: 2.2, opacity: selected ? 1 : 0.82 }} />
      <path d={path} className="schematic-edge-arrow" />
      <EdgeLabelRenderer>
        <div className="schematic-edge-label" style={{ left: labelPoint.x, top: labelPoint.y, transform: 'translate(-50%, -50%)' }}>
          {dn}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

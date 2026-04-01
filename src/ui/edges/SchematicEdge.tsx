import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, EdgeProps } from 'reactflow';

const buildPath = (points?: Array<{ x: number; y: number }>) => {
  if (!points || points.length < 2) return '';
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
};

export const SchematicEdge = memo(({ id, sourceX, sourceY, targetX, targetY, data, selected }: EdgeProps) => {
  const points = data?.schematicRoute?.points as Array<{ x: number; y: number }> | undefined;
  const path = buildPath(points) || `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  const preferredLabelPoint = data?.schematicRoute?.labelPoint as { x: number; y: number } | undefined;
  const fallbackPoint = points?.[Math.max(1, Math.floor((points.length - 1) / 2))] ?? { x: (sourceX + targetX) / 2, y: (sourceY + targetY) / 2 };
  const labelPoint = preferredLabelPoint ?? fallbackPoint;
  const dn = String(data?.nominalDiameter ?? 'DN50');
  const medium = typeof data?.medium === 'string' ? data.medium.toUpperCase() : '';
  const tag = typeof data?.serviceTag === 'string' ? data.serviceTag : '';
  const secondary = [medium, tag].filter(Boolean).join(' · ');
  const secondaryPoint = data?.schematicRoute?.secondaryLabelPoint as { x: number; y: number } | undefined;
  const showSecondary = Boolean(data?.schematicRoute?.showSecondaryLabel ?? true);

  return (
    <>
      <BaseEdge id={`${id}-base`} path={path} style={{ stroke: '#5a6d87', strokeWidth: 2.2, opacity: selected ? 1 : 0.88 }} />
      <path d={path} className="schematic-edge-arrow" />
      <EdgeLabelRenderer>
        <div className="schematic-edge-label" style={{ left: labelPoint.x, top: labelPoint.y, transform: 'translate(-50%, -50%)' }}>
          <strong>{dn}</strong>
        </div>
        {secondary && showSecondary && secondaryPoint ? <div className="schematic-edge-label schematic-edge-label-secondary" style={{ left: secondaryPoint.x, top: secondaryPoint.y, transform: 'translate(-50%, -50%)' }}><span>{secondary}</span></div> : null}
      </EdgeLabelRenderer>
    </>
  );
});

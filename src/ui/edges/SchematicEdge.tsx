import { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, EdgeProps } from 'reactflow';
import { intersectsAnyOverlayRect } from '../../features/editor/overlayPositioning';

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
  const declutterRects = data?.declutterRects as Array<{ x: number; y: number; width: number; height: number }> | undefined;
  const adjustedLabelPoint = intersectsAnyOverlayRect(labelPoint, declutterRects, 10) ? { x: labelPoint.x, y: labelPoint.y - 18 } : labelPoint;
  const dn = String(data?.nominalDiameter ?? 'DN50');
  const medium = typeof data?.medium === 'string' ? data.medium.toUpperCase() : '';
  const tag = typeof data?.serviceTag === 'string' ? data.serviceTag : '';
  const secondary = [medium, tag].filter(Boolean).join(' · ');
  const secondaryPoint = data?.schematicRoute?.secondaryLabelPoint as { x: number; y: number } | undefined;
  const routeComplexEnough = (points?.length ?? 0) >= 4 || Math.hypot(targetX - sourceX, targetY - sourceY) > 220;
  const showSecondary = Boolean(data?.schematicRoute?.showSecondaryLabel ?? true) && routeComplexEnough && !intersectsAnyOverlayRect(secondaryPoint ?? adjustedLabelPoint, declutterRects, 12);

  return (
    <>
      <BaseEdge id={`${id}-base`} path={path} style={{ stroke: '#4a5c74', strokeWidth: selected ? 2.4 : 2, opacity: 0.96 }} />
      <EdgeLabelRenderer>
        <div className="schematic-edge-label" style={{ left: adjustedLabelPoint.x, top: adjustedLabelPoint.y, transform: 'translate(-50%, -50%)' }}>
          <strong>{dn}</strong>
        </div>
        {secondary && showSecondary && secondaryPoint ? <div className="schematic-edge-label schematic-edge-label-secondary" style={{ left: secondaryPoint.x, top: secondaryPoint.y, transform: 'translate(-50%, -50%)' }}><span>{secondary}</span></div> : null}
      </EdgeLabelRenderer>
    </>
  );
});

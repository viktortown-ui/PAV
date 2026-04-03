export type Rect = { left: number; top: number; right: number; bottom: number };
export type OverlayRect = { x: number; y: number; width: number; height: number };

export const clampOverlayToShell = (
  point: { x: number; y: number },
  menuSize: { width: number; height: number },
  shellRect: Rect,
  options?: { padding?: number; bottomReserved?: number },
) => {
  const padding = options?.padding ?? 8;
  const bottomReserved = options?.bottomReserved ?? 0;
  const leftBoundary = shellRect.left + padding;
  const rightBoundary = shellRect.right - menuSize.width - padding;
  const topBoundary = shellRect.top + padding;
  const bottomBoundary = shellRect.bottom - bottomReserved - menuSize.height - padding;

  return {
    left: Math.max(leftBoundary, Math.min(rightBoundary, point.x)),
    top: Math.max(topBoundary, Math.min(bottomBoundary, point.y)),
  };
};

export const intersectsOverlayRect = (point: { x: number; y: number }, rect?: OverlayRect, pad = 10) => {
  if (!rect) return false;
  return point.x >= rect.x - pad && point.x <= rect.x + rect.width + pad && point.y >= rect.y - pad && point.y <= rect.y + rect.height + pad;
};

export const intersectsAnyOverlayRect = (point: { x: number; y: number }, rects?: OverlayRect[], pad = 10) => (
  Array.isArray(rects) && rects.some((rect) => intersectsOverlayRect(point, rect, pad))
);

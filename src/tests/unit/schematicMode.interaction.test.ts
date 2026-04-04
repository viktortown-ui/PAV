import { describe, expect, it } from 'vitest';
import { canDragNodes } from '../../features/editor/CanvasEditor';

describe('schematic mode interaction policy', () => {
  it('disables node dragging in schematic mode', () => {
    expect(canDragNodes('schematic', 'select')).toBe(false);
  });

  it('allows node dragging only in simulation select tool', () => {
    expect(canDragNodes('simulation', 'select')).toBe(true);
    expect(canDragNodes('simulation', 'connect')).toBe(false);
  });
});

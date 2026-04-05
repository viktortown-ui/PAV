import { describe, expect, it } from 'vitest';
import { canDragNodes } from '../../features/editor/CanvasEditor';

describe('schematic mode interaction policy', () => {
  it('schematic mode remains read-only for node movement', () => {
    expect(canDragNodes('schematic', 'select')).toBe(false);
    expect(canDragNodes('schematic', 'connect')).toBe(false);
  });

  it('allows node dragging only in simulation select tool', () => {
    expect(canDragNodes('simulation', 'select')).toBe(true);
    expect(canDragNodes('simulation', 'connect')).toBe(false);
  });
});

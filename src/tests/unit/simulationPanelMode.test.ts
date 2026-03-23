import { describe, expect, it } from 'vitest';
import { coercePanelMode, cyclePanelMode, getExpandToggleTarget, getLastOpenPanelMode, getOpenPanelMode } from '../../features/simulation/panelMode';

describe('simulation panel mode helpers', () => {
  it('cycles through all panel states in a stable order', () => {
    expect(cyclePanelMode('hidden')).toBe('mini');
    expect(cyclePanelMode('mini')).toBe('compact');
    expect(cyclePanelMode('compact')).toBe('expanded');
    expect(cyclePanelMode('expanded')).toBe('hidden');
  });

  it('restores the last open state instead of forcing mini mode', () => {
    expect(getOpenPanelMode('compact')).toBe('compact');
    expect(getOpenPanelMode('expanded')).toBe('expanded');
    expect(getOpenPanelMode('hidden')).toBe('mini');
    expect(getOpenPanelMode(null)).toBe('mini');
  });

  it('collapses and expands without invalid intermediate transitions', () => {
    expect(getExpandToggleTarget('hidden')).toBe('expanded');
    expect(getExpandToggleTarget('mini')).toBe('expanded');
    expect(getExpandToggleTarget('compact')).toBe('mini');
    expect(getExpandToggleTarget('expanded')).toBe('compact');
  });

  it('sanitizes stored mode values safely', () => {
    expect(coercePanelMode('compact')).toBe('compact');
    expect(coercePanelMode('mystery')).toBe('mini');
    expect(getLastOpenPanelMode('hidden')).toBe('mini');
    expect(getLastOpenPanelMode('expanded')).toBe('expanded');
  });
});

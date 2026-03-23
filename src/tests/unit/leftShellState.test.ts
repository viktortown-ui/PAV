import { describe, expect, it } from 'vitest';
import { defaultLeftShellState, restoreLeftShellState, transitionLeftShell } from '../../features/toolbox/leftShellState';

describe('leftShellState', () => {
  it('opens the drawer and swaps content when switching families', () => {
    const initial = restoreLeftShellState({ drawerOpen: false, activeFamily: 'library', mode: 'normal' });
    const next = transitionLeftShell(initial, { type: 'select-family', family: 'valves' });

    expect(next.mode).toBe('normal');
    expect(next.drawerOpen).toBe(true);
    expect(next.activeFamily).toBe('valves');
    expect(next.lastNormal).toEqual({ drawerOpen: true, activeFamily: 'valves' });
  });

  it('restores the exact previous normal drawer state after focus mode', () => {
    const focused = transitionLeftShell(
      restoreLeftShellState({ mode: 'normal', drawerOpen: true, activeFamily: 'inline' }),
      { type: 'enter-focus' },
    );
    const restored = transitionLeftShell(focused, { type: 'exit-focus' });

    expect(focused.mode).toBe('focus');
    expect(focused.drawerOpen).toBe(false);
    expect(restored.mode).toBe('normal');
    expect(restored.drawerOpen).toBe(true);
    expect(restored.activeFamily).toBe('inline');
  });

  it('closes cleanly after quick add when configured to close', () => {
    const next = transitionLeftShell(defaultLeftShellState(), { type: 'quick-add-complete' });
    expect(next.drawerOpen).toBe(false);
    expect(next.lastNormal.drawerOpen).toBe(false);
  });

  it('keeps the drawer open after quick add when configured to keep open', () => {
    const configured = transitionLeftShell(defaultLeftShellState(), {
      type: 'set-quick-add-close-behavior',
      behavior: 'keep-open',
    });
    const next = transitionLeftShell(configured, { type: 'quick-add-complete' });
    expect(next.drawerOpen).toBe(true);
  });
});

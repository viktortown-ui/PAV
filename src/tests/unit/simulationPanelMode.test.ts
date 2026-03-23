import { describe, expect, it } from 'vitest';
import {
  coerceDiagnosticsPanelState,
  getLastOpenDiagnosticsPanelState,
  transitionDiagnosticsPanelState,
} from '../../features/simulation/panelMode';

describe('simulation panel mode helpers', () => {
  it('allows only the declared forward and backward transitions', () => {
    expect(transitionDiagnosticsPanelState('hidden', 'launcher')).toBe('miniDock');
    expect(transitionDiagnosticsPanelState('miniDock', 'step-expand')).toBe('compact');
    expect(transitionDiagnosticsPanelState('compact', 'step-expand')).toBe('expanded');
    expect(transitionDiagnosticsPanelState('expanded', 'step-collapse')).toBe('compact');
    expect(transitionDiagnosticsPanelState('compact', 'close')).toBe('hidden');
    expect(transitionDiagnosticsPanelState('expanded', 'close')).toBe('hidden');
  });

  it('rejects invalid intermediate transitions by staying in the current state', () => {
    expect(transitionDiagnosticsPanelState('hidden', 'close')).toBe('hidden');
    expect(transitionDiagnosticsPanelState('hidden', 'step-expand')).toBe('hidden');
    expect(transitionDiagnosticsPanelState('miniDock', 'close')).toBe('miniDock');
    expect(transitionDiagnosticsPanelState('miniDock', 'step-collapse')).toBe('miniDock');
    expect(transitionDiagnosticsPanelState('compact', 'step-collapse')).toBe('compact');
    expect(transitionDiagnosticsPanelState('expanded', 'step-expand')).toBe('expanded');
  });

  it('restores and sanitizes persisted state safely', () => {
    expect(coerceDiagnosticsPanelState('compact')).toBe('compact');
    expect(coerceDiagnosticsPanelState('mystery')).toBe('miniDock');
    expect(getLastOpenDiagnosticsPanelState('hidden')).toBe('miniDock');
    expect(getLastOpenDiagnosticsPanelState('expanded')).toBe('expanded');
  });
});

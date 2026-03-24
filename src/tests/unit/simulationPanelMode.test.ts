import { describe, expect, it } from 'vitest';
import {
  coerceDiagnosticsPanelState,
  getLastOpenDiagnosticsPanelState,
  transitionDiagnosticsPanelState,
} from '../../features/simulation/panelMode';

describe('simulation panel mode helpers', () => {
  it('allows only the declared forward and backward transitions', () => {
    expect(transitionDiagnosticsPanelState('hidden', 'launcher')).toBe('compact');
    expect(transitionDiagnosticsPanelState('compact', 'step-expand')).toBe('standard');
    expect(transitionDiagnosticsPanelState('standard', 'step-expand')).toBe('full');
    expect(transitionDiagnosticsPanelState('full', 'step-collapse')).toBe('standard');
    expect(transitionDiagnosticsPanelState('standard', 'step-collapse')).toBe('compact');
    expect(transitionDiagnosticsPanelState('compact', 'close')).toBe('hidden');
    expect(transitionDiagnosticsPanelState('full', 'close')).toBe('hidden');
  });

  it('rejects invalid intermediate transitions by staying in the current state', () => {
    expect(transitionDiagnosticsPanelState('hidden', 'close')).toBe('hidden');
    expect(transitionDiagnosticsPanelState('hidden', 'step-expand')).toBe('hidden');
    expect(transitionDiagnosticsPanelState('compact', 'step-collapse')).toBe('compact');
    expect(transitionDiagnosticsPanelState('standard', 'launcher')).toBe('standard');
    expect(transitionDiagnosticsPanelState('full', 'step-expand')).toBe('full');
  });

  it('restores and sanitizes persisted state safely', () => {
    expect(coerceDiagnosticsPanelState('standard')).toBe('standard');
    expect(coerceDiagnosticsPanelState('mystery')).toBe('compact');
    expect(getLastOpenDiagnosticsPanelState('hidden')).toBe('compact');
    expect(getLastOpenDiagnosticsPanelState('full')).toBe('full');
  });
});

import { describe, expect, it } from 'vitest';
import { compactEvents, presentEvent } from '../../features/inspector/presentation';
import { EventLogEntry } from '../../domain/schemas/types';

const baseEvent = (overrides: Partial<EventLogEntry>): EventLogEntry => ({
  id: overrides.id ?? 'e-1',
  timestamp: overrides.timestamp ?? '2026-03-29T12:00:00.000Z',
  type: overrides.type ?? 'simulation.physics',
  severity: overrides.severity ?? 'info',
  message: overrides.message ?? 'Steady-state solver currently supports series hydraulic chains.',
  targetId: overrides.targetId,
});

describe('event presentation cleanup', () => {
  it('translates known technical english messages into readable russian', () => {
    const event = presentEvent(baseEvent({
      message: 'Cavitation risk check is a placeholder. simulation.physics',
      type: 'simulation.physics',
    }));

    expect(event.uiType).toBe('Симуляция');
    expect(event.uiMessage).toMatch(/кавитационного риска/);
    expect(event.uiMessage).not.toMatch(/placeholder|solver|steady-state/i);
  });

  it('drops duplicate neighboring records and keeps unique statements', () => {
    const events = compactEvents([
      baseEvent({ id: 'a1', message: 'Tank T-01 reached max volume limit.', type: 'warning.alarm', severity: 'warning' }),
      baseEvent({ id: 'a2', message: 'Tank T-01 reached max volume limit.', type: 'warning.alarm', severity: 'warning' }),
      baseEvent({ id: 'a3', message: 'Tank T-02 reached min volume limit.', type: 'warning.alarm', severity: 'warning' }),
    ]);

    expect(events).toHaveLength(2);
    expect(events[0]!.uiMessage).toMatch(/T-01/);
    expect(events[1]!.uiMessage).toMatch(/T-02/);
  });
});

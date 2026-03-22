export interface InstrumentationPayload {
  callsite: string;
  when: string;
  why: string;
  repeatable: boolean;
  guidance: 'none' | 'throttle' | 'memoize' | 'user-triggered';
  details?: Record<string, unknown>;
}

const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';

export const instrumentCallsite = (name: string, payload: InstrumentationPayload) => {
  if (!isDev) return;
  console.debug(`[perf:${name}] ${payload.callsite}`, payload);
};

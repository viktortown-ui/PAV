export type DiagnosticsPanelState = 'hidden' | 'miniDock' | 'compact' | 'expanded';
export type DiagnosticsPanelTrigger = 'launcher' | 'step-expand' | 'step-collapse' | 'close';

export const diagnosticsPanelStateOrder: DiagnosticsPanelState[] = ['hidden', 'miniDock', 'compact', 'expanded'];
export const diagnosticsPanelStateStorageKey = 'simulation-panel-mode';
export const diagnosticsPanelLastOpenStateStorageKey = 'simulation-panel-last-open-mode';

export const diagnosticsPanelStateMachineDefinition = `
Diagnostics bottom panel state machine

States
- hidden
- miniDock
- compact
- expanded

Allowed transitions
- hidden --launcher--> miniDock
- miniDock --step-expand--> compact
- compact --step-expand--> expanded
- expanded --step-collapse--> compact
- compact --close--> hidden
- expanded --close--> hidden
`.trim();

export const isDiagnosticsPanelState = (value: string | null | undefined): value is DiagnosticsPanelState => (
  value === 'hidden' || value === 'miniDock' || value === 'compact' || value === 'expanded'
);

export const coerceDiagnosticsPanelState = (
  value: string | null | undefined,
  fallback: DiagnosticsPanelState = 'miniDock',
) => (isDiagnosticsPanelState(value) ? value : fallback);

export const getLastOpenDiagnosticsPanelState = (
  value: string | null | undefined,
  fallback: Exclude<DiagnosticsPanelState, 'hidden'> = 'miniDock',
) => {
  const nextState = coerceDiagnosticsPanelState(value, fallback);
  return nextState === 'hidden' ? fallback : nextState;
};

export const transitionDiagnosticsPanelState = (
  currentState: DiagnosticsPanelState,
  trigger: DiagnosticsPanelTrigger,
): DiagnosticsPanelState => {
  switch (currentState) {
    case 'hidden':
      return trigger === 'launcher' ? 'miniDock' : currentState;
    case 'miniDock':
      return trigger === 'step-expand' ? 'compact' : currentState;
    case 'compact':
      if (trigger === 'step-expand') return 'expanded';
      if (trigger === 'close') return 'hidden';
      return currentState;
    case 'expanded':
      if (trigger === 'step-collapse') return 'compact';
      if (trigger === 'close') return 'hidden';
      return currentState;
  }
};

export const getDiagnosticsPanelStepLabel = (state: DiagnosticsPanelState) => {
  switch (state) {
    case 'hidden':
      return 'Скрыта';
    case 'miniDock':
      return 'Мини-док';
    case 'compact':
      return 'Компактная';
    case 'expanded':
      return 'Развернутая';
  }
};

export const getDiagnosticsPanelViewportClassName = (state: DiagnosticsPanelState) => {
  switch (state) {
    case 'hidden':
      return 'is-hidden';
    case 'miniDock':
      return 'is-mini-dock';
    case 'compact':
      return 'is-compact';
    case 'expanded':
      return 'is-expanded';
  }
};

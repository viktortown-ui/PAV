export type DiagnosticsPanelState = 'hidden' | 'compact' | 'standard' | 'full';
export type DiagnosticsPanelTrigger = 'launcher' | 'step-expand' | 'step-collapse' | 'close';

export const diagnosticsPanelStateOrder: DiagnosticsPanelState[] = ['hidden', 'compact', 'standard', 'full'];
export const diagnosticsPanelStateStorageKey = 'simulation-panel-mode';
export const diagnosticsPanelLastOpenStateStorageKey = 'simulation-panel-last-open-mode';

export const diagnosticsPanelStateMachineDefinition = `
Состояния нижней панели диагностики

Состояния
- hidden
- compact
- standard
- full

Разрешённые переходы
- hidden --launcher--> compact
- compact --step-expand--> standard
- standard --step-expand--> full
- full --step-collapse--> standard
- standard --step-collapse--> compact
- compact --close--> hidden
- standard --close--> hidden
- full --close--> hidden
`.trim();

export const isDiagnosticsPanelState = (value: string | null | undefined): value is DiagnosticsPanelState => (
  value === 'hidden' || value === 'compact' || value === 'standard' || value === 'full'
);

export const coerceDiagnosticsPanelState = (
  value: string | null | undefined,
  fallback: DiagnosticsPanelState = 'compact',
) => (isDiagnosticsPanelState(value) ? value : fallback);

export const getLastOpenDiagnosticsPanelState = (
  value: string | null | undefined,
  fallback: Exclude<DiagnosticsPanelState, 'hidden'> = 'compact',
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
      return trigger === 'launcher' ? 'compact' : currentState;
    case 'compact':
      if (trigger === 'step-expand') return 'standard';
      if (trigger === 'close') return 'hidden';
      return currentState;
    case 'standard':
      if (trigger === 'step-expand') return 'full';
      if (trigger === 'step-collapse') return 'compact';
      if (trigger === 'close') return 'hidden';
      return currentState;
    case 'full':
      if (trigger === 'step-collapse') return 'standard';
      if (trigger === 'close') return 'hidden';
      return currentState;
  }
};

export const getDiagnosticsPanelStepLabel = (state: DiagnosticsPanelState) => {
  switch (state) {
    case 'hidden':
      return 'Скрыта';
    case 'compact':
      return 'Компактная панель';
    case 'standard':
      return 'Стандартная панель';
    case 'full':
      return 'Полная диагностика';
  }
};

export const getDiagnosticsPanelViewportClassName = (state: DiagnosticsPanelState) => {
  switch (state) {
    case 'hidden':
      return 'is-hidden';
    case 'compact':
      return 'is-compact';
    case 'standard':
      return 'is-standard';
    case 'full':
      return 'is-full';
  }
};

export type SimulationPanelMode = 'hidden' | 'mini' | 'compact' | 'expanded';

export const panelModeOrder: SimulationPanelMode[] = ['hidden', 'mini', 'compact', 'expanded'];
export const panelModeStorageKey = 'simulation-panel-mode';
export const panelLastOpenModeStorageKey = 'simulation-panel-last-open-mode';

export const isSimulationPanelMode = (value: string | null | undefined): value is SimulationPanelMode => (
  value === 'hidden' || value === 'mini' || value === 'compact' || value === 'expanded'
);

export const coercePanelMode = (value: string | null | undefined, fallback: SimulationPanelMode = 'mini') => (
  isSimulationPanelMode(value) ? value : fallback
);

export const cyclePanelMode = (mode: SimulationPanelMode) => {
  const currentIndex = panelModeOrder.indexOf(mode);
  return panelModeOrder[(currentIndex + 1) % panelModeOrder.length];
};

export const getLastOpenPanelMode = (value: string | null | undefined, fallback: Exclude<SimulationPanelMode, 'hidden'> = 'mini') => {
  const nextMode = coercePanelMode(value, fallback);
  return nextMode === 'hidden' ? fallback : nextMode;
};

export const getExpandToggleTarget = (mode: SimulationPanelMode): SimulationPanelMode => {
  if (mode === 'expanded') return 'compact';
  if (mode === 'compact') return 'mini';
  return 'expanded';
};

export const getOpenPanelMode = (lastOpenMode: string | null | undefined): Exclude<SimulationPanelMode, 'hidden'> => (
  getLastOpenPanelMode(lastOpenMode)
);

export const getPanelModeLabel = (mode: SimulationPanelMode) => {
  switch (mode) {
    case 'hidden': return 'Скрыта';
    case 'mini': return 'Мини-панель';
    case 'compact': return 'Компактная';
    case 'expanded': return 'Развернутая';
  }
};

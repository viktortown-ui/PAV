export type LeftFamilyKey = 'library' | 'sources' | 'vessels' | 'inline' | 'valves' | 'instrumentation' | 'topology' | 'more';
export type QuickAddCloseBehavior = 'keep-open' | 'close-drawer';

type NormalSnapshot = {
  drawerOpen: boolean;
  activeFamily: LeftFamilyKey;
};

export type LeftShellState = {
  mode: 'normal' | 'focus';
  railVisible: true;
  drawerOpen: boolean;
  activeFamily: LeftFamilyKey;
  quickAddCloseBehavior: QuickAddCloseBehavior;
  lastNormal: NormalSnapshot;
};

export type LeftShellEvent =
  | { type: 'toggle-drawer' }
  | { type: 'select-family'; family: LeftFamilyKey }
  | { type: 'enter-focus' }
  | { type: 'exit-focus' }
  | { type: 'set-quick-add-close-behavior'; behavior: QuickAddCloseBehavior }
  | { type: 'quick-add-complete' };

export const defaultLeftShellState = (): LeftShellState => ({
  mode: 'normal',
  railVisible: true,
  drawerOpen: false,
  activeFamily: 'library',
  quickAddCloseBehavior: 'close-drawer',
  lastNormal: {
    drawerOpen: false,
    activeFamily: 'library',
  },
});

export const serializeLeftShellState = (state: LeftShellState) => ({
  mode: state.mode,
  drawerOpen: state.drawerOpen,
  activeFamily: state.activeFamily,
  quickAddCloseBehavior: state.quickAddCloseBehavior,
  lastNormal: state.lastNormal,
});

export const restoreLeftShellState = (raw?: Partial<LeftShellState> | null): LeftShellState => {
  const base = defaultLeftShellState();
  if (!raw) return base;
  const activeFamily = raw.activeFamily ?? raw.lastNormal?.activeFamily ?? base.activeFamily;
  const drawerOpen = raw.mode === 'focus' ? false : raw.drawerOpen ?? base.drawerOpen;
  const lastNormal = {
    activeFamily: raw.lastNormal?.activeFamily ?? activeFamily,
    drawerOpen: raw.lastNormal?.drawerOpen ?? (raw.mode === 'focus' ? raw.drawerOpen ?? base.lastNormal.drawerOpen : drawerOpen),
  };

  return {
    mode: raw.mode === 'focus' ? 'focus' : 'normal',
    railVisible: true,
    drawerOpen,
    activeFamily,
    quickAddCloseBehavior: raw.quickAddCloseBehavior === 'keep-open' ? 'keep-open' : 'close-drawer',
    lastNormal,
  };
};

const rememberNormal = (state: LeftShellState, patch: Partial<NormalSnapshot>): NormalSnapshot => ({
  activeFamily: patch.activeFamily ?? state.activeFamily,
  drawerOpen: patch.drawerOpen ?? state.drawerOpen,
});

export const transitionLeftShell = (state: LeftShellState, event: LeftShellEvent): LeftShellState => {
  switch (event.type) {
    case 'toggle-drawer': {
      if (state.mode === 'focus') return state;
      const drawerOpen = !state.drawerOpen;
      return {
        ...state,
        drawerOpen,
        lastNormal: rememberNormal(state, { drawerOpen }),
      };
    }
    case 'select-family': {
      if (state.mode === 'focus') {
        return {
          ...state,
          mode: 'normal',
          drawerOpen: true,
          activeFamily: event.family,
          lastNormal: { activeFamily: event.family, drawerOpen: true },
        };
      }
      return {
        ...state,
        drawerOpen: true,
        activeFamily: event.family,
        lastNormal: { activeFamily: event.family, drawerOpen: true },
      };
    }
    case 'enter-focus': {
      if (state.mode === 'focus') return state;
      return {
        ...state,
        mode: 'focus',
        drawerOpen: false,
        lastNormal: rememberNormal(state, {}),
      };
    }
    case 'exit-focus': {
      if (state.mode !== 'focus') return state;
      return {
        ...state,
        mode: 'normal',
        drawerOpen: state.lastNormal.drawerOpen,
        activeFamily: state.lastNormal.activeFamily,
      };
    }
    case 'set-quick-add-close-behavior':
      return {
        ...state,
        quickAddCloseBehavior: event.behavior,
      };
    case 'quick-add-complete': {
      if (state.mode === 'focus' || state.quickAddCloseBehavior === 'keep-open') return state;
      return {
        ...state,
        drawerOpen: false,
        lastNormal: {
          ...state.lastNormal,
          activeFamily: state.activeFamily,
          drawerOpen: false,
        },
      };
    }
    default:
      return state;
  }
};

export const leftShellStateMachineDefinition = `
СОСТОЯНИЕ ЛЕВОЙ ПАНЕЛИ
- Сохраняемое состояние:
  mode ∈ {normal, focus}
  railVisible = true
  drawerOpen ∈ {true, false}
  activeFamily ∈ {library, sources, vessels, inline, valves, instrumentation, topology, more}
  quickAddCloseBehavior ∈ {keep-open, close-drawer}
  lastNormal = { drawerOpen, activeFamily }

ВИЗУАЛЬНЫЙ КОНТРАКТ
- Закрыто: rail видим, drawerOpen=false, compact-rail с иконками и tooltip.
- Открыто: rail видим, drawerOpen=true, расширенный rail с подписями инструментов.
- Смена разделов: select-family переиспользует ту же панель и меняет контент без перестроения оболочки.
- Быстрое добавление: quick-add-complete либо оставляет панель открытой, либо закрывает её по quickAddCloseBehavior.
- Режим схемы: mode=focus принудительно делает drawerOpen=false, сохраняя lastNormal для восстановления.
`;

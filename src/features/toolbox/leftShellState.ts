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
  drawerOpen: true,
  activeFamily: 'library',
  quickAddCloseBehavior: 'close-drawer',
  lastNormal: {
    drawerOpen: true,
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
LEFT SHELL STATE MACHINE
- Persistent state shape:
  mode ∈ {normal, focus}
  railVisible = true
  drawerOpen ∈ {true, false}
  activeFamily ∈ {library, sources, vessels, inline, valves, instrumentation, topology, more}
  quickAddCloseBehavior ∈ {keep-open, close-drawer}
  lastNormal = { drawerOpen, activeFamily }

VISUAL CONTRACT
- Closed: rail visible, drawerOpen=false, no reserved drawer width.
- Open: rail visible, drawerOpen=true, one overlay drawer fixed next to rail.
- Switching families: select-family always reuses the same drawer instance and swaps content in place.
- Quick add: quick-add-complete either keeps the drawer fully open or closes it fully based on quickAddCloseBehavior.
- Focus mode: mode=focus forces drawerOpen=false while preserving lastNormal for restoration.

TRANSITIONS
- toggle-drawer: normal.closed ↔ normal.open for current activeFamily.
- select-family(f):
  * normal.closed -> normal.open(activeFamily=f)
  * normal.open(a) -> normal.open(activeFamily=f)
  * focus -> normal.open(activeFamily=f)
- enter-focus: any normal state -> focus with drawer closed and lastNormal remembered exactly.
- exit-focus: focus -> normal restored from lastNormal.
- quick-add-complete:
  * close-drawer -> normal.closed(activeFamily=current)
  * keep-open -> state unchanged
  * focus -> state unchanged

FORBIDDEN STATES
- drawer width reserved while drawerOpen=false
- more than one left drawer rendered
- partial drawer states or hybrid inline/overlay collapse
`;

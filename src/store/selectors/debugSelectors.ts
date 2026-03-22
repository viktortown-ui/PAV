import { getPersistenceSchemaVersion } from '../../features/persistence/db';
import { AppState } from '../useAppStore';

export const getDebugSnapshot = (state: AppState) => ({
  selectedObject: state.selectedNodeId ?? state.selectedEdgeId,
  activeRouteStates: Array.from(new Set(state.project.edges.map((edge) => edge.data?.routeState).filter(Boolean) as string[])),
  lastCommand: state.lastCommand,
  persistenceVersion: getPersistenceSchemaVersion(),
  simulationTick: state.project.simulation.tick,
});

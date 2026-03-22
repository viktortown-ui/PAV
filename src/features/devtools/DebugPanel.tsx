import { memo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { getDebugSnapshot } from '../../store/selectors/debugSelectors';

const isDev = import.meta.env.DEV;

export const DebugPanel = memo(() => {
  const snapshot = useAppStore(getDebugSnapshot);
  if (!isDev) return null;

  return (
    <aside className="panel debug-panel">
      <div className="panel-title">Diagnostics</div>
      <div className="route-card">
        <span>Selected object: {snapshot.selectedObject ?? 'none'}</span>
        <span>Active routes: {snapshot.activeRouteStates.join(', ') || 'none'}</span>
        <span>Last command: {snapshot.lastCommand ?? 'none'}</span>
        <span>Persistence version: {snapshot.persistenceVersion}</span>
        <span>Simulation tick: {snapshot.simulationTick}</span>
      </div>
    </aside>
  );
});

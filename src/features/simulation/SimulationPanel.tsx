import { useAppStore } from '../../store/useAppStore';

export const SimulationPanel = () => {
  const simulation = useAppStore((state) => state.project.simulation);
  const setSimulationRunning = useAppStore((state) => state.setSimulationRunning);
  const setSimulationSpeed = useAppStore((state) => state.setSimulationSpeed);
  const resetProject = useAppStore((state) => state.resetProject);

  return (
    <div className="simulation-panel">
      <div className="sim-controls">
        <button onClick={() => setSimulationRunning(!simulation.running)}>{simulation.running ? 'Пауза' : 'Пуск'}</button>
        <button onClick={resetProject}>Сброс</button>
        <label>
          <span>Скорость {simulation.speed.toFixed(1)}x</span>
          <input type="range" min="0.5" max="3" step="0.5" value={simulation.speed} onChange={(e) => setSimulationSpeed(Number(e.target.value))} />
        </label>
      </div>
      <div className="sim-warnings">
        <strong>Предупреждения</strong>
        {simulation.warnings.length ? simulation.warnings.slice(0, 3).map((warning) => <span key={warning}>{warning}</span>) : <span>Активных предупреждений нет</span>}
      </div>
    </div>
  );
};

import { useAppStore } from '../../store/useAppStore';

export const SimulationPanel = () => {
  const project = useAppStore((state) => state.project);
  const selectedNodeId = useAppStore((state) => state.selectedNodeId);
  const selectedEdgeId = useAppStore((state) => state.selectedEdgeId);
  const setSimulationRunning = useAppStore((state) => state.setSimulationRunning);
  const setSimulationSpeed = useAppStore((state) => state.setSimulationSpeed);
  const toggleProblematicOnly = useAppStore((state) => state.toggleProblematicOnly);
  const issues = useAppStore((state) => state.issues);
  const showProblematicOnly = useAppStore((state) => state.showProblematicOnly);

  const selectedNode = project.nodes.find((node) => node.id === selectedNodeId);
  const selectedEdge = project.edges.find((edge) => edge.id === selectedEdgeId);
  const warningCount = issues.filter((issue) => issue.severity !== 'info').length;

  return (
    <div className="simulation-panel">
      <div className="sim-header">
        <div>
          <strong>Живое состояние схемы</strong>
          <span>Поток, блокировки и уровень — реальные данные симуляции; остальное на холсте упрощено до символов.</span>
        </div>
        <div className="sim-pills">
          <span className="sim-pill">{project.simulation.running ? 'Симуляция' : 'Редактирование'}</span>
          <span className="sim-pill">Предупреждения: {warningCount}</span>
          <span className="sim-pill">Поток: {Math.round(project.simulation.totalActiveFlow)} л/мин</span>
        </div>
      </div>

      <div className="sim-controls">
        <button onClick={() => setSimulationRunning(!project.simulation.running)}>{project.simulation.running ? 'Пауза' : 'Пуск'}</button>
        <label>
          <span>Скорость {project.simulation.speed.toFixed(1)}x</span>
          <input type="range" min="0.5" max="3" step="0.5" value={project.simulation.speed} onChange={(e) => setSimulationSpeed(Number(e.target.value))} />
        </label>
        <button onClick={toggleProblematicOnly}>{showProblematicOnly ? 'Показать всё' : 'Только проблемные'}</button>
      </div>

      <div className="status-strip compact">
        <span><strong>Среда:</strong> {project.simulation.activeMedium === 'none' ? 'нет' : project.simulation.activeMedium === 'mixed' ? 'смешанная' : project.simulation.activeMedium}</span>
        <span><strong>Последнее событие:</strong> {project.simulation.lastEvent}</span>
        <span><strong>Выбор:</strong> {selectedNode ? `${selectedNode.data.label} • ${selectedNode.data.simulation.routeState}` : selectedEdge ? `${selectedEdge.data?.sourceLabel} → ${selectedEdge.data?.targetLabel}` : 'ничего не выбрано'}</span>
      </div>
    </div>
  );
};

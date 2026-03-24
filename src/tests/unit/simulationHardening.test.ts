import { describe, expect, it } from 'vitest';
import { runSimulationStep } from '../../domain/simulation/engine';
import { buildEdge, buildNode, cloneProject, makeProject } from '../../domain/entities/projectFactory';
import { useAppStore } from '../../store/useAppStore';

const buildLinearProject = (speed: number) => {
  const project = makeProject();
  const source = buildNode('source', { x: 0, y: 0 }, project);
  const consumer = buildNode('consumer', { x: 320, y: 0 }, project);

  const sourceProcess = source.data.process as any;
  sourceProcess.canDischarge = true;
  sourceProcess.currentLevelLiters = 240;
  sourceProcess.level = 240;
  sourceProcess.capacityLiters = 400;
  sourceProcess.capacity = 400;
  sourceProcess.actualFlowLpm = 90;
  sourceProcess.flowRate = 90;
  source.data.status = 'running';

  const consumerProcess = consumer.data.process as any;
  consumerProcess.canReceive = true;
  consumerProcess.currentLevelLiters = 0;
  consumerProcess.capacityLiters = 400;
  consumer.data.status = 'idle';

  project.nodes = [source, consumer];
  project.edges = [buildEdge(source.id, consumer.id, 'water', 'DN50', undefined, project)];
  project.simulation = { ...project.simulation, speed, running: true, status: 'running' };

  return project;
};

describe('simulation hardening', () => {
  it('applies speed multiplier to hydraulic model output', () => {
    const baseline = runSimulationStep(buildLinearProject(1), 1);
    const accelerated = runSimulationStep(buildLinearProject(2), 1);

    expect(baseline.totalActiveFlow).toBeGreaterThan(0);
    expect(accelerated.totalActiveFlow).toBeGreaterThan(baseline.totalActiveFlow * 1.95);
    expect(accelerated.totalActiveFlow).toBeLessThan(baseline.totalActiveFlow * 2.05);
  });

  it('does not advance simulation ticks while paused', () => {
    const pausedProject = buildLinearProject(1);
    pausedProject.simulation.running = false;
    pausedProject.simulation.status = 'paused';
    const startTick = pausedProject.simulation.tick;

    useAppStore.setState((state) => ({ ...state, project: cloneProject(pausedProject) }));
    useAppStore.getState().tickSimulation(0.5);

    const nextState = useAppStore.getState();
    expect(nextState.project.simulation.status).toBe('paused');
    expect(nextState.project.simulation.tick).toBe(startTick);
    expect(nextState.project.edges[0]?.data?.flowRate ?? 0).toBe(0);
  });

  it('resetSimulation возвращает idle и очищает активный поток', () => {
    const runningProject = buildLinearProject(1.5);
    const activeStep = runSimulationStep(runningProject, 1);

    useAppStore.setState((state) => ({
      ...state,
      project: {
        ...runningProject,
        nodes: activeStep.nodes,
        edges: activeStep.edges,
        simulation: {
          ...runningProject.simulation,
          running: true,
          status: 'running',
          totalActiveFlow: activeStep.totalActiveFlow,
          warnings: ['Тестовое предупреждение'],
        },
      },
    }));

    useAppStore.getState().resetSimulation();

    const nextState = useAppStore.getState();
    expect(nextState.project.simulation.status).toBe('idle');
    expect(nextState.project.simulation.running).toBe(false);
    expect(nextState.project.simulation.totalActiveFlow).toBe(0);
    expect(nextState.project.edges.every((edge) => edge.animated === false)).toBe(true);
    expect(nextState.project.edges.every((edge) => (edge.data?.flowRate ?? 0) === 0)).toBe(true);
  });
});

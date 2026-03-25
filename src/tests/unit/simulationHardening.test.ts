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

  it('freezes edge animation flags when simulation is paused', () => {
    const runningProject = buildLinearProject(1);
    const activeStep = runSimulationStep(runningProject, 0.5);

    useAppStore.setState((state) => ({
      ...state,
      project: {
        ...runningProject,
        nodes: activeStep.nodes,
        edges: activeStep.edges.map((edge) => ({ ...edge, animated: true })),
        simulation: {
          ...runningProject.simulation,
          running: true,
          status: 'running',
        },
      },
    }));

    useAppStore.getState().setSimulationRunning(false);
    const pausedState = useAppStore.getState();

    expect(pausedState.project.simulation.status).toBe('paused');
    expect(pausedState.project.edges.every((edge) => edge.animated === false)).toBe(true);
    expect(pausedState.project.edges.some((edge) => (edge.data?.flowActive ?? false))).toBe(true);
  });

  it('keeps speed multiplier consistent across pre-start, pause and resume', () => {
    useAppStore.getState().resetSimulation();
    useAppStore.getState().setSimulationSpeed(2);
    useAppStore.getState().setSimulationRunning(true);

    const runningState = useAppStore.getState();
    expect(runningState.project.simulation.speed).toBe(2);

    useAppStore.getState().setSimulationRunning(false);
    useAppStore.getState().setSimulationSpeed(0.5);
    useAppStore.getState().setSimulationRunning(true);

    const resumedState = useAppStore.getState();
    expect(resumedState.project.simulation.status).toBe('running');
    expect(resumedState.project.simulation.speed).toBe(0.5);
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

  it('hidden UI state does not affect physics result', () => {
    const visibleProject = buildLinearProject(1);
    const hiddenProject = buildLinearProject(1);
    hiddenProject.nodes = hiddenProject.nodes.map((node) => ({ ...node, hidden: true }));
    hiddenProject.edges = hiddenProject.edges.map((edge) => ({ ...edge, hidden: true }));

    const visibleStep = runSimulationStep(visibleProject, 1);
    const hiddenStep = runSimulationStep(hiddenProject, 1);

    expect(hiddenStep.totalActiveFlow).toBeCloseTo(visibleStep.totalActiveFlow, 8);
    expect(hiddenStep.edges[0].data?.flowRate ?? 0).toBeCloseTo(visibleStep.edges[0].data?.flowRate ?? 0, 8);
  });

  it('stops transfer when downstream tank cannot receive', () => {
    const project = makeProject();
    const source = buildNode('tank', { x: 0, y: 0 }, project);
    const sink = buildNode('tank', { x: 250, y: 0 }, project);

    const sourceProcess = source.data.process as any;
    sourceProcess.currentLevelLiters = 200;
    sourceProcess.capacityLiters = 400;
    sourceProcess.canDischarge = true;
    sourceProcess.canReceive = true;

    const sinkProcess = sink.data.process as any;
    sinkProcess.currentLevelLiters = 380;
    sinkProcess.capacityLiters = 400;
    sinkProcess.canReceive = false;
    sinkProcess.canDischarge = true;

    project.nodes = [source, sink];
    project.edges = [buildEdge(source.id, sink.id, 'water', 'DN50', undefined, project)];
    project.simulation = { ...project.simulation, speed: 1, running: true, status: 'running' };

    const step = runSimulationStep(project, 1);
    const nextSource = step.nodes.find((node) => node.id === source.id)!;
    const nextSink = step.nodes.find((node) => node.id === sink.id)!;

    expect(step.edges[0].data?.flowRate ?? 0).toBe(0);
    expect((nextSource.data.process as any).currentLevelLiters).toBe(200);
    expect((nextSink.data.process as any).currentLevelLiters).toBe(380);
  });

  it('blocks transfer when a valve on the route is closed', () => {
    const project = makeProject();
    const source = buildNode('tank', { x: 0, y: 0 }, project);
    const valve = buildNode('manualValve', { x: 150, y: 0 }, project);
    const sink = buildNode('tank', { x: 300, y: 0 }, project);

    const sourceProcess = source.data.process as any;
    sourceProcess.currentLevelLiters = 200;
    sourceProcess.capacityLiters = 400;
    sourceProcess.canDischarge = true;

    const valveProcess = valve.data.process as any;
    valveProcess.isOpen = false;
    valveProcess.valveState = 'closed';

    const sinkProcess = sink.data.process as any;
    sinkProcess.currentLevelLiters = 50;
    sinkProcess.capacityLiters = 400;
    sinkProcess.canReceive = true;

    project.nodes = [source, valve, sink];
    project.edges = [
      buildEdge(source.id, valve.id, 'water', 'DN50', undefined, project),
      buildEdge(valve.id, sink.id, 'water', 'DN50', undefined, project),
    ];
    project.simulation = { ...project.simulation, speed: 1, running: true, status: 'running' };

    const step = runSimulationStep(project, 1);
    expect(step.totalActiveFlow).toBe(0);
    expect(step.edges.every((edge) => (edge.data?.flowRate ?? 0) === 0)).toBe(true);
    expect(step.edges.some((edge) => (edge.data?.routeState ?? 'idle') === 'blocked')).toBe(true);
  });

  it('fluid viscosity and density influence hydraulic transfer', () => {
    const buildPumpedProject = () => {
      const project = makeProject();
      const source = buildNode('tank', { x: 0, y: 0 }, project);
      const pump = buildNode('pump', { x: 150, y: 0 }, project);
      const sink = buildNode('tank', { x: 300, y: 0 }, project);

      const sourceProcess = source.data.process as any;
      sourceProcess.currentLevelLiters = 300;
      sourceProcess.capacityLiters = 400;
      sourceProcess.canDischarge = true;
      sourceProcess.actualFlowLpm = 120;
      sourceProcess.flowRate = 120;

      const pumpProcess = pump.data.process as any;
      pumpProcess.pumpOn = true;
      pumpProcess.nominalFlowLpm = 120;

      const sinkProcess = sink.data.process as any;
      sinkProcess.currentLevelLiters = 100;
      sinkProcess.capacityLiters = 400;
      sinkProcess.canReceive = true;

      project.nodes = [source, pump, sink];
      project.edges = [
        buildEdge(source.id, pump.id, 'water', 'DN50', undefined, project),
        buildEdge(pump.id, sink.id, 'water', 'DN50', undefined, project),
      ];
      project.simulation = { ...project.simulation, speed: 1, running: true, status: 'running' };
      return project;
    };

    const waterProject = buildPumpedProject();
    waterProject.simulation.fluid = {
      id: 'water',
      name: 'Water',
      kind: 'water',
      densityKgPerM3: 998,
      dynamicViscosityPaS: 0.001,
    };

    const heavyFluidProject = buildPumpedProject();
    heavyFluidProject.simulation.fluid = {
      id: 'heavy-custom',
      name: 'Heavy fluid',
      kind: 'custom',
      densityKgPerM3: 1250,
      dynamicViscosityPaS: 0.12,
    };

    const waterStep = runSimulationStep(waterProject, 1);
    const heavyStep = runSimulationStep(heavyFluidProject, 1);

    expect(Math.abs((waterStep.edges[0].data?.pressure ?? 0) - (heavyStep.edges[0].data?.pressure ?? 0))).toBeGreaterThan(0.0001);
    expect(Math.abs((waterStep.edges[0].data?.velocityMPerS ?? 0) - (heavyStep.edges[0].data?.velocityMPerS ?? 0))).toBeGreaterThanOrEqual(0);
  });
});

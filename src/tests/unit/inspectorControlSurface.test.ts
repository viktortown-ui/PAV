import { describe, expect, it } from 'vitest';
import { executeNodeCommand } from '../../domain/commands/nodeCommands';
import { cloneProject } from '../../domain/entities/projectFactory';
import { runSimulationStep } from '../../domain/simulation/engine';
import { demoProject, templates } from '../../domain/templates/templates';

const step = (project = cloneProject(demoProject)) => runSimulationStep(project, 1);

const edgeById = (edges: ReturnType<typeof step>['edges'], id: string) => edges.find((edge) => edge.id === id)!;

describe('inspector control-surface integration with physics', () => {
  it('stops upstream flow when downstream intake is forbidden', () => {
    const tank2 = cloneProject(demoProject).nodes.find((node) => node.id === 's6')!;
    const afterCommand = executeNodeCommand(cloneProject(demoProject), tank2.id, 'tank:disableReceive').project;
    const result = step(afterCommand);

    const routeEdge = edgeById(result.edges, 'se5');
    expect(routeEdge.data?.flowLpm).toBe(0);
    expect(routeEdge.animated).toBe(false);
    expect(routeEdge.data?.blocked).toBe(true);
    expect((routeEdge.data?.blockedBy ?? []).length).toBeGreaterThan(0);
  });

  it('stops route when pump is switched off', () => {
    const afterCommand = executeNodeCommand(cloneProject(demoProject), 's2', 'pump:stop').project;
    const result = step(afterCommand);

    const downstream = edgeById(result.edges, 'se2');
    expect(downstream.data?.flowLpm).toBe(0);
    expect(downstream.animated).toBe(false);
    expect(downstream.data?.blocked).toBe(true);
    expect((downstream.data?.blockedBy ?? []).length).toBeGreaterThan(0);
  });

  it('blocks downstream route when shutoff valve is closed and restores flow after reopen', () => {
    const base = cloneProject(templates['cip-fragment']);
    const closed = executeNodeCommand(base, 'c3', 'valve:close').project;
    const blocked = step(closed);
    const blockedEdge = edgeById(blocked.edges, 'ce3');
    expect(blockedEdge.data?.flowLpm).toBe(0);
    expect(blockedEdge.data?.blocked).toBe(true);
    expect((blockedEdge.data?.blockedBy ?? []).length).toBeGreaterThan(0);

    const reopened = executeNodeCommand(closed, 'c3', 'valve:open').project;
    const active = step(reopened);
    const reopenedEdge = edgeById(active.edges, 'ce3');
    expect((reopenedEdge.data?.blockedBy ?? []).join(' ')).not.toMatch(/клапан закрыт/i);
  });
});

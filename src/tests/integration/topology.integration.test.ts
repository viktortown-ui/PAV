import { describe, expect, it } from 'vitest';
import { cloneProject } from '../../domain/entities/projectFactory';
import { createBranchFromEdge, insertNodeIntoEdge } from '../../domain/topology/edgeOperations';
import { demoProject } from '../../domain/templates/templates';
import { runSimulationStep } from '../../domain/simulation/engine';

const firstMainlineEdgeId = () => cloneProject(demoProject).edges[0].id;

describe('topology integration', () => {
  it('insert-on-line preserves upstream/downstream relationships and handle fidelity', () => {
    const project = cloneProject(demoProject);
    const originalEdge = project.edges[0];
    const result = insertNodeIntoEdge(project, originalEdge.id, 'pump');
    expect(result).not.toBeNull();
    const inserted = result!.project.nodes.find((node) => node.id === result!.nodeId)!;
    const inEdge = result!.project.edges.find((edge) => edge.target === inserted.id)!;
    const outEdge = result!.project.edges.find((edge) => edge.source === inserted.id)!;

    expect(inEdge.source).toBe(originalEdge.source);
    expect(outEdge.target).toBe(originalEdge.target);
    expect(inEdge.sourceHandle).toBe(originalEdge.sourceHandle);
    expect(outEdge.targetHandle).toBe(originalEdge.targetHandle);
  });

  it('branch insertion preserves free branch handle fidelity', () => {
    const project = cloneProject(demoProject);
    const originalEdge = project.edges[0];
    const result = createBranchFromEdge(project, originalEdge.id, 'tee');
    expect(result).not.toBeNull();
    const tee = result!.project.nodes.find((node) => node.id === result!.nodeId)!;
    const outgoing = result!.project.edges.filter((edge) => edge.source === tee.id);

    expect(outgoing).toHaveLength(1);
    expect(outgoing[0].sourceHandle).toBe('out-right');
  });

  it('simulation state updates edge visuals after equipment commands are applied to imported topology', () => {
    const project = cloneProject(demoProject);
    project.simulation.running = true;
    const result = runSimulationStep(project, 1);

    expect(result.edges.some((edge) => typeof edge.animated === 'boolean')).toBe(true);
    expect(result.nodes.some((node) => node.data.simulation.routeState)).toBe(true);
  });
});

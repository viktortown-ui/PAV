import { describe, expect, it } from 'vitest';
import { executeNodeCommand } from '../../domain/commands/nodeCommands';
import { cloneProject } from '../../domain/entities/projectFactory';
import { demoProject } from '../../domain/templates/templates';

const findNode = (kind: string) => cloneProject(demoProject).nodes.find((node) => node.data.kind === kind)!;

describe('node commands', () => {
  it('updates the domain model from equipment commands', () => {
    const project = cloneProject(demoProject);
    const pump = findNode('pump');
    const result = executeNodeCommand(project, pump.id, 'pump:start');
    const updated = result.project.nodes.find((node) => node.id === pump.id)!;

    expect(result.changed).toBe(true);
    expect(updated.data.status).toBe('running');
    expect((updated.data.process as any).pumpOn).toBe(true);
    expect(result.project.simulation.lastEvent).toContain('насос запущен');
  });
});

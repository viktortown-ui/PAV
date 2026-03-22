import { describe, expect, it } from 'vitest';
import { isStoredProjectCompatible } from '../../features/persistence/db';
import { buildEdge, cloneProject } from '../../domain/entities/projectFactory';
import { demoProject } from '../../domain/templates/templates';
import { restoreProjectDocument, validateProject } from '../../domain/validation/validateProject';
import { createBranchFromEdge } from '../../domain/topology/edgeOperations';


describe('validators', () => {
  it('flags duplicate source handles', () => {
    const project = cloneProject(demoProject);
    const branched = createBranchFromEdge(project, project.edges[0].id, 'tee')!.project;
    const tee = branched.nodes.find((node) => node.data.kind === 'tee')!;
    const target = branched.nodes.find((node) => node.id !== tee.id && node.id !== branched.edges.find((edge) => edge.source === tee.id)!.target)!;
    branched.edges.push(buildEdge(tee.id, target.id, 'water', 'DN50', { sourceHandle: 'out-right', targetHandle: 'in-left' }));

    const issues = validateProject(branched);
    expect(issues.some((issue) => issue.id.includes(`source-handle-${tee.id}`))).toBe(true);
  });

  it('restores import/export while preserving topology refs', () => {
    const project = cloneProject(demoProject);
    const restored = restoreProjectDocument(JSON.parse(JSON.stringify(project)));

    expect(restored.edges).toHaveLength(project.edges.length);
    expect(restored.edges[0].sourceHandle).toBe(project.edges[0].sourceHandle);
    expect(restored.edges[0].data?.upstreamRef).toBe(project.edges[0].data?.upstreamRef);
  });

  it('triggers safe reset on incompatible persistence versions', () => {
    const project = cloneProject(demoProject);
    expect(isStoredProjectCompatible({ ...project, persistenceVersion: 999999 })).toBe(false);
  });
});

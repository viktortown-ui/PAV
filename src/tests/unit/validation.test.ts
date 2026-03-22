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

  it('rejects reverse flow through a check valve', () => {
    const project = cloneProject(demoProject);
    const valve = project.nodes.find((node) => node.data.kind === 'shutoffValve')!;
    valve.data.kind = 'checkValve';
    const guarded = project.edges.find((edge) => edge.target === valve.id) ?? project.edges[0]!;
    guarded.data = { ...guarded.data!, directionMode: 'reverse', direction: 'reverse' };

    const issues = validateProject(project);
    expect(issues.some((issue) => issue.id.includes('check-valve'))).toBe(true);
  });

  it('rejects hidden mixing outside explicit mixing nodes', () => {
    const project = cloneProject(demoProject);
    const sink = project.nodes.find((node) => node.data.kind === 'bufferTank')!;
    const source = project.nodes.find((node) => node.data.kind === 'tank')!;
    project.edges.push(buildEdge(source.id, sink.id, 'cip', 'DN40'));

    const issues = validateProject(project);
    expect(issues.some((issue) => issue.id.includes('hidden-merge') || issue.id.includes('mixing-'))).toBe(true);
  });


  it('triggers safe reset on incompatible persistence versions', () => {
    const project = cloneProject(demoProject);
    expect(isStoredProjectCompatible({ ...project, persistenceVersion: 999999 })).toBe(false);
  });
});

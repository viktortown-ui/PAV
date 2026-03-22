import { describe, expect, it } from 'vitest';
import { buildSegmentList, summarizeDiagnostics } from '../../features/editor/lineList';
import { buildEdge, buildNode, makeProject } from '../../domain/entities/projectFactory';
import { ValidationIssue } from '../../domain/schemas/types';

describe('line list helpers', () => {
  it('builds sorted segment entries with derived line tags and severities', () => {
    const source = buildNode('source', { x: 0, y: 0 });
    source.data.shortName = 'SRC';
    source.data.technicalTag = 'SRC-101';
    const tank = buildNode('tank', { x: 300, y: 0 });
    tank.data.shortName = 'TK';
    tank.data.technicalTag = 'TK-101';
    const drain = buildNode('utilityDrain', { x: 600, y: 0 });
    drain.data.shortName = 'DR';
    drain.data.technicalTag = 'DR-101';

    const processEdge = buildEdge(source.id, tank.id, 'water', 'DN80');
    processEdge.data!.upstreamRef = source.data.technicalTag;
    processEdge.data!.downstreamRef = tank.data.technicalTag;
    const drainEdge = buildEdge(tank.id, drain.id, 'waste', 'DN40');
    drainEdge.data!.lineRole = 'drain';
    drainEdge.data!.routeWarnings = ['low slope'];

    const project = { ...makeProject(), nodes: [source, tank, drain], edges: [processEdge, drainEdge] };
    const issues: ValidationIssue[] = [
      { id: 'edge-error', severity: 'error', message: 'broken', edgeIds: [drainEdge.id] },
      { id: 'edge-info', severity: 'info', message: 'note', edgeIds: [processEdge.id] },
    ];

    const entries = buildSegmentList(project, issues);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ edgeId: drainEdge.id, severity: 'error', issueCount: 1, warningCount: 1, nominalDiameter: 'DN40' });
    expect(entries[1].lineTag).toBe(`WATER-${source.data.technicalTag}-${tank.data.technicalTag}-DN80`);
  });

  it('summarizes diagnostics counts by severity', () => {
    const summary = summarizeDiagnostics([
      { id: 'a', severity: 'error', message: 'x' },
      { id: 'b', severity: 'warning', message: 'y' },
      { id: 'c', severity: 'warning', message: 'z' },
      { id: 'd', severity: 'info', message: 'i' },
    ]);

    expect(summary).toEqual({ total: 4, errors: 1, warnings: 2, infos: 1 });
  });
});

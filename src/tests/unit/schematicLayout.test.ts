import { describe, expect, it } from 'vitest';
import { buildEdge, buildNode } from '../../domain/entities/projectFactory';
import { makeProject } from '../../domain/entities/projectFactory';
import { buildSchematicLayoutLightweight, resolveEdgeAnchors } from '../../features/editor/schematicLayout';

const project = makeProject();

describe('schematic layout', () => {
  it('routes using port anchors instead of node centers', () => {
    const source = buildNode('pump', { x: 100, y: 100 }, project);
    const target = buildNode('tank', { x: 420, y: 110 }, project);
    const edge = buildEdge(source.id, target.id, 'water', 'DN65', { sourceHandle: 'out-right', targetHandle: 'in-left' }, project);
    const anchors = resolveEdgeAnchors(edge, source, target);

    expect(anchors.source.x).toBeGreaterThan(source.position.x + 120);
    expect(anchors.target.x).toBe(target.position.x);
  });

  it('keeps manual override position priority over auto layout', () => {
    const left = buildNode('source', { x: 10, y: 10 }, project);
    const right = buildNode('consumer', { x: 40, y: 40 }, project);
    const edge = buildEdge(left.id, right.id, 'water', 'DN50', { sourceHandle: 'out-right', targetHandle: 'in-left' }, project);

    const result = buildSchematicLayoutLightweight(
      [left, right],
      [edge],
      { manualNodePositions: { [right.id]: { x: 999, y: 444 } }, autoNodePositions: {} },
    );

    expect(result.positions[right.id]).toEqual({ x: 999, y: 444 });
    expect(result.routes[edge.id]?.points.length).toBeGreaterThanOrEqual(3);
  });
});

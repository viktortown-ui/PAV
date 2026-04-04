import { describe, expect, it } from 'vitest';
import { buildEdge, buildNode } from '../../domain/entities/projectFactory';
import { makeProject } from '../../domain/entities/projectFactory';
import { buildElkGraphFromProcessModel, buildSchematicLayoutLightweight, resolveEdgeAnchors } from '../../features/editor/schematicLayout';

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

  it('uses compact horizontal spacing for engineering schematic mode', () => {
    const source = buildNode('source', { x: 0, y: 0 }, project);
    const pump = buildNode('pump', { x: 0, y: 0 }, project);
    const sink = buildNode('consumer', { x: 0, y: 0 }, project);
    const e1 = buildEdge(source.id, pump.id, 'water', 'DN50', { sourceHandle: 'out-right', targetHandle: 'in-left' }, project);
    const e2 = buildEdge(pump.id, sink.id, 'water', 'DN50', { sourceHandle: 'out-right', targetHandle: 'in-left' }, project);
    const layout = buildSchematicLayoutLightweight([source, pump, sink], [e1, e2], { autoNodePositions: {}, manualNodePositions: {} });

    expect(layout.positions[pump.id].x - layout.positions[source.id].x).toBeLessThanOrEqual(200);
    expect(layout.positions[sink.id].x - layout.positions[pump.id].x).toBeLessThanOrEqual(200);
  });

  it('builds connected orthogonal routes without diagonal fragments', () => {
    const source = buildNode('source', { x: 0, y: 0 }, project);
    const branch = buildNode('tee', { x: 0, y: 0 }, project);
    const sink = buildNode('consumer', { x: 0, y: 0 }, project);
    const edge = buildEdge(source.id, branch.id, 'water', 'DN50', { sourceHandle: 'out-right', targetHandle: 'in-left' }, project);
    const edge2 = buildEdge(branch.id, sink.id, 'water', 'DN40', { sourceHandle: 'out-right', targetHandle: 'in-left' }, project);
    const layout = buildSchematicLayoutLightweight([source, branch, sink], [edge, edge2], { autoNodePositions: {}, manualNodePositions: {} });
    const route = layout.routes[edge.id];

    expect(route.points.length).toBeGreaterThanOrEqual(4);
    expect(route.points[0]).toEqual(resolveEdgeAnchors(edge, { ...source, position: layout.positions[source.id] }, { ...branch, position: layout.positions[branch.id] }).source);
    expect(route.points[route.points.length - 1]).toEqual(resolveEdgeAnchors(edge, { ...source, position: layout.positions[source.id] }, { ...branch, position: layout.positions[branch.id] }).target);
    for (let i = 1; i < route.points.length; i += 1) {
      const prev = route.points[i - 1];
      const point = route.points[i];
      expect(Math.hypot(point.x - prev.x, point.y - prev.y)).toBeGreaterThan(0);
    }
  });

  it('builds ELK graph with explicit ports and bound source/target ports', () => {
    const source = buildNode('pump', { x: 10, y: 10 }, project);
    const target = buildNode('tank', { x: 240, y: 100 }, project);
    const edge = buildEdge(source.id, target.id, 'water', 'DN50', { sourceHandle: 'out-right', targetHandle: 'in-left' }, project);
    const graph = buildElkGraphFromProcessModel([source, target], [edge]);

    expect(graph.children[0].ports.length).toBeGreaterThan(0);
    expect(graph.edges[0].sourcePort).toContain(`${source.id}:out-right`);
    expect(graph.edges[0].targetPort).toContain(`${target.id}:in-left`);
  });
});

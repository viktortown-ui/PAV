import { describe, expect, it } from 'vitest';
import { buildEdge, buildNode, makeProject } from '../../domain/entities/projectFactory';
import { buildCanonicalProcessGraph, buildElkGraphFromProcessModel, buildSchematicLayoutLightweight, resolveEdgeAnchors } from '../../features/editor/schematicLayout';

const project = makeProject();

const mapPositions = (layout: ReturnType<typeof buildSchematicLayoutLightweight>) => Object.values(layout.positions).map(({ x, y }) => `${x}:${y}`).sort();

describe('schematic layout', () => {
  it('routes using port anchors instead of node centers', () => {
    const source = buildNode('pump', { x: 100, y: 100 }, project);
    const target = buildNode('tank', { x: 420, y: 110 }, project);
    const edge = buildEdge(source.id, target.id, 'water', 'DN65', { sourceHandle: 'out-right', targetHandle: 'in-left' }, project);
    const anchors = resolveEdgeAnchors(edge, source, target);

    expect(anchors.source.x).toBeGreaterThan(source.position.x + 120);
    expect(anchors.target.x).toBe(target.position.x);
  });

  it('builds identical schematic for same topology with different simulation coordinates', () => {
    const sourceA = buildNode('source', { x: 10, y: 20 }, project);
    const pumpA = buildNode('pump', { x: 1200, y: 700 }, project);
    const sinkA = buildNode('consumer', { x: 40, y: 300 }, project);
    const edgeA1 = buildEdge(sourceA.id, pumpA.id, 'water', 'DN50', { sourceHandle: 'out-right', targetHandle: 'in-left' }, project);
    const edgeA2 = buildEdge(pumpA.id, sinkA.id, 'water', 'DN50', { sourceHandle: 'out-right', targetHandle: 'in-left' }, project);

    const sourceB = { ...sourceA, position: { x: 2000, y: 2000 } };
    const pumpB = { ...pumpA, position: { x: -800, y: 120 } };
    const sinkB = { ...sinkA, position: { x: 88, y: -440 } };

    const layoutA = buildSchematicLayoutLightweight([sourceA, pumpA, sinkA], [edgeA1, edgeA2]);
    const layoutB = buildSchematicLayoutLightweight([sourceB, pumpB, sinkB], [edgeA1, edgeA2]);

    expect(mapPositions(layoutA)).toEqual(mapPositions(layoutB));
  });

  it('changes schematic when process topology changes', () => {
    const source = buildNode('source', { x: 0, y: 0 }, project);
    const pump = buildNode('pump', { x: 0, y: 0 }, project);
    const sink = buildNode('consumer', { x: 0, y: 0 }, project);
    const e1 = buildEdge(source.id, pump.id, 'water', 'DN50', { sourceHandle: 'out-right', targetHandle: 'in-left' }, project);
    const e2 = buildEdge(pump.id, sink.id, 'water', 'DN50', { sourceHandle: 'out-right', targetHandle: 'in-left' }, project);
    const baseLayout = buildSchematicLayoutLightweight([source, pump, sink], [e1, e2]);

    const meter = buildNode('flowMeter', { x: 1400, y: -900 }, project);
    const e1a = buildEdge(source.id, meter.id, 'water', 'DN50', { sourceHandle: 'out-right', targetHandle: 'in-left' }, project);
    const e1b = buildEdge(meter.id, pump.id, 'water', 'DN50', { sourceHandle: 'out-right', targetHandle: 'in-left' }, project);
    const changedLayout = buildSchematicLayoutLightweight([source, meter, pump, sink], [e1a, e1b, e2]);

    expect(mapPositions(baseLayout)).not.toEqual(mapPositions(changedLayout));
  });

  it('keeps inline devices on process line', () => {
    const source = buildNode('source', { x: 0, y: 0 }, project);
    const valve = buildNode('shutoffValve', { x: 0, y: 0 }, project);
    const sink = buildNode('consumer', { x: 0, y: 0 }, project);
    const e1 = buildEdge(source.id, valve.id, 'water', 'DN40', { sourceHandle: 'out-right', targetHandle: 'in-left' }, project);
    const e2 = buildEdge(valve.id, sink.id, 'water', 'DN40', { sourceHandle: 'out-right', targetHandle: 'in-left' }, project);
    const layout = buildSchematicLayoutLightweight([source, valve, sink], [e1, e2]);

    expect(layout.positions[source.id].y).toBe(layout.positions[valve.id].y);
    expect(layout.positions[valve.id].y).toBe(layout.positions[sink.id].y);
  });

  it('builds canonical process graph classes for renderer pipeline', () => {
    const source = buildNode('source', { x: 10, y: 10 }, project);
    const reactor = buildNode('reactor', { x: 20, y: 20 }, project);
    const sensor = buildNode('pressureSensor', { x: 30, y: 30 }, project);
    const edge = buildEdge(source.id, reactor.id, 'product', 'DN65', { sourceHandle: 'out-right', targetHandle: 'in-left' }, project);
    const graph = buildCanonicalProcessGraph([source, reactor, sensor], [edge]);

    expect(graph.nodes.find((node) => node.id === source.id)?.class).toBe('terminal');
    expect(graph.nodes.find((node) => node.id === reactor.id)?.class).toBe('apparatus');
    expect(graph.nodes.find((node) => node.id === sensor.id)?.class).toBe('instrument');
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

import { describe, expect, it } from 'vitest';
import { buildEdge, buildNode, makeProject } from '../../domain/entities/projectFactory';
import { buildSchematicLayoutLightweight } from '../../features/editor/schematicLayout';
import { clampOverlayToShell } from '../../features/editor/overlayPositioning';
import { getSchematicSymbol } from '../../features/editor/schematicSymbols';

const project = makeProject();

describe('schematic renderer contract', () => {
  it('prefers compact symbol dimensions for schematic equipment', () => {
    const pump = buildNode('pump', { x: 0, y: 0 }, project);
    const symbol = getSchematicSymbol(pump);

    expect(symbol.shape).toBe('pump');
    expect(symbol.size.width).toBeLessThanOrEqual(130);
    expect(symbol.size.height).toBeLessThanOrEqual(76);
  });

  it('keeps schematic geometry compact and distinct from simulation card dimensions', () => {
    const valve = buildNode('shutoffValve', { x: 0, y: 0 }, project);
    const tank = buildNode('tank', { x: 0, y: 0 }, project);
    const valveSymbol = getSchematicSymbol(valve);
    const tankSymbol = getSchematicSymbol(tank);

    expect(valveSymbol.shape).toBe('valve');
    expect(valveSymbol.size.width).toBeLessThan(120);
    expect(tankSymbol.size.width).toBeLessThan(150);
  });

  it('clamps overlay menus inside shell boundaries', () => {
    const clamped = clampOverlayToShell(
      { x: 980, y: 780 },
      { width: 220, height: 180 },
      { left: 20, top: 20, right: 1020, bottom: 820 },
      { padding: 12, bottomReserved: 120 },
    );

    expect(clamped.left).toBeLessThanOrEqual(788);
    expect(clamped.top).toBeLessThanOrEqual(508);
    expect(clamped.left).toBeGreaterThanOrEqual(32);
    expect(clamped.top).toBeGreaterThanOrEqual(32);
  });

  it('hides secondary line labels in dense schematic routes', () => {
    const left = buildNode('source', { x: 0, y: 0 }, project);
    const middle = buildNode('pump', { x: 40, y: 0 }, project);
    const right = buildNode('consumer', { x: 80, y: 0 }, project);
    const e1 = buildEdge(left.id, middle.id, 'water', 'DN40', { sourceHandle: 'out-right', targetHandle: 'in-left' }, project);
    const e2 = buildEdge(middle.id, right.id, 'water', 'DN40', { sourceHandle: 'out-right', targetHandle: 'in-left' }, project);

    const layout = buildSchematicLayoutLightweight([left, middle, right], [e1, e2], { autoNodePositions: {}, manualNodePositions: {} });

    expect(layout.routes[e1.id]?.showSecondaryLabel).toBe(false);
    expect(layout.routes[e2.id]?.showSecondaryLabel).toBe(false);
  });
});

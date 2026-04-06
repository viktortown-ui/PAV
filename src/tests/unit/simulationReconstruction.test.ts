import { describe, expect, it } from 'vitest';
import { selectionOpensBottomPanel, buildRouteTrace } from '../../features/simulation/selectionController';
import { buildNodeContextActions } from '../../features/simulation/contextActionController';
import { buildNode, buildEdge, makeProject } from '../../domain/entities/projectFactory';
import { getEquipmentVisualProfile, resolveLodLevel } from '../../features/simulation/equipmentVisualRegistry';
import { validateReplacement } from '../../features/simulation/replaceWizard';
import { readFileSync } from 'node:fs';
import { getSchematicSymbol } from '../../features/editor/schematicSymbols';

describe('simulation reconstruction', () => {
  it('selection opens bottom panel', () => {
    expect(selectionOpensBottomPanel('N1', undefined)).toMatchObject({ open: true, targetType: 'node', targetId: 'N1' });
  });

  it('right click menu is capability-based', () => {
    const project = makeProject();
    const pump = buildNode('pump', { x: 0, y: 0 }, project);
    const sensor = buildNode('pressureSensor', { x: 80, y: 0 }, project);
    const pumpActions = buildNodeContextActions(pump, true, true);
    const sensorActions = buildNodeContextActions(sensor, true, true);
    expect(pumpActions.some((item) => item.id === 'start')).toBe(true);
    expect(sensorActions.some((item) => item.id === 'start')).toBe(false);
  });

  it('equipment types resolve SVG variants', () => {
    const project = makeProject();
    const valve = buildNode('gateValve', { x: 0, y: 0 }, project);
    const sensor = buildNode('flowMeter', { x: 0, y: 0 }, project);
    expect(getEquipmentVisualProfile(valve.data, 'medium').svgVariant).toContain('gateValve');
    expect(getEquipmentVisualProfile(sensor.data, 'medium').svgVariant).toContain('flowMeter');
  });

  it('state indicators are independent from category color', () => {
    const project = makeProject();
    const tank = buildNode('tank', { x: 0, y: 0 }, project);
    const running = { ...tank, data: { ...tank.data, status: 'running' as const } };
    const alarmed = { ...tank, data: { ...tank.data, status: 'alarm' as const } };
    const a = getEquipmentVisualProfile(running.data, 'medium');
    const b = getEquipmentVisualProfile(alarmed.data, 'medium');
    expect(a.categoryColor).toBe(b.categoryColor);
    expect(a.stateIndicator).not.toBe(b.stateIndicator);
  });

  it('zoom LOD changes detail density', () => {
    expect(resolveLodLevel(0.6)).toBe('far');
    expect(resolveLodLevel(0.9)).toBe('medium');
    expect(resolveLodLevel(1.2)).toBe('near');
  });

  it('replace wizard validates compatibility', () => {
    expect(validateReplacement('pump', 'dosingPump').compatible).toBe(true);
    expect(validateReplacement('pump', 'pressureSensor').compatible).toBe(false);
  });

  it('route tracing highlights upstream/downstream', () => {
    const project = makeProject();
    const source = buildNode('source', { x: 0, y: 0 }, project);
    const pump = buildNode('pump', { x: 120, y: 0 }, project);
    const sink = buildNode('consumer', { x: 240, y: 0 }, project);
    project.nodes = [source, pump, sink];
    project.edges = [buildEdge(source.id, pump.id, 'water', 'DN40', undefined, project), buildEdge(pump.id, sink.id, 'water', 'DN40', undefined, project)];
    const trace = buildRouteTrace(project, pump.id);
    expect(trace.upstream).toContain(source.id);
    expect(trace.downstream).toContain(sink.id);
  });

  it('right panel is secondary and collapsible in simulation CSS', () => {
    const css = readFileSync('src/styles/global.css', 'utf8');
    expect(css.includes('.mode-simulation .right-rail.is-drawer-open')).toBe(true);
    expect(css.includes('22vw')).toBe(true);
  });

  it('simulation renderer no longer carries legacy heavy cards', () => {
    const source = readFileSync('src/ui/nodes/ProcessNode.tsx', 'utf8');
    expect(source.includes('process-node-minimal')).toBe(true);
    expect(source.includes('node-metrics')).toBe(false);
  });

  it('schematic and simulation use different render models', () => {
    const project = makeProject();
    const pump = buildNode('pump', { x: 0, y: 0 }, project);
    const schematic = getSchematicSymbol(pump);
    const simulationVariant = getEquipmentVisualProfile(pump.data, 'medium').svgVariant;
    expect(schematic.shape).toBe('pump');
    expect(simulationVariant).toContain('machinery');
  });
});

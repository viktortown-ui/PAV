import { describe, expect, it } from 'vitest';
import { selectionOpensBottomPanel } from '../../features/simulation/selectionController';
import { buildNode, makeProject } from '../../domain/entities/projectFactory';
import { buildNodeContextActions } from '../../features/simulation/contextActionController';
import { getEquipmentVisualProfile, resolveLodLevel } from '../../features/simulation/equipmentVisualRegistry';
import { readFileSync } from 'node:fs';

describe('simulation reconstruction', () => {
  it('simulation nodes no longer use card-shell renderer', () => {
    const source = readFileSync('src/ui/nodes/ProcessNode.tsx', 'utf8');
    expect(source.includes('node-shell')).toBe(false);
    expect(source.includes('process-node-sprite')).toBe(true);
  });

  it('each equipment type maps to silhouette sprite component', () => {
    const project = makeProject();
    const pump = buildNode('pump', { x: 0, y: 0 }, project);
    const valve = buildNode('gateValve', { x: 60, y: 0 }, project);
    const flow = buildNode('flowMeter', { x: 120, y: 0 }, project);

    expect(getEquipmentVisualProfile(pump.data, 'medium').spriteComponent).toBe('PumpSprite');
    expect(getEquipmentVisualProfile(valve.data, 'medium').spriteComponent).toBe('GateValveSprite');
    expect(getEquipmentVisualProfile(flow.data, 'medium').spriteComponent).toBe('FlowmeterSprite');
  });

  it('left click opens bottom dock in peek state, not expanded by default', () => {
    expect(selectionOpensBottomPanel('N1', undefined)).toMatchObject({ dock: 'peek', targetType: 'node', targetId: 'N1' });
  });

  it('right click menu is short and capability-filtered', () => {
    const project = makeProject();
    const pump = buildNode('pump', { x: 0, y: 0 }, project);
    const sensor = buildNode('pressureSensor', { x: 80, y: 0 }, project);
    const pumpActions = buildNodeContextActions(pump, true, true);
    const sensorActions = buildNodeContextActions(sensor, true, true);

    expect(pumpActions.length).toBeLessThanOrEqual(6);
    expect(pumpActions.some((item) => item.id === 'start' || item.id === 'stop')).toBe(true);
    expect(sensorActions.some((item) => item.id === 'start' || item.id === 'stop')).toBe(false);
  });

  it('right inspector is secondary/collapsible in simulation', () => {
    const css = readFileSync('src/styles/global.css', 'utf8');
    expect(css.includes('.mode-simulation .right-rail.is-drawer-open')).toBe(true);
    expect(css.includes('20vw')).toBe(true);
  });

  it('legacy overlay info cards are absent in default simulation view', () => {
    const css = readFileSync('src/styles/global.css', 'utf8');
    expect(css.includes('.mode-simulation .edge-badge')).toBe(true);
    expect(css.includes('.mode-simulation .local-action-panel { display: none !important; }')).toBe(true);
  });

  it('zoom LOD changes label density', () => {
    expect(resolveLodLevel(0.6)).toBe('far');
    expect(resolveLodLevel(0.9)).toBe('medium');
    expect(resolveLodLevel(1.2)).toBe('near');
  });

  it('type color and state indicator are independent', () => {
    const project = makeProject();
    const tank = buildNode('tank', { x: 0, y: 0 }, project);
    const running = { ...tank, data: { ...tank.data, status: 'running' as const } };
    const alarmed = { ...tank, data: { ...tank.data, status: 'alarm' as const } };
    const a = getEquipmentVisualProfile(running.data, 'medium');
    const b = getEquipmentVisualProfile(alarmed.data, 'medium');

    expect(a.categoryColor).toBe(b.categoryColor);
    expect(a.stateIndicator).not.toBe(b.stateIndicator);
  });
});

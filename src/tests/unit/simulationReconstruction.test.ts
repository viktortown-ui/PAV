import { describe, expect, it } from 'vitest';
import { selectionOpensBottomPanel } from '../../features/simulation/selectionController';
import { buildNode, makeProject } from '../../domain/entities/projectFactory';
import { buildNodeContextActions } from '../../features/simulation/contextActionController';
import { getEquipmentVisualProfile, resolveLodLevel } from '../../features/simulation/equipmentVisualRegistry';
import { readFileSync } from 'node:fs';

describe('simulation reconstruction', () => {
  it('equipment sprites are type-distinct and not card-shells', () => {
    const spriteSource = readFileSync('src/features/simulation/EquipmentSprite.tsx', 'utf8');
    expect(spriteSource.includes('pumpSprite')).toBe(true);
    expect(spriteSource.includes('reactorSprite')).toBe(true);
    expect(spriteSource.includes('gateValveSprite')).toBe(true);
    expect(spriteSource.includes('flowmeterSprite')).toBe(true);
    expect(spriteSource.includes('rect x="0" y="0" width="80" height="80"')).toBe(false);
  });

  it('simulation nodes no longer use card-shell renderer', () => {
    const source = readFileSync('src/ui/nodes/ProcessNode.tsx', 'utf8');
    expect(source.includes('node-shell')).toBe(false);
    expect(source.includes('process-node-sprite')).toBe(true);
  });

  it('bottom dock supports hidden/peek/expanded workflow', () => {
    expect(selectionOpensBottomPanel(undefined, undefined)).toMatchObject({ dock: 'hidden' });
    expect(selectionOpensBottomPanel('N1', undefined)).toMatchObject({ dock: 'peek', targetType: 'node', targetId: 'N1' });
    const source = readFileSync('src/features/simulation/BottomWorkbenchPanel.tsx', 'utf8');
    expect(source.includes("setBottomWorkbenchDock('expanded')")).toBe(true);
    expect(source.includes("setBottomWorkbenchDock('peek')")).toBe(true);
  });

  it('simulation UI strings in workbench are Russian-localized', () => {
    const source = readFileSync('src/features/simulation/BottomWorkbenchPanel.tsx', 'utf8');
    ['Обзор', 'Управление', 'Параметры', 'Среда и физика', 'Диагностика', 'Связи', 'История'].forEach((word) => {
      expect(source.includes(word)).toBe(true);
    });
    ['Overview', 'History', 'Upstream', 'Downstream'].forEach((word) => {
      expect(source.includes(word)).toBe(false);
    });
  });

  it('raw backend keys are not rendered directly in parameter labels', () => {
    const source = readFileSync('src/features/simulation/BottomWorkbenchPanel.tsx', 'utf8');
    expect(source.includes('parameterRows.map(([key, value])')).toBe(false);
    expect(source.includes('<span>{key}</span>')).toBe(false);
  });

  it('capability-based parameter groups render by equipment type', () => {
    const source = readFileSync('src/features/simulation/BottomWorkbenchPanel.tsx', 'utf8');
    expect(source.includes('isPump')).toBe(true);
    expect(source.includes('isVessel')).toBe(true);
    expect(source.includes('isValve')).toBe(true);
    expect(source.includes('isSensor')).toBe(true);
  });

  it('right inspector is secondary/collapsible in simulation', () => {
    const css = readFileSync('src/styles/global.css', 'utf8');
    expect(css.includes('.mode-simulation .right-rail.is-drawer-open')).toBe(true);
    expect(css.includes('20vw')).toBe(true);
  });

  it('compact context menu still works', () => {
    const project = makeProject();
    const pump = buildNode('pump', { x: 0, y: 0 }, project);
    const sensor = buildNode('pressureSensor', { x: 80, y: 0 }, project);
    const pumpActions = buildNodeContextActions(pump, true, true);
    const sensorActions = buildNodeContextActions(sensor, true, true);

    expect(pumpActions.length).toBeLessThanOrEqual(6);
    expect(pumpActions.some((item) => item.id === 'start' || item.id === 'stop')).toBe(true);
    expect(sensorActions.some((item) => item.id === 'start' || item.id === 'stop')).toBe(false);
  });

  it('canvas remains free of heavy overlays in simulation mode', () => {
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

import { describe, expect, it } from 'vitest';
import { resolveEdgeDefaults, resolveNodeDefaults } from '../../domain/defaults/defaults';
import { buildNode } from '../../domain/entities/projectFactory';
import { createBranchFromEdge, insertNodeIntoEdge } from '../../domain/topology/edgeOperations';
import { templates } from '../../domain/templates/templates';
import { buildWizardInitialValues, inferWizardContext } from '../../features/equipmentWizard/schema';

describe('defaults inheritance', () => {
  it('inherits medium, role, and diameter for inserted inline instruments from selected line context', () => {
    const project = structuredClone(templates['soap-line']);
    const result = insertNodeIntoEdge(project, 'se4', 'flowMeter');
    expect(result).toBeTruthy();
    const node = result!.project.nodes.find((item) => item.id === result!.nodeId)!;
    expect(node.data.medium).toBe('product');
    expect((node.data.process as any).diameterNominal).toBe('DN50');
    expect((node.data.process as any).lineRole).toBe('process');
  });

  it('inherits water-prep template defaults for new pumps', () => {
    const project = structuredClone(templates['water-prep']);
    const context = inferWizardContext(project);
    const values = buildWizardInitialValues(project, 'pumps', 'pump', context);
    expect(values.medium).toBe('water');
    expect(values.diameterNominal).toBe('DN65');
    const node = buildNode('pump', { x: 0, y: 0 }, project, { groupId: 'pumps' });
    expect(node.data.medium).toBe('water');
    expect((node.data.process as any).diameterNominal).toBe('DN65');
  });

  it('inherits parent line defaults for branch lines deterministically', () => {
    const project = structuredClone(templates['cip-fragment']);
    const result = createBranchFromEdge(project, 'ce1', 'tee');
    expect(result).toBeTruthy();
    const newEdges = result!.project.edges.filter((edge) => edge.source === result!.nodeId || edge.target === result!.nodeId);
    expect(newEdges).toHaveLength(2);
    newEdges.forEach((edge) => {
      expect(edge.data?.medium).toBe('cip');
      expect(edge.data?.lineRole).toBe('CIP');
      expect(edge.data?.nominalDiameter).toBe('DN50');
    });
  });

  it('marks required fields from project and template defaults by group', () => {
    const project = structuredClone(templates['soap-line']);
    const defaults = resolveNodeDefaults(project, 'flowMeter', { groupId: 'instrumentation' });
    expect(defaults.requiredFields).toContain('diameterNominal');
    expect(defaults.requiredFields).toContain('warnHigh');
  });

  it('keeps naming rules deterministic through resolver', () => {
    const project = structuredClone(templates['water-prep']);
    project.defaults.project.all = { ...project.defaults.project.all, namingRule: '{prefix}-{kind}-{seq}' };
    project.defaults.template.all = { ...project.defaults.template.all, namingRule: '{prefix}-{seq}' };
    const defaults = resolveNodeDefaults(project, 'pump', { groupId: 'pumps' });
    expect(defaults.namingRule).toBe('{prefix}-{seq}');
    const edgeDefaults = resolveEdgeDefaults(project);
    expect(edgeDefaults.nominalDiameter).toBe('DN65');
  });
});

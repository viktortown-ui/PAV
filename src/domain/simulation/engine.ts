import { componentMap } from '../registry/componentRegistry';
import { SimulationSettings, SoapEdge, SoapNode } from '../schemas/types';

interface SimulationResult {
  nodes: SoapNode[];
  edges: SoapEdge[];
  warnings: string[];
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const runSimulationStep = (
  nodes: SoapNode[],
  edges: SoapEdge[],
  settings: SimulationSettings,
  dt: number,
): SimulationResult => {
  const warnings: string[] = [];
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const nextNodes = nodes.map((node) => {
    const copy = structuredClone(node);
    copy.data.simulation.active = false;
    copy.data.simulation.blocked = false;
    return copy;
  });
  const nextNodeMap = new Map(nextNodes.map((node) => [node.id, node]));

  const incomingByTarget = new Map<string, SoapEdge[]>();
  edges.forEach((edge) => {
    if (!incomingByTarget.has(edge.target)) incomingByTarget.set(edge.target, []);
    incomingByTarget.get(edge.target)!.push(edge);
  });

  const nextEdges = edges.map((edge) => {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    const sourceLevel = Number(source?.data.process.level ?? 0);
    const sourceEnabled = Boolean(source?.data.simulation.enabled);
    const valveOpen = Boolean(source?.data.process.valveOpen ?? true) && Boolean(target?.data.process.valveOpen ?? true);
    const pumpRequired = source?.data.tag.toLowerCase().includes('pump') || source?.data.label.toLowerCase().includes('насос');
    const pumpOn = pumpRequired ? Boolean(source?.data.visual.enabled) : true;
    const connected = Boolean(source && target);
    const active = connected && sourceEnabled && sourceLevel > 0 && valveOpen && pumpOn;
    const blocked = connected && !active;
    const flowRate = active ? Number(source?.data.process.flowRate ?? 0) * settings.speed : 0;

    if (blocked && source && target) {
      warnings.push(`Поток ${source.data.label} → ${target.data.label} недоступен`);
    }

    return {
      ...edge,
      animated: active,
      data: {
        ...edge.data,
        flowActive: active,
        blocked,
        flowRate,
      },
    };
  });

  nextEdges.forEach((edge) => {
    const source = nextNodeMap.get(edge.source);
    const target = nextNodeMap.get(edge.target);
    if (!source || !target) return;
    const flowRate = Number(edge.data?.flowRate ?? 0);
    const delta = (flowRate * dt) / 60;
    if (flowRate > 0) {
      source.data.simulation.active = true;
      target.data.simulation.active = true;
      source.data.status = 'active';
      target.data.status = 'active';
      if (componentMap.get(source.data.tag.toLowerCase() as never)?.type === 'reactor' || source.data.visual.mixing) {
        source.data.visual.mixing = true;
      }
      if (typeof source.data.process.level === 'number') {
        source.data.process.level = clamp(Number(source.data.process.level) - delta, 0, Number(source.data.process.capacity ?? 999999));
      }
      if (typeof target.data.process.level === 'number') {
        target.data.process.level = clamp(Number(target.data.process.level) + delta, 0, Number(target.data.process.capacity ?? 999999));
      }
    } else if (edge.data?.blocked) {
      source.data.simulation.blocked = true;
      target.data.simulation.blocked = true;
      if (Number(source.data.process.level ?? 0) <= 0) {
        source.data.status = 'warning';
        warnings.push(`Источник ${source.data.label} пуст.`);
      }
      if (source.data.process.valveOpen === false || target.data.process.valveOpen === false) {
        source.data.status = 'warning';
        target.data.status = 'warning';
      }
    }
  });

  nextNodes.forEach((node) => {
    const incoming = incomingByTarget.get(node.id) ?? [];
    const fill = Number(node.data.process.capacity)
      ? (Number(node.data.process.level ?? 0) / Number(node.data.process.capacity)) * 100
      : Number(node.data.visual.fill ?? 0);
    node.data.visual.fill = clamp(fill, 0, 100);
    if (!incoming.some((edge) => edge.data?.flowRate)) {
      node.data.visual.mixing = node.type === 'reactor' ? node.data.visual.mixing : node.data.simulation.active;
      if (!node.data.simulation.blocked && !node.data.simulation.active) {
        node.data.status = 'normal';
      }
    }
  });

  return { nodes: nextNodes, edges: nextEdges, warnings: Array.from(new Set(warnings)) };
};

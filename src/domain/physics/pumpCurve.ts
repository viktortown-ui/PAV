import { PumpEdge } from './types';

const SHUTOFF_HEAD_RATIO = 1.33;
const MAX_FLOW_RATIO = 2;

export const pumpHeadMAtFlow = (pump: PumpEdge, flowM3PerS: number): number => {
  const speedRatio = Math.max(0, pump.speedRatio ?? 1);
  if (speedRatio <= 0) return 0;

  const flowAtNominalSpeed = flowM3PerS / speedRatio;
  const ratedFlow = Math.max(pump.ratedFlowM3PerS, 1e-9);
  const ratedHead = Math.max(pump.ratedHeadM, 0);
  const shutoffHead = ratedHead * SHUTOFF_HEAD_RATIO;
  const maxFlow = ratedFlow * MAX_FLOW_RATIO;
  const normalizedFlow = Math.max(0, flowAtNominalSpeed / maxFlow);
  const headAtNominal = Math.max(0, shutoffHead * (1 - normalizedFlow ** 2));

  return headAtNominal * (speedRatio ** 2);
};

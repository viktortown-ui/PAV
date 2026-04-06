import { SoapNodeKind } from '../../domain/schemas/types';

type SpriteProps = {
  kind: SoapNodeKind;
  stroke: string;
  color: string;
};

const s = (stroke: string, width = 2.4) => ({ stroke, strokeWidth: width, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

const tankSprite = (stroke: string) => <><rect x="26" y="12" width="28" height="52" rx="12" {...s(stroke, 2.8)} /><path d="M26 24h28M26 52h28" {...s(stroke, 2.1)} /></>;
const reactorSprite = (stroke: string) => <><rect x="26" y="12" width="28" height="52" rx="12" {...s(stroke, 2.8)} /><path d="M40 8v12M32 34h16M40 34v14" {...s(stroke, 2.2)} /></>;
const pumpSprite = (stroke: string, color: string) => <><path d="M10 38h14M58 38h8" {...s(stroke, 2.8)} /><circle cx="34" cy="38" r="14" {...s(stroke, 2.8)} /><path d="M45 28h11v20H45" {...s(stroke, 2.8)} /><path d="M30 39c4-7 9-8 14-7" {...s(stroke, 2.2)} /><circle cx="34" cy="38" r="3" fill={color} /></>;
const valveSprite = (stroke: string, top = false) => <><path d="M8 38h18M54 38h18" {...s(stroke, 2.8)} /><path d="M26 24l14 14 14-14" {...s(stroke, 2.8)} /><path d="M26 52l14-14 14 14" {...s(stroke, 2.8)} />{top ? <path d="M34 16h12M37 10h6" {...s(stroke, 2)} /> : null}</>;
const checkValveSprite = (stroke: string) => <>{valveSprite(stroke)}<path d="M36 38h8" {...s(stroke, 2)} /><path d="M44 34l7 4-7 4" {...s(stroke, 2)} /></>;
const flowmeterSprite = (stroke: string, color: string) => <><path d="M8 38h16M56 38h16" {...s(stroke, 2.8)} /><circle cx="40" cy="38" r="14" {...s(stroke, 2.8)} /><path d="M32 38h16" {...s(stroke, 2.1)} /><path d="M36 41c3-5 7-6 11-5" {...s(stroke, 2.1)} /><circle cx="40" cy="38" r="2.4" fill={color} /></>;
const instrumentSprite = (stroke: string, color: string) => <><circle cx="40" cy="30" r="13" {...s(stroke, 2.6)} /><circle cx="40" cy="30" r="9" fill={color} opacity="0.15" /><path d="M40 43v14" {...s(stroke, 2.2)} /></>;
const heatExchangerSprite = (stroke: string) => <><path d="M8 38h16M56 38h16" {...s(stroke, 2.8)} /><rect x="27" y="22" width="26" height="32" rx="5" {...s(stroke, 2.8)} /><path d="M32 28l8 8 8-8M32 48l8-8 8 8" {...s(stroke, 2.1)} /></>;
const fillerSprite = (stroke: string) => <><rect x="24" y="20" width="18" height="18" rx="3" {...s(stroke, 2.8)} /><path d="M42 24h11v18" {...s(stroke, 2.8)} /><path d="M26 52h28" {...s(stroke, 2.8)} /></>;
const terminalSprite = (stroke: string) => <><path d="M8 38h24" {...s(stroke, 2.8)} /><path d="M32 24h16l10 14-10 14H32z" {...s(stroke, 2.8)} /></>;

export const EquipmentSprite = ({ kind, stroke, color }: SpriteProps) => {
  if (kind === 'tank') return tankSprite(stroke);
  if (kind === 'bufferTank') return tankSprite(stroke);
  if (kind === 'reactor' || kind === 'heatedReactor') return reactorSprite(stroke);
  if (kind === 'pump' || kind === 'dosingPump') return pumpSprite(stroke, color);
  if (['manualValve', 'shutoffValve', 'solenoidValve', 'controlValve', 'drainValve', 'reliefValve'].includes(kind)) return valveSprite(stroke);
  if (kind === 'gateValve') return valveSprite(stroke, true);
  if (kind === 'checkValve') return checkValveSprite(stroke);
  if (kind === 'flowMeter') return flowmeterSprite(stroke, color);
  if (['waterFilter', 'filterUnit', 'inlineFilter'].includes(kind)) return heatExchangerSprite(stroke);
  if (['pressureSensor', 'temperatureSensor', 'levelSensor', 'phSensor', 'conductivitySensor', 'indicator'].includes(kind)) return instrumentSprite(stroke, color);
  if (['heatExchanger', 'inlineMixer', 'roSkid'].includes(kind)) return heatExchangerSprite(stroke);
  if (kind === 'fillingStation') return fillerSprite(stroke);
  if (['source', 'consumer', 'utilityDrain', 'serviceTerminal', 'offPageConnector', 'samplePoint'].includes(kind)) return terminalSprite(stroke);
  return terminalSprite(stroke);
};

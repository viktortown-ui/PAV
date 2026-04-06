import { SoapNodeKind } from '../../domain/schemas/types';

type SpriteProps = {
  kind: SoapNodeKind;
  stroke: string;
  color: string;
};

const s = (stroke: string, width = 2.2) => ({ stroke, strokeWidth: width, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

const tankSprite = (stroke: string) => (
  <>
    <ellipse cx="40" cy="14" rx="14" ry="6" {...s(stroke, 2.4)} />
    <path d="M26 14v44c0 4 6 8 14 8s14-4 14-8V14" {...s(stroke, 2.4)} />
    <path d="M26 32h28M26 50h28" {...s(stroke, 1.9)} />
  </>
);

const bufferTankSprite = (stroke: string) => (
  <>
    <path d="M18 26h44c7 0 12 5 12 12s-5 12-12 12H18c-7 0-12-5-12-12s5-12 12-12z" {...s(stroke, 2.4)} />
    <path d="M26 30v16M54 30v16" {...s(stroke, 1.9)} />
    <path d="M14 38h-6M72 38h6" {...s(stroke, 2.2)} />
  </>
);

const reactorSprite = (stroke: string) => (
  <>
    <ellipse cx="40" cy="14" rx="14" ry="6" {...s(stroke, 2.4)} />
    <path d="M26 14v44c0 4 6 8 14 8s14-4 14-8V14" {...s(stroke, 2.4)} />
    <path d="M34 24h12M40 20v32" {...s(stroke, 2.1)} />
    <path d="M30 46h20" {...s(stroke, 1.9)} />
  </>
);

const pumpSprite = (stroke: string, color: string) => (
  <>
    <path d="M6 40h14M62 40h12" {...s(stroke, 2.4)} />
    <path d="M24 54V26h18c10 0 16 6 16 14s-6 14-16 14H24z" {...s(stroke, 2.4)} />
    <path d="M24 26l-7-6M24 54l-7 6" {...s(stroke, 2.1)} />
    <path d="M32 40c4-8 10-10 17-8" {...s(stroke, 1.9)} />
    <circle cx="31" cy="40" r="2.7" fill={color} />
  </>
);

const valveSprite = (stroke: string) => (
  <>
    <path d="M8 40h16M56 40h16" {...s(stroke, 2.3)} />
    <path d="M24 28l16 12 16-12" {...s(stroke, 2.3)} />
    <path d="M24 52l16-12 16 12" {...s(stroke, 2.3)} />
  </>
);

const gateValveSprite = (stroke: string) => (
  <>
    {valveSprite(stroke)}
    <path d="M40 18v10M33 18h14" {...s(stroke, 2)} />
    <path d="M36 14h8" {...s(stroke, 2)} />
  </>
);

const checkValveSprite = (stroke: string) => (
  <>
    <path d="M8 40h16M56 40h16" {...s(stroke, 2.3)} />
    <path d="M24 28l30 12-30 12z" {...s(stroke, 2.3)} />
    <path d="M38 33v14" {...s(stroke, 2)} />
  </>
);

const flowmeterSprite = (stroke: string, color: string) => (
  <>
    <path d="M8 40h14M58 40h14" {...s(stroke, 2.3)} />
    <circle cx="40" cy="40" r="18" {...s(stroke, 2.4)} />
    <path d="M32 40h16" {...s(stroke, 2)} />
    <path d="M35 44c3-5 7-7 12-6" {...s(stroke, 2)} />
    <circle cx="40" cy="40" r="2.4" fill={color} />
  </>
);

const filterSprite = (stroke: string) => (
  <>
    <path d="M8 40h14M58 40h14" {...s(stroke, 2.3)} />
    <rect x="24" y="24" width="32" height="32" rx="5" {...s(stroke, 2.3)} />
    <path d="M29 51l22-22" {...s(stroke, 2)} />
    <path d="M29 44l15-15" {...s(stroke, 2)} />
  </>
);

const heatExchangerSprite = (stroke: string) => (
  <>
    <path d="M8 40h14M58 40h14" {...s(stroke, 2.3)} />
    <rect x="24" y="24" width="32" height="32" rx="8" {...s(stroke, 2.3)} />
    <path d="M30 32h20M30 40h20M30 48h20" {...s(stroke, 1.9)} />
    <path d="M29 28l4 4M47 48l4 4" {...s(stroke, 1.9)} />
  </>
);

const coolerSprite = (stroke: string) => (
  <>
    {heatExchangerSprite(stroke)}
    <path d="M41 18v-6M37 16l4-4 4 4" {...s(stroke, 2)} />
  </>
);

const fillerSprite = (stroke: string) => (
  <>
    <path d="M16 58h48" {...s(stroke, 2.3)} />
    <rect x="24" y="24" width="18" height="18" rx="3" {...s(stroke, 2.3)} />
    <path d="M42 26h14v22" {...s(stroke, 2.3)} />
    <path d="M56 48c0 5-4 9-9 9" {...s(stroke, 2.1)} />
  </>
);

const terminalSprite = (stroke: string) => (
  <>
    <path d="M8 40h22" {...s(stroke, 2.3)} />
    <path d="M30 24h18l12 16-12 16H30z" {...s(stroke, 2.3)} />
    <path d="M34 40h18" {...s(stroke, 1.9)} />
  </>
);

const instrumentSprite = (stroke: string, color: string) => (
  <>
    <circle cx="40" cy="30" r="14" {...s(stroke, 2.3)} />
    <path d="M40 44v14" {...s(stroke, 2.1)} />
    <path d="M34 30h12" {...s(stroke, 2)} />
    <circle cx="40" cy="30" r="2.5" fill={color} />
  </>
);

export const EquipmentSprite = ({ kind, stroke, color }: SpriteProps) => {
  if (kind === 'tank') return tankSprite(stroke);
  if (kind === 'bufferTank') return bufferTankSprite(stroke);
  if (kind === 'reactor' || kind === 'heatedReactor') return reactorSprite(stroke);
  if (kind === 'pump' || kind === 'dosingPump') return pumpSprite(stroke, color);
  if (['manualValve', 'shutoffValve', 'solenoidValve', 'controlValve', 'drainValve', 'reliefValve'].includes(kind)) return valveSprite(stroke);
  if (kind === 'gateValve') return gateValveSprite(stroke);
  if (kind === 'checkValve') return checkValveSprite(stroke);
  if (kind === 'flowMeter') return flowmeterSprite(stroke, color);
  if (['waterFilter', 'filterUnit', 'inlineFilter'].includes(kind)) return filterSprite(stroke);
  if (['pressureSensor', 'temperatureSensor', 'levelSensor', 'phSensor', 'conductivitySensor', 'indicator'].includes(kind)) return instrumentSprite(stroke, color);
  if (['heatExchanger', 'inlineMixer'].includes(kind)) return heatExchangerSprite(stroke);
  if (kind === 'roSkid') return coolerSprite(stroke);
  if (kind === 'fillingStation') return fillerSprite(stroke);
  if (['source', 'consumer', 'utilityDrain', 'serviceTerminal', 'offPageConnector', 'samplePoint'].includes(kind)) return terminalSprite(stroke);
  return terminalSprite(stroke);
};

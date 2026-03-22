import { ComponentDefinition, SoapNodeKind } from '../domain/schemas/types';
import { componentMap } from '../domain/registry/componentRegistry';

interface Props {
  kind: SoapNodeKind;
  active?: boolean;
  definition?: ComponentDefinition;
  preview?: boolean;
}

const line = (stroke: string, width = 3.5) => ({ stroke, strokeWidth: width, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' });

const drawByKind = (kind: SoapNodeKind, stroke: string, accent: string) => {
  const s = line(stroke);
  const thin = line(stroke, 2.6);
  switch (kind) {
    case 'source': return <><path d="M8 32h18" {...s} /><path d="M26 18l18 14-18 14" {...s} /><path d="M46 12v40" {...s} /><circle cx="52" cy="32" r="4" fill={accent} opacity="0.7" /></>;
    case 'tank': return <><rect x="18" y="10" width="28" height="44" rx="10" {...s} /><path d="M18 20h28" {...thin} /><path d="M24 44h16" {...thin} /></>;
    case 'bufferTank': return <><rect x="17" y="10" width="30" height="44" rx="12" {...s} /><path d="M20 18h24" {...thin} /><path d="M24 32h16" {...thin} /><path d="M22 46h20" {...thin} /></>;
    case 'reactor': return <><rect x="17" y="10" width="30" height="42" rx="10" {...s} /><path d="M32 5v12" {...thin} /><path d="M24 26h16" {...thin} /><path d="M32 26v12" {...thin} /><path d="M24 56h16" {...thin} /></>;
    case 'heatedReactor': return <><rect x="17" y="10" width="30" height="42" rx="10" {...s} /><path d="M32 5v12" {...thin} /><path d="M24 26h16" {...thin} /><path d="M32 26v12" {...thin} /><path d="M12 18c6-4 34-4 40 0" {...thin} /><path d="M12 46c6 4 34 4 40 0" {...thin} /></>;
    case 'waterFilter': return <><rect x="18" y="8" width="28" height="48" rx="9" {...s} /><path d="M24 18h16M24 28h16M24 38h16M24 48h16" {...thin} /></>;
    case 'filterUnit': return <><rect x="16" y="10" width="32" height="44" rx="8" {...s} /><circle cx="32" cy="25" r="7" {...thin} /><path d="M22 42h20" {...thin} /></>;
    case 'roSkid': return <><rect x="10" y="18" width="24" height="28" rx="5" {...s} /><path d="M38 18h14v28H38" {...s} /><circle cx="22" cy="32" r="6" {...thin} /><path d="M42 24h6M42 32h6M42 40h6" {...thin} /></>;
    case 'fillingStation': return <><path d="M18 14h18v18H18z" {...s} /><path d="M36 18h8v18" {...s} /><path d="M20 46h24v8H20z" {...s} /><path d="M40 36c0 4-4 6-4 10" {...thin} /></>;
    case 'consumer': return <><path d="M16 18h22v10H16z" {...s} /><path d="M24 28v18" {...s} /><path d="M16 46h30" {...s} /></>;
    case 'utilityDrain': return <><path d="M32 10v24" {...s} /><path d="M18 30l14 18 14-18" {...s} /><path d="M14 54h36" {...s} /></>;
    case 'pump': return <><path d="M10 32h8" {...s} /><circle cx="28" cy="32" r="12" {...s} /><path d="M40 32h14" {...s} /><path d="M46 24l8 8-8 8" {...s} /><path d="M24 32c3-5 8-7 12-6" {...thin} /></>;
    case 'dosingPump': return <><path d="M10 32h8" {...s} /><circle cx="26" cy="32" r="10" {...s} /><path d="M36 22h8v20h-8" {...s} /><path d="M44 32h10" {...s} /><circle cx="26" cy="32" r="2.4" fill={accent} /></>;
    case 'inlineFilter': return <><path d="M8 32h14M42 32h14" {...s} /><rect x="22" y="18" width="20" height="28" rx="6" {...s} /><path d="M26 24h12M26 32h12M26 40h12" {...thin} /></>;
    case 'inlineMixer': return <><path d="M8 32h14M42 32h14" {...s} /><rect x="22" y="20" width="20" height="24" rx="4" {...s} /><path d="M26 24l12 16M38 24L26 40" {...thin} /></>;
    case 'heatExchanger': return <><path d="M8 32h12M44 32h12" {...s} /><rect x="20" y="18" width="24" height="28" rx="6" {...s} /><path d="M24 24l16 16M40 24L24 40" {...thin} /></>;
    case 'manualValve': return <><path d="M8 32h14M42 32h14" {...s} /><path d="M22 20l10 12 10-12M22 44l10-12 10 12" {...s} /><path d="M32 10v8" {...thin} /></>;
    case 'shutoffValve': return <><path d="M8 32h14M42 32h14" {...s} /><path d="M22 20l10 12 10-12M22 44l10-12 10 12" {...s} /><path d="M24 18h16" {...thin} /></>;
    case 'solenoidValve': return <><path d="M8 32h14M42 32h14" {...s} /><path d="M22 20l10 12 10-12M22 44l10-12 10 12" {...s} /><rect x="26" y="8" width="12" height="8" rx="2" {...thin} /></>;
    case 'checkValve': return <><path d="M8 32h14M42 32h14" {...s} /><path d="M22 20l10 12 10-12M22 44l10-12 10 12" {...s} /><path d="M28 32h8" {...thin} /><path d="M34 28l6 4-6 4" {...thin} /></>;
    case 'controlValve': return <><path d="M8 32h14M42 32h14" {...s} /><path d="M22 20l10 12 10-12M22 44l10-12 10 12" {...s} /><path d="M32 8v12M26 12h12" {...thin} /></>;
    case 'gateValve': return <><path d="M8 32h14M42 32h14" {...s} /><path d="M22 20l10 12 10-12M22 44l10-12 10 12" {...s} /><path d="M24 14h16" {...thin} /><path d="M28 8h8" {...thin} /></>;
    case 'drainValve': return <><path d="M8 32h14M42 32h14" {...s} /><path d="M22 20l10 12 10-12M22 44l10-12 10 12" {...s} /><path d="M32 44v10" {...thin} /><path d="M28 50h8" {...thin} /></>;
    case 'reliefValve': return <><path d="M8 32h14M42 32h14" {...s} /><path d="M22 20l10 12 10-12M22 44l10-12 10 12" {...s} /><path d="M32 8v8" {...thin} /><path d="M28 10l4-4 4 4" {...thin} /></>;
    case 'flowMeter': return <><path d="M8 32h14M42 32h14" {...s} /><circle cx="32" cy="32" r="10" {...s} /><path d="M28 34c3-5 8-7 12-6" {...thin} /></>;
    case 'pressureSensor': return <><circle cx="32" cy="24" r="10" {...s} /><path d="M32 34v12" {...s} /><path d="M24 46h16" {...s} /><path d="M32 24l5-3" {...thin} /></>;
    case 'temperatureSensor': return <><circle cx="32" cy="22" r="10" {...s} /><path d="M32 32v14" {...s} /><path d="M26 46h12" {...s} /><path d="M32 18v8" {...thin} /></>;
    case 'levelSensor': return <><circle cx="32" cy="22" r="10" {...s} /><path d="M32 32v14" {...s} /><path d="M24 46h16" {...s} /><path d="M26 26h12" {...thin} /></>;
    case 'phSensor': return <><circle cx="32" cy="22" r="10" {...s} /><path d="M32 32v14" {...s} /><path d="M24 46h16" {...s} /><path d="M27 26h10" {...thin} /><path d="M27 20h5" {...thin} /></>;
    case 'conductivitySensor': return <><circle cx="32" cy="22" r="10" {...s} /><path d="M32 32v14" {...s} /><path d="M24 46h16" {...s} /><path d="M26 18v8M38 18v8" {...thin} /></>;
    case 'indicator': return <><circle cx="32" cy="22" r="10" {...s} /><path d="M32 32v14" {...s} /><path d="M24 46h16" {...s} /><circle cx="32" cy="22" r="2.5" fill={accent} /></>;
    case 'tee': return <><path d="M10 32h44" {...s} /><path d="M32 32V10" {...s} /><circle cx="32" cy="32" r="2.8" fill={accent} /></>;
    case 'cross': return <><path d="M10 32h44" {...s} /><path d="M32 10v44" {...s} /><circle cx="32" cy="32" r="2.8" fill={accent} /></>;
    case 'collector': return <><path d="M10 32h14" {...s} /><path d="M24 20v24" {...s} /><path d="M24 20h18v24H24" {...thin} /><path d="M42 32h12" {...s} /></>;
    case 'splitter': return <><path d="M10 32h14" {...s} /><path d="M24 20h18v24H24" {...thin} /><path d="M42 32h12" {...s} /><path d="M33 20v-10" {...s} /></>;
    case 'mixingJunction': return <><path d="M10 32h14" {...s} /><path d="M24 20h18v24H24" {...thin} /><path d="M42 32h12" {...s} /><path d="M33 10v10" {...s} /><path d="M28 24l10 16M38 24L28 40" {...thin} /></>;
    case 'drainBranch': return <><path d="M10 32h44" {...s} /><path d="M32 32v14" {...s} /><path d="M26 46h12" {...s} /></>;
    case 'samplePoint': return <><path d="M10 32h44" {...s} /><path d="M32 32v-12" {...s} /><circle cx="32" cy="16" r="5" {...thin} /></>;
    default: return <rect x="14" y="14" width="36" height="36" rx="10" {...s} />;
  }
};

export const IndustrialIcon = ({ kind, active, definition, preview = false }: Props) => {
  const resolved = definition ?? componentMap.get(kind);
  const stroke = active ? '#b8f4ff' : '#d8e2f0';
  const accent = resolved?.defaults.visual.accent ?? '#8fb8ff';
  const family = resolved?.family;
  const bg = preview
    ? 'rgba(255,255,255,0.02)'
    : family === 'vessel'
      ? 'rgba(255,255,255,0.025)'
      : 'transparent';

  return <svg viewBox="0 0 64 64" role="img" aria-hidden="true"><rect x="2" y="2" width="60" height="60" rx="14" fill={bg} />{drawByKind(kind, stroke, accent)}</svg>;
};

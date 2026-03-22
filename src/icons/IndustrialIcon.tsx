import { ComponentDefinition, SoapNodeKind } from '../domain/schemas/types';
import { componentMap } from '../domain/registry/componentRegistry';

interface Props {
  kind: SoapNodeKind;
  active?: boolean;
  definition?: ComponentDefinition;
  preview?: boolean;
}

const line = (stroke: string, width = 3.2) => ({ stroke, strokeWidth: width, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' });
const fillShape = (stroke: string, fill: string, width = 2.8) => ({ stroke, fill, strokeWidth: width, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

const majorFrame = (stroke: string, accent: string) => {
  const s = line(stroke, 2.4);
  return <><rect x="8" y="6" width="48" height="52" rx="16" {...s} opacity="0.28" /><path d="M15 14h34" {...s} opacity="0.18" /><circle cx="48" cy="16" r="3" fill={accent} opacity="0.75" /></>;
};

const machineryGuides = (stroke: string) => {
  const s = line(stroke, 2.2);
  return <><path d="M6 32h10" {...s} opacity="0.55" /><path d="M48 32h10" {...s} opacity="0.55" /></>;
};

const valveGuides = (stroke: string) => {
  const s = line(stroke, 2.4);
  return <><path d="M6 32h14" {...s} /><path d="M44 32h14" {...s} /></>;
};

const instrumentBadge = (stroke: string, accent: string) => {
  const s = line(stroke, 2.4);
  return <><circle cx="32" cy="28" r="13" {...s} /><circle cx="32" cy="28" r="10.5" fill={accent} opacity="0.08" /><path d="M32 41v11" {...s} opacity="0.85" /></>;
};

const topologyFrame = (stroke: string, accent: string) => {
  const s = line(stroke, 2.4);
  return <circle cx="32" cy="32" r="2.6" fill={accent} stroke={stroke} strokeWidth="1.4" />;
};

const terminalFrame = (stroke: string, accent: string) => {
  const s = line(stroke, 2.2);
  return <><rect x="10" y="10" width="44" height="44" rx="12" {...s} opacity="0.16" /><path d="M18 18h28" {...s} opacity="0.15" /><circle cx="46" cy="18" r="2.6" fill={accent} opacity="0.65" /></>;
};

const drawByKind = (kind: SoapNodeKind, stroke: string, accent: string) => {
  const s = line(stroke);
  const thin = line(stroke, 2.2);
  const solid = fillShape(stroke, accent, 2.2);

  switch (kind) {
    case 'source': return <>{majorFrame(stroke, accent)}<path d="M16 32h12" {...s} /><path d="M28 20l18 12-18 12" {...s} /><path d="M46 15v34" {...thin} /></>;
    case 'tank': return <>{majorFrame(stroke, accent)}<path d="M20 12h24" {...thin} /><rect x="19" y="10" width="26" height="44" rx="10" {...s} /><path d="M19 21h26" {...thin} /><path d="M25 43h14" {...thin} /></>;
    case 'bufferTank': return <>{majorFrame(stroke, accent)}<rect x="18" y="10" width="28" height="44" rx="12" {...s} /><path d="M20 18h24" {...thin} /><path d="M24 30h16" {...thin} /><path d="M22 42h20" {...thin} /><path d="M14 24h4M46 24h4" {...thin} /></>;
    case 'reactor': return <>{majorFrame(stroke, accent)}<rect x="18" y="10" width="28" height="44" rx="10" {...s} /><path d="M32 6v10" {...thin} /><path d="M24 25h16" {...thin} /><path d="M32 25v13" {...thin} /><path d="M25 50h14" {...thin} /></>;
    case 'heatedReactor': return <>{majorFrame(stroke, accent)}<rect x="19" y="10" width="26" height="44" rx="10" {...s} /><path d="M32 6v10" {...thin} /><path d="M24 25h16" {...thin} /><path d="M32 25v13" {...thin} /><path d="M14 18c8-5 28-5 36 0" {...thin} /><path d="M14 46c8 5 28 5 36 0" {...thin} /></>;
    case 'waterFilter': return <>{majorFrame(stroke, accent)}<rect x="19" y="9" width="26" height="46" rx="10" {...s} /><path d="M24 18h16M24 26h16M24 34h16M24 42h16" {...thin} /><path d="M22 48h20" {...thin} /></>;
    case 'filterUnit': return <>{majorFrame(stroke, accent)}<rect x="16" y="12" width="32" height="40" rx="8" {...s} /><path d="M22 18h20" {...thin} /><circle cx="32" cy="31" r="7" {...thin} /><path d="M22 44h20" {...thin} /></>;
    case 'roSkid': return <>{majorFrame(stroke, accent)}<rect x="13" y="16" width="14" height="30" rx="4" {...s} /><rect x="37" y="16" width="14" height="30" rx="4" {...s} /><path d="M27 22h10M27 32h10M27 40h10" {...thin} /><path d="M18 24v14M46 24v14" {...thin} /></>;
    case 'fillingStation': return <>{majorFrame(stroke, accent)}<rect x="16" y="14" width="18" height="18" rx="3" {...s} /><path d="M34 18h10v18" {...s} /><path d="M19 43h24" {...s} /><path d="M42 36c0 4-4 7-4 10" {...thin} /></>;

    case 'pump': return <>{machineryGuides(stroke)}<circle cx="30" cy="32" r="11" {...s} /><path d="M40 24h8v16h-8" {...s} /><path d="M26 32c3-5 8-6 12-5" {...thin} /></>;
    case 'dosingPump': return <>{machineryGuides(stroke)}<circle cx="26" cy="32" r="9" {...s} /><rect x="36" y="22" width="10" height="20" rx="2" {...s} /><path d="M41 18v8" {...thin} /><circle cx="26" cy="32" r="2.6" fill={accent} /></>;
    case 'inlineFilter': return <>{machineryGuides(stroke)}<rect x="20" y="18" width="24" height="28" rx="5" {...s} /><path d="M24 24h16M24 32h16M24 40h16" {...thin} /></>;
    case 'inlineMixer': return <>{machineryGuides(stroke)}<rect x="20" y="20" width="24" height="24" rx="4" {...s} /><path d="M24 24l16 16M40 24L24 40" {...thin} /><path d="M32 16v4M32 44v4" {...thin} /></>;
    case 'heatExchanger': return <>{machineryGuides(stroke)}<rect x="19" y="18" width="26" height="28" rx="5" {...s} /><path d="M24 24l8 8 8-8" {...thin} /><path d="M24 40l8-8 8 8" {...thin} /><path d="M24 18v28M40 18v28" {...thin} opacity="0.55" /></>;

    case 'manualValve': return <>{valveGuides(stroke)}<path d="M20 21l12 11 12-11" {...s} /><path d="M20 43l12-11 12 11" {...s} /><path d="M32 10v8" {...thin} /></>;
    case 'shutoffValve': return <>{valveGuides(stroke)}<path d="M20 21l12 11 12-11" {...s} /><path d="M20 43l12-11 12 11" {...s} /><path d="M24 17h16" {...thin} /></>;
    case 'solenoidValve': return <>{valveGuides(stroke)}<path d="M20 21l12 11 12-11" {...s} /><path d="M20 43l12-11 12 11" {...s} /><rect x="26" y="8" width="12" height="8" rx="2" {...thin} /></>;
    case 'checkValve': return <>{valveGuides(stroke)}<path d="M20 21l12 11 12-11" {...s} /><path d="M20 43l12-11 12 11" {...s} /><path d="M28 32h8" {...thin} /><path d="M34 28l6 4-6 4" {...thin} /></>;
    case 'controlValve': return <>{valveGuides(stroke)}<path d="M20 21l12 11 12-11" {...s} /><path d="M20 43l12-11 12 11" {...s} /><path d="M32 8v11M26 13h12" {...thin} /></>;
    case 'gateValve': return <>{valveGuides(stroke)}<path d="M20 21l12 11 12-11" {...s} /><path d="M20 43l12-11 12 11" {...s} /><path d="M25 15h14M28 10h8" {...thin} /></>;
    case 'drainValve': return <>{valveGuides(stroke)}<path d="M20 21l12 11 12-11" {...s} /><path d="M20 43l12-11 12 11" {...s} /><path d="M32 43v9" {...thin} /><path d="M28 50h8" {...thin} /></>;
    case 'reliefValve': return <>{valveGuides(stroke)}<path d="M20 21l12 11 12-11" {...s} /><path d="M20 43l12-11 12 11" {...s} /><path d="M32 8v8" {...thin} /><path d="M28 11l4-4 4 4" {...thin} /></>;

    case 'flowMeter': return <>{instrumentBadge(stroke, accent)}<path d="M22 28h20" {...thin} /><path d="M28 31c2-4 5-6 9-5" {...thin} /></>;
    case 'pressureSensor': return <>{instrumentBadge(stroke, accent)}<path d="M32 28l5-4" {...thin} /><path d="M24 35h16" {...thin} /></>;
    case 'temperatureSensor': return <>{instrumentBadge(stroke, accent)}<path d="M32 22v10" {...thin} /><circle cx="32" cy="34" r="3" {...thin} /></>;
    case 'levelSensor': return <>{instrumentBadge(stroke, accent)}<path d="M24 34h16" {...thin} /><path d="M27 24v10M37 24v10" {...thin} opacity="0.7" /></>;
    case 'phSensor': return <>{instrumentBadge(stroke, accent)}<path d="M26 31h10" {...thin} /><path d="M26 24h5" {...thin} /></>;
    case 'conductivitySensor': return <>{instrumentBadge(stroke, accent)}<path d="M27 22v12M37 22v12" {...thin} /><path d="M24 36h16" {...thin} opacity="0.75" /></>;
    case 'indicator': return <>{instrumentBadge(stroke, accent)}<circle cx="32" cy="28" r="3.2" fill={accent} /><path d="M32 22v2" {...thin} /></>;

    case 'tee': return <><path d="M10 32h44" {...s} /><path d="M32 32V12" {...s} />{topologyFrame(stroke, accent)}</>;
    case 'cross': return <><path d="M10 32h44" {...s} /><path d="M32 10v44" {...s} />{topologyFrame(stroke, accent)}</>;
    case 'collector': return <><path d="M10 32h12" {...s} /><path d="M22 20v24" {...s} /><path d="M22 20h18v24H22" {...thin} /><path d="M40 32h14" {...s} /></>;
    case 'splitter': return <><path d="M10 32h12" {...s} /><path d="M22 20h18v24H22" {...thin} /><path d="M40 32h14" {...s} /><path d="M31 20V10" {...s} /></>;
    case 'mixingJunction': return <><path d="M10 32h12" {...s} /><path d="M22 20h18v24H22" {...thin} /><path d="M40 32h14" {...s} /><path d="M31 10v10" {...s} /><path d="M26 24l10 16M36 24L26 40" {...thin} /></>;
    case 'drainBranch': return <><path d="M10 32h44" {...s} /><path d="M32 32v14" {...s} /><path d="M28 46h8" {...s} /></>;

    case 'samplePoint': return <>{terminalFrame(stroke, accent)}<path d="M10 32h44" {...s} /><path d="M32 32V20" {...s} /><circle cx="32" cy="16" r="5" {...thin} /></>;
    case 'consumer': return <>{terminalFrame(stroke, accent)}<path d="M18 20h18v10H18z" {...s} /><path d="M24 30v14" {...s} /><path d="M16 46h30" {...s} /></>;
    case 'utilityDrain': return <>{terminalFrame(stroke, accent)}<path d="M32 12v20" {...s} /><path d="M20 30l12 16 12-16" {...s} /><path d="M16 50h32" {...s} /></>;
    case 'offPageConnector': return <>{terminalFrame(stroke, accent)}<path d="M12 32h18" {...s} /><path d="M30 18h14l8 14-8 14H30z" {...s} /></>;
    case 'serviceTerminal': return <>{terminalFrame(stroke, accent)}<path d="M12 32h18" {...s} /><rect x="30" y="20" width="16" height="24" rx="4" {...s} /><path d="M38 16v8M34 24h8" {...thin} /></>;
    default: return <rect x="14" y="14" width="36" height="36" rx="10" {...solid} opacity="0.2" />;
  }
};

export const IndustrialIcon = ({ kind, active, definition, preview = false }: Props) => {
  const resolved = definition ?? componentMap.get(kind);
  const stroke = active ? '#d8fbff' : '#d8e2f0';
  const accent = resolved?.defaults.visual.accent ?? '#8fb8ff';
  const family = resolved?.family;
  const bg = preview
    ? 'rgba(255,255,255,0.03)'
    : family === 'vessel'
      ? 'rgba(255,255,255,0.028)'
      : family === 'terminal'
        ? 'rgba(255,255,255,0.018)'
        : 'transparent';

  return <svg viewBox="0 0 64 64" role="img" aria-hidden="true"><rect x="2" y="2" width="60" height="60" rx="14" fill={bg} />{drawByKind(kind, stroke, accent)}</svg>;
};

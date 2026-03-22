import { SoapNodeKind } from '../domain/schemas/types';

interface Props { kind: SoapNodeKind; active?: boolean; }

export const IndustrialIcon = ({ kind, active }: Props) => {
  const stroke = active ? '#b2f3ff' : '#d8e2f0';
  switch (kind) {
    case 'source': return <svg viewBox="0 0 64 64"><path d="M8 32h24" stroke={stroke} strokeWidth="4" /><path d="M24 18l18 14-18 14" stroke={stroke} strokeWidth="4" fill="none" /><path d="M46 12v40" stroke={stroke} strokeWidth="4" /></svg>;
    case 'waterFilter': case 'filterUnit': case 'inlineFilter': return <svg viewBox="0 0 64 64"><rect x="20" y="8" width="24" height="48" rx="12" fill="none" stroke={stroke} strokeWidth="4" /><path d="M24 18h16M24 32h16M24 46h16" stroke={stroke} strokeWidth="3" /></svg>;
    case 'roSkid': return <svg viewBox="0 0 64 64"><rect x="10" y="18" width="30" height="28" rx="6" fill="none" stroke={stroke} strokeWidth="4" /><path d="M40 24h12M40 40h12M52 20v24" stroke={stroke} strokeWidth="3" /><circle cx="22" cy="32" r="5" fill="none" stroke={stroke} strokeWidth="3" /></svg>;
    case 'tank': case 'bufferTank': return <svg viewBox="0 0 64 64"><path d="M18 16h28v34a10 10 0 0 1-10 10H28A10 10 0 0 1 18 50z" fill="none" stroke={stroke} strokeWidth="4" /><path d="M18 22h28" stroke={stroke} strokeWidth="3" /></svg>;
    case 'reactor': case 'heatedReactor': return <svg viewBox="0 0 64 64"><path d="M18 14h28v36a10 10 0 0 1-10 10H28A10 10 0 0 1 18 50z" fill="none" stroke={stroke} strokeWidth="4" /><path d="M32 6v16M24 22h16M32 22v14" stroke={stroke} strokeWidth="3" />{kind === 'heatedReactor' && <path d="M14 18c4-6 32-6 36 0M14 46c4 6 32 6 36 0" stroke={stroke} strokeWidth="3" fill="none" />}</svg>;
    case 'pump': case 'dosingPump': return <svg viewBox="0 0 64 64"><circle cx="26" cy="32" r="12" fill="none" stroke={stroke} strokeWidth="4" /><path d="M38 32h18M48 22l8 10-8 10" fill="none" stroke={stroke} strokeWidth="4" /><path d="M12 32h6" stroke={stroke} strokeWidth="4" /></svg>;
    case 'manualValve': case 'shutoffValve': case 'solenoidValve': case 'checkValve': case 'controlValve': case 'gateValve': case 'drainValve': case 'reliefValve': return <svg viewBox="0 0 64 64"><path d="M8 32h16M40 32h16" stroke={stroke} strokeWidth="4" /><path d="M24 18l8 14 8-14M24 46l8-14 8 14" fill="none" stroke={stroke} strokeWidth="4" /></svg>;
    case 'flowMeter': case 'pressureSensor': case 'temperatureSensor': case 'levelSensor': case 'phSensor': case 'conductivitySensor': case 'indicator': return <svg viewBox="0 0 64 64"><circle cx="32" cy="28" r="10" fill="none" stroke={stroke} strokeWidth="4" /><path d="M32 38v14M24 52h16" stroke={stroke} strokeWidth="4" /></svg>;
    case 'tee': return <svg viewBox="0 0 64 64"><path d="M10 32h44M32 32V10" stroke={stroke} strokeWidth="4" /></svg>;
    case 'cross': return <svg viewBox="0 0 64 64"><path d="M10 32h44M32 10v44" stroke={stroke} strokeWidth="4" /></svg>;
    case 'collector': case 'splitter': case 'mixingJunction': case 'drainBranch': case 'samplePoint': return <svg viewBox="0 0 64 64"><rect x="18" y="18" width="28" height="28" rx="6" fill="none" stroke={stroke} strokeWidth="4" /><path d="M10 32h8M46 32h8M32 10v8M32 46v8" stroke={stroke} strokeWidth="3" /></svg>;
    case 'fillingStation': case 'consumer': return <svg viewBox="0 0 64 64"><path d="M14 18h24v10H14zM38 18v16h8v10" fill="none" stroke={stroke} strokeWidth="4" /><path d="M18 44h28v10H18z" fill="none" stroke={stroke} strokeWidth="4" /></svg>;
    case 'utilityDrain': case 'heatExchanger': return <svg viewBox="0 0 64 64"><path d="M32 10v34" stroke={stroke} strokeWidth="4" /><path d="M18 32l14 18 14-18" fill="none" stroke={stroke} strokeWidth="4" /><path d="M12 54h40" stroke={stroke} strokeWidth="4" /></svg>;
    default: return <svg viewBox="0 0 64 64"><rect x="14" y="14" width="36" height="36" rx="10" fill="none" stroke={stroke} strokeWidth="4" /></svg>;
  }
};

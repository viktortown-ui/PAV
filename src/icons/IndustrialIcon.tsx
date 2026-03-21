import { SoapNodeKind } from '../domain/schemas/types';

interface Props {
  kind: SoapNodeKind;
  active?: boolean;
}

export const IndustrialIcon = ({ kind, active }: Props) => {
  const stroke = active ? '#9ce9ff' : '#d9e3f0';
  switch (kind) {
    case 'tank':
    case 'reactor':
      return <svg viewBox="0 0 64 64"><rect x="14" y="10" width="36" height="44" rx="10" fill="none" stroke={stroke} strokeWidth="3" />{kind === 'reactor' && <path d="M32 4v14M24 20h16M32 20v10" stroke={stroke} strokeWidth="3" />} </svg>;
    case 'pump':
      return <svg viewBox="0 0 64 64"><circle cx="28" cy="32" r="12" fill="none" stroke={stroke} strokeWidth="3" /><path d="M40 32h12M46 26l8 6-8 6" stroke={stroke} strokeWidth="3" fill="none" /></svg>;
    case 'valve':
      return <svg viewBox="0 0 64 64"><path d="M12 32h40" stroke={stroke} strokeWidth="3" /><path d="M22 18l10 14-10 14M42 18L32 32l10 14" stroke={stroke} strokeWidth="3" fill="none" /></svg>;
    case 'filter':
    case 'ro':
      return <svg viewBox="0 0 64 64"><rect x="18" y="10" width="28" height="44" rx="8" fill="none" stroke={stroke} strokeWidth="3" /><path d="M24 20h16M24 32h16M24 44h16" stroke={stroke} strokeWidth="3" /></svg>;
    case 'sensor':
      return <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="10" fill="none" stroke={stroke} strokeWidth="3" /><path d="M32 10v8M10 32h8M46 32h8M32 46v8" stroke={stroke} strokeWidth="3" /></svg>;
    case 'filling':
      return <svg viewBox="0 0 64 64"><path d="M16 18h24v10H16zM36 28h8v10h-8zM20 38h24v12H20z" fill="none" stroke={stroke} strokeWidth="3" /></svg>;
    case 'inlet':
      return <svg viewBox="0 0 64 64"><path d="M10 32h28M30 20l12 12-12 12" stroke={stroke} strokeWidth="3" fill="none" /><path d="M46 18v28" stroke={stroke} strokeWidth="3" /></svg>;
    default:
      return <svg viewBox="0 0 64 64"><rect x="16" y="16" width="32" height="32" rx="8" fill="none" stroke={stroke} strokeWidth="3" /></svg>;
  }
};

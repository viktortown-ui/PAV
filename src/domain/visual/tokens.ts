import { MediumType, RouteState } from '../schemas/types';

export const mediumPalette: Record<MediumType, { base: string; glow: string; fill: string }> = {
  water: { base: '#63b9ff', glow: '#8de9ff', fill: '#4f9cff' },
  product: { base: '#39d4c7', glow: '#6de7d6', fill: '#1ca99f' },
  cip: { base: '#e9b75c', glow: '#ffd489', fill: '#d69028' },
  waste: { base: '#788296', glow: '#8f9ab1', fill: '#576275' },
};

export const routeTone: Record<RouteState, string> = {
  idle: '#607086',
  primed: '#7fb6ff',
  flowing: '#7de6ff',
  blocked: '#ff9a5b',
  starved: '#f7c86f',
  draining: '#90a2b5',
  cip: '#ffd37a',
  alarm: '#ff6b6b',
  maintenance: '#b794f4',
  offline: '#465366',
};

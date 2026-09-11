import type { Balance } from './types.js';
export function cascadeMultiplier(cascade: number, balance: Balance): number {
  if (!Number.isInteger(cascade) || cascade < 1) throw new Error('Cascade index starts at 1');
  return Math.min(balance.maxCascadeMultiplier, 1 + (cascade - 1) * balance.cascadeStep);
}
export function scoreClear(count: number, cascade: number, balance: Balance): number {
  if (!Number.isInteger(count) || count < 0) throw new Error('Invalid clear count');
  return Math.round(count * balance.tileScore * cascadeMultiplier(cascade, balance));
}

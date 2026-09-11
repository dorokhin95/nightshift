import { DEFAULT_CONFIG } from '../../config/balance.js';
import type { Save } from './types.js';
const clone = <T>(input: T): T => JSON.parse(JSON.stringify(input)) as T;
/** Only a known v1 format is migrated. Migration never changes board, RNG, score or original input. */
export function migrateSave(value: unknown): Save {
  if (!value || typeof value !== 'object') throw new Error('Invalid save');
  const input = value as Record<string, unknown>;
  if (input.saveVersion === 2 && input.rulesVersion === 'mvp2-v1') return clone(value) as Save;
  if (input.saveVersion !== 1 || input.rulesVersion !== 'mvp1-v1') throw new Error('Unsupported save version');
  const legacy = clone(input) as Record<string, unknown>;
  const config = legacy.config as Save['config'];
  const stats = legacy.stats as Save['stats'];
  if (!config?.balance || !stats) throw new Error('Invalid legacy save');
  return { ...legacy, saveVersion: 2, rulesVersion: 'mvp2-v1',
    config: { ...config, balance: { ...DEFAULT_CONFIG.balance, ...config.balance } },
    stats: { ...stats, specialsCreated: 0, specialsActivated: 0, specialCombos: 0 } } as Save;
}

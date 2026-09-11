import type { GameConfig } from '../game/core/types.js';
/** All gameplay tuning lives here; rulesVersion must change if defaults change. */
export const DEFAULT_CONFIG: Readonly<GameConfig> = Object.freeze({
  width: 8, height: 8, tileCount: 6,
  balance: Object.freeze({ tileScore: 100, cascadeStep: 0.25, maxCascadeMultiplier: 3,
    maxCascades: 256, shuffleAttempts: 4096, generationAttempts: 256,
    bombRadius: 2, doubleBombRadius: 4, comboLineRadius: 1,
    specialCreateBonus: 200, specialActivateBonus: 100, specialComboBonus: 500 }),
});
export const TILE_NAMES = ['beer', 'pizza', 'burger', 'shot', 'fries', 'pretzel'] as const;

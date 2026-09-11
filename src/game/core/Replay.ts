import { DEFAULT_CONFIG } from '../../config/balance.js';
import { Game } from './Game.js';
import type { GameConfig, Move, Save } from './types.js';
/** The caller must use server-owned seed, config and move limit, never client-provided rules. */
export function replay(seed: number, moves: readonly Move[], config: GameConfig = DEFAULT_CONFIG, moveLimit = 50): Save {
  if (!Number.isInteger(moveLimit) || moveLimit < 0 || moveLimit > 10000 || !Array.isArray(moves) || moves.length > moveLimit) {
    throw new Error('Invalid replay length');
  }
  const game = new Game(seed, config);
  for (let i = 0; i < moves.length; i++) {
    const result = game.swap(moves[i]!);
    if (!result.accepted) throw new Error(`Invalid replay move ${i}: ${result.reason}`);
  }
  return game.snapshot();
}

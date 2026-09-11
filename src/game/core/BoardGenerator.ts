import { isSpecial } from './Tile.js';
import { validateConfig, cloneBoard } from './Board.js';
import { findMatches } from './MatchFinder.js';
import { findPossibleMoves } from './MoveValidator.js';
import { Rng } from './Rng.js';
import type { Board, GameConfig } from './types.js';
export function generateBoard(config: GameConfig, rng: Rng): Board {
  validateConfig(config);
  for (let attempt = 0; attempt < config.balance.generationAttempts; attempt++) {
    const board: Board = { width: config.width, height: config.height, cells: [] };
    for (let row = 0; row < board.height; row++) {
      for (let col = 0; col < board.width; col++) {
        const index = row * board.width + col;
        const choices = Array.from({ length: config.tileCount }, (_, n) => n).filter(tile =>
          !(col >= 2 && board.cells[index - 1] === tile && board.cells[index - 2] === tile) &&
          !(row >= 2 && board.cells[index - board.width] === tile && board.cells[index - board.width * 2] === tile));
        board.cells.push(choices[rng.integer(choices.length)]!);
      }
    }
    if (findPossibleMoves(board, 1).length) return board;
  }
  throw new Error('Board generation budget exhausted');
}
/** Preserves the exact multiset. An impossible shuffle is reported, never silently replaced with new tiles. */
export function shuffleBoard(board: Board, rng: Rng, attempts: number): Board {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const candidate = cloneBoard(board);
    const ordinary = candidate.cells.map((tile, index) => isSpecial(tile) ? -1 : index).filter(index => index >= 0);
    for (let i = ordinary.length - 1; i > 0; i--) {
      const a = ordinary[i]!; const b = ordinary[rng.integer(i + 1)]!;
      [candidate.cells[a], candidate.cells[b]] = [candidate.cells[b]!, candidate.cells[a]!];
    }
    if (!findMatches(candidate).length && findPossibleMoves(candidate, 1).length) return candidate;
  }
  throw new Error('No stable playable permutation found within shuffle budget');
}

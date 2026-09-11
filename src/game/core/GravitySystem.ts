import { cloneBoard } from './Board.js';
import type { Board } from './types.js';
import { Rng } from './Rng.js';
/** Pure stable compaction: pieces never cross columns or change their vertical order. */
export function applyGravity(input: Board): Board {
  const board = cloneBoard(input);
  for (let x = 0; x < board.width; x++) {
    let targetY = board.height - 1;
    for (let y = board.height - 1; y >= 0; y--) {
      const tile = input.cells[y * board.width + x];
      if (tile !== null && tile !== undefined) board.cells[targetY-- * board.width + x] = tile;
    }
    while (targetY >= 0) board.cells[targetY-- * board.width + x] = null;
  }
  return board;
}
/** Fixed iteration order is part of replay rules: bottom-to-top, left-to-right. */
export function spawnTiles(input: Board, tileCount: number, rng: Rng): Board {
  const board = cloneBoard(input);
  for (let y = board.height - 1; y >= 0; y--) {
    for (let x = 0; x < board.width; x++) {
      const index = y * board.width + x;
      if (board.cells[index] === null) board.cells[index] = rng.integer(tileCount);
    }
  }
  return board;
}

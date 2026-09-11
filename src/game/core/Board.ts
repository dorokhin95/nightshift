import { isValidTile } from './Tile.js';
import type { Board, GameConfig, Position } from './types.js';
export function cloneBoard(board: Board): Board {
  return { width: board.width, height: board.height, cells: [...board.cells] };
}
export function isPosition(board: Board, p: unknown): p is Position {
  return Array.isArray(p) && p.length === 2 && Number.isInteger(p[0]) && Number.isInteger(p[1]) &&
    p[0] >= 0 && p[0] < board.width && p[1] >= 0 && p[1] < board.height;
}
export function indexOf(board: Board, p: Position): number { return p[1] * board.width + p[0]; }
export function positionOf(board: Board, i: number): Position { return [i % board.width, Math.floor(i / board.width)]; }
export function swapCells(board: Board, a: number, b: number): void {
  const first = board.cells[a]; const second = board.cells[b];
  if (first === undefined || second === undefined) throw new Error('Cell out of bounds');
  board.cells[a] = second; board.cells[b] = first;
}
export function validateConfig(config: GameConfig): void {
  for (const dimension of [config.width, config.height]) {
    if (!Number.isInteger(dimension) || dimension < 3 || dimension > 32) throw new Error('Board dimensions must be 3..32');
  }
  if (!Number.isInteger(config.tileCount) || config.tileCount < 3 || config.tileCount > 16) throw new Error('tileCount must be 3..16');
  const b = config.balance;
  for (const n of [b.tileScore, b.maxCascades, b.shuffleAttempts, b.generationAttempts]) {
    if (!Number.isSafeInteger(n) || n < 1 || n > 100000) throw new Error('Invalid positive balance limit');
  }
  for (const n of [b.bombRadius, b.doubleBombRadius, b.comboLineRadius, b.specialCreateBonus, b.specialActivateBonus, b.specialComboBonus]) {
    if (!Number.isSafeInteger(n) || n < 0 || n > 10000) throw new Error('Invalid special balance');
  }
  if (!Number.isFinite(b.cascadeStep) || b.cascadeStep < 0 || b.cascadeStep > 10 ||
    !Number.isFinite(b.maxCascadeMultiplier) || b.maxCascadeMultiplier < 1 || b.maxCascadeMultiplier > 100) {
    throw new Error('Invalid cascade balance');
  }
}
export function validateBoard(board: Board, config: GameConfig, allowEmpty = false): void {
  if (board.width !== config.width || board.height !== config.height || !Array.isArray(board.cells) ||
    board.cells.length !== config.width * config.height) throw new Error('Invalid board shape');
  for (const tile of board.cells) {
    if (tile === null && allowEmpty) continue;
    if (!isValidTile(tile, config.tileCount)) throw new Error('Invalid tile');
  }
}

import { isSpecial, tileKind } from './Tile.js';
import { cloneBoard, indexOf, isPosition, positionOf, swapCells } from './Board.js';
import { findMatches } from './MatchFinder.js';
import type { Board, Move } from './types.js';
export function areAdjacent(move: Move): boolean {
  return Math.abs(move.from[0] - move.to[0]) + Math.abs(move.from[1] - move.to[1]) === 1;
}
/** Also works on a diagnostic board containing an unrelated pre-existing match. */
export function isLegalMove(board: Board, move: Move): boolean {
  if (!isPosition(board, move.from) || !isPosition(board, move.to) || !areAdjacent(move)) return false;
  const a = indexOf(board, move.from); const b = indexOf(board, move.to);
  const first = board.cells[a]; const second = board.cells[b];
  if (first === null || second === null || first === undefined || second === undefined) return false;
  if (tileKind(first) === 'lightning' || tileKind(second) === 'lightning' || (isSpecial(first) && isSpecial(second))) return true;
  if (first === second) return false;
  const candidate = cloneBoard(board); swapCells(candidate, a, b);
  return findMatches(candidate).some(match => match.indices.includes(a) || match.indices.includes(b));
}
export function findPossibleMoves(board: Board, limit = Infinity): Move[] {
  const moves: Move[] = [];
  if (limit <= 0) return moves;
  for (let i = 0; i < board.cells.length; i++) {
    const from = positionOf(board, i);
    for (const to of [[from[0] + 1, from[1]], [from[0], from[1] + 1]] as const) {
      const move = { from, to };
      if (isLegalMove(board, move)) {
        moves.push(move);
        if (moves.length >= limit) return moves;
      }
    }
  }
  return moves;
}

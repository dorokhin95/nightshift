import { matchColor } from './Tile.js';
import type { Board, Match } from './types.js';
/** Returns maximal runs. A T or L produces two runs; uniqueMatchedCells deduplicates intersections. */
export function findMatches(board: Board): Match[] {
  const matches: Match[] = [];
  for (const direction of ['horizontal', 'vertical'] as const) {
    const horizontal = direction === 'horizontal';
    const lines = horizontal ? board.height : board.width;
    const length = horizontal ? board.width : board.height;
    for (let line = 0; line < lines; line++) {
      let start = 0;
      while (start < length) {
        const cell = (offset: number): number => horizontal ? line * board.width + offset : offset * board.width + line;
        const tile = matchColor(board.cells[cell(start)]);
        let end = start + 1;
        while (end < length && matchColor(board.cells[cell(end)]) === tile) end++;
        if (tile !== null && tile !== undefined && end - start >= 3) {
          matches.push({ direction, tile, indices: Array.from({ length: end - start }, (_, n) => cell(start + n)) });
        }
        start = end;
      }
    }
  }
  return matches;
}
export function uniqueMatchedCells(matches: Match[]): number[] {
  return [...new Set(matches.flatMap(match => match.indices))].sort((a, b) => a - b);
}

import type { Board, Match } from './types.js';
import { isSpecial, makeTile, type SpecialKind } from './Tile.js';
export interface Creation { index: number; kind: SpecialKind; tile: number }
/** One special per connected match group; independent groups can create several specials. */
export function planSpecials(board: Board, matches: Match[], preferred: readonly number[] = []): Creation[] {
  const pending = [...matches]; const creations: Creation[] = [];
  while (pending.length) {
    const group = [pending.shift()!]; const cells = new Set(group[0]!.indices);
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (let i = pending.length - 1; i >= 0; i--) {
        if (pending[i]!.indices.some(index => cells.has(index))) {
          const match = pending.splice(i, 1)[0]!; group.push(match);
          match.indices.forEach(index => cells.add(index)); expanded = true;
        }
      }
    }
    const long = group.find(match => match.indices.length >= 5);
    const horizontal = group.filter(match => match.direction === 'horizontal');
    const vertical = group.filter(match => match.direction === 'vertical');
    const intersections = horizontal.flatMap(h => vertical.flatMap(v => h.indices.filter(index => v.indices.includes(index))));
    const four = group.find(match => match.indices.length === 4);
    let kind: SpecialKind | undefined;
    if (long) kind = 'lightning';
    else if (intersections.length) kind = 'bomb';
    else if (four) kind = four.direction === 'horizontal' ? 'rocket-h' : 'rocket-v';
    if (!kind) continue;
    const candidates = [...preferred, ...intersections, ...[...cells].sort((a, b) => a - b)];
    const index = candidates.find(i => cells.has(i) && !isSpecial(board.cells[i]));
    if (index !== undefined) creations.push({ index, kind, tile: makeTile(group[0]!.tile, kind) });
  }
  return creations;
}

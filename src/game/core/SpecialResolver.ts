import { cloneBoard, positionOf } from './Board.js';
import { isSpecial, makeTile, tileColor, tileKind, type SpecialKind } from './Tile.js';
import type { Board, BoardEvent, GameConfig } from './types.js';

export function areaTargets(board: Board, origin: number, radius: number): number[] {
  const [x, y] = positionOf(board, origin);
  return board.cells.flatMap((tile, i) => tile !== null && Math.abs(i % board.width - x) <= radius &&
    Math.abs(Math.floor(i / board.width) - y) <= radius ? [i] : []);
}
export function lineTargets(board: Board, origin: number, horizontal: boolean): number[] {
  const [x, y] = positionOf(board, origin);
  return board.cells.flatMap((tile, i) => tile !== null && (horizontal ? Math.floor(i / board.width) === y : i % board.width === x) ? [i] : []);
}
function colorTargets(board: Board, color: number): number[] {
  return board.cells.flatMap((tile, i) => tile !== null && tileColor(tile) === color ? [i] : []);
}
export function specialTargets(board: Board, origin: number, config: GameConfig): number[] {
  const tile = board.cells[origin]; if (tile === null || tile === undefined) return [];
  switch (tileKind(tile)) {
    case 'rocket-h': return lineTargets(board, origin, true);
    case 'rocket-v': return lineTargets(board, origin, false);
    case 'bomb': return areaTargets(board, origin, config.balance.bombRadius);
    case 'lightning': return colorTargets(board, tileColor(tile));
    default: return [origin];
  }
}
/** Evaluate blast geometry before removal. Each pre-existing special activates at most once. */
export function expandSpecials(input: Board, initial: readonly number[], config: GameConfig,
  protectedIndices: ReadonlySet<number> = new Set(), consumed: ReadonlySet<number> = new Set()) {
  const board = cloneBoard(input); const targets = new Set<number>(); const queue = [...initial];
  const activated = new Set<number>(); const events: BoardEvent[] = [];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor]!;
    if (index < 0 || index >= board.cells.length || protectedIndices.has(index) || targets.has(index) || board.cells[index] === null) continue;
    targets.add(index);
    const tile = board.cells[index]!;
    if (isSpecial(tile) && !consumed.has(index) && !activated.has(index)) {
      activated.add(index);
      const hit = specialTargets(board, index, config);
      events.push({ type: 'special-activated', board: cloneBoard(board), index, kind: tileKind(tile) as SpecialKind, targets: hit });
      queue.push(...hit);
    }
  }
  return { indices: [...targets].sort((a, b) => a - b), events, activated: activated.size };
}

/** Receives the already-swapped board. The first index is the move destination (combo centre). */
export function resolveCombination(input: Board, first: number, second: number, config: GameConfig) {
  const board = cloneBoard(input); const a = board.cells[first]!; const b = board.cells[second]!;
  const ak = tileKind(a); const bk = tileKind(b);
  const events: BoardEvent[] = []; const consumed = new Set<number>([first, second]);
  let targets: number[] = [first, second]; let name: string; let extraActivations = 0;
  const aLightning = ak === 'lightning'; const bLightning = bk === 'lightning';
  if (aLightning || bLightning) {
    const other = aLightning ? b : a; const otherKind = tileKind(other);
    if (aLightning && bLightning) {
      name = 'lightning+lightning'; targets = board.cells.map((_, i) => i);
    } else if (isSpecial(other)) {
      name = otherKind === 'bomb' ? 'lightning+bomb' : 'lightning+rocket';
      const transformed = colorTargets(board, tileColor(other)).filter(i => i !== first && i !== second);
      // Existing specials of the chosen color transform too; orientations are deterministic.
      for (const i of transformed) board.cells[i] = makeTile(tileColor(other), otherKind === 'bomb' ? 'bomb' : i % 2 === 0 ? 'rocket-h' : 'rocket-v');
      const kind = (otherKind === 'bomb' ? 'bomb' : 'rocket-h') as SpecialKind;
      events.push({ type: 'transform', board: cloneBoard(board), indices: transformed, kind });
      targets.push(...transformed, ...specialTargets(board, aLightning ? second : first, config));
    } else {
      name = 'lightning+tile'; targets.push(...colorTargets(board, tileColor(other)));
    }
  } else if (ak === 'bomb' && bk === 'bomb') {
    name = 'bomb+bomb'; targets.push(...areaTargets(board, first, config.balance.doubleBombRadius));
  } else if (ak === 'bomb' || bk === 'bomb') {
    name = 'rocket+bomb';
    const [x, y] = positionOf(board, first);
    targets.push(...board.cells.flatMap((tile, i) => tile !== null &&
      (Math.abs(i % board.width - x) <= config.balance.comboLineRadius ||
        Math.abs(Math.floor(i / board.width) - y) <= config.balance.comboLineRadius) ? [i] : []));
  } else {
    name = 'rocket+rocket'; targets.push(...lineTargets(board, first, true), ...lineTargets(board, first, false));
  }
  targets = [...new Set(targets)].sort((x, y) => x - y);
  events.unshift({ type: 'combo', board: cloneBoard(input), name, indices: [first, second], targets });
  extraActivations = Number(isSpecial(a)) + Number(isSpecial(b));
  const expanded = expandSpecials(board, targets, config, new Set(), consumed);
  events.push(...expanded.events);
  return { board, indices: expanded.indices, events, activated: expanded.activated + extraActivations, name };
}

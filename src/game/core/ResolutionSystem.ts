import { cloneBoard } from './Board.js';
import { shuffleBoard } from './BoardGenerator.js';
import { findMatches, uniqueMatchedCells } from './MatchFinder.js';
import { findPossibleMoves } from './MoveValidator.js';
import { applyGravity, spawnTiles } from './GravitySystem.js';
import { cascadeMultiplier, scoreClear } from './ScoreSystem.js';
import { planSpecials } from './SpecialFactory.js';
import { expandSpecials, resolveCombination } from './SpecialResolver.js';
import { isSpecial, tileKind } from './Tile.js';
import { Rng } from './Rng.js';
import type { Board, BoardEvent, GameConfig } from './types.js';
export function resolveBoard(input: Board, config: GameConfig, rng: Rng, swapped?: readonly [number, number]) {
  let board = cloneBoard(input); let score = 0; let cascades = 0; let removed = 0; let shuffled = false;
  let specialsCreated = 0; let specialsActivated = 0; let specialCombos = 0;
  const events: BoardEvent[] = [];
  const pair = swapped ? [board.cells[swapped[0]]!, board.cells[swapped[1]]!] : null;
  let combo = pair && (pair.some(t => tileKind(t) === 'lightning') || pair.every(isSpecial)) ? swapped : undefined;
  while (true) {
    const matches = findMatches(board);
    if (!matches.length && !combo) break;
    if (++cascades > config.balance.maxCascades) throw new Error('Cascade budget exhausted');
    let indices: number[]; let bonus = 0;
    if (combo) {
      const result = resolveCombination(board, combo[0], combo[1], config);
      board = result.board; indices = result.indices; events.push(...result.events);
      specialsActivated += result.activated; specialCombos++;
      bonus += config.balance.specialComboBonus + result.activated * config.balance.specialActivateBonus;
      combo = undefined;
    } else {
      const creations = planSpecials(board, matches, cascades === 1 ? swapped : []);
      const protectedIndices = new Set(creations.map(c => c.index));
      const blast = expandSpecials(board, uniqueMatchedCells(matches), config, protectedIndices);
      events.push(...blast.events); indices = blast.indices;
      specialsActivated += blast.activated; specialsCreated += creations.length;
      bonus += blast.activated * config.balance.specialActivateBonus + creations.length * config.balance.specialCreateBonus;
      for (const creation of creations) {
        board.cells[creation.index] = creation.tile;
        events.push({ type: 'special-created', board: cloneBoard(board), index: creation.index, kind: creation.kind });
      }
    }
    const points = scoreClear(indices.length, cascades, config.balance) + bonus;
    score += points; removed += indices.length;
    for (const index of indices) board.cells[index] = null;
    events.push({ type: 'clear', board: cloneBoard(board), indices, cascade: cascades, points,
      multiplier: cascadeMultiplier(cascades, config.balance) });
    board = applyGravity(board); events.push({ type: 'gravity', board: cloneBoard(board) });
    board = spawnTiles(board, config.tileCount, rng); events.push({ type: 'spawn', board: cloneBoard(board) });
  }
  if (!findPossibleMoves(board, 1).length) {
    board = shuffleBoard(board, rng, config.balance.shuffleAttempts); shuffled = true;
    events.push({ type: 'shuffle', board: cloneBoard(board) });
  }
  return { board, score, cascades, removed, shuffled, events, specialsCreated, specialsActivated, specialCombos };
}

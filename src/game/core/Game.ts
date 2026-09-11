import { migrateSave } from './SaveMigration.js';
import { DEFAULT_CONFIG } from '../../config/balance.js';
import { cloneBoard, indexOf, isPosition, swapCells, validateBoard, validateConfig } from './Board.js';
import { generateBoard } from './BoardGenerator.js';
import { findMatches } from './MatchFinder.js';
import { areAdjacent, findPossibleMoves, isLegalMove } from './MoveValidator.js';
import { resolveBoard } from './ResolutionSystem.js';
import { isUint32, Rng } from './Rng.js';
import type { Board, GameConfig, Move, MoveResult, Phase, Save, Statistics } from './types.js';
const copyConfig = (config: GameConfig): GameConfig => ({ ...config, balance: { ...config.balance } });
/** Synchronous transactional core; the renderer owns animation timing and input locking during playback. */
export class Game {
  private boardValue: Board;
  private rng: Rng;
  private scoreValue = 0;
  private statsValue: Statistics = { moves: 0, removed: 0, maxCascade: 0, shuffles: 0, specialsCreated: 0, specialsActivated: 0, specialCombos: 0 };
  private phaseValue: Phase = 'PLAYING';
  private readonly configValue: GameConfig;
  readonly seed: number;
  constructor(seed: number, config: GameConfig = DEFAULT_CONFIG) {
    validateConfig(config); this.configValue = copyConfig(config);
    this.seed = seed; this.rng = new Rng(seed); this.boardValue = generateBoard(this.configValue, this.rng);
  }
  get board(): Board { return cloneBoard(this.boardValue); }
  get config(): GameConfig { return copyConfig(this.configValue); }
  get score(): number { return this.scoreValue; }
  get stats(): Statistics { return { ...this.statsValue }; }
  get phase(): Phase { return this.phaseValue; }
  pause(): void { if (this.phaseValue === 'PLAYING') this.phaseValue = 'PAUSED'; }
  resume(): void { if (this.phaseValue === 'PAUSED') this.phaseValue = 'PLAYING'; }
  hint(): Move | null { return findPossibleMoves(this.boardValue, 1)[0] ?? null; }
  swap(move: Move): MoveResult {
    if (this.phaseValue !== 'PLAYING') return { accepted: false, reason: this.phaseValue === 'PAUSED' ? 'paused' : 'busy', events: [] };
    if (!move || !isPosition(this.boardValue, move.from) || !isPosition(this.boardValue, move.to)) return { accepted: false, reason: 'invalid-position', events: [] };
    if (!areAdjacent(move)) return { accepted: false, reason: 'not-adjacent', events: [] };
    if (!isLegalMove(this.boardValue, move)) return { accepted: false, reason: 'no-match', events: [] };
    const candidate = cloneBoard(this.boardValue);
    swapCells(candidate, indexOf(candidate, move.from), indexOf(candidate, move.to));
    // A local RNG makes errors atomic: score, board and random stream remain untouched.
    const transactionRng = new Rng(this.rng.state);
    this.phaseValue = 'RESOLVING';
    try {
      const result = resolveBoard(candidate, this.configValue, transactionRng, [indexOf(candidate, move.to), indexOf(candidate, move.from)]);
      const nextScore = this.scoreValue + result.score;
      if (!Number.isSafeInteger(nextScore)) throw new Error('Score exceeds safe integer range');
      const nextStats: Statistics = {
        moves: this.statsValue.moves + 1,
        removed: this.statsValue.removed + result.removed,
        maxCascade: Math.max(this.statsValue.maxCascade, result.cascades),
        shuffles: this.statsValue.shuffles + Number(result.shuffled),
        specialsCreated: this.statsValue.specialsCreated + result.specialsCreated,
        specialsActivated: this.statsValue.specialsActivated + result.specialsActivated,
        specialCombos: this.statsValue.specialCombos + result.specialCombos,
      };
      if (!Object.values(nextStats).every(Number.isSafeInteger)) throw new Error('Statistics exceed safe integer range');
      this.boardValue = result.board; this.rng = transactionRng; this.scoreValue = nextScore; this.statsValue = nextStats;
      return { accepted: true, events: [{ type: 'swap', board: candidate, move: { from: [...move.from], to: [...move.to] } }, ...result.events],
        scoreDelta: result.score, cascades: result.cascades };
    } finally { this.phaseValue = 'PLAYING'; }
  }
  snapshot(): Save {
    if (this.phaseValue === 'RESOLVING') throw new Error('Cannot save an unresolved board');
    return { saveVersion: 2, rulesVersion: 'mvp2-v1', seed: this.seed, rngState: this.rng.state,
      config: this.config, board: this.board, score: this.scoreValue, stats: this.stats };
  }
  /** Local save validation is not anti-cheat; ranked scores must be replayed server-side. */
  static restore(input: unknown): Game {
    const save = migrateSave(input);
    validateConfig(save.config); validateBoard(save.board, save.config);
    if (!isUint32(save.seed) || !isUint32(save.rngState)) throw new Error('Invalid saved RNG');
    for (const n of [save.score, save.stats.moves, save.stats.removed, save.stats.maxCascade, save.stats.shuffles, save.stats.specialsCreated, save.stats.specialsActivated, save.stats.specialCombos]) {
      if (!Number.isSafeInteger(n) || n < 0) throw new Error('Invalid saved statistics');
    }
    if (findMatches(save.board).length || !findPossibleMoves(save.board, 1).length) throw new Error('Save must contain a stable playable board');
    const game = new Game(save.seed, save.config);
    game.boardValue = cloneBoard(save.board); game.rng = new Rng(save.rngState);
    game.scoreValue = save.score; game.statsValue = { ...save.stats };
    return game;
  }
}

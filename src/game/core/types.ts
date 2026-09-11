import type { SpecialKind } from './Tile.js';
/** Coordinates are zero-based: [column, row], origin at the top-left. */
export type Position = readonly [number, number];
export type Tile = number;
export interface Board { width: number; height: number; cells: (Tile | null)[] }
export interface Move { from: Position; to: Position }
export interface Match { direction: 'horizontal' | 'vertical'; tile: Tile; indices: number[] }
export interface Balance {
  tileScore: number;
  cascadeStep: number;
  maxCascadeMultiplier: number;
  maxCascades: number;
  shuffleAttempts: number;
  generationAttempts: number;
  bombRadius: number;
  doubleBombRadius: number;
  comboLineRadius: number;
  specialCreateBonus: number;
  specialActivateBonus: number;
  specialComboBonus: number;
}
export interface GameConfig { width: number; height: number; tileCount: number; balance: Balance }
export type Phase = 'PLAYING' | 'PAUSED' | 'RESOLVING';
export interface Statistics { moves: number; removed: number; maxCascade: number; shuffles: number; specialsCreated: number; specialsActivated: number; specialCombos: number }
export interface Save {
  saveVersion: 2;
  rulesVersion: 'mvp2-v1';
  seed: number;
  rngState: number;
  config: GameConfig;
  board: Board;
  score: number;
  stats: Statistics;
}
export type BoardEvent =
  | { type: 'swap'; board: Board; move: Move }
  | { type: 'clear'; board: Board; indices: number[]; cascade: number; points: number; multiplier: number }
  | { type: 'special-created'; board: Board; index: number; kind: SpecialKind }
  | { type: 'special-activated'; board: Board; index: number; kind: SpecialKind; targets: number[] }
  | { type: 'combo'; board: Board; name: string; indices: [number, number]; targets: number[] }
  | { type: 'transform'; board: Board; indices: number[]; kind: SpecialKind }
  | { type: 'gravity' | 'spawn' | 'shuffle'; board: Board };
export type MoveResult =
  | { accepted: false; reason: 'paused' | 'busy' | 'invalid-position' | 'not-adjacent' | 'no-match'; events: [] }
  | { accepted: true; events: BoardEvent[]; scoreDelta: number; cascades: number };

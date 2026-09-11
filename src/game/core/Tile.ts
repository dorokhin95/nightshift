import type { Tile } from './types.js';
/** Packed tile: kind * 16 + color. Ordinary tiles keep their MVP-1 numeric values. */
export const SPECIAL_KINDS = ['normal', 'rocket-h', 'rocket-v', 'bomb', 'lightning'] as const;
export type TileKind = typeof SPECIAL_KINDS[number];
export type SpecialKind = Exclude<TileKind, 'normal'>;
export const TILE_STRIDE = 16;
export function tileColor(tile: Tile): number { return tile % TILE_STRIDE; }
export function tileKind(tile: Tile): TileKind { return SPECIAL_KINDS[Math.floor(tile / TILE_STRIDE)]!; }
export function isSpecial(tile: Tile | null | undefined): tile is Tile {
  return tile !== null && tile !== undefined && tile >= TILE_STRIDE;
}
export function makeTile(color: number, kind: TileKind = 'normal'): Tile {
  if (!Number.isInteger(color) || color < 0 || color >= TILE_STRIDE || !SPECIAL_KINDS.includes(kind)) throw new Error('Invalid tile encoding');
  return SPECIAL_KINDS.indexOf(kind) * TILE_STRIDE + color;
}
export function matchColor(tile: Tile | null | undefined): number | null {
  return tile === null || tile === undefined || tileKind(tile) === 'lightning' ? null : tileColor(tile);
}
export function isValidTile(tile: unknown, tileCount: number): tile is Tile {
  return typeof tile === 'number' && Number.isInteger(tile) && tile >= 0 &&
    tile < SPECIAL_KINDS.length * TILE_STRIDE && tileColor(tile) < tileCount;
}

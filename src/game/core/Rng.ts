const UINT32_RANGE = 0x100000000;
export function isUint32(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < UINT32_RANGE;
}
/** Mulberry32. Seed zero is valid; all state is a single unsigned 32-bit integer. */
export class Rng {
  private value: number;
  constructor(seed: number) {
    if (!isUint32(seed)) throw new Error('Seed must be an unsigned 32-bit integer');
    this.value = seed;
  }
  get state(): number { return this.value; }
  next(): number {
    this.value = (this.value + 0x6d2b79f5) >>> 0;
    let t = this.value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32_RANGE;
  }
  integer(maxExclusive: number): number {
    if (!Number.isSafeInteger(maxExclusive) || maxExclusive < 1) throw new Error('Invalid RNG bound');
    return Math.floor(this.next() * maxExclusive);
  }
}

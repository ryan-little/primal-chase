// Deterministic randomness. Two needs, two tools:
//  - Rng: a stream for sequential decisions (encounter rolls in the sim).
//  - hash2/hash3: stateless position hashes for worldgen, so any point in an
//    endless world can be evaluated without generating its neighbours.

/** sfc32 — fast, solid 32-bit stream PRNG. */
export class Rng {
  private a: number; private b: number; private c: number; private d: number;

  constructor(seed: number) {
    // Splash the single seed across four words via splitmix-ish mixing.
    let s = seed >>> 0;
    const next = () => {
      s = (s + 0x9e3779b9) >>> 0;
      let z = s;
      z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
      z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
      return (z ^ (z >>> 15)) >>> 0;
    };
    this.a = next(); this.b = next(); this.c = next(); this.d = next();
    for (let i = 0; i < 8; i++) this.next();
  }

  /** Uniform float in [0, 1). */
  next(): number {
    const t = (this.a + this.b | 0) + this.d | 0;
    this.d = this.d + 1 | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = this.c + (this.c << 3) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = this.c + t | 0;
    return (t >>> 0) / 4294967296;
  }

  range(min: number, max: number): number { return min + this.next() * (max - min); }
  int(minIncl: number, maxIncl: number): number {
    return minIncl + Math.floor(this.next() * (maxIncl - minIncl + 1));
  }
  pick<T>(list: readonly T[]): T {
    if (list.length === 0) throw new Error('pick from empty list');
    return list[Math.floor(this.next() * list.length)]!;
  }
  chance(p: number): boolean { return this.next() < p; }
}

/** Stateless 2D integer-lattice hash → [0, 1). */
export function hash2(seed: number, x: number, y: number): number {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(seed, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Stateless 3D hash for when a third channel is needed (variant salts). */
export function hash3(seed: number, x: number, y: number, z: number): number {
  return hash2(seed ^ Math.imul(z, 0x68e31da4), x, y);
}

// 2D gradient noise + the shaping operators worldgen composes:
// fbm (rolling ground), ridged fbm (mountain crests), domain warp (kills the
// grid-aligned look), and band masks (mountain belts, river corridors).
// Everything is stateless and seeded, so any coordinate of an endless world
// can be sampled in isolation.

import { hash2 } from './rng';

const GRAD = new Float64Array([
  1, 0, 0.9239, 0.3827, 0.7071, 0.7071, 0.3827, 0.9239,
  0, 1, -0.3827, 0.9239, -0.7071, 0.7071, -0.9239, 0.3827,
  -1, 0, -0.9239, -0.3827, -0.7071, -0.7071, -0.3827, -0.9239,
  0, -1, 0.3827, -0.9239, 0.7071, -0.7071, 0.9239, -0.3827
]);

function fade(t: number): number { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

/** Perlin-style gradient noise, output ~[-1, 1]. */
export function noise2(seed: number, x: number, y: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const u = fade(fx), v = fade(fy);

  const g = (ix: number, iy: number, dx: number, dy: number): number => {
    const i = (hash2(seed, ix, iy) * 16) | 0;
    return GRAD[i * 2]! * dx + GRAD[i * 2 + 1]! * dy;
  };

  return lerp(
    lerp(g(x0, y0, fx, fy), g(x0 + 1, y0, fx - 1, fy), u),
    lerp(g(x0, y0 + 1, fx, fy - 1), g(x0 + 1, y0 + 1, fx - 1, fy - 1), u),
    v
  ) * 1.414;
}

export interface FbmOptions {
  octaves: number;
  /** Frequency multiplier per octave (default 2). */
  lacunarity?: number;
  /** Amplitude multiplier per octave (default 0.5). */
  gain?: number;
}

/** Fractal Brownian motion, output ~[-1, 1]. */
export function fbm(seed: number, x: number, y: number, opts: FbmOptions): number {
  const lac = opts.lacunarity ?? 2;
  const gain = opts.gain ?? 0.5;
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < opts.octaves; i++) {
    sum += noise2(seed + i * 1013, x * freq, y * freq) * amp;
    norm += amp;
    amp *= gain;
    freq *= lac;
  }
  return sum / norm;
}

/**
 * Ridged multifractal: sharp crests where noise crosses zero, valleys between.
 * Output [0, 1], 1 at the crest line.
 */
export function ridged(seed: number, x: number, y: number, opts: FbmOptions): number {
  const lac = opts.lacunarity ?? 2;
  const gain = opts.gain ?? 0.5;
  let sum = 0, amp = 0.5, freq = 1, norm = 0, weight = 1;
  for (let i = 0; i < opts.octaves; i++) {
    let n = 1 - Math.abs(noise2(seed + i * 2029, x * freq, y * freq));
    n *= n;
    n *= weight;
    weight = Math.min(1, Math.max(0, n * 2));
    sum += n * amp;
    norm += amp;
    amp *= gain;
    freq *= lac;
  }
  return sum / norm;
}

/** Domain warp: displace p by two independent noise fields before sampling. */
export function warp2(
  seed: number, x: number, y: number, amount: number, scale: number
): { x: number; y: number } {
  return {
    x: x + noise2(seed ^ 0x5f356495, x * scale, y * scale) * amount,
    y: y + noise2(seed ^ 0x1b873593, x * scale, y * scale) * amount
  };
}

/**
 * Smooth band mask: 1 where |field| is under `halfWidth`, easing to 0 by
 * `halfWidth + falloff`. Used for mountain belts and river corridors —
 * the zero-contour of a low-frequency field is a natural wandering line.
 */
export function bandMask(field: number, halfWidth: number, falloff: number): number {
  const d = Math.abs(field);
  if (d <= halfWidth) return 1;
  if (d >= halfWidth + falloff) return 0;
  const t = (d - halfWidth) / falloff;
  return 1 - t * t * (3 - 2 * t);
}

export function clamp01(v: number): number { return v < 0 ? 0 : v > 1 ? 1 : v; }
export function smoothstep(edge0: number, edge1: number, v: number): number {
  const t = clamp01((v - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

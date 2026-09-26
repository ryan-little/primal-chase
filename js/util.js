// Small math, RNG and noise helpers shared by every system.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
export const TAU = Math.PI * 2;

// Mulberry32: tiny, fast, good enough for gameplay randomness.
export function rng(seed) {
  let s = seed >>> 0;
  const f = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (a, b) => a + f() * (b - a);
  f.int = (a, b) => Math.floor(a + f() * (b - a + 1));
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.chance = (p) => f() < p;
  return f;
}

// Deterministic integer hash -> [0,1). Used for per-cell decisions in the world.
export function hash2(x, y, seed) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (seed | 0) * 982451653;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Seeded 2D gradient noise (Perlin-style), output roughly in [-1, 1].
export function makeNoise(seed) {
  const r = rng(seed);
  const perm = new Uint8Array(512);
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const gx = new Float32Array(256), gy = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const a = r() * TAU;
    gx[i] = Math.cos(a);
    gy[i] = Math.sin(a);
  }
  function n2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
    const a = perm[X + perm[Y]], b = perm[X + 1 + perm[Y]];
    const c = perm[X + perm[Y + 1]], d = perm[X + 1 + perm[Y + 1]];
    const da = gx[a] * xf + gy[a] * yf;
    const db = gx[b] * (xf - 1) + gy[b] * yf;
    const dc = gx[c] * xf + gy[c] * (yf - 1);
    const dd = gx[d] * (xf - 1) + gy[d] * (yf - 1);
    const x1 = da + (db - da) * u, x2 = dc + (dd - dc) * u;
    return (x1 + (x2 - x1) * v) * 1.41;
  }
  n2.fbm = (x, y, oct = 4) => {
    let amp = 1, f = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += n2(x * f + i * 17.3, y * f - i * 9.1) * amp;
      norm += amp;
      amp *= 0.5;
      f *= 2.03;
    }
    return sum / norm;
  };
  return n2;
}

export function approach(v, target, rate) {
  return v < target ? Math.min(target, v + rate) : Math.max(target, v - rate);
}

export function wrapAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

// The land itself, as pure math. No DOM here, so it runs both on the main thread
// (gameplay point queries) and in terrain-worker.js (painting chunks off-thread).
// Everything is seeded and deterministic: the pixel you see is the pixel you stand on.

import { makeNoise, clamp } from './util.js';
import { P, hexToRgb } from './palette.js';

export const G = {
  GRASS: 0, LUSH: 1, TALL: 2, SAND: 3, CLAY: 4, MUD: 5, ROCK: 6, SHALLOW: 7, DEEP: 8,
  ASH: 9, DUNE: 10, SALT: 11, BEACH: 12, SEA: 13, LEAF: 14, BASALT: 15, CLIFF: 16,
};
export const B = { SAVANNA: 0, WOODLAND: 1, WETLAND: 2, DESERT: 3, HIGHLAND: 4, VOLCANIC: 5, COAST: 6 };
export const BIOME_NAMES = ['Savanna', 'Mopane woodland', 'Wetlands', 'Red desert', 'Highlands', 'Ashlands', 'Coast'];

export const GROUND_INFO = [
  // speed, prints (how well the trail reads), heat per second (scaled by sun on land), name
  { speed: 1.0, prints: 0.8, heat: 0, name: 'grass' },
  { speed: 1.0, prints: 0.9, heat: -0.5, name: 'green grass' },
  { speed: 0.88, prints: 0.6, heat: 0.2, name: 'tall grass' },
  { speed: 0.92, prints: 1.0, heat: 1.2, name: 'sand' },
  { speed: 1.0, prints: 1.0, heat: 1.6, name: 'clay pan' },
  { speed: 0.7, prints: 1.0, heat: -1.0, name: 'mud' },
  { speed: 0.9, prints: 0.0, heat: 0.6, name: 'rock' },
  { speed: 0.62, prints: 0.0, heat: -9, name: 'shallows' },
  { speed: 0.45, prints: 0.0, heat: -16, name: 'deep water' },
  { speed: 1.0, prints: 1.0, heat: 0.8, name: 'ash' },
  { speed: 0.8, prints: 1.0, heat: 2.1, name: 'dunes' },
  { speed: 1.02, prints: 0.45, heat: 2.3, name: 'salt pan' },
  { speed: 0.92, prints: 0.9, heat: 0.4, name: 'beach' },
  { speed: 0.3, prints: 0.0, heat: -14, name: 'open sea' },
  { speed: 0.94, prints: 0.5, heat: -1.4, name: 'woodland' },
  { speed: 0.9, prints: 0.0, heat: 1.5, name: 'basalt' },
  { speed: 0.9, prints: 0.0, heat: 0.6, name: 'cliff' },
];
export const isWaterType = (g) => g === G.SHALLOW || g === G.DEEP || g === G.SEA;

export const CHUNK = 128;
const GRID = 8;
export const FACE = 12; // cliff face height in pixels

const RAMPS = [
  ['grass0', 'grass1', 'grass2', 'grass3'],
  ['lush0', 'lush1', 'lush2', 'grass2'],
  ['tall0', 'tall1', 'tall2', 'tall3'],
  ['sand0', 'sand1', 'sand2', 'sand3'],
  ['clay0', 'clay1', 'clay2', 'sand1'],
  ['mud0', 'mud1', 'mud2', 'mud2'],
  ['rock0', 'rock1', 'rock2', 'rock3'],
  ['water0', 'water1', 'water1', 'water2'],
  ['deep0', 'deep1', 'deep1', 'water0'],
  ['ash0', 'ash1', 'ash2', 'ash3'],
  ['dune0', 'dune1', 'dune2', 'dune3'],
  ['salt0', 'salt1', 'salt2', 'salt3'],
  ['beach0', 'beach1', 'beach2', 'beach3'],
  ['sea0', 'sea1', 'sea2', 'sea3'],
  ['litter0', 'litter1', 'litter2', 'litter3'],
  ['basalt0', 'basalt1', 'basalt2', 'basalt3'],
  ['rock0', 'rock1', 'rock2', 'rock3'],
].map((r) => r.map((k) => hexToRgb(P[k])));
const RGB = {};
for (const k in P) RGB[k] = hexToRgb(P[k]);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

export class Terrain {
  constructor(seed) {
    this.seed = seed;
    const n = (k) => makeNoise(seed + k);
    this.nE = n(1); this.nM = n(2); this.nR = n(3); this.nW = n(4); this.nP = n(5); this.nD = n(6);
    this.nA = n(7); this.nH = n(8); this.nV = n(9); this.nC = n(10); this.nRamp = n(11); this.nS = n(12);
    this.cache = new Map();
    this.coastR = 8800;
    this.L = new Float32Array(5);
  }

  // ---- large-scale fields on an 8px grid, bilinear between ----
  // Cached in 32x32 blocks of typed arrays: no per-point allocation, cheap eviction.
  largeAt(gx, gy) {
    const bx = gx >> 5, by = gy >> 5;
    const key = (bx + 32768) * 65536 + (by + 32768);
    let blk = this.cache.get(key);
    if (!blk) {
      if (this.cache.size > 700) {
        let n = 0;
        for (const k of this.cache.keys()) { this.cache.delete(k); if (++n > 200) break; }
      }
      blk = { v: new Float32Array(32 * 32 * 5), f: new Uint8Array(32 * 32) };
      this.cache.set(key, blk);
    }
    const li = ((gy & 31) << 5) | (gx & 31);
    const o = li * 5, v = blk.v;
    if (!blk.f[li]) {
      blk.f[li] = 1;
      const x = gx * GRID, y = gy * GRID;
      let A = this.nA.fbm(x / 5200, y / 5200, 2);
      let H = this.nH.fbm(x / 4200, y / 4200, 2);
      let V = this.nV.fbm(x / 3600, y / 3600, 2);
      const E = this.nE.fbm(x / 1000, y / 1000, 3);
      const d = Math.hypot(x, y);
      const coast = this.coastR + this.nC.fbm(x / 2600, y / 2600, 3) * 2000 - d;
      const k = clamp(1 - (d - 1300) / 1900, 0, 1);
      A *= 1 - k; H = H * (1 - k) - k * 0.35; V = V * (1 - k) - k * 0.6;
      v[o] = A; v[o + 1] = H; v[o + 2] = V; v[o + 3] = E; v[o + 4] = coast;
    }
    this.tmpBlk = v;
    return o;
  }

  large(x, y) {
    const fx = x / GRID, fy = y / GRID;
    const gx = Math.floor(fx), gy = Math.floor(fy);
    const u = fx - gx, w = fy - gy;
    const L = this.L;
    const oa = this.largeAt(gx, gy), va = this.tmpBlk;
    const ob = this.largeAt(gx + 1, gy), vb = this.tmpBlk;
    const oc = this.largeAt(gx, gy + 1), vc = this.tmpBlk;
    const od = this.largeAt(gx + 1, gy + 1), vd = this.tmpBlk;
    for (let i = 0; i < 5; i++) {
      const t = va[oa + i] + (vb[ob + i] - va[oa + i]) * u;
      L[i] = t + (vc[oc + i] + (vd[od + i] - vc[oc + i]) * u - t) * w;
    }
    return L;
  }

  biomeOf(L, d) {
    const [A, H, V, , coast] = L;
    if (coast < 260 + d * 90) return B.COAST;
    if (V > 0.3 + d * 0.03) return B.VOLCANIC;
    if (H > 0.2 + d * 0.03) return B.HIGHLAND;
    if (A > 0.18 + d * 0.03) return B.DESERT;
    if (A < -0.25 + d * 0.03) return B.WETLAND;
    if (A < -0.08 + d * 0.03) return B.WOODLAND;
    return B.SAVANNA;
  }

  biomeAt(x, y) {
    return this.biomeOf(this.large(x, y), this.nD(x / 60, y / 60));
  }

  // Terraces only exist in the highlands. Level 0 everywhere else.
  levelOf(L) {
    const H = L[1];
    if (H <= 0.2 || L[4] < 300 || L[2] > 0.3) return 0;
    return Math.floor(clamp((H - 0.2) * 10 + L[3] * 1.4 + 0.6, 0, 4.99));
  }
  levelAt(x, y) { return this.levelOf(this.large(x, y)); }
  rampAt(x, y) { return this.nRamp(x / 150, y / 150) > 0.22; }

  classify(x, y, L, biome, d) {
    const [A, , , E, coast] = L;
    const m = -A * 0.9 + this.nM(x / 700, y / 700) * 0.25;
    const wx = x + this.nW(x / 700, y / 700) * 260, wy = y + this.nW(x / 700 + 40, y / 700) * 260;
    const rv = Math.abs(this.nR.fbm(wx / 1700, wy / 1700, 2));
    const pond = this.nP.fbm(x / 240, y / 240, 2) + m * 0.35;
    const rw = 0.028 + clamp(m, 0, 0.4) * 0.03;

    if (biome === B.COAST) {
      if (coast < -70) return G.SEA;
      if (coast < 0) return G.SHALLOW;
      if (rv < rw * 0.8) return G.SHALLOW;
      if (coast < 170 + d * 60) return G.BEACH;
      return this.nD(x / 90, y / 90) > 0.15 ? G.TALL : G.GRASS;
    }
    if (biome === B.DESERT) {
      if (pond > 0.72) return G.SHALLOW; // rare oasis
      if (pond > 0.64) return G.LUSH;
      if (rv < rw) return G.SAND; // dry riverbed
      if (this.nS.fbm(x / 520, y / 520, 2) > 0.28 + d * 0.05) return G.SALT;
      if (E + d * 0.1 > 0.36) return G.ROCK;
      return this.nD(x / 130 + 20, y / 130) > 0.28 ? G.SAND : G.DUNE;
    }
    if (biome === B.VOLCANIC) {
      if (rv < rw * 0.55) return G.SHALLOW;
      if (E > 0.42) return G.ROCK;
      return this.nD(x / 80, y / 80 + 30) > 0.12 ? G.ASH : G.BASALT;
    }
    if (biome === B.WETLAND) {
      if (rv < rw * 0.7) return G.DEEP;
      if (rv < rw * 1.6) return G.SHALLOW;
      if (pond > 0.52) return G.DEEP;
      if (pond > 0.38) return G.SHALLOW;
      if (pond > 0.32 || rv < rw * 2) return G.MUD;
      return this.nD(x / 110 + 7, y / 110) > 0.02 ? G.TALL : G.LUSH;
    }
    // savanna, woodland, highland share the river/pond skeleton
    const narrow = biome === B.HIGHLAND ? 0.6 : 1;
    if (rv < rw * 0.45 * narrow) return G.DEEP;
    if (rv < rw * narrow) return G.SHALLOW;
    if (pond > 0.6) return pond > 0.7 ? G.DEEP : G.SHALLOW;
    if (rv < rw * narrow + 0.012 || pond > 0.555) return G.MUD;
    if (biome === B.HIGHLAND) {
      if (this.nD(x / 120, y / 120 + 60) + E * 0.5 > 0.02) return G.ROCK;
      return this.nD(x / 150 + 50, y / 150) > 0.3 ? G.TALL : G.GRASS;
    }
    if (biome === B.WOODLAND) {
      if (E > 0.46) return G.ROCK;
      if (rv < rw + 0.05 || pond > 0.44) return G.LUSH;
      if (this.nD(x / 90, y / 90 + 90) > 0.3) return G.LUSH;
      if (this.nD(x / 150 + 50, y / 150) > 0.3) return G.TALL;
      return G.LEAF;
    }
    // savanna
    if (E > 0.34 + d * 0.08) return G.ROCK;
    if (rv < rw + 0.06 || pond > 0.42) return G.LUSH;
    if (m < -0.34 + d * 0.06) return G.CLAY;
    if (m < -0.16 + d * 0.06) return G.SAND;
    if (m > 0.02 && this.nD(x / 150 + 50, y / 150) > 0.12) return G.TALL;
    return G.GRASS;
  }

  // Ground type at one point, including cliff faces. The chunk painter agrees exactly.
  ground(x, y) {
    x = Math.floor(x); y = Math.floor(y);
    const L = this.large(x, y);
    const d = this.nD(x / 60, y / 60);
    const g = this.classify(x, y, L, this.biomeOf(L, d), d);
    if (isWaterType(g)) return g; // rivers cut clean through the terraces
    const lv = this.levelAt(x, y);
    if (!this.rampAt(x, y)) {
      for (let k = 1; k <= FACE; k++) {
        if (this.levelAt(x, y - k) > lv && !this.rampAt(x, y - k)) return G.CLIFF;
      }
    }
    return g;
  }

  // Paint one chunk: types, levels (bit 7 = ramp) and RGBA pixels.
  chunkPixels(cx, cy) {
    const S = CHUNK, ox = cx * S, oy = cy * S;
    const types = new Uint8Array(S * S);
    const lv = new Uint8Array(S * S);
    const biomes = new Uint8Array(S * S);
    const rgba = new Uint8ClampedArray(S * S * 4);
    const shade = new Float32Array(S * S);
    // levels with FACE rows of headroom above the chunk
    const H = S + FACE;
    const lev = new Int8Array(S * H);
    const ramp = new Uint8Array(S * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < S; x++) {
        const wx = ox + x, wy = oy + y - FACE;
        lev[y * S + x] = this.levelAt(wx, wy);
        ramp[y * S + x] = this.rampAt(wx, wy) ? 1 : 0;
      }
    }
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const wx = ox + x, wy = oy + y, i = y * S + x;
        const L = this.large(wx, wy);
        const E = L[3];
        const d = this.nD(wx / 60, wy / 60);
        const bio = this.biomeOf(L, d);
        let g = this.classify(wx, wy, L, bio, d);
        const li = (y + FACE) * S + x;
        const myLv = lev[li];
        let face = 0;
        if (!ramp[li]) {
          for (let k = 1; k <= FACE; k++) {
            const j = li - k * S;
            if (lev[j] > myLv && !ramp[j]) { face = k; break; }
          }
        }
        if (face && !isWaterType(g)) g = G.CLIFF;
        else face = 0;
        types[i] = g;
        biomes[i] = bio;
        lv[i] = myLv | (ramp[li] << 7);
        // shading: fine texture + slope light from the north-west + terrace height
        const sl = (this.large(wx - 5, wy - 5)[3] - this.large(wx + 5, wy + 5)[3]) * 9;
        let v = (this.nD(wx / 22, wy / 22) * 0.6 + this.nD(wx / 7 + 9, wy / 7) * 0.4 + E * 0.4) * 0.5 + 0.5 + sl + myLv * 0.16;
        // cast shadow at the foot of a cliff
        if (!face && !ramp[li]) {
          for (let k = FACE + 1; k <= FACE + 7; k++) {
            const j = li - k * S;
            if (j >= 0 && lev[j] > myLv && !ramp[j]) { v -= 0.55 - (k - FACE) * 0.04; break; }
          }
        }
        shade[i] = face ? face : v;
      }
    }
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = y * S + x;
        const g = types[i];
        const b = BAYER[(y & 3) * 4 + (x & 3)];
        let col;
        if (g === G.CLIFF) {
          const k = shade[i];
          const stria = ((x * 7 + (x >> 2) * 3) % 5 === 0) ? 1 : 0;
          const idx = k <= 3 ? 2 : k <= 7 ? 1 : 0;
          col = k <= 2 ? RGB.rock4 : RAMPS[G.ROCK][Math.max(0, idx - stria)];
          if (k >= FACE - 2) col = ((x + y) & 1) ? RGB.ink : RGB.rock0;
        } else {
          const up = y > 0 ? types[i - S] : g;
          const dn = y < S - 1 ? types[i + S] : g;
          const water = isWaterType(g);
          if (water && !isWaterType(up) && up !== G.CLIFF) col = g === G.SEA ? RGB.sea0 : RGB.mud0;
          else if (water && !isWaterType(dn) && y < S - 1) col = RGB.foam;
          else {
            let l = shade[i] * 3 + (b - 0.5) * 0.9;
            if (g === G.TALL) l += ((x * 7 + y * 3) % 5 === 0 ? 0.8 : 0) - ((x + y * 5) % 7 === 0 ? 0.9 : 0);
            if (g === G.DUNE) l += Math.sin((x + ox) * 0.09 + (y + oy) * 0.35 + this.nD((x + ox) / 40, (y + oy) / 40) * 4) * 0.9;
            if (g === G.SEA) l += Math.sin((y + oy) * 0.5 + (x + ox) * 0.05) * 0.6;
            col = RAMPS[g][clamp(Math.floor(l), 0, 3)];
            // lit rim on terrace tops where the ground steps down to the north
            const myLv = lv[i] & 7;
            // side walls: ground just below a terrace edge to the east or west
            const lvl = (xx) => (xx >= 0 && xx < S ? lev[(y + FACE) * S + xx] : this.levelAt(ox + xx, oy + y));
            if (!(lv[i] & 128) && !water) {
              for (let k = 1; k <= 3; k++) {
                if (lvl(x - k) > myLv || lvl(x + k) > myLv) { col = k === 1 ? RGB.ink : k === 2 ? RGB.rock0 : RAMPS[G.ROCK][1]; break; }
              }
              if (lvl(x - 1) < myLv || lvl(x + 1) < myLv) col = RGB.rock4;
            }
            if (y > 1 && ((lv[i - S] & 7) < myLv || (lv[i - 2 * S] & 7) < myLv) && !(lv[i] & 128) && !water) col = (y & 1) ? RGB.rock4 : RAMPS[G.ROCK][3];
            if (y < S - 1 && types[i + S] === G.CLIFF && !water) col = RGB.rock4;
          }
        }
        const o = i * 4;
        rgba[o] = col[0]; rgba[o + 1] = col[1]; rgba[o + 2] = col[2]; rgba[o + 3] = 255;
      }
    }
    return { types, lv, biomes, rgba };
  }
}

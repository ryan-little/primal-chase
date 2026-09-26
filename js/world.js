// The savannah: an endless, seeded world streamed in 128px chunks.
// ground() is the single source of truth — the renderer paints it and gameplay reads it,
// so what you see (sand holds prints, rock doesn't, water cools you) is what you get.

import { makeNoise, hash2, rng, clamp } from './util.js';
import { P, hexToRgb } from './palette.js';
import { canvas } from './art.js';

export const G = { GRASS: 0, LUSH: 1, TALL: 2, SAND: 3, CLAY: 4, MUD: 5, ROCK: 6, SHALLOW: 7, DEEP: 8 };
export const GROUND_INFO = [
  // speed multiplier, print strength (how well your trail reads), heat per sec modifier, name
  { speed: 1.0, prints: 0.8, heat: 0, name: 'grass' },
  { speed: 1.0, prints: 0.9, heat: -0.5, name: 'green grass' },
  { speed: 0.88, prints: 0.6, heat: 0.2, name: 'tall grass' },
  { speed: 0.92, prints: 1.0, heat: 1.2, name: 'sand' },
  { speed: 1.0, prints: 1.0, heat: 1.6, name: 'clay pan' },
  { speed: 0.7, prints: 1.0, heat: -1.0, name: 'mud' },
  { speed: 0.9, prints: 0.0, heat: 0.6, name: 'rock' },
  { speed: 0.62, prints: 0.0, heat: -9, name: 'shallows' },
  { speed: 0.45, prints: 0.0, heat: -16, name: 'deep water' },
];

export const CHUNK = 128;

const RGB = {};
for (const k in P) RGB[k] = hexToRgb(P[k]);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

export class World {
  constructor(seed, art) {
    this.seed = seed;
    this.art = art;
    this.nE = makeNoise(seed + 1);
    this.nM = makeNoise(seed + 2);
    this.nR = makeNoise(seed + 3);
    this.nW = makeNoise(seed + 4);
    this.nP = makeNoise(seed + 5);
    this.nD = makeNoise(seed + 6);
    this.chunks = new Map();
    this.queue = [];
  }

  // ---- fields ----
  fields(x, y) {
    const e = this.nE.fbm(x / 900, y / 900, 3);
    const m = this.nM.fbm(x / 1300, y / 1300, 3) + 0.08;
    const wx = x + this.nW(x / 700, y / 700) * 260, wy = y + this.nW(x / 700 + 40, y / 700) * 260;
    const rv = Math.abs(this.nR.fbm(wx / 1700, wy / 1700, 2));
    const pond = this.nP.fbm(x / 240, y / 240, 2) + m * 0.35;
    return { e, m, rv, pond };
  }

  ground(x, y) {
    // keep the start area safe and readable
    const f = this.fields(x, y);
    return this.classify(f, x, y);
  }

  classify(f, x, y) {
    const { e, m, rv, pond } = f;
    const rw = 0.03 + clamp(m, 0, 0.4) * 0.03;
    if (rv < rw * 0.45) return G.DEEP;
    if (rv < rw) return G.SHALLOW;
    if (pond > 0.6) return pond > 0.7 ? G.DEEP : G.SHALLOW;
    if (rv < rw + 0.012 || pond > 0.555) return G.MUD;
    const d = this.nD(x / 60, y / 60);
    if (e > 0.34 + d * 0.08) return G.ROCK;
    if (rv < rw + 0.06 || pond > 0.42) return G.LUSH;
    if (m < -0.34 + d * 0.06) return G.CLAY;
    if (m < -0.16 + d * 0.06) return G.SAND;
    if (m > 0.02 && this.nD(x / 150 + 50, y / 150) > 0.12) return G.TALL;
    return G.GRASS;
  }

  isWater(g) { return g === G.SHALLOW || g === G.DEEP; }

  // ---- chunks ----
  key(cx, cy) { return (cx + 100000) * 262144 + (cy + 100000); }

  get(cx, cy) {
    const k = this.key(cx, cy);
    let c = this.chunks.get(k);
    if (!c) {
      c = this.build(cx, cy);
      this.chunks.set(k, c);
    }
    c.used = performance.now();
    return c;
  }

  peek(cx, cy) { return this.chunks.get(this.key(cx, cy)); }

  // Make sure chunks around a point exist; builds at most `budget` per call.
  ensure(x, y, rx, ry, budget = 3) {
    const x0 = Math.floor((x - rx) / CHUNK), x1 = Math.floor((x + rx) / CHUNK);
    const y0 = Math.floor((y - ry) / CHUNK), y1 = Math.floor((y + ry) / CHUNK);
    let built = 0;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const k = this.key(cx, cy);
        if (!this.chunks.has(k)) {
          if (built >= budget) continue;
          this.chunks.set(k, this.build(cx, cy));
          built++;
        }
      }
    }
    return built;
  }

  evict(x, y, keep) {
    if (this.chunks.size < 140) return;
    for (const [k, c] of this.chunks) {
      if (Math.abs(c.cx * CHUNK + CHUNK / 2 - x) > keep || Math.abs(c.cy * CHUNK + CHUNK / 2 - y) > keep) this.chunks.delete(k);
    }
  }

  build(cx, cy) {
    const ox = cx * CHUNK, oy = cy * CHUNK;
    const S = CHUNK;
    // ground types sampled per pixel at 2px resolution then refined on edges
    const types = new Uint8Array(S * S);
    const shade = new Float32Array(S * S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const wx = ox + x, wy = oy + y;
        const f = this.fields(wx, wy);
        const g = this.classify(f, wx, wy);
        types[y * S + x] = g;
        shade[y * S + x] = this.nD(wx / 22, wy / 22) * 0.6 + this.nD(wx / 7 + 9, wy / 7) * 0.4 + (f.e * 0.4);
      }
    }
    const c = canvas(S, S);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S);
    const d = img.data;
    const ramps = [
      ['grass0', 'grass1', 'grass2', 'grass3'],
      ['lush0', 'lush1', 'lush2', 'grass2'],
      ['tall0', 'tall1', 'tall2', 'tall3'],
      ['sand0', 'sand1', 'sand2', 'sand3'],
      ['clay0', 'clay1', 'clay2', 'sand1'],
      ['mud0', 'mud1', 'mud2', 'mud2'],
      ['rock0', 'rock1', 'rock2', 'rock3'],
      ['water0', 'water1', 'water1', 'water2'],
      ['deep0', 'deep1', 'deep1', 'water0'],
    ];
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = y * S + x;
        const g = types[i];
        let v = shade[i] * 0.5 + 0.5; // 0..1
        const b = BAYER[(y & 3) * 4 + (x & 3)];
        // lighting cue: north edges of water get a dark bank, south edges foam
        const up = y > 0 ? types[i - S] : g;
        const dn = y < S - 1 ? types[i + S] : g;
        let col;
        const water = g === G.SHALLOW || g === G.DEEP;
        if (water && !(up === G.SHALLOW || up === G.DEEP)) col = RGB.mud0;
        else if (water && (y + 1 < S && !(dn === G.SHALLOW || dn === G.DEEP))) col = RGB.foam;
        else {
          const r = ramps[g];
          let lv = v * 3 + (b - 0.5) * 0.9;
          if (g === G.TALL) lv += ((x * 7 + y * 3) % 5 === 0 ? 0.8 : 0) - ((x + y * 5) % 7 === 0 ? 0.9 : 0);
          col = RGB[r[clamp(Math.floor(lv), 0, 3)]];
        }
        d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // decals
    const r = rng((cx * 928371 + cy * 12377 + this.seed) | 0);
    for (let n = 0; n < 150; n++) {
      const x = r.int(1, S - 3), y = r.int(2, S - 2);
      const g = types[y * S + x];
      if (g === G.GRASS || g === G.LUSH || g === G.TALL) {
        ctx.fillStyle = g === G.LUSH ? P.lush2 : g === G.TALL ? P.tall3 : P.grass4;
        ctx.fillRect(x, y - 1, 1, 2);
        ctx.fillRect(x + 2, y - 2, 1, 3);
        ctx.fillStyle = g === G.LUSH ? P.lush0 : P.grass0;
        ctx.fillRect(x + 1, y, 1, 1);
      } else if (g === G.CLAY && n < 60) {
        ctx.fillStyle = P.clay0;
        let px = x, py = y;
        for (let k = 0; k < 6; k++) {
          ctx.fillRect(px, py, 1, 1);
          px += r.int(-1, 1); py += r() < 0.5 ? 1 : 0; px += 1;
        }
      } else if ((g === G.ROCK || g === G.SAND) && n < 70) {
        ctx.fillStyle = g === G.ROCK ? P.rock4 : P.sand3;
        ctx.fillRect(x, y, 1, 1);
        ctx.fillStyle = g === G.ROCK ? P.rock0 : P.sand0;
        ctx.fillRect(x, y + 1, 1, 1);
      }
    }

    // props on a jittered grid
    const props = [];
    const waterPts = [];
    const A = this.art.props;
    for (let gy = 0; gy < S; gy += 16) {
      for (let gx = 0; gx < S; gx += 16) {
        const wx = ox + gx, wy = oy + gy;
        const h = hash2(wx, wy, this.seed);
        const jx = gx + Math.floor(hash2(wx, wy, this.seed + 9) * 16);
        const jy = gy + Math.floor(hash2(wx, wy, this.seed + 19) * 16);
        const g = types[jy * S + jx];
        if (g === G.SHALLOW || g === G.DEEP) waterPts.push(ox + jx, oy + jy);
        if (Math.abs(ox + jx) < 60 && Math.abs(oy + jy) < 60) continue; // clear spawn
        let kind = null;
        const pick = (arr) => arr[Math.floor(hash2(wx, wy, this.seed + 29) * arr.length)];
        if (g === G.GRASS) {
          if (h < 0.028) kind = 'acacia'; else if (h < 0.05) kind = 'bush'; else if (h < 0.056) kind = 'termite';
          else if (h < 0.059) kind = 'bones'; else if (h < 0.0615) kind = 'baobab';
        } else if (g === G.LUSH) {
          if (h < 0.075) kind = 'acacia'; else if (h < 0.13) kind = 'bush'; else if (h < 0.135) kind = 'baobab';
        } else if (g === G.TALL) {
          if (h < 0.018) kind = 'acacia'; else if (h < 0.03) kind = 'bush';
        } else if (g === G.SAND) {
          if (h < 0.06) kind = 'thorn'; else if (h < 0.07) kind = 'bones'; else if (h < 0.074) kind = 'baobab';
        } else if (g === G.CLAY) {
          if (h < 0.02) kind = 'bones'; else if (h < 0.045) kind = 'termite'; else if (h < 0.06) kind = 'thorn';
        } else if (g === G.ROCK) {
          if (h < 0.1) kind = 'boulder'; else if (h < 0.15) kind = 'kopje'; else if (h < 0.16) kind = 'acacia';
        } else if (g === G.MUD) {
          if (h < 0.3) kind = 'reeds';
        }
        if (!kind) continue;
        const def = pick(A[kind]);
        props.push({
          kind, def, x: ox + jx, y: oy + jy,
          shade: def.shade || 0, solid: def.solid || 0,
          flip: hash2(wx, wy, this.seed + 39) < 0.5,
        });
      }
    }
    return { cx, cy, img: c, types, props, waterPts, used: performance.now() };
  }

  // ---- queries ----
  typeAt(x, y) {
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
    const c = this.peek(cx, cy);
    if (!c) return this.ground(x, y);
    const lx = Math.floor(x - cx * CHUNK), ly = Math.floor(y - cy * CHUNK);
    return c.types[ly * CHUNK + lx];
  }

  *propsNear(x, y, r) {
    const x0 = Math.floor((x - r) / CHUNK), x1 = Math.floor((x + r) / CHUNK);
    const y0 = Math.floor((y - r) / CHUNK), y1 = Math.floor((y + r) / CHUNK);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const c = this.peek(cx, cy);
      if (c) for (const p of c.props) yield p;
    }
  }

  // Is this point in the shade of a tree or big rock?
  shadeAt(x, y) {
    for (const p of this.propsNear(x, y, 50)) {
      if (!p.shade) continue;
      const s = p.def.shadow;
      const dx = (x - p.x) / (s.rx + 2), dy = (y - p.y - s.dy) / (s.ry + 4);
      if (dx * dx + dy * dy < 1) return p;
    }
    return null;
  }

  // Push a circle out of solid props (tree trunks, boulders).
  collide(e, r) {
    for (const p of this.propsNear(e.x, e.y, 40)) {
      if (!p.solid) continue;
      const rr = p.solid + r;
      const dx = e.x - p.x, dy = (e.y - p.y) * 1.6;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (rr - d) / d;
        e.x += dx * push;
        e.y += (dy * push) / 1.6;
        // slide around instead of sticking head-on
        const tx = -dy / d, ty = dx / d;
        let sgn = (e.vx || 0) * tx + (e.vy || 0) * ty;
        sgn = Math.abs(sgn) < 0.5 ? ((e.id || 1) & 1 ? 1 : -1) : Math.sign(sgn);
        e.x += tx * sgn * 0.9;
        e.y += (ty * sgn * 0.9) / 1.6;
      }
    }
  }

  nearestWater(x, y, maxR) {
    let best = null, bd = maxR * maxR;
    const x0 = Math.floor((x - maxR) / CHUNK), x1 = Math.floor((x + maxR) / CHUNK);
    const y0 = Math.floor((y - maxR) / CHUNK), y1 = Math.floor((y + maxR) / CHUNK);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const c = this.peek(cx, cy);
      if (!c) continue;
      const w = c.waterPts;
      for (let i = 0; i < w.length; i += 2) {
        const dx = w[i] - x, dy = w[i + 1] - y, d2 = dx * dx + dy * dy;
        if (d2 < bd) { bd = d2; best = [w[i], w[i + 1]]; }
      }
    }
    return best;
  }

  // A good, dry, open starting point near the origin with water in reach.
  findStart() {
    for (let r = 0; r < 4000; r += 40) {
      for (let a = 0; a < 8; a++) {
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        const g = this.ground(x, y);
        if (g !== G.GRASS && g !== G.LUSH) continue;
        // want water within ~500px but not immediately adjacent
        let near = false;
        for (let k = 0; k < 24 && !near; k++) {
          const aa = (k / 24) * Math.PI * 2;
          for (const rr of [200, 320, 450]) if (this.isWater(this.ground(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr))) near = true;
        }
        if (near) return [x, y];
      }
    }
    return [0, 0];
  }
}

// The world as the game sees it: painted chunks (from the worker), props, and the
// movement rules for cliffs, water and the sea. Terrain math lives in terrain.js.

import { hash2, rng } from './util.js';
import { P } from './palette.js';
import { canvas } from './art.js';
import { Terrain, G, B, GROUND_INFO, CHUNK, isWaterType, BIOME_NAMES } from './terrain.js';
import { landmarkForCell, CELL } from './secrets.js';

export { G, B, GROUND_INFO, CHUNK, BIOME_NAMES };

// Which props grow where: [ground, biome or -1 for any, [[threshold, kind], ...]] (first match wins)
const FLORA = [
  [G.GRASS, B.HIGHLAND, [[0.02, 'acacia'], [0.05, 'aloe'], [0.07, 'boulder']]],
  [G.GRASS, B.COAST, [[0.03, 'palm'], [0.05, 'bush']]],
  [G.GRASS, -1, [[0.028, 'acacia'], [0.05, 'bush'], [0.056, 'termite'], [0.059, 'bones'], [0.0615, 'baobab']]],
  [G.LUSH, B.WOODLAND, [[0.09, 'mopane'], [0.13, 'bush'], [0.15, 'fever']]],
  [G.LUSH, B.DESERT, [[0.22, 'palm'], [0.3, 'bush']]],
  [G.LUSH, B.WETLAND, [[0.05, 'fever'], [0.1, 'papyrus']]],
  [G.LUSH, -1, [[0.075, 'acacia'], [0.13, 'bush'], [0.135, 'baobab']]],
  [G.LEAF, -1, [[0.1, 'mopane'], [0.15, 'fever'], [0.17, 'log'], [0.24, 'bush']]],
  [G.TALL, B.WOODLAND, [[0.05, 'fever'], [0.07, 'mopane']]],
  [G.TALL, B.WETLAND, [[0.08, 'papyrus'], [0.1, 'deadtree']]],
  [G.TALL, -1, [[0.018, 'acacia'], [0.03, 'bush']]],
  [G.SAND, B.DESERT, [[0.012, 'deadtree'], [0.03, 'euphorbia'], [0.036, 'bones'], [0.045, 'boulder']]],
  [G.SAND, -1, [[0.06, 'thorn'], [0.07, 'bones'], [0.074, 'baobab']]],
  [G.DUNE, -1, [[0.008, 'deadtree'], [0.018, 'euphorbia'], [0.022, 'bones']]],
  [G.SALT, -1, [[0.008, 'bones']]],
  [G.CLAY, -1, [[0.02, 'bones'], [0.045, 'termite'], [0.06, 'thorn']]],
  [G.ROCK, B.HIGHLAND, [[0.08, 'boulder'], [0.13, 'kopje'], [0.17, 'aloe'], [0.18, 'acacia']]],
  [G.ROCK, -1, [[0.1, 'boulder'], [0.15, 'kopje'], [0.16, 'acacia']]],
  [G.MUD, B.WETLAND, [[0.3, 'papyrus'], [0.4, 'reeds']]],
  [G.MUD, -1, [[0.3, 'reeds']]],
  [G.SHALLOW, B.WETLAND, [[0.09, 'lily']]],
  [G.ASH, -1, [[0.03, 'deadtree'], [0.05, 'basalt'], [0.058, 'vent']]],
  [G.BASALT, -1, [[0.06, 'basalt'], [0.075, 'vent']]],
  [G.BEACH, -1, [[0.035, 'palm'], [0.06, 'driftwood']]],
];

export class World {
  constructor(seed, art, { worker = true } = {}) {
    this.seed = seed;
    this.art = art;
    this.T = new Terrain(seed);
    this.chunks = new Map(); // painted chunks
    this.props = new Map(); // props + water samples, per chunk, built lazily on the main thread
    this.pending = new Set();
    this.lmCache = new Map();
    this.fire = new Map();
    this.burnt = new Map();
    this.useWorker = false;
    if (worker && typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('./terrain-worker.js', import.meta.url), { type: 'module' });
        this.worker.onmessage = (e) => this.receive(e.data);
        this.worker.onerror = () => { this.useWorker = false; };
        this.useWorker = true;
      } catch { this.useWorker = false; }
    }
  }

  destroy() {
    if (this.worker) this.worker.terminate();
    this.worker = null;
  }

  key(cx, cy) { return (cx + 100000) * 262144 + (cy + 100000); }

  // ---------------- painted chunks ----------------
  receive(d) {
    if (d.seed !== this.seed) return;
    const k = this.key(d.cx, d.cy);
    this.pending.delete(k);
    this.chunks.set(k, this.finish(d.cx, d.cy, d));
  }

  finish(cx, cy, d) {
    const S = CHUNK;
    const c = canvas(S, S);
    const ctx = c.getContext('2d');
    ctx.putImageData(new ImageData(d.rgba, S, S), 0, 0);
    this.decals(ctx, cx, cy, d.types);
    return { cx, cy, img: c, types: d.types, lv: d.lv, biomes: d.biomes, used: performance.now() };
  }

  buildSync(cx, cy) {
    const k = this.key(cx, cy);
    const c = this.finish(cx, cy, this.T.chunkPixels(cx, cy));
    this.chunks.set(k, c);
    this.pending.delete(k);
    return c;
  }

  request(cx, cy) {
    const k = this.key(cx, cy);
    if (this.chunks.has(k) || this.pending.has(k)) return;
    if (!this.useWorker) { this.buildSync(cx, cy); return; }
    this.pending.add(k);
    this.worker.postMessage({ seed: this.seed, cx, cy });
  }

  get(cx, cy) {
    const c = this.chunks.get(this.key(cx, cy));
    if (c) { c.used = performance.now(); return c; }
    this.request(cx, cy);
    return null;
  }

  peek(cx, cy) { return this.chunks.get(this.key(cx, cy)); }

  // Queue painting around a point, nearest first; keep the worker a little busy, never flooded.
  ensure(x, y, rx, ry, sync = false) {
    const x0 = Math.floor((x - rx) / CHUNK), x1 = Math.floor((x + rx) / CHUNK);
    const y0 = Math.floor((y - ry) / CHUNK), y1 = Math.floor((y + ry) / CHUNK);
    const want = [];
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const k = this.key(cx, cy);
      if (!this.chunks.has(k) && !this.pending.has(k)) want.push([cx, cy, (cx * CHUNK + 64 - x) ** 2 + (cy * CHUNK + 64 - y) ** 2]);
    }
    want.sort((a, b) => a[2] - b[2]);
    for (const [cx, cy] of want) {
      if (sync) { this.buildSync(cx, cy); continue; }
      if (this.pending.size >= 6) break;
      this.request(cx, cy);
    }
  }

  evict(x, y, keep) {
    if (this.chunks.size > 160) {
      for (const [k, c] of this.chunks) {
        if (Math.abs(c.cx * CHUNK + 64 - x) > keep || Math.abs(c.cy * CHUNK + 64 - y) > keep) this.chunks.delete(k);
      }
    }
    if (this.props.size > 900) {
      for (const [k, c] of this.props) {
        if (Math.abs(c.cx * CHUNK + 64 - x) > keep * 1.5 || Math.abs(c.cy * CHUNK + 64 - y) > keep * 1.5) this.props.delete(k);
      }
    }
  }

  decals(ctx, cx, cy, types) {
    const S = CHUNK;
    const r = rng((cx * 928371 + cy * 12377 + this.seed) | 0);
    for (let n = 0; n < 170; n++) {
      const x = r.int(1, S - 3), y = r.int(2, S - 2);
      const g = types[y * S + x];
      if (g === G.GRASS || g === G.LUSH || g === G.TALL) {
        ctx.fillStyle = g === G.LUSH ? P.lush2 : g === G.TALL ? P.tall3 : P.grass4;
        ctx.fillRect(x, y - 1, 1, 2);
        ctx.fillRect(x + 2, y - 2, 1, 3);
        ctx.fillStyle = g === G.LUSH ? P.lush0 : P.grass0;
        ctx.fillRect(x + 1, y, 1, 1);
      } else if (g === G.LEAF) {
        ctx.fillStyle = r() < 0.5 ? P.ochre : P.fever0;
        ctx.fillRect(x, y, 2, 1);
        ctx.fillStyle = P.litter0;
        ctx.fillRect(x + 1, y + 1, 1, 1);
      } else if ((g === G.CLAY || g === G.SALT || g === G.ASH) && n < 70) {
        ctx.fillStyle = g === G.CLAY ? P.clay0 : g === G.SALT ? P.salt0 : P.ash0;
        let px = x, py = y;
        for (let k = 0; k < 7; k++) {
          ctx.fillRect(px, py, 1, 1);
          px += r.int(-1, 1) + 1; py += r() < 0.5 ? 1 : 0;
        }
      } else if ((g === G.ROCK || g === G.SAND || g === G.BEACH || g === G.BASALT) && n < 80) {
        const hi = { [G.ROCK]: P.rock4, [G.SAND]: P.sand3, [G.BEACH]: P.bone, [G.BASALT]: P.basalt3 }[g];
        const lo = { [G.ROCK]: P.rock0, [G.SAND]: P.sand0, [G.BEACH]: P.beach0, [G.BASALT]: P.ink }[g];
        ctx.fillStyle = hi; ctx.fillRect(x, y, 1, 1);
        ctx.fillStyle = lo; ctx.fillRect(x, y + 1, 1, 1);
      }
    }
  }

  // ---------------- landmarks ----------------
  landmark(i, j) {
    const k = i * 100003 + j;
    if (this.lmCache.has(k)) return this.lmCache.get(k);
    const lm = landmarkForCell(this.T, i, j);
    if (lm) lm.def = this.art.landmarks[lm.type];
    this.lmCache.set(k, lm);
    return lm;
  }
  landmarkNear(x, y, r) {
    const i = Math.floor(x / CELL), j = Math.floor(y / CELL);
    for (let a = i - 1; a <= i + 1; a++) for (let b = j - 1; b <= j + 1; b++) {
      const lm = this.landmark(a, b);
      if (lm && Math.abs(lm.x - x) < r && Math.abs(lm.y - y) < r) return lm;
    }
    return null;
  }
  *landmarksNear(x, y, r) {
    const i0 = Math.floor((x - r) / CELL), i1 = Math.floor((x + r) / CELL);
    const j0 = Math.floor((y - r) / CELL), j1 = Math.floor((y + r) / CELL);
    for (let a = i0; a <= i1; a++) for (let b = j0; b <= j1; b++) {
      const lm = this.landmark(a, b);
      if (lm && Math.hypot(lm.x - x, lm.y - y) < r) yield lm;
    }
  }

  // ---------------- props (main thread, cheap, no pixels needed) ----------------
  propChunk(cx, cy) {
    const k = this.key(cx, cy);
    let c = this.props.get(k);
    if (c) return c;
    const ox = cx * CHUNK, oy = cy * CHUNK;
    const props = [], waterPts = [];
    const A = this.art.props;
    const T = this.T;
    for (let gy = 0; gy < CHUNK; gy += 16) {
      for (let gx = 0; gx < CHUNK; gx += 16) {
        const wx = ox + gx, wy = oy + gy;
        const jx = ox + gx + Math.floor(hash2(wx, wy, this.seed + 9) * 16);
        const jy = oy + gy + Math.floor(hash2(wx, wy, this.seed + 19) * 16);
        const g = this.typeAt(jx, jy);
        if (g === G.SHALLOW || g === G.DEEP) waterPts.push(jx, jy);
        if (Math.abs(jx) < 60 && Math.abs(jy) < 60) continue;
        if (this.landmarkNear(jx, jy, 70)) continue;
        const h = hash2(wx, wy, this.seed);
        if (h > 0.45) continue;
        const bio = T.biomeAt(jx, jy);
        let kind = null;
        for (const [gg, bb, list] of FLORA) {
          if (gg !== g || (bb !== -1 && bb !== bio)) continue;
          for (const [th, kd] of list) if (h < th) { kind = kd; break; }
          break;
        }
        if (!kind || !A[kind]) continue;
        const arr = A[kind];
        const def = arr[Math.floor(hash2(wx, wy, this.seed + 29) * arr.length)];
        // big props shouldn't sit on a cliff face
        if (def.solid && this.typeAt(jx, jy + 4) === G.CLIFF) continue;
        props.push({
          kind, def, x: jx, y: jy,
          shade: def.shade || 0, solid: def.solid || 0, flat: !!def.flat,
          flip: hash2(wx, wy, this.seed + 39) < 0.5,
        });
      }
    }
    // a landmark whose anchor falls in this chunk becomes a (large) prop here
    for (const lm of this.landmarksNear(ox + 64, oy + 64, 120)) {
      if (lm.x < ox || lm.x >= ox + CHUNK || lm.y < oy || lm.y >= oy + CHUNK) continue;
      props.push({ kind: 'landmark', type: lm.type, lm, def: lm.def, x: lm.x, y: lm.y, shade: lm.def.shade || 0, solid: lm.def.solid || 0, flip: false });
      if (lm.def.pool) waterPts.push(lm.x, lm.y - 3);
    }
    c = { cx, cy, props, waterPts };
    this.props.set(k, c);
    return c;
  }

  // Build prop data around a point, a few chunks per frame, nearest first.
  prepare(x, y, r, budget = 3) {
    const x0 = Math.floor((x - r) / CHUNK), x1 = Math.floor((x + r) / CHUNK);
    const y0 = Math.floor((y - r) / CHUNK), y1 = Math.floor((y + r) / CHUNK);
    const pcx = Math.floor(x / CHUNK), pcy = Math.floor(y / CHUNK);
    let built = 0;
    for (let ring = 0; ring <= Math.max(x1 - pcx, pcx - x0, y1 - pcy, pcy - y0); ring++) {
      for (let cy = pcy - ring; cy <= pcy + ring; cy++) for (let cx = pcx - ring; cx <= pcx + ring; cx++) {
        if (Math.max(Math.abs(cx - pcx), Math.abs(cy - pcy)) !== ring) continue;
        if (this.props.has(this.key(cx, cy))) continue;
        this.propChunk(cx, cy);
        if (++built >= budget) return;
      }
    }
  }

  *propsNear(x, y, r) {
    const x0 = Math.floor((x - r) / CHUNK), x1 = Math.floor((x + r) / CHUNK);
    const y0 = Math.floor((y - r) / CHUNK), y1 = Math.floor((y + r) / CHUNK);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const c = this.props.get(this.key(cx, cy));
      if (c) for (const p of c.props) yield p;
    }
  }

  // ---------------- queries ----------------
  fkey(x, y) { return Math.floor(x / 8) * 100003 + Math.floor(y / 8); }

  typeAt(x, y) {
    if (this.burnt.size && this.burnt.has(this.fkey(x, y))) return G.ASH;
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
    const c = this.chunks.get(this.key(cx, cy));
    if (!c) return this.T.ground(x, y);
    return c.types[Math.floor(y - cy * CHUNK) * CHUNK + Math.floor(x - cx * CHUNK)];
  }
  ground(x, y) { return this.typeAt(x, y); }

  levelAt(x, y) {
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
    const c = this.chunks.get(this.key(cx, cy));
    if (!c) return this.T.levelAt(x, y);
    return c.lv[Math.floor(y - cy * CHUNK) * CHUNK + Math.floor(x - cx * CHUNK)] & 7;
  }
  rampAt(x, y) {
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
    const c = this.chunks.get(this.key(cx, cy));
    if (!c) return this.T.rampAt(x, y);
    return (c.lv[Math.floor(y - cy * CHUNK) * CHUNK + Math.floor(x - cx * CHUNK)] & 128) !== 0;
  }
  biomeAt(x, y) {
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
    const c = this.chunks.get(this.key(cx, cy));
    if (!c) return this.T.biomeAt(x, y);
    return c.biomes[Math.floor(y - cy * CHUNK) * CHUNK + Math.floor(x - cx * CHUNK)];
  }

  isWater(g) { return isWaterType(g); }

  // Can something at e step to (nx, ny)? 0 = yes, 1 = blocked, 2 = a drop off a ledge.
  stepRule(x, y, nx, ny) {
    const t1 = this.typeAt(nx, ny);
    if (t1 === G.SEA) return 1;
    const L0 = this.levelAt(x, y), L1 = this.levelAt(nx, ny);
    if (t1 === G.CLIFF) return L0 > L1 ? 2 : (this.typeAt(x, y) === G.CLIFF || ny > y + 0.01) ? 0 : 1;
    if (L1 === L0) return 0;
    if (this.rampAt(nx, ny) || this.rampAt(x, y)) return 0;
    return L1 > L0 ? 1 : 2;
  }

  // Move an entity, sliding along walls. Returns 'drop' if it went over a ledge.
  move(e, dx, dy, { drop = true, fire = false } = {}) {
    if (!dx && !dy) return null;
    if (!fire && this.fire.size && this.fire.has(this.fkey(e.x + dx, e.y + dy))) return 'blocked';
    const r = this.stepRule(e.x, e.y, e.x + dx, e.y + dy);
    if (r === 0 || (r === 2 && drop)) { e.x += dx; e.y += dy; return r === 2 ? 'drop' : null; }
    if (r === 2 && !drop) return 'ledge';
    // slide
    if (dx && this.stepRule(e.x, e.y, e.x + dx, e.y) === 0) { e.x += dx; return 'slide'; }
    if (dy && this.stepRule(e.x, e.y, e.x, e.y + dy) === 0) { e.y += dy; return 'slide'; }
    return 'blocked';
  }

  shadeAt(x, y) {
    for (const p of this.propsNear(x, y, 50)) {
      if (!p.shade) continue;
      const s = p.def.shadow;
      const dx = (x - p.x) / (s.rx + 2), dy = (y - p.y - s.dy) / (s.ry + 4);
      if (dx * dx + dy * dy < 1) return p;
    }
    return null;
  }

  collide(e, r) {
    for (const p of this.propsNear(e.x, e.y, 40)) {
      if (!p.solid) continue;
      const rr = p.solid + r;
      const dx = e.x - p.x, dy = (e.y - p.y) * 1.6;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (rr - d) / d;
        const ox = e.x, oy = e.y;
        e.x += dx * push;
        e.y += (dy * push) / 1.6;
        const tx = -dy / d, ty = dx / d;
        let sgn = (e.vx || 0) * tx + (e.vy || 0) * ty;
        sgn = Math.abs(sgn) < 0.5 ? ((e.id || 1) & 1 ? 1 : -1) : Math.sign(sgn);
        e.x += tx * sgn * 0.9;
        e.y += (ty * sgn * 0.9) / 1.6;
        // never get pushed up a cliff or into the sea
        if (this.stepRule(ox, oy, e.x, e.y) === 1) { e.x = ox; e.y = oy; }
      }
    }
  }

  nearestWater(x, y, maxR) {
    let best = null, bd = maxR * maxR;
    const x0 = Math.floor((x - maxR) / CHUNK), x1 = Math.floor((x + maxR) / CHUNK);
    const y0 = Math.floor((y - maxR) / CHUNK), y1 = Math.floor((y + maxR) / CHUNK);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const c = this.props.get(this.key(cx, cy));
      if (!c) continue;
      const w = c.waterPts;
      for (let i = 0; i < w.length; i += 2) {
        const dx = w[i] - x, dy = w[i + 1] - y, d2 = dx * dx + dy * dy;
        if (d2 < bd) { bd = d2; best = [w[i], w[i + 1]]; }
      }
    }
    return best;
  }

  findStart() {
    for (let r = 0; r < 4000; r += 40) {
      for (let a = 0; a < 8; a++) {
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        const g = this.T.ground(x, y);
        if (g !== G.GRASS && g !== G.LUSH) continue;
        let near = false;
        for (let k = 0; k < 24 && !near; k++) {
          const aa = (k / 24) * Math.PI * 2;
          for (const rr of [200, 320, 450]) if (isWaterType(this.T.ground(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr))) near = true;
        }
        if (near) return [x, y];
      }
    }
    return [0, 0];
  }
}

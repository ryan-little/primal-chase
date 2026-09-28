// Trees and ground plants. Every canopy is built around the branch tips that hold it up,
// so leaves never float loose from their wood. One family of trees per kind of land.
//
// Each species has several hand-tuned variant profiles (shape, lean, height, crown width,
// leaf tone, an occasional dead or sparse one), each drawn from its own seed. The world
// picks a variant and a horizontal flip per tree from its position, so every tree stays put.
//
// Sprites are drawn in trunk-base coordinates (0, 0 = where the trunk meets the ground) on
// an oversized scratch canvas, crisped, then cropped to their pixels. The crop is symmetric
// around the trunk, so nothing is ever cut off and a flipped tree mirrors around its own
// trunk: shadow, shade and collision (all centered on the anchor) line up either way.
import { P } from './palette.js';
import { rng, TAU } from './util.js';
import { canvas, crisp } from './art.js';

function ell(x, cx, cy, rx, ry, col, rot = 0) {
  x.fillStyle = col; x.beginPath(); x.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), rot, 0, TAU); x.fill();
}
function line(x, pts, w, col) {
  x.strokeStyle = col; x.lineWidth = w; x.lineCap = 'round'; x.lineJoin = 'round';
  x.beginPath(); x.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]);
  x.stroke();
}
function px(x, a, b, col) { x.fillStyle = col; x.fillRect(Math.round(a), Math.round(b), 1, 1); }

// ---------- staging: draw big, crop to what was drawn ----------
// A scratch canvas with the origin at the trunk base, `up` px of room above it and `side` px
// either side. fit() crisps it and crops to the opaque pixels (plus a 1px clear margin).
export function stage(side = 90, up = 120, down = 12) {
  const c = canvas(side * 2, up + down), x = c.getContext('2d');
  x.translate(side, up);
  c._ax = side; c._ay = up;
  return [c, x];
}
export function fit(c, def = {}, opts) {
  crisp(c, opts);
  const W = c.width, H = c.height, ctx = c.getContext('2d');
  const d = ctx.getImageData(0, 0, W, H).data;
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!d[(y * W + x) * 4 + 3]) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) { x0 = x1 = c._ax; y0 = y1 = c._ay; }
  if (x0 === 0 || y0 === 0 || x1 === W - 1 || y1 === H - 1) console.warn('tree sprite hit its staging edge', W, H);
  const AX = c._ax, AY = c._ay;
  const half = Math.max(AX - x0, x1 + 1 - AX) + 1;
  const top = Math.min(y0, AY) - 1, bot = Math.max(y1 + 2, AY + 1);
  const out = canvas(half * 2, bot - top);
  out.getContext('2d').putImageData(ctx.getImageData(AX - half, top, half * 2, bot - top), 0, 0);
  return { img: out, ox: half, oy: AY - top, ...def };
}

// Draw a canopy from a list of [cx, cy, rx, ry] pads in three tones, lit from the upper left.
function canopy(x, r, pads, tones, specks = null) {
  const [dark, mid, light, hi] = tones;
  for (const [cx, cy, rx, ry] of pads) ell(x, cx, cy + ry * 0.35, rx, ry, dark);
  for (const [cx, cy, rx, ry] of pads) ell(x, cx - rx * 0.05, cy, rx * 0.9, ry * 0.8, mid);
  for (const [cx, cy, rx, ry] of pads) ell(x, cx - rx * 0.2, cy - ry * 0.35, rx * 0.6, ry * 0.45, light);
  if (hi) for (const [cx, cy, rx, ry] of pads) if (r() < 0.6) ell(x, cx - rx * 0.3, cy - ry * 0.55, rx * 0.25, Math.max(0.8, ry * 0.2), hi);
  if (specks) for (const [cx, cy, rx, ry] of pads) for (let k = 0; k < 2; k++) if (r() < 0.5) px(x, cx + r.range(-rx, rx) * 0.7, cy + r.range(-ry, ry) * 0.6, specks);
}

const LEAF = [P.leaf0, P.leaf1, P.leaf2, P.leaf3];
const LEAF_DARK = [P.inkSoft, P.leaf0, P.leaf1, P.leaf2];
const LEAF_LIGHT = [P.leaf1, P.leaf2, P.leaf3, P.fever1];
const LEAF_DEEP = [P.inkSoft, P.palm0, P.leaf1, P.leaf2];
const LEAF_OLIVE = [P.leaf0, P.lush0, P.lush1, P.lush2];
const LEAF_DRY = [P.thorn0, P.thorn1, P.lush1, P.lush2];
const COPPER = [P.bark0, P.clay0, P.clay1, P.clay2];

const sgn = (r) => (r() < 0.5 ? -1 : 1);
const variants = (base, profiles, make) => profiles.map((o, i) => make(base + i * 7, o));

// ---------- Vachellia (acacia / umbrella thorn) ----------
// Forked trunk, flat layered crown resting on the fork tips.
function acacia(seed, o) {
  const r = rng(seed);
  const [c, x] = stage(110, 90);
  const lean = o.lean ? o.lean * sgn(r) : r.range(-1.5, 1.5);
  const forkY = -r.range(...o.fork);
  const fx = lean * 0.6;
  const trunk = o.trunk || 3.6;
  line(x, [0, 1, fx * 0.4, forkY * 0.5, fx, forkY], trunk, P.bark1);
  line(x, [1, 0, fx * 0.4 + 1, forkY * 0.5, fx + 1, forkY + 2], 1, P.bark2);
  const n = r.int(...o.n), span = r.range(...o.span), top = -r.range(...o.top);
  const tips = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) - 0.5;
    const outer = o.tiers && (i === 0 || i === n - 1);
    const ex = lean + t * span + r.range(-3, 3);
    const ey = top + r.range(-2, 3) + Math.abs(t) * (o.flat ? 4 : 8) + (outer ? 9 : 0);
    const mx = (fx + ex) / 2 + r.range(-3, 3), my = forkY + (ey - forkY) * 0.55;
    line(x, [fx, forkY + 1, mx, my, ex, ey], o.sparse ? 1.8 : 2.2, P.bark1);
    if (o.sparse) line(x, [ex, ey, ex + r.range(-6, 6), ey - r.range(3, 6)], 1, P.bark1);
    tips.push([ex, ey, outer]);
  }
  const pads = [];
  const k = o.flat ? 1.1 : 1;
  for (const [ex, ey, outer] of tips) {
    if (o.sparse && r() < 0.45) continue;
    const s = o.sparse ? 0.55 : outer ? 0.85 : 1;
    pads.push([ex, ey - 1, r.range(9, 13) * k * s, r.range(3.5, 5) * s]);
    if (!o.sparse) pads.push([ex + r.range(-8, 8), ey - r.range(2, 4), r.range(6, 9), r.range(3, 4)]);
  }
  // one long flat layer tying the tips together
  if (!o.sparse) pads.push([lean, top - 1, (o.tiers ? span * 0.32 : span / 2) + 4, o.flat ? 4 : 5]);
  canopy(x, r, pads, o.tones);
  return fit(c, o.sparse
    ? { shadow: { rx: span / 2, ry: 6, dy: -1 }, shade: 0, solid: 4, rare: true }
    : { shadow: { rx: span / 2 + 8, ry: o.flat ? 10 : 11, dy: -1 }, shade: span / 2 + 8, solid: 4 });
}
const ACACIA = [
  { fork: [16, 22], n: [3, 5], span: [46, 56], top: [44, 52], tones: LEAF }, // classic
  { fork: [24, 28], n: [3, 4], span: [34, 42], top: [56, 62], tones: LEAF_OLIVE, trunk: 3.2 }, // tall, narrow
  { fork: [16, 20], n: [4, 5], span: [48, 56], top: [46, 50], tones: LEAF, lean: 6 }, // wind-leaned
  { fork: [18, 22], n: [5, 5], span: [58, 64], top: [50, 54], tones: LEAF_DARK, tiers: true }, // two-tier
  { fork: [9, 12], n: [3, 3], span: [26, 32], top: [28, 32], tones: LEAF_LIGHT, trunk: 2.6 }, // young
  { fork: [16, 20], n: [4, 5], span: [44, 52], top: [44, 50], tones: LEAF_DRY, sparse: true }, // dying (rare)
];
const UMBRELLA = [
  { flat: true, fork: [16, 22], n: [5, 6], span: [72, 82], top: [46, 50], tones: LEAF_DARK }, // classic
  { flat: true, fork: [20, 24], n: [6, 6], span: [88, 96], top: [52, 56], tones: LEAF_DARK, trunk: 4.2 }, // giant
  { flat: true, fork: [10, 13], n: [5, 5], span: [62, 68], top: [36, 40], tones: LEAF }, // low and flat
  { flat: true, fork: [16, 20], n: [5, 6], span: [70, 78], top: [44, 48], tones: LEAF_OLIVE, lean: 6 }, // leaning
  { flat: true, fork: [18, 22], n: [6, 6], span: [78, 86], top: [50, 54], tones: LEAF_DARK, tiers: true }, // two-tier
  { flat: true, fork: [16, 20], n: [5, 6], span: [70, 80], top: [44, 48], tones: LEAF_DRY, sparse: true }, // dying (rare)
];

// ---------- round-crowned trees ----------
// Branches from (bx, by) fan out to lobes along the top of an ellipse around (cx, cy).
function roundCrown(x, r, { bx, by, cx, cy, rx, ry, lobes, bark = P.bark1, bw = 2, pad = [8, 11], padY = [6, 8], sparse = false, core = true }) {
  const pads = [];
  for (let i = 0; i < lobes; i++) {
    const a = -Math.PI / 2 + (i / Math.max(1, lobes - 1) - 0.5) * 2.6 + r.range(-0.12, 0.12);
    const ex = cx + Math.cos(a) * rx, ey = cy + Math.sin(a) * ry * 0.8 + ry * 0.35;
    line(x, [bx, by, (bx + ex) / 2 + r.range(-2, 2), (by + ey) / 2 + 2, ex, ey + 2], bw, bark);
    if (sparse && r() < 0.4) { line(x, [ex, ey + 2, ex + r.range(-5, 5), ey - r.range(3, 6)], 1, bark); continue; }
    const s = sparse ? 0.6 : 1;
    pads.push([ex, ey, r.range(...pad) * s, r.range(...padY) * s]);
  }
  if (core && !sparse) pads.push([cx, cy, rx * 0.7, ry * 0.75]);
  return pads;
}

// Mopane: branches radiate from the trunk into a dense rounded crown; butterfly leaves turn copper.
function mopane(seed, o) {
  const r = rng(seed);
  const [c, x] = stage(80, 90);
  const lean = o.lean ? o.lean * sgn(r) : r.range(-1.5, 1.5);
  const fork = -r.range(...o.fork);
  const rx = r.range(...o.rx), ry = r.range(...o.ry), cy = fork - ry * 0.9;
  const stems = o.stems ? [-3, 3] : [0];
  for (const s of stems) line(x, [s * 0.4, 1, s + lean * 0.6, fork], o.stems ? 2.8 : 3.8, P.bark0);
  let pads = [];
  for (const s of stems) {
    pads = pads.concat(roundCrown(x, r, { bx: s + lean * 0.6, by: fork, cx: lean + s * 1.5, cy, rx: rx / stems.length ** 0.3, ry, lobes: r.int(...o.lobes), bark: P.bark0, bw: 1.8, pad: [8, 11], padY: [6, 8] }));
  }
  canopy(x, r, pads, o.tones, o.tones === COPPER ? P.gold0 : P.ochre);
  return fit(c, { shadow: { rx: rx + 6, ry: 9, dy: -1 }, shade: rx + 10, solid: 4 });
}
const MOPANE = [
  { fork: [18, 22], rx: [18, 22], ry: [12, 14], lobes: [6, 6], tones: LEAF }, // round
  { fork: [22, 26], rx: [13, 15], ry: [16, 18], lobes: [5, 5], tones: LEAF_DARK }, // tall oval
  { fork: [14, 16], rx: [26, 30], ry: [10, 11], lobes: [7, 7], tones: LEAF_OLIVE }, // wide and low
  { fork: [16, 20], rx: [20, 24], ry: [12, 14], lobes: [4, 5], tones: LEAF, stems: true }, // twin stem
  { fork: [18, 22], rx: [18, 22], ry: [12, 14], lobes: [6, 6], tones: COPPER }, // autumn copper
  { fork: [18, 22], rx: [16, 19], ry: [12, 14], lobes: [4, 5], tones: LEAF_DARK, lean: 5 }, // lopsided
];

// Marula: short thick trunk, broad round light crown, yellow fruit.
function marula(seed, o) {
  const r = rng(seed);
  const [c, x] = stage(80, 90);
  const lean = o.lean ? o.lean * sgn(r) : 0;
  const fork = -r.range(...o.fork), rx = r.range(...o.rx), ry = r.range(...o.ry);
  line(x, [0, 1, lean * 0.5, fork], o.trunk || 5, P.bark1);
  line(x, [-1, 0, lean * 0.5 - 1, fork], 1, P.rock2);
  let pads;
  if (o.twin) {
    pads = [];
    for (const s of [-1, 1]) {
      line(x, [lean * 0.5, fork, s * rx * 0.45, fork - 8], 3, P.bark1);
      pads = pads.concat(roundCrown(x, r, { bx: s * rx * 0.45, by: fork - 8, cx: s * rx * 0.5, cy: fork - ry, rx: rx * 0.55, ry: ry * 0.8, lobes: 3, bw: 2, pad: [9, 12], padY: [7, 9] }));
    }
  } else {
    pads = roundCrown(x, r, { bx: lean * 0.5, by: fork + 1, cx: lean, cy: fork - ry * 0.95, rx, ry, lobes: r.int(...o.lobes), bw: 2.2, pad: [11, 14], padY: [8, 10], sparse: o.sparse });
  }
  canopy(x, r, pads, o.tones, o.sparse ? null : P.gold1);
  if (o.fruit) for (const [cx, cy, prx, pry] of pads) for (let k = 0; k < 3; k++) px(x, cx + r.range(-prx, prx) * 0.6, cy + r.range(0, pry) * 0.6, P.gold1);
  return fit(c, o.sparse
    ? { shadow: { rx: rx, ry: 7, dy: -1 }, shade: 0, solid: 5, rare: true }
    : { shadow: { rx: rx + 8, ry: 10, dy: -1 }, shade: rx + 12, solid: 5 });
}
const MARULA = [
  { fork: [17, 20], rx: [20, 22], ry: [12, 14], lobes: [5, 5], tones: LEAF_LIGHT }, // round
  { fork: [14, 16], rx: [26, 30], ry: [11, 12], lobes: [6, 7], tones: LEAF }, // broad
  { fork: [22, 26], rx: [16, 18], ry: [15, 17], lobes: [4, 5], tones: LEAF_LIGHT, trunk: 4 }, // tall
  { fork: [16, 18], rx: [26, 28], ry: [12, 13], tones: LEAF_LIGHT, twin: true }, // split crown
  { fork: [17, 20], rx: [20, 23], ry: [12, 14], lobes: [5, 6], tones: LEAF_OLIVE, fruit: true, lean: 3 }, // heavy with fruit
  { fork: [17, 20], rx: [20, 22], ry: [12, 14], lobes: [5, 5], tones: LEAF_DRY, sparse: true }, // dry season (rare)
];

// Strangler fig: huge dark crown, aerial roots hanging to the ground.
function fig(seed, o) {
  const r = rng(seed);
  const [c, x] = stage(100, 100);
  const lean = o.lean ? o.lean * sgn(r) : 0;
  const rx = r.range(...o.rx), ry = r.range(...o.ry), cy = -r.range(...o.h);
  const under = cy + ry * 0.9;
  for (let i = 0; i < o.roots; i++) {
    const rxx = lean + r.range(-rx * 0.85, rx * 0.85);
    line(x, [rxx, under, rxx + r.range(-2, 2), r.range(-1, 0)], 1, P.bark2);
  }
  line(x, [-5, 1, lean - 3, under], 4, P.bark1);
  line(x, [5, 1, lean + 3, under], 4, P.bark1);
  line(x, [0, 0, lean, under + 4], 2, P.bark0);
  const pads = [];
  const lobes = r.int(...o.lobes);
  for (let i = 0; i < lobes; i++) {
    const a = (i / (lobes - 1)) * Math.PI - Math.PI + r.range(-0.1, 0.1);
    const ex = lean + Math.cos(a) * rx, ey = cy + 6 + Math.sin(a) * ry * 0.7;
    line(x, [lean, under - 2, ex, ey + 6], 2, P.bark1);
    pads.push([ex, ey, r.range(12, 16), r.range(8, 10)]);
  }
  pads.push([lean, cy, rx, ry]);
  canopy(x, r, pads, o.tones, P.ochre);
  return fit(c, { shadow: { rx: rx + 14, ry: 13, dy: -2 }, shade: rx + 16, solid: 7 });
}
const FIG = [
  { rx: [28, 30], ry: [13, 14], h: [48, 50], roots: 7, lobes: [7, 7], tones: LEAF_DEEP }, // classic
  { rx: [36, 38], ry: [12, 13], h: [44, 46], roots: 10, lobes: [8, 8], tones: LEAF_DARK }, // sprawling
  { rx: [20, 22], ry: [16, 17], h: [56, 58], roots: 4, lobes: [5, 5], tones: LEAF_DEEP }, // tall, few roots
  { rx: [28, 30], ry: [13, 14], h: [44, 46], roots: 14, lobes: [6, 6], tones: LEAF }, // root curtain
  { rx: [26, 28], ry: [13, 14], h: [48, 50], roots: 6, lobes: [6, 6], tones: LEAF_DEEP, lean: 5 }, // leaning
];

// Mangrove: a dark crown on arching stilt roots.
function mangrove(seed, o) {
  const r = rng(seed);
  const [c, x] = stage(70, 70);
  const hip = -r.range(...o.hip), spread = r.range(...o.spread);
  for (let i = 0; i < o.roots; i++) {
    const e = (i / (o.roots - 1) - 0.5) * spread + r.range(-2, 2);
    line(x, [0, hip, e / 2, hip + 2 - r.range(0, 3), e, 0], 1.4, P.bark1);
  }
  const top = hip - r.range(...o.trunk);
  line(x, [0, hip + 2, 0, top], 3, P.bark0);
  const pads = [];
  const n = r.int(...o.lobes), w = r.range(...o.w);
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) - 0.5 : 0;
    pads.push([t * w, top - 4 + r.range(-4, 3) + (o.dome ? Math.abs(t) * 10 : 0), r.range(9, 12), r.range(6, 8)]);
  }
  canopy(x, r, pads, o.tones);
  return fit(c, { shadow: { rx: w / 2 + 10, ry: 7, dy: -1 }, shade: w / 2 + 10, solid: 3 });
}
const MANGROVE = [
  { hip: [18, 20], spread: [38, 42], roots: 6, trunk: [10, 12], lobes: [5, 5], w: [28, 32], tones: LEAF_DEEP }, // classic
  { hip: [14, 16], spread: [44, 48], roots: 8, trunk: [8, 10], lobes: [6, 6], w: [38, 42], tones: LEAF_DARK }, // wide, low
  { hip: [20, 24], spread: [28, 32], roots: 5, trunk: [14, 16], lobes: [4, 4], w: [18, 22], tones: LEAF_DEEP, dome: true }, // tall dome
  { hip: [12, 14], spread: [24, 28], roots: 4, trunk: [6, 8], lobes: [3, 3], w: [14, 16], tones: LEAF }, // young
  { hip: [18, 20], spread: [36, 40], roots: 7, trunk: [10, 12], lobes: [5, 5], w: [30, 34], tones: LEAF_OLIVE, dome: true }, // olive dome
];

// Quiver tree (kokerboom): pale trunk forking again and again, a spiky rosette on every tip.
function quiver(seed, o) {
  const r = rng(seed);
  const [c, x] = stage(70, 90);
  const tips = [];
  const branch = (bx, by, a, len, wd, depth) => {
    const ex = bx + Math.cos(a) * len, ey = by + Math.sin(a) * len;
    line(x, [bx, by, ex, ey], wd, P.sand1);
    line(x, [bx - 0.5, by, ex - 0.5, ey], Math.max(1, wd * 0.35), P.sand3);
    if (depth > 0) {
      branch(ex, ey, a - r.range(...o.fan), len * 0.72, wd * 0.72, depth - 1);
      branch(ex, ey, a + r.range(...o.fan), len * 0.72, wd * 0.72, depth - 1);
    } else tips.push([ex, ey]);
  };
  const lean = o.lean ? o.lean * sgn(r) : 0;
  branch(0, 1, -Math.PI / 2 + lean, r.range(...o.len), o.wd || 4.6, o.depth);
  const rs = o.rosette || 4;
  for (const [ex, ey] of tips) {
    for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU; line(x, [ex, ey, ex + Math.cos(a) * rs, ey + Math.sin(a) * rs * 0.65 - 1], 1.2, k % 2 ? P.lush1 : P.lush2); }
    px(x, ex, ey - 1, P.lush2);
    if (o.bloom && r() < 0.5) px(x, ex, ey - 3, P.gold1);
  }
  return fit(c, { shadow: { rx: 14 + o.depth * 2, ry: 5, dy: 0 }, shade: 14, solid: 3 });
}
const QUIVER = [
  { len: [19, 21], fan: [0.35, 0.6], depth: 3 }, // classic
  { len: [26, 28], fan: [0.25, 0.4], depth: 2, wd: 4, rosette: 5 }, // tall, slim
  { len: [15, 17], fan: [0.6, 0.8], depth: 3, wd: 5.2 }, // squat, wide
  { len: [15, 16], fan: [0.3, 0.5], depth: 4, rosette: 3 }, // bushy
  { len: [19, 21], fan: [0.35, 0.55], depth: 3, lean: 0.25, bloom: true }, // leaning, flowering
];

// Candelabra euphorbia: a trunk that lifts a dozen green arms.
function candelabra(seed, o) {
  const r = rng(seed);
  const [c, x] = stage(60, 80);
  const hip = -r.range(...o.hip);
  line(x, [0, 1, 0, hip], 4, P.bark1);
  const n = r.int(...o.n), spread = r.range(...o.spread);
  for (let i = 0; i < n; i++) {
    const off = (i / (n - 1) - 0.5) * spread;
    const top = hip - r.range(...o.arm) + Math.abs(off) * (o.cup ? -0.3 : 0.3);
    line(x, [0, hip, off, hip - 4, off, top], 3, P.lush0);
    line(x, [off - 0.8, hip - 5, off - 0.8, top + 1], 1, P.lush2);
    px(x, off, top - 1, o.bloom ? P.danger : P.ochre);
  }
  return fit(c, { shadow: { rx: spread / 2 + 2, ry: 5, dy: 0 }, shade: 16, solid: 3 });
}
const CANDELABRA = [
  { hip: [20, 22], n: [5, 7], spread: [34, 38], arm: [16, 32] }, // classic
  { hip: [26, 30], n: [4, 4], spread: [22, 26], arm: [14, 22] }, // tall, few arms
  { hip: [12, 14], n: [8, 9], spread: [42, 46], arm: [14, 26], cup: true }, // wide cup
  { hip: [16, 18], n: [3, 3], spread: [18, 20], arm: [10, 16] }, // young
  { hip: [20, 22], n: [6, 7], spread: [36, 40], arm: [20, 30], bloom: true }, // in fruit
];

// A tree the fire already had.
function charred(seed, o) {
  const r = rng(seed);
  const [c, x] = stage(50, 70);
  const H = r.range(...o.h), lean = r.range(-3, 3);
  line(x, [0, 1, lean, -H], o.trunk || 3.2, P.ink);
  for (let i = 0; i < o.n; i++) {
    const a = -Math.PI / 2 + r.range(-1.2, 1.2), L = r.range(10, 18) * (o.k || 1), sy = -H + r.range(0, 8);
    const ex = lean + Math.cos(a) * L, ey = sy + Math.sin(a) * L;
    line(x, [lean, sy, ex, ey, ex + r.range(-4, 4), ey - r.range(2, 5)], 1.6, P.basalt1);
  }
  for (let i = 0; i < 4; i++) px(x, r.range(-2, 2), -r.range(2, Math.min(H, 20)), P.fire0);
  return fit(c, { shadow: { rx: 12, ry: 3, dy: 0 }, solid: 3 });
}
const CHARRED = [
  { h: [22, 26], n: 5 }, // classic
  { h: [30, 34], n: 3, k: 0.8 }, // tall snag
  { h: [10, 12], n: 1, trunk: 4.4, k: 0.5 }, // stump
  { h: [18, 20], n: 7, k: 1.2 }, // broad
];

// Baobab: a bottle trunk with a thin crown of short limbs; leafless half the year.
function baobab(seed, o) {
  const r = rng(seed);
  const [c, x] = stage(60, 100);
  const H = r.range(...o.h), bw = r.range(...o.bw), tw = r.range(...o.tw);
  const bottle = (dx, s) => {
    x.fillStyle = P.bark1;
    x.beginPath();
    x.moveTo(dx - bw * s, 1);
    x.quadraticCurveTo(dx - bw * s * 1.35, -H * s * 0.6, dx - tw * s, -H * s);
    x.lineTo(dx + tw * s, -H * s);
    x.quadraticCurveTo(dx + bw * s * 1.35, -H * s * 0.6, dx + bw * s, 1);
    x.closePath();
    x.fill();
    ell(x, dx + bw * s * 0.35, -H * s * 0.48, bw * s * 0.4, H * s * 0.4, P.bark2);
    ell(x, dx - bw * s * 0.5, -H * s * 0.45, bw * s * 0.25, H * s * 0.36, P.bark0);
  };
  const tops = o.twin ? [[-bw * 0.55, 0.82], [bw * 0.55, 1]] : [[0, 1]];
  for (const [dx, s] of tops) bottle(dx, s);
  const n = r.int(...o.n);
  for (const [dx, s] of tops) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * 2.4 + r.range(-0.2, 0.2);
      const L = r.range(12, 18) * (o.k || 1);
      const sx = dx + r.range(-tw, tw) * s * 0.8, sy = -H * s + 1;
      const ex = sx + Math.cos(a) * L, ey = sy + Math.sin(a) * L * 0.7;
      line(x, [sx, sy, ex, ey], 2.4, P.bark1);
      if (o.bare) { line(x, [ex, ey, ex + r.range(-4, 4), ey - r.range(2, 4)], 1, P.bark1); continue; }
      ell(x, ex, ey - 1, r.range(5, 8), r.range(3, 4.5), o.tones[1]);
      ell(x, ex - 1, ey - 2, 3.5, 1.8, o.tones[2]);
    }
  }
  const half = bw * (o.twin ? 1.6 : 1.1);
  return fit(c, { shadow: { rx: half + 12, ry: 8, dy: -1 }, shade: o.bare ? 0 : half + 16, solid: Math.round(bw * 0.9), rare: !!o.bare });
}
const BAOBAB = [
  { h: [46, 48], bw: [12, 12], tw: [7, 7], n: [6, 6], tones: LEAF }, // classic bottle
  { h: [54, 58], bw: [9, 10], tw: [5, 6], n: [5, 5], tones: LEAF, k: 0.9 }, // tall and slender
  { h: [34, 36], bw: [14, 15], tw: [9, 10], n: [7, 7], tones: LEAF_OLIVE, k: 1.2 }, // squat giant
  { h: [42, 46], bw: [9, 10], tw: [5, 6], n: [4, 4], tones: LEAF, twin: true }, // twin trunk
  { h: [46, 50], bw: [11, 12], tw: [6, 7], n: [7, 7], bare: true }, // leafless (rare)
];

// Fever tree: tall, yellow-green bark, feathery sparse crown.
function fever(seed, o) {
  const r = rng(seed);
  const [c, x] = stage(50, 100);
  const H = r.range(...o.h), lean = o.lean ? o.lean * sgn(r) : r.range(-2, 2);
  const stems = o.twin ? [[-2, -0.35], [2, 0.3]] : [[0, 0]];
  for (const [bx, a0] of stems) {
    const topx = bx + lean + a0 * H * 0.4, topy = -H;
    line(x, [bx, 1, bx + (topx - bx) * 0.5 + r.range(-1, 1), -H * 0.5, topx, topy], o.twin ? 2.4 : 3, P.fever0);
    line(x, [bx + 1, 0, bx + 1 + (topx - bx) * 0.45, -H * 0.45], 1, P.fever1);
    const n = r.int(...o.n);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + r.range(-1.2, 1.2), L = r.range(10, 18) * (o.k || 1);
      const t = r.range(0, o.span || 0.3), sx = topx + (bx - topx) * t, sy = topy * (1 - t);
      const ex = sx + Math.cos(a) * L, ey = sy + Math.sin(a) * L * 0.6;
      line(x, [sx, sy, ex, ey], 1.4, P.fever0);
      ell(x, ex, ey - 1, r.range(6, 9), 3, o.tones[0]);
      ell(x, ex - 1, ey - 2, 4, 1.5, o.tones[1]);
    }
  }
  return fit(c, { shadow: { rx: 18, ry: 6, dy: -1 }, shade: 20, solid: 3 });
}
const FEVER = [
  { h: [56, 60], n: [5, 5], tones: [P.leaf1, P.leaf3] }, // classic
  { h: [66, 70], n: [4, 4], tones: [P.leaf1, P.leaf3], span: 0.2, k: 0.8 }, // very tall
  { h: [40, 44], n: [6, 7], tones: [P.leaf2, P.fever1], span: 0.45 }, // short, bushy
  { h: [52, 56], n: [3, 4], tones: [P.leaf1, P.leaf3], twin: true }, // twin stem
  { h: [54, 58], n: [5, 5], tones: [P.leaf0, P.leaf2], lean: 7 }, // leaning
];

// ---------- low plants ----------
function shrub(seed, tones, dots, o = {}) {
  const r = rng(seed);
  const [c, x] = stage(32, 30, 8);
  const s = o.s || 1, n = o.n || 5;
  const pads = [];
  for (let i = 0; i < n; i++) pads.push([r.range(-6, 6) * s, -3 + r.range(-3, 2) * s, r.range(3.5, 5.5) * s, r.range(3, 4.5) * s]);
  canopy(x, r, pads, tones);
  if (o.spiky) for (let i = 0; i < 10; i++) { const a = r() * TAU; px(x, Math.cos(a) * 9 * s, -4 + Math.sin(a) * 5 * s, tones[2]); }
  if (dots) for (let i = 0; i < (o.dots || 4); i++) px(x, r.range(-7, 7) * s, -r.range(1, 8) * s, dots);
  return fit(c, { shadow: { rx: 10 * s, ry: 3.5 * s, dy: 0 } });
}
const SHRUB_SIZES = [{ s: 1 }, { s: 0.75, n: 4 }, { s: 1.25, n: 6 }, { s: 1.1, n: 7, dots: 7 }];

// Plain and thorny bush (replaces the older single-look bush sprites).
function bush(seed, thorn, o) {
  const r = rng(seed);
  const [c, x] = stage(32, 30, 8);
  const s = o.s, cols = thorn ? [P.thorn0, P.thorn1, P.leaf2] : o.tones;
  const b = [];
  for (let i = 0; i < o.n; i++) b.push([r.range(-7, 7) * s, -4 + r.range(-3, 2) * s, r.range(4, 6.5) * s]);
  for (const [bx, by, rr] of b) ell(x, bx, by, rr, rr * 0.8, cols[0]);
  for (const [bx, by, rr] of b) ell(x, bx - 0.5, by - 1, rr * 0.75, rr * 0.55, cols[1]);
  for (const [bx, by, rr] of b) if (r() < 0.5) ell(x, bx - 1, by - 2, rr * 0.3, rr * 0.25, cols[2]);
  if (thorn) for (let i = 0; i < 14; i++) px(x, r.range(-10, 10) * s, -r.range(1, 12) * s, P.bone0);
  else for (let i = 0; i < (o.berries || 3); i++) px(x, r.range(-7, 7) * s, -r.range(2, 10) * s, o.berry || P.ochre);
  return fit(c, { shadow: { rx: 11 * s, ry: 4 * s, dy: 0 } });
}
const BUSH = [
  { s: 1, n: 6, tones: [P.leaf0, P.leaf1, P.leaf2] },
  { s: 0.8, n: 4, tones: [P.leaf0, P.leaf1, P.leaf2] },
  { s: 1.25, n: 7, tones: [P.leaf0, P.leaf1, P.leaf3] },
  { s: 1, n: 6, tones: [P.leaf0, P.lush0, P.lush2], berries: 6, berry: P.blood1 },
  { s: 1.1, n: 5, tones: [P.inkSoft, P.leaf0, P.leaf2], berries: 0 },
];
const THORN = [{ s: 1, n: 6 }, { s: 0.8, n: 4 }, { s: 1.25, n: 7 }, { s: 1.05, n: 5 }];

function fern(seed, o) {
  const r = rng(seed);
  const [c, x] = stage(20, 22, 4);
  const n = o.n, L = o.L;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * 2.8 + r.range(-0.1, 0.1);
    const ex = Math.cos(a) * L, ey = Math.sin(a) * L;
    line(x, [0, 0, ex / 2, ey / 2 - 2, ex, ey], 1.4, i % 2 ? P.lush1 : P.lush2);
    for (let k = 1; k < 4; k++) px(x, ex * k / 4 + 1, ey * k / 4, P.lush0);
  }
  return fit(c, {}, { outline: false });
}
const FERN = [{ n: 7, L: 11 }, { n: 5, L: 9 }, { n: 9, L: 13 }, { n: 6, L: 12 }];

// Tall grass: stalks that stand above the cat. Four clumps, three frames of sway each.
function tallgrass() {
  const out = [];
  for (let v = 0; v < 4; v++) {
    const r = rng(300 + v);
    const blades = [];
    for (let i = 0; i < 9; i++) blades.push([r.range(2, 14), r.range(10, 18), r.range(-2, 2), r() < 0.5 ? P.tall1 : r() < 0.5 ? P.tall2 : P.tall0, r() < 0.4]);
    const frames = [];
    for (let f = 0; f < 3; f++) {
      // 4px margin each side so a leaning, swaying blade never touches the edge
      const c = canvas(26, 22), x = c.getContext('2d');
      const sway = (f - 1) * 1.6;
      for (let [bx, len, lean, col, head] of blades) {
        bx += 4;
        const tx = bx + lean + sway * (len / 18), ty = 21 - len;
        line(x, [bx, 21, bx + (lean + sway) * 0.4, 21 - len * 0.5, tx, ty], 1, col);
        if (head) { px(x, tx, ty, P.tall3); px(x, tx, ty + 1, P.tall3); px(x, tx + (sway > 0 ? 1 : -1), ty + 1, P.tall2); }
      }
      crisp(c, { outline: false });
      frames.push(c);
    }
    out.push(frames);
  }
  return out;
}

export function buildTrees() {
  return {
    acacia: variants(11, ACACIA, acacia),
    umbrella: variants(16, UMBRELLA, acacia),
    mopane: variants(101, MOPANE, mopane),
    marula: variants(221, MARULA, marula),
    fig: variants(231, FIG, fig),
    quiver: variants(241, QUIVER, quiver),
    candelabra: variants(251, CANDELABRA, candelabra),
    mangrove: variants(261, MANGROVE, mangrove),
    charred: variants(271, CHARRED, charred),
    baobab: variants(21, BAOBAB, baobab),
    fever: variants(111, FEVER, fever),
    bush: variants(31, BUSH, (s, o) => bush(s, false, o)),
    thorn: variants(41, THORN, (s, o) => bush(s, true, o)),
    sage: variants(281, SHRUB_SIZES, (s, o) => shrub(s, [P.rock0, P.rock1, P.salt0, P.bone], P.salt3, o)),
    heath: variants(291, SHRUB_SIZES, (s, o) => shrub(s, [P.leaf0, P.thorn1, P.lush2, P.flam1], P.flam1, o)),
    thornbush: variants(311, SHRUB_SIZES, (s, o) => shrub(s, [P.thorn0, P.thorn1, P.leaf2, null], P.bone0, { ...o, spiky: true })),
    fern: variants(321, FERN, fern),
  };
}

export const TALLGRASS = tallgrass;

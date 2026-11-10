// Small plants, succulents, dead trees and grass for the redraw.
// Same rules as acacia.js: wood and succulent bodies stay rooted, only leaves, tips, stems and
// flower spikes move through the 8-frame wind loop. Variant tables, seeds and def fields
// (shadow, shade, solid, rare, flat) follow the old art-trees.js / art-props.js / art.js exactly.
import { rng, clump, drawClumps, barkShade, strand, blade, plant, still, Pix, lerp, clamp, TAU } from './flora.js';
import { P2, addColors, addRamp } from './pal.js';

// blue-gray succulent green for aloes and quiver-tree rosettes (no existing ramp has it)
addColors({ aloeD: '#24342f', aloe0: '#38503f', aloe1: '#527058', aloe2: '#739175', aloe3: '#9fb795', aloeT: '#9c4a2e' });
addRamp('aloe', ['aloeD', 'aloe0', 'aloe1', 'aloe2', 'aloe3'], 'olLeaf');
// silver-green for sage, so it reads as a plant and not a pale rock
addColors({ sageD: '#3e4636', sage0: '#5c6650', sage1: '#7d876c', sage2: '#a0a88c', sage3: '#c6ccb0' });
addRamp('sage', ['sageD', 'sage0', 'sage1', 'sage2', 'sage3'], 'olLeaf');

const PI = Math.PI;
const wave = (t, ph) => Math.sin(t * TAU - ph);
const hex = (k) => P2[k];
const hash = (a, b, s = 0) => {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
// wood ends flat at the ground line instead of a round cap below it
const ground = (c) => c.remap((x, y) => (y > 0.6 ? null : undefined));
// one ramp step darker, for the shaded side of a hand-placed pixel
const shade = (k) => ({ fire1: 'fire0', fire0: 'fireD', fireD: 'emberD', emberD: 'emberD' }[k] || k);
const variants = (base, profiles, make) => profiles.map((o, i) => make(base + i * 7, o, i));

// How far drawClumps moves a clump at loop phase t (so berries, thorns and twigs ride along).
function clumpOff(c, t, amp, top) {
  const k = clamp(c.cy / top, 0, 1.2);
  return Math.sin(t * TAU - c.ph) * amp * k * 0.8;
}
function nearest(clumps, x, y) {
  let best = clumps[0], bd = 1e9;
  for (const c of clumps) { const d = (c.cx - x) ** 2 + (c.cy - y) ** 2; if (d < bd) { bd = d; best = c; } }
  return best;
}

// ---------- quiver tree ----------
const QUIVER = [
  { len: [19, 21], fan: [0.35, 0.6], depth: 3 }, // classic
  { len: [26, 28], fan: [0.25, 0.4], depth: 2, wd: 4, rosette: 5 }, // tall, slim
  { len: [15, 17], fan: [0.6, 0.8], depth: 3, wd: 5.2 }, // squat, wide
  { len: [15, 16], fan: [0.3, 0.5], depth: 4, rosette: 3 }, // bushy
  { len: [19, 21], fan: [0.35, 0.55], depth: 3, lean: 0.25, bloom: true }, // leaning, flowering
];
function quiver(seed, o) {
  const r = rng(seed);
  const segs = [], tips = [];
  const w0 = o.wd || 4.6;
  const grow = (x, y, a, len, w, d) => {
    const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
    segs.push({ x, y, ex, ey, w0: w, w1: w * 0.8, d });
    if (d < o.depth) {
      // forks always pull back toward vertical, so the crown stays a dome
      const up = -PI / 2;
      grow(ex, ey, lerp(a - r.range(...o.fan), up, 0.15), len * r.range(0.66, 0.8), w * 0.72, d + 1);
      grow(ex, ey, lerp(a + r.range(...o.fan), up, 0.15), len * r.range(0.66, 0.8), w * 0.72, d + 1);
    } else tips.push({ x: ex, y: ey, ph: r() * TAU, bloom: o.bloom && r() < 0.6, n: r.int(1, 2) });
  };
  const lean = o.lean ? o.lean * r.sign() : r.range(-0.04, 0.04);
  grow(0, 0.4, -PI / 2 + lean, r.range(...o.len), w0, 0);
  const rs = o.rosette || 4;
  const crownY = Math.max(...tips.map((p) => p.y));
  tips.sort((p, q) => p.y - q.y); // higher rosettes behind
  // a star of stiff leaves: long and lit on top, short and dark underneath
  const spikes = [];
  for (let k = 0; k < 12; k++) {
    const a = -PI / 2 + (k / 12) * TAU + 0.13, up = -Math.sin(a);
    spikes.push({ a, l: rs * (0.6 + 0.4 * Math.max(0, up)) + 0.4, col: up > 0.75 ? 'aloe3' : up > 0.2 ? 'aloe2' : up > -0.4 ? 'aloe1' : 'aloe0' });
  }
  spikes.sort((p, q) => Math.sin(q.a) - Math.sin(p.a)); // lower leaves first, lit ones over them
  const seamY = segs[0].ey;
  const SAND = { [hex('sand2')]: 'bone', [hex('sand1')]: 'bone0', [hex('sand0')]: 'boneD' };
  return plant((g, sway, t) => {
    g.part((c) => {
      const s0 = segs[0];
      c.chain([[s0.x, s0.y, w0 + 1.6], [lerp(s0.x, s0.ex, 0.5), lerp(s0.y, s0.ey, 0.5), w0 + 0.6], [s0.ex, s0.ey, w0 * 0.74]], 'sand1');
      for (const s of segs.slice(1)) c.limb(s.x, s.y, s.ex, s.ey, s.w0, s.w1, 'bone0');
      c.limb(-w0 * 0.9, 0.4, -0.4, -3.5, 1.8, 1.2, 'sand1'); c.limb(w0 * 0.9, 0.4, 0.4, -3.5, 1.8, 1.2, 'sand1'); // root flare
      ground(c);
      barkShade(c, null, { keys: ['sand1', 'bone0'] });
      // the trunk's papery plates
      const L0 = Math.hypot(s0.ex - s0.x, s0.ey - s0.y);
      for (let k = 2; k < L0 - 2; k += 2.5) {
        const u = k / L0;
        c.px(lerp(s0.x, s0.ex, u) + ((k * 2) % 3) - 1, lerp(s0.y, s0.ey, u), 'sand0', true);
      }
      // golden trunk fades into the gray limbs through a dithered band
      c.remap((x, y, h) => (SAND[h] && y < seamY + 4 && (y < seamY + 1 || ((Math.floor(x) + Math.floor(y)) & 1)) ? SAND[h] : undefined));
      // rosettes shade the upper limbs
      c.tone((x, y) => (y < crownY + 2 ? -1 : 0));
    });
    for (const p of tips) {
      g.ell(p.x, p.y - 0.4, 1.4, 1.1, 'aloeD');
      for (const s of spikes) {
        const tr = Math.sin(s.a) < -0.2 ? wave(t * 2, p.ph + s.a * 3) * 0.55 : 0; // only the upper leaf tips tremble
        g.pline(p.x, p.y - 0.6, p.x + Math.cos(s.a) * s.l + tr, p.y - 0.6 + Math.sin(s.a) * s.l * 0.75, s.col);
      }
      g.px(p.x, p.y - 0.6, 'aloe0');
      if (p.bloom) for (let k = 0; k < p.n; k++) {
        const bx = p.x + (k - (p.n - 1) / 2) * 2, nod = wave(t, p.ph) * 0.7;
        g.pline(bx, p.y - 1.5, bx + nod, p.y - 4.5 - k, 'gold0');
        g.pline(bx + nod, p.y - 4 - k, bx + nod, p.y - 6.5 - k, 'gold1');
        g.px(bx + nod, p.y - 6.5 - k, 'gold2');
      }
    }
    void sway;
  }, { shadow: { rx: 14 + o.depth * 2, ry: 5, dy: 0 }, shade: 14, solid: 3 }, { side: 56, up: 84, down: 6 });
}

// ---------- succulent arms (candelabra, euphorbia) ----------
// One ribbed arm: a tapered chain, lit left, shaded right, a pale rib down the upright part.
function arm(g, pts, col, rib, tip, sep = 0) {
  g.part((c) => {
    c.chain(pts, col);
    ground(c);
    c.bevel({ up: 1, down: 0, left: 1, right: 1, only: [col] });
    const a = pts[pts.length - 2], b = pts[pts.length - 1];
    c.pline(lerp(a[0], b[0], 0.15) - 0.45, lerp(a[1], b[1], 0.15), b[0] - 0.45, b[1] + 1.2, rib, true);
    c.px(b[0], b[1] - b[2] / 2 + 0.6, tip, true);
  }, { sep });
}

// ---------- candelabra euphorbia ----------
const CANDELABRA = [
  { hip: [20, 22], n: [5, 7], spread: [34, 38], arm: [16, 32] }, // classic
  { hip: [26, 30], n: [4, 4], spread: [22, 26], arm: [14, 22] }, // tall, few arms
  { hip: [12, 14], n: [8, 9], spread: [42, 46], arm: [14, 26], cup: true }, // wide cup
  { hip: [16, 18], n: [3, 3], spread: [18, 20], arm: [10, 16] }, // young
  { hip: [20, 22], n: [6, 7], spread: [36, 40], arm: [20, 30], bloom: true }, // in fruit
];
function candelabra(seed, o) {
  const r = rng(seed);
  const hip = -r.range(...o.hip), n = r.int(...o.n), spread = r.range(...o.spread);
  const arms = [];
  for (let i = 0; i < n; i++) {
    const u = n > 1 ? i / (n - 1) - 0.5 : 0;
    const off = u * spread + r.range(-1, 1);
    const top = hip - r.range(...o.arm) + Math.abs(off) * (o.cup ? -0.3 : 0.3);
    arms.push({ off, top, back: i % 2 === 1, ph: r() * TAU, w: r.range(2.9, 3.4), fruit: o.bloom ? r.int(1, 3) : 0 });
  }
  // back row first, then the front row over it
  arms.sort((a, b) => (b.back - a.back) || (Math.abs(b.off) - Math.abs(a.off)));
  return plant((g, sway, t) => {
    g.part((c) => {
      c.chain([[0, 0.4, 5], [0, hip * 0.5, 4.2], [0, hip + 1, 4.6]], 'bark1');
      c.limb(-2.6, 0.4, -0.5, -2.5, 1.6, 1.2, 'bark1'); c.limb(2.6, 0.4, 0.5, -2.5, 1.6, 1.2, 'bark1');
      ground(c);
      barkShade(c, null, { keys: ['bark1'] });
      for (let y = -3; y > hip + 3; y -= 3) c.px((y / 3) & 1 ? 0.6 : -0.9, y, 'bark0', true);
    });
    for (const a of arms) {
      const tr = 0; // the arms are rigid; only the fruit trembles
      const ex = a.off * 1.0, el = hip - 3 - Math.abs(a.off) * 0.12;
      const pts = Math.abs(a.off) < 2
        ? [[a.off * 0.4, hip, a.w + 0.4], [ex, a.top + 2, a.w], [ex + tr, a.top, a.w - 0.2]]
        : [[a.off * 0.15, hip, a.w + 0.6], [a.off * 0.7, el + 1.5, a.w], [ex, el - 2.5, a.w], [ex, a.top + 2, a.w], [ex + tr, a.top, a.w - 0.2]];
      arm(g, pts, a.back ? 'leaf1' : 'leaf2', a.back ? 'leaf2' : 'leaf3', a.back ? 'leaf3' : 'leaf4', 1);
      if (a.fruit) {
        const cols = ['blood1', 'gold1', 'danger'];
        for (let k = 0; k < a.fruit; k++) g.px(ex + (k - 1) * 1.1 + (k === 1 && wave(t, a.ph) > 0.6 ? 1 : 0), a.top - 0.8 + (k === 1 ? -0.6 : 0.4), cols[(k + Math.round(Math.abs(a.off))) % 3]);
      }
    }
    void sway;
  }, { shadow: { rx: spread / 2 + 2, ry: 5, dy: 0 }, shade: 16, solid: 3 }, { side: 40, up: 80, down: 6 });
}

// ---------- snags: charred tree, bleached dead tree ----------
function snag(r, o, { h, k = 1, trunk, n, lean, from, twig }) {
  const H = r.range(...h);
  const topX = lean;
  const limbs = [];
  for (let i = 0; i < n; i++) {
    const a = -PI / 2 + r.range(-from, from), L = r.range(10, 18) * k;
    const sy = -H + r.range(...twig.sy);
    const sx = lerp(0, topX, clamp(-sy / H, 0, 1));
    const ex = sx + Math.cos(a) * L, ey = sy + Math.sin(a) * L;
    const broken = r() < 0.4;
    limbs.push({ sx, sy, ex, ey, tx: ex + r.range(-4, 4), ty: ey - r.range(...twig.len), broken, w: r.range(1.5, 2) });
  }
  return { H, topX, trunk, limbs, jag: r.sign() };
}
function drawSnag(c, s, col) {
  c.chain([[0, 0.4, s.trunk + 1], [s.topX * 0.4, -s.H * 0.4, s.trunk * 0.92], [s.topX, -s.H, s.trunk * 0.62]], col);
  c.limb(-s.trunk * 0.8, 0.4, -0.4, -2.5, 1.6, 1.1, col); c.limb(s.trunk * 0.8, 0.4, 0.4, -2.5, 1.6, 1.1, col);
  // the top snapped off: one splinter standing up on one side
  c.limb(s.topX + s.jag * s.trunk * 0.2, -s.H + 0.5, s.topX + s.jag * 0.8, -s.H - 2.6, 1.2, 0.5, col);
  for (const l of s.limbs) {
    if (l.broken) c.limb(l.sx, l.sy, l.ex, l.ey, l.w, 1.2, col);
    else c.chain([[l.sx, l.sy, l.w], [l.ex, l.ey, 1.2], [l.tx, l.ty, 0.7]], col);
  }
}

const CHARRED = [
  { h: [22, 26], n: 5 }, // classic
  { h: [30, 34], n: 3, k: 0.8 }, // tall snag
  { h: [10, 12], n: 1, trunk: 4.4, k: 0.5 }, // stump
  { h: [18, 20], n: 7, k: 1.2 }, // broad
];
const EMBER = ['emberD', 'fireD', 'fire0', 'fire1', 'fire2'];
function charred(seed, o) {
  const r = rng(seed);
  const s = snag(r, o, { h: o.h, k: o.k || 1, trunk: o.trunk || 3.2, n: o.n, lean: r.range(-3, 3), from: 1.2, twig: { sy: [0, 8], len: [2, 5] } });
  // embers sit in the cracks of the trunk and the snapped top; each pulses on its own beat
  const embers = [];
  const ne = o.n === 1 ? 4 : 3 + (o.n > 5 ? 1 : 0);
  for (let i = 0; i < ne; i++) {
    const u = o.n === 1 ? r.range(0.55, 1) : r.range(0.08, 0.7);
    embers.push({ x: lerp(0, s.topX, u) + r.range(-1, 1), y: -u * s.H + 0.5, ph: r() * TAU, hot: i === 0 ? 1 : 0 });
  }
  const BASE = hex('basalt1'), LIT = hex('basalt3');
  return plant((g, sway, t) => {
    g.part((c) => {
      drawSnag(c, s, 'basalt1');
      ground(c);
      c.bevel({ up: 1, left: 1, down: 1, right: 1, hi: 2, lo: 1, only: ['basalt1'] });
      // ash-gray bloom on the lit edges, charcoal checks on the flat
      c.remap((x, y, h) => {
        if (h === LIT) return hash(x * 2, y * 2, seed) < 0.55 ? 'ash3' : 'ash2';
        if (h === BASE && hash(x * 2, y * 2, seed + 1) < 0.18) return 'basaltD';
        return undefined;
      });
    });
    g.outline({ corners: false });
    for (const e of embers) {
      const v = Math.sin(t * TAU + e.ph);
      const lvl = clamp(Math.round(1.6 + e.hot + v * 1.6), 0, 4);
      g.px(e.x, e.y, EMBER[lvl], true);
      if (lvl >= 3) g.px(e.x, e.y + 1, 'fireD', true);
    }
    void sway;
  }, { shadow: { rx: 12, ry: 3, dy: 0 }, solid: 3 }, { side: 40, up: 64, down: 6, outline: false });
}

const DEADTREE = [
  { h: [19, 21], n: 5 }, { h: [26, 30], n: 3, k: 0.8 }, { h: [12, 14], n: 4, k: 0.7, trunk: 3.6 },
  { h: [18, 22], n: 7, k: 1.1 }, { h: [22, 24], n: 2, k: 1.2 },
];
function deadtree(seed, o) {
  const r = rng(seed);
  const s = snag(r, o, { h: o.h, k: o.k || 1, trunk: o.trunk || 3, n: o.n, lean: r.range(-2, 2), from: 1.3, twig: { sy: [-4, 4], len: [2, 6] } });
  const grain = [];
  for (let i = 0; i < 5; i++) grain.push([lerp(0, s.topX, i / 5) + r.range(-0.8, 0.6), -r.range(2, s.H - 2), r.int(2, 4)]);
  return still((g) => {
    g.part((c) => {
      drawSnag(c, s, 'bone');
      ground(c);
      // lit left edge, a gray shadow side two pixels deep on the right
      c.bevel({ up: 1, left: 1, down: 1, right: 2, only: ['bone'] });
      for (const [x, y, len] of grain) c.pline(x, y, x, y - len, 'bone0', true);
      c.px(lerp(0, s.topX, 0.35) + 0.3, -s.H * 0.35, 'boneD', true); // knot hole
    });
  }, { shadow: { rx: 12, ry: 3, dy: 0 }, solid: 3 }, { side: 40, up: 60, down: 6 });
}

// ---------- euphorbia (small columnar succulent) ----------
const EUPHORBIA = [{ h: [22, 24], n: 4 }, { h: [16, 18], n: 2 }, { h: [28, 30], n: 6 }, { h: [20, 22], n: 3 }];
function euphorbia(seed, o) {
  const r = rng(seed);
  const H = r.range(...o.h);
  const arms = [];
  for (let i = 0; i < o.n; i++) {
    const side = i % 2 ? 1 : -1, sy = -r.range(H * 0.2, H * 0.6), L = r.range(4, 6.5);
    arms.push({ side, sy, L, top: sy - r.range(6, 10) });
  }
  return still((g) => {
    for (const a of arms) if (a.sy < -H * 0.4) arm(g, [[0, a.sy, 2.6], [a.side * a.L * 0.75, a.sy - 0.6, 2.5], [a.side * a.L, a.sy - 2.5, 2.4], [a.side * a.L, a.top, 2.3]], 'lush0', 'lush1', 'lush2', 1);
    arm(g, [[0, 0.4, 3.8], [0, -H * 0.5, 3.4], [0, -H, 3.1]], 'lush1', 'lush2', 'lush3', 1);
    for (const a of arms) if (a.sy >= -H * 0.4) arm(g, [[0, a.sy, 2.6], [a.side * a.L * 0.75, a.sy - 0.6, 2.5], [a.side * a.L, a.sy - 2.5, 2.4], [a.side * a.L, a.top, 2.3]], 'lush1', 'lush2', 'lush3', 1);
    // the stem grows in segments: a darker pinch where each season's growth starts
    const rings = [-H * 0.33, -H * 0.66].map(Math.round);
    g.tone((x, y) => (Math.abs(x) < 2 && rings.includes(Math.floor(y)) ? -1 : 0));
    for (const a of arms) g.tone((x, y) => (Math.abs(x - a.side * a.L) < 1.4 && Math.floor(y) === Math.round(a.top + 4) ? -1 : 0));
    if (o.n % 2 === 0) { g.px(-0.5, -H - 1.2, 'gold1', true); g.px(0.5, -H - 1.2, 'gold0', true); }
  }, { shadow: { rx: 7, ry: 2.5, dy: 0 }, solid: 3 }, { side: 20, up: 38, down: 6 });
}

// ---------- aloe ----------
const ALOE = [{ leaves: 7, spikes: 1 }, { leaves: 9, spikes: 2 }, { leaves: 5, spikes: 0 }, { leaves: 9, spikes: 3 }];
function aloe(seed, o) {
  const r = rng(seed);
  const leaves = [];
  for (let i = 0; i < o.leaves; i++) {
    const u = i / (o.leaves - 1) - 0.5, a = -PI / 2 + u * 2.9;
    const L = r.range(8, 9.5) * (1 - Math.abs(u) * 0.35), side = Math.sign(u) || 1;
    // stiff pointed leaves fanning up; the outer ones arch over a little at the tip
    const m = [Math.cos(a) * L * 0.55, -1 + Math.sin(a) * L * 0.55];
    const b = a + side * Math.abs(u) * 0.55;
    leaves.push({ pts: [[0, -1, 2.4], [m[0], m[1], 1.9], [m[0] + Math.cos(b) * L * 0.45, m[1] + Math.sin(b) * L * 0.45, 0.5]], col: Math.abs(u) < 0.15 ? 'aloe1' : Math.abs(u) < 0.35 ? 'aloe2' : 'aloe1', z: -Math.abs(u) });
  }
  leaves.sort((p, q) => q.z - p.z); // upright leaves sit behind the spreading ones
  const front = [];
  for (let i = 0; i < Math.min(3, o.leaves - 3); i++) {
    const a = PI / 2 + (i - (Math.min(3, o.leaves - 3) - 1) / 2) * 1.1 + r.range(-0.15, 0.15), L = r.range(3.5, 5);
    front.push([[0, -1.6, 2.6], [Math.cos(a) * L, -1.6 + Math.sin(a) * L * 0.5 + 0.5, 0.8]]);
  }
  const spikes = [];
  for (let k = 0; k < o.spikes; k++) {
    const sx = (k - (o.spikes - 1) / 2) * 3;
    spikes.push({ x: Math.round(sx * 0.4), lean: sx * 1.2 + r.range(-0.6, 0.6), len: r.range(12, 15), ph: r() * TAU + k * 1.7, red: k % 2 === 1 });
  }
  return plant((g, sway, t) => {
    // flower stalks: unoutlined 1px, they nod, the raceme follows the tip
    for (const s of spikes) {
      const bend = wave(t, s.ph) * 0.9;
      const tip = blade(g, s.x, -3, s.len, s.lean, bend, 'thorn1');
      const dx = clamp((s.lean + bend) / s.len, -0.5, 0.5) * 0.4;
      const base = s.red ? 'fireD' : 'fire0', bud = s.red ? 'emberD' : 'fireD', open = s.red ? 'fire0' : 'fire1';
      g.part((c) => {
        // a slim cone, pixel by pixel: opened flowers paler at the bottom, red buds on top
        const ROWS = [[1, open], [2, open], [2, base], [2, base], [2, base], [2, bud], [1, bud]];
        ROWS.forEach(([w, col], k) => {
          const x = tip[0] + dx * (k + 1) - (w === 2 ? 0.5 : 0);
          c.px(x, tip[1] - 1 - k, col);
          if (w === 2) c.px(x + 1, tip[1] - 1 - k, k < 3 ? col : shade(col));
        });
        c.outline();
      });
    }
    g.part((c) => {
      for (const l of leaves) {
        c.part((d) => {
          d.chain(l.pts, l.col);
          d.bevel({ up: 1, left: 1, down: 1, right: 0, only: [l.col] });
          const e = l.pts[2];
          d.px(e[0], e[1], 'aloeT', true);
        }, { sep: 1 });
      }
      for (const f of front) c.part((d) => { d.chain([[f[0][0], f[0][1], f[0][2]], [f[1][0], f[1][1], f[1][2]]], 'aloe3'); d.bevel({ up: 0, down: 1, only: ['aloe3'] }); }, { sep: 1 });
      // pale teeth along the arched leaves' upper edges
      for (const l of leaves) if (l.z < -0.25) {
        const m = l.pts[1];
        c.px(m[0], m[1] - 1.3, 'aloe3', true);
      }
      c.outline();
    });
    void sway;
  }, { shadow: { rx: 6, ry: 2, dy: 0 } }, { side: 18, up: 30, down: 6, outline: false });
}

// ---------- leafy bush, thorn bush ----------
const BUSH = [
  { s: 1, n: 6, tones: ['leafD', 'leaf0', 'leaf1', 'leaf2', 'leaf3'] },
  { s: 0.8, n: 4, tones: ['leafD', 'leaf0', 'leaf1', 'leaf2', 'leaf3'] },
  { s: 1.25, n: 7, tones: ['leaf0', 'leaf1', 'leaf2', 'leaf3', 'leaf4'] },
  { s: 1, n: 6, tones: ['leafD', 'lushD', 'lush0', 'lush1', 'lush2'], berries: 6 },
  { s: 1.1, n: 5, tones: ['olLeaf', 'leafD', 'leaf0', 'leaf1', 'leaf2'] },
];
const THORN = [{ s: 1, n: 6 }, { s: 0.8, n: 4 }, { s: 1.25, n: 7 }, { s: 1.05, n: 5 }];
const THORN_T = ['thornD', 'thorn0', 'thorn1', 'thorn2', 'lush2'];
function bush(seed, thorn, o) {
  const r = rng(seed);
  const s = o.s, top = -12 * s, amp = thorn ? 0.7 : 0.9;
  const tuft = thorn ? [1.0, 1.6] : [1.3, 2.1];
  const clumps = [clump(r, r.range(-1, 1), -5.2 * s, 8.5 * s, 5 * s, { tuft, rim: thorn ? 0.85 : 0.65, flat: 0.3 })];
  for (let i = 1; i < o.n; i++) {
    const cx = r.range(-7, 7) * s, cy = -4.4 * s + r.range(-3, 1.2) * s, rr = r.range(3.2, 5) * s;
    clumps.push(clump(r, cx, cy, rr, rr * 0.78, { tuft, rim: thorn ? 0.85 : 0.6, shade: cy > -5 * s ? -1 : 0 }));
  }
  clumps.sort((a, b) => a.cy - b.cy);
  const stems = [];
  for (let i = 0; i < 3; i++) stems.push([r.range(-3, 3) * s, r.range(-6, -3) * s]);
  const twigs = [], dots = [];
  if (thorn) {
    for (let i = 0; i < 8; i++) {
      const a = -PI / 2 + (i / 7 - 0.5) * 3 + r.range(-0.15, 0.15), R = r.range(10, 13) * s;
      twigs.push({ x0: Math.cos(a) * R * 0.68, y0: -5 * s + Math.sin(a) * R * 0.42, x1: Math.cos(a) * R, y1: -5 * s + Math.sin(a) * R * 0.6, a });
    }
    for (let i = 0; i < 7; i++) dots.push([r.range(-8, 8) * s, -r.range(3, 10) * s, 'bone0']);
  } else for (let i = 0; i < (o.berries || 0); i++) dots.push([r.range(-7, 7) * s, -r.range(3, 10) * s, 'blood1']);
  const tones = thorn ? THORN_T : o.tones;
  return plant((g, sway, t) => {
    g.part((c) => {
      for (const [x, y] of stems) c.limb(x * 0.3, 0.3, x, y, 1.4, 1, 'bark1');
      ground(c);
      barkShade(c, null, { keys: ['bark1'] });
    });
    drawClumps(g, clumps, tones, sway, t, { amp, top, flutter: 0.12 });
    for (const [x, y, col] of dots) {
      const off = clumpOff(nearest(clumps, x, y), t, amp, top);
      g.px(x + off, y, col, true);
      if (col === 'blood1' && (x * 7 & 1)) g.px(x + off + 1, y + 1, 'blood', true);
    }
    g.outline();
    // bare twigs poke out of the rim, unoutlined so they stay thin, and carry pale thorns
    for (const w of twigs) {
      const off = clumpOff(nearest(clumps, w.x1, w.y1), t, amp, top);
      g.pline(w.x0 + off * 0.6, w.y0, w.x1 + off, w.y1, 'thornD');
      // paired spines just short of the tip
      const mx = lerp(w.x0, w.x1, 0.8) + off, my = lerp(w.y0, w.y1, 0.8);
      g.px(mx - Math.sin(w.a) * 1.2, my - 1, 'bone'); g.px(w.x1 + off, w.y1 - 1, 'bone0');
    }
  }, { shadow: { rx: 11 * s, ry: 4 * s, dy: 0 } }, { side: 22, up: 24, down: 6, outline: false });
}

// ---------- low shrubs: sage, heath, thornbush ----------
const SHRUB_SIZES = [{ s: 1 }, { s: 0.75, n: 4 }, { s: 1.25, n: 6 }, { s: 1.1, n: 7, dots: 7 }];
const SHRUBS = {
  sage: { tones: ['sageD', 'sage0', 'sage1', 'sage2', 'sage3'], tuft: [0.8, 1.3], dot: ['salt3', 'sage3'], rim: 0.85, sprig: 'salt3' },
  heath: { tones: ['leafD', 'leaf0', 'thorn1', 'lush1', 'lush2'], tuft: [0.9, 1.4], dot: ['flam1', 'flam0'], rim: 0.7, more: 2, sprig: 'flam1' },
  thornbush: { tones: ['thornD', 'thorn0', 'thorn1', 'thorn2', 'lush2'], tuft: [0.9, 1.4], dot: ['bone0', 'bone0'], rim: 0.8, spiky: true },
};
function shrub(seed, kind, o) {
  const r = rng(seed), K = SHRUBS[kind];
  const s = o.s || 1, n = o.n || 5, top = -9 * s, amp = 0.7;
  const clumps = [];
  for (let i = 0; i < n; i++) {
    // clumps along a low dome: the middle ones higher, so the mound has a crown and not a flat top
    const u = n > 1 ? i / (n - 1) - 0.5 : 0;
    const rx = r.range(3.2, 4.6) * s, ry = r.range(2.8, 3.8) * s * (1 - Math.abs(u) * 0.45);
    clumps.push(clump(r, u * 12 * s + r.range(-1, 1), -ry * 0.9 - (1 - Math.abs(u) * 2) * 2.2 * s, rx, ry, { tuft: K.tuft, rim: K.rim, flat: 0.4, shade: Math.abs(u) > 0.35 ? -1 : 0 }));
  }
  // flower sprigs standing out of the top of the mound
  const sprigs = [];
  if (K.sprig) for (let i = 0; i < 3 + Math.round(s * 2); i++) {
    const x = Math.round(r.range(-6, 6) * s);
    sprigs.push({ x, y: Math.round(-7.5 * s * (1 - (x / (10 * s)) ** 2) + 1.5), len: r.range(3, 5) * s, lean: r.range(-1.2, 1.2) + x * 0.15, ph: r() * TAU });
  }
  clumps.sort((a, b) => a.cy - b.cy);
  const spikes = [];
  if (K.spiky) for (let i = 0; i < 12; i++) {
    const a = -PI / 2 + (i / 11 - 0.5) * 3.3 + r.range(-0.1, 0.1);
    spikes.push({ a, R: r.range(9.5, 12) * s, ph: r() * TAU });
  }
  const dots = [];
  for (let i = 0; i < (o.dots || 4) * (K.more || 1); i++) dots.push([r.range(-7, 7) * s, -r.range(2.5, 8) * s, r() < 0.6 ? K.dot[0] : K.dot[1]]);
  return plant((g, sway, t) => {
    drawClumps(g, clumps, K.tones, sway, t, { amp, top, flutter: 0.12 });
    for (const [x, y, col] of dots) g.px(x + clumpOff(nearest(clumps, x, y), t, amp, top), y, col, true);
    g.outline();
    for (const p of sprigs) {
      const tip = blade(g, p.x, p.y, p.len, p.lean, wave(t, p.ph) * 0.8, K.tones[1]);
      g.px(tip[0], tip[1], K.sprig);
    }
    // spines drawn after the outline so they stay a thin 1px
    for (const p of spikes) {
      const c = nearest(clumps, Math.cos(p.a) * p.R, -4 * s + Math.sin(p.a) * p.R * 0.6), off = clumpOff(c, t, amp, top);
      g.pline(Math.cos(p.a) * p.R * 0.68 + off * 0.5, -3.5 * s + Math.sin(p.a) * p.R * 0.45, Math.cos(p.a) * p.R + off, -3.5 * s + Math.sin(p.a) * p.R * 0.6, 'thornD');
      g.px(Math.cos(p.a) * p.R + off, -3.5 * s + Math.sin(p.a) * p.R * 0.6, 'bone0');
    }
  }, { shadow: { rx: 10 * s, ry: 3.5 * s, dy: 0 } }, { side: 18, up: 18, down: 6, outline: false });
}

// ---------- fern ----------
const FERN = [{ n: 7, L: 11 }, { n: 5, L: 9 }, { n: 9, L: 13 }, { n: 6, L: 12 }];
// quadratic bezier point
const qb = (p0, p1, p2, u) => [(1 - u) * (1 - u) * p0[0] + 2 * (1 - u) * u * p1[0] + u * u * p2[0], (1 - u) * (1 - u) * p0[1] + 2 * (1 - u) * u * p1[1] + u * u * p2[1]];
function fern(seed, o) {
  const r = rng(seed);
  const fronds = [];
  for (let i = 0; i < o.n; i++) {
    const a = -PI / 2 + (i / (o.n - 1) - 0.5) * 2.7 + r.range(-0.1, 0.1);
    const L = o.L * r.range(0.85, 1.05);
    fronds.push({ a, L, ph: r() * TAU, z: Math.abs(Math.cos(a)) });
  }
  fronds.sort((p, q) => p.z - q.z); // upright fronds behind, spreading ones in front
  return plant((g, sway, t) => {
    fronds.forEach((f, i) => {
      const ca = Math.cos(f.a), sa = Math.sin(f.a);
      const bob = wave(t, f.ph) * (0.4 + f.z * 0.6);
      // each frond rises from the crown, then arches out; the spreading ones fall back toward the ground
      const up = -sa;
      const p0 = [0.5, -0.5], p1 = [ca * f.L * 0.4, -f.L * (0.55 + 0.45 * up)];
      const p2 = [ca * f.L * 0.95 + bob * 0.3, -f.L * (0.12 + 0.7 * up) + bob * 0.9];
      const dark = i < fronds.length * 0.4;
      const rach = dark ? 'leaf0' : 'leaf1', lf = dark ? 'leaf1' : 'leaf3', hi = dark ? 'leaf2' : 'leaf4';
      const N = Math.ceil(f.L * 1.6);
      let prev = qb(p0, p1, p2, 0);
      const pts = [];
      for (let k = 1; k <= N; k++) { const q = qb(p0, p1, p2, k / N); pts.push([prev, q]); prev = q; }
      // leaflets: paired, angled toward the tip, shrinking along the frond
      for (let k = Math.ceil(pts.length * 0.3); k < pts.length - 1; k += 2) {
        const [a, b] = pts[k], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
        const tx = dx / d, ty = dy / d, u = k / pts.length, len = lerp(2.6, 0.6, (u - 0.3) / 0.7);
        for (const sd of [-1, 1]) {
          if (u > 0.55 && ((k >> 1) % 2 ? sd > 0 : sd < 0)) continue; // leaflets alternate past the base, so the frond reads as a feather, not a pad
          const nx = -ty * sd, ny = tx * sd;
          g.pline(b[0], b[1], b[0] + (nx * 0.85 + tx * 0.55) * len, b[1] + (ny * 0.85 + ty * 0.55) * len, ny < 0 ? lf : rach);
        }
      }
      for (const [a, b] of pts) g.pline(a[0], a[1], b[0], b[1], rach);
      g.px(p2[0], p2[1], hi);
    });
  }, {}, { side: 20, up: 18, down: 6, outline: false });
}

// ---------- papyrus ----------
const PAPYRUS = [{ n: 6, h: [16, 26] }, { n: 4, h: [12, 18] }, { n: 8, h: [20, 30] }, { n: 5, h: [22, 28] }];
function papyrus(seed, o) {
  const r = rng(seed);
  const stems = [];
  for (let i = 0; i < o.n; i++) {
    // spread the stems over distinct columns so two never fuse into one thick stalk
    const bx = Math.round(-5 + (i / Math.max(1, o.n - 1)) * 10 * (o.n > 5 ? 1.1 : 0.9) + r.range(-0.4, 0.4)), h = r.range(...o.h);
    stems.push({ bx, h, lean: r.range(-3, 3) + bx * 0.35, ph: bx * 0.35 + r.range(-0.6, 0.6), rays: r.int(11, 13), R: r.range(4.8, 6) });
  }
  stems.sort((a, b) => b.h - a.h); // tall ones stand behind
  return plant((g, sway, t) => {
    stems.forEach((s, i) => {
      const back = i < stems.length / 2;
      const bend = wave(t, s.ph) * 1.5 * (s.h / 26);
      const tip = blade(g, s.bx, 0, s.h, s.lean, bend, back ? 'leaf1' : 'leaf2');
      // the umbel nods with the stem and droops a little more on the leeward side
      const nod = (s.lean + bend) / s.h * 0.9;
      const cx = tip[0], cy = tip[1];
      for (let k = 0; k < s.rays; k++) {
        // a starburst of fine rays, the outer ones arching over and drooping
        const a = -PI / 2 + (k / (s.rays - 1) - 0.5) * 2 * 1.5 + nod;
        const R = s.R * (k % 2 ? 0.8 : 1);
        const ex = cx + Math.cos(a) * R, ey = cy + Math.sin(a) * R * 0.7;
        const droop = Math.abs(Math.cos(a)) ** 2 * R * 0.6;
        strand(g, [[cx, cy], [cx + Math.cos(a) * R * 0.55, cy + Math.sin(a) * R * 0.55], [ex, ey + droop]], k % 2 ? (back ? 'leaf2' : 'leaf3') : (back ? 'leaf3' : 'leaf4'), 3);
        if (k % 4 === 2) g.px(ex, ey + droop, back ? 'fever0' : 'fever1');
      }
      g.px(cx, cy + 0.2, 'bark2');
    });
    void sway;
  }, {}, { side: 22, up: 40, down: 6, outline: false });
}

// ---------- reeds (cattails) ----------
function reeds(seed) {
  const r = rng(seed);
  const leaves = [], tails = [];
  for (let i = 0; i < 7; i++) leaves.push({ x: Math.round(r.range(-6, 6)), len: r.range(8, 14), lean: r.range(-3.5, 3.5), ph: r() * TAU, col: r.pick(['lush0', 'lush1', 'lush2']) });
  for (let i = 0; i < 2 + (seed % 2); i++) tails.push({ x: Math.round(r.range(-4, 4)), len: r.range(13, 16), lean: r.range(-1.5, 1.5), ph: r() * TAU });
  leaves.sort((a, b) => (a.col > b.col ? 1 : -1));
  return plant((g, sway, t) => {
    for (const l of leaves.slice(0, 3)) blade(g, l.x, 0, l.len, l.lean, wave(t, l.ph) * 1.2 * l.len / 14, l.col);
    for (const c of tails) {
      const bend = wave(t, c.ph) * 1.1;
      const tip = blade(g, c.x, 0, c.len, c.lean, bend, 'lush0');
      const dx = (c.lean + bend) / c.len * 1.3;
      g.part((d) => {
        d.limb(tip[0] - dx * 5, tip[1] + 5, tip[0] - dx * 1.8, tip[1] + 1.8, 1.9, 1.7, 'mud1');
        d.bevel({ up: 1, left: 1, right: 1, down: 0, only: ['mud1'] });
      });
    }
    for (const l of leaves.slice(3)) blade(g, l.x, 0, l.len, l.lean, wave(t, l.ph) * 1.2 * l.len / 14, l.col);
    void sway;
  }, {}, { side: 14, up: 20, down: 6, outline: false });
}

// ---------- lily pads ----------
function lily(seed, flower) {
  const r = rng(seed);
  const pads = [];
  for (let i = 0; i < 3; i++) {
    const rr = r.range(3.6, 4.6);
    // pixel-centered pads; the notch points sideways so it never splits the thin pad in two
    pads.push({ x: Math.round(r.range(-6, 6)), y: Math.round(r.range(-3, 3)) + 0.5, rr, notch: (r() < 0.5 ? 0 : PI) + r.range(-0.35, 0.35), ph: i * 2.1 + r.range(-0.4, 0.4) });
  }
  pads.sort((a, b) => a.y - b.y);
  const fp = pads[pads.length - 1];
  return plant((g, sway, t) => {
    for (const p of pads) {
      const dy = wave(t, p.ph) > 0.3 ? 1 : 0; // slow one-pixel bob, each pad on its own beat
      g.part((c) => {
        c.ell(p.x, p.y + dy, p.rr, p.rr * 0.62, 'lush1');
        c.bevel({ up: 1, down: 1, only: ['lush1'] });
        c.remap((x, y) => {
          const ax = (x - p.x) / p.rr, ay = (y - p.y - dy) / (p.rr * 0.62);
          let da = Math.atan2(ay, ax) - p.notch; da = Math.atan2(Math.sin(da), Math.cos(da));
          // a one-pixel slit from the center out to the rim
          const ux = Math.cos(p.notch), uy = Math.sin(p.notch), vx = x - p.x, vy = y - p.y - dy;
          const along = vx * ux + vy * uy, across = Math.abs(-vx * uy + vy * ux);
          void da; void ax; void ay;
          return along > 0.6 && across < 0.3 + along * 0.16 ? null : undefined;
        });
        c.px(p.x - Math.cos(p.notch) * p.rr * 0.45, p.y + dy - 0.6, 'lush3', true); // wet glint
      }, { sep: 1 });
    }
    if (flower) {
      const dy = wave(t, fp.ph) > 0.3 ? 1 : 0;
      g.stamp(fp.x - Math.cos(fp.notch) * 0.8, fp.y + dy - 1.5, ['b.b', 'aca', '.a.'], { a: 'flam1', b: 'flam0', c: 'gold1' }, { ax: 1, ay: 1 });
      g.px(fp.x - Math.cos(fp.notch) * 0.8, fp.y + dy - 2.5, 'flam2');
    }
    void sway;
  }, { flat: true }, { side: 14, up: 10, down: 10, outline: false });
}

// ---------- tall grass ----------
// 7 frames per clump ordered by lean (0 full left, 3 upright, 6 full right); the game picks one
// from its own wind field so gusts roll across a meadow.
function tallgrass() {
  const W = 32, Hh = 26, OX = 16, OY = 25;
  const COLS = ['tall0', 'tall1', 'tall1', 'tall2', 'tall2', 'tall3'];
  const clumps = [];
  for (let v = 0; v < 4; v++) {
    const r = rng(300 + v);
    const blades = [];
    // nine blades from a narrow base fanning out to distinct tips, so they never fuse into one thick stalk
    const cols = [];
    for (let x = -8; x <= 8; x += 2) cols.push(x);
    for (let i = cols.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cols[i], cols[j]] = [cols[j], cols[i]]; }
    for (let i = 0; i < 9; i++) {
      const ci = r.int(0, COLS.length - 1), x = cols[i];
      blades.push({ x: Math.round(x * 0.72), len: r.range(11, 18), lean: x * 0.45 + r.range(-0.8, 0.8), ci, head: r() < 0.45, give: r.range(0.8, 1.15) });
    }
    blades.sort((a, b) => a.ci - b.ci); // dark blades behind, light in front
    const frames = [];
    for (let f = 0; f < 7; f++) {
      const L = (f - 3) / 3;
      const g = new Pix(W, Hh, OX, OY + 1, { ss: 1 });
      for (const b of blades) {
        const bend = L * 3.5 * (b.len / 18) * b.give;
        const tip = blade(g, b.x, 0, b.len, b.lean, bend, COLS[b.ci]);
        g.px(b.x + 0.5, -0.5, 'tallD');
        if (b.head) {
          // an oat-like seed head hanging off the tip, on the leeward side
          const tx = b.lean + bend, sd = tx >= 0 ? 1 : -1;
          const ux = tx * 0.5 / b.len, k = 1 / Math.hypot(ux * 3, 1);
          g.px(tip[0], tip[1], 'tall3');
          g.px(tip[0] - ux * 3 * k, tip[1] + k, 'tall3');
          g.px(tip[0] - ux * 6 * k + sd, tip[1] + 2 * k, 'tall2');
        }
      }
      const bb = g.bounds();
      if (bb && (bb[0] === 0 || bb[1] === 0 || bb[2] === W - 1)) console.warn('tallgrass hit its edge', v, f);
      frames.push(g.toCanvas());
    }
    clumps.push(frames);
  }
  return { w: W, h: Hh, ox: OX, oy: OY, clumps };
}

export function build() {
  return {
    props: {
      quiver: variants(241, QUIVER, quiver),
      candelabra: variants(251, CANDELABRA, candelabra),
      charred: variants(271, CHARRED, charred),
      deadtree: variants(141, DEADTREE, deadtree),
      euphorbia: variants(161, EUPHORBIA, euphorbia),
      aloe: variants(181, ALOE, aloe),
      bush: variants(31, BUSH, (s, o) => bush(s, false, o)),
      thorn: variants(41, THORN, (s, o) => bush(s, true, o)),
      sage: variants(281, SHRUB_SIZES, (s, o) => shrub(s, 'sage', o)),
      heath: variants(291, SHRUB_SIZES, (s, o) => shrub(s, 'heath', o)),
      thornbush: variants(311, SHRUB_SIZES, (s, o) => shrub(s, 'thornbush', o)),
      fern: variants(321, FERN, fern),
      papyrus: variants(131, PAPYRUS, papyrus),
      reeds: [91, 92, 93].map((s) => reeds(s)),
      lily: [151, 152, 153].map((s, i) => lily(s, i === 1)),
    },
    tallgrass: tallgrass(),
  };
}

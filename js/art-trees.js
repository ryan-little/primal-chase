// Trees and ground plants. Every canopy is built around the branch tips that hold it up,
// so leaves never float loose from their wood. One family of trees per kind of land.
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

// Draw a canopy from a list of [cx, cy, rx, ry] pads in three tones.
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

// Vachellia (acacia): forked trunk, flat layered crown resting on the fork tips.
function acacia(seed, flat = false) {
  const r = rng(seed);
  const w = flat ? 104 : 88, h = flat ? 66 : 72;
  const c = canvas(w, h), x = c.getContext('2d');
  const tx = w / 2 + r.range(-3, 3);
  const forkY = h - r.range(16, 22);
  line(x, [tx, h - 2, tx + r.range(-2, 2), forkY], 3.6, P.bark1);
  line(x, [tx + 1, h - 3, tx + 1, forkY + 2], 1, P.bark2);
  const n = flat ? r.int(5, 6) : r.int(3, 5);
  const span = flat ? r.range(70, 84) : r.range(44, 58);
  const top = flat ? r.range(16, 20) : r.range(18, 26);
  const tips = [];
  for (let i = 0; i < n; i++) {
    const ex = w / 2 + (i / (n - 1) - 0.5) * span + r.range(-3, 3);
    const ey = top + r.range(-2, 3) + Math.abs(i / (n - 1) - 0.5) * (flat ? 4 : 8);
    const mx = (tx + ex) / 2 + r.range(-3, 3), my = forkY - (forkY - ey) * 0.55;
    line(x, [tx, forkY + 1, mx, my, ex, ey], 2.2, P.bark1);
    tips.push([ex, ey]);
  }
  const pads = [];
  for (const [ex, ey] of tips) {
    pads.push([ex, ey - 1, r.range(9, 13) * (flat ? 1.1 : 1), r.range(3.5, 5)]);
    pads.push([ex + r.range(-8, 8), ey - r.range(2, 4), r.range(6, 9), r.range(3, 4)]);
  }
  // one long flat layer tying the tips together
  pads.push([w / 2, top - 1, span / 2 + 4, flat ? 4 : 5]);
  canopy(x, r, pads, flat ? LEAF_DARK : LEAF);
  crisp(c);
  return { img: c, ox: w / 2, oy: h - 3, shadow: { rx: span / 2 + 10, ry: flat ? 10 : 11, dy: -1 }, shade: span / 2 + 8, solid: 4 };
}

// Mopane: branches radiate from the trunk into a dense rounded crown.
function mopane(seed) {
  const r = rng(seed);
  const w = 64, h = 64, c = canvas(w, h), x = c.getContext('2d');
  const tx = w / 2 + r.range(-2, 2), cy = 24;
  line(x, [tx, h - 2, tx - 1, h - 22], 3.8, P.bark0);
  const pads = [];
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i / 5 - 0.5) * 2.4 + r.range(-0.15, 0.15);
    const L = r.range(12, 19);
    const ex = tx + Math.cos(a) * L * 1.2, ey = cy + 4 + Math.sin(a) * L * 0.8;
    line(x, [tx, h - 20, (tx + ex) / 2, (h - 20 + ey) / 2 + 2, ex, ey], 1.8, P.bark0);
    pads.push([ex, ey, r.range(8, 11), r.range(6, 8)]);
  }
  pads.push([tx, cy, 16, 11]);
  canopy(x, r, pads, LEAF, P.ochre);
  crisp(c);
  return { img: c, ox: w / 2, oy: h - 3, shadow: { rx: 26, ry: 9, dy: -1 }, shade: 30, solid: 4 };
}

// Marula: short thick trunk, broad round light crown, yellow fruit.
function marula(seed) {
  const r = rng(seed);
  const w = 72, h = 66, c = canvas(w, h), x = c.getContext('2d');
  const tx = w / 2;
  line(x, [tx, h - 2, tx, h - 20], 5, P.bark1);
  line(x, [tx - 1, h - 3, tx - 1, h - 20], 1, P.rock2);
  const pads = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i / 4 - 0.5) * 2.6;
    const ex = tx + Math.cos(a) * 20, ey = 30 + Math.sin(a) * 12;
    line(x, [tx, h - 19, ex, ey + 4], 2.2, P.bark1);
    pads.push([ex, ey, r.range(11, 14), r.range(8, 10)]);
  }
  pads.push([tx, 26, 22, 14]);
  canopy(x, r, pads, LEAF_LIGHT, P.gold1);
  crisp(c);
  return { img: c, ox: w / 2, oy: h - 3, shadow: { rx: 30, ry: 10, dy: -1 }, shade: 34, solid: 5 };
}

// Strangler fig: huge dark crown, aerial roots hanging to the ground.
function fig(seed) {
  const r = rng(seed);
  const w = 96, h = 78, c = canvas(w, h), x = c.getContext('2d');
  const tx = w / 2;
  for (let i = 0; i < 7; i++) { const rx = tx + r.range(-26, 26); line(x, [rx, 30, rx + r.range(-2, 2), h - 3], 1, P.bark2); }
  line(x, [tx - 5, h - 2, tx - 3, h - 34], 4, P.bark1);
  line(x, [tx + 5, h - 2, tx + 3, h - 34], 4, P.bark1);
  line(x, [tx, h - 3, tx, h - 30], 2, P.bark0);
  const pads = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI - Math.PI;
    const ex = tx + Math.cos(a) * 30, ey = 28 + Math.sin(a) * 10;
    line(x, [tx, h - 32, ex, ey + 6], 2, P.bark1);
    pads.push([ex, ey, r.range(12, 16), r.range(8, 10)]);
  }
  pads.push([tx, 22, 30, 14]);
  canopy(x, r, pads, LEAF_DEEP, P.ochre);
  crisp(c);
  return { img: c, ox: w / 2, oy: h - 3, shadow: { rx: 44, ry: 13, dy: -2 }, shade: 46, solid: 7 };
}

// Quiver tree (kokerboom): pale trunk forking again and again, a spiky rosette on every tip.
function quiver(seed) {
  const r = rng(seed);
  const w = 60, h = 64, c = canvas(w, h), x = c.getContext('2d');
  const tips = [];
  const branch = (bx, by, a, len, wd, depth) => {
    const ex = bx + Math.cos(a) * len, ey = by + Math.sin(a) * len;
    line(x, [bx, by, ex, ey], wd, P.sand1);
    line(x, [bx - 0.5, by, ex - 0.5, ey], Math.max(1, wd * 0.35), P.sand3);
    if (depth > 0) {
      branch(ex, ey, a - r.range(0.35, 0.6), len * 0.72, wd * 0.72, depth - 1);
      branch(ex, ey, a + r.range(0.35, 0.6), len * 0.72, wd * 0.72, depth - 1);
    } else tips.push([ex, ey]);
  };
  branch(w / 2, h - 2, -Math.PI / 2, 20, 4.6, 3);
  for (const [ex, ey] of tips) {
    for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU; line(x, [ex, ey, ex + Math.cos(a) * 4, ey + Math.sin(a) * 2.6 - 1], 1.2, k % 2 ? P.lush1 : P.lush2); }
    px(x, ex, ey - 1, P.lush2);
  }
  crisp(c);
  return { img: c, ox: w / 2, oy: h - 3, shadow: { rx: 18, ry: 5, dy: 0 }, shade: 14, solid: 3 };
}

// Candelabra euphorbia: a trunk that lifts a dozen green arms.
function candelabra(seed) {
  const r = rng(seed);
  const w = 56, h = 62, c = canvas(w, h), x = c.getContext('2d');
  const tx = w / 2;
  line(x, [tx, h - 2, tx, h - 22], 4, P.bark1);
  const n = r.int(5, 7);
  for (let i = 0; i < n; i++) {
    const off = (i / (n - 1) - 0.5) * 36;
    const top = r.range(6, 20) + Math.abs(off) * 0.3;
    line(x, [tx, h - 22, tx + off, h - 26, tx + off, top], 3, P.lush0);
    line(x, [tx + off - 0.8, h - 27, tx + off - 0.8, top + 1], 1, P.lush2);
    px(x, tx + off, top - 1, P.ochre);
  }
  crisp(c);
  return { img: c, ox: w / 2, oy: h - 3, shadow: { rx: 18, ry: 5, dy: 0 }, shade: 16, solid: 3 };
}

// Mangrove: a dark crown on arching stilt roots.
function mangrove(seed) {
  const r = rng(seed);
  const w = 60, h = 56, c = canvas(w, h), x = c.getContext('2d');
  const tx = w / 2;
  for (let i = 0; i < 6; i++) { const e = tx + (i / 5 - 0.5) * 40; line(x, [tx, h - 20, (tx + e) / 2, h - 18, e, h - 3], 1.4, P.bark1); }
  line(x, [tx, h - 18, tx, h - 30], 3, P.bark0);
  const pads = [];
  for (let i = 0; i < 5; i++) pads.push([tx + (i / 4 - 0.5) * 30, 20 + r.range(-4, 3), r.range(9, 12), r.range(6, 8)]);
  canopy(x, r, pads, LEAF_DEEP);
  crisp(c);
  return { img: c, ox: w / 2, oy: h - 3, shadow: { rx: 24, ry: 7, dy: -1 }, shade: 24, solid: 3 };
}

// A tree the fire already had.
function charred(seed) {
  const r = rng(seed);
  const w = 48, h = 56, c = canvas(w, h), x = c.getContext('2d');
  const tx = w / 2;
  line(x, [tx, h - 2, tx + r.range(-2, 2), h - 24], 3.2, P.ink);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + r.range(-1.2, 1.2), L = r.range(10, 18), sy = h - r.range(20, 28);
    const ex = tx + Math.cos(a) * L, ey = sy + Math.sin(a) * L;
    line(x, [tx, sy, ex, ey, ex + r.range(-4, 4), ey - r.range(2, 5)], 1.6, P.basalt1);
  }
  for (let i = 0; i < 4; i++) px(x, tx + r.range(-2, 2), h - r.range(4, 22), P.fire0);
  crisp(c);
  return { img: c, ox: w / 2, oy: h - 3, shadow: { rx: 12, ry: 3, dy: 0 }, solid: 3 };
}

// Low plants
function shrub(seed, tones, dots, spiky = false) {
  const r = rng(seed);
  const w = 24, h = 18, c = canvas(w, h), x = c.getContext('2d');
  const pads = [];
  for (let i = 0; i < 5; i++) pads.push([w / 2 + r.range(-6, 6), h - 6 + r.range(-3, 2), r.range(3.5, 5.5), r.range(3, 4.5)]);
  canopy(x, r, pads, tones);
  if (spiky) for (let i = 0; i < 10; i++) { const a = r() * TAU; px(x, w / 2 + Math.cos(a) * 9, h - 7 + Math.sin(a) * 5, tones[2]); }
  for (let i = 0; i < 4; i++) if (dots) px(x, r.range(5, w - 5), r.range(4, h - 5), dots);
  crisp(c);
  return { img: c, ox: w / 2, oy: h - 3, shadow: { rx: 10, ry: 3.5, dy: 0 } };
}
function fern(seed) {
  const r = rng(seed);
  const w = 26, h = 18, c = canvas(w, h), x = c.getContext('2d');
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i / 6 - 0.5) * 2.8;
    const ex = 13 + Math.cos(a) * 11, ey = h - 3 + Math.sin(a) * 12;
    line(x, [13, h - 3, (13 + ex) / 2, (h - 3 + ey) / 2 - 2, ex, ey], 1.4, i % 2 ? P.lush1 : P.lush2);
    for (let k = 1; k < 4; k++) px(x, 13 + (ex - 13) * k / 4 + 1, h - 3 + (ey - h + 3) * k / 4, P.lush0);
  }
  void r;
  crisp(c, { outline: false });
  return { img: c, ox: 13, oy: h - 3 };
}

// Tall grass: stalks that stand above the cat. Three clumps, three frames of sway each.
function tallgrass() {
  const out = [];
  for (let v = 0; v < 4; v++) {
    const r = rng(300 + v);
    const blades = [];
    for (let i = 0; i < 9; i++) blades.push([r.range(2, 14), r.range(10, 18), r.range(-2, 2), r() < 0.5 ? P.tall1 : r() < 0.5 ? P.tall2 : P.tall0, r() < 0.4]);
    const frames = [];
    for (let f = 0; f < 3; f++) {
      const c = canvas(18, 22), x = c.getContext('2d');
      const sway = (f - 1) * 1.6;
      for (const [bx, len, lean, col, head] of blades) {
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
    acacia: [11, 12, 13, 14].map((s) => acacia(s)),
    umbrella: [16, 17, 18].map((s) => acacia(s, true)),
    mopane: [101, 102, 103].map(mopane),
    marula: [221, 222].map(marula),
    fig: [231, 232].map(fig),
    quiver: [241, 242, 243].map(quiver),
    candelabra: [251, 252].map(candelabra),
    mangrove: [261, 262].map(mangrove),
    charred: [271, 272].map(charred),
    sage: [281, 282].map((s) => shrub(s, [P.rock0, P.rock1, P.salt0, P.bone], P.salt3)),
    heath: [291, 292].map((s) => shrub(s, [P.leaf0, P.thorn1, P.lush2, P.flam1], P.flam1)),
    thornbush: [311, 312].map((s) => shrub(s, [P.thorn0, P.thorn1, P.leaf2, null], P.bone0, true)),
    fern: [321, 322].map(fern),
  };
}

export const TALLGRASS = tallgrass;

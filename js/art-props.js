// Props for the wider world: woodland, wetland, desert, highland, ashland and coast.
// (Mopane and fever trees live in art-trees.js with the other trees.)
// Drawn in anchor coordinates on a scratch stage, then cropped to their pixels by fit(),
// so nothing is ever clipped and flips mirror around the anchor.
import { P } from './palette.js';
import { rng, TAU } from './util.js';
import { stage, fit } from './art-trees.js';

function ell(x, cx, cy, rx, ry, col, rot = 0) {
  x.fillStyle = col;
  x.beginPath();
  x.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), rot, 0, TAU);
  x.fill();
}
function line(x, pts, w, col) {
  x.strokeStyle = col; x.lineWidth = w; x.lineCap = 'round'; x.lineJoin = 'round';
  x.beginPath(); x.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]);
  x.stroke();
}
function px(x, a, b, col) { x.fillStyle = col; x.fillRect(Math.round(a), Math.round(b), 1, 1); }
function tri(x, a, b, c, col) {
  x.fillStyle = col; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.lineTo(c[0], c[1]); x.closePath(); x.fill();
}
const variants = (base, profiles, make) => profiles.map((o, i) => make(base + i * 7, o));

// Fallen log: anchor at its middle.
function log(seed) {
  const r = rng(seed);
  const [c, x] = stage(26, 12, 6);
  line(x, [-16, -2, 14, -4 + r.range(-1, 1)], 5, P.bark1);
  line(x, [-15, -3.5, 13, -5.5], 1.4, P.bark2);
  ell(x, 15, -4, 2.6, 2.8, P.bark2);
  ell(x, 15, -4, 1.2, 1.4, P.bark0);
  line(x, [-6, -4, -8, -9], 1.2, P.bark1);
  px(x, 0, -2, P.lush2); px(x, 6, -3, P.lush2);
  return fit(c, { shadow: { rx: 16, ry: 3, dy: 0 }, solid: 6 });
}

function papyrus(seed, o) {
  const r = rng(seed);
  const [c, x] = stage(20, 40, 4);
  for (let i = 0; i < o.n; i++) {
    const bx = r.range(-6, 6), top = -r.range(...o.h);
    const ex = bx + r.range(-4, 4);
    line(x, [bx, 1, ex, top], 1, P.lush1);
    for (let k = 0; k < 5; k++) line(x, [ex, top, ex + Math.cos(k * 1.3) * 3.5, top + Math.sin(k * 1.3) * 2 - 1], 1, k % 2 ? P.lush2 : P.lush1);
  }
  return fit(c, {}, { outline: false });
}
const PAPYRUS = [{ n: 6, h: [16, 26] }, { n: 4, h: [12, 18] }, { n: 8, h: [20, 30] }, { n: 5, h: [22, 28] }];

function deadtree(seed, o) {
  const r = rng(seed);
  const [c, x] = stage(40, 60);
  const H = r.range(...o.h), k = o.k || 1;
  line(x, [0, 1, r.range(-2, 2), -H], o.trunk || 3, P.bone0);
  for (let i = 0; i < o.n; i++) {
    const a = -Math.PI / 2 + r.range(-1.3, 1.3), L = r.range(10, 18) * k;
    const sy = -H + r.range(-4, 4);
    const ex = Math.cos(a) * L, ey = sy + Math.sin(a) * L;
    line(x, [0, sy, ex, ey], 1.6, P.bone0);
    line(x, [ex, ey, ex + r.range(-4, 4), ey - r.range(2, 6)], 1, P.bone0);
  }
  line(x, [-1, 0, -1, -H + 2], 1, P.rock3);
  return fit(c, { shadow: { rx: 12, ry: 3, dy: 0 }, solid: 3 });
}
const DEADTREE = [
  { h: [19, 21], n: 5 }, { h: [26, 30], n: 3, k: 0.8 }, { h: [12, 14], n: 4, k: 0.7, trunk: 3.6 },
  { h: [18, 22], n: 7, k: 1.1 }, { h: [22, 24], n: 2, k: 1.2 },
];

function lily(seed) {
  const r = rng(seed);
  const [c, x] = stage(12, 8, 8);
  for (let i = 0; i < 3; i++) {
    const bx = r.range(-6, 6), by = r.range(-3, 3), rr = r.range(2.2, 3.5);
    ell(x, bx, by, rr, rr * 0.6, P.lush1);
    tri(x, [bx, by], [bx + rr, by - 1], [bx + rr, by + 1], P.water1);
  }
  if (r() < 0.6) px(x, r.range(-5, 5), r.range(-3, 2), P.flam1);
  return fit(c, { flat: true }, { outline: false });
}

function euphorbia(seed, o) {
  const r = rng(seed);
  const [c, x] = stage(20, 44);
  const H = r.range(...o.h);
  line(x, [0, 1, 0, -H], 3, P.lush0);
  for (let i = 0; i < o.n; i++) {
    const side = i % 2 ? 1 : -1, sy = -r.range(H * 0.2, H * 0.6), L = r.range(5, 8);
    line(x, [0, sy, side * L, sy - 1, side * L, sy - r.range(6, 10)], 2.2, P.lush1);
  }
  line(x, [-1, 0, -1, -H + 2], 1, P.lush2);
  return fit(c, { shadow: { rx: 7, ry: 2.5, dy: 0 }, solid: 3 });
}
const EUPHORBIA = [{ h: [22, 24], n: 4 }, { h: [16, 18], n: 2 }, { h: [28, 30], n: 6 }, { h: [20, 22], n: 3 }];

function palm(seed, o) {
  const r = rng(seed);
  const [c, x] = stage(50, 90);
  const trunk = (bx, H, lean, fronds, L, s) => {
    const topx = bx + lean, topy = -H;
    line(x, [bx, 1, bx + lean * 0.4, -H * 0.55, topx, topy], 3 * s, P.bark1);
    const rings = Math.floor(H / 6.5);
    for (let k = 0; k < rings; k++) {
      const t = (2 + k * 6.5) / H; // follow the trunk's two-segment bend
      const rx = bx + (t < 0.55 ? lean * 0.4 * t / 0.55 : lean * 0.4 + lean * 0.6 * (t - 0.55) / 0.45);
      line(x, [rx - 1, -2 - k * 6.5, rx + 1, -2 - k * 6.5], 1, P.bark0);
    }
    for (let i = 0; i < fronds; i++) {
      const a = (i / fronds) * TAU + r.range(-0.2, 0.2);
      const l = r.range(...L) * s;
      const ex = topx + Math.cos(a) * l, ey = topy + Math.sin(a) * l * 0.45 + 4 + (o.droop || 0);
      line(x, [topx, topy, (topx + ex) / 2, topy + Math.sin(a) * l * 0.2 - 3, ex, ey], 2.4 * s, o.tones[0]);
      line(x, [topx, topy - 1, (topx + ex) / 2, topy + Math.sin(a) * l * 0.2 - 4, ex, ey - 1], 1, o.tones[1]);
    }
    ell(x, topx, topy + 2, 3 * s, 2 * s, P.bark0);
    if (o.nuts) for (let k = 0; k < 3; k++) px(x, topx + k - 1, topy + 4, P.bark2);
  };
  const lean = r.range(...o.lean) * (r() < 0.5 ? -1 : 1);
  if (o.pair) trunk(-11, r.range(...o.h) * 0.72, -Math.abs(lean) - 4, o.fronds, o.L, 0.8);
  trunk(0, r.range(...o.h), lean, o.fronds, o.L, 1);
  return fit(c, { shadow: { rx: 18, ry: 6, dy: -1 }, shade: 20, solid: 3 });
}
const PALM = [
  { h: [50, 54], lean: [2, 8], fronds: 7, L: [13, 19], tones: [P.palm0, P.palm2] }, // classic
  { h: [60, 64], lean: [8, 12], fronds: 6, L: [12, 16], tones: [P.palm0, P.palm2], droop: 2 }, // tall, leaning
  { h: [34, 38], lean: [0, 3], fronds: 8, L: [14, 18], tones: [P.palm1, P.palm2], nuts: true }, // short, full
  { h: [48, 52], lean: [4, 7], fronds: 7, L: [13, 17], tones: [P.palm0, P.palm1], pair: true }, // pair
  { h: [44, 48], lean: [2, 6], fronds: 5, L: [10, 14], tones: [P.lush0, P.lush2], droop: 3 }, // wind-torn
];

function aloe(seed, o) {
  const r = rng(seed);
  const [c, x] = stage(14, 30);
  for (let i = 0; i < o.leaves; i++) {
    const a = -Math.PI / 2 + (i / (o.leaves - 1) - 0.5) * 2.4;
    line(x, [0, 0, Math.cos(a) * 7, Math.sin(a) * 8], 1.8, i % 2 ? P.lush1 : P.lush0);
  }
  for (let k = 0; k < o.spikes; k++) {
    const sx = (k - (o.spikes - 1) / 2) * 3, top = -r.range(16, 20);
    line(x, [0, -3, sx + r.range(-1, 1), top], 1, P.bark1);
    ell(x, sx, top + 1, 1.3, 2.4, k % 2 ? P.fire0 : P.ochre);
  }
  return fit(c, { shadow: { rx: 6, ry: 2, dy: 0 } });
}
const ALOE = [{ leaves: 7, spikes: 1 }, { leaves: 9, spikes: 2 }, { leaves: 5, spikes: 0 }, { leaves: 9, spikes: 3 }];

function basalt(seed) {
  const r = rng(seed);
  const [c, x] = stage(16, 20, 6);
  ell(x, 0, -5, 10, 7, P.basalt1);
  ell(x, -2, -7, 7, 4.5, P.basalt2);
  ell(x, -4, -8.5, 3, 1.5, P.basalt3);
  for (let i = 0; i < 3; i++) px(x, r.range(-6, 6), r.range(-8, -1), P.fire0);
  return fit(c, { shadow: { rx: 11, ry: 3, dy: 0 }, solid: 7 });
}

function vent() {
  const [c, x] = stage(12, 8, 8);
  ell(x, 0, 0, 7, 3.2, P.basalt0);
  ell(x, 0, -0.5, 4, 1.8, P.ash0);
  ell(x, 0, -0.5, 2, 0.9, P.fire0);
  return fit(c, { flat: true, vent: true });
}

function driftwood(seed) {
  const r = rng(seed);
  const [c, x] = stage(18, 8, 8);
  line(x, [-12, -1, 11, -2 + r.range(-2, 2)], 2.4, P.bone0);
  line(x, [-3, -1, 1, -5], 1.2, P.bone0);
  line(x, [-11, -1.5, 10, -2.5], 1, P.bone);
  return fit(c, { flat: true });
}

export function buildBiomeProps() {
  return {
    log: [121, 122].map(log),
    papyrus: variants(131, PAPYRUS, papyrus),
    deadtree: variants(141, DEADTREE, deadtree),
    lily: [151, 152, 153].map(lily),
    euphorbia: variants(161, EUPHORBIA, euphorbia),
    palm: variants(171, PALM, palm),
    aloe: variants(181, ALOE, aloe),
    basalt: [191, 192].map(basalt),
    vent: [201].map(vent),
    driftwood: [211, 212].map(driftwood),
  };
}

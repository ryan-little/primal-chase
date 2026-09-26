// Props for the wider world: woodland, wetland, desert, highland, ashland and coast.
import { P } from './palette.js';
import { rng, TAU } from './util.js';
import { canvas, crisp } from './art.js';

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

// Mopane: dense, rounded, darker canopy; lots of shade.
function mopane(seed) {
  const r = rng(seed);
  const w = 60, h = 62, c = canvas(w, h), x = c.getContext('2d');
  const tx = w / 2 + r.range(-2, 2);
  line(x, [tx, h - 2, tx - 1, h - 22], 3.6, P.bark0);
  line(x, [tx, h - 20, tx - 9, h - 32], 2, P.bark0);
  line(x, [tx, h - 20, tx + 9, h - 34], 2, P.bark0);
  const blobs = [];
  for (let i = 0; i < 9; i++) blobs.push([w / 2 + r.range(-18, 18), 22 + r.range(-8, 6), r.range(8, 12)]);
  for (const [bx, by, rr] of blobs) ell(x, bx, by + 2, rr, rr * 0.8, P.leaf0);
  for (const [bx, by, rr] of blobs) ell(x, bx - 1, by, rr * 0.8, rr * 0.62, P.leaf1);
  for (const [bx, by, rr] of blobs) if (r() < 0.7) ell(x, bx - 3, by - 3, rr * 0.4, rr * 0.3, P.leaf2);
  for (let i = 0; i < 6; i++) px(x, r.range(10, w - 10), r.range(10, 34), P.ochre);
  crisp(c);
  return { img: c, ox: w / 2, oy: h - 3, shadow: { rx: 26, ry: 9, dy: -1 }, shade: 30, solid: 4 };
}

// Fever tree: tall, yellow-green bark, feathery sparse crown.
function fever(seed) {
  const r = rng(seed);
  const w = 50, h = 80, c = canvas(w, h), x = c.getContext('2d');
  const tx = w / 2;
  line(x, [tx, h - 2, tx + r.range(-2, 2), h - 40, tx + r.range(-3, 3), 18], 3, P.fever0);
  line(x, [tx + 1, h - 3, tx + 1, h - 38], 1, P.fever1);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + r.range(-1.2, 1.2), L = r.range(10, 18);
    const sy = r.range(18, 34);
    line(x, [tx, sy, tx + Math.cos(a) * L, sy + Math.sin(a) * L * 0.6], 1.4, P.fever0);
    ell(x, tx + Math.cos(a) * L, sy + Math.sin(a) * L * 0.6 - 1, r.range(6, 9), 3, P.leaf1);
    ell(x, tx + Math.cos(a) * L - 1, sy + Math.sin(a) * L * 0.6 - 2, 4, 1.5, P.leaf3);
  }
  crisp(c);
  return { img: c, ox: w / 2, oy: h - 3, shadow: { rx: 18, ry: 6, dy: -1 }, shade: 20, solid: 3 };
}

function log(seed) {
  const r = rng(seed);
  const w = 40, h = 14, c = canvas(w, h), x = c.getContext('2d');
  line(x, [4, 9, 34, 7 + r.range(-1, 1)], 5, P.bark1);
  line(x, [5, 7.5, 33, 5.5], 1.4, P.bark2);
  ell(x, 35, 7, 2.6, 2.8, P.bark2);
  ell(x, 35, 7, 1.2, 1.4, P.bark0);
  line(x, [14, 7, 12, 2], 1.2, P.bark1);
  px(x, 20, 9, P.lush2); px(x, 26, 8, P.lush2);
  crisp(c);
  return { img: c, ox: 20, oy: 11, shadow: { rx: 16, ry: 3, dy: 0 }, solid: 6 };
}

function papyrus(seed) {
  const r = rng(seed);
  const w = 22, h = 30, c = canvas(w, h), x = c.getContext('2d');
  for (let i = 0; i < 6; i++) {
    const bx = r.range(5, 17), top = r.range(3, 12);
    const ex = bx + r.range(-4, 4);
    line(x, [bx, h - 1, ex, top], 1, P.lush1);
    for (let k = 0; k < 5; k++) line(x, [ex, top, ex + Math.cos(k * 1.3) * 3.5, top + Math.sin(k * 1.3) * 2 - 1], 1, P.lush2);
  }
  crisp(c, { outline: false });
  return { img: c, ox: w / 2, oy: h - 2 };
}

function deadtree(seed) {
  const r = rng(seed);
  const w = 44, h = 50, c = canvas(w, h), x = c.getContext('2d');
  const tx = w / 2;
  line(x, [tx, h - 2, tx + r.range(-2, 2), h - 22], 3, P.bone0);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + r.range(-1.3, 1.3), L = r.range(10, 18);
    const sy = h - r.range(18, 26);
    const ex = tx + Math.cos(a) * L, ey = sy + Math.sin(a) * L;
    line(x, [tx, sy, ex, ey], 1.6, P.bone0);
    line(x, [ex, ey, ex + r.range(-4, 4), ey - r.range(2, 6)], 1, P.bone0);
  }
  line(x, [tx - 1, h - 3, tx - 1, h - 20], 1, P.rock3);
  crisp(c);
  return { img: c, ox: w / 2, oy: h - 3, shadow: { rx: 12, ry: 3, dy: 0 }, solid: 3 };
}

function lily(seed) {
  const r = rng(seed);
  const w = 20, h = 12, c = canvas(w, h), x = c.getContext('2d');
  for (let i = 0; i < 3; i++) {
    const bx = r.range(4, 16), by = r.range(3, 9), rr = r.range(2.2, 3.5);
    ell(x, bx, by, rr, rr * 0.6, P.lush1);
    tri(x, [bx, by], [bx + rr, by - 1], [bx + rr, by + 1], P.water1);
  }
  if (r() < 0.6) { px(x, r.range(5, 15), r.range(3, 8), P.flam1); }
  crisp(c, { outline: false });
  return { img: c, ox: w / 2, oy: h / 2, flat: true };
}

function euphorbia(seed) {
  const r = rng(seed);
  const w = 26, h = 34, c = canvas(w, h), x = c.getContext('2d');
  line(x, [13, h - 2, 13, 8], 3, P.lush0);
  for (let i = 0; i < 4; i++) {
    const side = i % 2 ? 1 : -1, sy = r.range(12, 24), L = r.range(5, 8);
    line(x, [13, sy, 13 + side * L, sy - 1, 13 + side * L, sy - r.range(6, 10)], 2.2, P.lush1);
  }
  line(x, [12, h - 3, 12, 10], 1, P.lush2);
  crisp(c);
  return { img: c, ox: 13, oy: h - 3, shadow: { rx: 7, ry: 2.5, dy: 0 }, solid: 3 };
}

function palm(seed) {
  const r = rng(seed);
  const w = 52, h = 70, c = canvas(w, h), x = c.getContext('2d');
  const lean = r.range(-8, 8);
  const tx = w / 2, topx = tx + lean, topy = 16;
  line(x, [tx, h - 2, tx + lean * 0.4, h - 30, topx, topy], 3, P.bark1);
  for (let k = 0; k < 8; k++) line(x, [tx + lean * (k / 8), h - 4 - k * 6.5, tx + lean * (k / 8) + 2, h - 4 - k * 6.5], 1, P.bark0);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + r.range(-0.2, 0.2);
    const L = r.range(13, 19);
    const ex = topx + Math.cos(a) * L, ey = topy + Math.sin(a) * L * 0.45 + 4;
    line(x, [topx, topy, (topx + ex) / 2, topy + Math.sin(a) * L * 0.2 - 3, ex, ey], 2.4, P.palm0);
    line(x, [topx, topy - 1, (topx + ex) / 2, topy + Math.sin(a) * L * 0.2 - 4, ex, ey - 1], 1, P.palm2);
  }
  ell(x, topx, topy + 2, 3, 2, P.bark0);
  crisp(c);
  return { img: c, ox: w / 2, oy: h - 3, shadow: { rx: 18, ry: 6, dy: -1 }, shade: 20, solid: 3 };
}

function aloe(seed) {
  const r = rng(seed);
  const w = 18, h = 22, c = canvas(w, h), x = c.getContext('2d');
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i / 6 - 0.5) * 2.4;
    line(x, [9, h - 3, 9 + Math.cos(a) * 7, h - 3 + Math.sin(a) * 8], 1.8, i % 2 ? P.lush1 : P.lush0);
  }
  line(x, [9, h - 6, 9 + r.range(-1, 1), 2], 1, P.bark1);
  ell(x, 9, 3, 1.3, 2.4, P.ochre);
  crisp(c);
  return { img: c, ox: 9, oy: h - 3, shadow: { rx: 6, ry: 2, dy: 0 } };
}

function basalt(seed) {
  const r = rng(seed);
  const w = 26, h = 20, c = canvas(w, h), x = c.getContext('2d');
  ell(x, 13, 12, 10, 7, P.basalt1);
  ell(x, 11, 10, 7, 4.5, P.basalt2);
  ell(x, 9, 8.5, 3, 1.5, P.basalt3);
  for (let i = 0; i < 3; i++) px(x, r.range(7, 19), r.range(9, 16), P.fire0);
  crisp(c);
  return { img: c, ox: 13, oy: 17, shadow: { rx: 11, ry: 3, dy: 0 }, solid: 7 };
}

function vent(seed) {
  const w = 18, h = 10, c = canvas(w, h), x = c.getContext('2d');
  ell(x, 9, 6, 7, 3.2, P.basalt0);
  ell(x, 9, 5.5, 4, 1.8, P.ash0);
  ell(x, 9, 5.5, 2, 0.9, P.fire0);
  void seed;
  crisp(c);
  return { img: c, ox: 9, oy: 6, flat: true, vent: true };
}

function driftwood(seed) {
  const r = rng(seed);
  const w = 30, h = 10, c = canvas(w, h), x = c.getContext('2d');
  line(x, [3, 6, 26, 5 + r.range(-2, 2)], 2.4, P.bone0);
  line(x, [12, 6, 16, 2], 1.2, P.bone0);
  line(x, [4, 5.5, 25, 4.5], 1, P.bone);
  crisp(c);
  return { img: c, ox: 15, oy: 7, flat: true };
}

export function buildBiomeProps() {
  return {
    mopane: [101, 102, 103].map(mopane),
    fever: [111, 112].map(fever),
    log: [121, 122].map(log),
    papyrus: [131, 132, 133].map(papyrus),
    deadtree: [141, 142, 143].map(deadtree),
    lily: [151, 152, 153].map(lily),
    euphorbia: [161, 162].map(euphorbia),
    palm: [171, 172, 173].map(palm),
    aloe: [181, 182].map(aloe),
    basalt: [191, 192].map(basalt),
    vent: [201].map(vent),
    driftwood: [211, 212].map(driftwood),
  };
}

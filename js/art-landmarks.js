// Landmark art: the secret places. Bigger than props, drawn with the same palette and outline.
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
function tri(x, a, b, c, col) { x.fillStyle = col; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.lineTo(c[0], c[1]); x.closePath(); x.fill(); }
function arc(x, cx, cy, r, a0, a1, w, col) { x.strokeStyle = col; x.lineWidth = w; x.lineCap = 'round'; x.beginPath(); x.arc(cx, cy, r, a0, a1); x.stroke(); }

function paintedCave() {
  const w = 96, h = 64, c = canvas(w, h), x = c.getContext('2d');
  ell(x, 48, 40, 44, 22, P.rock1); ell(x, 44, 34, 36, 18, P.rock2); ell(x, 38, 26, 18, 8, P.rock3);
  ell(x, 60, 30, 16, 12, P.rock2);
  ell(x, 48, 48, 14, 11, P.ink); ell(x, 48, 50, 10, 8, P.inkSoft);
  // ochre paintings: a cat, three hunters, handprints
  const o = P.ochre;
  line(x, [18, 36, 26, 35, 29, 33], 1.4, o); line(x, [20, 36, 19, 40], 1, o); line(x, [26, 36, 27, 40], 1, o); line(x, [18, 35, 14, 33], 1, o);
  for (let i = 0; i < 3; i++) { const hx = 66 + i * 6; line(x, [hx, 34, hx, 40], 1, o); px(x, hx, 32, o); line(x, [hx - 2, 36, hx + 2, 36], 1, o); }
  for (const [hx, hy] of [[34, 26], [58, 24]]) { ell(x, hx, hy, 2, 2.4, P.clay2); for (let k = 0; k < 4; k++) px(x, hx - 2 + k * 1.3, hy - 3.5, P.clay2); }
  crisp(c);
  return { img: c, ox: 48, oy: 58, solid: 22, shade: 34, shadow: { rx: 40, ry: 9, dy: 0 } };
}

function graveyard() {
  const w = 90, h = 50, c = canvas(w, h), x = c.getContext('2d');
  // ribs
  for (let i = 0; i < 6; i++) arc(x, 30 + i * 6, 40, 9, Math.PI * 1.1, Math.PI * 1.9, 1.6, i % 2 ? P.bone0 : P.bone);
  line(x, [22, 40, 64, 40], 2, P.bone0);
  // skull
  ell(x, 72, 33, 11, 9, P.bone); ell(x, 76, 38, 7, 5, P.bone0);
  ell(x, 69, 31, 2.4, 2.4, P.ink); ell(x, 76, 31, 2.4, 2.4, P.ink);
  // tusks
  line(x, [70, 42, 60, 46, 52, 42], 2.4, P.bone); line(x, [78, 42, 86, 44, 88, 38], 2.4, P.bone);
  // second skeleton, half buried
  for (let i = 0; i < 4; i++) arc(x, 12 + i * 5, 46, 6, Math.PI * 1.15, Math.PI * 1.85, 1.2, P.bone0);
  crisp(c);
  return { img: c, ox: 45, oy: 46, solid: 14, shadow: { rx: 38, ry: 5, dy: 0 } };
}

function oasis() {
  const w = 110, h = 80, c = canvas(w, h), x = c.getContext('2d');
  ell(x, 55, 60, 40, 15, P.lush0); ell(x, 55, 60, 34, 12, P.lush1);
  ell(x, 55, 61, 26, 9, P.mud0); ell(x, 55, 61, 24, 8, P.water0); ell(x, 52, 59, 16, 4, P.water1); ell(x, 48, 58, 6, 1.5, P.foam);
  const r = rng(5);
  for (const [bx, lean] of [[22, -5], [88, 6], [38, -2], [74, 3]]) {
    const top = [bx + lean, 14 + r.range(0, 8)];
    line(x, [bx, 58, bx + lean * 0.4, 38, top[0], top[1]], 2.6, P.bark1);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU; const L = 12 + r.range(0, 5);
      line(x, [top[0], top[1], top[0] + Math.cos(a) * L, top[1] + Math.sin(a) * L * 0.45 + 3], 2.2, P.palm0);
      line(x, [top[0], top[1] - 1, top[0] + Math.cos(a) * L * 0.9, top[1] + Math.sin(a) * L * 0.4 + 2], 1, P.palm2);
    }
  }
  crisp(c);
  return { img: c, ox: 55, oy: 64, shade: 44, shadow: { rx: 44, ry: 12, dy: -4 }, pool: { dx: 0, dy: -3, rx: 26, ry: 10 } };
}

function oldBaobab() {
  const w = 110, h = 120, c = canvas(w, h), x = c.getContext('2d');
  const cx = 55;
  x.fillStyle = P.bark1; x.beginPath();
  x.moveTo(cx - 24, h - 2); x.quadraticCurveTo(cx - 32, h - 50, cx - 14, h - 76); x.lineTo(cx + 14, h - 76); x.quadraticCurveTo(cx + 32, h - 50, cx + 24, h - 2); x.closePath(); x.fill();
  ell(x, cx + 8, h - 40, 9, 34, P.bark2); ell(x, cx - 12, h - 38, 5, 30, P.bark0);
  ell(x, cx - 2, h - 22, 7, 10, P.ink); // hollow
  const r = rng(9);
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + r.range(-1.3, 1.3), L = r.range(16, 30);
    const sx = cx + r.range(-8, 8), sy = h - 74;
    const ex = sx + Math.cos(a) * L, ey = sy + Math.sin(a) * L * 0.7;
    line(x, [sx, sy, ex, ey], 3.4, P.bark1);
    ell(x, ex, ey - 2, r.range(8, 12), r.range(4, 6), P.leaf1); ell(x, ex - 2, ey - 4, 5, 2.4, P.leaf2);
  }
  for (let i = 0; i < 5; i++) px(x, r.range(30, 80), r.range(10, 40), P.bone);
  crisp(c);
  return { img: c, ox: cx, oy: h - 3, solid: 20, shade: 50, shadow: { rx: 50, ry: 14, dy: -2 } };
}

function camp() {
  const w = 90, h = 56, c = canvas(w, h), x = c.getContext('2d');
  // lean-to shelter
  tri(x, [8, 44], [30, 14], [46, 44], P.hide1); tri(x, [12, 44], [30, 18], [30, 44], P.hide0);
  line(x, [30, 12, 30, 46], 1.4, P.bark0); line(x, [22, 20, 40, 20], 1, P.bark0);
  // fire ring
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; ell(x, 62 + Math.cos(a) * 8, 44 + Math.sin(a) * 4, 2.2, 1.6, P.rock2); }
  ell(x, 62, 44, 5, 2.4, P.ash1); line(x, [58, 44, 66, 43], 1.4, P.bark0); px(x, 62, 43, P.fire0);
  // spear rack
  for (let i = 0; i < 3; i++) line(x, [76 + i * 3, 46, 72 + i * 4, 8], 1, P.bark2);
  line(x, [70, 30, 86, 30], 1.4, P.bark1);
  for (let i = 0; i < 3; i++) tri(x, [72 + i * 4, 5], [70.5 + i * 4, 9], [73.5 + i * 4, 9], P.rock3);
  // hide stretched on a frame
  line(x, [48, 20, 56, 20, 56, 32, 48, 32, 48, 20], 1, P.bark0); x.fillStyle = P.gaz1; x.fillRect(49, 21, 6, 10);
  crisp(c);
  return { img: c, ox: 45, oy: 48, solid: 12, shadow: { rx: 40, ry: 6, dy: 0 } };
}

function arch() {
  const w = 100, h = 80, c = canvas(w, h), x = c.getContext('2d');
  // two pillars and a span of red sandstone with bands
  x.fillStyle = P.dune0; x.beginPath();
  x.moveTo(8, 76); x.lineTo(14, 30); x.quadraticCurveTo(50, -4, 86, 30); x.lineTo(92, 76); x.lineTo(74, 76); x.lineTo(70, 40);
  x.quadraticCurveTo(50, 18, 30, 40); x.lineTo(26, 76); x.closePath(); x.fill();
  for (let i = 0; i < 6; i++) { x.strokeStyle = i % 2 ? P.dune1 : P.clay0; x.lineWidth = 1.2; x.beginPath(); x.moveTo(10, 34 + i * 7); x.lineTo(28, 36 + i * 7); x.moveTo(72, 36 + i * 7); x.lineTo(90, 34 + i * 7); x.stroke(); }
  arc(x, 50, 44, 34, Math.PI * 1.15, Math.PI * 1.85, 2, P.dune2);
  crisp(c);
  return { img: c, ox: 50, oy: 76, shade: 30, shadow: { rx: 44, ry: 9, dy: 0 }, arch: true, pillars: [[-33, 0], [33, 0]] };
}

function whistle() {
  const w = 100, h = 60, c = canvas(w, h), x = c.getContext('2d');
  ell(x, 50, 36, 46, 22, P.rock1); ell(x, 44, 30, 36, 16, P.rock2); ell(x, 60, 26, 20, 10, P.rock3);
  for (const [hx, hy, rr] of [[30, 38, 6], [52, 42, 9], [72, 36, 5], [42, 28, 3.5], [64, 26, 3]]) { ell(x, hx, hy, rr, rr * 0.8, P.ink); ell(x, hx, hy + 1, rr * 0.6, rr * 0.45, P.inkSoft); }
  crisp(c);
  return { img: c, ox: 50, oy: 54, solid: 24, shade: 40, shadow: { rx: 42, ry: 9, dy: 0 } };
}

function shrine() {
  const w = 80, h = 70, c = canvas(w, h), x = c.getContext('2d');
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; const sx = 40 + Math.cos(a) * 30, sy = 54 + Math.sin(a) * 11; line(x, [sx, sy, sx, sy - 8 - (i % 3) * 2], 3.2, P.rock2); px(x, sx - 1, sy - 9 - (i % 3) * 2, P.rock4); }
  // carved totem
  x.fillStyle = P.bark1; x.fillRect(36, 12, 8, 42);
  for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? P.ochre : P.bark2; x.fillRect(36, 14 + i * 10, 8, 3); px(x, 38, 18 + i * 10, P.ink); px(x, 41, 18 + i * 10, P.ink); }
  tri(x, [34, 12], [40, 3], [46, 12], P.fever0);
  crisp(c);
  return { img: c, ox: 40, oy: 58, solid: 6, shadow: { rx: 32, ry: 8, dy: -3 } };
}

function whale() {
  const w = 120, h = 60, c = canvas(w, h), x = c.getContext('2d');
  line(x, [10, 50, 110, 48], 3, P.bone0);
  for (let i = 0; i < 9; i++) arc(x, 20 + i * 10, 52, 14 + Math.sin(i * 0.4) * 4, Math.PI * 1.05, Math.PI * 1.95, 2.2, i % 2 ? P.bone : P.bone0);
  ell(x, 108, 44, 10, 6, P.bone); ell(x, 112, 46, 5, 3, P.bone0);
  crisp(c);
  return { img: c, ox: 60, oy: 52, shadow: { rx: 54, ry: 6, dy: 0 } };
}

function spire() {
  const w = 60, h = 80, c = canvas(w, h), x = c.getContext('2d');
  const r = rng(3);
  for (let i = 0; i < 6; i++) {
    const bx = 18 + i * 5 + r.range(-2, 2), top = 10 + r.range(0, 30);
    tri(x, [bx - 5, 74], [bx + r.range(-3, 3), top], [bx + 5, 74], i % 2 ? P.basalt1 : P.basalt2);
    line(x, [bx, top + 4, bx + 1, 70], 1, P.basalt3);
  }
  for (let i = 0; i < 8; i++) px(x, r.range(14, 46), r.range(30, 72), P.fire1);
  ell(x, 30, 74, 22, 4, P.ash1);
  crisp(c);
  return { img: c, ox: 30, oy: 74, solid: 10, shadow: { rx: 22, ry: 5, dy: 0 } };
}

export function buildLandmarks() {
  return {
    painted: paintedCave(), graveyard: graveyard(), oasis: oasis(), baobab: oldBaobab(), camp: camp(),
    arch: arch(), whistle: whistle(), shrine: shrine(), whale: whale(), spire: spire(),
  };
}

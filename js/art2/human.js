// The hunters: a band of persistence hunters on a two-legged rig.
//
// Like the quadruped rig, feet are driven along planted/swing paths (a planted foot slides back
// under the body at walking speed, rolling heel to toe) and the legs are solved back to the
// pelvis with two-bone IK, so feet plant and never skate. Shoulders counter-rotate against the
// hips, far-side limbs sit one ramp step darker behind the body, and the spear is a rigid,
// pixel-exact line so it keeps one thickness in every frame.
//
// Sprite space: origin on the ground between the feet, +x forward (facing right), y down.
import { Pix, cropFrames, ik, lerp, clamp, shiftId, cid } from './pix.js';
import { spline } from './quad.js';
import { addColors, addRamp } from './pal.js';

addColors({
  hair0: '#1e1410', hair1: '#3b2a1f',
  paintD: '#a3998a', paint1: '#f4efe2',
  torch0: '#4a2e1a', torch1: '#6e4a2a', torchH: '#9c7a4e',
});
addRamp('hair', ['hair0', 'hair1'], 'ink');
addRamp('paint', ['paintD', 'paint', 'paint1'], 'olBone');

const TAU = Math.PI * 2;
const SPEAR = 24; // full length, point included
// Poses and proportions are authored in rig units; K turns them into world pixels. The head bitmap
// and the spear keep their pixel size, so the body grows around them.
const K = 1.1;

// ---------- the three hunters ----------
// skin: near-side color; far limbs sit one ramp step darker.
const VARS = [
  { skin: 'skin2', far: 'skin1', hair: 'band', wear: 'cape', paint: 'paint', face: 'ochre', tall: 0, broad: 0 },
  { skin: 'skin3', far: 'skin2', hair: 'knot', wear: 'wrap', paint: 'ochre', face: 'ochre', tall: 1, broad: -0.2 },
  { skin: 'skin1', far: 'skin0', hair: 'crop', wear: 'bare', paint: 'paint', face: 'paint', tall: -1, broad: 0.45 },
];

function dims(v) {
  const t = v.tall;
  return {
    thigh: 5.8 + t * 0.3, shin: 5.6 + t * 0.3, spine: 7.0 + t * 0.35, neck: 1.4,
    upper: 4.2 + t * 0.15, fore: 3.9 + t * 0.15,
    chest: 2.2 + v.broad, back: 1.8 + v.broad * 0.5, hipW: 1.9 + v.broad * 0.4,
    thighW: 2.8 + v.broad * 0.4, armW: 1.9 + v.broad * 0.3,
  };
}

// ---------- heads ----------
// Slots resolved per variant: B band row, K topknot, F feather, l long hair at the nape, p face paint.
const HEADS = {
  fwd: [
    '.F.....',
    '.FhhhH.',
    'hBBBBBf',
    'hhSSeS.',
    'lhSSSSS',
    '.lSSpS.',
  ],
  down: [
    '.F.....',
    '.Fhhhh.',
    'hhBBBBB',
    'lhhSSSf',
    '.lSSSeS',
    '..SSpSS',
  ],
  up: [
    'F.hhh..',
    'FhhhBBf',
    'hhhBSeS',
    'lhSSSSS',
    '.lSSSmS',
    '..SSS..',
  ],
};
const HEAD_KNOT = ['.KK', '.HK']; // stamped above the back of the skull
const HEAD_AX = 2, HEAD_AY = 5; // the neck joins here

function headRows(look, v) {
  // f: the front of the band, or a brow pixel when there is no band
  const slot = v.hair === 'band'
    ? { B: 'b', F: 'F', l: 'h', f: 'b' }
    : v.hair === 'knot'
      ? { B: 'h', F: '.', l: 'h', f: 'S' }
      : { B: 'H', F: '.', l: 's', f: 'S' };
  return HEADS[look].map((r) => [...r].map((ch) => slot[ch] ?? ch).join(''));
}
// rotate a bitmap a quarter turn so the face points up (lying on his back)
function rotUp(rows) {
  const W = Math.max(...rows.map((r) => r.length)), H = rows.length, out = [];
  for (let y = 0; y < W; y++) {
    let s = '';
    for (let x = 0; x < H; x++) s += rows[x][W - 1 - y] || '.';
    out.push(s);
  }
  return out;
}

// ---------- foot geometry ----------
// Flat foot, relative to the ankle: sole 1px below, heel just behind, toes 2.4 ahead.
const HEEL = [-0.7, 1.0], TOE = [2.2, 1.0];
const rot = (a, [x, y]) => { const c = Math.cos(a), s = Math.sin(a); return [x * c + y * s, -x * s + y * c]; };
// Ankle for a foot at angle a (toe up +) whose heel or toe rests on the ground at gx.
function plantAt(G, a, piv) {
  const p = piv === 'heel' ? HEEL : TOE, r = rot(a, p);
  return [G + p[0] - r[0], -r[1], a];
}
const flat = (x) => [x, -1, 0];

// stance: u 0 = touchdown, 1 = toe-off; G slides back at body speed so the planted point is still
function stanceFoot(u, Gt) {
  const G = Gt.c + Gt.S / 2 - u * Gt.S;
  if (u < Gt.h1) { const k = 1 - u / Gt.h1; return plantAt(G, Gt.a0 * k * k, 'heel'); }
  if (u > Gt.h2) { const k = (u - Gt.h2) / (1 - Gt.h2); return plantAt(G, -Gt.a1 * Math.pow(k, 1.5), 'toe'); }
  return [G, -1, 0];
}
function legCycle(ph, Gt) {
  ph = ((ph % 1) + 1) % 1;
  if (ph < Gt.beta) return stanceFoot(ph / Gt.beta, Gt);
  const u = (ph - Gt.beta) / (1 - Gt.beta);
  const s = stanceFoot(1, Gt), e = stanceFoot(0, Gt);
  const [f, dy, a] = spline([[0, 0, 0, s[2]], ...Gt.swing, [1, 1, 0, e[2]]], u);
  return [lerp(s[0], e[0], f), lerp(s[1], e[1], f) + dy, a];
}

const GAIT = {
  // the tracking walk: unhurried, long contact, heel strike and toe-off
  walk: {
    beta: 0.6, S: 9.5, c: 0.3, a0: 0.4, a1: 0.75, h1: 0.14, h2: 0.6,
    swing: [[0.3, 0.12, -1.6, -0.55], [0.6, 0.6, -1.4, 0.05], [0.85, 0.94, -0.5, 0.35]],
  },
  // the persistence run: short contact under the hips, flight, heel kicked up behind
  run: {
    beta: 0.36, S: 8.5, c: -1.4, a0: 0.12, a1: 0.95, h1: 0.12, h2: 0.45,
    swing: [[0.25, -0.06, -4.6, -1.3], [0.55, 0.55, -5.2, -0.45], [0.82, 1.14, -2.2, 0.2]],
  },
};

// ---------- poses ----------
// pose: { hip, lean, twist, feet: {n, f}, arms: {n, f}, head: {dx, dy, look, flip}, spear, torch, trail, breath }
// arms: { fk: [shoulder angle from straight down, + forward; elbow flex] } or { to: [x, y], bend }
const fk = (th, ph) => ({ fk: [th, ph] });
const to = (x, y, bend = -1) => ({ to: [x, y], bend });
const TORCH_HAND = [-2.6, -15.4];
const TORCH_ANG = -0.2; // from vertical, + leans forward

function base() {
  return {
    hip: [0, -12.2], lean: 0.06, twist: 0, feet: { n: flat(1.6), f: flat(-1.6) },
    arms: { n: fk(0.05, 0.2), f: fk(-0.05, 0.2) }, head: { dx: 0, dy: 0, look: 'fwd' },
    spear: null, trail: 0, breath: 0, torchHand: 'f',
  };
}

const POSES = {
  idle(p) {
    const P = base(), s = Math.sin(p * TAU), c = Math.cos(p * TAU);
    P.breath = s;
    P.hip = [0.35 * c, -12.1 + 0.15 * Math.max(0, c)];
    P.feet = { n: flat(2.2), f: flat(-1.8) };
    P.lean = 0.02;
    // spear planted butt-down in front, gripped at chest height
    const bx = 6.6, by = -0.6, a = 0.04;
    const tx = bx + Math.sin(a) * SPEAR, ty = by - Math.cos(a) * SPEAR;
    P.spear = { pts: [bx, by, tx, ty] };
    P.arms.n = to(lerp(bx, tx, 0.62), lerp(by, ty, 0.62) + s * 0.2);
    P.arms.f = fk(-0.08 + 0.03 * s, 0.25);
    const turn = p >= 0.45 && p < 0.8;
    P.head = { dx: 0, dy: -0.2 * s, look: 'fwd', flip: turn };
    return P;
  },
  walk(p) {
    const P = base(), G = GAIT.walk, c = Math.cos(p * TAU);
    P.feet = { n: legCycle(p, G), f: legCycle(p - 0.5, G) };
    P.hip = [0, -12.4 - 0.35 * Math.cos(2 * TAU * (p - 0.3))];
    P.lean = 0.12;
    // off arm swings against the near leg; the spear hand rides low at the trail
    P.arms.f = fk(0.45 * c - 0.02, 0.35 + 0.2 * c);
    P.arms.n = fk(-0.12 * c + 0.12, 0.3);
    P.spear = { hand: 'n', ang: 0.1 + 0.03 * c, grip: 12.5 };
    P.head = { dx: 0.3, dy: 0, look: 'down' };
    P.trail = 0.4;
    return P;
  },
  run(p) {
    const P = base(), G = GAIT.run, c = Math.cos(p * TAU);
    P.feet = { n: legCycle(p, G), f: legCycle(p - 0.5, G) };
    P.hip = [0, -12.5 + 0.55 * Math.cos(2 * TAU * (p - 0.18))];
    P.lean = 0.13;
    // off arm pumps hard: fist up in front of the chin, then the elbow driven well back
    const sw = Math.cos(p * TAU - 0.3);
    P.arms.f = fk(1.2 * sw - 0.05, 1.15 + 0.5 * sw);
    P.arms.n = fk(-0.22 * Math.cos(p * TAU - 0.3) + 0.15, 1.2);
    P.spear = { hand: 'n', ang: -0.04, grip: 12 };
    P.head = { dx: 0.4, dy: 0, look: 'fwd' };
    P.trail = 1.6;
    return P;
  },
  search(p) {
    const P = base(), s = Math.sin(p * TAU);
    // down on the far knee over the prints, one hand flat on the ground ahead
    P.hip = [-0.3 + 0.2 * s, -5.7 + 0.25 * s];
    P.lean = 1.15 + 0.04 * s;
    P.feet = { n: flat(3.2), f: plantAt(-5.8, -0.9, 'toe') };
    P.arms.n = to(9.9 + 0.3 * s, -1.6 + 0.6 * Math.max(0, s));
    // spear upright in the off hand, butt on the ground, shaft leaning back past the shoulder
    const bx = 3.6, by = -0.5, a = 0.22;
    P.spear = { pts: [bx, by, bx - Math.sin(a) * SPEAR, by - Math.cos(a) * SPEAR], behind: true };
    P.arms.f = to(bx - Math.sin(a) * 7, by - Math.cos(a) * 7);
    const k = Math.floor(p * 6);
    P.head = { dx: [0, 0.4, 0.7, 0.2, -0.3, -0.3][k], dy: 0.4, look: 'down', flip: k === 3 || k === 4 };
    return P;
  },
};

// one-shot sequences, keyed by frame
const SEQ = {
  windup: [
    { hip: [0, -12.0], lean: 0.14, twist: 0, feet: { n: flat(1.6), f: flat(-1.6) }, n: fk(0.2, 1.1), f: fk(0.2, 0.9), spear: { ang: -0.05, grip: 12 } },
    { hip: [-0.6, -11.8], lean: 0.02, twist: 0.4, feet: { n: flat(-2.6), f: flat(4.6) }, n: to(-1, -19.5), f: fk(1.0, 0.3), spear: { ang: -0.1, grip: 13 } },
    { hip: [-1.6, -11.4], lean: -0.1, twist: 0.8, feet: { n: flat(-4.0), f: flat(6.0) }, n: to(-6.6, -19.6, 1), f: to(6.0, -18.6), spear: { ang: -0.24, grip: 14 } },
    { hip: [-2.5, -11.0], lean: -0.15, twist: 1, feet: { n: flat(-5.0), f: flat(6.6) }, n: to(-10.2, -18.0, 1), f: to(7.4, -18.4), spear: { ang: -0.3, grip: 15 } },
  ],
  throw: [
    { hip: [0.4, -11.7], lean: 0.05, twist: 0.6, feet: { n: plantAt(-3.2, -0.5, 'toe'), f: flat(6.2) }, n: to(-4.4, -22.2), f: to(3.4, -15.6), spear: { ang: -0.28, grip: 14 } },
    { hip: [2.4, -12.2], lean: 0.32, twist: -0.2, feet: { n: plantAt(-3.2, -0.95, 'toe'), f: flat(6.2) }, n: to(1.8, -25.2), f: to(-0.6, -15.6), spear: { ang: -0.35, grip: 14 } },
    { hip: [3.4, -12.3], lean: 0.5, twist: -0.7, feet: { n: [-3.4, -2.2, -1.1], f: flat(6.2) }, n: to(9.6, -21.5, 1), f: to(-3.2, -14.4) },
    // follow-through: pitched over the braced front leg, throwing arm swept down across, back leg flung up behind
    { hip: [4.4, -11.6], lean: 0.72, twist: -1, feet: { n: [-3.2, -7.0, -1.5], f: flat(6.4) }, n: to(10.0, -9.6), f: to(-3.6, -14.0, 1), look: 'down' },
    { hip: [4.4, -12.0], lean: 0.22, twist: -0.3, feet: { n: flat(8.6), f: plantAt(6.2, -0.4, 'toe') }, n: fk(0.3, 0.4), f: fk(-0.2, 0.3) },
  ],
  down: [
    { hip: [-1.0, -12.1], lean: -0.38, twist: -0.3, feet: { n: [2.4, -2.0, 0.6], f: flat(-2.2) }, n: to(2.6, -24.6, 1), f: to(4.6, -19.6), spear: { ang: -1.0, grip: 10 }, look: 'up' },
    { hip: [-3.8, -8.0], lean: -0.95, twist: -0.3, feet: { n: [3.6, -3.6, 0.6], f: plantAt(0.6, 0.5, 'heel') }, n: to(-2.6, -19.4, 1), f: to(1.4, -18.0), spear: { pts: [-9, -14, 12, -22] }, look: 'up' },
    { hip: [-5.2, -2.8], lean: -1.4, twist: 0, feet: { n: [3.0, -5.0, 0.5], f: [5.2, -1.6, 0.4] }, n: to(-11, -6, 1), f: to(-7, -9), spear: { pts: [-10, -2.5, 13, -4.5], behind: true }, look: 'lie' },
    { hip: [-4.6, -2.0], lean: -1.57, twist: 0, feet: { n: [3.2, -1.2, 0.1], f: flat(6.6) }, n: to(-12.6, -1.4, 1), f: to(-9.5, -4.4), spear: { pts: [-12, -0.5, 12, -0.5], behind: true }, look: 'lie' },
  ],
};

function seqPose(name, i, n) {
  const K = SEQ[name][i], P = base();
  P.hip = K.hip.slice(); P.lean = K.lean; P.twist = K.twist; P.feet = { n: K.feet.n, f: K.feet.f };
  P.arms = { n: K.n, f: K.f };
  if (K.spear) P.spear = K.spear.pts ? { ...K.spear } : { hand: 'n', ...K.spear };
  P.head = { dx: 0, dy: 0, look: K.look || 'fwd' };
  P.oneShot = name; P.frame = i; P.frames = n;
  if (name === 'down') P.torchDropped = i >= 1;
  if (name === 'windup' || name === 'throw') P.torchHold = 'point';
  if ((name === 'windup' && i >= 1) || (name === 'throw' && i <= 1)) P.headTop = true;
  return P;
}

POSES.cheer = (p) => {
  const P = base(), s = Math.sin(p * TAU), up = Math.max(0, s), dn = Math.max(0, -s);
  // a hop on the thrust: both feet leave the ground at the top
  const hop = up > 0.85 ? 1.6 : 0;
  P.hip = [0, -12.2 + 0.9 * dn - hop];
  P.feet = { n: hop ? [2.6, -1 - hop, -0.3] : flat(2.8), f: hop ? [-2.0, -1 - hop, -0.4] : flat(-2.4) };
  P.lean = -0.08;
  P.arms.n = to(4.4 + 0.6 * dn, -25.2 + 3.2 * (1 - up) - hop, -1);
  P.spear = { hand: 'n', ang: -1.3 + 0.1 * dn, grip: 15 };
  P.arms.f = to(6.0, -21.5 + 2.5 * (1 - up) - hop);
  P.headTop = true;
  P.head = { dx: 0.2, dy: 0, look: 'up' };
  P.cheer = true;
  return P;
};

// ---------- solving ----------
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const scl = (a, k) => [a[0] * k, a[1] * k];
const FAR = [0.5, -0.4];
const LEG0 = 11.4; // thigh + shin of the baseline hunter

function solve(P, B) {
  const J = solveRig(P, B), k = (q) => [q[0] * K, q[1] * K];
  const rigAt = J.at;
  J.at = (u, v) => k(rigAt(u, v));
  J.H = k(J.H); J.neck = k(J.neck); J.head = k(J.head);
  for (const s of ['n', 'f']) {
    J.hip[s] = k(J.hip[s]); J.sh[s] = k(J.sh[s]);
    const L = J.legs[s]; L.h = k(L.h); L.k = k(L.k); L.a = k(L.a);
    const A = J.arms[s]; A.s = k(A.s); A.e = k(A.e); A.h = k(A.h);
  }
  return J;
}

function solveRig(P, B) {
  const up = [Math.sin(P.lean), -Math.cos(P.lean)], fw = [Math.cos(P.lean), Math.sin(P.lean)];
  const L = B.thigh + B.shin;
  // drop the hips when a planted leg could not reach (the walk's double-support dip)
  // poses are authored for the baseline legs; taller hunters stand taller
  let hy = P.hip[1] - (L - LEG0) * 0.985;
  for (const k of ['n', 'f']) {
    const a = P.feet[k];
    if (a[1] < -2.4) continue;
    const dx = a[0] - P.hip[0], R = L * 0.985;
    if (Math.abs(dx) < R) hy = Math.max(hy, a[1] - Math.sqrt(R * R - dx * dx));
  }
  const H = [P.hip[0], hy];
  const at = (u, v) => [H[0] + up[0] * u + fw[0] * v, H[1] + up[1] * u + fw[1] * v];
  // pelvis turns with the legs; the shoulders turn the other way
  const pr = clamp((P.feet.n[0] - P.feet.f[0]) * 0.07, -0.6, 0.6);
  const sr = P.twist + pr * 0.8;
  const J = { H, up, fw, at, B, P };
  J.hip = { n: add(at(0.2, 0), [pr * 0.5, 0]), f: add(at(0.2, 0), [-pr * 0.5 + FAR[0] * 0.6, FAR[1]]) };
  const sh = at(B.spine - 1.0, -0.3);
  J.sh = { n: add(sh, scl(fw, -sr * 1.2)), f: add(add(sh, scl(fw, sr * 1.2)), FAR) };
  J.neck = at(B.spine, 0.1);
  J.legs = {};
  for (const k of ['n', 'f']) {
    const [ax, ay, a] = P.feet[k], h = J.hip[k];
    const [kx, ky, tx, ty] = ik(h[0], h[1], ax, ay, B.thigh, B.shin, 1);
    J.legs[k] = { h, k: [kx, ky], a: [tx, ty], ang: a };
  }
  J.arms = {};
  for (const k of ['n', 'f']) {
    const A = P.arms[k], s = J.sh[k];
    let e, hd;
    if (A.to) { const r = ik(s[0], s[1], A.to[0], A.to[1], B.upper, B.fore, A.bend); e = [r[0], r[1]]; hd = [r[2], r[3]]; }
    else {
      const [th, ph] = A.fk;
      e = [s[0] + Math.sin(th) * B.upper, s[1] + Math.cos(th) * B.upper];
      hd = [e[0] + Math.sin(th + ph) * B.fore, e[1] + Math.cos(th + ph) * B.fore];
    }
    J.arms[k] = { s, e, h: hd };
  }
  const hd = P.head;
  J.head = add(add(J.neck, scl(up, B.neck)), [hd.dx, hd.dy]);
  return J;
}

// ---------- drawing ----------
function layer(g, fn, mode = 'over') {
  g.flush();
  const c = new Pix(g.w, g.h, g.ax, g.ay, { ss: g.ss, cut: g.cut });
  fn(c);
  c.flush();
  if (mode === 'over') return g.over(c);
  // under: only fills what the figure left empty
  for (let j = 0; j < c.h; j++) for (let i = 0; i < c.w; i++) {
    const id = c.buf[j * c.w + i];
    if (id && !g.at(i, j)) g.set(i, j, id);
  }
  return g;
}

// Front-lit edge: the side facing forward catches the light, the back edge falls into shade.
function rim(c, cols, front = 1, back = 0) {
  c.flush();
  const { w, h, buf } = c, src = buf.slice(), ids = new Set(cols.map(cid));
  for (let j = 0; j < h; j++) for (let i = 1; i < w - 1; i++) {
    const id = src[j * w + i];
    if (!ids.has(id)) continue;
    if (front && !src[j * w + i + 1]) buf[j * w + i] = shiftId(id, front);
    else if (back && !src[j * w + i - 1]) buf[j * w + i] = shiftId(id, -back);
  }
}

function drawLeg(c, L, B, col) {
  const { h, k, a, ang } = L, w = B.thighW * K;
  c.limb(h[0], h[1], k[0], k[1], w, w * 0.72, col);
  const calf = [lerp(k[0], a[0], 0.32) - 0.25, lerp(k[1], a[1], 0.32)];
  c.limb(k[0], k[1], calf[0], calf[1], w * 0.72, w * 0.78, col);
  c.limb(calf[0], calf[1], a[0], a[1], w * 0.78, 1.35 * K, col);
  const F = [[-0.2, -0.7], [-0.95, 0.2], [-0.8, 1.0], [2.4, 1.0], [2.4, 0.45], [1.0, -0.1]];
  c.poly(F.map((q) => add(a, rot(ang, scl(q, K)))), col);
}
// paint stripes across a limb at fractions along a bone: they ride the bone, so they stay put
function stripes(c, a, b, ts, col, half = 0.7) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, n = [-(b[1] - a[1]) / L, (b[0] - a[0]) / L];
  for (const t of ts) {
    const p = [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
    c.pline(p[0] - n[0] * half, p[1] - n[1] * half, p[0] + n[0] * half, p[1] + n[1] * half, col, true);
  }
}

function drawArm(c, A, B, col) {
  const w = B.armW * K;
  c.limb(A.s[0], A.s[1], A.e[0], A.e[1], w + 0.3, w * 0.82, col);
  c.limb(A.e[0], A.e[1], A.h[0], A.h[1], w * 0.82, 1.3 * K, col);
  c.ell(A.h[0], A.h[1], 0.95 * K, 0.95 * K, col);
}

function torsoPts(J) {
  const { B, at } = J, L = B.spine, ch = B.chest, bk = B.back, br = (J.P.breath || 0) * 0.25;
  return [
    at(-0.7, -bk), at(1.0, -bk - 0.3), at(3.0, -bk + 0.4), at(5.0, -bk), at(L - 0.4, -bk + 0.1), at(L + 0.2, -0.9),
    at(L + 0.2, 0.7), at(L - 0.9, ch + br), at(L - 2.6, ch + 0.2 + br), at(L - 3.9, ch - 0.6), at(2.4, B.hipW - 0.5), at(0.3, B.hipW - 0.3), at(-0.8, 0.6),
  ];
}

// body paint: in torso space so it rides with the chest from frame to frame
function paintFn(v, J) {
  const L = J.B.spine;
  if (v.wear === 'cape') return () => 0;
  if (v.wear === 'wrap') return (u, w) => (w > 0.3 && (Math.abs(u - 2.6) < 0.5 || Math.abs(u - 4.1) < 0.5) ? 1 : 0);
  return (u, w) => (w > 0.2 && [2.6, 4.2].some((s) => Math.abs(u - s - w * 0.2) < 0.5) ? 1 : 0);
}

function drawFigure(g, P, v, B, night) {
  const J = solve(P, B), S = v.skin, F = v.far;
  const uv = (x, y) => { const d = [(x - J.H[0]) / K, (y - J.H[1]) / K]; return [d[0] * J.up[0] + d[1] * J.up[1], d[0] * J.fw[0] + d[1] * J.fw[1]]; };
  const tr = P.trail || 0;

  // far side: leg and arm, one ramp step darker
  layer(g, (c) => {
    drawLeg(c, J.legs.f, B, F);
    drawArm(c, J.arms.f, B, F);
    c.bevel({ up: 1, down: 1, only: [F] });
  });

  // back flap of the loincloth hangs behind the near leg
  layer(g, (c) => {
    const a = J.at(0.2, -B.back + 0.2), b = J.at(-0.4, -0.4);
    c.poly([a, b, [b[0] - tr * 0.8 - 0.3, b[1] + 3.0], [a[0] - tr - 0.6, a[1] + 3.0]], 'hide1');
    c.bevel({ up: 0, down: 1 });
  });

  // torso, neck, paint
  g.part((c) => {
    c.blob(torsoPts(J), S, 0.45);
    const hb = add(J.head, [0.2, -0.4]);
    c.limb(J.neck[0], J.neck[1], hb[0], hb[1], 2.2 * K, 1.8 * K, S);
    const pf = paintFn(v, J);
    c.flush();
    c.remap((x, y, hex) => { const [u, w] = uv(x, y); return pf(u, w) && u < B.spine - 0.2 ? v.paint : undefined; });
    rim(c, [S], 1, 1);
    c.bevel({ up: 1, down: 1 });
    if (v.wear === 'bare') {
      // bone bead necklace with a tooth
      for (let i = 0; i <= 3; i++) c.px(...J.at(B.spine - 0.4 - i * 0.55, 0.2 + i * 0.55), i === 3 ? 'bone1' : 'bone0', true);
      c.px(...J.at(B.spine - 2.4, 1.9), 'bone1', true);
    }
  }, { sep: 1 });

  // near leg
  g.part((c) => {
    const L = J.legs.n;
    drawLeg(c, L, B, S); rim(c, [S]); c.bevel({ up: 1, down: 1, only: [S] });
    if (v.wear === 'wrap') stripes(c, L.h, L.k, [0.45, 0.75], v.paint, 0.9);
  }, { sep: 2 });

  // waist wrap, front flap and cord belt
  g.part((c) => {
    const ws = [J.at(1.5, -B.back - 0.3), J.at(1.4, B.hipW + 0.1), J.at(-0.7, B.hipW + 0.2), J.at(-1.1, -B.back - 0.2)];
    c.poly(ws, 'hide1');
    const f0 = J.at(-0.6, 0.6), f1 = J.at(-0.7, B.hipW + 0.2);
    c.poly([f0, f1, [f1[0] - tr * 0.6, f1[1] + 3.2], [f0[0] - tr * 0.7, f0[1] + 2.8]], 'hide2');
    c.bevel({ up: 1, down: 1 });
    c.flush();
    c.pline(...J.at(1.25, -B.back - 0.1), ...J.at(1.25, B.hipW), 'paint', true);
  }, { sep: 1 });

  // garment over the shoulders
  if (v.wear === 'cape') {
    g.part((c) => {
      const L = B.spine;
      c.poly([J.at(L + 0.5, 0.7), J.at(L + 0.7, -0.8), J.at(L - 0.2, -B.back - 0.9),
        add(J.at(L - 5.6, -B.back - 0.8), [-tr * 1.1, -tr * 0.35]), add(J.at(L - 5.0, -0.6), [-tr * 0.6, -tr * 0.2]), J.at(L - 1.6, 0.9)], 'ochre');
      c.bevel({ up: 1, down: 1 });
      c.flush();
      c.pline(...J.at(L + 0.3, -B.back - 0.5), ...J.at(L + 0.3, 0.7), 'clay2', true);
    }, { sep: 1 });
  } else if (v.wear === 'wrap') {
    g.part((c) => {
      const L = B.spine;
      c.poly([J.at(L + 0.4, -B.back), J.at(L + 0.6, 0.6), J.at(L - 1.6, B.chest + 0.1), J.at(L - 4.6, B.chest - 0.3),
        J.at(L - 5.4, B.chest - 1.6), J.at(L - 2.2, -0.2), J.at(L - 1.8, -B.back - 0.4)], 'hide0');
      // loose end over the shoulder blade, trailing
      const t0 = J.at(L - 0.6, -B.back - 0.3);
      c.poly([t0, J.at(L - 2.4, -B.back - 0.2), [t0[0] - 1.4 - tr * 0.9, t0[1] + 3.6 - tr * 0.3]], 'hide1');
      c.bevel({ up: 1, down: 1 });
    }, { sep: 1 });
  }

  // head
  const look = P.head.look;
  const headFn = (c) => {
    const lg = { h: 'hair0', H: 'hair1', S, s: F, L: 'skin4', e: 'ink', b: 'ochre', F: 'paint1', p: v.face, m: 'skinD' };
    let rows = headRows(look === 'lie' ? 'fwd' : look, v);
    let ax = HEAD_AX, ay = HEAD_AY;
    if (look === 'lie') { rows = rotUp(rows); const W = HEADS.fwd[0].length; [ax, ay] = [HEAD_AY, W - 1 - HEAD_AX]; }
    c.stamp(J.head[0], J.head[1], rows, lg, { ax, ay, flip: !!P.head.flip });
    if (v.hair === 'knot' && look !== 'lie') c.stamp(J.head[0], J.head[1], HEAD_KNOT, { K: 'hair0', H: 'hair1' }, { ax: 2, ay: HEAD_AY + 1, flip: !!P.head.flip });
  };

  // near arm
  const armFn = (c) => {
    const A = J.arms.n;
    drawArm(c, A, B, S); rim(c, [S]); c.bevel({ up: 1, down: 1, only: [S] });
    if (v.wear === 'cape') stripes(c, A.s, A.e, [0.45, 0.8], v.paint);
  };
  // with the spear drawn back past the face, the head goes on top so the face stays readable
  if (P.headTop) { g.part(armFn, { sep: 2 }); g.part(headFn); }
  else { g.part(headFn); g.part(armFn, { sep: 2 }); }

  g.outline();

  // ----- rigid props, pixel-exact on top of the outlined figure -----
  let torch = null;
  if (night) torch = drawTorch(g, J, P);
  if (P.spear) {
    let pts, behind = !!P.spear.behind;
    if (P.spear.pts) {
      // authored in rig units: the butt scales with the figure, the shaft keeps its length
      const [bx, by, tx, ty] = P.spear.pts, l = Math.hypot(tx - bx, ty - by);
      pts = [bx * K, by * K, bx * K + (tx - bx) / l * SPEAR, by * K + (ty - by) / l * SPEAR];
    }
    else {
      const hd = J.arms[P.spear.hand].h, d = [Math.cos(P.spear.ang), Math.sin(P.spear.ang)];
      const tip = add(hd, scl(d, P.spear.grip));
      pts = [tip[0] - d[0] * SPEAR, tip[1] - d[1] * SPEAR, tip[0], tip[1]];
      behind = P.spear.hand === 'f';
    }
    drawSpear(g, pts, behind);
    if (!behind && !P.spear.pts) fist(g, J.arms.n.h, S);
    if (!behind && P.spear.pts && P.arms.n.to) fist(g, J.arms.n.h, S);
  }
  if (P.headTop) headFn(g);
  return { J, torch };
}

function fist(g, h, col) {
  g.px(h[0], h[1], col);
  g.px(h[0], h[1] - 1, col);
}

function drawSpear(g, [bx, by, tx, ty], behind) {
  const L = Math.hypot(tx - bx, ty - by), d = [(tx - bx) / L, (ty - by) / L], n = [-d[1], d[0]];
  // the point is built from whole pixels around a snapped tip, so it keeps one shape in every frame
  const T = [Math.floor(tx) + 0.5, Math.floor(ty) + 0.5];
  const at = (k, m = 0) => [T[0] - d[0] * k + n[0] * m, T[1] - d[1] * k + n[1] * m];
  const up = n[1] > 0 ? -1 : 1; // which side of the blade faces the sky
  layer(g, (c) => {
    c.pline(bx, by, ...at(3.6), 'bark2');
    c.pline(...at(3), ...T, 'rock2');
    c.pline(...at(2, up), ...at(3, up), 'rock3');
    c.pline(...at(2, -up), ...at(3, -up), 'rock1');
    c.px(...at(1), 'rock4'); // glint
    c.px(...at(3.6), 'bone0'); // sinew binding
  }, behind ? 'under' : 'over');
}

function drawTorch(g, J, P) {
  let h, ang = TORCH_ANG, len = 13.5;
  if (P.torchDropped) {
    // dropped: lying on the ground behind him, gone out
    layer(g, (c) => { c.pline(-15.5, -0.5, -4.5, -1.5, 'torch0'); c.px(-16, -0.5, 'ash1'); c.px(-15, -1.5, 'ash1'); }, 'under');
    return null;
  }
  h = J.arms.f.h;
  if (P.torchHold === 'point') ang = 0.15;
  if (P.cheer) ang = 0.25;
  const d = [Math.sin(ang), -Math.cos(ang)];
  const top = add(h, scl(d, len)), bot = add(h, scl(d, -2.5));
  layer(g, (c) => {
    c.pline(bot[0], bot[1], top[0], top[1], 'torch1');
    c.px(top[0], top[1], 'torchH');
    c.px(top[0] - d[0], top[1] - d[1], 'torchH');
    c.px(top[0] + 1, top[1] + 1, 'torch0');
  }, 'under');
  return top;
}

// ---------- frame sets ----------
const SETS = [['idle', 6], ['walk', 8], ['run', 8], ['search', 6], ['windup', 4], ['throw', 5], ['down', 4], ['cheer', 6]];

function poseFor(name, i, n) {
  if (SEQ[name]) return seqPose(name, i, n);
  const P = POSES[name](i / n);
  return P;
}

function buildVariant(v) {
  const B = dims(v), groups = {}, torches = {};
  for (const night of [false, true]) {
    for (const [name, n] of SETS) {
      const key = (night ? 'n_' : 'd_') + name;
      groups[key] = [];
      if (night) torches[name] = [];
      for (let i = 0; i < n; i++) {
        const P = poseFor(name, i, n);
        if (night && !P.oneShot && !P.cheer) P.arms.f = to(TORCH_HAND[0], TORCH_HAND[1]);
        if (night && P.spear && P.spear.hand === 'f') P.spear = null;
        if (night && name === 'search') { P.spear = { pts: [-3.2, -0.2, -2.6, -0.2 - SPEAR], behind: true }; P.arms.f = to(TORCH_HAND[0] + 2, TORCH_HAND[1] + 1); }
        const g = new Pix(90, 70, 45, 58);
        const { torch } = drawFigure(g, P, v, B, night);
        groups[key].push(g);
        if (night) torches[name].push(torch ? [Math.round(torch[0] * 10) / 10, Math.round(torch[1] * 10) / 10] : null);
      }
    }
  }
  const f = cropFrames(groups);
  const out = { w: f.w, h: f.h, ox: f.ox, oy: f.oy, d: {}, n: {}, torchAt: torches };
  for (const [name] of SETS) { out.d[name] = f['d_' + name]; out.n[name] = f['n_' + name]; }
  // the flame point the game uses: mean over walk and run (it holds within a pixel or two)
  const pts = [...torches.walk, ...torches.run];
  out.torch = [Math.round(pts.reduce((s, p) => s + p[0], 0) / pts.length), Math.round(pts.reduce((s, p) => s + p[1], 0) / pts.length)];
  return out;
}

export function build() {
  return { hunter: VARS.map(buildVariant) };
}

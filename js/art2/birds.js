// Birds and small items: ostrich, guineafowl, flamingo, the circling vulture, the carcasses,
// the stuck spear and the HUD icons.
//
// Birds share a small two-legged rig: each foot follows a planted/swing path and the leg is solved
// back to the hip with two-bone IK. The visible "backward knee" is the ankle, so the joint bends
// toward -x. Thin legs and necks are rasterized pixel by pixel (ppath) so they stay an even width.
import { Pix, cid, cropFrames, cropOne, cropAnim, ik, lerp, clamp, TAU } from './pix.js';
import { spline } from './quad.js';
import { addColors, addRamp } from './pal.js';

addColors({
  plD: '#978672', pl0: '#c4b6a0', pl1: '#e6dccb', pl2: '#fffbf3', // ostrich plumes
  ostPD: '#93624f', // far ostrich leg
  fwB0: '#2f5f8c', fwB1: '#5c9cc8', fwB2: '#a6d2ea', // guineafowl bare face
  cas0: '#7a5630', cas1: '#b48a50', // guineafowl casque
  flBill: '#efe2cf',
  vuD: '#18110e', vu0: '#2e221b', vu1: '#4a3828', vu2: '#6c533c', vu3: '#94785a', // vulture
  horn0: '#2a1d14', horn1: '#54402c', horn2: '#7c6448', // gazelle horn
});
addRamp('plume', ['plD', 'pl0', 'pl1', 'pl2'], 'olBone');
addRamp('ostLeg', ['ostPD', 'ostP', 'ost2', 'flam2'], 'olSkin');
addRamp('fwFace', ['fwB0', 'fwB1', 'fwB2'], 'ink');
addRamp('casque', ['cas0', 'cas1'], 'olFur');
addRamp('vult', ['vuD', 'vu0', 'vu1', 'vu2', 'vu3'], 'ink');
addRamp('horn', ['horn0', 'horn1', 'horn2'], 'ink');

// ---------- pixel paths ----------
function crSample(pts, per = 8) {
  const n = pts.length;
  if (n < 3) return pts;
  const out = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((d) => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
    }
  }
  out.push(pts[n - 1]);
  return out;
}
// The pixels a path crosses, one pixel thick (no doubled L corners).
function pathPixels(pts, smooth = true) {
  const P = smooth ? crSample(pts) : pts, raw = [];
  const add = (x, y) => { const i = Math.floor(x), j = Math.floor(y), l = raw[raw.length - 1]; if (!l || l[0] !== i || l[1] !== j) raw.push([i, j]); };
  for (let k = 0; k < P.length - 1; k++) {
    const [x0, y0] = P[k], [x1, y1] = P[k + 1], n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 6));
    for (let s = 0; s < n; s++) add(x0 + (x1 - x0) * s / n, y0 + (y1 - y0) * s / n);
  }
  add(P[P.length - 1][0], P[P.length - 1][1]);
  const out = [];
  for (let k = 0; k < raw.length; k++) {
    const a = out[out.length - 1], c = raw[k + 1], r = raw[k];
    if (a && a[0] === r[0] && a[1] === r[1]) continue;
    if (a && c && Math.abs(a[0] - c[0]) <= 1 && Math.abs(a[1] - c[1]) <= 1 && !(a[0] === c[0] && a[1] === c[1])) continue;
    out.push(r);
  }
  return out;
}
// Draw a path in sprite space (the layer must have no transform pushed). w = 2 doubles it on the
// shaded side (right of a steep run, below a shallow one) in col2.
function ppath(g, pts, col, { w = 1, col2 = col, smooth = true } = {}) {
  g.flush();
  const px = pathPixels(pts, smooth), id = cid(col), id2 = cid(col2);
  const put = (i, j, d) => g.set(i + g.ax, j + g.ay, d);
  if (w >= 2) for (let k = 0; k < px.length; k++) {
    const a = px[Math.max(0, k - 1)], b = px[Math.min(px.length - 1, k + 1)];
    const steep = Math.abs(b[1] - a[1]) >= Math.abs(b[0] - a[0]);
    put(px[k][0] + (steep ? 1 : 0), px[k][1] + (steep ? 0 : 1), id2);
  }
  for (const [i, j] of px) put(i, j, id);
  return px;
}

// ---------- rig helpers ----------
const rot2 = (B, l) => { const c = Math.cos(B[2]), s = Math.sin(B[2]); return [B[0] + c * l[0] - s * l[1], B[1] + s * l[0] + c * l[1]]; };
// One foot's cycle. ph 0 = touchdown. Returns [x (-0.5 back .. 0.5 front, in strides), lift (0 .. -1), curl (0 flat .. 1 hanging)].
function step(ph, beta, swing) {
  ph = ((ph % 1) + 1) % 1;
  if (ph < beta) return [0.5 - ph / beta, 0, 0];
  return spline(swing, (ph - beta) / (1 - beta));
}
// S-shaped neck from base to head; bend > 0 bows the lower neck back and the upper neck forward.
function neckS(base, head, bend, k = 0.6) {
  const dx = head[0] - base[0], dy = head[1] - base[1], L = Math.hypot(dx, dy) || 1, nx = dy / L, ny = -dx / L;
  return [base, [base[0] + dx * 0.35 + nx * bend, base[1] + dy * 0.35 + ny * bend],
    [base[0] + dx * 0.72 - nx * bend * k, base[1] + dy * 0.72 - ny * bend * k], head];
}
// A bird leg: hip -> ankle (bends back) -> ball of the foot, then toes.
// foot: [x, lift, curl]. o: { l1, l2, col, col2, thigh: [w0, w1] | null, w2, toe, ballH, knob }
function bLeg(c, hip, foot, o) {
  const lift = Math.min(0, foot[1]);
  const ball = [foot[0], lift - o.ballH];
  const [ax, ay, bx, by] = ik(hip[0], hip[1], ball[0], ball[1], o.l1, o.l2, -1);
  if (o.thigh) c.limb(hip[0], hip[1], ax, ay, o.thigh[0], o.thigh[1], o.col);
  else ppath(c, [hip, [ax, ay]], o.col, { smooth: false });
  if (o.knob) c.ell(ax, ay, o.knob, o.knob, o.col);
  ppath(c, [[ax, ay], [bx, by]], o.col, { smooth: false, w: o.w2 || 1, col2: o.col2 || o.col });
  const air = lift < -0.3 || by < ball[1] - 0.6;
  if (!air) {
    ppath(c, [[bx - (o.heel || 0), -0.5], [bx + o.toe, -0.5]], o.col, { smooth: false });
    if (o.claw) c.px(bx + o.toe, -0.5, o.claw);
  } else {
    const th = lerp(0.35, 1.45, foot[2]);
    ppath(c, [[bx, by], [bx + Math.cos(th) * o.toe, by + Math.sin(th) * o.toe]], o.col, { smooth: false });
  }
  return { ankle: [ax, ay], ball: [bx, by], air };
}
// Head-bob of a walking bird: hold still in the world (drift back on screen), then snap forward.
// q in 0..1 per step.
const bobHead = (q) => spline([[0, 1], [0.7, -1], [0.85, 1.2], [1, 1]], ((q % 1) + 1) % 1)[0];

// ======================================================================
// OSTRICH
// ======================================================================
const OST = {
  body: [[-10, -4.2], [-6, -6.8], [0, -7.4], [5.5, -6.2], [9, -3.6], [10.4, 0], [8.8, 4], [3.5, 6.2], [-3.5, 6.2], [-8.5, 4], [-11, 0.5]],
  tail: [[-9, -4], [-12, -4.8], [-14.2, -2.8], [-14.4, 0.2], [-12.8, 2.4], [-10.4, 1.6]],
  wing: [[-2, -4], [4.5, -2.8], [5.6, 0.4], [2, 3.4], [-5, 4.2], [-10.5, 3.2], [-9, -1.2]],
  wingTip: [[-5, 2.6], [-10.5, 2], [-13.4, 3.4], [-12.2, 5.4], [-7, 5.4]],
  pivot: [4, -1],
  neckBase: [8, -4.4], hip: [0, 4.5], farHip: [2.2, 4],
  l1: 8.5, l2: 11.5,
};
const OH = {
  idle: ['.LLS...', 'LSSkS..', 'SSSSbbb', '.sSbbd.'],
  blink: ['.LLS...', 'LSSsS..', 'SSSSbbb', '.sSbbd.'],
  down: ['LS..', 'SSS.', 'SkSs', 'SSSb', '.sbb', '..bd', '..d.'],
  dead: ['.LLS...', 'LSSsS..', 'SSSSbbb', '.sSbbd.'],
};
const OH_A = { idle: [1, 3], blink: [1, 3], down: [0, 0], dead: [1, 3] };
const OH_LEG = { L: 'flam2', S: 'ost2', s: 'ostP', k: 'ink', b: 'clay2', d: 'clay0' };
const OST_NEAR = { l1: OST.l1, l2: OST.l2, col: 'ost2', col2: 'ostP', thigh: [4.4, 2.0], w2: 2, toe: 3, heel: 0, ballH: 1.5, knob: 1.1, claw: 'olSkin' };
const OST_FAR = { ...OST_NEAR, col: 'ostPD', col2: 'ostPD', claw: null };

function drawOst(g, P) {
  const B = P.b, W = (l) => rot2(B, l);
  g.part((c) => bLeg(c, W(OST.farHip), P.feet[1], OST_FAR));
  g.part((c) => bLeg(c, W(OST.hip), P.feet[0], OST_NEAR), { sep: 1 });
  const nb = W(OST.neckBase);
  g.part((c) => {
    ppath(c, P.neck || neckS(nb, P.head, P.bend), 'ost2', { w: 2, col2: 'ostP' });
  });
  g.part((c) => {
    c.push(B[0], B[1], B[2]);
    c.blob(OST.tail.map(([x, y]) => [x, y - (P.tail || 0) * (x < -12 ? 1 : 0.5)]), 'pl1');
    c.blob(OST.body, 'ost0');
    c.pop();
    c.bevel({ up: 1, down: 1 });
    // folded, the wing is just its white tips under the rump; raised (running) it shows as its own shape
    const wa = P.wing || 0;
    c.part((w) => {
      w.push(B[0], B[1], B[2]);
      w.push(OST.pivot[0], OST.pivot[1], wa);
      w.push(-OST.pivot[0], -OST.pivot[1]);
      w.blob(OST.wingTip, 'pl1');
      w.pop(); w.pop(); w.pop();
      w.bevel({ up: 1, down: 0 });
    }, { sep: wa > 0.05 ? 1 : 0 });
    // a few feather scallops
    c.push(B[0], B[1], B[2]);
    for (const [x, y] of [[-4, -5], [1, -5.6], [-7, -2.5]]) c.px(x, y, 'ost3', true);
    c.pop();
  });
  g.part((c) => {
    const [ax, ay] = OH_A[P.rows];
    c.stamp(P.head[0], P.head[1], OH[P.rows], OH_LEG, { ax, ay, flip: !!P.flip });
  });
  g.outline();
}

const OST_IDLE = [
  { head: [10, -42] },
  { head: [10.8, -41.6] },
  { head: [8.4, -42.4], flip: true, bend: 0.4 },
  { head: [8.2, -41.8], flip: true, bend: 0.4 },
  { head: [10.2, -41.8], rows: 'blink' },
  { head: [10.6, -41.6] },
];
const OST_PECK = [
  { b: [0, -24, 0], head: [10, -42], rows: 'idle', bend: 0.8 },
  { b: [0, -23, 0.22], head: [16, -27], rows: 'idle', bend: 1.5 },
  { b: [0, -22, 0.42], head: [17.5, -7], rows: 'down', bend: 2.4 },
  { b: [0, -22, 0.45], head: [18, -5], rows: 'down', bend: 2.4 },
  { b: [0, -22, 0.4], head: [17.5, -8], rows: 'down', bend: 2.2 },
  { b: [0, -23, 0.18], head: [14, -32], rows: 'idle', bend: 1.2 },
];
const OST_WALK_SW = [[0, -0.5, 0, 0.3], [0.3, -0.3, -0.85, 0.95], [0.65, 0.22, -0.9, 0.6], [1, 0.5, 0, 0]];
const OST_RUN_SW = [[0, -0.5, 0, 0.3], [0.25, -0.55, -0.75, 1], [0.55, -0.2, -1, 1], [0.8, 0.35, -0.6, 0.6], [0.92, 0.55, -0.2, 0.1], [1, 0.5, 0, 0]];

function ostPose(set, i, n) {
  const p = i / n;
  const P = { b: [0, -24, 0], feet: [[-1.5, 0, 0], [3.2, 0, 0]], head: [10, -42], rows: 'idle', bend: 0.8, wing: 0, tail: 0 };
  if (set === 'idle') return Object.assign(P, OST_IDLE[i]);
  if (set === 'peck') return Object.assign(P, OST_PECK[i]);
  if (set === 'walk') {
    const S = 12, LF = 4.5, beta = 0.62;
    [[0, 0, 0.5], [1, 0.5, 1.8]].forEach(([k, ph, base]) => {
      const [x, y, c] = step(p - ph, beta, OST_WALK_SW);
      P.feet[k] = [base + x * S, y * LF, c];
    });
    P.b[1] = -24 + Math.round(0.7 * Math.cos(TAU * 2 * (p - beta / 2)));
    const hb = bobHead(2 * p + 0.15);
    P.head = [10.5 + hb * 1.4, -42 + P.b[1] + 24 + Math.abs(hb) * 0.3];
    P.tail = Math.round(Math.sin(TAU * 2 * p) * 0.6);
    return P;
  }
  if (set === 'run') {
    const S = 19, LF = 7.5, beta = 0.36;
    [[0, 0, 0], [1, 0.5, 1.3]].forEach(([k, ph, base]) => {
      const [x, y, c] = step(p - ph, beta, OST_RUN_SW);
      P.feet[k] = [base + x * S, y * LF, c];
    });
    const bob = Math.round(1.2 * Math.cos(TAU * 2 * (p - beta / 2)));
    P.b = [0, -23 + bob, 0.1];
    const pump = Math.sin(TAU * 2 * (p - 0.05));
    P.head = [16 + pump * 0.9, -38 + bob * 0.5 + pump * 0.3];
    P.bend = 1.8;
    P.wing = 0.3 + 0.1 * Math.sin(TAU * 2 * p);
    P.tail = 1 + Math.round(Math.sin(TAU * 2 * p));
    return P;
  }
  return P;
}

function drawOstDead(g) {
  // on its side: body down, legs stuck out stiff, neck limp along the ground
  const B = [-2, -7, 0.05];
  // legs out stiff, toes curled
  const deadLeg = (c, y, col, col2) => {
    c.limb(1, y - 1, 6, y, 4, 2, col);
    ppath(c, [[6, y], [13, y - 1.5]], col, { w: 2, col2, smooth: false });
    ppath(c, [[13, y - 1.5], [14.5, y + 0.5]], col, { smooth: false });
  };
  g.part((c) => deadLeg(c, -5.5, 'ostPD', 'ostPD'));
  g.part((c) => deadLeg(c, -2.5, 'ost2', 'ostP'), { sep: 1 });
  g.part((c) => ppath(c, [[7, -9], [12, -7], [16, -3], [21, -2]], 'ost2', { w: 2, col2: 'ostP' }));
  g.part((c) => {
    c.push(B[0], B[1], B[2], 1, 0.8);
    c.blob(OST.tail.map(([x, y]) => [x, y + 2]), 'pl1');
    c.blob(OST.body, 'ost0');
    c.pop();
    c.bevel({ up: 1, down: 1 });
    c.part((w) => {
      w.push(B[0], B[1], 0.25, 1, 0.8);
      w.blob(OST.wingTip.map(([x, y]) => [x, y + 1]), 'pl1');
      w.blob(OST.wing, 'ost0');
      w.pop();
      w.bevel({ up: 1, down: 0 });
    }, { sep: 1 });
  });
  g.part((c) => c.stamp(21, -2, OH.dead, OH_LEG, { ax: 1, ay: 3 }));
  g.outline();
}

function buildOstrich() {
  const st = () => new Pix(96, 72, 46, 62);
  const sets = { idle: 6, walk: 8, run: 8, peck: 6 }, out = {};
  for (const s in sets) {
    out[s] = [];
    for (let i = 0; i < sets[s]; i++) { const g = st(); drawOst(g, ostPose(s, i, sets[s])); out[s].push(g); }
  }
  const d = st(); drawOstDead(d); out.dead = [d];
  return cropFrames(out);
}

// ======================================================================
// GUINEAFOWL
// ======================================================================
const FOWL = {
  body: [[-6.6, 1.8], [-6.2, -1], [-4.4, -3.6], [-1.6, -5], [1.6, -4.6], [3.8, -2.8], [4.8, -0.4], [4.2, 2], [1.5, 3.4], [-2.5, 3.6], [-5.4, 3]],
  wing: [[-5.6, 1.4], [-4, -2.6], [-0.5, -3.6], [2.6, -2.4], [2.4, 1], [-1.6, 2.4]],
  hip: [0, 3], farHip: [1.2, 2.8], neckBase: [3.4, -2],
};
const FH = {
  idle: ['.c...', '.Cc..', 'bBkBy', 'DBBy.', '.rr..'],
  blink: ['.c...', '.Cc..', 'bBDBy', 'DBBy.', '.rr..'],
  dead: ['.....', '.....', 'bBDBy', 'DBBy.', '.rr..'],
};
const FH_LEG = { c: 'cas1', C: 'cas0', b: 'fwB2', B: 'fwB1', D: 'fwB0', k: 'ink', y: 'bone0', r: 'blood1' };
const FOWL_LEG = { l1: 2.8, l2: 3.4, col: 'rock2', toe: 2, heel: 0, ballH: 1, w2: 1 };
const FOWL_FAR = { ...FOWL_LEG, col: 'rock1' };

// speckle: a fixed diamond lattice in body space, kept off the silhouette edge
function speckle(c, bx, by, only) {
  c.flush();
  const { w, h, buf } = c, ids = new Set(only.map(cid)), dot = cid('fowl2'), src = buf.slice();
  for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) {
    const id = src[j * w + i];
    if (!ids.has(id)) continue;
    if (!src[j * w + i - 1] || !src[j * w + i + 1] || !src[(j - 1) * w + i] || !src[(j + 1) * w + i]) continue;
    const li = i - c.ax - bx, lj = j - c.ay - by;
    if (((lj % 2) + 2) % 2) continue;
    const off = (((lj / 2) % 2) + 2) % 2 ? 2 : 0;
    if ((((li + off) % 3) + 3) % 3 === 0) buf[j * w + i] = dot;
  }
}

function fowlWing(c, bx, by, s, col) {
  c.push(bx + 0.5, by - 2.5, 0, 1, s);
  c.blob([[-3.4, 0.5], [2.4, 0.5], [2.6, -3], [0.8, -7], [-2.4, -8.2], [-4.6, -4.4]], col);
  c.pop();
  c.bevel({ up: 1, down: 0 });
  speckle(c, bx, by, [col]);
}

function drawFowl(g, P) {
  const bx = Math.round(P.b[0]), by = Math.round(P.b[1]), B = [bx, by, 0], W = (l) => rot2(B, l);
  // in flight the legs tuck into the belly feathers
  if (P.flap === undefined) {
    g.part((c) => bLeg(c, W(FOWL.farHip), P.feet[1], FOWL_FAR));
    g.part((c) => bLeg(c, W(FOWL.hip), P.feet[0], FOWL_LEG), { sep: 1 });
  }
  if (P.flap !== undefined) g.part((c) => fowlWing(c, bx + 1, by - 0.5, P.flap * 0.9, 'fowlD'));
  g.part((c) => ppath(c, neckS(W(FOWL.neckBase), P.head, P.bend || 0.4), 'fowl1', { w: 2, col2: 'fowl0' }));
  g.part((c) => {
    c.push(bx, by);
    c.blob(FOWL.body, 'fowl0');
    c.pop();
    c.bevel({ up: 1, down: 1 });
    if (P.flap === undefined) c.part((w) => { w.push(bx, by); w.blob(FOWL.wing, 'fowl0'); w.pop(); w.bevel({ up: 1, down: 0 }); }, { sep: 1 });
    speckle(c, bx, by, ['fowl0', 'fowlD']);
  });
  if (P.flap !== undefined) g.part((c) => fowlWing(c, bx, by, P.flap, 'fowl0'), { sep: 1 });
  g.part((c) => c.stamp(P.head[0], P.head[1], FH[P.rows || 'idle'], FH_LEG, { ax: 0, ay: 3 }));
  g.outline();
}

const FOWL_SW = [[0, -0.5, 0, 0.3], [0.35, -0.2, -0.9, 0.9], [0.7, 0.3, -0.8, 0.5], [1, 0.5, 0, 0]];
function fowlPose(set, i, n) {
  const p = i / n;
  const P = { b: [0, -8], feet: [[-0.5, 0, 0], [1.6, 0, 0]], head: [6, -12.5], rows: 'idle', bend: 0.4 };
  if (set === 'idle') {
    const F = [{ head: [6, -12.5] }, { head: [6.6, -12] }, { head: [7.4, -9.5], bend: -0.4 }, { head: [6, -12.5], rows: 'blink' }][i];
    return Object.assign(P, F);
  }
  if (set === 'walk' || set === 'run') {
    const run = set === 'run', S = run ? 8 : 5, LF = run ? 3 : 2, beta = run ? 0.4 : 0.6;
    [[0, 0, 0], [1, 0.5, 1.2]].forEach(([k, ph, base]) => {
      const [x, y, c] = step(p - ph, beta, FOWL_SW);
      P.feet[k] = [base + x * S, y * LF, c];
    });
    const bob = Math.round(0.6 * Math.cos(TAU * 2 * (p - beta / 2)));
    P.b = [run ? 1 : 0, -8 + bob];
    if (run) { P.head = [10, -11 + bob * 0.5]; P.bend = -0.6; }
    else { const hb = bobHead(2 * p + 0.15); P.head = [6.3 + hb * 0.9, -12.5 + bob]; }
    return P;
  }
  if (set === 'fly') {
    const S = [1, 0.45, -0.35, -1, -0.6, 0.35];
    P.b = [0, -10];
    P.flap = S[i];
    P.feet = [[-3.5, -4, 1], [-2.4, -4, 1]];
    P.head = [8, -14 + (S[i] < 0 ? 0 : -0.5)];
    P.bend = -0.3;
    return P;
  }
  return P;
}
function drawFowlDead(g) {
  g.part((c) => { ppath(c, [[1, -3], [4, -5], [6, -4]], 'fowl0'); ppath(c, [[0, -2.5], [3, -2], [5, -1]], 'fowl1'); });
  g.part((c) => ppath(c, [[-4, -3], [-7, -2], [-9, -1.5]], 'fowl1', { w: 2, col2: 'fowl0' }));
  g.part((c) => {
    c.push(0, -3, 0.15, 1, 0.75);
    c.blob(FOWL.body, 'fowl0');
    c.pop();
    c.bevel({ up: 1, down: 1 });
    speckle(c, 0, -3, ['fowl0', 'fowlD']);
  });
  g.part((c) => c.stamp(-10, -1.5, FH.dead, FH_LEG, { ax: 0, ay: 3, flip: true }));
  g.outline();
}
function buildFowl() {
  const st = () => new Pix(48, 40, 24, 30);
  const sets = { idle: 4, walk: 6, run: 6, fly: 6 }, out = {};
  for (const s in sets) {
    out[s] = [];
    for (let i = 0; i < sets[s]; i++) { const g = st(); drawFowl(g, fowlPose(s, i, sets[s])); out[s].push(g); }
  }
  const d = st(); drawFowlDead(d); out.dead = [d];
  return cropFrames(out);
}

// ======================================================================
// FLAMINGO
// ======================================================================
const FLM = {
  body: [[-7.8, 0.2], [-5.6, -2.4], [-1, -3.2], [3.4, -2.8], [5.8, -0.8], [5.2, 1.8], [2, 3], [-3, 2.8], [-6.2, 1.8]],
  wing: [[-2.4, -2.6], [2.8, -2.2], [4, -0.2], [1.4, 1.6], [-4.4, 1.6], [-8.2, 0.4]],
  hip: [-0.5, 2], farHip: [0.5, 1.7], neckBase: [4.4, -1.4],
};
const FLH = {
  idle: ['.FF...', 'FfkWW.', '.ffWWx', '....xx'],
  blink: ['.FF...', 'FffWW.', '.ffWWx', '....xx'],
  dead: ['.FF...', 'FffWW.', '.ffWWx', '....xx'],
};
const FLH_A = [1, 2];
const FLH_LEG = { f: 'flam1', F: 'flam2', k: 'ink', W: 'flBill', x: 'ink' };
const FLM_LEG = { l1: 7.5, l2: 10, col: 'flam0', toe: 2, heel: 1, ballH: 1, knob: 0 };
const FLM_FAR = { ...FLM_LEG, col: 'flamD' };
const upside = (rows) => rows.slice().reverse().map((r) => r.split('').reverse().join(''));

function flamWing(c, x, y, s, far) {
  const sy = Math.sign(s || 1) * Math.max(0.28, Math.abs(s));
  c.push(x, y, 0, 1, sy);
  // pink coverts over the inner wing, black flight feathers only toward the tip and trailing edge
  c.blob([[1.4, -5], [0, -11], [-3, -16.4], [-4.8, -13], [-5.6, -7], [-4.6, -3]], far ? 'ostD' : 'ost0', 0.35);
  c.blob([[-4, 0.6], [2.6, 0.6], [2, -4.6], [-0.6, -8.5], [-3.6, -9.4], [-4.8, -4]], far ? 'flamD' : 'flam0');
  c.pop();
}

function drawFlam(g, P) {
  const B = P.b, W = (l) => rot2(B, l);
  const hipN = W(FLM.hip), hipF = W(FLM.farHip);
  if (P.flap !== undefined) g.part((c) => flamWing(c, B[0] + 1.5, B[1] - 1.5, P.flap * 0.9, true));
  g.part((c) => {
    if (P.legsBack) ppath(c, [hipF, P.legsBack[1]], 'flamD');
    else if (P.tuck) ppath(c, [hipF, [hipF[0] + 2, hipF[1] + 3.5], [hipF[0] - 3, hipF[1] + 1.5]], 'flamD', { smooth: false });
    else bLeg(c, hipF, P.feet[1], FLM_FAR);
  });
  g.part((c) => {
    if (P.legsBack) {
      ppath(c, [hipN, P.legsBack[0]], 'flam0');
      const e = P.legsBack[0];
      ppath(c, [e, [e[0] - 2, e[1] + 1]], 'flam0', { smooth: false });
    } else bLeg(c, hipN, P.feet[0], FLM_LEG);
  }, { sep: 1 });
  g.part((c) => ppath(c, P.neck, 'flam1', { w: P.neckW || 1, col2: 'flam0' }));
  g.part((c) => {
    c.push(B[0], B[1], B[2]);
    c.blob(FLM.body, 'flam1');
    c.pop();
    c.bevel({ up: 1, down: 1 });
    if (P.flap === undefined) {
      c.part((w) => {
        w.push(B[0], B[1], B[2]);
        w.blob(FLM.wing, 'flam0');
        w.pop();
        w.bevel({ up: 1, down: 0 });
        w.push(B[0], B[1], B[2]);
        w.pline(-1.5, 1.1, -7.6, 0.4, 'ostD', true);
        w.pline(-4, 0.4, -8, -0.2, 'ostD', true);
        w.pop();
      }, { sep: 1 });
    }
  });
  if (P.flap !== undefined) g.part((c) => flamWing(c, B[0], B[1] - 1, P.flap, false), { sep: 1 });
  g.part((c) => {
    const rows = P.rows === 'feed' ? upside(FLH.idle) : FLH[P.rows || 'idle'];
    const [ax, ay] = P.rows === 'feed' ? [FLH.idle[0].length - 1 - FLH_A[0], FLH.idle.length - 1 - FLH_A[1]] : FLH_A;
    c.stamp(P.head[0], P.head[1], rows, FLH_LEG, { ax, ay, flip: !!P.flip });
  });
  g.outline();
}

const FLM_SW = [[0, -0.5, 0, 0.3], [0.3, -0.35, -0.9, 1], [0.65, 0.15, -1, 0.8], [1, 0.5, 0, 0]];
function flamPose(set, i, n) {
  const p = i / n;
  const P = { b: [0, -20, 0], feet: [[-0.5, 0, 0], [0.5, 0, 0]], rows: 'idle' };
  const base = () => rot2(P.b, FLM.neckBase);
  if (set === 'idle') {
    const H = [[5.6, -34], [6.3, -33.6], [6.8, -33.2], [3, -30], [0.6, -25], [5.2, -33.6]][i];
    P.tuck = true;
    P.head = H;
    const nb = base();
    if (i === 3) { P.flip = true; P.neck = [nb, [6.8, -25], [6.8, -30], [4.6, -32], H]; }
    else if (i === 4) { P.flip = true; P.rows = 'blink'; P.neck = [nb, [7, -24.5], [6.6, -28.5], [3.6, -28.6], H]; }
    else P.neck = [nb, [6.6, -25], [4.6, -29], [H[0] - 1.6, H[1] + 2.6], H];
    return P;
  }
  if (set === 'walk' || set === 'run') {
    const run = set === 'run', S = run ? 13 : 9, LF = run ? 5 : 4.5, beta = run ? 0.42 : 0.6;
    [[0, 0, -0.5], [1, 0.5, 0.5]].forEach(([k, ph, b0]) => {
      const [x, y, c] = step(p - ph, beta, FLM_SW);
      P.feet[k] = [b0 + x * S, y * LF, c];
    });
    const bob = Math.round(0.6 * Math.cos(TAU * 2 * (p - beta / 2)));
    if (run) {
      P.b = [0, -19 + bob, 0.12];
      P.flap = [0.7, 0.3, -0.2, -0.5, -0.1, 0.4][i];
      const nb = base(), H = [14.5, -27 + bob * 0.5];
      P.head = H; P.neck = [nb, [8, -23], [11, -25.5], H];
    } else {
      P.b = [0, -20 + bob, 0];
      const hb = bobHead(2 * p + 0.15), nb = base(), H = [6.5 + hb * 1.1, -33.5 + bob];
      P.head = H; P.neck = [nb, [6.8, -25], [5, -29], [H[0] - 1.4, H[1] + 2.6], H];
    }
    return P;
  }
  if (set === 'fly') {
    const s = [1, 0.55, -0.15, -0.85, -0.45, 0.4][i];
    P.b = [0, -21 - Math.round(s * 0.5), 0];
    P.flap = s;
    const nb = base(), H = [17, -21.5 + P.b[1] + 21];
    P.head = H; P.neck = [nb, [11, H[1] + 0.2], H];
    P.legsBack = [[-17, -19 + P.b[1] + 21], [-16.5, -19.6 + P.b[1] + 21]];
    return P;
  }
  if (set === 'feed') {
    const sw = Math.sin(TAU * p);
    P.b = [0.5, -19, 0.2];
    P.feet = [[3, 0, 0], [-3, 0, 0]];
    const nb = base(), H = [11.5 + sw * 1.5, -2.5 - Math.abs(sw) * 0.3];
    P.rows = 'feed';
    P.head = H; P.neck = [nb, [8, -20.6], [10.6, -15], [11.6 + sw * 0.6, -8], H];
    return P;
  }
  return P;
}
function drawFlamDead(g) {
  g.part((c) => {
    ppath(c, [[-1, -3], [-5, -9], [-9, -7]], 'flamD', { smooth: false });
    ppath(c, [[-9, -7], [-11, -6]], 'flamD', { smooth: false });
  });
  g.part((c) => {
    ppath(c, [[1, -2.5], [6, -9], [10, -6]], 'flam0', { smooth: false });
    ppath(c, [[10, -6], [12, -5]], 'flam0', { smooth: false });
  }, { sep: 1 });
  g.part((c) => ppath(c, [[5, -3.5], [10, -2.5], [15, -3.5], [19, -2.5]], 'flam1', { w: 2, col2: 'flam0' }));
  g.part((c) => {
    c.push(0, -3.4, 0.05, 1, 0.85);
    c.blob(FLM.body, 'flam1');
    c.pop();
    c.bevel({ up: 1, down: 1 });
    c.part((w) => {
      w.push(0, -3.6, 0.05, 1, 0.85);
      w.blob(FLM.wing, 'flam0');
      w.pop();
      w.bevel({ up: 1, down: 0 });
      w.pline(-2, -2.6, -7.6, -3.2, 'ostD', true);
    }, { sep: 1 });
  });
  g.part((c) => c.stamp(19, -2.5, FLH.dead, FLH_LEG, { ax: 1, ay: 2 }));
  g.outline();
}
function buildFlamingo() {
  const st = () => new Pix(80, 64, 40, 54);
  const sets = { idle: 6, walk: 8, run: 6, fly: 6, feed: 6 }, out = {};
  for (const s in sets) {
    out[s] = [];
    for (let i = 0; i < sets[s]; i++) { const g = st(); drawFlam(g, flamPose(s, i, sets[s])); out[s].push(g); }
  }
  const d = st(); drawFlamDead(d); out.dead = [d];
  return cropFrames(out);
}

// ======================================================================
// VULTURE (from above, head up)
// ======================================================================
function vultWing(c, side, span, sweep, yaw, fingers) {
  c.push(0, 0, yaw, side * span, 1);
  c.push(1, 0, sweep); // the same sign on both sides: mirrored, both tips sweep back
  c.push(-1, 0);
  if (fingers) {
    // separate primaries at the hand; the outline falls into the gaps between them
    for (let f = 0; f < 4; f++) c.pline(10.2, -2.2 + f * 1.3, 13.6 - Math.abs(f - 1) * 0.45, -3 + f * 1.9, 'vu1');
  } else {
    c.blob([[1, -1.4], [6, -2.2], [10.4, -2.2], [11, 0], [10.4, 2.4], [7, 3.4], [3.5, 3.6], [1, 3]], 'vu1', 0.3);
    c.blob([[1, -2], [6, -3.2], [10, -3], [10.6, -2], [8, -0.6], [4, 0], [1.2, 0.4]], 'vu2', 0.4);
  }
  c.pop(); c.pop(); c.pop();
}
function vultFrame({ sl, sr, sweep = 0, yaw = 0, tail = 0 }) {
  const g = new Pix(48, 32, 24, 14);
  g.part((c) => { c.push(0, 0, yaw + tail); c.blob([[-1.4, 2.6], [1.4, 2.6], [2.6, 6.4], [0, 7], [-2.6, 6.4]], 'vu0', 0.3); c.pop(); });
  for (const side of [-1, 1]) {
    const s = side < 0 ? sl : sr;
    g.part((c) => { vultWing(c, side, s, sweep, yaw, false); c.bevel({ up: 1, down: 0 }); vultWing(c, side, s, sweep, yaw, true); });
  }
  g.part((c) => {
    c.push(0, 0, yaw);
    c.ell(0, 0.6, 2.1, 3.6, 'vu0');
    c.ell(0, -2.8, 1.8, 1.1, 'pl1');
    c.ell(0, -4.3, 1.1, 1.3, 'bone0');
    c.pop();
    c.bevel({ up: 1, down: 0 });
  });
  g.outline();
  return g;
}
function buildVulture() {
  const soar = [], flap = [];
  for (let i = 0; i < 8; i++) {
    const s = Math.sin(TAU * i / 8);
    soar.push(vultFrame({ sl: 1 - 0.07 * (1 + s), sr: 1 - 0.07 * (1 - s), yaw: 0.07 * s, tail: 0.18 * s }));
  }
  for (const [sp, sw] of [[1, 0], [0.9, 0.08], [0.74, 0.2], [0.64, 0.28], [0.76, 0.16], [0.92, 0.04]]) flap.push(vultFrame({ sl: sp, sr: sp, sweep: sw }));
  return cropFrames({ soar, flap });
}

// ======================================================================
// CARCASSES
// ======================================================================
const GZ_BODY = [[-10, -3], [-6, -6.6], [2, -7], [8, -5.6], [10, -2.6], [8.6, 0.4], [1, 1.4], [-7, 1], [-10.6, -0.6]];
// legs stick out stiff from the belly, near pair a step lighter than the far pair
const GZ_LEGS = [[[6, -0.5], [12, 4], 1], [[4.5, 0], [8.5, 4.6], 0], [[-6, 0], [-12.5, 3.6], 1], [[-4.5, 0.5], [-9, 4.8], 0]];
function gazLegs(c, bones) {
  for (const [a, b, far] of GZ_LEGS) {
    if (bones && far) continue;
    const col = bones ? 'bone' : far ? 'gaz0' : 'gaz1';
    ppath(c, [a, b], col, { smooth: false });
    c.px(b[0], b[1], bones ? 'bone1' : 'horn0');
  }
}
function gazHorns(c) {
  // two ringed horns sweeping back from the crown; the far one a step darker and offset
  ppath(c, [[13.4, -3.6], [12.6, -6.4], [11, -8.6]], 'horn0');
  ppath(c, [[14.6, -3.4], [13.8, -6.2], [12.2, -8.4]], 'horn1');
  c.px(13.9, -5.4, 'horn2'); c.px(12.8, -7.4, 'horn2');
}
function buildCarcass() {
  const g = new Pix(48, 32, 24, 18);
  g.part((c) => c.ell(0, 1.4, 9, 1.8, 'bloodD'));
  g.part((c) => gazLegs(c, false));
  g.part((c) => {
    c.blob(GZ_BODY, 'gaz1');
    c.limb(8, -4, 12.6, -2.4, 3.6, 2.8, 'gaz1');
    c.ell(14.2, -2, 2.6, 1.8, 'gaz2');
    c.limb(14.6, -1.6, 17.4, -0.8, 2.2, 1.4, 'gaz2');
    c.limb(-10.2, -1.4, -12.2, -2.6, 1.6, 1.2, 'gaz0');
    // white belly and throat
    c.remap((x, y, hex) => (hex === '#b8783c' && y > -0.6 && x < 9 ? 'gazW' : undefined));
    c.bevel({ up: 1, down: 1 });
    ppath(c, [[-7, -2.2], [-2, -1.8], [5, -2]], 'gazD');
    c.px(15, -2.6, 'ink'); c.px(17, -1.4, 'ink');
    c.px(12.4, -4.2, 'gaz0'); c.px(11.6, -4.6, 'gaz0'); // ear lying back
  }, { sep: 1 });
  g.part((c) => {
    c.blob([[-3.6, -5.6], [2.4, -6], [4.8, -3.2], [1.4, -1], [-3.6, -1.8]], 'blood1');
    c.blob([[-2.4, -4.6], [2, -5], [3.4, -3], [0.8, -1.8], [-2.4, -2.4]], 'blood');
    for (const x of [-1.6, 0.4, 2.4]) ppath(c, [[x, -5.2], [x + 0.6, -3.6], [x + 0.2, -2.2]], 'bone1');
  });
  g.part((c) => gazHorns(c));
  g.outline();
  return cropOne(g);
}
function buildBones() {
  const g = new Pix(48, 32, 24, 18);
  g.part((c) => { c.px(-2, 0.5, 'bloodD'); c.px(2, 0.5, 'bloodD'); c.px(3, 0.5, 'bloodD'); c.px(-5, 0.5, 'bloodD'); });
  g.part((c) => gazLegs(c, true));
  g.part((c) => {
    // spine with the ribs hanging off it, the pelvis behind, the skull ahead
    for (const x of [-3.5, -1.5, 0.5, 2.5, 4.5]) ppath(c, [[x, -5.6], [x + 1.4, -3.6], [x + 0.6, -1.2]], 'bone');
    ppath(c, [[-9.5, -5.4], [-3, -6.2], [5, -6.2], [9.5, -4.8]], 'bone1', { w: 2, col2: 'bone0' });
    c.ell(-9.2, -4, 2, 1.6, 'bone');
    c.ell(13.6, -2.6, 2.4, 1.6, 'bone1');
    c.limb(14, -2.2, 17.2, -1.2, 2, 1.2, 'bone');
  });
  g.part((c) => {
    c.px(14, -3, 'olBone'); c.px(16.8, -1.5, 'boneD');
    c.px(1.5, -4.5, 'blood'); c.px(3.2, -3.2, 'bloodD');
    ppath(c, [[8, 1.6], [12.5, 2.4]], 'bone1', { smooth: false }); // a loose leg bone
    c.px(8, 1.6, 'bone'); c.px(12.5, 2.4, 'bone');
  });
  g.part((c) => gazHorns(c));
  g.outline();
  return cropOne(g);
}
function buildSmallCarcass() {
  // a hare on its side: hind leg stretched back, ears laid along the back, white scut, opened flank
  const g = new Pix(32, 24, 16, 14);
  g.part((c) => c.ell(0.5, 0.6, 5, 1.2, 'bloodD'));
  g.part((c) => { ppath(c, [[-3, -0.5], [-7.5, 0.5]], 'hare1', { smooth: false }); c.px(-7.5, 0.5, 'hare0'); });
  g.part((c) => {
    c.blob([[-5, -1], [-3.6, -3.6], [0.6, -4], [3.6, -2.8], [4, -0.4], [-1, 0.4], [-4.6, 0.2]], 'hare1');
    c.ell(5.2, -1.6, 1.9, 1.5, 'hare1');
    c.remap((x, y, hex) => (hex === '#948066' && y > -1 && x < 4 ? 'hare3' : undefined));
    c.bevel({ up: 1, down: 1 });
    c.px(5.8, -2, 'ink');
  }, { sep: 1 });
  g.part((c) => {
    ppath(c, [[4.2, -3], [1.6, -4.4], [-0.6, -4.6]], 'hare0');
    c.px(-5.6, -2, 'bone1'); c.px(-5.6, -1, 'bone1');
    c.blob([[-1.6, -3], [1.4, -3.2], [1.8, -1.2], [-1.2, -0.9]], 'blood1');
    c.px(0, -2, 'blood');
  });
  // tufts of torn fur
  g.part((c) => { c.px(-6.5, -2.5, 'hare3'); c.px(2.5, 2, 'hare3'); c.px(3.5, 1.5, 'hare2'); c.px(-3, 2, 'hare2'); });
  g.outline();
  return cropOne(g);
}

// ======================================================================
// SPEAR stuck in the ground (point buried at the anchor; it just landed and quivers)
// ======================================================================
function spearFrame(bend) {
  const g = new Pix(48, 40, 24, 30);
  const a = -0.62, L = 19, dx = Math.sin(a), dy = -Math.cos(a), nx = -dy, ny = dx;
  const at = (t, b = 0) => [dx * t + nx * b, dy * t + ny * b];
  g.part((c) => {
    ppath(c, [at(3.6), at(11, bend * 0.5), at(L, bend)], 'bark3', { w: 2, col2: 'bark1' });
    const [ex, ey] = at(L, bend);
    c.px(ex, ey, 'bark2');
    // sinew binding and the top of the stone point
    ppath(c, [at(2.4), at(4.4)], 'bone0', { w: 2, col2: 'hide1', smooth: false });
    ppath(c, [at(0.6), at(2.4)], 'rock3', { w: 2, col2: 'rock1', smooth: false });
    c.px(-1, -0.5, 'mud0'); c.px(1, -0.5, 'mud0'); c.px(0, -0.5, 'rock2');
  });
  g.outline();
  return g;
}

// ======================================================================
// HUD ICONS (16x16)
// ======================================================================
const ICONS = {
  heat: [[
    '................',
    '.......RR.......',
    '..R....RR....R..',
    '...R........R...',
    '................',
    '......HHYY......',
    '.....HHYYYY.....',
    '.RR..HYYYYY..RR.',
    '.RR..YYYYYO..RR.',
    '.....YYYYOO.....',
    '......YOOO......',
    '................',
    '...R........R...',
    '..R....RR....R..',
    '.......RR.......',
    '................',
  ], { R: 'fire0', Y: 'fire1', H: 'fire2', O: 'fire0' }],
  stamina: [[
    '................',
    '........HHHH....',
    '.......HYYY.....',
    '......HYYY......',
    '.....HYYY.......',
    '....HYYYYYYY....',
    '....OOOOYYYO....',
    '.......YYYO.....',
    '......YYYO......',
    '......YYO.......',
    '.....YYO........',
    '.....YO.........',
    '....YO..........',
    '....O...........',
    '................',
    '................',
  ], { H: 'gold2', Y: 'gold1', O: 'gold0' }],
  water: [[
    '................',
    '.......BB.......',
    '.......BB.......',
    '......BBBB......',
    '......BBBB......',
    '.....BBBBBB.....',
    '....BBBBBBBB....',
    '....BHBBBBBS....',
    '...BHHBBBBBBS...',
    '...BHBBBBBBBS...',
    '...BHBBBBBBSS...',
    '...BBBBBBBBSS...',
    '....BBBBBBSS....',
    '.....SSSSSS.....',
    '......SSSS......',
    '................',
  ], { B: 'water2', H: 'foam', S: 'water1' }],
  food: [[
    '................',
    '........MMMM....',
    '.......MHHMMM...',
    '......MHHMMMMM..',
    '......MHMMMMMM..',
    '......MMMMMMMS..',
    '......MMMMMMMS..',
    '.......MMMMMSS..',
    '......WMMMSSS...',
    '.....WWbSSS.....',
    '....WWb.........',
    '...WWb..........',
    '..WWb...........',
    '.WWWb...........',
    '.Wb.Wb..........',
    '................',
  ], { M: 'blood1', H: 'ochre1', S: 'blood', W: 'bone1', b: 'bone0' }],
  health: [[
    '................',
    '.....HT..HT.....',
    '.....TT..TT.....',
    '.....TT..TT.....',
    '..HT.TS..TS.HT..',
    '..TT........TT..',
    '..TT........TT..',
    '..TS........TS..',
    '......HTTT......',
    '.....HTTTTT.....',
    '....HTTTTTTT....',
    '....TTTTTTTS....',
    '....TTTTTTSS....',
    '.....SSSSSS.....',
    '................',
    '................',
  ], { H: 'fur3', T: 'fur2', S: 'fur1' }],
  hunter: [[
    '................',
    '.............pp.',
    '............pPp.',
    '............pp..',
    '....hhhh...b....',
    '...hHHHhh.w.....',
    '..hoooooow......',
    '..hhsSSkSS......',
    '..hhsSSSSSS.....',
    '...hsSSSSS......',
    '....sSSmS.......',
    '....wsSSs.......',
    '...w..ss........',
    '..w.............',
    '.w..............',
    '................',
  ], { h: 'mud1', H: 'mud2', o: 'ochre', S: 'skin3', s: 'skin2', k: 'ink', m: 'skin1', p: 'rock3', P: 'rock4', b: 'bone0', w: 'bark2' }],
};
function buildIcons() {
  const out = {};
  for (const k in ICONS) {
    const [rows, leg] = ICONS[k];
    const g = new Pix(16, 16, 0, 0);
    g.stamp(0, 0, rows, leg);
    g.outline({ col: 'ink', tint: false });
    out[k] = g.toCanvas();
  }
  return out;
}

// ======================================================================
export function build() {
  return {
    ostrich: buildOstrich(),
    fowl: buildFowl(),
    flamingo: buildFlamingo(),
    vulture: buildVulture(),
    carcass: buildCarcass(),
    carcassBones: buildBones(),
    smallCarcass: buildSmallCarcass(),
    spearStuck: cropAnim([1.8, -1.2, 0.5, 0].map(spearFrame)),
    icons: buildIcons(),
  };
}
void clamp;

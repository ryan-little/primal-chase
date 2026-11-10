// Hoofed prey: Thomson's gazelle (and its golden morph), plains zebra, blue wildebeest, warthog.
import { quadFrames, restPose, tailPts, spline, lerp, clamp, TAU } from './quad.js';
import { addColors, addRamp } from './pal.js';

addColors({
  gw0: '#a89a84', gw1: '#d2c6b0', gw2: '#f2ebdc', // gazelle white
  hornD: '#2a1c12', horn1: '#6a5640', horn2: '#a08c6c',
});
addRamp('gw', ['gw0', 'gw1', 'gw2'], 'olFur');
addRamp('horn', ['hornD', 'horn1', 'horn2'], 'ink');
addColors({ gnuD: '#262427', gnu0: '#3e3b3f', gnu1: '#5a5659', gnu2: '#787274', gnu3: '#968f8d' });
addRamp('gnu', ['gnuD', 'gnu0', 'gnu1', 'gnu2', 'gnu3'], 'ink');

// (x, y) against the neck line: [signed distance, + toward the throat side; 0..1 along the neck]
function neckSide(J, x, y) {
  const ax = J.neck[0], ay = J.neck[1], dx = J.head[0] - ax, dy = J.head[1] - ay, L = Math.hypot(dx, dy) || 1;
  return [-((x - ax) * dy - (y - ay) * dx) / L, ((x - ax) * dx + (y - ay) * dy) / (L * L)];
}

// ---------- gazelle ----------
// Heads are stamped before the outline; horns are thin enough that an outline would smother them,
// so they go on after it as a 1px overlay in the same frame (rings as lighter pixels).
const GZ_HEAD = {
  idle: { ax: 4, ay: 3, rows: [
    'Ee........',
    '.eebBb....',
    '..BBBBBb..',
    '..BBkwwBBb',
    '..BBBdddBn',
    '...BBBBBb.',
  ], horn: [
    '....h',
    '...o.',
    '...h.',
    '...o.',
    '....h',
  ] },
  run: { ax: 4, ay: 3, rows: [
    '..........',
    'EeebBb....',
    '..BBBBBb..',
    '..BBkwwBBb',
    '..BBBdddBn',
    '...BBBBBb.',
  ], horn: [
    '.....',
    '.oh..',
    '...o.',
    '...h.',
    '....o',
  ] },
  down: { ax: 1, ay: 1, rows: [
    'E....',
    '.eBb.',
    '.BBBb',
    '.BkBb',
    '.BBdb',
    '..Bdb',
    '..Bdb',
    '..BBn',
    '...n.',
  ], horn: [
    '.....h',
    '....o.',
    '...h..',
  ], hornRow: 0 },
  dead: { ax: 5, ay: 2, rows: [
    'E...bBBb..',
    '.eebBBBBBb',
    '..BBddBBBn',
    '...BBBBBb.',
  ], horn: [
    'hoho.',
  ], hornRow: -1 },
};
GZ_HEAD.blink = { ...GZ_HEAD.idle, rows: GZ_HEAD.idle.rows.map((r, i) => (i === 3 ? '..BBddwBBb' : r)) };
GZ_HEAD.downEar = { ...GZ_HEAD.down, rows: ['.E...', '.eBb.', ...GZ_HEAD.down.rows.slice(2)] };
GZ_HEAD.ear = { ...GZ_HEAD.idle, rows: ['.E.........', '..eBBb.....', ...GZ_HEAD.idle.rows.slice(2)] };
const GZ_LEG = { B: 'gaz2', b: 'gaz1', e: 'gaz3', E: 'gaz0', h: 'hornD', o: 'horn1', w: 'gw2', W: 'gw2', k: 'ink', d: 'spot', n: 'ink' };

// grazer poses shared by the gazelle family and the zebra
function headDownPose(sp, p, nib) {
  const P = restPose(sp), T = sp.tune || {}, b = Math.sin(p * TAU);
  P.hip = [0, 0.4];
  P.sh = [0.4, T.shDrop ?? 1.4];
  const fs = T.downFeet || [2.6, -0.8];
  P.feet.ff[0] = fs[0]; P.feet.nf[0] = fs[1];
  P.headAbs = [sp.sh[0] + P.sh[0] + (T.reach ?? 8), -(T.headLow ?? 6.5) + nib, 0];
  P.headDown = true;
  P.breath = b;
  return P;
}
function grazerPoses(extra = {}) {
  return {
    drink(sp, p) {
      // the muzzle dips and lifts a pixel as it laps
      return headDownPose(sp, p, Math.sin(p * TAU) > 0 ? 0 : -0.6);
    },
    // nibbling: the muzzle works at the grass, a short pull, the tail and an ear keep moving
    graze(sp, p) {
      const pull = spline([[0, 0], [0.2, 0.2], [0.35, -1.1], [0.5, 0], [0.7, 0.2], [0.85, -0.6], [1, 0]], p)[0];
      const P = headDownPose(sp, p, pull);
      P.ear = p >= 0.5 && p < 0.7;
      return P;
    },
    // on its side, legs out stiff fore and aft, neck flat and the head on the ground
    dead(sp) {
      const P = restPose(sp), T = sp.tune || {}, F = sp.front, Hd = sp.hind;
      const y = -(T.deadBody ?? 4.6);
      P.hip = [0, y - sp.hip[1]]; P.sh = [0, y - sp.sh[1] + 0.4];
      const fl = F.u + F.l + F.p, hl = Hd.u + Hd.l + Hd.p;
      P.feet = {
        ff: [fl * 0.1, -0.6, -1.5], nf: [fl * 0.2, -0.2, -1.45],
        fh: [-hl * 0.62, -3.4, -1.6], nh: [-hl * 0.78, -0.6, -1.5],
      };
      P.headAbs = [sp.sh[0] + (T.deadReach ?? 9), -(T.deadHead ?? 2.0), 0];
      P.deadPose = true;
      return P;
    },
    ...extra,
  };
}

// Pronking: a stiff-legged bounce straight up, all four hooves bunched, back arched, head up.
function stot(sp, p) {
  const P = restPose(sp);
  const air = Math.pow(Math.sin(p * Math.PI), 0.6);
  const h = 2.6 * air, straight = 1.4 * Math.min(1, air * 2);
  const squash = p === 0 ? 0.8 : 0;
  P.hip = [0.6, -h - straight + squash]; P.sh = [-0.4, -h - straight + squash];
  P.flex = 0.6 * air;
  P.feet = { ff: [1.4, -h, 0.1], nf: [-1.0, -h, 0.05], fh: [2.4, -h, 0.05], nh: [0.0, -h, 0.0] };
  P.head = [-0.4, -0.6 * air, 0];
  P.stot = true;
  return P;
}

// Bounding gallop for the slender antelopes: the forelegs fold less and unfold early so they reach
// out ahead of the chest; the hinds swing well under the belly in the gathered flight.
const sw = (ta, tb, mid) => [[0, -0.5, 0, tb], ...mid, [1, 0.5, 0, ta]];
const GZ_RUN = {
  flexAmp: 0.35,
  swingF: sw(0.3, -0.9, [[0.2, -0.6, -0.55, -1.25], [0.45, -0.05, -0.85, -0.7], [0.72, 0.5, -0.55, 0.35]]),
  swingH: sw(0.5, -0.5, [[0.2, -0.85, -0.45, -1.0], [0.5, -0.45, -0.85, -0.9], [0.78, 0.3, -0.7, -0.1]]),
};

export function gazelleSpec({ gold = false } = {}) {
  const C = { body: 'gaz2', far: 'gaz1', leg: 'gaz2', foot: 'spot', farFoot: 'spot' };
  const spec = {
    stage: { w: 96, h: 64, ax: 46, ay: 50 },
    foot: 'hoof',
    hip: [-5.4, -12.2], sh: [4.8, -12.6], depth: 3.3,
    front: { u: 3.0, l: 4.1, p: 4.7, w: [2.8, 1.7, 1.3, 1.2], x: 0.4, jy: 1.6, hoof: 1.2 },
    hind: { u: 4.2, l: 4.5, p: 4.7, w: [4.3, 2.2, 1.4, 1.2], x: -0.6, jy: 1.0, hoof: 1.2 },
    body: {
      croup: [-1.0, -3.4], rump: [-3.0, -0.8], butt: [-2.4, 2.4], groin: [2.6, 2.9], belly: 3.2, back: 3.4,
      brisket: [-0.8, 3.6], chest: [2.2, 1.0], throat: [2.2, -1.8], withers: [-0.6, -3.4],
      tail: [-2.8, -2.4], neck: [1.6, -2.0], arch: 1.2, sag: 0.3,
    },
    neckW: [3.0, 2.0], headRest: [5.0, -9.8], headBack: [-1.2, 1.6],
    headAt: { idle: [0, 0], walk: [0.8, 0.6], run: [3.6, 3.6] },
    stride: 6.2, lift: 1.9, runStride: 10.5, runLift: 3.2,
    stance: { ff: 1.8, nf: -1.2, fh: 1.6, nh: -1.4, toeF: 0.05, toeH: 0.15 },
    col: C, sep: 1,
    gaits: { run: GZ_RUN },
    tune: { headLow: 6.0, reach: 10, downFeet: [2.0, -1.2] },
    poses: grazerPoses({ stot }),
    draw: {
      // the neck meets the head at its back when it is up, at its crown when it is down
      behind(g, J, pose) {
        spec.headBack = pose.headDown ? [0.6, 1.2] : pose.deadPose ? [-2, -0.5] : [-1.2, 1.6];
        if (pose.headDown) J.neck = [J.S[0] + 2.2, J.S[1] - 0.8];
      },
    },
    coat(u, v, hex, x, y, J) {
      if (hex !== '#d49a58') return undefined;
      if (u > 1.05) { const [d, t] = neckSide(J, x, y); return d > 0 && t > 0.3 ? 'gw2' : undefined; } // white throat
      if (v > 0.45 && u > 0.08) return 'gw2';
      if (u < 0.02 && v > 0.1) return 'gw2'; // white rump patch
      return undefined;
    },
    marks(g, J) {
      // black flank stripe between the tan back and the white belly
      const a = J.at(0.12, 0.34), b = J.at(0.92, 0.38);
      g.pline(a[0], a[1], b[0], b[1], 'spot', true);
    },
    tail(g, J, pose) {
      const w = Math.sin(pose.p * TAU * 2);
      const run = pose.gait === 'run';
      const pts = tailPts(J.tail, 3, 1.3, (t) => (run ? 0.5 : 1.2) - w * 0.5 * t);
      g.chain(pts.map(([x, y]) => [x, y, 1.6]), 'spot');
    },
    head(g, x, y, ang, pose) {
      const k = pose.deadPose ? 'dead' : pose.headDown ? (pose.ear ? 'downEar' : 'down') : pose.gait === 'run' ? 'run' : pose.blink ? 'blink' : pose.ear ? 'ear' : 'idle';
      const H = GZ_HEAD[k];
      g.stamp(x, y, H.rows, GZ_LEG, { ax: H.ax, ay: H.ay });
      hornAt = [x, y, H];
    },
    finish(g) {
      const [x, y, H] = hornAt;
      g.stamp(x, y, H.horn, GZ_LEG, { ax: H.ax, ay: H.ay + H.horn.length - 1 - (H.hornRow ?? 0) });
      if (gold) g.remap((x, y, hex) => GOLD[hex]);
    },
  };
  let hornAt = null;
  return spec;
}
// golden morph: the tan ramp moves onto the gold ramp; whites, stripe and horns stay
const GOLD = { '#8e5a2c': 'gold0', '#b8783c': 'gold0', '#d49a58': 'gold1', '#e6b878': 'gold2', '#6a4020': 'gaz0' };

const GZ_SETS = [['idle', 6], ['walk', 8], ['run', 8], ['drink', 4], ['graze', 6], ['stot', 6], ['dead', 1]];


// ---------- zebra ----------
const ZB_HEAD = {
  idle: { ax: 3, ay: 3, rows: [
    '.EE......',
    '.eEE.....',
    'mmBdBB...',
    '.mBkdBB..',
    '..BBBBBB.',
    '...BBBBBn',
    '....BBnnn',
    '.....nnn.',
  ] },
  down: { ax: 2, ay: 1, rows: [
    'EE....',
    'eEE...',
    'mBBdB.',
    '.BkBB.',
    '.BBBdB',
    '..BdBB',
    '..BBBB',
    '..BBdB',
    '..Bnnn',
    '...nnn',
  ] },
  dead: { ax: 3, ay: 1, rows: [
    'EeBBdB....',
    '.BddBBBdB.',
    '..BBBdBBnn',
    '...BBBBnnn',
  ] },
};
ZB_HEAD.blink = { ...ZB_HEAD.idle, rows: ZB_HEAD.idle.rows.map((r, i) => (i === 3 ? '.mBddBB..' : r)) };
ZB_HEAD.downEar = { ...ZB_HEAD.down, rows: ['.E....', 'EeE...', ...ZB_HEAD.down.rows.slice(2)] };
ZB_HEAD.ear = { ...ZB_HEAD.idle, rows: ['EE........', '.eEE......', ...ZB_HEAD.idle.rows.slice(2)] };
ZB_HEAD.run = { ...ZB_HEAD.idle, rows: ['..........', 'EEeE......', ...ZB_HEAD.idle.rows.slice(2)] };
const ZB_LEG = { B: 'zeb1', d: 'zeb0', E: 'zeb0', e: 'zebG', m: 'zeb0', k: 'ink', n: 'zeb0' };

// Horizontal bands across a leg, spaced along its length so they ride with it.
function legBands(g, L, D, col, period, skipTop = 1.5) {
  const segs = [[L.a, L.b, D.w[0], D.w[1]], [L.b, L.c, D.w[1], D.w[2]], [L.c, L.d, D.w[2], D.w[3]]];
  let run = 0;
  for (const [a, b, w0, w1] of segs) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let t = (Math.ceil((run + skipTop) / period) * period - run) / (len || 1);
    while (t <= 1) {
      const x = lerp(a[0], b[0], t), y = lerp(a[1], b[1], t), w = lerp(w0, w1, t) / 2 + 0.5;
      if (y < L.d[1] - 1.9) g.pline(x - w, y, x + w, y, col, true); // stop short of the hoof
      t += period / (len || 1);
    }
    run += len;
  }
}

export function zebraSpec() {
  const C = { body: 'zeb1', far: 'zebG', leg: 'zeb1', foot: 'zeb0', farFoot: 'zeb0' };
  const spec = {
    stage: { w: 110, h: 70, ax: 54, ay: 54 },
    foot: 'hoof',
    hip: [-6.6, -14.6], sh: [6.2, -14.8], depth: 4.3,
    front: { u: 3.6, l: 5.0, p: 4.8, w: [3.8, 2.3, 1.7, 1.6], x: 0.4, jy: 2.0, hoof: 1.6 },
    hind: { u: 4.8, l: 5.4, p: 5.0, w: [5.4, 2.7, 1.7, 1.6], x: -0.8, jy: 1.2, hoof: 1.6 },
    body: {
      croup: [-1.2, -4.3], rump: [-4.2, -1.0], butt: [-3.4, 3.0], groin: [3.0, 3.8], belly: 4.4, back: 4.1,
      brisket: [-0.6, 4.6], chest: [3.0, 1.4], throat: [3.0, -2.2], withers: [-0.8, -4.6],
      tail: [-3.9, -3.0], neck: [2.0, -2.8], arch: 1.0, sag: 0.4,
    },
    neckW: [5.4, 3.6], headRest: [6.0, -8.0], headBack: [-1.6, 1.2],
    headAt: { idle: [0, 0], walk: [0.6, 0.8], run: [2.6, 2.8] },
    stride: 7, lift: 2.2, runStride: 12, runLift: 3.6,
    stance: { ff: 1.8, nf: -1.4, fh: 1.6, nh: -1.6, toeF: 0.05, toeH: 0.15 },
    col: C, sep: 1,
    gaits: { run: { ...GZ_RUN, flexAmp: 0.3 } },
    tune: { headLow: 8.6, reach: 9, downFeet: [3.0, -1.2], deadReach: 10 },
    poses: grazerPoses(),
    draw: {
      behind(g, J, pose) {
        spec.headBack = pose.headDown ? [0.6, 1.0] : pose.deadPose ? [-2, -0.5] : [-1.6, 1.2];
        if (pose.headDown) J.neck = [J.S[0] + 2.6, J.S[1] - 1.0];
      },
      // the near thigh and shoulder carry the body's stripes, so the pattern runs on across them
      nearLegs(c, J) {
        c.remap((x, y, hex) => {
          if (hex !== '#ece6d6') return undefined;
          const [u, v] = J.uv(x, y);
          return v < 0.85 && zebStripe(u, v) ? 'zeb0' : undefined;
        });
      },
      // the upright mane: a short crest along the top of the neck, banded like the coat
      body(c, J) {
        const hb = [J.head[0] + spec.headBack[0], J.head[1] + spec.headBack[1]];
        const n0 = [J.S[0] - 0.4, J.S[1] - 4.4], n1 = [hb[0] - 0.6, hb[1] - 1.8];
        c.limb(n0[0], n0[1], n1[0], n1[1], 2.2, 2.0, 'zeb1');
      },
    },
    // Stripes live in body space: upright bands on the barrel that sweep back into diagonals and then
    // flat bands over the haunch, so they flex with the spine and never crawl across it.
    coat(u, v, hex, x, y, J) {
      if (hex !== '#ece6d6') return undefined;
      if (u > 1.08) {
        // bands that wrap the neck read as near-upright in profile
        return frac((x - J.neck[0]) * 0.36 - (y - J.neck[1]) * 0.12 + 0.2) < 0.4 ? 'zeb0' : undefined;
      }
      return zebStripe(u, v) ? 'zeb0' : undefined;
    },
    legMarks(g, L, D) { legBands(g, L, D, 'zeb0', 2.1, 3.2); },
    tail(g, J, pose) {
      const w = Math.sin(pose.p * TAU), run = pose.gait === 'run';
      const pts = tailPts(J.tail, 5, 1.6, (t) => (run ? 0.35 + 0.3 * t : 1.05 + 0.2 * t) + w * 0.25 * t);
      g.chain(pts.map(([x, y], i) => [x, y, i < 4 ? 1.4 : 2.2]), 'zeb1');
      g.flush();
      g.px(pts[2][0], pts[2][1], 'zeb0', true);
      const a = pts[4], b = pts[5];
      g.limb(a[0], a[1], b[0] + (b[0] - a[0]) * 0.4, b[1] + (b[1] - a[1]) * 0.4, 2.0, 1.6, 'zeb0');
    },
    head(g, x, y, ang, pose) {
      const k = pose.deadPose ? 'dead' : pose.headDown ? (pose.ear ? 'downEar' : 'down') : pose.gait === 'run' ? 'run' : pose.blink ? 'blink' : pose.ear ? 'ear' : 'idle';
      const H = ZB_HEAD[k];
      g.stamp(x, y, H.rows, ZB_LEG, { ax: H.ax, ay: H.ay });
    },
  };
  return spec;
}
const frac = (x) => x - Math.floor(x);
function zebStripe(u, v) {
  if (v > 0.92 && u > 0.2 && u < 0.92) return false; // pale belly line
  const s = clamp((0.42 - u) / 0.4, 0, 1); // 0 on the barrel, 1 at the back of the haunch
  const f = (u * 4.8 + v * 0.25) * (1 - s) + (2.0 - v * 1.6 + u * 1.2) * s;
  return frac(f) < 0.4;
}
const ZB_SETS = [['idle', 6], ['walk', 8], ['run', 8], ['graze', 6], ['dead', 1]];

// ---------- wildebeest ----------
// The wildebeest head hangs nearly vertical off a short maned neck: a long dark face, a broad muzzle
// and a beard under the jaw. Horns go on after the outline as a thin pair spreading up from the crown.
const GN_HEAD = {
  idle: { ax: 2, ay: 1, rows: [
    'mmBBb...',
    'mEBBBb..',
    '.mBkBBb.',
    '..BBFFb.',
    '..dBFFB.',
    '..ddFFBb',
    '..ddFFFb',
    '...dFnnn',
    '...d.nnn',
  ], horn: [
    '.h...h.',
    'h.....h',
    'h.....h',
    '.h...h.',
    '..hhh..',
  ], hornRow: -1 },
  dead: { ax: 3, ay: 1, rows: [
    'mmBBBb.....',
    '.EBddBBFb..',
    '..BBBFFFnnn',
    '..dddFFFnnn',
  ], horn: [
    '.....h.',
    '......h',
    '......h',
    '....hh.',
  ], hornRow: 0 },
};
GN_HEAD.blink = { ...GN_HEAD.idle, rows: GN_HEAD.idle.rows.map((r, i) => (i === 2 ? '.mBdBBb.' : r)) };
const GN_LEG = { B: 'gnu1', b: 'gnu2', F: 'gnu0', d: 'gnuD', m: 'gnuD', E: 'gnu0', k: 'ink', n: 'gnuD', h: 'gnuD', o: 'horn1' };

export function gnuSpec() {
  const C = { body: 'gnu2', far: 'gnu1', leg: 'gnu1', foot: 'gnuD', farFoot: 'gnuD' };
  const spec = {
    stage: { w: 104, h: 68, ax: 50, ay: 52 },
    foot: 'hoof',
    // high shoulders and a hump, the back falling away to light hindquarters
    hip: [-5.6, -12.4], sh: [5.0, -14.2], depth: 4.4,
    front: { u: 3.8, l: 4.8, p: 4.4, w: [4.4, 2.4, 1.7, 1.6], x: 0.4, jy: 2.2, hoof: 1.6 },
    hind: { u: 4.2, l: 4.8, p: 4.4, w: [4.6, 2.4, 1.6, 1.5], x: -0.6, jy: 1.0, hoof: 1.6 },
    body: {
      croup: [-1.0, -3.4], rump: [-3.4, -0.6], butt: [-2.6, 2.6], groin: [2.6, 3.2], belly: 4.0, back: 4.2,
      brisket: [-0.4, 5.4], chest: [3.4, 1.8], throat: [3.0, -1.6], withers: [-1.0, -5.8],
      tail: [-3.0, -2.6], neck: [2.4, -2.6], arch: 0.9, sag: 0.3,
    },
    neckW: [5.4, 4.2], headRest: [5.8, -1.4], headBack: [-0.8, 2.2],
    headAt: { idle: [0, 0], walk: [0.6, 0.8], run: [2.6, 2.4] },
    stride: 7, lift: 2.2, runStride: 12, runLift: 3.6,
    stance: { ff: 1.8, nf: -1.4, fh: 1.6, nh: -1.4, toeF: 0.05, toeH: 0.15 },
    col: C, sep: 1,
    gaits: { run: { ...GZ_RUN, flexAmp: 0.3 } },
    tune: { deadReach: 10 },
    poses: { dead: grazerPoses().dead },
    draw: {
      behind(g, J, pose) { spec.headBack = pose.deadPose ? [-2, -0.5] : [-0.8, 2.2]; },
      // dark mane along the top of the neck, running up onto the hump
      body(c, J) {
        const hb = [J.head[0] + spec.headBack[0], J.head[1] + spec.headBack[1]];
        c.limb(J.S[0] - 2.4, J.S[1] - 5.0, hb[0] - 0.6, hb[1] - 2.6, 1.8, 2.2, 'gnuD');
        // beard down the throat
        c.limb(J.S[0] + 3.2, J.S[1] + 1.0, hb[0] + 0.6, hb[1] + 3.0, 1.6, 1.8, 'gnuD');
      },
    },
    // brindling: a few darker upright bands over the neck and forequarters, fading out behind
    coat(u, v, hex, x, y, J) {
      if (hex !== '#787274') return undefined;
      if (u > 1.1) return frac((x - J.S[0]) * 0.42) < 0.3 ? 'gnu1' : undefined;
      if (u > 0.45 && v > -0.6 && v < 0.75 && frac(u * 5.4 + 0.3) < 0.3) return 'gnu1';
      if (v > 0.8) return 'gnu1'; // darker underside
      return undefined;
    },
    marks(g, J) {
      // dark saddle line over the hump
      const a = J.at(0.55, -0.98), b = J.at(1.0, -1.2);
      g.pline(a[0], a[1], b[0], b[1], 'gnu0', true);
    },
    tail(g, J, pose) {
      const w = Math.sin(pose.p * TAU), run = pose.gait === 'run';
      const pts = tailPts(J.tail, 6, 1.6, (t) => (run ? 0.25 + 0.25 * t : 1.15 + 0.15 * t) + w * 0.2 * t);
      g.chain(pts.map(([x, y], i) => [x, y, i < 3 ? 1.2 : 2.0]), 'gnuD');
    },
    head(g, x, y, ang, pose) {
      const H = pose.deadPose ? GN_HEAD.dead : pose.blink ? GN_HEAD.blink : GN_HEAD.idle;
      g.stamp(x, y, H.rows, GN_LEG, { ax: H.ax, ay: H.ay });
      hornAt = [x, y, H];
    },
    finish(g) {
      const [x, y, H] = hornAt;
      g.stamp(x, y, H.horn, GN_LEG, { ax: H.ax, ay: H.ay + H.horn.length - 1 - (H.hornRow ?? 0) });
    },
  };
  let hornAt = null;
  return spec;
}
const GN_SETS = [['idle', 4], ['walk', 8], ['run', 8], ['dead', 1]];

// ---------- warthog ----------
// A big flat head with a long snout and a broad dark disc at the end, warts that break the outline
// below the eye and on the cheek. The tusks are an overlay laid on after the outline so they stay
// thin, curving up out of the lip and back toward the eye.
const WH_HEAD = {
  idle: { ax: 1, ay: 3, rows: [
    '.E..........',
    'EeBB........',
    '.BBBBB......',
    '.BBBkBBw....',
    '..BBBBBBBB..',
    '..BBBBBBBBBn',
    '..BwBBBBBBBn',
    '...wBB..BBB.',
  ], tusk: [
    '............',
    '............',
    '............',
    '........t...',
    '.........t..',
    '.........t..',
    '........t...',
    '............',
  ] },
  dead: { ax: 1, ay: 1, rows: [
    'EeBBBBw.....',
    '.BBBddBBBB..',
    '..BwBBBBBBBn',
    '...wBB.BBBBn',
  ], tusk: [
    '........t...',
    '.........t..',
    '.........t..',
    '............',
  ] },
};
WH_HEAD.blink = { ...WH_HEAD.idle, rows: WH_HEAD.idle.rows.map((r, i) => (i === 3 ? '.BBBdBBw....' : r)) };
WH_HEAD.ear = { ...WH_HEAD.idle, rows: ['E...........', '.eBB........', ...WH_HEAD.idle.rows.slice(2)] };
const WH_LEG = { B: 'wart1', E: 'wart0', e: 'wart2', w: 'wart0', k: 'ink', d: 'wartD', n: 'wartD', t: 'bone1' };

export function warthogSpec() {
  const C = { body: 'wart1', far: 'wart0', leg: 'wart1', foot: 'wartD', farFoot: 'wartD' };
  const spec = {
    stage: { w: 84, h: 56, ax: 40, ay: 44 },
    foot: 'hoof',
    hip: [-4.6, -8.2], sh: [4.2, -8.8], depth: 3.6,
    front: { u: 2.4, l: 3.0, p: 2.6, w: [3.6, 2.2, 1.7, 1.6], x: 0.4, jy: 1.6, hoof: 1.5 },
    hind: { u: 3.0, l: 3.0, p: 2.6, w: [4.4, 2.4, 1.7, 1.6], x: -0.4, jy: 1.0, hoof: 1.5 },
    body: {
      croup: [-0.6, -3.6], rump: [-3.2, -0.6], butt: [-2.6, 2.6], groin: [2.2, 3.4], belly: 3.9, back: 3.8,
      brisket: [-0.2, 4.0], chest: [2.6, 1.4], throat: [2.4, -1.8], withers: [-0.4, -4.0],
      tail: [-2.8, -3.0], neck: [1.6, -0.8], arch: 0.6, sag: 0.2,
    },
    neckW: [6.0, 5.4], headRest: [4.6, -0.4], headBack: [-1.0, 0.4],
    headAt: { idle: [0, 0], walk: [0.4, 0.4], trot: [0.8, 0.6] },
    stride: 5, lift: 1.5,
    stance: { ff: 1.4, nf: -1.0, fh: 1.2, nh: -1.0, toeF: 0.05, toeH: 0.15 },
    col: C, sep: 1,
    gaits: { trot: { stride: 1.3, lift: 1.5, bob: 0.6 } },
    tune: { deadReach: 7, deadBody: 3.6 },
    poses: { dead: grazerPoses().dead },
    draw: {
      behind(g, J, pose) { spec.headBack = pose.deadPose ? [-1.6, -0.2] : [-1.0, 0.4]; },
    },
    coat(u, v, hex) {
      if (hex !== '#7a6250') return undefined;
      if (v > 0.8) return 'wart0'; // shadowed underside
      return undefined;
    },
    marks(g, J) {
      // the dorsal mane: a dark crest on the spine, standing tallest over the nape and shoulders
      const tall = [2, 2, 1, 2, 1, 1, 0, 1, 0];
      for (let i = 0; i < tall.length; i++) {
        const [x, y] = J.at(1.12 - i * 0.12, -1.0);
        g.px(x, y + 1, 'mane', true);
        for (let k = 0; k <= tall[i]; k++) g.px(x, y - k, k === tall[i] ? 'maneD' : 'mane');
      }
    },
    // the tail is a 1px line with a tuft, drawn after the outline (see finish)
    tail(g, J, pose) {
      const up = pose.gait === 'trot', low = pose.deadPose;
      const w = Math.sin(pose.p * TAU * 2);
      // straight up like an antenna when it runs, hanging and swishing otherwise
      tailAt = tailPts(J.tail, 4, 1.4, (t) => (low ? 0.2 : up ? -1.5 + 0.12 * w * t : 1.2 + 0.4 * w * t));
    },
    head(g, x, y, ang, pose) {
      const H = pose.deadPose ? WH_HEAD.dead : pose.blink ? WH_HEAD.blink : pose.ear ? WH_HEAD.ear : WH_HEAD.idle;
      g.stamp(x, y, H.rows, WH_LEG, { ax: H.ax, ay: H.ay });
      headAt = [x, y, H];
    },
    finish(g) {
      const [x, y, H] = headAt;
      g.stamp(x, y, H.tusk, WH_LEG, { ax: H.ax, ay: H.ay });
      const P = tailAt;
      for (let i = 0; i < P.length - 1; i++) g.pline(P[i][0], P[i][1], P[i + 1][0], P[i + 1][1], 'wartD');
      const e = P[P.length - 1], d = P[P.length - 2];
      g.px(e[0] + (e[0] - d[0]) * 0.6, e[1] + (e[1] - d[1]) * 0.6, 'maneD');
    },
  };
  return spec;
}
let headAt = null, tailAt = null;
const WH_SETS = [['idle', 4], ['walk', 8], ['run', 8, 'trot'], ['dead', 1]];

export function build() {
  return {
    gazelle: quadFrames(gazelleSpec(), GZ_SETS),
    golden: quadFrames(gazelleSpec({ gold: true }), GZ_SETS),
    zebra: quadFrames(zebraSpec(), ZB_SETS),
    gnu: quadFrames(gnuSpec(), GN_SETS),
    warthog: quadFrames(warthogSpec(), WH_SETS),
  };
}

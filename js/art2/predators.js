// Predators and small game: the hunters' wild dogs, hyena, lion, hyrax, hare and the river croc.
import { quadFrames, restPose, POSES, tailPts, lerp, clamp, TAU } from './quad.js';
import { Pix, cropFrames, ik } from './pix.js';
import { addColors, addRamp } from './pal.js';

addColors({
  // wild dog: tan, black and white patches over the dog base
  wdT0: '#5e4122', wdT1: '#8a6230', wdT2: '#b48446', wdT3: '#d4a866',
  wdK0: '#1e1813', wdK1: '#30271e', wdK2: '#4a3d30',
  wdW0: '#9a8e78', wdW1: '#c9bfa8', wdW2: '#ebe3d0',
});
addRamp('wdT', ['wdT0', 'wdT1', 'wdT2', 'wdT3'], 'olFur');
addRamp('wdK', ['wdK0', 'wdK1', 'wdK2'], 'ink');
addRamp('wdW', ['wdW0', 'wdW1', 'wdW2'], 'olRock');

// ---------- helpers ----------
const inEll = (u, v, cu, cv, ru, rv) => ((u - cu) / ru) ** 2 + ((v - cv) / rv) ** 2 <= 1;

// ================= WILD DOG =================
const DOGH = {
  idle: [
    '.E.ee.....',
    'EEeiie....',
    'EEeiie....',
    '.Eeiie....',
    '..eeTTt...',
    '.TTTTTTt..',
    'TTTkTKMMM.',
    'tTTTKMMMMn',
    '.ttWMMmm..',
    '..WW......',
  ],
  blink: [
    '.E.ee.....',
    'EEeiie....',
    'EEeiie....',
    '.Eeiie....',
    '..eeTTt...',
    '.TTTTTTt..',
    'TTTKTKMMM.',
    'tTTTKMMMMn',
    '.ttWMMmm..',
    '..WW......',
  ],
  ear: [
    '..........',
    'E.eee.....',
    'EEeiie....',
    '.Eeiie....',
    '..eeTTt...',
    '.TTTTTTt..',
    'TTTkTKMMM.',
    'tTTTKMMMMn',
    '.ttWMMmm..',
    '..WW......',
  ],
  // ears laid back, jaws open: running, pouncing, barking
  snarl: [
    '..........',
    '..........',
    'Eee.......',
    'eiiee.....',
    '.eeiTTt...',
    '.TTTTTTt..',
    'TTTkTKMMM.',
    'tTTTKMMMMn',
    '.ttWMwrw..',
    '..WWMrr...',
    '....MMw...',
  ],
  down: [
    '.E.ee.....',
    'EEeiie....',
    'EEeiie....',
    '.Eeiie....',
    '..eeTTt...',
    '.TTTTTTt..',
    'TTTTTTKM..',
    'tTTTkTKMM.',
    '.ttTKMMMM.',
    '..WWMMMMn.',
  ],
  dead: [
    '..........',
    '..........',
    'Eee.......',
    'eiiee.....',
    '.eeiTTt...',
    '.TTTTTTt..',
    'TTTmTKMMM.',
    'tTTTKMMMMn',
    '.ttWMMwm..',
    '..WW......',
  ],
};
const DOGL = { E: 'wdK0', e: 'wdK1', i: 'wdW1', T: 'wdT2', t: 'wdT1', K: 'wdK2', M: 'wdK1', m: 'wdK0', k: 'ink', n: 'ink', W: 'wdW1', w: 'bone1', r: 'blood' };

function dogSpec() {
  // patches in body space: [u, v, ru, rv, color]. Black saddle, tan flanks, a few white splashes.
  const patches = [
    [0.62, -0.7, 0.07, 0.3, 'wdW1'], [0.2, 0.45, 0.07, 0.3, 'wdW1'], [-0.1, -0.5, 0.06, 0.3, 'wdW1'], [0.92, 0.6, 0.07, 0.3, 'wdW1'],
    [0.38, -0.45, 0.2, 0.5, 'wdK1'], [0.78, -0.1, 0.12, 0.6, 'wdK1'], [0.0, 0.1, 0.12, 0.55, 'wdK1'],
    [0.5, 0.55, 0.12, 0.35, 'wdK1'], [1.05, -0.6, 0.12, 0.4, 'wdK1'],
  ];
  const spec = {
    stage: { w: 90, h: 60, ax: 44, ay: 46 },
    hip: [-6, -10.4], sh: [5.4, -10.8], depth: 3.0,
    front: { u: 3.8, l: 4.2, p: 2.4, w: [2.6, 1.8, 1.3, 1.2], x: 0.4, jy: 1.0, paw: [1.1, 0.8] },
    hind: { u: 4.4, l: 4.6, p: 3.0, w: [3.2, 2.0, 1.3, 1.2], x: -1.0, jy: 0.8, paw: [1.1, 0.8] },
    body: {
      croup: [-1.2, -2.6], rump: [-3.2, -0.4], butt: [-2.6, 2.0], groin: [2.6, 1.8], belly: 2.8, back: 2.8,
      brisket: [-1.0, 3.4], chest: [2.8, 0.8], throat: [2.6, -1.4], withers: [-0.6, -2.6],
      tail: [-3.0, -1.6], neck: [1.4, -1.2], arch: 1.4, sag: 0.4,
    },
    neckW: [3.6, 2.8], headRest: [5.8, -3.4], headBack: [-1.6, 0.8],
    headAt: { idle: [0, 0], walk: [0.6, 1.2], run: [1.4, 2.6], trot: [0.8, 1.4] },
    stride: 7, lift: 2.0, runStride: 12, runLift: 4.0,
    stance: { ff: 2.4, nf: -1.2, fh: 2.6, nh: -1.2, toeH: 0.2 },
    col: { body: 'dog2', far: 'wdT0', leg: 'wdT2', foot: 'wdK1', farFoot: 'wdK0' },
    coat(u, v, hex) {
      if (hex !== '#8e7a62') return undefined;
      for (const [cu, cv, ru, rv, c] of patches) if (inEll(u, v, cu, cv, ru, rv)) return c;
      return 'wdT2';
    },
    legMarks(g, L) {
      // a black patch high on each near leg and a white sock
      if (L.far) return;
      g.px(lerp(L.a[0], L.b[0], 0.5), lerp(L.a[1], L.b[1], 0.5), 'wdK1', true);
      g.px(lerp(L.b[0], L.c[0], 0.6), lerp(L.b[1], L.c[1], 0.6), 'wdK1', true);
      g.px(lerp(L.c[0], L.d[0], 0.5), lerp(L.c[1], L.d[1], 0.5), 'wdW1', true);
    },
    tail(g, J, pose) {
      const gt = pose.gait, w = Math.sin(pose.p * TAU);
      let ang;
      if (gt === 'run' || gt === 'pounce') ang = (t) => 0.2 - 0.5 * t + w * 0.12 * t;
      else if (gt === 'dead') ang = (t) => 0.3 - 0.2 * t;
      else ang = (t) => 1.0 - 0.1 * t + w * 0.15 * t;
      const n = 5, pts = tailPts(J.tail, n, 1.5, ang);
      if (gt === 'dead') for (const q of pts) q[1] = Math.min(q[1], -1.2);
      g.chain(pts.map(([x, y], i) => [x, y, [1.5, 1.8, 2.1, 2.3, 2.2, 1.6][i]]), 'wdT1');
      g.flush();
      // black band, then the white flag at the tip
      g.limb(pts[2][0], pts[2][1], pts[3][0], pts[3][1], 2.1, 2.3, 'wdK1');
      g.limb(pts[4][0], pts[4][1], pts[5][0], pts[5][1], 2.0, 1.4, 'wdW2');
    },
    head(g, x, y, ang, pose) {
      const gt = pose.gait;
      let rows = DOGH.idle;
      if (gt === 'dead') rows = DOGH.dead;
      else if (pose.mouth) rows = DOGH.snarl;
      else if (pose.headDown) rows = DOGH.down;
      else if (pose.blink) rows = DOGH.blink;
      else if (pose.ear) rows = DOGH.ear;
      g.stamp(x, y, rows, DOGL, { ax: 2, ay: 6 });
    },
    poses: {
      // head thrown up and forward, mouth open on the bark beat
      bark(sp, p) {
        const P = restPose(sp), b = Math.sin(p * TAU);
        P.head = [0.6 + Math.max(0, b) * 0.8, -0.4 - Math.max(0, b) * 1.2, 0];
        P.sh = [0, Math.max(0, b) * 0.4];
        P.mouth = p >= 0.2 && p < 0.55;
        P.breath = b;
        return P;
      },
    },
  };
  return spec;
}
const DOG_SETS = [['idle', 4], ['walk', 8], ['run', 8], ['pounce', 5], ['bark', 4], ['dead', 1]];

// ================= SPOTTED HYENA =================
const HYH = {
  idle: [
    'ee..ee.....',
    'eie.eie....',
    '.eBBBBB....',
    'BBBBBBBBb..',
    'BBBBkBBBMM.',
    'BBBBBBMMMMn',
    'bBBBBMMMMm.',
    '.bBBMMMmm..',
    '..bbbMM....',
  ],
  blink: [
    'ee..ee.....',
    'eie.eie....',
    '.eBBBBB....',
    'BBBBBBBBb..',
    'BBBBmBBBMM.',
    'BBBBBBMMMMn',
    'bBBBBMMMMm.',
    '.bBBMMMmm..',
    '..bbbMM....',
  ],
  ear: [
    '.....ee....',
    'ee..eie....',
    'eieeBBB....',
    'BBBBBBBBb..',
    'BBBBkBBBMM.',
    'BBBBBBMMMMn',
    'bBBBBMMMMm.',
    '.bBBMMMmm..',
    '..bbbMM....',
  ],
  snarl: [
    '...........',
    'ee..ee.....',
    'eieeieB....',
    'BBBBBBBBb..',
    'BBBBkBBBMM.',
    'BBBBBBMMMMn',
    'bBBBBMtrtm.',
    '.bBBMMrr...',
    '..bbbMMt...',
  ],
  down: [
    'ee..ee...',
    'eie.eie..',
    '.eBBBBB..',
    'BBBBBBBB.',
    'BBBBBBBB.',
    'BBBBkBBBb',
    'bBBBBBBMM',
    '.bBBBMMMM',
    '..bbMMMMm',
    '....MMMn.',
  ],
  tug: [
    'ee..ee...',
    'eie.eie..',
    '.eBBBBB..',
    'BBBBBBBB.',
    'BBBBBBBB.',
    'BBBBkBBBb',
    'bBBBBBBMM',
    '.bBBBMMMM',
    '..bbMMrMm',
    '....MrMn.',
    '.....r...',
  ],
  dead: [
    '...........',
    'ee..ee.....',
    'eieeieB....',
    'BBBBBBBBb..',
    'BBBBmBBBMM.',
    'BBBBBBMMMMn',
    'bBBBBMMtmm.',
    '.bBBMMMm...',
    '..bbbMM....',
  ],
};
const HYL = { e: 'mud0', i: 'mud1', B: 'sand2', b: 'sand1', M: 'mud1', m: 'mud0', k: 'ink', n: 'ink', t: 'bone1', r: 'blood' };

function hyenaSpec() {
  // spots in body space: denser on the hindquarters and flank, none on the throat
  const spots = [
    [-0.1, -0.35], [0.05, 0.05], [-0.05, 0.45], [0.15, -0.6], [0.2, -0.2], [0.25, 0.3], [0.35, -0.45],
    [0.4, 0.0], [0.45, 0.45], [0.55, -0.3], [0.6, 0.15], [0.7, -0.5], [0.75, 0.0], [0.85, 0.35], [0.9, -0.25],
  ];
  const spec = {
    stage: { w: 96, h: 64, ax: 46, ay: 48 },
    hip: [-6.4, -10.2], sh: [6.0, -13.4], depth: 3.4,
    front: { u: 5.2, l: 5.0, p: 2.6, w: [4.0, 2.6, 1.8, 1.7], x: 0.6, jy: 1.4, paw: [1.3, 0.9] },
    hind: { u: 4.4, l: 4.4, p: 3.2, w: [4.6, 2.6, 1.7, 1.6], x: -1.0, jy: 0.6, paw: [1.3, 0.9] },
    body: {
      croup: [-0.8, -2.0], rump: [-2.8, -0.2], butt: [-2.2, 2.0], groin: [2.6, 2.4], belly: 3.2, back: 3.0,
      brisket: [-1.6, 4.4], chest: [3.2, 1.0], throat: [3.4, -1.8], withers: [-0.6, -3.6],
      tail: [-3.0, -1.4], neck: [1.8, -1.0], arch: 1.2, sag: 0.3,
    },
    neckW: [5.6, 4.6], headRest: [6.4, -1.6], headBack: [-2.2, 0.4],
    headAt: { idle: [0, 0], walk: [0.6, 1.0], run: [1.2, 1.2], trot: [0.8, 1.0] },
    stride: 7.4, lift: 2.0, runStride: 11.5, runLift: 3.2,
    stance: { ff: 2.4, nf: -1.2, fh: 2.4, nh: -1.0, toeH: 0.3 },
    tune: { crouch: 0.45 },
    col: { body: 'sand1', far: 'sand0', leg: 'sand1', foot: 'mud1', farFoot: 'mud0' },
    gaits: { run: { flexAmp: 0.6, bobAmp: 1.3, tuck: 1.0 } },
    coat(u, v, hex) {
      if (hex !== '#cfa36b') return undefined;
      if (v > 0.6 && u < 0.95) return 'sand2';
      return undefined;
    },
    draw: {
      // the bristly dark crest from the nape over the withers
      body(g, J) {
        const a = J.at(1.25, -0.95), b = J.at(0.85, -1.05), c = J.at(0.45, -1.0);
        g.curve([a, b, c], 1.3, 'mud1');
      },
    },
    marks(g, J) {
      spots.forEach(([u, v], i) => {
        const [x, y] = J.at(u, v);
        g.px(x, y, 'mud0', true);
        if (i % 3 === 0) g.px(x + 1, y, 'mud0', true);
      });
    },
    legMarks(g, L) {
      if (L.far) return;
      g.px(lerp(L.a[0], L.b[0], 0.45), lerp(L.a[1], L.b[1], 0.45), 'mud0', true);
      g.px(lerp(L.b[0], L.c[0], 0.4), lerp(L.b[1], L.c[1], 0.4), 'mud0', true);
    },
    tail(g, J, pose) {
      const gt = pose.gait, w = Math.sin(pose.p * TAU);
      let ang;
      if (gt === 'run' || gt === 'pounce') ang = (t) => 0.5 - 0.6 * t + w * 0.15;
      else if (gt === 'dead') ang = (t) => 0.3;
      else ang = (t) => 1.05 - 0.1 * t + w * 0.08;
      const n = 3, pts = tailPts(J.tail, n, 1.7, ang);
      if (gt === 'dead') for (const q of pts) q[1] = Math.min(q[1], -1.2);
      g.chain(pts.map(([x, y], i) => [x, y, [1.4, 1.6, 2.0, 2.0][i]]), 'sand0');
      g.flush();
      g.limb(pts[2][0], pts[2][1], pts[3][0], pts[3][1], 2.0, 1.8, 'mudD');
    },
    head(g, x, y, ang, pose) {
      const gt = pose.gait;
      let rows = HYH.idle;
      if (gt === 'dead') rows = HYH.dead;
      else if (pose.mouth) rows = HYH.snarl;
      else if (pose.headDown) rows = pose.tug > 0.5 ? HYH.tug : HYH.down;
      else if (pose.blink) rows = HYH.blink;
      else if (pose.ear) rows = HYH.ear;
      g.stamp(x, y, rows, HYL, { ax: 2, ay: 4 });
      if (gt === 'drink' && pose.tug > 0.5) g.px(x + 3.5, y + 7.5, 'blood');
    },
    poses: {
      // feeding stands up, unlike a cat: forelegs braced, head down at the carcass, tugging back
      drink(sp, p) {
        const P = restPose(sp), tug = Math.max(0, Math.sin(p * TAU));
        P.hip = [0, 0.4 + tug * 0.3];
        P.sh = [-tug * 1.0, 2.6 - tug * 0.8];
        P.feet.ff = [1.2, 0, 0.3]; P.feet.nf = [-0.6, 0, 0.3]; P.feet.nh = [-0.4, 0, 0.38]; P.feet.fh = [1.0, 0, 0.38];
        P.headAbs = [sp.sh[0] + P.sh[0] + 7.8 - tug * 1.0, -4.6 - tug * 1.4, 0];
        P.headDown = true;
        P.tug = tug;
        return P;
      },
    },
  };
  return spec;
}
const HYENA_SETS = [['idle', 4], ['walk', 8], ['run', 8], ['drink', 4], ['dead', 1]];

// ================= LION =================
const LIONH = {
  idle: [
    '...BBB.......',
    '..BBBBBB.....',
    '.BBdddBBBB...',
    'BBBBkdBBBBB..',
    'BBBBBBBLLLnn.',
    'BBBBBLLLLLLn.',
    'BBBBLWWWWWW..',
    '.BBBLWWWWWd..',
    '..BBdWWWWd...',
  ],
  blink: [
    '...BBB.......',
    '..BBBBBB.....',
    '.BBdddBBBB...',
    'BBBBddBBBBB..',
    'BBBBBBBLLLnn.',
    'BBBBBLLLLLLn.',
    'BBBBLWWWWWW..',
    '.BBBLWWWWWd..',
    '..BBdWWWWd...',
  ],
  snarl: [
    '...BBB.......',
    '..BBBBBB.....',
    '.BBdddBBBB...',
    'BBBBkdBBBBB..',
    'BBBBBBBLLLnn.',
    'BBBBBLLLLLLn.',
    'BBBBLWWtWWt..',
    '.BBBLrrrrr...',
    '..BBdWtWWt...',
    '....dWWWd....',
  ],
  roar: [
    '...BBB.......',
    '..BBBBBB.....',
    '.BBdddBBBB...',
    'BBBBkdBBBBBnn',
    'BBBBBBLLLLLLn',
    'BBBBBLLWtWWt.',
    'BBBBLrrrrr...',
    '.BBBLrrrr....',
    '..BBLrrrrt...',
    '...BdWWtWWt..',
    '....dWWWWW...',
  ],
  down: [
    '...BBB......',
    '..BBBBBB....',
    '.BBdddBBB...',
    'BBBBBBBBBB..',
    'BBBBkdBBLL..',
    'BBBBBBLLLLL.',
    'BBBBBLLLLLL.',
    '.BBBLWWWWWn.',
    '..BBdWWWWWn.',
    '....ddddd...',
  ],
  dead: [
    '...BBB.......',
    '..BBBBBB.....',
    '.BBdddBBBB...',
    'BBBBddBBBBB..',
    'BBBBBBBLLLnn.',
    'BBBBBLLLLLLn.',
    'BBBBLWWWWWW..',
    '.BBBLWWrWWd..',
    '..BBdWWWWd...',
  ],
};
const LIONL = { B: 'lion1', L: 'lion2', W: 'lion3', d: 'lion0', k: 'ink', n: 'maneD', t: 'bone1', r: 'blood' };

function lionSpec() {
  const spec = {
    stage: { w: 170, h: 96, ax: 84, ay: 74 },
    hip: [-10.5, -13.4], sh: [10, -14], depth: 4.6,
    front: { u: 5.4, l: 5.6, p: 3.0, w: [5.8, 4.0, 3.0, 2.8], x: 0.6, jy: 1.6, paw: [2.0, 1.3] },
    hind: { u: 6.2, l: 6.0, p: 4.4, w: [7.6, 4.2, 2.8, 2.6], x: -1.6, jy: 1.0, paw: [2.0, 1.3] },
    body: {
      croup: [-1.8, -4.4], rump: [-5.4, -0.6], butt: [-4.2, 4.0], groin: [4.0, 3.8], belly: 5.0, back: 4.8,
      brisket: [-1.6, 6.8], chest: [4.6, 1.8], throat: [4.8, -2.4], withers: [-0.8, -4.8],
      tail: [-4.6, -2.6], neck: [2.2, -1.8], arch: 2.0, sag: 0.6,
    },
    neckW: [7.4, 6.4], headRest: [10, -5.6], headBack: [-3.4, 1.4],
    headAt: { idle: [0, 0], walk: [0.8, 1.6], run: [1.8, 2.4], trot: [1, 1.8] },
    stride: 11, lift: 3.0, runStride: 17, runLift: 5.4,
    stance: { ff: 3.8, nf: -1.8, fh: 4.0, nh: -1.8, toeH: 0.18 },
    tune: { lieHead: [0.6, -0.8] },
    col: { body: 'lion1', far: 'lion0', leg: 'lion1', foot: 'lion2', farFoot: 'lion0' },
    coat(u, v, hex) {
      if (hex !== '#c89648') return undefined;
      if (v > 0.7) return 'lion2';
      return undefined;
    },
    tail(g, J, pose) {
      const gt = pose.gait;
      const run = gt === 'run' || gt === 'pounce';
      const low = gt === 'lie' || gt === 'dead';
      const w = Math.sin(pose.p * TAU), w2 = Math.sin(pose.p * TAU - 1.2);
      let ang;
      if (run) ang = (t) => 0.25 - J.flex * 0.2 * (1 - t) - 0.4 * t * t + (w * (1 - t) + w2 * t) * 0.14;
      else if (low) ang = (t) => 0.4 - 0.4 * t - (t > 0.6 ? (t - 0.6) * (1.6 + w * 1.2) : 0);
      else ang = (t) => 1.15 - 0.5 * t - 1.0 * t * t * t + w2 * 0.2 * t * t; // hangs, curls up at the end
      const n = 8, pts = tailPts(J.tail, n, 2.3, ang);
      if (low) for (const q of pts) q[1] = Math.min(q[1], -1.4);
      g.chain(pts.map(([x, y], i) => [x, y, lerp(2.6, 1.6, i / n)]), 'lion1');
      g.flush();
      const tp = pts[n], tq = pts[n - 1];
      // the black tuft
      g.ell(lerp(tq[0], tp[0], 0.7), lerp(tq[1], tp[1], 0.7), 1.6, 1.4, 'maneD');
    },
    head(g, x, y, ang, pose) {
      const gt = pose.gait, b = pose.breath || 0;
      // the mane: a dark mass behind and below the face, a lighter fringe framing it
      g.ell(x - 3.2, y + 1.8, 6.4, 7.4 + b * 0.2, 'mane');
      g.ell(x - 3.6, y + 7.0, 4.6, 4.2, 'mane');
      g.ell(x - 0.6, y + 1.4, 4.6, 5.8, 'mane1');
      g.flush();
      for (const [dx, dy] of [[-9, -1], [-9, 3], [-8, 7], [-6, 11], [-2, 11], [-5, -5], [-1, -6]]) g.px(x + dx + 0.5, y + dy + 0.5, 'mane');
      g.remap((px, py) => (py > -0.6 ? null : undefined)); // the mane rests on the ground, not through it
      g.bevel({ up: 1, down: 1, only: ['mane', 'mane1'] });
      let rows = LIONH.idle, ay = 4;
      if (gt === 'dead') rows = LIONH.dead;
      else if (pose.roar) rows = LIONH.roar;
      else if (pose.mouth) rows = LIONH.snarl;
      else if (pose.headDown) rows = LIONH.down;
      else if (pose.blink) rows = LIONH.blink;
      g.stamp(x, y, rows, LIONL, { ax: 3, ay });
      // the ear tops just clear the mane
      if (!pose.roar && !pose.mouth) g.px(x - 0.5, y - 4.5, 'lion0');
    },
    poses: {
      // draws back, then throws the head forward and up with the jaws wide
      roar(sp, p) {
        const P = restPose(sp);
        const k = p < 0.3 ? p / 0.3 : p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25;
        P.head = [-0.8 + k * 2.2, 0.6 - k * 2.4, 0];
        P.sh = [k * 0.6, -k * 0.6];
        P.breath = k;
        P.roar = p >= 0.25 && p < 0.85;
        P.blink = p < 0.1;
        return P;
      },
    },
  };
  return spec;
}
const LION_SETS = [['idle', 6], ['walk', 8], ['run', 8], ['lie', 6], ['pounce', 5], ['roar', 6], ['dead', 1]];

// ================= ROCK HYRAX =================
addColors({ hyx0: '#4b3b2c', hyx1: '#6e5843', hyx2: '#8e765a', hyx3: '#ad9674', hyx4: '#cab592' });
addRamp('hyx', ['hyx0', 'hyx1', 'hyx2', 'hyx3', 'hyx4'], 'olRock');
const HYXH = {
  idle: ['.e....', 'eBBB..', 'BBkBB.', 'BBBBBn', '.bLL..'],
  blink: ['.e....', 'eBBB..', 'BBbBB.', 'BBBBBn', '.bLL..'],
  ear: ['e.....', 'eBBB..', 'BBkBB.', 'BBBBBn', '.bLL..'],
  down: ['.e....', 'eBBB..', 'BBBBB.', 'BBkBB.', '.bBBBn', '..LL..'],
  dead: ['.e....', 'eBBB..', 'BBbBB.', 'BBBBBn', '.bLL..'],
};
const HYXL = { e: 'hyx1', B: 'hyx2', b: 'hyx1', L: 'hyx3', k: 'ink', n: 'ink' };

function hyraxSpec() {
  return {
    stage: { w: 60, h: 40, ax: 30, ay: 30 },
    hip: [-3.4, -5.0], sh: [3.0, -4.8], depth: 2.8,
    front: { u: 1.8, l: 1.8, p: 1.2, w: [2.4, 1.6, 1.3, 1.2], x: 0.4, jy: 1.0, paw: [0.9, 0.6] },
    hind: { u: 2.0, l: 2.0, p: 1.6, w: [3.2, 1.8, 1.3, 1.2], x: -0.6, jy: 0.8, paw: [0.9, 0.6] },
    body: {
      croup: [-0.6, -3.0], rump: [-3.0, -0.6], butt: [-2.2, 2.2], groin: [2.0, 2.2], belly: 2.4, back: 3.4,
      brisket: [-0.6, 3.0], chest: [2.0, 0.8], throat: [2.0, -1.4], withers: [-0.6, -3.0],
      tail: [-2.6, 0], neck: [0.8, -0.6], arch: 1.0, sag: 0.2, round: 0.6,
    },
    neckW: [3.6, 3.2], headRest: [3.0, -1.4], headBack: [-1.2, 0.4],
    headAt: { idle: [0, 0], walk: [0.3, 0.4], run: [0.6, 0.6] },
    stride: 3.2, lift: 1.0, runStride: 5, runLift: 1.8,
    stance: { ff: 1.0, nf: -0.6, fh: 1.0, nh: -0.6, toeH: 0.3 },
    col: { body: 'hyx2', far: 'hyx1', leg: 'hyx2', foot: 'hyx1', farFoot: 'hyx0' },
    coat(u, v, hex) {
      if (hex !== '#8e765a') return undefined;
      if (v > 0.6) return 'hyx3';
      return undefined;
    },
    marks(g, J) {
      // the dark dorsal gland patch
      const [x, y] = J.at(0.35, -0.85);
      g.px(x, y, 'hyx0', true); g.px(x + 1, y, 'hyx0', true);
    },
    head(g, x, y, ang, pose) {
      const gt = pose.gait;
      let rows = HYXH.idle;
      if (gt === 'dead') rows = HYXH.dead;
      else if (pose.headDown) rows = HYXH.down;
      else if (pose.blink) rows = HYXH.blink;
      else if (pose.ear) rows = HYXH.ear;
      g.stamp(x, y, rows, HYXL, { ax: 1, ay: 2 });
    },
  };
}
const HYRAX_SETS = [['idle', 4], ['walk', 6], ['run', 6], ['dead', 1]];

// ================= SCRUB HARE =================
// Drawn directly: a hare's sit and bound don't fit the walking rig (hind legs fold flat under it,
// both hind feet move together and land ahead of the forefeet).
const HAREH = {
  sit: ['.BBB...', 'BBBBBB.', 'BBkLBBB', 'bBBBBBn', '.bWWW..'],
  blink: ['.BBB...', 'BBBBBB.', 'BBbbBBB', 'bBBBBBn', '.bWWW..'],
  run: ['.BBB...', 'BBBBBB.', 'BBkLBBB', 'bBBBBBn', '..WWW..'],
  dead: ['.BBB...', 'BBBBBB.', 'BBbbBBB', 'bBBBBBn', '.bWWW..'],
};
const HAREL = { B: 'hare2', b: 'hare1', L: 'hare3', W: 'hare3', k: 'ink', n: 'hareD' };
const HARE = { thigh: 3.0, shin: 3.0, foot: 3.4, upper: 2.4, lower: 2.6 };

function hareLegHind(g, H, toe, dir, col, thighW) {
  const d = Math.hypot(dir[0], dir[1]), ux = dir[0] / d, uy = dir[1] / d;
  const hock = [toe[0] - ux * HARE.foot, toe[1] - uy * HARE.foot];
  const [kx, ky] = ik(H[0], H[1], hock[0], hock[1], HARE.thigh, HARE.shin, 1);
  // the haunch: a round thigh mass, not a stick
  g.ell(lerp(H[0], kx, 0.45), lerp(H[1], ky, 0.45), thighW * 0.75, thighW * 0.62, col, Math.atan2(ky - H[1], kx - H[0]));
  g.limb(H[0], H[1], kx, ky, thighW * 0.7, 1.8, col);
  g.limb(kx, ky, hock[0], hock[1], 1.7, 1.2, col);
  g.limb(hock[0], hock[1], toe[0], toe[1], 1.3, 1.1, col);
}
function hareLegFore(g, S, paw, col) {
  const a = [S[0] + 0.4, S[1] + 1.0];
  const [ex, ey] = ik(a[0], a[1], paw[0], paw[1], HARE.upper, HARE.lower, -1);
  g.limb(a[0], a[1], ex, ey, 1.6, 1.2, col);
  g.limb(ex, ey, paw[0], paw[1], 1.2, 1.1, col);
}
function hareEar(g, base, a, col, len = 6.6) {
  const sx = -Math.sin(a), sy = -Math.cos(a);
  const tip = [base[0] + sx * len, base[1] + sy * len];
  g.limb(base[0], base[1], tip[0], tip[1], 1.9, 1.5, col);
  g.flush();
  // only the last pixel or two are black
  g.pline(base[0] + sx * (len - 1.0), base[1] + sy * (len - 1.0), tip[0], tip[1], 'wdK1', true);
}
// P: { H, S, arch, hN, hF: [toe, dir], fN, fF: paw, head: [dx, dy] from S, hv, ear: [near, far] angles, breath }
function drawHare(P) {
  const g = new Pix(44, 36, 22, 28);
  const { H, S } = P;
  const head = [S[0] + P.head[0], S[1] + P.head[1]];
  const earBase = [head[0] - 0.2, head[1] - 0.8];
  g.part((c) => {
    hareEar(c, [earBase[0] - 0.8, earBase[1] + 0.2], P.ear[1], 'hare0', 6.0);
    hareLegHind(c, H, P.hF[0], P.hF[1], 'hare0', 2.6);
    hareLegFore(c, S, P.fF, 'hare0');
  });
  g.part((c) => {
    // body: rump, back and chest around the hip and shoulder points
    const mx = (H[0] + S[0]) / 2, my = (H[1] + S[1]) / 2, ar = P.arch || 0, br = P.breath || 0;
    const dx = S[0] - H[0], dy = S[1] - H[1], L = Math.hypot(dx, dy), nx = dy / L, ny = -dx / L; // nx, ny: toward the back
    c.blob([
      [H[0] - dx / L * 2.4 + nx * 0.6, H[1] - dy / L * 2.4 + ny * 0.6],
      [H[0] + nx * 2.6, H[1] + ny * 2.6],
      [mx + nx * (2.6 + ar), my + ny * (2.6 + ar)],
      [S[0] + nx * 2.0, S[1] + ny * 2.0],
      [S[0] + dx / L * 2.0, S[1] + dy / L * 2.0],
      [S[0] - nx * (2.0 + br * 0.2), S[1] - ny * (2.0 + br * 0.2)],
      [mx - nx * (2.0 + br * 0.2), my - ny * (2.0 + br * 0.2)],
      [H[0] - nx * 2.4, H[1] - ny * 2.4],
    ], 'hare1');
    c.limb(S[0], S[1], head[0] - 0.6, head[1] + 0.6, 3.0, 2.6, 'hare1');
    c.remap((x, y) => {
      // pale belly and chest
      const v = ((x - mx) * -nx + (y - my) * -ny);
      return v > 1.3 ? 'hare2' : undefined;
    });
    c.bevel({ up: 1, down: 1 });
    // a dark saddle line of grizzled fur along the back
    c.px(mx + nx * (1.9 + ar), my + ny * (1.9 + ar), 'hare0', true);
    c.px(mx + nx * (1.9 + ar) - dx / L * 2, my + ny * (1.9 + ar) - dy / L * 2, 'hare0', true);
  });
  g.part((c) => {
    hareLegHind(c, H, P.hN[0], P.hN[1], 'hare1', 4.2);
    hareLegFore(c, S, P.fN, 'hare2');
    c.bevel({ up: 1, down: 0 });
  }, { sep: 1 });
  // the white scut, cocked up when running
  if (P.scut) g.ell(H[0] - 2.4, H[1] - 1.2, 1.3, 1.1, 'wdW2');
  g.part((c) => {
    c.stamp(head[0], head[1], HAREH[P.hv || 'sit'], HAREL, { ax: 1, ay: 2 });
    hareEar(c, earBase, P.ear[0], 'hare2');
  });
  g.outline();
  return g;
}

function hareFrames() {
  const sit = (o = {}) => ({
    H: [-3.2, -3.6], S: [1.4, -6.8], arch: 0.4, hN: [[1.2, -0.6], [1, 0]], hF: [[1.8, -0.6], [1, 0]],
    fN: [2.6, -0.6], fF: [1.6, -0.6], head: [2.4, -2.2], hv: 'sit', ear: [0.3, 0.42], ...o,
  });
  const idle = [
    sit({ breath: 0 }),
    sit({ breath: 1, S: [1.4, -7.0], head: [2.4, -2.3] }),
    sit({ breath: 0, ear: [0.1, 0.42] }), // near ear swivels
    sit({ breath: -1, hv: 'blink' }),
  ];
  const T = [1, 0.25];
  const run = [
    // forefeet strike, hind legs still trailing
    { H: [-4, -6.6], S: [3, -5.4], arch: 0, hN: [[-9.6, -5.2], [-1, 0.35]], hF: [[-8.8, -4.4], [-1, 0.4]], fN: [5.0, -0.6], fF: [3.6, -0.6], head: [3.0, -2.2] },
    // gathered: forefeet push off as the hind feet swing past them
    { H: [-1.8, -6.6], S: [2.8, -5.2], arch: 1.6, hN: [[3.6, -2.2], T], hF: [[2.8, -2.8], T], fN: [0.6, -0.6], fF: [-0.4, -1.4], head: [3.0, -2.0] },
    // hind feet land ahead of where the front ones were
    { H: [-0.6, -5.8], S: [4.2, -6.4], arch: 1.2, hN: [[4.8, -0.6], [1, 0]], hF: [[5.6, -0.6], [1, 0]], fN: [5.6, -3.4], fF: [4.6, -3.0], head: [3.0, -2.4] },
    // drive: hind legs straighten behind
    { H: [0.4, -6.8], S: [5.6, -8.0], arch: 0, hN: [[-4.0, -0.6], [-0.6, 0.8]], hF: [[-3.2, -0.6], [-0.6, 0.8]], fN: [9.4, -6.2], fF: [8.6, -5.2], head: [3.0, -2.4] },
    // stretched flight
    { H: [-2.4, -8.4], S: [5.2, -8.6], arch: -0.4, hN: [[-10.0, -6.6], [-1, 0.2]], hF: [[-9.2, -6.0], [-1, 0.25]], fN: [9.8, -4.6], fF: [8.8, -4.0], head: [3.0, -2.2] },
    // coming down, forelegs reaching for the ground
    { H: [-3.2, -8.2], S: [4.2, -6.8], arch: -0.2, hN: [[-10.0, -7.0], [-1, 0.1]], hF: [[-9.2, -6.4], [-1, 0.15]], fN: [7.0, -1.2], fF: [5.8, -0.6], head: [3.0, -2.2] },
  ].map((p) => ({ ...p, hv: 'run', ear: [1.0, 1.1], scut: true }));
  const F = [1, 0];
  const walk = [
    { H: [-3.0, -4.2], S: [2.8, -4.8], hN: [[1.0, -0.6], F], hF: [[1.6, -0.6], F], fN: [3.8, -0.6], fF: [2.6, -1.4] },
    { H: [-3.2, -4.3], S: [3.4, -5.0], hN: [[0.4, -0.6], F], hF: [[1.0, -0.6], F], fN: [5.6, -1.6], fF: [2.0, -0.6] },
    { H: [-3.0, -4.6], S: [3.8, -4.8], hN: [[-0.2, -0.6], F], hF: [[0.4, -0.6], F], fN: [5.4, -0.6], fF: [4.4, -1.6] },
    { H: [-2.0, -5.6], S: [3.6, -4.8], arch: 0.8, hN: [[1.4, -1.8], T], hF: [[2.0, -2.2], T], fN: [4.8, -0.6], fF: [5.0, -0.6] },
    { H: [-2.4, -4.6], S: [3.0, -4.6], arch: 1.2, hN: [[2.6, -0.6], F], hF: [[3.2, -0.6], F], fN: [4.2, -0.6], fF: [4.6, -0.6] },
    { H: [-2.8, -4.3], S: [2.8, -4.7], arch: 0.6, hN: [[1.8, -0.6], F], hF: [[2.4, -0.6], F], fN: [4.0, -0.6], fF: [3.4, -1.4] },
  ].map((p) => ({ ...p, head: [2.6, -2.2], hv: 'sit', ear: [0.55, 0.65], scut: false }));
  // on its side: legs out straight, ears flat along the ground
  const dead = [{
    H: [-3.4, -2.6], S: [3.0, -2.4], hN: [[-9.0, -1.4], [-1, 0.1]], hF: [[-8.4, -0.6], [-1, 0]], fN: [7.4, -0.8], fF: [6.6, -0.6],
    head: [2.4, 0.2], hv: 'dead', ear: [1.45, 1.5], scut: true,
  }];
  return cropFrames({ idle: idle.map(drawHare), run: run.map(drawHare), walk: walk.map(drawHare), dead: dead.map(drawHare) });
}

// ================= NILE CROCODILE =================
// Only ever seen in the water: everything at or below the waterline (y >= 0) is cut away.
addColors({ crocE: '#d8c040', crocM: '#e0a890' });
function crocPix() { return new Pix(64, 30, 30, 22); }
function clipWater(g) { g.remap((x, y) => (y > 0 ? null : undefined)); }

// lurking pose. s: how far it has sunk; ph: drift phase 0..1; blink
function crocBack(g, ph) {
  g.ell(-8, 0.6, 7.8, 3.4, 'croc1');
  g.chain([[-14, 0.0, 3.4], [-19, 0.2, 2.4], [-23, 0.4, 1.2]], 'croc1');
  // the tail's single crest of tall scutes, swaying a little as it drifts
  for (let i = 0; i < 5; i++) {
    const x = -15 - i * 1.8, sw = Math.sin(ph * TAU - i * 0.9) * 0.5;
    const h = [2.2, 2.0, 1.7, 1.3, 1.0][i];
    g.poly([[x - 0.9, -1.2], [x + 0.9, -1.2], [x + 0.2 + sw, -1.2 - h]], 'croc1');
  }
  g.flush();
  g.bevel({ up: 1, down: 0 });
  // plates on the back: a lit and a dark row, offset, inside the silhouette so the edge stays clean
  for (let x = -14; x <= -3; x += 2) {
    g.nudge(x + 0.5, -1.5, 1);
    g.px(x + 1.5, -0.5, 'croc0', true);
  }
}
function crocLurk(g, { s = 0, ph = 0, blink = false } = {}) {
  // whole-pixel bob so the head keeps its shape; the body rides 1px higher than its math
  const bob = Math.sin(ph * TAU) > 0.5 ? -1 : 0;
  g.push(0, s - 1);
  g.part((c) => crocBack(c, ph));
  // flat skull, raised eye bosses, long snout with the nostril knob at the tip
  g.part((c) => {
    c.push(0, bob);
    c.ell(3.4, 0.4, 9.4, 2.4, 'croc1');
    c.ell(0.4, -1.4, 2.4, 2.8, 'croc1');
    c.ell(11.4, -0.4, 1.4, 1.7, 'croc1');
    c.pop();
    c.bevel({ up: 1, down: 0 });
    c.push(0, bob);
    // eye: yellow with a slit pupil, or a lid when blinking
    if (blink) c.px(0.5, -2.5, 'croc2'), c.px(1.5, -2.5, 'croc2');
    else c.px(0.5, -2.5, 'crocE'), c.px(1.5, -2.5, 'ink');
    c.px(11.5, -1.5, 'crocD'); // nostril
    c.pop();
  });
  g.pop();
}

// head lifted out with jaws open. lift: head rise, a: upper jaw angle, b: lower jaw angle
function crocSnap(g, { lift, a, b }) {
  g.push(0, -1);
  g.part((c) => crocBack(c, 0.3));
  // neck rising to the jaw hinge
  const hx = -0.5, hy = 0.2 - lift;
  g.limb(-5, 0.6, hx, hy + 0.6, 4.2, 4.0, 'croc1');
  g.part((c) => {
    // lower jaw (pale underside), mouth lining, then the upper jaw over it
    c.push(hx, hy + 0.8, b);
    c.poly([[0, -0.6], [12, -0.2], [12, 0.8], [0, 1.6]], 'crocB');
    c.poly([[0, -1.2], [12, -0.6], [12, 0], [0, 0]], 'croc2');
    c.pop();
    c.poly([[hx, hy], [hx + 11 * Math.cos(-a), hy + 11 * Math.sin(-a)], [hx + 11 * Math.cos(b), hy + 0.8 + 11 * Math.sin(b)]], 'crocM');
    c.push(hx, hy, -a);
    c.poly([[-1, -2.2], [3, -2.4], [12, -0.8], [12, 0.6], [0, 1.0]], 'croc1');
    c.ell(0.6, -1.6, 2.0, 1.8, 'croc1'); // eye bump
    c.pop();
    c.flush();
    c.bevel({ up: 1, down: 1, only: ['croc1', 'croc2'] });
    // teeth along both jaws
    if (a > 0.1) {
      c.push(hx, hy, -a);
      for (let t = 3; t <= 11; t += 2) c.px(t + 0.5, 1.0, 'bone1');
      c.px(0.6 + 0.5, -2.0, 'crocE'); c.px(1.6 + 0.5, -2.0, 'ink');
      c.pop();
      c.push(hx, hy + 0.8, b);
      for (let t = 4; t <= 11; t += 2) c.px(t + 0.5, -1.8, 'bone1');
      c.pop();
    } else {
      c.push(hx, hy, -a);
      for (let t = 4; t <= 10; t += 3) c.px(t + 0.5, 0.8, 'bone1'); // the closed croc's grin
      c.px(0.6 + 0.5, -2.0, 'crocE'); c.px(1.6 + 0.5, -2.0, 'ink');
      c.pop();
    }
  });
  g.pop();
}

function crocFrames() {
  const fin = (g) => { g.outline(); clipWater(g); return g; };
  const lurk = [];
  for (let i = 0; i < 6; i++) { const g = crocPix(); crocLurk(g, { ph: i / 6, blink: i === 4 }); lurk.push(fin(g)); }
  const snap = [
    { lift: 2.0, a: 0.25, b: 0.05 }, { lift: 4.6, a: 0.7, b: 0.25 }, { lift: 5.4, a: 0.85, b: 0.32 },
    { lift: 4.6, a: 0.25, b: 0.08 }, { lift: 3.0, a: 0, b: 0 },
  ].map((k) => { const g = crocPix(); crocSnap(g, k); return fin(g); });
  const sink = [1.0, 2.0, 3.2, 4.4].map((s, i) => { const g = crocPix(); crocLurk(g, { s, ph: i / 8 }); return fin(g); });
  return cropFrames({ lurk, snap, sink });
}

export function build() {
  return {
    dog: quadFrames(dogSpec(), DOG_SETS),
    hyena: quadFrames(hyenaSpec(), HYENA_SETS),
    lion: quadFrames(lionSpec(), LION_SETS),
    hyrax: quadFrames(hyraxSpec(), HYRAX_SETS),
    hare: hareFrames(),
    croc: crocFrames(),
  };
}

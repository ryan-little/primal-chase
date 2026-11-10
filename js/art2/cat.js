// The big cat: the player. A lean leopard build with rosettes, the fullest animation set in the game.
import { quadFrames, tailPts, lerp, TAU } from './quad.js';

const HEAD = {
  idle: [
    '..d...B...',
    '.ddB.BpB..',
    '.BBBBBBBB.',
    'BBBsBBkBBL',
    'BBBBsBBLLn',
    '.BBBBLWWW.',
    '..BBcWWW..',
  ],
  blink: [
    '..d...B...',
    '.ddB.BpB..',
    '.BBBBBBBB.',
    'BBBsBBBBBL',
    'BBBBsBdLLn',
    '.BBBBLWWW.',
    '..BBcWWW..',
  ],
  ear: [
    '.d....B...',
    'ddB..BpB..',
    '.BBBBBBBB.',
    'BBBsBBkBBL',
    'BBBBsBBLLn',
    '.BBBBLWWW.',
    '..BBcWWW..',
  ],
  // ears pinned back, mouth open: running, pouncing
  snarl: [
    '..........',
    'dd.BB.....',
    '.dBBpBBBB.',
    'BBBsBBkBBL',
    'BBBBsBBLLn',
    '.BBBBLtWt.',
    '..BBcrrr..',
    '...BcWWW..',
  ],
  // head lowered to drink / eat
  down: [
    '..d...B...',
    '.ddB.BpB..',
    '.BBBBBBBB.',
    'BBBsBBBBBB',
    'BBBBsBkBBL',
    '.BBBBBLLLn',
    '..BBcWWWW.',
  ],
  dead: [
    '..d...B...',
    '.ddB.BpB..',
    '.BBBBBBBB.',
    'BBBsBBBBBL',
    'BBBBsBsLLn',
    '.BBBBLWWW.',
    '..BBcWWW..',
  ],
};
const LEG = { B: 'fur2', d: 'fur0', L: 'fur3', W: 'fur4', c: 'fur3', s: 'spot', k: 'ink', n: 'ink', p: 'clay1', t: 'bone1', r: 'blood' };

export function catSpec() {
  const C = { body: 'fur2', far: 'fur1', leg: 'fur2', foot: 'fur3', farFoot: 'fur1' };
  // rosettes in body space (u along the spine, v across it): open rings on the flank, solid dots toward the edges
  const ros = [];
  for (let i = 0; i < 7; i++) ros.push([-0.12 + i * 0.2, -0.52, 0]);
  for (let i = 0; i < 7; i++) ros.push([-0.2 + i * 0.2, 0.0, i % 2]);
  const spec = {
    stage: { w: 124, h: 76, ax: 60, ay: 60 },
    hip: [-8, -10.6], sh: [7.4, -10.4], depth: 3.6,
    front: { u: 4.3, l: 4.5, p: 2.5, w: [3.8, 2.7, 2.0, 1.9], x: 0.6, jy: 1.2, paw: [1.5, 1.0] },
    hind: { u: 5.0, l: 4.9, p: 3.7, w: [5.8, 3.1, 2.0, 1.9], x: -1.4, jy: 0.8, paw: [1.5, 1.0] },
    body: {
      croup: [-1.4, -3.3], rump: [-4.1, -0.4], butt: [-3.2, 3.0], groin: [3.2, 2.5], belly: 3.3, back: 3.5,
      brisket: [-1.2, 4.6], chest: [3.4, 1.4], throat: [3.6, -1.8], withers: [-0.4, -3.6],
      tail: [-3.4, -1.8], neck: [2.0, -0.5], arch: 1.7, sag: 0.5,
    },
    neckW: [5.2, 4.2], headRest: [6.8, -4.6], headBack: [-2.2, 1.0],
    headAt: { idle: [0, 0], walk: [0.6, 1.0], run: [1.4, 1.6], stalk: [1.6, 2.6], trot: [0.8, 1.2] },
    stride: 8.5, lift: 2.3, runStride: 13, runLift: 4.4,
    stance: { ff: 2.8, nf: -1.4, fh: 3.0, nh: -1.4, toeH: 0.18 },
    col: C, sep: 1,
    tune: { crouch: 0.7, reach: 8.6, headLow: 4.4 },
    gaits: { stalk: { stride: 0.7, lift: 0.75, beta: 0.7, hipDy: 2.0, shDy: 2.9, bob: 0.25, nod: 0.15 } },
    coat(u, v, hex) {
      if (hex !== '#d9a24a') return undefined;
      // pale underside from chin to groin
      if (v > 0.66) return 'fur4';
      if (v > 0.46) return 'fur3';
      return undefined;
    },
    marks(g, J) {
      for (const [u, v, two] of ros) {
        const [x, y] = J.at(u, v);
        g.px(x, y, 'spot', true);
        if (two) g.px(x + 1, y - 1, 'spot', true);
      }
    },
    legMarks(g, L) {
      // a few spots down the outside of each leg
      const s = (t, a, b) => g.px(lerp(a[0], b[0], t), lerp(a[1], b[1], t), 'spot', true);
      if (L.far) return;
      s(0.25, L.a, L.b); s(0.8, L.a, L.b); s(0.5, L.b, L.c);
      if (!L.front) { g.px(lerp(L.a[0], L.b[0], 0.5) - 1.4, lerp(L.a[1], L.b[1], 0.5) - 0.6, 'spot', true); g.px(L.a[0] - 1.6, L.a[1] + 0.4, 'spot', true); }
    },
    tail(g, J, pose) {
      const run = pose.gait === 'run' || pose.gait === 'pounce';
      const low = pose.gait === 'lie' || pose.gait === 'dead';
      const w = Math.sin(pose.p * TAU), w2 = Math.sin(pose.p * TAU - 1.2);
      let ang;
      if (run) ang = (t) => 0.12 - J.flex * 0.25 * (1 - t) - 0.55 * t * t + (w * (1 - t) + w2 * t) * 0.16; // streaming, tip lifting
      else if (low) ang = (t) => 0.5 - 0.45 * t - (t > 0.6 ? (t - 0.6) * (2.2 + w * 1.2) : 0); // along the ground, tip flicking
      else if (pose.gait === 'stalk') ang = (t) => 0.35 - 0.5 * t + (t > 0.7 ? w * 0.6 : 0); // held low and still but for the tip
      else ang = (t) => 1.05 - 0.6 * t - 1.9 * t * t * t + w * 0.1 * t + w2 * 0.22 * t * t; // hangs, then hooks up at the tip
      const n = 8, pts = tailPts(J.tail, n, 2.15, ang);
      if (low) for (const q of pts) q[1] = Math.min(q[1], -1.2);
      g.chain(pts.map(([x, y], i) => [x, y, lerp(2.5, 1.7, i / n)]), 'fur2');
      g.flush();
      // rings and a dark tip
      for (const i of [3, 5]) g.px(pts[i][0], pts[i][1], 'spot', true);
      const tp = pts[n], tq = pts[n - 1];
      g.limb(tq[0], tq[1], tp[0], tp[1], 1.5, 1.3, 'spot');
    },
    head(g, x, y, ang, pose) {
      const gt = pose.gait;
      let rows = HEAD.idle;
      if (gt === 'dead') rows = HEAD.dead;
      else if (pose.mouth) rows = HEAD.snarl;
      else if (pose.headDown) rows = HEAD.down;
      else if (pose.blink) rows = HEAD.blink;
      else if (pose.ear) rows = HEAD.ear;
      g.stamp(x, y, rows, LEG, { ax: 4, ay: rows === HEAD.snarl ? 4 : 3 });
      if (gt === 'drink' && pose.lap) g.px(x + 5.5, y + 3.5, 'blood1');
    },
  };

  return spec;
}

export const CAT_SETS = [
  ['idle', 8], ['walk', 8], ['run', 8], ['stalk', 8], ['lie', 8], ['drink', 4], ['eat', 6], ['pounce', 5], ['dead', 1],
];

export function build() {
  return { cat: quadFrames(catSpec(), CAT_SETS) };
}

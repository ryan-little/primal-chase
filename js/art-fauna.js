// More animals: zebra, warthog, hyrax, lion, golden gazelle (quadruped rig) and three birds.
import { P } from './palette.js';
import { rng, TAU } from './util.js';
import { canvas, crisp, quadFrames, gazelleSpec } from './art.js';

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

function zebraSpec() {
  const C = { body: P.zeb1, belly: P.zeb1, far: P.rock2 };
  return {
    w: 44, h: 36, ground: 32, body: { x: 19, y: 17, rx: 9.5, ry: 4.8 },
    hipF: 6.5, hipR: 6.5, l1: 5.8, l2: 6, legW: 2.1, knee: 0.6, neckW: 3.6, tailW: 1.4, neckX: 2.4, neckY: 3.5, headR: 2.8,
    col: C,
    spots(ctx, bx, by, rx, ry) {
      for (let i = -4; i <= 4; i++) line(ctx, [bx + i * rx * 0.2, by - ry * 1.05, bx + i * rx * 0.2 + 1.5, by + ry * 0.55], 1, P.zeb0);
      for (let i = 0; i < 3; i++) line(ctx, [bx - rx * 0.95, by - ry * 0.5 + i * 2, bx - rx * 0.6, by - ry * 0.3 + i * 2], 1, P.zeb0);
    },
    tail(ctx, [x, y], w) { line(ctx, [x, y, x - 2.5, y + 5 + w * 0.5], 1.3, P.zeb0); },
    head(ctx, x, y, tilt) {
      line(ctx, [x - 2.5, y - 3.5, x + 0.5, y - 4.2], 1.6, P.zeb0); // mane
      tri(ctx, [x - 1.5, y - 2], [x - 1, y - 5], [x + 0.5, y - 2], P.zeb1);
      ell(ctx, x, y, 2.8, 2.4, C.body);
      ell(ctx, x + 3, y + 1.2 + tilt, 2.2, 1.6, C.body);
      line(ctx, [x - 1, y - 1, x + 2, y - 1.4], 1, P.zeb0);
      line(ctx, [x - 1, y + 1, x + 2.5, y + 0.6], 1, P.zeb0);
      ell(ctx, x + 4.4, y + 1.6 + tilt, 1.2, 1.2, P.zeb0);
      px(ctx, x + 0.6, y - 0.4, P.ink);
    },
  };
}

function warthogSpec() {
  const C = { body: P.rock1, belly: P.rock2, far: P.wart0 };
  return {
    w: 32, h: 24, ground: 21, body: { x: 14, y: 13, rx: 7, ry: 3.8 },
    hipF: 5, hipR: 4.5, l1: 3, l2: 3, legW: 1.8, neckW: 3.6, tailW: 1, neckX: 1, neckY: -1.5, headR: 3,
    col: C, back: P.mane,
    tail(ctx, [x, y], w, p, gait) {
      if (gait === 'run') { line(ctx, [x, y, x - 1, y - 6], 1, P.wart0); px(ctx, x - 1, y - 7, P.ink); }
      else line(ctx, [x, y, x - 2, y + 3], 1, P.wart0);
    },
    head(ctx, x, y, tilt) {
      ell(ctx, x, y, 3.2, 3, C.body);
      line(ctx, [x + 1, y + 1 + tilt, x + 6, y + 2 + tilt], 3, C.body); // long snout
      ell(ctx, x + 6.2, y + 2 + tilt, 1, 1.4, P.ink);
      line(ctx, [x + 4, y + 3 + tilt, x + 5.5, y - 0.8 + tilt, x + 4.5, y - 1.8 + tilt], 1.2, P.bone); // tusks
      px(ctx, x + 2.5, y + 0.2, P.wart0); px(ctx, x + 3, y - 0.2, P.wart0); // warts
      px(ctx, x + 0.5, y - 0.8, P.ink);
      ell(ctx, x - 1, y - 2.6, 1, 1.4, P.wart0);
      px(ctx, x + 1.5, y + 0.6, P.wart0);
    },
  };
}

function hyraxSpec() {
  const C = { body: P.hare1, belly: P.hare2, far: P.hare0 };
  return {
    w: 22, h: 16, ground: 14, body: { x: 10, y: 9.5, rx: 5, ry: 3 },
    hipF: 3, hipR: 3, l1: 1.8, l2: 1.8, legW: 1.4, neckW: 2.4, tailW: 1, neckX: 0.5, neckY: -1.5, headR: 2.2,
    col: C,
    head(ctx, x, y, tilt) {
      ell(ctx, x, y, 2.4, 2.1, C.body);
      ell(ctx, x + 1.8, y + 0.8 + tilt, 1.2, 1, C.body);
      px(ctx, x + 3, y + 0.6 + tilt, P.ink);
      px(ctx, x + 0.4, y - 0.6, P.ink);
      ell(ctx, x - 1.2, y - 1.8, 0.8, 0.8, P.hare0);
    },
  };
}

function lionSpec() {
  const C = { body: P.lion1, belly: P.lion2, far: P.lion0 };
  return {
    w: 68, h: 34, ground: 31, body: { x: 32, y: 19, rx: 12.5, ry: 4.8 },
    hipF: 8.5, hipR: 8.5, l1: 5, l2: 5.2, legW: 3, neckW: 4.4, tailW: 2, neckX: 3.2, neckY: -0.6, headR: 4.2,
    col: C, back: P.lion0,
    tail(ctx, [x, y], w, p, gait) {
      const sway = Math.sin(p * TAU);
      const run = gait === 'run';
      line(ctx, run ? [x, y, x - 8, y - 1, x - 15, y - 2 + sway] : [x, y, x - 5, y + 5, x - 11 + sway, y + 7], 2, C.body);
      ell(ctx, run ? x - 15 : x - 11 + sway, run ? y - 2 + sway : y + 7, 1.6, 1.6, P.mane);
    },
    head(ctx, x, y, tilt, p, gait) {
      ell(ctx, x - 1, y + 0.5, 6, 5.6, P.mane);
      ell(ctx, x - 1.6, y - 1, 4.4, 4, P.mane);
      ell(ctx, x + 0.6, y, 3.8, 3.3, C.body);
      ell(ctx, x + 3.6, y + 1.2 + tilt, 2.4, 1.9, P.lion2);
      px(ctx, x + 5.6, y + 0.4 + tilt, P.ink);
      px(ctx, x + 1.8, y - 0.9, P.ink);
      if (gait === 'run' || gait === 'pounce') { px(ctx, x + 4, y + 2.8 + tilt, P.blood1); px(ctx, x + 5, y + 2.6 + tilt, P.bone); }
    },
  };
}

// ---- birds, drawn by hand ----
function ostrich() {
  const run = [], idle = [];
  for (let i = 0; i < 8; i++) {
    const c = canvas(30, 44), x = c.getContext('2d');
    const t = (i / 8) * TAU, s = Math.sin(t);
    const bob = -Math.abs(Math.cos(t)) * 1.5;
    // legs
    line(x, [14, 26 + bob, 14 + s * 5, 34, 13 + s * 7, 41], 1.6, P.ost2);
    line(x, [15, 26 + bob, 15 - s * 5, 34, 16 - s * 7, 41], 1.6, P.ost2);
    ell(x, 14, 22 + bob, 9, 6, P.ost0);
    ell(x, 8, 20 + bob, 4, 4, P.ost1); // tail plume
    ell(x, 15, 24 + bob, 6, 3, P.ost0);
    line(x, [19, 20 + bob, 22, 12 + bob, 23, 5 + bob], 1.6, P.ost2);
    ell(x, 24, 4.5 + bob, 2, 1.6, P.ost2);
    px(x, 26, 5 + bob, P.ink); px(x, 24, 4 + bob, P.ink);
    run.push(crisp(c));
  }
  for (let i = 0; i < 2; i++) {
    const c = canvas(30, 44), x = c.getContext('2d');
    line(x, [13, 27, 13, 41], 1.6, P.ost2); line(x, [16, 27, 16, 41], 1.6, P.ost2);
    ell(x, 14, 23, 9, 6, P.ost0); ell(x, 8, 21, 4, 4, P.ost1);
    const hy = i ? 12 : 4;
    line(x, [19, 21, 21, 14, 22 + i * 2, hy + 1], 1.6, P.ost2);
    ell(x, 23 + i * 2, hy, 2, 1.6, P.ost2); px(x, 23 + i * 2, hy - 0.5, P.ink);
    idle.push(crisp(c));
  }
  return { ox: 14, oy: 41, run, idle, walk: run };
}

function fowl() {
  const run = [], fly = [], idle = [];
  const body = (x, oy) => {
    ell(x, 7, 7 + oy, 4.6, 3.4, P.fowl0);
    for (let k = 0; k < 6; k++) px(x, 4 + (k % 3) * 2, 6 + oy + Math.floor(k / 3) * 2, P.fowl2);
    ell(x, 11, 4.5 + oy, 1.6, 1.6, P.fowl1);
    px(x, 11, 3 + oy, P.danger); px(x, 12.5, 5 + oy, P.bone0);
  };
  for (let i = 0; i < 4; i++) {
    const c = canvas(16, 14), x = c.getContext('2d');
    const s = Math.sin((i / 4) * TAU);
    line(x, [7, 10, 7 + s * 2, 13], 1, P.bone0); line(x, [8, 10, 8 - s * 2, 13], 1, P.bone0);
    body(x, 0);
    run.push(crisp(c));
  }
  for (let i = 0; i < 4; i++) {
    const c = canvas(16, 14), x = c.getContext('2d');
    const f = Math.sin((i / 4) * TAU) * 3;
    body(x, 0);
    line(x, [5, 6, 2, 3 - f, 0, 5 - f], 1.4, P.fowl1);
    fly.push(crisp(c));
  }
  { const c = canvas(16, 14), x = c.getContext('2d'); line(x, [7, 10, 7, 13], 1, P.bone0); line(x, [8, 10, 8, 13], 1, P.bone0); body(x, 0); idle.push(crisp(c)); }
  return { ox: 8, oy: 13, run, fly, idle, walk: run };
}

function flamingo() {
  const idle = [], run = [], fly = [];
  const draw = (x, legA, legB, headDown, wing) => {
    line(x, [11, 14, 11 + legA, 22, 11 + legA * 1.4, 31], 1, P.flam0);
    line(x, [12, 14, 12 + legB, 22, 12 + legB * 1.4, 31], 1, P.flam0);
    ell(x, 11, 12, 6, 3.6, P.flam1);
    ell(x, 9, 12, 3, 2, P.flam0);
    if (headDown) line(x, [15, 11, 18, 6, 19, 16], 1.3, P.flam1);
    else line(x, [15, 11, 17, 5, 16, 1, 18, 1], 1.3, P.flam1);
    px(x, 19, headDown ? 17 : 1, P.ink);
    if (wing) line(x, [8, 11, 2, 11 - wing, -1, 12 - wing], 2, P.flam0);
  };
  for (let i = 0; i < 2; i++) { const c = canvas(24, 34), x = c.getContext('2d'); draw(x, 0, 0.5, i === 1, 0); idle.push(crisp(c)); }
  for (let i = 0; i < 6; i++) { const c = canvas(24, 34), x = c.getContext('2d'); const s = Math.sin((i / 6) * TAU) * 3; draw(x, s, -s, false, 0); run.push(crisp(c)); }
  for (let i = 0; i < 4; i++) { const c = canvas(24, 34), x = c.getContext('2d'); draw(x, -5, -5, false, Math.sin((i / 4) * TAU) * 4); fly.push(crisp(c)); }
  return { ox: 11, oy: 31, idle, run, fly, walk: run };
}

function smallCarcass() {
  const c = canvas(16, 10), x = c.getContext('2d');
  ell(x, 8, 6, 5, 2.4, P.hare1); ell(x, 7, 6, 2.6, 1.4, P.blood);
  for (let i = 0; i < 4; i++) px(x, 3 + i * 3, 3 + (i % 2), P.fowl2);
  crisp(c);
  return c;
}

export function buildFauna() {
  const r = rng(4);
  void r;
  return {
    zebra: quadFrames(zebraSpec(), [['idle', 4], ['walk', 8], ['run', 8], ['dead', 1]]),
    warthog: quadFrames(warthogSpec(), [['idle', 4], ['walk', 8], ['run', 8], ['dead', 1]]),
    hyrax: quadFrames(hyraxSpec(), [['idle', 2], ['walk', 6], ['run', 6], ['dead', 1]]),
    lion: quadFrames(lionSpec(), [['idle', 6], ['walk', 8], ['run', 8], ['lie', 6], ['pounce', 1]]),
    golden: quadFrames(gazelleSpec({ body: P.gold1, belly: P.gold2, far: P.gold0 }), [['idle', 4], ['walk', 8], ['run', 8], ['dead', 1]]),
    ostrich: ostrich(),
    fowl: fowl(),
    flamingo: flamingo(),
    smallCarcass: smallCarcass(),
  };
}

// Every sprite in the game is drawn here, in code, at load time.
// Creatures use a small parametric rig (hips, two-segment legs, spine, head) so animation
// is smooth; each frame is then "crisped": alpha thresholded, snapped to the palette and
// given a 1px ink outline, which is what makes it read as hand-placed pixel art.

import { P, hexToRgb } from './palette.js';
import { rng, TAU } from './util.js';

const PAL_RGB = Object.values(P).map(hexToRgb);
const INK = hexToRgb(P.ink);

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function nearest(r, g, b, pal) {
  let best = 0, bd = 1e9;
  for (let i = 0; i < pal.length; i++) {
    const p = pal[i];
    const d = (p[0] - r) ** 2 * 0.3 + (p[1] - g) ** 2 * 0.59 + (p[2] - b) ** 2 * 0.11;
    if (d < bd) { bd = d; best = i; }
  }
  return pal[best];
}

// Threshold + palette snap + outline. `pal` limits colors to the ones the sprite used.
export function crisp(c, { outline = true, pal = PAL_RGB, cut = 110, outlineRGB = INK } = {}) {
  const ctx = c.getContext('2d');
  const { width: w, height: h } = c;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const cache = new Map();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < cut) { d[i + 3] = 0; continue; }
    d[i + 3] = 255;
    const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    let q = cache.get(key);
    if (!q) { q = nearest(d[i], d[i + 1], d[i + 2], pal); cache.set(key, q); }
    d[i] = q[0]; d[i + 1] = q[1]; d[i + 2] = q[2];
  }
  if (outline) {
    const solid = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) solid[i] = d[i * 4 + 3] ? 1 : 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (solid[i]) continue;
        const n = (x > 0 && solid[i - 1]) || (x < w - 1 && solid[i + 1]) ||
          (y > 0 && solid[i - w]) || (y < h - 1 && solid[i + w]);
        if (n) {
          d[i * 4] = outlineRGB[0]; d[i * 4 + 1] = outlineRGB[1]; d[i * 4 + 2] = outlineRGB[2]; d[i * 4 + 3] = 255;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function palOf(...keys) {
  return keys.map((k) => hexToRgb(P[k] || k));
}

// ---------- primitive helpers ----------
function ell(ctx, x, y, rx, ry, col, rot = 0) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), rot, 0, TAU);
  ctx.fill();
}
function line(ctx, pts, w, col) {
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.stroke();
}
function px(ctx, x, y, col) {
  ctx.fillStyle = col;
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
}
function tri(ctx, a, b, c, col) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]);
  ctx.closePath();
  ctx.fill();
}

// Two-segment leg. angle 0 = straight down, positive = forward (+x).
function leg(ctx, hx, hy, a1, a2, l1, l2, w, col, pawCol) {
  const kx = hx + Math.sin(a1) * l1, ky = hy + Math.cos(a1) * l1;
  const fx = kx + Math.sin(a2) * l2, fy = ky + Math.cos(a2) * l2;
  line(ctx, [hx, hy, kx, ky, fx, fy], w, col);
  if (pawCol) ell(ctx, fx + 0.6, fy, w * 0.62, w * 0.42, pawCol);
  return [fx, fy];
}

// ---------- quadruped rig ----------
// gait: idle | walk | run | lie | drink | pounce | dead ; p = phase 0..1
// Gallop keyframes: [frontAngle, frontKnee, rearAngle, rearKnee, stretch, bob, pitch]
const GALLOP = [
  [0.95, 0.15, -0.8, 0.35, 2.0, -1.8, 0.02],
  [0.3, 0.05, -0.25, 0.85, 0.6, 0.2, 0.06],
  [-0.5, 0.25, 0.62, 0.12, -1.4, -0.6, -0.02],
  [0.05, 0.7, 0.15, 0.2, -0.2, -1.2, -0.06],
];
function gallopAt(t) {
  t = ((t % 1) + 1) % 1;
  const f = t * GALLOP.length, i = Math.floor(f), u = f - i;
  const a = GALLOP[i], b = GALLOP[(i + 1) % GALLOP.length];
  const w = (1 - Math.cos(u * Math.PI)) / 2;
  return a.map((v, k) => v + (b[k] - v) * w);
}

function quadPose(gait, p) {
  const s = Math.sin(p * TAU);
  const pose = { bob: 0, stretch: 0, pitch: 0, head: 0, legs: [0, 0, 0, 0], knees: [0.2, 0.2, 0.2, 0.2], tail: 0, gait };
  // legs: [far front, near front, far rear, near rear]
  if (gait === 'idle') {
    pose.bob = Math.sin(p * TAU) * 0.3;
    pose.legs = [0.08, -0.04, 0.1, -0.02];
    pose.knees = [0.05, 0.05, 0.2, 0.2];
    pose.tail = Math.sin(p * TAU);
  } else if (gait === 'walk') {
    const ph = [0.75, 0.25, 0.5, 0]; // lateral sequence walk
    pose.legs = ph.map((o) => Math.sin((p + o) * TAU) * 0.5);
    pose.knees = ph.map((o) => 0.12 + Math.max(0, Math.cos((p + o) * TAU)) * 0.65);
    pose.bob = -Math.abs(Math.sin(p * TAU * 2)) * 0.5;
    pose.head = 0.6 + s * 0.25;
    pose.tail = s * 0.5;
  } else if (gait === 'run') {
    const far = gallopAt(p), near = gallopAt(p + 0.07);
    pose.legs = [far[0], near[0], far[2], near[2]];
    pose.knees = [far[1], near[1], far[3], near[3]];
    pose.stretch = far[4];
    pose.bob = far[5];
    pose.pitch = far[6];
    pose.head = 0.4;
    pose.tail = -1;
  } else if (gait === 'pounce') {
    pose.legs = [1.25, 1.05, -1.15, -0.95];
    pose.knees = [0.1, 0.1, 0.15, 0.15];
    pose.stretch = 2.5;
    pose.bob = -3;
    pose.pitch = -0.08;
    pose.head = -0.2;
    pose.tail = -1;
  }
  return pose;
}

function drawQuad(ctx, S, gait, p) {
  const pose = quadPose(gait, p);
  const C = S.col;
  const bx = S.body.x, by = S.body.y + pose.bob;
  const rx = S.body.rx + pose.stretch * 0.5, ry = S.body.ry;

  if (gait === 'lie' || gait === 'dead') {
    const g = S.ground;
    const lby = g - ry - 0.5;
    // tail on ground
    line(ctx, [bx - rx + 1, lby + 1, bx - rx - 5, g - 1.5 + Math.sin(p * TAU) * 0.8, bx - rx - 9, g - 2 + Math.sin(p * TAU + 1) * 1.2], S.tailW, C.body);
    if (gait === 'lie') {
      line(ctx, [bx + rx * 0.6, g - 1.5, bx + rx + 7, g - 1.2], S.legW, C.far);
      line(ctx, [bx + rx * 0.5, g - 1, bx + rx + 6, g - 0.5], S.legW, C.body);
    }
    ell(ctx, bx, lby, rx + 0.5, ry, C.body);
    ell(ctx, bx, lby + ry * 0.55, rx * 0.8, ry * 0.4, C.belly);
    ell(ctx, bx - rx * 0.6, lby + 0.5, ry * 1.1, ry * 1.0, C.body);
    if (S.spots) S.spots(ctx, bx, lby, rx, ry, 0);
    if (gait === 'lie') {
      const hx = bx + rx + 2, hy = lby - ry - 1 + Math.sin(p * TAU) * 0.3;
      line(ctx, [bx + rx - 3, lby - 1, hx - 1, hy + 1], S.neckW, C.body);
      S.head(ctx, hx, hy, 0, p, gait);
    } else {
      const hx = bx + rx + 3, hy = g - S.headR;
      S.head(ctx, hx, hy, 0.2, p, gait);
    }
    return;
  }

  const hipF = [bx + S.hipF, by + ry * 0.35];
  const hipR = [bx - S.hipR, by + ry * 0.35];
  const L1 = S.l1, L2 = S.l2;
  const ks = S.knee || 1;
  const frontLeg = (h, a, k, col, off) => leg(ctx, h[0] + off, h[1], a, a - k * ks, L1, L2, S.legW, col, col);
  const rearLeg = (h, a, k, col, off) => leg(ctx, h[0] + off, h[1], a - 0.2, a + k * ks, L1 + 0.5, L2, S.legW + 0.4, col, col);

  // far legs
  frontLeg(hipF, pose.legs[0], pose.knees[0], C.far, 1);
  rearLeg(hipR, pose.legs[2], pose.knees[2], C.far, 1);

  // tail
  const tb = [bx - rx + 1, by - ry * 0.3];
  if (S.tail) S.tail(ctx, tb, pose.tail, p, gait);

  // body
  if (gait === 'drink') {
    ell(ctx, bx, by + 1, rx, ry, C.body, 0.12);
  } else {
    ell(ctx, bx, by, rx, ry, C.body, pose.pitch);
  }
  ell(ctx, bx - rx * 0.62, by - 0.3, ry * 1.08, ry * 1.02, C.body); // haunch
  ell(ctx, bx + rx * 0.55, by - 0.2, ry * 1.1, ry * 1.05, C.body); // shoulder
  ell(ctx, bx + 0.5, by + ry * 0.6, rx * 0.72, ry * 0.36, C.belly);
  if (S.back) ell(ctx, bx, by - ry * 0.55, rx * 0.8, ry * 0.35, S.back);
  if (S.spots) S.spots(ctx, bx, by, rx, ry, pose.pitch);

  // near legs
  frontLeg(hipF, pose.legs[1], pose.knees[1], C.body, 0);
  rearLeg(hipR, pose.legs[3], pose.knees[3], C.body, 0);

  // neck + head
  let hx, hy, ha = pose.head;
  if (gait === 'drink') {
    hx = bx + rx + S.headR * 0.6; hy = S.ground - S.headR - 0.5; ha = 0.9;
    line(ctx, [bx + rx - 2, by - 1, hx - 1, hy], S.neckW, C.body);
  } else {
    hx = bx + rx + S.neckX; hy = by - ry - S.neckY + ha * 1.2;
    line(ctx, [bx + rx - 3, by - ry * 0.3, hx - 1.5, hy + 1], S.neckW, C.body);
  }
  S.head(ctx, hx, hy, ha * 0.3, p, gait);
}

// ---------- species ----------
function catSpec() {
  const C = { body: P.fur2, belly: P.fur4, far: P.fur1 };
  const ros = [];
  const r = rng(77);
  for (let i = 0; i < 17; i++) ros.push([r.range(-0.95, 0.85), r.range(-0.6, 0.5), r() < 0.45]);
  return {
    w: 50, h: 30, ground: 27, body: { x: 22, y: 17.5, rx: 11.5, ry: 4.1 },
    hipF: 8, hipR: 8, l1: 4.4, l2: 4.6, legW: 2.7, neckW: 3.8, tailW: 2, neckX: 3.2, neckY: -0.8, headR: 3.6,
    col: C,
    back: P.fur1,
    spots(ctx, bx, by, rx, ry) {
      for (const [u, v, ring] of ros) {
        const x = Math.round(bx + u * rx), y = Math.round(by + v * ry * 1.25);
        if (ring) {
          px(ctx, x, y, P.spot); px(ctx, x + 2, y, P.spot); px(ctx, x + 1, y - 1, P.spot); px(ctx, x + 1, y + 1, P.spot);
          px(ctx, x + 1, y, P.fur1);
        } else px(ctx, x, y, P.spot);
      }
    },
    tail(ctx, [x, y], w, p, gait) {
      const sway = Math.sin(p * TAU) * 1;
      if (gait === 'run' || gait === 'pounce') {
        line(ctx, [x, y, x - 7, y - 0.5 + sway * 0.5, x - 14, y - 1.5 + sway], 2, C.body);
        px(ctx, x - 14, y - 1.5 + sway, P.spot); px(ctx, x - 13, y - 1.5 + sway, P.spot);
      } else {
        line(ctx, [x, y, x - 4, y + 4, x - 8, y + 7.5, x - 12 + sway, y + 6.5, x - 13.5 + sway, y + 4 + w * 0.6], 2, C.body);
        px(ctx, x - 13.5 + sway, y + 4 + w * 0.6, P.spot); px(ctx, x - 9, y + 7.5, P.spot);
      }
    },
    head(ctx, x, y, tilt, p, gait) {
      ell(ctx, x - 1.6, y - 2.8, 1.5, 1.4, C.far);
      ell(ctx, x + 0.8, y - 3.1, 1.5, 1.4, C.body);
      px(ctx, x + 0.8, y - 3, P.spot);
      ell(ctx, x, y, 3.8, 3.1, C.body);
      ell(ctx, x + 3.2, y + 1.1 + tilt, 2.3, 1.9, P.fur3);
      ell(ctx, x + 1, y + 2.1 + tilt, 2.4, 1.2, P.fur4);
      px(ctx, x + 5.2, y + 0.3 + tilt, P.ink); // nose
      px(ctx, x + 1.8, y - 0.9, P.ink); // eye
      px(ctx, x + 2.6, y - 1.2, P.fur4);
      px(ctx, x - 1.8, y - 0.2, P.spot); px(ctx, x - 0.6, y + 0.8, P.spot); px(ctx, x - 2.2, y + 1.3, P.spot);
      if (gait === 'run' || gait === 'pounce') { px(ctx, x + 3.5, y + 2.8 + tilt, P.blood1); px(ctx, x + 4.5, y + 2.5 + tilt, P.bone); }
    },
  };
}

function gazelleSpec() {
  const C = { body: P.gaz1, belly: P.gazW, far: P.gaz0 };
  return {
    w: 36, h: 32, ground: 29, body: { x: 16, y: 15, rx: 7.5, ry: 3.4 },
    hipF: 5, hipR: 5.5, l1: 6.4, l2: 6.6, legW: 1.4, knee: 0.45, neckW: 2.2, tailW: 1, neckX: 2, neckY: 4.5, headR: 2.4,
    col: C,
    spots(ctx, bx, by, rx, ry) {
      line(ctx, [bx - rx * 0.7, by + 0.8, bx + rx * 0.7, by + 0.8], 1, P.ink);
    },
    tail(ctx, [x, y], w) {
      line(ctx, [x, y, x - 2, y + 2 + w * 0.5], 1.4, P.ink);
    },
    head(ctx, x, y, tilt) {
      line(ctx, [x - 0.5, y - 1.5, x - 2.5, y - 5.5, x - 4, y - 6.5], 1, P.ink);
      line(ctx, [x + 0.5, y - 1.5, x - 1.2, y - 5.8, x - 2.6, y - 7], 1, P.bark0);
      ell(ctx, x, y, 2.4, 2.1, C.body);
      ell(ctx, x + 2.2, y + 1 + tilt, 1.8, 1.1, C.body);
      px(ctx, x + 0.5, y - 0.6, P.ink);
      px(ctx, x + 3.6, y + 1 + tilt, P.ink);
      px(ctx, x - 0.5, y + 1, P.gazW);
    },
  };
}

function dogSpec() {
  const C = { body: P.dog2, belly: P.dog3, far: P.dog1 };
  return {
    w: 34, h: 26, ground: 23, body: { x: 15, y: 14, rx: 7, ry: 3.2 },
    hipF: 5, hipR: 5, l1: 3.8, l2: 4, legW: 1.8, neckW: 2.6, tailW: 1.5, neckX: 2, neckY: 1.2, headR: 2.8,
    col: C,
    back: P.dog1,
    tail(ctx, [x, y], w, p) {
      line(ctx, [x, y, x - 3, y - 3 - w, x - 2, y - 6 - w], 1.6, C.body);
    },
    head(ctx, x, y, tilt, p, gait) {
      tri(ctx, [x - 2, y - 1.5], [x - 1.2, y - 5], [x, y - 1.8], C.far);
      tri(ctx, [x, y - 1.8], [x + 0.8, y - 5], [x + 1.8, y - 1.2], C.body);
      ell(ctx, x, y, 2.8, 2.4, C.body);
      ell(ctx, x + 2.8, y + 0.9 + tilt, 2.4, 1.3, P.dog3);
      px(ctx, x + 5, y + 0.4 + tilt, P.ink);
      px(ctx, x + 0.6, y - 0.6, P.ink);
      if (gait === 'run') px(ctx, x + 3.6, y + 2.2 + tilt, P.blood1);
    },
  };
}

function hyenaSpec() {
  const C = { body: P.sand1, belly: P.sand2, far: P.sand0 };
  const r = rng(12);
  const sp = [];
  for (let i = 0; i < 10; i++) sp.push([r.range(-0.8, 0.8), r.range(-0.6, 0.4)]);
  return {
    w: 38, h: 28, ground: 25, body: { x: 17, y: 15, rx: 8, ry: 3.8 },
    hipF: 6, hipR: 5, l1: 4.8, l2: 4.4, legW: 2, neckW: 3.4, tailW: 1.5, neckX: 2.5, neckY: 0.4, headR: 3.2,
    col: C, back: P.mud2,
    spots(ctx, bx, by, rx, ry) {
      for (const [u, v] of sp) px(ctx, bx + u * rx, by + v * ry * 1.3, P.mud0);
    },
    tail(ctx, [x, y], w) {
      line(ctx, [x, y + 1, x - 3, y + 5 + w * 0.5], 1.5, P.mud0);
    },
    head(ctx, x, y, tilt, p, gait) {
      ell(ctx, x - 1, y - 2.8, 1.3, 1.6, P.mud1);
      ell(ctx, x, y, 3.2, 2.8, C.body);
      ell(ctx, x + 3, y + 1.2 + tilt, 2.4, 1.6, P.mud1);
      px(ctx, x + 5.2, y + 0.8 + tilt, P.ink);
      px(ctx, x + 0.8, y - 0.8, P.ink);
      if (gait === 'run') px(ctx, x + 4, y + 2.6 + tilt, P.blood1);
    },
  };
}

// ---------- human rig ----------
// pose: walk | run | windup | throw | search | down ; p phase
function drawHuman(ctx, pose, p, night, variant) {
  const W = 28, G = 38;
  const skin = variant % 2 ? P.skin3 : P.skin2, skinD = P.skin1;
  const s = Math.sin(p * TAU);
  if (pose === 'down') {
    line(ctx, [4, G - 2, 12, G - 3], 3, skinD);
    line(ctx, [12, G - 3, 22, G - 4], 4, skin);
    ell(ctx, 13, G - 3, 3, 1.8, P.hide1);
    ell(ctx, 24, G - 5, 3.2, 3, skin);
    ell(ctx, 24.5, G - 7, 3, 1.6, P.ink);
    line(ctx, [2, G - 1, 26, G - 1], 1, P.bark1);
    return;
  }
  let lean = 0, bob = 0, legA = 0, armA = 0, armB = 0, crouch = 0;
  if (pose === 'walk') { legA = s * 0.45; armA = -s * 0.4; bob = -Math.abs(Math.cos(p * TAU)) * 0.8; lean = 0.5; }
  if (pose === 'run') { legA = s * 0.85; armA = -s * 0.9; bob = -Math.abs(Math.cos(p * TAU)) * 1.6; lean = 2.2; }
  if (pose === 'windup') { legA = 0.35; armA = -2.4; lean = -1; }
  if (pose === 'throw') { legA = -0.35; armA = 1.4; lean = 2.5; }
  if (pose === 'search') { crouch = 3 + s * 0.8; lean = 2.5; legA = 0.25; armA = 0.8; }
  const hx = 13, hy = G - 13 + bob + crouch;
  const shx = hx + lean, shy = hy - 9 + crouch * 0.3;
  // far leg & arm
  leg(ctx, hx, hy, -legA, -legA + Math.max(0, legA) * 0.2 - 0.25 - crouch * 0.12, 6.5, 6.6 - crouch * 0.3, 2.2, skinD, skinD);
  const armFar = armB || -armA;
  leg(ctx, shx, shy + 0.5, armFar * 0.8, armFar * 0.8 - 0.6, 4.5, 4.2, 1.8, skinD, null);
  // torso
  line(ctx, [hx, hy, shx, shy], 4.8, skin);
  line(ctx, [hx - 0.3, hy - 3.5, shx - 0.2, shy + 2.5], 1, P.paint); // body paint stripe
  // hide cape over the shoulders: makes the silhouette read against grass
  tri(ctx, [shx - 3.2, shy - 0.5], [shx + 2.4, shy - 0.5], [shx - 2.2 - lean * 0.4, shy + 7], P.ochre);
  line(ctx, [shx - 3, shy - 0.3, shx + 2.2, shy - 0.3], 1.2, P.clay2);
  ell(ctx, hx + 0.3, hy + 0.5, 3, 2.1, P.hide1);
  line(ctx, [hx + 1.2, hy + 1.5, hx + 2.4, hy + 5], 1.4, P.hide0);
  // near leg
  leg(ctx, hx, hy, legA, legA - Math.max(0, -legA) * 0.3 + 0.1 - crouch * 0.1, 6.5, 6.6 - crouch * 0.3, 2.4, skin, skinD);
  // head
  const hdx = shx + 0.8, hdy = shy - 3.6;
  ell(ctx, hdx, hdy, 2.9, 3.1, skin);
  ell(ctx, hdx - 0.8, hdy - 1.6, 3, 1.9, P.ink); // hair
  px(ctx, hdx - 3, hdy - 0.2, P.ink);
  line(ctx, [hdx - 2.6, hdy - 1.2, hdx + 2.4, hdy - 1.4], 1, P.ochre);
  px(ctx, hdx + 1.6, hdy - 0.3, P.ink); // eye
  px(ctx, hdx + 1.2, hdy + 0.8, P.ochre); // face paint
  px(ctx, hdx + 0.2, hdy + 0.8, P.ochre);
  if (pose === 'search') px(ctx, hdx + 2.5, hdy + 0.5, P.skin3);
  // near arm + spear
  const aA = armA;
  const [ex, ey] = leg(ctx, shx, shy + 0.5, aA * 0.7, aA * 0.7 - (pose === 'windup' ? 0.4 : -0.6), 4.5, 4.2, 2, skin, null);
  if (pose !== 'throw') {
    let sa; // spear angle (radians, 0 = pointing right)
    if (pose === 'windup') sa = -0.08;
    else if (pose === 'run') sa = -0.35 + s * 0.08;
    else if (pose === 'search') sa = -1.2;
    else sa = -1.25 + s * 0.05;
    const len = 24;
    const cx = Math.cos(sa), cy = Math.sin(sa);
    const bx = ex - cx * len * 0.45, by = ey - cy * len * 0.45;
    const tx = ex + cx * len * 0.55, ty = ey + cy * len * 0.55;
    line(ctx, [bx, by, tx, ty], 1, P.bark2);
    tri(ctx, [tx + cx * 3.2, ty + cy * 3.2], [tx - cy * 1.3, ty + cx * 1.3], [tx + cy * 1.3, ty - cx * 1.3], P.rock3);
  }
  ell(ctx, ex, ey, 1.1, 1.1, skin);
  if (night && pose !== 'windup') {
    // torch in far hand
    line(ctx, [shx - 3, shy + 5, shx - 4, shy - 4], 1.4, P.bark1);
  }
  void W;
}

// ---------- props ----------
function acacia(seed) {
  const r = rng(seed);
  const w = 84, h = 70;
  const c = canvas(w, h), x = c.getContext('2d');
  const tx = w / 2 + r.range(-3, 3);
  line(x, [tx, h - 2, tx + r.range(-2, 2), h - 18], 3.4, P.bark1);
  const forks = r.int(3, 5);
  const top = r.range(18, 24);
  for (let i = 0; i < forks; i++) {
    const ex = w / 2 + (i / (forks - 1) - 0.5) * r.range(34, 48);
    line(x, [tx, h - 17, (tx + ex) / 2, h - 28 - r.range(0, 6), ex, top + 5], 2, P.bark1);
  }
  const blobs = [];
  for (let i = 0; i < 9; i++) {
    blobs.push([w / 2 + r.range(-32, 32), top + r.range(-4, 4), r.range(9, 15), r.range(4, 6)]);
  }
  for (const [bx, by, rx, ry] of blobs) ell(x, bx, by + 2, rx, ry, P.leaf0);
  for (const [bx, by, rx, ry] of blobs) ell(x, bx, by, rx * 0.92, ry * 0.85, P.leaf1);
  for (const [bx, by, rx, ry] of blobs) ell(x, bx - 1, by - 1.5, rx * 0.7, ry * 0.5, P.leaf2);
  for (const [bx, by, rx] of blobs) if (r() < 0.6) ell(x, bx - 2, by - 2.5, rx * 0.35, 1.2, P.leaf3);
  crisp(c);
  return { img: c, ox: w / 2, oy: h - 3, shadow: { rx: 36, ry: 11, dy: -1 }, shade: 40, solid: 4 };
}

function baobab(seed) {
  const r = rng(seed);
  const w = 60, h = 78;
  const c = canvas(w, h), x = c.getContext('2d');
  const cx = w / 2;
  ctx2(x, () => {
    x.fillStyle = P.bark1;
    x.beginPath();
    x.moveTo(cx - 12, h - 2);
    x.quadraticCurveTo(cx - 16, h - 30, cx - 7, h - 48);
    x.lineTo(cx + 7, h - 48);
    x.quadraticCurveTo(cx + 16, h - 30, cx + 12, h - 2);
    x.closePath();
    x.fill();
  });
  ell(x, cx + 4, h - 26, 5, 20, P.bark2);
  ell(x, cx - 6, h - 24, 3, 18, P.bark0);
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + r.range(-1.1, 1.1);
    const L = r.range(12, 20);
    const sx = cx + r.range(-5, 5), sy = h - 46;
    const ex = sx + Math.cos(a) * L, ey = sy + Math.sin(a) * L * 0.7;
    line(x, [sx, sy, ex, ey], 2.4, P.bark1);
    ell(x, ex, ey - 1, r.range(5, 8), r.range(3, 4.5), P.leaf1);
    ell(x, ex - 1, ey - 2, 3.5, 1.8, P.leaf2);
  }
  crisp(c);
  return { img: c, ox: w / 2, oy: h - 3, shadow: { rx: 24, ry: 8, dy: -1 }, shade: 28, solid: 11 };
}
function ctx2(x, f) { x.save(); f(); x.restore(); }

function bush(seed, thorn) {
  const r = rng(seed);
  const w = 26, h = 20;
  const c = canvas(w, h), x = c.getContext('2d');
  const cols = thorn ? [P.thorn0, P.thorn1, P.leaf2] : [P.leaf0, P.leaf1, P.leaf2];
  const b = [];
  for (let i = 0; i < 6; i++) b.push([w / 2 + r.range(-7, 7), h - 7 + r.range(-3, 2), r.range(4, 6.5)]);
  for (const [bx, by, rr] of b) ell(x, bx, by, rr, rr * 0.8, cols[0]);
  for (const [bx, by, rr] of b) ell(x, bx - 0.5, by - 1, rr * 0.75, rr * 0.55, cols[1]);
  for (const [bx, by, rr] of b) if (r() < 0.5) ell(x, bx - 1, by - 2, rr * 0.3, rr * 0.25, cols[2]);
  if (thorn) for (let i = 0; i < 14; i++) px(x, r.range(3, w - 3), r.range(4, h - 4), P.bone0);
  else for (let i = 0; i < 3; i++) px(x, r.range(5, w - 5), r.range(6, h - 6), P.ochre);
  crisp(c);
  return { img: c, ox: w / 2, oy: h - 3, shadow: { rx: 11, ry: 4, dy: 0 } };
}

function boulder(seed, big) {
  const r = rng(seed);
  const w = big ? 64 : 24, h = big ? 44 : 18;
  const c = canvas(w, h), x = c.getContext('2d');
  const n = big ? 5 : 1;
  const stones = [];
  for (let i = 0; i < n; i++) {
    const rx = big ? r.range(9, 16) : r.range(8, 10);
    const ry = big ? r.range(8, 14) : r.range(5.5, 7);
    stones.push([w / 2 + (big ? r.range(-18, 18) : 0), h - ry - 2 - (big ? r.range(0, 8) : 0), rx, ry]);
  }
  stones.sort((a, b) => a[1] - b[1]);
  for (const [sx, sy, rx, ry] of stones) {
    ell(x, sx, sy, rx, ry, P.rock1);
    ell(x, sx - rx * 0.2, sy - ry * 0.3, rx * 0.72, ry * 0.6, P.rock2);
    ell(x, sx - rx * 0.35, sy - ry * 0.5, rx * 0.35, ry * 0.25, P.rock3);
    ell(x, sx + rx * 0.3, sy + ry * 0.55, rx * 0.6, ry * 0.3, P.rock0);
    if (r() < 0.6) line(x, [sx + r.range(-3, 3), sy - ry * 0.6, sx + r.range(-2, 4), sy + ry * 0.3], 1, P.rock0);
  }
  crisp(c);
  return { img: c, ox: w / 2, oy: h - 3, shadow: { rx: big ? 30 : 11, ry: big ? 8 : 3.5, dy: 0 }, shade: big ? 26 : 0, solid: big ? 20 : 8 };
}

function termite(seed) {
  const r = rng(seed);
  const w = 18, h = 30;
  const c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = P.clay1;
  x.beginPath();
  x.moveTo(2, h - 2);
  x.quadraticCurveTo(4, h - 14, 8 + r.range(-1, 1), 2);
  x.quadraticCurveTo(12, h - 16, 15, h - 2);
  x.closePath();
  x.fill();
  ell(x, 6, h - 12, 2, 8, P.clay2);
  ell(x, 12, h - 8, 2, 5, P.clay0);
  crisp(c);
  return { img: c, ox: w / 2, oy: h - 3, shadow: { rx: 7, ry: 2.5, dy: 0 }, solid: 5 };
}

function bones(seed) {
  const r = rng(seed);
  const c = canvas(20, 12), x = c.getContext('2d');
  for (let i = 0; i < 4; i++) line(x, [4 + i * 3, 3, 5 + i * 3 + r.range(-1, 1), 9], 1, P.bone);
  line(x, [3, 6, 15, 6], 1.2, P.bone0);
  ell(x, 16, 6, 2.6, 2.2, P.bone);
  px(x, 16.5, 5.5, P.ink);
  crisp(c);
  return { img: c, ox: 10, oy: 9 };
}

function reeds(seed) {
  const r = rng(seed);
  const c = canvas(14, 18), x = c.getContext('2d');
  for (let i = 0; i < 6; i++) {
    const bx = r.range(2, 12);
    line(x, [bx, 17, bx + r.range(-2, 2), r.range(3, 8)], 1, r() < 0.5 ? P.lush1 : P.lush2);
  }
  for (let i = 0; i < 2; i++) ell(x, r.range(4, 10), r.range(3, 6), 0.8, 1.8, P.mud1);
  crisp(c, { outline: false });
  return { img: c, ox: 7, oy: 16 };
}

// ---------- HUD icons (drawn tiny, scaled up with CSS) ----------
function icon(draw) {
  const c = canvas(14, 14), x = c.getContext('2d');
  draw(x);
  crisp(c);
  return c.toDataURL();
}

export function makeIcons() {
  return {
    heat: icon((x) => {
      ell(x, 7, 7, 3.4, 3.4, P.fire1);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        line(x, [7 + Math.cos(a) * 4.5, 7 + Math.sin(a) * 4.5, 7 + Math.cos(a) * 5.6, 7 + Math.sin(a) * 5.6], 1, P.fire0);
      }
      ell(x, 6, 6, 1.4, 1.4, P.fire2);
    }),
    stamina: icon((x) => {
      tri(x, [8, 1], [3, 8], [7, 8], P.hint);
      tri(x, [6, 13], [11, 6], [7, 6], P.hint);
      line(x, [6.5, 7, 7.5, 7], 2, P.hint);
    }),
    water: icon((x) => {
      tri(x, [7, 1.5], [3.2, 8], [10.8, 8], P.water2);
      ell(x, 7, 8.8, 3.9, 3.7, P.water2);
      ell(x, 5.8, 8.6, 1, 1.5, P.foam);
    }),
    food: icon((x) => {
      line(x, [3, 11, 6, 8], 2, P.bone);
      ell(x, 3, 11.5, 1.3, 1.3, P.bone);
      ell(x, 8.5, 5.5, 4.2, 3.4, P.blood1, -0.7);
      ell(x, 9.3, 4.6, 1.6, 1, P.clay2, -0.7);
    }),
    health: icon((x) => {
      ell(x, 7, 9, 3.1, 2.6, P.fur2);
      ell(x, 3, 5.5, 1.4, 1.7, P.fur2);
      ell(x, 5.8, 3.5, 1.4, 1.7, P.fur2);
      ell(x, 8.8, 3.5, 1.4, 1.7, P.fur2);
      ell(x, 11.3, 5.5, 1.4, 1.7, P.fur2);
    }),
    hunter: icon((x) => {
      ell(x, 7, 4, 2.2, 2.3, P.skin2);
      line(x, [7, 6, 7, 10], 3, P.skin2);
      line(x, [2, 12, 12, 1], 1, P.bark2);
      tri(x, [13, 0], [10.5, 1.5], [11.8, 2.8], P.rock4);
    }),
  };
}

// ---------- build everything ----------
export function buildArt() {
  const A = {};
  const frames = (spec, gait, n) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const c = canvas(spec.w, spec.h);
      drawQuad(c.getContext('2d'), spec, gait, i / n);
      out.push(crisp(c));
    }
    return out;
  };
  const quad = (spec, gaits) => {
    const o = { w: spec.w, h: spec.h, ox: spec.body.x, oy: spec.ground };
    for (const [g, n] of gaits) o[g] = frames(spec, g, n);
    return o;
  };
  A.cat = quad(catSpec(), [['idle', 8], ['walk', 8], ['run', 8], ['lie', 8], ['drink', 4], ['pounce', 1], ['dead', 1]]);
  A.gazelle = quad(gazelleSpec(), [['idle', 4], ['walk', 8], ['run', 8], ['drink', 2], ['dead', 1]]);
  A.dog = quad(dogSpec(), [['idle', 4], ['run', 8], ['walk', 8], ['dead', 1], ['pounce', 1]]);
  A.hyena = quad(hyenaSpec(), [['idle', 4], ['walk', 8], ['run', 8], ['drink', 2]]);

  // hare: tiny hop cycle
  A.hare = { ox: 8, oy: 12, idle: [], run: [], dead: [] };
  for (let i = 0; i < 6; i++) {
    const c = canvas(18, 14), x = c.getContext('2d');
    const t = i / 6, hop = Math.sin(t * Math.PI) * 3;
    ell(x, 8, 9 - hop, 4.2 + Math.sin(t * Math.PI) * 1.2, 2.8, P.hare1);
    ell(x, 12, 7 - hop, 2.2, 2, P.hare1);
    line(x, [11, 5.5 - hop, 9.5 - hop * 0.3, 1 - hop * 0.3], 1.3, P.hare2);
    ell(x, 4.5, 8.5 - hop, 1.3, 1.3, P.bone);
    px(x, 13, 6.5 - hop, P.ink);
    ell(x, 7.5, 10.5 - hop, 2.8, 1, P.hare2);
    A.hare.run.push(crisp(c));
  }
  {
    const c = canvas(18, 14), x = c.getContext('2d');
    ell(x, 8, 9.5, 4, 2.8, P.hare1);
    ell(x, 11.5, 7, 2.1, 2, P.hare1);
    line(x, [11, 5.5, 10.5, 0.8], 1.3, P.hare2);
    line(x, [11.8, 5.5, 12.4, 1], 1.1, P.hare1);
    ell(x, 4.5, 9, 1.3, 1.3, P.bone);
    px(x, 12.5, 6.5, P.ink);
    A.hare.idle.push(crisp(c));
    const d = canvas(18, 14), y = d.getContext('2d');
    ell(y, 9, 10, 4.5, 2, P.hare1);
    px(y, 12, 9, P.blood1);
    A.hare.dead.push(crisp(d));
  }

  // hunters (two skin variants), day and night (torch) versions
  A.hunter = [];
  for (let v = 0; v < 2; v++) {
    const set = { ox: 13, oy: 38 };
    for (const night of [false, true]) {
      const k = night ? 'n' : 'd';
      set[k] = {};
      for (const [pose, n] of [['walk', 8], ['run', 8], ['search', 4], ['windup', 1], ['throw', 1], ['down', 1]]) {
        set[k][pose] = [];
        for (let i = 0; i < n; i++) {
          const c = canvas(34, 42);
          drawHuman(c.getContext('2d'), pose, i / n, night, v);
          set[k][pose].push(crisp(c));
        }
      }
    }
    A.hunter.push(set);
  }

  // thrown spear (drawn at runtime as a line; this is the stuck-in-ground version)
  {
    const c = canvas(20, 20), x = c.getContext('2d');
    line(x, [4, 17, 15, 3], 1, P.bark2);
    tri(x, [17, 0.5], [13.5, 2.5], [15.5, 4.5], P.rock3);
    A.spearStuck = crisp(c, { outline: false });
  }

  // vulture, top-down, 2 wing frames
  A.vulture = [0, 1, 2, 3].map((i) => {
    const c = canvas(22, 12), x = c.getContext('2d');
    const f = Math.sin((i / 4) * TAU) * 2.5;
    line(x, [1, 6 + f, 6, 4, 11, 5, 16, 4, 21, 6 + f], 1.8, P.inkSoft);
    ell(x, 11, 6, 2, 3, P.inkSoft);
    px(x, 11, 3, P.bone0);
    return crisp(c, { outline: false });
  });

  // carcass
  {
    const c = canvas(30, 16), x = c.getContext('2d');
    ell(x, 14, 10, 9, 3.5, P.gaz1);
    ell(x, 13, 10, 5, 2.5, P.blood);
    line(x, [11, 9, 17, 9], 1, P.bone);
    line(x, [22, 9, 27, 11], 1.4, P.gaz0);
    line(x, [5, 10, 2, 13], 1.2, P.gaz0);
    A.carcass = crisp(c);
    const d = canvas(30, 16), y = d.getContext('2d');
    for (let i = 0; i < 4; i++) line(y, [9 + i * 3, 7, 10 + i * 3, 12], 1, P.bone);
    line(y, [7, 10, 21, 10], 1.2, P.bone0);
    ell(y, 23, 10, 2.5, 2, P.bone);
    A.carcassBones = crisp(d);
  }

  A.props = {
    acacia: [11, 12, 13, 14, 15].map(acacia),
    baobab: [21, 22].map(baobab),
    bush: [31, 32, 33].map((s) => bush(s, false)),
    thorn: [41, 42, 43].map((s) => bush(s, true)),
    boulder: [51, 52, 53].map((s) => boulder(s, false)),
    kopje: [61, 62, 63].map((s) => boulder(s, true)),
    termite: [71, 72].map(termite),
    bones: [81, 82].map(bones),
    reeds: [91, 92, 93].map(reeds),
  };
  A.icons = makeIcons();
  return A;
}

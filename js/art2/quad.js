// Quadruped rig. A creature is a spec (proportions, colors, a head, a tail, markings); the rig
// supplies the skeleton and the gaits.
//
// Feet are driven, not swung: each foot follows a path (planted and sliding back under the body
// in stance, lifted and carried forward in swing) and the leg is solved back to the body with
// two-bone IK, so paws plant, knees and hocks bend the right way, and nothing skates.
// The gallop has both flight phases (gathered and stretched) with the spine flexing between them.
//
// Sprite space: origin on the ground under the middle of the body, +x is forward, y is down
// (so heights are negative).
import { Pix, cropFrames, ik, lerp, clamp, ease, TAU } from './pix.js';

// ---------- interpolation ----------
// Smooth curve through keys [[t, v0, v1, ...], ...] (Catmull-Rom on uneven knots), clamped at the ends.
export function spline(keys, s) {
  const n = keys.length;
  s = clamp(s, keys[0][0], keys[n - 1][0]);
  let i = 0;
  while (i < n - 2 && keys[i + 1][0] <= s) i++;
  const a = keys[i], b = keys[i + 1], p = keys[Math.max(0, i - 1)], q = keys[Math.min(n - 1, i + 2)];
  const h = b[0] - a[0] || 1, t = (s - a[0]) / h, t2 = t * t, t3 = t2 * t;
  const out = [];
  for (let k = 1; k < a.length; k++) {
    const m0 = (b[k] - p[k]) / ((b[0] - p[0]) || 1), m1 = (q[k] - a[k]) / ((q[0] - a[0]) || 1);
    out.push((2 * t3 - 3 * t2 + 1) * a[k] + (t3 - 2 * t2 + t) * h * m0 + (-2 * t3 + 3 * t2) * b[k] + (t3 - t2) * h * m1);
  }
  return out;
}
// Same, but periodic over t in 0..1.
export function loop(keys, t) {
  t = ((t % 1) + 1) % 1;
  const n = keys.length;
  const ext = [
    [keys[n - 2 < 0 ? 0 : n - 2][0] - 1, ...keys[n - 2 < 0 ? 0 : n - 2].slice(1)],
    [keys[n - 1][0] - 1, ...keys[n - 1].slice(1)],
    ...keys,
    [keys[0][0] + 1, ...keys[0].slice(1)],
    [keys[Math.min(1, n - 1)][0] + 1, ...keys[Math.min(1, n - 1)].slice(1)],
  ];
  let i = 1;
  while (i < ext.length - 3 && ext[i + 1][0] <= t) i++;
  const a = ext[i], b = ext[i + 1], p = ext[i - 1], q = ext[i + 2];
  const h = b[0] - a[0] || 1, u = (t - a[0]) / h, u2 = u * u, u3 = u2 * u;
  const out = [];
  for (let k = 1; k < a.length; k++) {
    const m0 = (b[k] - p[k]) / ((b[0] - p[0]) || 1), m1 = (q[k] - a[k]) / ((q[0] - a[0]) || 1);
    out.push((2 * u3 - 3 * u2 + 1) * a[k] + (u3 - 2 * u2 + u) * h * m0 + (-2 * u3 + 3 * u2) * b[k] + (u3 - u2) * h * m1);
  }
  return out.length === 1 ? out[0] : out;
}

// ---------- foot paths ----------
// One leg's cycle. ph 0 = touchdown. Returns [x, y, toe]: x in strides (+0.5 front of the stroke,
// -0.5 back), y in lift units (0 on the ground, -1 at full lift), toe = foot-segment angle
// (0: toe straight below the wrist/hock, + toe ahead of it, - toe trailing behind it).
function cycle(ph, beta, swing, ta, tb) {
  ph = ((ph % 1) + 1) % 1;
  if (ph < beta) {
    const u = ph / beta;
    return [0.5 - u, 0, lerp(ta, tb, u * u * u)]; // heel peels off late in the stance
  }
  return spline(swing, (ph - beta) / (1 - beta));
}
const sw = (ta, tb, mid) => [[0, -0.5, 0, tb], ...mid, [1, 0.5, 0, ta]];

// Default gaits. Species override any field through spec.gaits.<name>.
// ph: touchdown phase of each leg (ff far front, nf near front, fh far hind, nh near hind).
const TA_F = 0.15, TB_F = -0.75, TA_H = 0.38, TB_H = -0.55;
export const GAITS = {
  walk: {
    beta: 0.62, ph: { nh: 0, nf: 0.25, fh: 0.5, ff: 0.75 }, stride: 1, lift: 1,
    swingF: sw(TA_F, TB_F, [[0.3, -0.34, -0.85, -1.15], [0.7, 0.3, -0.8, -0.3]]),
    swingH: sw(TA_H, TB_H, [[0.3, -0.36, -0.75, -0.95], [0.7, 0.26, -0.65, 0.0]]),
  },
  trot: {
    beta: 0.5, ph: { nh: 0, ff: 0, fh: 0.5, nf: 0.5 }, stride: 1.25, lift: 1.4,
    swingF: sw(TA_F, TB_F, [[0.3, -0.3, -0.9, -1.3], [0.7, 0.32, -0.85, -0.4]]),
    swingH: sw(TA_H, TB_H, [[0.3, -0.38, -0.8, -1.0], [0.7, 0.25, -0.7, 0.0]]),
  },
  run: {
    beta: 0.27, ph: { nh: 0, fh: 0.09, ff: 0.48, nf: 0.58 }, stride: 1, lift: 1,
    // front: folds up under the chest, then reaches out long before it lands
    swingF: sw(0.3, -0.95, [[0.22, -0.68, -0.75, -1.6], [0.5, -0.2, -1.0, -1.5], [0.8, 0.45, -0.8, 0.1]]),
    // hind: kicks out behind and up, trails through the stretched flight, then swings under
    swingH: sw(0.55, -0.5, [[0.18, -0.9, -0.55, -1.25], [0.45, -0.75, -1.0, -1.3], [0.78, 0.2, -0.85, -0.2]]),
    // [t, flex, hipDy, shDy]: flex +1 gathered (back arched, hips tucked), -1 stretched
    body: [[0, 0.75, 0.6, -0.9], [0.16, 0.25, 0.9, -1.1], [0.33, -1, -1.2, -1.4], [0.46, -0.8, -1.6, -0.6],
      [0.62, -0.2, -0.6, 1.0], [0.76, 0.6, -0.4, 0.3], [0.88, 1, -0.3, -0.6]],
  },
};

// ---------- building a pose ----------
// A pose: { hip: [dx, dy], sh: [dx, dy], flex, feet: { ff, nf, fh, nh: [x, y, toe] }, head: [dx, dy, ang], ... }
// Foot x is measured from the leg's own rest spot, y from the ground.
export function restPose(spec) {
  const st = spec.stance || {};
  return {
    hip: [0, 0], sh: [0, 0], flex: 0, breath: 0,
    feet: {
      ff: [st.ff ?? 1.2, 0, st.toeF ?? 0.12], nf: [st.nf ?? -0.6, 0, st.toeF ?? 0.12],
      fh: [st.fh ?? 1.4, 0, st.toeH ?? 0.38], nh: [st.nh ?? -0.8, 0, st.toeH ?? 0.38],
    },
    head: [0, 0, 0], gait: 'idle', p: 0,
  };
}


// ---------- shared still and one-shot poses ----------
// Sized from the creature's own proportions; tune per species with spec.tune = { crouch, reach, headLow, ... }.
export const POSES = {
  // sphinx: forelegs out in front, haunches folded, head up; slow breathing
  lie(sp, p) {
    const P = restPose(sp), b = Math.sin(p * TAU), B = sp.body, k = -sp.hip[1] / 10.6, T = sp.tune || {};
    P.hip = [1.0 * k, -sp.hip[1] - (B.butt[1] + 0.7)];
    P.sh = [0, -sp.sh[1] - (B.brisket[1] - 0.2) - b * 0.25];
    P.breath = b;
    const fx = 0.8 * (sp.front.l + sp.front.p), hx = 0.92 * sp.hind.u;
    P.feet = { ff: [fx + 1.6 * k, 0, 1.45], nf: [fx, 0, 1.45], fh: [hx + 1.2 * k, 0, 1.5], nh: [hx, 0, 1.5] };
    const h = T.lieHead || [0.4, -0.6];
    P.head = [h[0], h[1] - b * 0.3, h[2] || 0];
    P.blink = p >= 0.5 && p < 0.62;
    P.ear = p >= 0.12 && p < 0.25;
    return P;
  },
  // crouched at the water, head down, tongue lapping. tune.crouch: 1 = cat-like deep crouch, ~0.3 = long-legged grazer
  drink(sp, p) {
    const P = restPose(sp), b = Math.sin(p * TAU), k = -sp.hip[1] / 10.6, T = sp.tune || {}, cr = T.crouch ?? 1;
    P.hip = [0.3 * k, -sp.hip[1] * 0.3 * cr];
    P.sh = [0.6 * k, -sp.sh[1] * 0.33 * cr + b * 0.15];
    P.feet.ff = [2.8 * k, 0, 0.3]; P.feet.nf = [0.4 * k, 0, 0.3];
    P.headAbs = [sp.sh[0] + P.sh[0] + (T.reach ?? 9.4 * k), -(T.headLow ?? 3.8 * k) + (b > 0 ? 0 : 0.5), T.headDownAng || 0];
    P.lap = b > 0;
    P.headDown = true;
    return P;
  },
  // feeding: crouched over the kill, tearing upward
  eat(sp, p) {
    const P = restPose(sp), tug = Math.max(0, Math.sin(p * TAU)), k = -sp.hip[1] / 10.6, T = sp.tune || {}, cr = T.crouch ?? 1;
    P.hip = [0.3 * k, -sp.hip[1] * 0.26 * cr];
    P.sh = [(0.4 - tug * 0.9) * k, -sp.sh[1] * (0.32 - tug * 0.12) * cr];
    P.feet.ff = [2.8 * k, 0, 0.3]; P.feet.nf = [0.4 * k, 0, 0.3];
    P.headAbs = [sp.sh[0] + P.sh[0] + (T.reach ?? 9.4 * k) - 0.6 - tug * 1.2 * k, -(T.headLow ?? 3.8 * k) - 0.2 - tug * 2.0 * k, T.headDownAng || 0];
    P.headDown = true;
    P.tug = tug;
    return P;
  },
  // one shot: crouch -> launch -> full stretch -> reach -> land
  pounce(sp, p) {
    const P = restPose(sp), k = -sp.hip[1] / 10.6;
    const K = spline([
      // t, hipDx, hipDy, shDx, shDy, flex, front x, front y, front toe, hind x, hind y, hind toe, headDy
      [0.00, 1.2, 3.2, -0.6, 3.6, 0.9, 1.0, 0, 0.3, 3.0, 0, 0.5, 1.6],
      [0.25, -0.4, 0.4, 1.0, -3.4, -0.5, 6.5, -6.5, 0.9, -6.0, 0, -0.6, 0.6],
      [0.50, -0.8, -5.2, 1.4, -6.4, -1.0, 9.5, -7.5, 1.2, -10.5, -6.0, -1.35, 0.8],
      [0.75, -0.2, -5.8, 0.8, -3.6, -0.3, 8.5, -2.6, 0.7, -8.0, -7.5, -1.2, 1.4],
      [1.00, 1.4, -2.2, 0, 1.8, 0.7, 4.5, 0, 0.2, -1.0, -5.0, -0.9, 1.8],
    ], p);
    P.hip = [K[0] * k, K[1] * k]; P.sh = [K[2] * k, K[3] * k]; P.flex = K[4];
    P.feet = { ff: [(K[5] + 1.6) * k, (K[6] - 0.6) * k, K[7]], nf: [K[5] * k, K[6] * k, K[7]], fh: [(K[8] + 1.6) * k, K[9] * k, K[10]], nh: [K[8] * k, K[9] * k, K[10]] };
    for (const f in P.feet) if (P.feet[f][1] > -0.2) P.feet[f][1] = 0;
    const hr = (sp.headAt && (sp.headAt.run || sp.headAt.idle)) || [0, 0];
    P.head = [hr[0], hr[1] + (K[11] - 1.4) * k, 0];
    P.mouth = p > 0.15;
    return P;
  },
  // on its side, legs out stiff, head on the ground
  dead(sp) {
    const P = restPose(sp), B = sp.body, k = -sp.hip[1] / 10.6, T = sp.tune || {};
    P.hip = [0.6 * k, -sp.hip[1] - (B.butt[1] + 0.9)];
    P.sh = [0, -sp.sh[1] - (B.brisket[1] - 0.4)];
    const f = 0.7 * (sp.front.u + sp.front.l + sp.front.p), h = 0.63 * (sp.hind.u + sp.hind.l + sp.hind.p);
    P.feet = { ff: [f, -0.6, 1.5], nf: [f - 1.4 * k, -2.6 * k, 1.3], fh: [h, -0.6, 1.5], nh: [h - 1.6 * k, -2.8 * k, 1.3] };
    P.headAbs = [sp.sh[0] + (T.deadReach ?? 8.4 * k), -(T.deadHead ?? 3.2 * k), T.headDownAng || 0];
    P.deadPose = true;
    return P;
  },
};

export function gaitPose(spec, gait, p) {
  const own = (spec.poses && spec.poses[gait]) || POSES[gait];
  if (own) { const r = own(spec, p); if (r) return { gait, p, ...r }; }
  const pose = restPose(spec);
  pose.gait = gait; pose.p = p;
  const hd = (spec.headAt && (spec.headAt[gait] || spec.headAt.idle)) || [0, 0, 0];
  pose.head = [hd[0], hd[1], hd[2] || 0];
  const s1 = Math.sin(p * TAU), c1 = Math.cos(p * TAU);

  if (gait === 'idle') {
    pose.breath = s1;
    pose.sh[1] = -0.2 * s1; pose.hip[1] = -0.1 * s1;
    pose.head[1] += -0.35 * s1;
    pose.blink = p >= 0.62 && p < 0.75;
    pose.ear = p >= 0.25 && p < 0.38;
    return pose;
  }
  if (gait === 'walk' || gait === 'trot' || gait === 'stalk') {
    const G = { ...GAITS[gait === 'stalk' ? 'walk' : gait], ...(spec.gaits && spec.gaits[gait]) };
    const S = (spec.stride || 8) * G.stride, lf = (spec.lift || 2.2) * G.lift;
    for (const k of ['ff', 'nf', 'fh', 'nh']) {
      const front = k[1] === 'f';
      const [x, y, toe] = cycle(p - G.ph[k], G.beta, front ? G.swingF : G.swingH, front ? TA_F : TA_H, front ? TB_F : TB_H);
      pose.feet[k] = [x * S + (front ? G.shiftF || 0 : G.shiftH || 0), y * lf * (front ? 1 : 0.85), toe];
    }
    // each girdle rides lowest as its legs pass under it, twice a cycle
    const bob = G.bob ?? (gait === 'trot' ? 0.7 : 0.45);
    pose.sh[1] = -bob * Math.cos((p - G.ph.nf) * TAU * 2 + 0.6) * 0.5 + (G.shDy || 0);
    pose.hip[1] = -bob * Math.cos((p - G.ph.nh) * TAU * 2 + 0.6) * 0.5 + (G.hipDy || 0);
    pose.head[1] += Math.cos((p - G.ph.nf) * TAU * 2 - 0.5) * (G.nod ?? 0.45);
    pose.head[0] += Math.sin((p - G.ph.nf) * TAU * 2 - 0.5) * 0.25;
    pose.sway = s1;
    return pose;
  }
  if (gait === 'run') {
    const G = { ...GAITS.run, ...(spec.gaits && spec.gaits.run) };
    const S = (spec.runStride || (spec.stride || 8) * 1.45), lf = (spec.runLift || (spec.lift || 2.2) * 1.9);
    const fa = G.flexAmp ?? 1;
    const [flex, hipDy, shDy] = loop(G.body, p);
    pose.flex = flex * fa;
    for (const k of ['ff', 'nf', 'fh', 'nh']) {
      const front = k[1] === 'f';
      const sk = front ? G.swingF : G.swingH;
      const [x, y, toe] = cycle(p - G.ph[k], G.beta, sk, sk[sk.length - 1][3], sk[0][3]);
      pose.feet[k] = [x * S * (front ? G.strideF ?? 0.92 : 1) + (front ? G.shiftF ?? -0.5 : G.shiftH ?? 2.6), y * lf, toe];
    }
    const ba = G.bobAmp ?? 1;
    pose.hip = [pose.flex * (G.tuck ?? 1.6), hipDy * ba];
    pose.sh = [-pose.flex * 0.7, shDy * ba];
    // the head stays level while the shoulders work under it
    pose.head[1] += -shDy * ba * 0.7;
    pose.head[0] += pose.flex * 0.4;
    pose.mouth = true;
    pose.sway = s1;
    void c1;
    return pose;
  }
  return pose;
}

// ---------- solving the skeleton ----------
export function solve(spec, pose) {
  const H = [spec.hip[0] + pose.hip[0], spec.hip[1] + pose.hip[1]];
  const S = [spec.sh[0] + pose.sh[0], spec.sh[1] + pose.sh[1]];
  const J = { H, S, mid: [(H[0] + S[0]) / 2, (H[1] + S[1]) / 2], flex: pose.flex || 0, legs: {} };
  const far = spec.farOff || [1, -0.4];
  for (const k of ['ff', 'nf', 'fh', 'nh']) {
    const front = k[1] === 'f', isFar = k[0] === 'f';
    const L = front ? spec.front : spec.hind;
    const top = front ? S : H;
    const rest = (front ? spec.sh[0] : spec.hip[0]) + (L.x || 0);
    const f = pose.feet[k];
    const ox = isFar ? far[0] : 0, oy = isFar ? far[1] : 0;
    const a = [top[0] + ox + (L.jx || 0), top[1] + oy + (L.jy || 0)];
    let toe = [rest + f[0] + ox, Math.min(0, f[1])];
    const th = f[2];
    const lower = [toe[0] - Math.sin(th) * L.p, toe[1] - Math.cos(th) * L.p];
    const bend = (pose.bend && pose.bend[k]) ?? (front ? -1 : 1);
    const [jx, jy, tx, ty] = ik(a[0], a[1], lower[0], lower[1], L.u, L.l, bend);
    toe = [tx + Math.sin(th) * L.p, ty + Math.cos(th) * L.p];
    // nothing sinks into the ground
    const g = -0.3;
    J.legs[k] = { a, b: [jx, Math.min(g - 0.5, jy)], c: [tx, Math.min(g - 0.4, ty)], d: [toe[0], Math.min(0, toe[1])], toe: th, air: f[1] < -0.2, front, far: isFar };
  }
  const b = spec.body;
  J.tail = [H[0] + b.tail[0], H[1] + b.tail[1]];
  J.neck = [S[0] + b.neck[0], S[1] + b.neck[1]];
  const hr = spec.headRest;
  J.head = [S[0] + hr[0] + pose.head[0], S[1] + hr[1] + pose.head[1], (hr[2] || 0) + (pose.head[2] || 0)];
  if (pose.headAbs) J.head = pose.headAbs.slice();
  // body space: u runs hip (0) -> shoulder (1), v is depth below (+) / above (-) the spine line
  const ux = S[0] - H[0], uy = S[1] - H[1], L = Math.hypot(ux, uy), dep = spec.depth || 3.5;
  J.uv = (x, y) => [((x - H[0]) * ux + (y - H[1]) * uy) / (L * L), ((x - H[0]) * -uy + (y - H[1]) * ux) / L / dep];
  J.at = (u, v) => [H[0] + ux * u - (uy / L) * v * dep, H[1] + uy * u + (ux / L) * v * dep - (J.flex > 0 ? J.flex * (b.arch ?? 1.6) * Math.sin(clamp(u, 0, 1) * Math.PI) * 0.8 : 0)];
  return J;
}

// ---------- drawing ----------
function add(p, o) { return [p[0] + o[0], p[1] + o[1]]; }

export function drawLeg(g, spec, L, col, footCol) {
  const D = L.front ? spec.front : spec.hind, w = D.w;
  g.limb(L.a[0], L.a[1], L.b[0], L.b[1], w[0], w[1], col);
  g.limb(L.b[0], L.b[1], L.c[0], L.c[1], w[1], w[2], col);
  g.limb(L.c[0], L.c[1], L.d[0], L.d[1], w[2], w[3], col);
  if (spec.foot === 'hoof') {
    const hc = footCol || 'ink';
    const hw = D.hoof || 1.5;
    g.limb(lerp(L.c[0], L.d[0], 0.72), lerp(L.c[1], L.d[1], 0.72), L.d[0] + Math.sin(L.toe) * 0.3, L.d[1] + Math.cos(L.toe) * 0.3, hw, hw + 0.3, hc);
  } else {
    // paw: a low oval that sits flat when planted and hangs along the foot when lifted
    const pr = D.paw || [1.5, 1.05];
    const a = L.air ? clamp(Math.PI / 2 - L.toe, 0.2, 2.6) - Math.PI / 2 : 0;
    g.ell(L.d[0] + (L.air ? 0 : 0.7), L.d[1] - pr[1] + (L.air ? 0.6 : 0.05), pr[0], pr[1], footCol || col, a);
  }
  if (spec.legMarks) spec.legMarks(g, L, D);
}

export function drawTorso(g, spec, J, pose, col) {
  const b = spec.body, { H, S, mid } = J;
  const fl = J.flex, br = (pose.breath || 0) * 0.3;
  const arch = fl > 0 ? fl * (b.arch ?? 1.6) : fl * (b.sag ?? 0.3);
  const pts = [
    add(H, b.croup), add(H, b.rump), add(H, b.butt), add(H, b.groin),
    [mid[0] + (b.bellyX || 0), mid[1] + b.belly + br - Math.max(0, fl) * 0.6],
    add(S, [b.brisket[0], b.brisket[1] + br]), add(S, b.chest), add(S, b.throat), add(S, b.withers),
    [mid[0] + (b.backX || 0), mid[1] - b.back - arch],
  ];
  g.blob(pts, col, b.round ?? 0.5);
  return pts;
}

// A tail as a chain: seg lengths, angle(i, n) in radians measured from straight back (0) toward down (+).
export function tailPts(base, n, seg, angle) {
  const pts = [[base[0], base[1]]];
  let x = base[0], y = base[1];
  for (let i = 0; i < n; i++) {
    const a = angle(i / (n - 1), i);
    x -= Math.cos(a) * seg; y += Math.sin(a) * seg;
    pts.push([x, y]);
  }
  return pts;
}

// Draw one pose of a creature onto g. Order: far legs, tail, body + neck, near legs, head.
export function drawQuad(g, spec, pose) {
  const J = solve(spec, pose), C = spec.col;
  const hooks = spec.draw || {};
  g.part((c) => {
    drawLeg(c, spec, J.legs.ff, C.far, C.farFoot || C.far);
    drawLeg(c, spec, J.legs.fh, C.far, C.farFoot || C.far);
    if (hooks.farLegs) hooks.farLegs(c, J, pose);
  });
  if (hooks.behind) hooks.behind(g, J, pose);
  if (spec.tail) g.part((c) => spec.tail(c, J, pose));
  g.part((c) => {
    drawTorso(c, spec, J, pose, C.body);
    const nk = spec.neckW || [5, 4];
    const hb = spec.headBack ? add(J.head, spec.headBack) : J.head;
    if (spec.neckCurve) {
      const m = [(J.neck[0] + hb[0]) / 2 + spec.neckCurve[0], (J.neck[1] + hb[1]) / 2 + spec.neckCurve[1]];
      c.chain([[J.neck[0], J.neck[1], nk[0]], [m[0], m[1], (nk[0] + nk[1]) / 2], [hb[0], hb[1], nk[1]]], C.body);
    } else c.limb(J.neck[0], J.neck[1], hb[0], hb[1], nk[0], nk[1], C.body);
    if (hooks.body) hooks.body(c, J, pose);
    if (spec.coat) c.remap((x, y, hex) => { const [u, v] = J.uv(x, y); return spec.coat(u, v, hex, x, y, J, pose); });
    c.bevel(spec.bevel || { up: 1, down: 1 });
    if (spec.marks) spec.marks(c, J, pose);
  });
  g.part((c) => {
    drawLeg(c, spec, J.legs.nf, C.leg || C.body, C.foot || C.leg || C.body);
    drawLeg(c, spec, J.legs.nh, C.leg || C.body, C.foot || C.leg || C.body);
    if (hooks.nearLegs) hooks.nearLegs(c, J, pose);
    if (spec.legBevel) c.bevel(spec.legBevel);
  }, { sep: spec.sep ?? 1 });
  g.part((c) => spec.head(c, J.head[0], J.head[1], J.head[2], pose, J));
  if (hooks.front) hooks.front(g, J, pose);
  return J;
}

// ---------- frame sets ----------
// sets: [[name, frameCount, gaitName?], ...]. One-shot sequences (pounce) pass p = i / (n - 1).
export function quadFrames(spec, sets, { oneShot = ['pounce', 'die', 'hurt'] } = {}) {
  const st = spec.stage || { w: 120, h: 72, ax: 58, ay: 58 };
  const groups = {};
  for (const [name, n, gait] of sets) {
    groups[name] = [];
    for (let i = 0; i < n; i++) {
      const g = new Pix(st.w, st.h, st.ax, st.ay);
      const p = oneShot.includes(name) ? (n > 1 ? i / (n - 1) : 0.5) : i / n;
      drawQuad(g, spec, gaitPose(spec, gait || name, p));
      g.outline(spec.outline || {});
      if (spec.finish) spec.finish(g, name, p);
      groups[name].push(g);
    }
  }
  return cropFrames(groups);
}

export { lerp, clamp, ease, TAU };

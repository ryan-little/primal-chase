// Rocks and small ground props: boulders, kopjes, termite mounds, bones, logs, basalt, vents, driftwood.
//
// Rocks are modeled, not painted: each stone is a convex polyhedron (planes tangent to an ellipsoid,
// jittered, corners shaved by a slightly larger ellipsoid) and curved props (mound, log) are distance
// fields. A tiny orthographic ray caster at the game's camera tilt resolves every pixel to one face,
// lights it top-down (slight left bias, since props get mirrored) and quantizes to 5 ramp tones, so
// the forms come out as clean flat planes. Cast shadow, gap occlusion and contact darkening follow.
// Cracks, lichen, vents, plants and other detail are then placed by hand in screen space.
import { addColors, addRamp } from './pal.js';
import { shiftId, cid, hexOf } from './pix.js';
import { rng, clump, drawClumps, blade, strand, plant, still, lerp, clamp, TAU } from './flora.js';

addColors({
  lichO: '#b0814e', lichO2: '#c79f68', lichG: '#9aa067',
  aloeD: '#24342a', aloe0: '#3d5844', aloe1: '#5a7a5c', aloe2: '#7f9f7a', aloe3: '#a8c09a',
  driftD: '#4a4540', drift0: '#736d65', drift1: '#9a948a', drift2: '#bfb9ad', drift3: '#e0dbcf',
  kelpD: '#2a2812', kelp0: '#45441b', kelp1: '#666428', kelp2: '#8d8838',
  mushC: '#b0603a', glint: '#a6a4a8',
});
addRamp('aloe', ['aloeD', 'aloe0', 'aloe1', 'aloe2', 'aloe3'], 'olLeaf');
addRamp('drift', ['driftD', 'drift0', 'drift1', 'drift2', 'drift3'], 'olRock');
addRamp('kelp', ['kelpD', 'kelp0', 'kelp1', 'kelp2'], 'olLeaf');
addRamp('lich', ['lichO', 'lichO2'], 'olRock');

// ---------- vectors ----------
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const mv = (M, v) => [M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2], M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2], M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]];
const mtv = (M, v) => [M[0][0] * v[0] + M[1][0] * v[1] + M[2][0] * v[2], M[0][1] * v[0] + M[1][1] * v[1] + M[2][1] * v[2], M[0][2] * v[0] + M[1][2] * v[1] + M[2][2] * v[2]];
function mm(A, B) { return A.map((row) => [0, 1, 2].map((j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j])); }
function rotm(rx = 0, ry = 0, rz = 0) {
  const [ca, sa, cb, sb, cc, sc] = [Math.cos(rx), Math.sin(rx), Math.cos(ry), Math.sin(ry), Math.cos(rz), Math.sin(rz)];
  return mm([[cc, -sc, 0], [sc, cc, 0], [0, 0, 1]], mm([[cb, 0, sb], [0, 1, 0], [-sb, 0, cb]], [[1, 0, 0], [0, ca, -sa], [0, sa, ca]]));
}

// ---------- camera and light ----------
// World: x right, y away from the viewer, z up. The camera looks down at EL above the horizon.
const EL = 0.72, SE = Math.sin(EL), CE = Math.cos(EL);
const TOWARD = [0, -CE, SE], RAY = [0, CE, -SE];
const LIGHT = unit([-0.35, -0.12, 1]);
const proj = (x, y, z) => [x, -(y * SE + z * CE)];
const TH = [-0.05, 0.33, 0.6, 0.84];

// ---------- materials ----------
const GRANITE = { keys: ['rock0', 'rock1', 'rock2', 'rock3', 'rock4'], deep: 'rockD' };
const BASALT = { keys: ['basaltD', 'basalt0', 'basalt1', 'basalt2', 'basalt3'], deep: 'basaltD', th: [-0.2, 0.2, 0.5, 0.78] };
const CLAY = { keys: ['clayD', 'clay0', 'clay1', 'clay2', 'clay3'], deep: 'mudD' };
const BARK = { keys: ['barkD', 'bark0', 'bark1', 'bark2', 'bark3'], deep: 'barkD' };
const MOSS = ['lushD', 'lush0', 'lush1', 'lush2', 'lush3'];
const pick = (m, i) => (i < 0 ? m.deep : m.keys[Math.min(4, i)]);
const shiftKey = (col, d) => hexOf(shiftId(cid(col), d));

// ---------- convex stones ----------
// Planes tangent to an a*b*c ellipsoid, spread like a Fibonacci sphere and jittered.
function facets(r, [a, b, c], n = 16, jit = 0.06) {
  const out = [], off = r() * TAU;
  for (let i = 0; i < n; i++) {
    const z = 1 - 2 * (i + 0.5) / n, rr = Math.sqrt(1 - z * z), ph = i * 2.39996 + off;
    const nn = unit([Math.cos(ph) * rr + r.range(-0.18, 0.18), Math.sin(ph) * rr + r.range(-0.18, 0.18), z + r.range(-0.12, 0.12)]);
    const d = Math.sqrt(a * a * nn[0] ** 2 + b * b * nn[1] ** 2 + c * c * nn[2] ** 2) * (1 + r.range(-jit, jit * 0.5));
    out.push({ n: nn, d });
  }
  return out;
}
function convex({ at, size, planes, cuts = [], round = 1.07, rot = [0, 0, 0], mat = GRANITE, paint }) {
  const all = planes.concat(cuts.map((c) => ({ n: unit(c.n), d: c.d })));
  const E = round ? size.map((v) => v * round) : null;
  return { kind: 'convex', c: at, R: rotm(...rot), planes: all, E, size, mat, paint };
}
function hitConvex(ob, o, rd) {
  const lo = mtv(ob.R, sub(o, ob.c)), lr = mtv(ob.R, rd);
  let s0 = -1e9, s1 = 1e9, nIn = null;
  for (const { n, d } of ob.planes) {
    const nr = dot(n, lr), no = dot(n, lo);
    if (Math.abs(nr) < 1e-9) { if (no > d) return null; continue; }
    const s = (d - no) / nr;
    if (nr < 0) { if (s > s0) { s0 = s; nIn = n; } } else if (s < s1) s1 = s;
    if (s0 > s1) return null;
  }
  if (ob.E) {
    const E = ob.E;
    let A = 0, B = 0, C = -1;
    for (let k = 0; k < 3; k++) { const e2 = E[k] * E[k]; A += lr[k] * lr[k] / e2; B += 2 * lo[k] * lr[k] / e2; C += lo[k] * lo[k] / e2; }
    const disc = B * B - 4 * A * C;
    if (disc < 0) return null;
    const q = Math.sqrt(disc), e0 = (-B - q) / (2 * A), e1 = (-B + q) / (2 * A);
    if (e0 > s0) { s0 = e0; const p = add(lo, lr, e0); nIn = unit([p[0] / (E[0] * E[0]), p[1] / (E[1] * E[1]), p[2] / (E[2] * E[2])]); }
    if (e1 < s1) s1 = e1;
    if (s0 > s1) return null;
  }
  return { s: s0, e: s1, n: nIn && mv(ob.R, nIn) };
}
function nearConvex(ob, p) {
  const q = mtv(ob.R, sub(p, ob.c)), E = ob.E || ob.size;
  const v = Math.hypot(q[0] / E[0], q[1] / E[1], q[2] / E[2]);
  return (v - 1) * Math.min(E[0], E[1], E[2]);
}

// ---------- distance-field props ----------
function sdfObj(f, c, rad, mat, paint, step = 0.6, light) { return { kind: 'sdf', f, c, rad, mat, paint, step, light }; }
function hitSdf(ob, o, rd, maxS) {
  const oc = sub(o, ob.c), b = dot(oc, rd), cc = dot(oc, oc) - ob.rad * ob.rad, disc = b * b - cc;
  if (disc < 0) return null;
  let s = Math.max(0, -b - Math.sqrt(disc));
  const s1 = Math.min(maxS ?? 1e9, -b + Math.sqrt(disc));
  for (let k = 0; k < 160 && s < s1; k++) {
    const d = ob.f(add(o, rd, s));
    if (d < 0.02) {
      const p = add(o, rd, s), h = 0.06;
      const n = unit([ob.f(add(p, [h, 0, 0])) - ob.f(add(p, [-h, 0, 0])), ob.f(add(p, [0, h, 0])) - ob.f(add(p, [0, -h, 0])), ob.f(add(p, [0, 0, h])) - ob.f(add(p, [0, 0, -h]))]);
      return { s, e: s1, n };
    }
    s += Math.max(d * ob.step, 0.03);
  }
  return null;
}
const hitObj = (ob, o, rd) => (ob.kind === 'convex' ? hitConvex(ob, o, rd) : hitSdf(ob, o, rd));
const smin = (a, b, k) => { const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return lerp(b, a, h) - k * h * (1 - h); };
function ellD(p, c, r) {
  const q = [(p[0] - c[0]) / r[0], (p[1] - c[1]) / r[1], (p[2] - c[2]) / r[2]];
  return (Math.hypot(q[0], q[1], q[2]) - 1) * Math.min(r[0], r[1], r[2]);
}
function capD(p, a, b, r) {
  const pa = sub(p, a), ba = sub(b, a), h = clamp(dot(pa, ba) / dot(ba, ba), 0, 1);
  return Math.hypot(pa[0] - ba[0] * h, pa[1] - ba[1] * h, pa[2] - ba[2] * h) - r;
}

// ---------- the ray caster ----------
// Returns a G-buffer over the screen box [x0, y0, x1, y1) (sprite space, anchor at 0, 0):
// per pixel the object id, depth, 3D point, and the final color key.
function render(objs, [x0, y0, x1, y1], { shadows = true } = {}) {
  const w = x1 - x0, h = y1 - y0, n = w * h;
  const G = { x0, y0, w, h, objs, id: new Int16Array(n).fill(-1), s: new Float32Array(n), lum: new Int8Array(n), P: new Array(n), N: new Array(n), col: new Array(n).fill(null) };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const sx = x0 + i + 0.5, sy = y0 + j + 0.5;
    const o = [sx + 90 * TOWARD[0], -sy * SE + 90 * TOWARD[1], -sy * CE + 90 * TOWARD[2]];
    const sGround = o[2] / SE;
    let best = null, bk = -1;
    for (let k = 0; k < objs.length; k++) {
      const hh = objs[k].kind === 'convex' ? hitConvex(objs[k], o, RAY) : hitSdf(objs[k], o, RAY, sGround);
      if (hh && hh.n && hh.s < sGround && (!best || hh.s < best.s)) { best = hh; bk = k; }
    }
    if (!best) continue;
    const ob = objs[bk], p = add(o, RAY, best.s), nn = best.n;
    const th = ob.mat.th || TH, b = dot(nn, ob.light || LIGHT);
    let idx = 0;
    for (const t of th) if (b > t) idx++;
    if (shadows && b > 0) {
      for (let k = 0; k < objs.length; k++) {
        if (k === bk && objs[k].kind === 'convex') continue;
        // a curved prop shadowing itself: start clear of its own small bumps
        const sp = k === bk ? add(add(p, nn, 1), LIGHT, 1.5) : add(p, nn, 0.4);
        const hh = hitObj(objs[k], sp, LIGHT);
        if (hh && hh.e > 0.05) { idx -= 2; break; }
      }
    }
    for (let k = 0; k < objs.length; k++) {
      if (k === bk) continue;
      const d = objs[k].kind === 'convex' ? nearConvex(objs[k], p) : objs[k].f(p);
      if (d < 0.5) { idx -= 2; break; }
      if (d < 1.4) { idx -= 1; break; }
    }
    if (p[2] < 0.8) idx -= 1;
    idx = clamp(idx, -1, 4);
    const q = j * w + i;
    G.id[q] = bk; G.s[q] = best.s; G.lum[q] = idx; G.P[q] = p; G.N[q] = nn;
    G.col[q] = ob.paint ? ob.paint(p, nn, idx, ob) : pick(ob.mat, idx);
  }
  return G;
}
const gi = (G, x, y) => { const i = Math.floor(x) - G.x0, j = Math.floor(y) - G.y0; return i < 0 || j < 0 || i >= G.w || j >= G.h ? -1 : j * G.w + i; };
// Where one stone sits in front of another, a dark seam (the gap between them).
function seams(G, d = 2, gap = 1.5) {
  const { w, h, id, s } = G, out = G.col.slice();
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const q = j * w + i, a = id[q];
    if (a < 0) continue;
    for (const [di, dj] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= w || jj >= h) continue;
      const qq = jj * w + ii;
      if (id[qq] >= 0 && id[qq] !== a && s[qq] < s[q] - gap) { out[q] = G.objs[a].mat.deep && d > 1 ? G.objs[a].mat.deep : shiftKey(G.col[q], -d); break; }
    }
  }
  G.col = out;
}
// Lone pixels take their neighbors' color: no accidental noise from tiny facets.
function despeckle(G, passes = 2) {
  const { w, h, id } = G;
  for (let k = 0; k < passes; k++) {
    const out = G.col.slice();
    for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) {
      const q = j * w + i, c = G.col[q];
      if (!c) continue;
      const nb = [q - w, q + w, q - 1, q + 1].filter((qq) => id[qq] === id[q]).map((qq) => G.col[qq]);
      if (nb.length < 3 || nb.includes(c)) continue;
      const cnt = {};
      for (const v of nb) cnt[v] = (cnt[v] || 0) + 1;
      const [best, m] = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
      if (m >= 2) out[q] = best;
    }
    G.col = out;
  }
}
function blit(g, G) {
  for (let j = 0; j < G.h; j++) for (let i = 0; i < G.w; i++) {
    const c = G.col[j * G.w + i];
    if (c) g.px(G.x0 + i + 0.5, G.y0 + j + 0.5, c);
  }
}
function bbox(G, id) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let j = 0; j < G.h; j++) for (let i = 0; i < G.w; i++) {
    const a = G.id[j * G.w + i];
    if (a < 0 || (id != null && a !== id)) continue;
    x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j);
  }
  return [x0 + G.x0, y0 + G.y0, x1 + G.x0, y1 + G.y0];
}
// Integer pixels along a polyline (Bresenham per segment, no repeats).
function pixPath(pts) {
  const out = [], seen = new Set();
  for (let k = 0; k < pts.length - 1; k++) {
    let [i0, j0] = pts[k].map(Math.floor);
    const [i1, j1] = pts[k + 1].map(Math.floor);
    const dx = Math.abs(i1 - i0), dy = -Math.abs(j1 - j0), sx = i0 < i1 ? 1 : -1, sy = j0 < j1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      const key = i0 + ',' + j0;
      if (!seen.has(key)) { seen.add(key); out.push([i0, j0]); }
      if (i0 === i1 && j0 === j1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; i0 += sx; }
      if (e2 <= dx) { err += dx; j0 += sy; }
    }
  }
  return out;
}
// A crack: a dark line on one stone, with a lit lip under it where the face is in light.
function crack(G, pts, { id = null, dark = 2, lip = true } = {}) {
  const path = pixPath(pts), on = new Set();
  for (const [x, y] of path) {
    const q = gi(G, x, y);
    if (q < 0 || G.id[q] < 0 || (id != null && G.id[q] !== id)) continue;
    G.col[q] = shiftKey(G.col[q], -dark); on.add(q);
  }
  if (lip) for (const q of on) {
    const qq = q + G.w;
    if (qq < G.col.length && !on.has(qq) && G.id[qq] === G.id[q] && G.lum[qq] >= 2 && G.lum[qq] < 4) G.col[qq] = shiftKey(G.col[qq], 1);
  }
}
// Sheet-joint crack: follows the top contour of a stone, `off` pixels down.
function exfoliate(G, id, off, u0, u1, wob = 0) {
  const [bx0, , bx1] = bbox(G, id), pts = [];
  for (let x = Math.round(lerp(bx0, bx1, u0)); x <= Math.round(lerp(bx0, bx1, u1)); x++) {
    let top = null;
    for (let j = 0; j < G.h; j++) if (G.id[j * G.w + x - G.x0] === id) { top = j + G.y0; break; }
    if (top == null) continue;
    pts.push([x + 0.5, top + off + 0.5 + Math.round(Math.sin(x * 0.7) * wob)]);
  }
  // smooth the contour so the joint reads as one clean curve
  for (let k = 1; k < pts.length - 1; k++) pts[k][1] = Math.floor((pts[k - 1][1] + pts[k][1] * 2 + pts[k + 1][1]) / 4) + 0.5;
  if (pts.length > 1) crack(G, pts, { id, dark: 2, lip: true });
}
function botAt(G, x) {
  for (let j = G.h - 1; j >= 0; j--) if (G.id[j * G.w + Math.floor(x) - G.x0] >= 0) return j + G.y0;
  return 0;
}
function topAt(G, x, id = null) {
  for (let j = 0; j < G.h; j++) { const a = G.id[j * G.w + Math.floor(x) - G.x0]; if (a >= 0 && (id == null || a === id)) return j + G.y0; }
  return null;
}
// Lichen: a small deliberate cluster, only on lit rock.
function lichen(G, x, y, cols = ['lichO', 'lichO2']) {
  const pat = [[0, 0, 0], [1, 0, 1], [0, 1, 0], [-1, 1, 0]];
  for (const [dx, dy, k] of pat) {
    const q = gi(G, x + dx, y + dy);
    if (q >= 0 && G.id[q] >= 0 && G.lum[q] >= 2) G.col[q] = cols[k];
  }
}
function finish(G, { seam = 2 } = {}) { despeckle(G); if (seam) seams(G, seam); }

// ---------- ground bits ----------
// A prop whose dry grass is drawn after the outline: inked 1px blades turn into thick sticks.
function prop(draw, def, opts = {}) {
  const fn = (g, ...a) => { g.later = []; draw(g, ...a); g.outline(); for (const f of g.later) f(); };
  return plant(fn, def, { ...opts, frames: opts.frames ?? 1, outline: false });
}
function tuft(g, r, x, y, o = {}) {
  const v = [r(), r(), r(), r(), r(), r(), r(), r()];
  const q = () => v.shift() ?? 0.5;
  q.range = (a, b) => a + (b - a) * q();
  if (g.later) g.later.push(() => tuftNow(g, q, x, y, o)); else tuftNow(g, q, x, y, o);
}
function tuftNow(g, r, x, y, { n = 4, h = [3, 6], cols = ['tall0', 'tall1', 'tall2'], sway = 0, spread = 2 } = {}) {
  // blades fan out from one root so their tips separate
  const x0 = Math.round(x);
  for (let i = 0; i < n; i++) {
    const u = n > 1 ? i / (n - 1) - 0.5 : 0, len = r.range(h[0], h[1]) * (1 - Math.abs(u) * 0.5);
    const bx = x0 + (u < -0.2 ? -1 : u > 0.2 ? 1 : 0) * (spread > 1 ? 1 : 0);
    blade(g, bx, y, len, u * spread * 1.3 + r.range(-0.3, 0.3), sway * len * 0.12, cols[i % cols.length]);
  }
  g.px(x0 + 0.5, y - 0.5, 'tallD');
}
function pebble(g, x, y, big = false, cols = ['rock3', 'rock2', 'rock1']) {
  g.px(x, y, cols[0]); g.px(x + 1, y, cols[1]);
  if (big) { g.px(x, y + 1, cols[1]); g.px(x + 1, y + 1, cols[2]); }
}

// A small fern: arching fronds with leaflets on alternate sides.
function fern(g, x, y) {
  for (const [lean, h, col] of [[-4, 5, 'lush1'], [4, 5, 'lush1'], [-1.5, 6, 'lush2'], [1.8, 6, 'lush2']]) {
    const pts = [[x + 0.5, y - 0.5], [x + 0.5 + lean * 0.3, y - h * 0.7], [x + 0.5 + lean, y - h + Math.abs(lean) * 0.4]];
    strand(g, pts, col);
    for (let k = 1; k <= 2; k++) {
      const u = k / 3, px = lerp(pts[0][0], pts[2][0], u + 0.1), py = lerp(pts[0][1], pts[1][1], u * 1.3);
      g.px(px + (k % 2 ? -1 : 1), py, 'lush3');
    }
  }
}

// ---------- boulder ----------
const BOULDER_DEF = { shadow: { rx: 11, ry: 3.5, dy: 0 }, shade: 0, solid: 10 };
function boulder(seed, kind) {
  const r = rng(seed);
  let objs;
  if (kind === 'round') {
    const size = [8.4, 7, 6.6];
    objs = [convex({ at: [0, 0.5, 4.6], size, planes: facets(r, size, 11, 0.08), round: 1.1, rot: [0.05, -0.1, 0.6] })];
  } else if (kind === 'slab') {
    const size = [11, 6.4, 4.6];
    objs = [convex({ at: [0, 0.5, 2.9], size, planes: facets(r, size, 10, 0.05), cuts: [{ n: [0.08, 0.1, 1], d: 3.3 }, { n: [0.15, -1, 0.35], d: 5.6 }], round: 1.12, rot: [0, 0.14, 0.25] })];
  } else {
    // one boulder cracked in two along a joint, the halves eased apart
    const size = [9.6, 7, 6.6], planes = facets(r, size, 11, 0.08), ns = unit([1, -0.15, 0.08]);
    objs = [
      convex({ at: [-0.9, 0.6, 4.5], size, planes, cuts: [{ n: ns, d: -0.2 }], round: 1.07, rot: [0, 0, 0] }),
      convex({ at: [1.1, 0.3, 4.2], size, planes, cuts: [{ n: [-ns[0], -ns[1], -ns[2]], d: 0.2 }], round: 1.07, rot: [0, 0.08, 0] }),
    ];
  }
  const G = render(objs, [-17, -22, 17, 7]);
  finish(G);
  const [x0, y0, x1, y1] = bbox(G);
  const cx = (x0 + x1) / 2;
  if (kind === 'round') {
    crack(G, [[cx - 1.5, topAt(G, cx - 1.5) + 2.5], [cx - 0.5, y0 + 6.5], [cx + 1.5, y0 + 8.5], [cx + 1.5, y0 + 11.5]]);
    lichen(G, cx - 4, y0 + 3);
  } else if (kind === 'slab') {
    crack(G, [[cx + 3.5, topAt(G, cx + 3.5) + 0.5], [cx + 2.5, y0 + 4.5], [cx + 3.5, y0 + 6.5]]);
    lichen(G, cx - 5, y0 + 3);
  } else {
    crack(G, [[cx - 6, y0 + 7.5], [cx - 4, y0 + 8.5], [cx - 3, y0 + 10.5]], { id: 0 });
    lichen(G, cx + 3, y0 + 3);
  }
  return prop((g) => {
    const q = rng(seed + 5);
    blit(g, G);
    pebble(g, x0 - 1.5, y1 - 1.5, true);
    pebble(g, x1 + 1.5, y1 - 0.5);
    tuft(g, q, x1 - 2, y1 - 0.5, { n: 4, h: [3, 6] });
    if (kind !== 'slab') tuft(g, q, x0 + 3, y1 + 0.5, { n: 3, h: [2, 4] });
  }, BOULDER_DEF, { side: 24, up: 30, down: 10 });
}

// ---------- kopje ----------
const KOPJE_DEF = { shadow: { rx: 30, ry: 8, dy: 0 }, shade: 26, solid: 25 };
const KOPJE = [
  { // balanced rock perched on the pile
    stones: [[-14, 2, 6.5, 12.5, 9, 9], [13, 3, 6, 13, 9.5, 8.5], [0, -3.5, 3.4, 9, 6, 5.5], [0, 8, 11, 12, 8, 11], [1.5, 7.5, 25.5, 9.5, 7, 5.6]],
    exf: [[3, 3, 0.15, 0.85], [0, 3, 0.2, 0.8], [1, 4, 0.2, 0.75]], balanced: true,
  },
  { // a bush growing out of a crack
    stones: [[-15, 3, 7, 11, 8.5, 9.5], [-1, 7, 12, 12, 9, 12], [15, 3, 6.5, 12, 9, 8.5], [-7, -3, 4, 9, 6.5, 5.5], [9, -3, 3.5, 8, 6, 5], [8, 6, 21, 9, 7, 7.5]],
    exf: [[1, 3, 0.2, 0.8], [2, 3, 0.25, 0.85], [5, 2, 0.2, 0.8]], bush: [-8, 4, 17],
  },
  { // low wide pile with an aloe in a crack (sways)
    stones: [[-17, 2, 5.5, 11, 8, 7.5], [-3, 5, 9, 13, 9, 10], [14, 4, 8, 12, 8.5, 10], [5, -3, 3.5, 9, 6, 5], [-9, 8, 18, 10, 7, 7], [24, 1, 3, 6, 5, 4]],
    exf: [[1, 3, 0.2, 0.75], [2, 3, 0.2, 0.8], [4, 2, 0.2, 0.8]], aloe: [7, 0, 12],
  },
];
function kopje(seed, o) {
  const r = rng(seed);
  const objs = o.stones.map(([x, y, z, a, b, c], k) => {
    const size = [a, b, c], top = o.balanced && k === o.stones.length - 1;
    return convex({ at: [x, y, z], size, planes: facets(r, size, top ? 9 : 13, top ? 0.12 : 0.08), round: top ? 1.14 : 1.09, rot: [r.range(-0.1, 0.1), r.range(-0.12, 0.12), r.range(0, TAU)] });
  });
  const G = render(objs, [-36, -46, 36, 9]);
  finish(G);
  for (const [k, off, u0, u1] of o.exf) exfoliate(G, k, off, u0, u1);
  const [x0, , x1, y1] = bbox(G);
  // lichen on two lit tops
  for (const k of [0, 2]) { const [a, b, c] = bbox(G, k); lichen(G, Math.round(lerp(a, c, 0.35)), b + 3); }
  const vr = rng(seed + 9);
  const bp = o.bush && proj(...o.bush);
  const bush = o.bush && [clump(vr, bp[0] + 4, bp[1] + 1.5, 3.4, 2.4, { n: 8, tuft: [1.1, 1.6], rim: 0.6, shade: -1 }), clump(vr, bp[0] - 1, bp[1] - 0.5, 5.2, 3, { n: 13, tuft: [1.1, 1.8], rim: 0.7, flat: 0.4 })];
  const draw = (g, sway, t) => {
    const q = rng(seed + 3);
    blit(g, G);
    if (bush) {
      const [bx, by] = proj(...o.bush);
      g.limb(bx + 2.5, by + 5, bx + 1, by + 1, 1.4, 1, 'bark1'); g.pline(bx + 2.5, by + 5.5, bx + 3.5, by + 8.5, 'bark0');
      drawClumps(g, bush, ['leaf0', 'leaf1', 'leaf2', 'leaf3', 'leaf4'], 0, 0, { amp: 0, top: -60 });
    }
    if (o.aloe) aloe(g, ...proj(...o.aloe), sway, t);
    pebble(g, x0 + 2, y1 - 0.5, true); pebble(g, x1 - 3, y1 + 0.5); pebble(g, x0 + 12, y1 + 1.5);
    tuft(g, q, x0 + 4, y1 - 1, { n: 5, h: [4, 7], sway: o.aloe ? sway : 0 });
    tuft(g, q, x1 - 6, y1 - 1.5, { n: 4, h: [3, 6], sway: o.aloe ? sway : 0 });
    tuft(g, q, (x0 + x1) / 2 + 6, y1, { n: 3, h: [2, 4], sway: o.aloe ? sway : 0 });
  };
  return prop(draw, KOPJE_DEF, { side: 42, up: 56, down: 14, frames: o.aloe ? 8 : 1 });
}
// Aloe rosette from a crack: fleshy leaves fan out, a flower spike nods in the wind.
function aloe(g, x, y, sway, t) {
  const lv = [[-2.4, -0.6, 'aloe0'], [2.4, -0.7, 'aloe0'], [-1.7, -1.5, 'aloe1'], [1.8, -1.4, 'aloe1'], [-0.7, -2.1, 'aloe2'], [0.9, -2, 'aloe1']];
  const sx = x + 0.5 + sway * 1.2;
  strand(g, [[x + 0.5, y - 1], [x + 0.5 + sway * 0.3, y - 6], [sx, y - 11]], 'bark1');
  g.px(sx, y - 12, 'fire0'); g.px(sx, y - 13, 'fire1'); g.px(sx - 1, y - 11, 'ochre1'); g.px(sx + 1, y - 12, 'fire0'); g.px(sx, y - 14, 'fire1');
  for (const [a, b, col] of lv) {
    const len = Math.hypot(a, b) * 2.4, ang = Math.atan2(b, a), wob = sway * 0.4;
    g.limb(x + 0.5, y, x + 0.5 + Math.cos(ang) * len + wob * Math.abs(b), y + Math.sin(ang) * len, 2.4, 0.8, col);
  }
}

// ---------- termite mound ----------
const TERMITE_DEF = { shadow: { rx: 7, ry: 2.5, dy: 0 }, solid: 5 };
function spireD(p, s) {
  const h = clamp(p[2] / s.H, 0, 1);
  const cx = lerp(s.x, s.tx, h), cy = lerp(s.y, s.ty, h), dx = p[0] - cx, dy = p[1] - cy, th = Math.atan2(dy, dx);
  let rad = s.r1 + (s.r0 - s.r1) * Math.pow(1 - h, s.pw);
  rad += s.fl * Math.sin(th * s.k + h * 2.2 + s.ph) * (1 - h * 0.5); // erosion flutes
  rad += 0.3 * Math.sin(p[2] * 0.45 + s.ph) * (1 - h);
  return Math.max((Math.hypot(dx, dy) - rad) * 0.6, p[2] - s.H);
}
const TERMITE = [
  { // twin spires, as in the painting
    spires: [{ x: -2.5, y: 0.5, tx: -3.5, ty: 1, H: 32, r0: 5.6, r1: 1.0, pw: 1.5, fl: 0.7, k: 6, ph: 0.3 }, { x: 3.6, y: 1, tx: 5.2, ty: 1.6, H: 22, r0: 4.4, r1: 1.1, pw: 1.4, fl: 0.6, k: 5, ph: 2 }],
    buttress: [[-2.4, 0], [0.4, 1], [2.6, 0.4]], vents: [[-2.5, 13, -1.9], [4.2, 9, -1.4], [-3.2, 22, -1.6]],
  },
  { // single leaning spire, side broken open to the galleries
    spires: [{ x: 0.5, y: 0.5, tx: 2.6, ty: 1.4, H: 30, r0: 6.2, r1: 1.2, pw: 1.3, fl: 0.75, k: 6, ph: 1.1 }, { x: -4.5, y: 1.5, tx: -5, ty: 2, H: 12, r0: 3, r1: 1.0, pw: 1.2, fl: 0.4, k: 5, ph: 0.5 }],
    buttress: [[2.2, 0.2], [-0.8, 0.8]], vents: [[2.2, 21, -1.5], [3.2, 7, -1.2]], cave: [[-2.5, -4.6, 9], 4],
  },
];
function termite(seed, o) {
  const f = (p) => {
    let d = ellD(p, [0.5, 0.8, 0], [9, 7, 2.6]);
    for (const s of o.spires) d = smin(d, spireD(p, s), 2.2);
    for (const [a, len] of o.buttress) {
      const dir = [Math.cos(a), Math.sin(a)], b0 = [dir[0] * 2, dir[1] * 2 + 0.5, 9 + len * 3], b1 = [dir[0] * 7.2, dir[1] * 6 + 0.5, 0.5];
      d = smin(d, capD(p, b0, b1, 1.4), 1.6);
    }
    if (o.cave) d = Math.max(d, -(Math.hypot(p[0] - o.cave[0][0], p[1] - o.cave[0][1], p[2] - o.cave[0][2]) - o.cave[1]));
    return d;
  };
  const paint = (p, n, idx) => {
    if (o.cave && Math.abs(Math.hypot(p[0] - o.cave[0][0], p[1] - o.cave[0][1], p[2] - o.cave[0][2]) - o.cave[1]) < 0.12) {
      // inside: galleries, a honeycomb of dark tunnels
      const gal = Math.sin(p[0] * 2.1 + p[2] * 0.6) * Math.sin(p[2] * 1.9 - p[0] * 0.4);
      return gal > 0.3 ? 'mudD' : gal < -0.5 ? 'clay1' : 'clayD';
    }
    // the broken rim catches the light
    if (o.cave && Math.hypot(p[0] - o.cave[0][0], p[1] - o.cave[0][1], p[2] - o.cave[0][2]) - o.cave[1] < 0.7) return 'clay3';
    return pick(CLAY, idx);
  };
  const G = render([sdfObj(f, [0.5, 1, 16], 19, CLAY, paint, 0.7, unit([-0.55, -0.4, 0.75]))], [-14, -36, 14, 7]);
  finish(G, { seam: 0 });
  // vent holes on the side facing the viewer
  for (const [x, z, y] of o.vents) {
    const [sx, sy] = proj(x, y, z);
    for (const [dx, dy, col] of [[0, 0, 'mudD'], [1, 0, 'mudD'], [0, 1, 'mudD'], [1, 1, 'clayD'], [0, 2, 'clay2']]) {
      const q = gi(G, sx + dx, sy + dy);
      if (q >= 0 && G.id[q] >= 0) G.col[q] = col;
    }
  }
  const [x0, , x1, y1] = bbox(G);
  return prop((g) => {
    const q = rng(seed + 2);
    blit(g, G);
    tuft(g, q, x0 + 2, y1 - 0.5, { n: 4, h: [3, 6] });
    tuft(g, q, x1 - 1, y1 - 1, { n: 3, h: [3, 5] });
    pebble(g, x1 + 1, y1 + 0.5, false, ['clay2', 'clay1']);
  }, TERMITE_DEF, { side: 20, up: 42, down: 10 });
}

// ---------- bones ----------
// A horned skull lying face up (the classic front view), hand placed.
const SKULL = [
  'H.........H',
  'hH.......Hh',
  '.hHabbbbHh.',
  '..abbbbbc..',
  '..akkbkkc..',
  '...abbbc...',
  '...abbbc...',
  '....kbk....',
  '....ccc....',
];
const JAW = [
  'abbbbbbc..',
  '.ewewewbc.',
  '.......cbc',
  '........cc',
];
const BONE_KEY = { a: 'bone1', b: 'bone', c: 'bone0', k: 'olBone', H: 'rock1', h: 'rock2', e: 'bone1', w: 'boneD' };
function bones(seed, v) {
  return still((g) => {
    const r = rng(seed);
    // ribs: thin arcs rising off a row of vertebrae, spaced so each reads on its own
    const ribs = v === 0 ? [-11, -7, -3] : [-6, -2, 2, 6];
    g.part((c) => {
      ribs.forEach((x, i) => {
        const h = [4.5, 6, 6.5, 5, 4][i + (v === 0 ? 1 : 0)] + r.range(-0.4, 0.4);
        strand(c, [[x, 0.5], [x + 0.2, -h * 0.6], [x + 1.4, -h], [x + 3, -h + 0.6]], 'bone');
        c.px(x + 0.2, -h * 0.6, 'bone1');
      });
      for (let x = ribs[0] - 2; x <= ribs[ribs.length - 1] + 2; x++) c.px(x + 0.5, 0.5, (x & 1) ? 'bone0' : 'bone');
      if (v === 0) {
        c.stamp(1, -7, SKULL, BONE_KEY);
      } else {
        // long bone with knuckled ends
        c.line([-14, 0.5, -9.5, -4], 1.5, 'bone');
        c.ell(-14.2, 0.8, 1.3, 1.1, 'bone'); c.ell(-9.2, -4.4, 1.3, 1.1, 'bone');
        c.flush();
        c.px(-12, -2.5, 'bone1'); c.px(-11, -3.5, 'bone1'); c.px(-13, -0.5, 'bone0');
        c.stamp(9, -2, JAW, BONE_KEY);
      }
    });
    // dirt banked over the sunk ends
    const dirt = v === 0 ? [[-13, 1], [4, 1.5], [9, 1.5]] : [[-15.5, 1.5], [7, 1.5], [17, 1.5]];
    for (const [x, y] of dirt) { g.px(x, y, 'sand1'); g.px(x + 1, y, 'sand0'); g.px(x + 0.6, y - 1, 'sand2'); }
  }, {}, { side: 24, up: 16, down: 8 });
}

// ---------- fallen log ----------
const LOG_DEF = { shadow: { rx: 16, ry: 3, dy: 0 }, solid: 4, solidW: 13 };
function log(seed, v) {
  const R = rotm(0, 0, v ? Math.PI + 0.42 : -0.5), L = 30, c = [0, 0.5, 3.3], r0 = 4.2, r1 = 3.0, rin = 2.3;
  const stubs = v ? [[-6, 1.5, 0.5, -7, 4.5, 5.5], [5, -1, 1.2, 6, -2, 4.6]] : [[-5, 0.5, 1.2, -7, 2, 6.6], [3, 1, 0.8, 4, 4.5, 4.5]];
  const loc = (p) => mtv(R, sub(p, c));
  const radAt = (q) => lerp(r1, r0, q[0] / L + 0.5) + 0.22 * Math.sin(Math.atan2(q[2], q[1]) * 10 + q[0] * 0.15);
  const f = (p) => {
    const q = loc(p), rr = Math.hypot(q[1], q[2]);
    let d = Math.max(rr - radAt(q), Math.abs(q[0]) - L / 2) * 0.8;
    d = Math.max(d, -Math.max(rr - rin, -L / 2 + 6 - q[0])); // hollow from the open end
    for (const [ax, ay, az, bx, by, bz] of stubs) d = smin(d, capD(q, [ax, ay, az], [bx, by, bz], 0.9), 0.7);
    return d;
  };
  const paint = (p, n, idx) => {
    const q = loc(p), rr = Math.hypot(q[1], q[2]);
    if (q[0] > L / 2 - 0.3 && rr < r0) {
      // end grain: rings round a dark hollow
      if (rr < rin + 0.2) return 'barkD';
      const k = Math.floor((rr - rin) / 0.75);
      return rr > radAt(q) - 0.45 ? 'bark1' : k % 2 ? 'bark3' : 'bark4';
    }
    if (rr < rin + 0.3 && q[0] > -L / 2 + 6) return 'barkD';
    const moss = Math.sin(q[0] * 0.55 + 1) + Math.sin(q[0] * 1.3 + 2) * 0.6;
    if (n[2] > 0.72 && moss > 0.55 && Math.abs(q[0]) < L / 2 - 2) return MOSS[clamp(idx - 1, 0, 3)];
    return pick(BARK, idx);
  };
  const G = render([sdfObj(f, c, L / 2 + 4, BARK, paint, 0.6)], [-19, -16, 19, 8]);
  finish(G, { seam: 0 });
  const [x0, y0, x1, y1] = bbox(G);
  return prop((g) => {
    const r = rng(seed);
    blit(g, G);
    const mx = (x0 + x1) / 2;
    // the open end: growth rings round a dark hollow
    const e = add(c, mv(R, [L / 2 - 0.2, 0, 0])), [ex, ey] = proj(...e), sd = v ? -1 : 1;
    g.ell(ex, ey, 2.5, 3.6, 'bark2');
    g.ell(ex + sd * 0.2, ey, 1.9, 2.8, 'bark4');
    g.ell(ex + sd * 0.2, ey, 1.4, 2.1, 'bark3');
    g.ell(ex + sd * 0.4, ey + 0.3, 1, 1.5, 'barkD');
    g.flush();
    if (v === 0) {
      // fern on top
      fern(g, mx - 3, topAt(G, mx - 3) + 1);
      // mushrooms at the foot
      for (const dx of [6, 8]) { const y = y1 - 1 + (dx === 8 ? 0 : -1); g.px(mx + dx, y, 'bone0'); g.px(mx + dx - 1, y - 1, 'mushC'); g.px(mx + dx, y - 1, 'mushC'); g.px(mx + dx + 1, y - 1, 'ochre'); }
    } else {
      for (const dx of [-4, -3]) { const y = topAt(G, mx + dx); g.px(mx + dx, y - 1, 'mushC'); g.px(mx + dx + 1, y - 1, 'ochre'); }
      tuft(g, r, x0 + 4, botAt(G, x0 + 4) + 1.5, { n: 3, h: [3, 5], cols: ['lush1', 'lush2', 'tall1'] });
    }
    tuft(g, r, mx + 6, botAt(G, mx + 6) + 1.5, { n: 3, h: [2, 4] });
    void y0;
  }, LOG_DEF, { side: 24, up: 24, down: 10 });
}

// ---------- basalt ----------
const BASALT_DEF = { shadow: { rx: 11, ry: 3, dy: 0 }, solid: 7 };
function basalt(seed, v) {
  const r = rng(seed);
  const size = v ? [7.6, 6, 8] : [9.8, 7, 6];
  const ob = convex({ at: [0, 0.5, v ? 4.6 : 4], size, planes: facets(r, size, v ? 8 : 11, 0.2), cuts: v ? [{ n: [0.4, -0.2, 1], d: 6.2 }] : [], round: 0, rot: [0.1, v ? 0.12 : -0.15, r.range(0, TAU)], mat: BASALT });
  const G = render([ob], [-15, -24, 15, 7]);
  finish(G, { seam: 0 });
  const [x0, y0, x1] = bbox(G);
  const L = (q) => (G.id[q] >= 0 ? G.lum[q] : -9);
  // ropy pahoehoe folds: concentric arcs on the faces turned toward the viewer
  const fx = (x0 + x1) / 2 - 3, fy = 5;
  for (let j = 0; j < G.h; j++) for (let i = 0; i < G.w; i++) {
    const q = j * G.w + i;
    if (G.id[q] < 0 || G.N[q][1] > -0.45 || G.lum[q] < 1 || G.lum[q] > 2) continue;
    const d = Math.hypot(i + G.x0 + 0.5 - fx, (j + G.y0 + 0.5 - fy) * 1.6);
    if (Math.abs(d - 9.5) < 0.5 || Math.abs(d - 12.5) < 0.5) G.col[q] = shiftKey(G.col[q], 1);
  }
  // obsidian sheen: sharp lit ridges where a bright facet breaks over a dark one, a glint at the top
  const out = G.col.slice();
  let glint = null;
  for (let j = 1; j < G.h - 1; j++) for (let i = 1; i < G.w - 1; i++) {
    const q = j * G.w + i, l = L(q);
    if (l < 3) continue;
    if (L(q + G.w) <= l - 2 || L(q + 1) <= l - 2) out[q] = 'basalt4';
    if (l === 4 && (!glint || j < glint[1] || (j === glint[1] && i < glint[0]))) glint = [i, j];
  }
  G.col = out;
  if (glint) for (const [dx, dy, c] of [[1, 1, 'glint'], [2, 1, 'basalt4'], [1, 2, 'basalt4']]) {
    const q = (glint[1] + dy) * G.w + glint[0] + dx;
    if (G.id[q] >= 0) G.col[q] = c;
  }
  // glowing cracks: forked lines down the rock from near the top
  const cracks = [];
  for (const [u, len] of [[0.3, 10], [0.66, 7]]) {
    let x = Math.floor(lerp(x0, x1, u)), y = topAt(G, x) + 2;
    const path = [];
    for (let k = 0; k < len; k++) {
      const q = gi(G, x, y);
      if (q < 0 || G.id[q] < 0) break;
      path.push([x, y]);
      y += 1; if (r() < 0.45) x += r.sign();
    }
    cracks.push(path);
  }
  return plant((g, sway, t) => {
    blit(g, G);
    cracks.forEach((path, ci) => path.forEach(([x, y], k) => {
      const p = 0.5 + 0.5 * Math.sin(t * TAU - k * 0.55 - ci * 2);
      g.px(x + 0.5, y + 0.5, p > 0.72 ? 'fire1' : p > 0.35 ? 'fire0' : 'fireD');
    }));
    void sway; void y0;
  }, BASALT_DEF, { side: 20, up: 28, down: 10 });
}

// ---------- vent ----------
const VENT_DEF = { flat: true, vent: true };
function vent() {
  return plant((g, sway, t) => {
    const br = 0.5 + 0.5 * Math.sin(t * TAU);
    // crust ring: dark outer apron, lit rim, the throat
    g.blob([[-8.5, 0.5], [-6, -2.6], [-1, -3.6], [4.5, -3.2], [8.5, -1], [7.5, 1.8], [2, 3], [-4.5, 2.6]], 'basalt1', 0.5);
    g.blob([[-6.5, 0], [-4.5, -2.2], [0, -2.9], [4.5, -2.4], [6.5, -0.4], [5, 1.3], [0, 1.9], [-5, 1.4]], 'basalt3', 0.5);
    g.blob([[-5, -0.1], [-3.4, -1.7], [0, -2.1], [3.6, -1.6], [5, -0.2], [3.6, 0.9], [0, 1.2], [-3.6, 0.8]], 'basalt0', 0.5);
    g.ell(0, -0.2, 3.2 + br * 0.5, 1.1 + br * 0.2, 'fireD');
    g.ell(0, -0.1, 1.8 + br * 0.6, 0.6 + br * 0.15, br > 0.55 ? 'fire1' : 'fire0');
    g.flush();
    // the far inner wall catches the glow
    for (let x = -2; x <= 2; x++) g.px(x + 0.5, -2.5 + (Math.abs(x) > 1 ? 1 : 0), br > 0.4 ? 'emberD' : 'basalt1');
    // crust texture: fissures and a couple of embers
    g.px(-6.5, 1.5, 'basaltD'); g.px(-5.5, 1.5, 'basaltD'); g.px(6.5, -1.5, 'basaltD'); g.px(-7.5, -0.5, 'basalt2'); g.px(3.5, 2.5, 'basaltD');
    g.px(5.5, 1.5, br > 0.6 ? 'fire0' : 'emberD'); g.px(-6.5, -1.5, br < 0.4 ? 'fireD' : 'emberD');
    g.outline();
    // heat and thin smoke rise and thin out (after the outline: smoke has no ink)
    for (let k = 0; k < 3; k++) {
      const u = (t + k / 3) % 1, y = -4 - u * 13, x = Math.sin(u * 5 + k * 2.1) * (0.6 + u * 1.6) + (k - 1) * 0.8;
      const col = u < 0.3 ? 'ash3' : u < 0.62 ? 'ash2' : u < 0.85 ? 'ash1' : null;
      if (!col) continue;
      g.px(x, y, col);
      if (u < 0.5) g.px(x + (k % 2 ? 1 : -1), y + 1, 'ash2');
    }
    void sway;
  }, VENT_DEF, { side: 14, up: 22, down: 8, outline: false });
}

// ---------- driftwood ----------
const DRIFT_DEF = { flat: true };
function driftwood(seed, v) {
  return prop((g) => {
    const r = rng(seed);
    g.part((c) => {
      if (v === 0) {
        c.chain([[-11, -0.8, 2.4], [-5, -1.6, 3.0], [2, -1.4, 2.8], [8, -2.2, 2.1], [12.5, -3, 1.2]], 'drift2');
        c.chain([[-9, -1, 1.8], [-13, -3.5, 1.2], [-14.5, -5, 0.8]], 'drift2');
        c.chain([[-9.5, -0.5, 1.6], [-14, 0.5, 1]], 'drift2');
        c.limb(2, -2.2, 3.5, -4.6, 1.4, 0.8, 'drift2');
      } else {
        c.chain([[-10, -2, 2.6], [-3, -1, 2.6], [4, -2, 2.2], [9, -0.5, 1.6], [12, 0.5, 1.0]], 'drift2');
        c.chain([[-8, -2, 1.8], [-11, -5, 1.2], [-11.5, -7, 0.8]], 'drift2');
        c.chain([[-8.5, -1.5, 1.6], [-13, -1, 1]], 'drift2');
      }
      c.bevel({ up: 1, down: 1, hi: 1, lo: 1 });
      c.bevel({ up: 0, down: 1, lo: 1 });
      // grain runs along the wood: a few broken dark lines
      const segs = v === 0 ? [[-8, -1.2, -4, -1.8], [-2, -1.6, 2, -1.2], [5, -1.8, 8, -2.2]] : [[-7, -1.5, -2, -1.2], [1, -1.5, 6, -1.6]];
      for (const [a, b, cc, d] of segs) c.pline(a, b, cc, d, 'drift0', true);
      c.px(v ? 3 : -2, v ? -2.5 : -2.5, 'driftD'); // knot
      void r;
    });
    if (v === 1) g.later.push(() => {
      // a strand of kelp draped over the wood (no ink: it lies flat and wet), bladders and all
      g.curve([[-7, 2.6], [-4, 1], [-1.5, -2.2], [1.5, -2.4], [4, 0.6], [8, 2.4], [11, 2.2]], 1.6, 'kelp0');
      g.flush();
      strand(g, [[-4, 0.5], [-1.5, -2.7], [1.5, -2.9]], 'kelp1');
      strand(g, [[5, 0.9], [8, 2.2]], 'kelp1');
      for (const [x, y, c] of [[-2.5, -3.5, 'kelp2'], [2.5, -2.5, 'kelp2'], [11.5, 1.5, 'kelp2'], [-7.5, 3.5, 'kelpD']]) g.px(x, y, c);
    });
  }, DRIFT_DEF, { side: 20, up: 14, down: 8 });
}

export function build() {
  return {
    props: {
      boulder: [['round', 51], ['slab', 52], ['split', 53]].map(([k, s]) => boulder(s, k)),
      kopje: KOPJE.map((o, i) => kopje(61 + i, o)),
      termite: TERMITE.map((o, i) => termite(71 + i, o)),
      bones: [0, 1].map((v) => bones(81 + v, v)),
      log: [0, 1].map((v) => log(121 + v, v)),
      basalt: [0, 1].map((v) => basalt(191 + v, v)),
      vent: [vent()],
      driftwood: [0, 1].map((v) => driftwood(211 + v, v)),
    },
  };
}

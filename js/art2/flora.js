// Plants that move. Shared pieces for trees, bushes, grass and reeds:
//   - foliage built from small leaf tufts (bumpy rims, clustered light) instead of smooth ovals
//   - every plant is drawn as a short wind loop: wood stays put, tufts and blades lean and flutter
//   - trunks and limbs with bark shading
//
// A plant is drawn in trunk-base coordinates (0, 0 = where it meets the ground, y negative = up).
// FRAMES frames make one loop; frame i has sway = sin(i / FRAMES * TAU). The renderer can offset
// each plant's phase by its position so gusts roll across the land.
import { Pix, cropAnim, cropOne, lerp, clamp, TAU } from './pix.js';

export const FRAMES = 8;

// Small deterministic PRNG (same family as the game's util.rng) so every variant is stable.
export function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  const r = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  r.range = (a, b) => a + (b - a) * r();
  r.int = (a, b) => Math.floor(a + (b - a + 1) * r());
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.sign = () => (r() < 0.5 ? -1 : 1);
  return r;
}

// ---------- foliage ----------
// A clump: an oval mass of leaf tufts. Returns data; draw it with drawClumps.
//   n: tuft count (default scales with area), tuft: [min, max] tuft radius,
//   rim: 0..1 how much tufts crowd the rim (bumpier outline), shade: tone offset for the whole clump,
//   flat: squash the lighting so the top reads as a lit plane (acacia), ph: wind phase offset.
export function clump(r, cx, cy, rx, ry, { n, tuft = [1.7, 2.8], rim = 0.5, shade = 0, flat = 0, ph } = {}) {
  n = n || Math.round(Math.max(6, rx * ry * 0.55));
  const tufts = [];
  for (let i = 0; i < n; i++) {
    const a = r() * TAU;
    const d = Math.pow(r(), lerp(0.5, 0.22, rim));
    const dx = Math.cos(a) * d, dy = Math.sin(a) * d;
    const tr = r.range(tuft[0], tuft[1]);
    // light comes from above and a little to the left
    const L = -(dy * (1 + flat)) - dx * 0.3 + r.range(-0.22, 0.22);
    tufts.push({ x: cx + dx * (rx - tr * 0.6), y: cy + dy * (ry - tr * 0.5), r: tr, L, d, ph: r() * TAU, dy });
  }
  tufts.sort((p, q) => p.L - q.L);
  return { cx, cy, rx, ry, tufts, shade, ph: ph ?? cx * 0.06 + r.range(-0.4, 0.4) };
}

// tones: [deep, dark, mid, light, hi] color keys (4 or 5). sway -1..1, t = loop phase 0..1.
//   amp: sideways travel in px at the top of the plant, top: y (negative) that counts as "the top",
//   flutter: how much the lit tufts shimmer.
export function drawClumps(g, clumps, tones, sway = 0, t = 0, { amp = 1.4, top = -60, flutter = 0.14, core = true } = {}) {
  const T = tones.length === 4 ? [tones[0], tones[0], tones[1], tones[2], tones[3]] : tones;
  const th = [-0.55, -0.12, 0.4, 0.78];
  // a solid heart under the tufts so the mass has no accidental holes
  if (core) for (const c of clumps) {
    const k = clamp(c.cy / top, 0, 1.2), off = Math.sin(t * TAU - c.ph) * amp * k * 0.6;
    g.ell(c.cx + off, c.cy + c.ry * 0.12, c.rx * 0.8, c.ry * 0.74, T[clamp(1 + c.shade, 0, 4)]);
  }
  for (let pass = 0; pass < 5; pass++) {
    for (const c of clumps) {
      const k = clamp(c.cy / top, 0, 1.2);
      const lag = Math.sin(t * TAU - c.ph);
      for (const f of c.tufts) {
        const L = f.L + Math.sin(t * TAU * 2 + f.ph) * flutter;
        let ti = L < th[0] ? 0 : L < th[1] ? 1 : L < th[2] ? 2 : L < th[3] ? 3 : 4;
        ti = clamp(ti + c.shade, 0, 4);
        if (ti !== pass) continue;
        // the rim and the top of each clump travel furthest
        const w = k * (0.55 + 0.45 * f.d) * (1 - 0.35 * f.dy);
        g.ell(f.x + lag * amp * w, f.y + Math.abs(lag) * amp * w * 0.12, f.r, f.r * 0.86, T[ti]);
      }
    }
  }
  void sway;
  return g;
}

// ---------- wood ----------
// A limb through [[x, y, width], ...] (smooth enough at this scale as straight tapered pieces).
export function limbs(g, pts, col) { return g.chain(pts, col); }

// Bark shading for everything drawn so far in the given ramp colors: lit left edge, dark right edge,
// plus optional vertical grain nicks. Call inside a g.part(...) that holds only the wood.
export function barkShade(g, r, { keys, grain = 0, grainCol, left = 1, right = 1 } = {}) {
  g.bevel({ up: 0, down: 0, left, right, only: keys });
  if (grain && r) {
    const b = g.bounds();
    if (!b) return g;
    for (let i = 0; i < grain; i++) {
      const x = r.range(b[0], b[2]) - g.ax + 0.5, y = r.range(b[1], b[3]) - g.ay + 0.5, len = r.int(1, 3);
      for (let k = 0; k < len; k++) g.px(x, y + k, grainCol, true);
    }
  }
  return g;
}

// ---------- blades and stems (pixel-exact, always 1px wide and unbroken) ----------
// Smooth strand through [[x, y], ...]
export function strand(g, pts, col, steps = 6) {
  const n = pts.length;
  let prev = pts[0];
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    for (let s = 1; s <= steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      g.pline(prev[0], prev[1], x, y, col);
      prev = [x, y];
    }
  }
  return prev;
}
// A grass blade / reed rooted at (x, 0)... (x, y0): bends more toward the tip. Returns the tip point.
//   len: height, lean: rest lean in px at the tip, bend: wind travel in px at the tip (multiply by sway).
export function blade(g, x, y0, len, lean, bend, col) {
  const tip = lean + bend;
  return strand(g, [[x + 0.5, y0 - 0.5], [x + 0.5 + tip * 0.12, y0 - len * 0.4], [x + 0.5 + tip * 0.5, y0 - len * 0.78], [x + 0.5 + tip, y0 - len + Math.abs(tip) * 0.18]], col, 5);
}

// ---------- building a plant ----------
// draw(g, sway, t, i) paints one frame. opts: { side, up, down } stage room around the base,
// frames (1 = still), ss, outline (false or outline options). def is merged into the result
// ({ shadow, shade, solid, ... } as the game's props expect).
export function plant(draw, def = {}, { side = 90, up = 110, down = 10, frames = FRAMES, ss = 3, outline = {} } = {}) {
  const list = [];
  for (let i = 0; i < frames; i++) {
    const g = new Pix(side * 2, up + down, side, up, { ss });
    const t = i / frames;
    draw(g, Math.sin(t * TAU), t, i);
    if (outline) g.outline(outline);
    list.push(g);
  }
  return frames > 1 ? cropAnim(list, def) : cropOne(list[0], def);
}
export const still = (draw, def, opts = {}) => plant(draw, def, { ...opts, frames: 1 });

export { Pix, lerp, clamp, TAU };

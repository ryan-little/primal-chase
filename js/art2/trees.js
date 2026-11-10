// The big trees beyond the acacias: mopane, marula, fig, baobab, fever tree, mangrove and palm.
// Same build as acacia.js: wood that holds the crown and stays put, foliage made of leaf tufts
// that lean and flutter through the 8-frame wind loop, hanging things (aerial roots, fruit,
// palm leaflets) that swing.
//
// Each variant first replays the old generator's random draws (js/art-trees.js, js/art-props.js)
// so its size and its def (shadow, shade, solid, rare) match the old sprite exactly; the detail
// is drawn from a second, separate stream.
import { rng, clump, drawClumps, barkShade, lerp, clamp, TAU, FRAMES } from './flora.js';
import { Pix, cropAnim } from './pix.js';
import { addColors, addRamp } from './pal.js';
import { rng as oldRng } from '../util.js';

addColors({
  // baobab: grey-pink bark with pale peeling highlights
  baobD: '#3a2c29', baob0: '#5a4741', baob1: '#7a645a', baob2: '#988073', baob3: '#b69d8c', baob4: '#d4bfaa',
  // fig: smooth grey-tan bark
  figD: '#2b241e', fig0: '#463c32', fig1: '#655746', fig2: '#86745c', fig3: '#a8957a', fig4: '#c4b294',
});
addRamp('baob', ['baobD', 'baob0', 'baob1', 'baob2', 'baob3', 'baob4'], 'olRock');
addRamp('figw', ['figD', 'fig0', 'fig1', 'fig2', 'fig3', 'fig4'], 'olFur');

// foliage tones, deep to hi
const LEAF = ['leafD', 'leaf0', 'leaf1', 'leaf2', 'leaf3'];
const LEAF_DARK = ['olLeaf', 'leafD', 'leaf0', 'leaf1', 'leaf2'];
const LEAF_DEEP = ['olLeaf', 'leafD', 'palmD', 'palm0', 'leaf1'];
const LEAF_OLIVE = ['leafD', 'lushD', 'lush0', 'lush1', 'lush2'];
const LEAF_DRY = ['thornD', 'thorn0', 'thorn1', 'lush1', 'lush2'];
const LEAF_MARULA = ['leaf0', 'leaf1', 'leaf2', 'leaf3', 'lush3'];
const COPPER = ['barkD', 'bark0', 'clay0', 'clay1', 'clay2'];
const FEV_LEAF = ['leaf0', 'leaf1', 'lush1', 'lush2', 'lush3'];
const FEV_LIGHT = ['leaf1', 'leaf2', 'lush2', 'lush3', 'fever2'];
const FEV_DARK = ['leafD', 'leaf0', 'leaf1', 'leaf2', 'lush2'];
const PALM_T = ['palmD', 'palm0', 'palm1', 'palm2', 'palm3'];

const sgn = (q) => (q() < 0.5 ? -1 : 1);
const wob = (t, ph) => Math.sin(t * TAU - ph);
const kTop = (y, top) => clamp(y / top, 0, 1.2);
// how far a point at height y travels, matching drawClumps' motion at a clump's center
const drift = (t, ph, y, amp, top) => wob(t, ph) * amp * kTop(y, top) * 0.55;
const nearest = (list, x, key) => list.reduce((a, b) => (Math.abs(b[key] - x) < Math.abs(a[key] - x) ? b : a));

// A smooth limb (quadratic) from (x0, y0) to (x1, y1), bowed by (bx, by) at the middle.
function bough(c, x0, y0, x1, y1, w0, w1, col, bx = 0, by = 0, n = 4) {
  const mx = (x0 + x1) / 2 + bx, my = (y0 + y1) / 2 + by, pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), d = u * u;
    pts.push([a * x0 + b * mx + d * x1, a * y0 + b * my + d * y1, lerp(w0, w1, u)]);
  }
  c.chain(pts, col);
  return pts;
}

// Light the crown as one mass (top bright, underside dark) while keeping each tuft's own bump.
function relight(clumps, cx, cy, RX, RY, k = 0.65) {
  for (const c of clumps) {
    for (const f of c.tufts) f.L = f.L * (1 - k) + k * (-(f.y - cy) / RY * 1.2 - (f.x - cx) / RX * 0.4 + 0.1);
    c.tufts.sort((p, q) => p.L - q.L);
  }
  return clumps;
}

// Dark pockets in the crown with a bit of limb crossing them, so the wood reads inside.
function pockets(g, list, T, t, amp, top, col) {
  for (const p of list) {
    const off = drift(t, p.ph, p.y, amp, top);
    g.ell(p.x + off, p.y, p.rx, p.ry, T[0]);
    g.limb(p.x + off * 0.6 + p.dx, p.y + p.ry + 0.4, p.x + off - p.dx * 0.5, p.y - p.ry * 0.6, 1.4, 1, col);
  }
}
function makePockets(r, n, cx, cy, RX, RY) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const s = i % 2 ? 1 : -1;
    const x = cx + s * r.range(0.15, 0.5) * RX, y = cy + r.range(0.15, 0.45) * RY;
    out.push({ x, y, rx: r.range(1.8, 2.6), ry: r.range(1.2, 1.7), dx: s * r.range(0.6, 1.6), ph: x * 0.06 });
  }
  return out;
}

// Pixel specks (fruit, colored leaves) riding the crown: [x, y, col, ph]
function specks(g, list, t, amp, top) {
  for (const [x, y, col, ph] of list) g.px(x + drift(t, ph, y, amp, top), y, col, true);
}

// A round crown on an ellipse (cx, cy, RX, RY): clumps on the limb tips along the upper arc,
// a core, a cap, low side lobes and a scalloped underside the limbs disappear into.
function roundCrown(r, { cx, cy, RX, RY, n, tuft, spread = 2.4, tipR = [0.36, 0.42], reach = [0.58, 0.72], sides = true, cap = 0.55, under = 3, light = 0.65 }) {
  const tips = [], clumps = [];
  for (let i = 0; i < n; i++) {
    const u = n > 1 ? i / (n - 1) - 0.5 : 0;
    const a = -Math.PI / 2 + u * spread + r.range(-0.12, 0.12), d = r.range(...reach);
    const x = cx + Math.cos(a) * RX * d, y = cy + Math.sin(a) * RY * d * 0.9;
    const ph = x * 0.06 + r.range(-0.3, 0.3);
    tips.push({ x, y, ph, u });
    clumps.push(clump(r, x, y - 1, RX * tipR[0] * r.range(0.9, 1.1), RY * tipR[1] * r.range(0.9, 1.1), { ph, rim: 0.75, tuft }));
  }
  clumps.push(clump(r, cx, cy + RY * 0.05, RX * 0.76, RY * 0.56, { ph: cx * 0.06, rim: 0.6, tuft }));
  if (cap) clumps.push(clump(r, cx + r.range(-2, 2), cy - RY * 0.45, RX * cap, RY * 0.42, { ph: cx * 0.06 + 0.2, rim: 0.7, tuft }));
  if (sides) for (const s of [-1, 1]) {
    const x = cx + s * RX * r.range(0.7, 0.76);
    clumps.push(clump(r, x, cy + RY * 0.22, RX * 0.28, RY * 0.38, { ph: x * 0.06, rim: 0.7, tuft }));
  }
  for (let i = 0; i < under; i++) {
    const x = cx + (under > 1 ? i / (under - 1) - 0.5 : 0) * RX * 1.05 + r.range(-2, 2);
    clumps.push(clump(r, x, cy + RY * 0.5, RX * 0.22, RY * 0.3, { ph: x * 0.06, rim: 0.7, tuft }));
  }
  relight(clumps, cx, cy, RX, RY, light);
  return { tips, clumps };
}

// Stage room for a plant whose crown reaches half-width hw and height ht.
const room = (hw, ht, down = 6) => ({ side: Math.ceil(hw + 7), up: Math.ceil(ht + 7), down });

// flora.plant plus an `after` pass drawn over the outline: 1px hanging things (aerial roots,
// feathery fringe) read as fine lines instead of 3px inked bars.
function plant(draw, def, { side, up, down = 6, after = null, name = '' }) {
  const list = [];
  for (let i = 0; i < FRAMES; i++) {
    const g = new Pix(side * 2, up + down, side, up, { ss: 3 });
    const t = i / FRAMES, sway = Math.sin(t * TAU);
    draw(g, sway, t, i);
    g.outline({});
    if (after) after(g, sway, t, i);
    const b = g.bounds();
    if (b && (b[0] === 0 || b[1] === 0 || b[2] === g.w - 1 || b[3] === g.h - 1)) console.warn('trees: stage edge', name);
    list.push(g);
  }
  return cropAnim(list, def);
}

// Crown ellipse from the heights of its underside (B) and top (Ht), positive up.
const crownBox = (B, Ht) => { const RY = (Ht - B) / 1.75; return { RY, cy: -Ht + RY }; };

// ======================================================================================
// Mopane: slim dark trunk, limbs reaching up into a dense round crown of small leaves.
function mopane(seed, o, name) {
  const q = oldRng(seed);
  const lean = o.lean ? o.lean * sgn(q) : q.range(-1.5, 1.5);
  const F = q.range(...o.fork), rx = q.range(...o.rx), ry = q.range(...o.ry);
  const def = { shadow: { rx: rx + 6, ry: 9, dy: -1 }, shade: rx + 10, solid: 4 };

  const r = rng(seed);
  const Ht = F + ry * 1.35 + 7, RX = rx + 6;
  const { RY, cy } = crownBox(F + 2, Ht);
  const cx = lean, top = -Ht, Fk = F * 0.7;
  const stems = o.stems ? [-1, 1] : [0];
  const trunks = stems.map((s) => ({ bx: s * 1.6, fx: s * 5 + lean * 0.5, fy: -Fk - (o.stems ? 2 : 0) }));
  const { tips, clumps } = roundCrown(r, { cx, cy, RX, RY, n: r.int(...o.lobes), tuft: [1.1, 1.8], spread: 2.5 });
  for (const tp of tips) tp.tr = nearest(trunks, tp.x, 'fx');
  const amp = 1.4;
  const pk = makePockets(r, 2, cx, cy, RX, RY);
  const dots = [];
  for (let i = 0; i < 12; i++) {
    const x = cx + r.range(-0.8, 0.8) * RX, y = cy + r.range(-0.85, 0.2) * RY;
    dots.push([x, y, o.speck, x * 0.06]);
  }

  return plant((g, sway, t) => {
    g.part((c) => {
      for (const tr of trunks) {
        const w = o.stems ? 2.4 : 3;
        c.chain([[tr.bx, 0.4, w + 0.7], [lerp(tr.bx, tr.fx, 0.45), tr.fy * 0.5, w], [tr.fx, tr.fy, w - 0.4]], 'bark0');
        c.limb(tr.bx - w * 0.8, 0.4, tr.bx - 0.4, -2.5, 1.4, 1.2, 'bark0'); c.limb(tr.bx + w * 0.8, 0.4, tr.bx + 0.4, -2.5, 1.4, 1.2, 'bark0');
      }
      for (const tp of tips) {
        const off = drift(t, tp.ph, tp.y, amp, top), tr = tp.tr;
        // limbs leave the fork steeply and open out inside the crown
        bough(c, tr.fx, tr.fy + 1, tp.x + off, tp.y + 2, 1.9, 1, 'bark0', (tr.fx - tp.x) * 0.35, 0);
      }
      barkShade(c, null, { keys: ['bark0'] });
      for (const tr of trunks) for (let y = -3; y > tr.fy + 2; y -= 3.5) c.nudge(lerp(tr.bx, tr.fx, y / tr.fy) + ((y / 3.5) & 1 ? 0.3 : -0.7), y, -1);
      c.tone((x, y) => (y < cy + RY * 0.75 ? -1 : 0));
    });
    drawClumps(g, clumps, o.tones, sway, t, { amp, top, flutter: 0.16 });
    pockets(g, pk, o.tones, t, amp, top, 'barkD');
    specks(g, dots, t, amp, top);
  }, def, { ...room(RX + 2, Ht), name });
}
const MOPANE = [
  { fork: [18, 22], rx: [18, 22], ry: [12, 14], lobes: [6, 6], tones: LEAF, speck: 'leaf3' }, // round
  { fork: [22, 26], rx: [13, 15], ry: [16, 18], lobes: [5, 5], tones: LEAF_DARK, speck: 'leaf2' }, // tall oval
  { fork: [14, 16], rx: [26, 30], ry: [10, 11], lobes: [7, 7], tones: LEAF_OLIVE, speck: 'lush2' }, // wide and low
  { fork: [16, 20], rx: [20, 24], ry: [12, 14], lobes: [4, 5], tones: LEAF, stems: true, speck: 'leaf3' }, // twin stem
  { fork: [18, 22], rx: [18, 22], ry: [12, 14], lobes: [6, 6], tones: COPPER, speck: 'gold0' }, // autumn copper
  { fork: [18, 22], rx: [16, 19], ry: [12, 14], lobes: [4, 5], tones: LEAF_DARK, lean: 5, speck: 'leaf2' }, // lopsided
];

// ======================================================================================
// Marula: short stout pale trunk, a few thick spreading limbs, broad light crown.
function marula(seed, o, name) {
  const q = oldRng(seed);
  const lean = o.lean ? o.lean * sgn(q) : 0;
  const F = q.range(...o.fork), rx = q.range(...o.rx), ry = q.range(...o.ry);
  const def = o.sparse
    ? { shadow: { rx, ry: 7, dy: -1 }, shade: 0, solid: 5, rare: true }
    : { shadow: { rx: rx + 8, ry: 10, dy: -1 }, shade: rx + 12, solid: 5 };

  const r = rng(seed);
  const Ht = F + ry * 1.4 + 8, RX = rx + 9;
  const { RY, cy } = crownBox(F + 3, Ht);
  const cx = lean, top = -Ht, Fk = F * 0.62;
  const tw = o.trunk || 5, fx = lean * 0.4;
  let tips = [], clumps = [];
  if (o.twin) {
    for (const s of [-1, 1]) {
      const c2 = roundCrown(r, { cx: cx + s * RX * 0.46, cy: cy + 1, RX: RX * 0.55, RY: RY * 0.95, n: 3, tuft: [1.5, 2.5], spread: 2.2, sides: false, under: 2, cap: 0.5 });
      tips = tips.concat(c2.tips);
      clumps = clumps.concat(c2.clumps);
    }
    relight(clumps, cx, cy, RX, RY, 0.35);
  } else if (!o.sparse) {
    ({ tips, clumps } = roundCrown(r, { cx, cy, RX, RY, n: r.int(...o.lobes), tuft: [1.5, 2.6], spread: 2.7, reach: [0.62, 0.78], tipR: [0.34, 0.42], cap: 0.6, under: 3 }));
  } else {
    // dry season: bare limbs, a few tufts hanging on
    const n = r.int(...o.lobes);
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1) - 0.5, a = -Math.PI / 2 + u * 2.7 + r.range(-0.1, 0.1), d = r.range(0.62, 0.85);
      const x = cx + Math.cos(a) * RX * d, y = cy + Math.sin(a) * RY * d * 0.9;
      tips.push({ x, y, ph: x * 0.06, u, twig: r.range(2, 5) * (u < 0 ? -1 : 1), twig2: r.range(-3, 3) });
      if (r() < 0.6) clumps.push(clump(r, x + r.range(-1, 1), y - 3, r.range(3.5, 5), r.range(1.8, 2.4), { ph: x * 0.06, rim: 0.6, n: 7, tuft: [1.1, 1.7] }));
    }
  }
  // the few thick main limbs: each tip hangs off the nearest one
  const mainN = o.twin ? 2 : 3;
  const mains = [];
  for (let i = 0; i < mainN; i++) {
    const u = mainN > 1 ? i / (mainN - 1) - 0.5 : 0;
    const x = o.twin ? cx + u * 2 * RX * 0.4 : cx + u * RX * 0.95 + r.range(-2, 2);
    mains.push({ x, y: o.twin ? -F - 4 : -F - 2 - (1 - Math.abs(u) * 2) * 5, w: tw * 0.66 });
  }
  for (const tp of tips) tp.m = nearest(mains, tp.x, 'x');
  const amp = o.sparse ? 0.9 : 1.3;
  const pk = o.sparse ? [] : makePockets(r, 3, cx, cy, RX, RY);
  const fruit = [];
  if (o.fruit) for (let i = 0; i < 18; i++) {
    const a = r.range(0.2, Math.PI - 0.2), d = r.range(0.5, 0.95);
    const x = cx + Math.cos(a) * RX * d * 0.9, y = cy + Math.sin(a) * RY * d * 0.7 - r.range(0, 7);
    fruit.push({ x, y, ph: x * 0.06 + r.range(-0.3, 0.3) });
  }

  return plant((g, sway, t) => {
    g.part((c) => {
      c.chain([[0, 0.4, tw + 1.4], [fx * 0.5, -Fk * 0.5, tw + 0.3], [fx, -Fk, tw]], 'rock2');
      c.limb(-tw * 0.95, 0.4, -0.6, -3.5, 2, 1.6, 'rock2'); c.limb(tw * 0.95, 0.4, 0.6, -3.5, 2, 1.6, 'rock2');
      // thick limbs spread wide before they turn up
      for (const m of mains) bough(c, fx, -Fk + 1, m.x, m.y, m.w + 0.8, m.w * 0.8, 'rock2', 0, (m.y + Fk) * 0.5 + 3);
      for (const tp of tips) {
        const off = drift(t, tp.ph, tp.y, amp, top);
        bough(c, tp.m.x, tp.m.y, tp.x + off, tp.y + 1, tp.m.w * 0.7, o.sparse ? 1.2 : 1.4, 'rock2', 0, 1.5);
        if (o.sparse) {
          bough(c, tp.x + off, tp.y + 1, tp.x + tp.twig + off * 1.3, tp.y - 4, 1.1, 0.8, 'rock2');
          bough(c, tp.x + off, tp.y + 1, tp.x + tp.twig2 + off * 1.3, tp.y - 5.5, 1, 0.8, 'rock2');
        }
      }
      barkShade(c, null, { keys: ['rock2'], left: 1, right: 2 });
      // mottled bark
      const rr = rng(seed + 5);
      for (let i = 0; i < 12; i++) {
        const y = -rr.range(2, Fk - 1), x = lerp(0, fx, y / -Fk) + rr.range(-tw * 0.45, tw * 0.35);
        if (rr() < 0.7) { c.nudge(x, y, -1); c.nudge(x + 1, y, -1); } else c.nudge(x, y, 1);
      }
      if (!o.sparse) c.tone((x, y) => (y < cy + RY * 0.7 ? -1 : 0));
    });
    if (clumps.length) drawClumps(g, clumps, o.tones, sway, t, { amp, top, flutter: 0.15 });
    pockets(g, pk, o.tones, t, amp, top, 'rock0');
    for (const f of fruit) {
      const off = drift(t, f.ph, f.y, amp, top) * 1.15, x = f.x + off;
      g.px(x, f.y, 'gold1'); g.px(x + 1, f.y, 'gold0'); g.px(x, f.y - 1, 'gold2'); g.px(x + 1, f.y - 1, 'gold1');
    }
  }, def, {
    ...room(RX + 3, Ht), name,
    // dry season: fine twigs fanning off every limb end
    after: o.sparse ? (g, sway, t) => {
      for (const tp of tips) {
        const off = drift(t, tp.ph, tp.y, amp, top) * 1.3;
        for (const [ex, ey] of [[tp.twig, -4], [tp.twig2, -5.5]]) {
          const x = tp.x + ex + off, y = tp.y + 1 + ey;
          g.pline(x, y, x + ex * 0.5 - 1.5 + off * 0.4, y - 3, 'rock1');
          g.pline(x, y, x + ex * 0.5 + 1.5 + off * 0.4, y - 2.5, 'rock1');
        }
      }
    } : null,
  });
}
const MARULA = [
  { fork: [17, 20], rx: [20, 22], ry: [12, 14], lobes: [5, 5], tones: LEAF_MARULA }, // round
  { fork: [14, 16], rx: [26, 30], ry: [11, 12], lobes: [6, 7], tones: LEAF }, // broad
  { fork: [22, 26], rx: [16, 18], ry: [15, 17], lobes: [4, 5], tones: LEAF_MARULA, trunk: 4 }, // tall
  { fork: [16, 18], rx: [26, 28], ry: [12, 13], tones: LEAF_MARULA, twin: true }, // split crown
  { fork: [17, 20], rx: [20, 23], ry: [12, 14], lobes: [5, 6], tones: LEAF_OLIVE, fruit: true, lean: 3 }, // heavy with fruit
  { fork: [17, 20], rx: [20, 22], ry: [12, 14], lobes: [5, 5], tones: LEAF_DRY, sparse: true }, // dry season (rare)
];

// ======================================================================================
// Strangler / sycamore fig: buttressed multi-stem trunk, huge dark crown, aerial roots.
function fig(seed, o, name) {
  const q = oldRng(seed);
  const lean = o.lean ? o.lean * sgn(q) : 0;
  const rx = q.range(...o.rx), ry = q.range(...o.ry), h = q.range(...o.h);
  const def = { shadow: { rx: rx + 14, ry: 13, dy: -2 }, shade: rx + 16, solid: 7 };

  const r = rng(seed);
  const Ht = h + ry + 2, B = h - ry * 0.75, RX = rx + 12;
  const { RY, cy } = crownBox(B, Ht);
  const cx = lean, top = -Ht;
  // several stems fused at the foot, parting under the crown
  const ns = 4, stems = [];
  for (let i = 0; i < ns; i++) {
    const u = i / (ns - 1) - 0.5;
    stems.push({ bx: u * 9 + r.range(-0.6, 0.6), tx: lean + u * 18 + r.range(-1, 1), w: r.range(3.4, 4.4), bow: r.range(-2, 2) - u * 3 });
  }
  const { tips, clumps } = roundCrown(r, { cx, cy, RX, RY, n: r.int(...o.lobes), tuft: [1.8, 3], spread: 2.9, reach: [0.62, 0.82], tipR: [0.33, 0.45], cap: 0.6, under: 4 });
  for (const tp of tips) tp.s = nearest(stems, tp.x, 'tx');
  // aerial roots hang from the underside; some reach the ground and root, the rest swing free
  const roots = [];
  for (let i = 0; i < o.roots; i++) {
    let x = cx + r.range(-0.88, 0.88) * RX;
    if (Math.abs(x - lean) < 11) x = lean + (x < lean ? -1 : 1) * r.range(11, 14);
    const y0 = cy + RY * Math.sqrt(Math.max(0, 1 - ((x - cx) / RX) ** 2)) * 0.5;
    const grounded = r() < 0.4;
    const y1 = grounded ? 0 : lerp(y0, 0, r.range(0.35, 0.8));
    roots.push({ x, y0, y1, grounded, ph: x * 0.07 + r.range(-0.6, 0.6), col: r() < 0.5 ? 'fig2' : 'fig1', bend: r.range(-1.2, 1.2) });
  }
  const amp = 1.3;
  const pk = makePockets(r, 4, cx, cy, RX * 0.85, RY);
  const figs = [];
  for (let i = 0; i < 7; i++) { const x = cx + r.range(-0.8, 0.8) * RX, y = cy + r.range(-0.2, 0.6) * RY; figs.push([x, y, r() < 0.5 ? 'ochre' : 'clay0', x * 0.06]); }
  const strands = [];
  for (let i = 0; i < 5; i++) strands.push({ x0: r.range(-6, 6), x1: lean + r.range(-8, 8), w: r.range(-3, 3) });

  return plant((g, sway, t) => {
    g.part((c) => {
      // buttress fins
      for (const s of [-1, 1]) {
        c.limb(s * 13, 0.5, s * 5, -4, 2, 2.8, 'fig2');
        c.limb(s * 9, 0.6, s * 3, -9, 2.4, 3.2, 'fig2');
      }
      for (const st of stems) bough(c, st.bx, 0.4, st.tx, -B - 4, st.w + 1, st.w * 0.8, 'fig2', st.bow, 0, 5);
      for (const tp of tips) {
        const off = drift(t, tp.ph, tp.y, amp, top);
        bough(c, tp.s.tx, -B - 3, tp.x + off, tp.y + 2, 2.8, 1.4, 'fig2', 0, 3);
      }
      barkShade(c, null, { keys: ['fig2'], left: 1, right: 1 });
      // grooves between the fused stems and lighter strangler strands winding over them
      for (const st of stems) {
        for (let y = -1.5; y > -B + 2; y -= 1) {
          const u = -y / (B + 4), x = lerp(st.bx, st.tx, u) + st.bow * 4 * u * (1 - u) * 0.5;
          c.nudge(x + st.w * 0.5, y, -1);
          if ((Math.floor(-y) % 5) < 3) c.nudge(x - st.w * 0.25, y, 1);
        }
      }
      for (const sd of strands) {
        for (let y = -2; y > -B + 3; y -= 1) {
          const u = -y / B;
          c.px(lerp(sd.x0, sd.x1, u) + Math.sin(u * 6 + sd.w) * 2.5, y, 'fig3', true);
        }
      }
      c.tone((x, y) => (y < -B + 5 ? -1 : 0));
    });
    drawClumps(g, clumps, o.tones, sway, t, { amp, top, flutter: 0.14 });
    pockets(g, pk, o.tones, t, amp, top, 'fig1');
    specks(g, figs, t, amp, top);
  }, def, {
    ...room(RX + Math.abs(lean) + 3, Ht), name,
    // aerial roots: fine 1px lines over everything else, swinging below the crown
    after: (g, sway, t) => {
      for (const rt of roots) {
        const sw = wob(t, rt.ph) * 1.1;
        const ex = rt.x + rt.bend + (rt.grounded ? 0 : sw), mx = rt.x + rt.bend * 0.5 + sw * (rt.grounded ? 0.5 : 0.45);
        const n = Math.max(2, Math.round((rt.y1 - rt.y0) / 1));
        let px = rt.x, py = rt.y0;
        for (let i = 1; i <= n; i++) {
          const u = i / n, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), d = u * u;
          const x = a * rt.x + b * mx + d * ex, y = lerp(rt.y0, rt.y1, u);
          g.pline(px, py, x, y, rt.col);
          // rooted ones thicken into pillars near the ground
          if (rt.grounded && u > 0.55) g.pline(px + 1, py, x + 1, y, 'fig0');
          px = x; py = y;
        }
        if (!rt.grounded) g.px(ex, rt.y1 + 1, 'fig1');
      }
    },
  });
}
const FIG = [
  { rx: [28, 30], ry: [13, 14], h: [48, 50], roots: 7, lobes: [7, 7], tones: LEAF_DEEP }, // classic
  { rx: [36, 38], ry: [12, 13], h: [44, 46], roots: 10, lobes: [8, 8], tones: LEAF_DARK }, // sprawling
  { rx: [20, 22], ry: [16, 17], h: [56, 58], roots: 4, lobes: [5, 5], tones: LEAF_DEEP }, // tall, few roots
  { rx: [28, 30], ry: [13, 14], h: [44, 46], roots: 14, lobes: [6, 6], tones: LEAF }, // root curtain
  { rx: [26, 28], ry: [13, 14], h: [48, 50], roots: 6, lobes: [6, 6], tones: LEAF_DEEP, lean: 5 }, // leaning
];

// ======================================================================================
// Mangrove: arching stilt roots standing in water, short trunk, dense dark dome.
function mangrove(seed, o, name) {
  const q = oldRng(seed);
  const hip = q.range(...o.hip), spread = q.range(...o.spread);
  const ends = [];
  for (let i = 0; i < o.roots; i++) { ends.push((i / (o.roots - 1) - 0.5) * spread + q.range(-2, 2)); q.range(0, 3); }
  const topH = hip + q.range(...o.trunk);
  q.int(...o.lobes);
  const w = q.range(...o.w);
  const def = { shadow: { rx: w / 2 + 10, ry: 7, dy: -1 }, shade: w / 2 + 10, solid: 3 };

  const r = rng(seed);
  const RX = w / 2 + 9, B = topH - 3, Ht = B + (o.dome ? 18 : 15);
  const { RY, cy } = crownBox(B, Ht);
  const cx = 0, top = -Ht;
  const { tips, clumps } = roundCrown(r, { cx, cy, RX, RY, n: r.int(...o.lobes) + 1, tuft: [1.4, 2.3], spread: o.dome ? 2.3 : 2.8, reach: [0.55, 0.72], cap: o.dome ? 0.62 : 0.5, under: o.dome ? 2 : 3 });
  // stilt roots: leave the trunk, arch out, plunge into the water; half stand behind the trunk
  const roots = ends.map((e, i) => ({
    e: e * 1.1, ez: (i % 2 ? 1 : -1) * r.range(0.5, 2), sy: -hip * r.range(0.6, 1) - (i % 3 === 0 ? r.range(2, 5) : 0),
    lift: r.range(2, 5), back: i % 2 === 0,
  }));
  for (let i = 0; i < 2; i++) roots.push({ e: (i ? 1 : -1) * r.range(3, 7), ez: r.range(-1, 1), sy: -hip * 0.45, lift: 1.5, back: i === 0 });
  const PR = spread / 2 + 5;
  const glints = [];
  for (let i = 0; i < 6; i++) glints.push([r.range(-PR * 0.8, PR * 0.8), r.range(-1.4, 1.6), r() * TAU]);
  const amp = 1.2;
  const rootLine = (c, rt, col) => bough(c, 0, rt.sy, rt.e, rt.ez, 1.9, 1.3, col, rt.e * 0.25, -rt.lift - (rt.ez - rt.sy) * 0.35, 5);

  return plant((g, sway, t) => {
    // the water they stand in
    g.ell(0, 0.4, PR + 1, 3.6, 'water0');
    g.ell(-1, 0.1, PR - 3, 2.4, 'water1');
    for (const rt of roots) g.ell(rt.e, rt.ez + 0.3, 1.8, 0.8, 'water2');
    for (const [x, y, ph] of glints) if (Math.sin(t * TAU + ph) > 0.2) g.px(x + Math.sin(t * TAU + ph), y, 'foam', true);
    g.part((c) => {
      for (const rt of roots) if (rt.back) rootLine(c, rt, 'bark1');
      c.tone(() => -1);
    });
    g.part((c) => {
      c.chain([[0, -hip * 0.4, 3.4], [0.3, -hip, 3.2], [0, -topH, 2.8]], 'bark1');
      for (const tp of tips) {
        const off = drift(t, tp.ph, tp.y, amp, top);
        bough(c, 0, -topH + 1, tp.x + off, tp.y + 2, 1.8, 1.1, 'bark1', -tp.x * 0.25, 0);
      }
      for (const rt of roots) if (!rt.back) rootLine(c, rt, 'bark2');
      barkShade(c, null, { keys: ['bark1', 'bark2'] });
      c.tone((x, y) => (y < cy + RY * 0.7 ? -1 : 0));
    });
    drawClumps(g, clumps, o.tones, sway, t, { amp, top, flutter: 0.14 });
  }, def, { ...room(Math.max(RX, PR) + 2, Ht, 7), name });
}
const MANGROVE = [
  { hip: [18, 20], spread: [38, 42], roots: 6, trunk: [10, 12], lobes: [5, 5], w: [28, 32], tones: LEAF_DEEP }, // classic
  { hip: [14, 16], spread: [44, 48], roots: 8, trunk: [8, 10], lobes: [6, 6], w: [38, 42], tones: LEAF_DARK }, // wide, low
  { hip: [20, 24], spread: [28, 32], roots: 5, trunk: [14, 16], lobes: [4, 4], w: [18, 22], tones: LEAF_DEEP, dome: true }, // tall dome
  { hip: [12, 14], spread: [24, 28], roots: 4, trunk: [6, 8], lobes: [3, 3], w: [14, 16], tones: LEAF }, // young
  { hip: [18, 20], spread: [36, 40], roots: 7, trunk: [10, 12], lobes: [5, 5], w: [30, 34], tones: LEAF_OLIVE, dome: true }, // olive dome
];

// ======================================================================================
// Baobab: swollen bottle trunk with folds, short stubby limbs, thin tufts at the limb ends.
function baobab(seed, o, name) {
  const q = oldRng(seed);
  const H = q.range(...o.h), bw = q.range(...o.bw), tw = q.range(...o.tw);
  const half = bw * (o.twin ? 1.6 : 1.1);
  const def = { shadow: { rx: half + 12, ry: 8, dy: -1 }, shade: o.bare ? 0 : half + 16, solid: Math.round(bw * 0.9), rare: !!o.bare };

  const r = rng(seed);
  const bodies = o.twin ? [{ dx: -bw * 0.78, s: 0.8 }, { dx: bw * 0.6, s: 1 }] : [{ dx: 0, s: 1 }];
  // half-width at height fraction f: a swollen column that pinches in under the crown
  const W = (f, s) => {
    const body = bw * s * (0.98 + 0.12 * Math.sin(Math.PI * Math.min(1, f / 0.8)));
    const k = clamp((f - 0.5) / 0.5, 0, 1), e = k * k * (3 - 2 * k);
    return lerp(body, tw * s, e);
  };
  const limbs = [], tufts = [], twigs = [];
  let hw = half;
  for (const b of bodies) {
    const Hb = H * b.s, n = r.int(...o.n);
    b.folds = [-0.64, -0.3, 0.05, 0.38, 0.68].map((u) => u + r.range(-0.06, 0.06));
    for (let i = 0; i < n; i++) {
      const u = n > 1 ? i / (n - 1) - 0.5 : 0;
      const a = -Math.PI / 2 + u * 2.4 + r.range(-0.15, 0.15), L = r.range(8.5, 12.5) * (o.k || 1) * b.s;
      const sx = b.dx + u * tw * b.s * 1.5, sy = -Hb + 1 + Math.abs(u) * 4;
      const ex = sx + Math.cos(a) * L, ey = sy + Math.sin(a) * L * 0.7;
      const ph = ex * 0.06 + r.range(-0.3, 0.3);
      const lb = { sx, sy, ex, ey, ph, w: r.range(3.2, 4) * b.s, bow: r.range(-2, 2), kids: [] };
      // short crooked forks off the end
      const nk = r() < 0.6 ? 2 : 3;
      for (let k = 0; k < nk; k++) {
        const a2 = a + (k - (nk - 1) / 2) * r.range(0.5, 0.8), L2 = r.range(3.5, 5.5) * b.s;
        const kx = ex + Math.cos(a2) * L2, ky = ey + Math.sin(a2) * L2 * 0.8;
        lb.kids.push({ x: kx, y: ky });
        hw = Math.max(hw, Math.abs(kx) + 7);
        if (o.bare) {
          for (let j = 0; j < 2; j++) {
            const a3 = a2 + (j ? 1 : -1) * r.range(0.2, 0.7), L3 = r.range(2.5, 4.5);
            twigs.push({ lb, x0: kx, y0: ky, x1: kx + Math.cos(a3) * L3, y1: ky + Math.sin(a3) * L3, ph: kx * 0.06 + r.range(-0.4, 0.4) });
          }
        } else if (r() < 0.85) {
          tufts.push(clump(r, kx + Math.cos(a2) * 1.5, ky - 1.5, r.range(3.8, 5.4), r.range(2, 2.7), { ph, rim: 0.75, n: 9, tuft: [1.1, 1.8] }));
        }
      }
      limbs.push(lb);
    }
  }
  const top = -H - 16;
  if (tufts.length) relight(tufts, 0, -H - 10, hw, 9, 0.35);
  const amp = 1;

  return plant((g, sway, t) => {
    g.part((c) => {
      for (const lb of limbs) {
        const off = drift(t, lb.ph, lb.ey, amp, top) * 0.6;
        bough(c, lb.sx, lb.sy, lb.ex + off, lb.ey, lb.w, lb.w * 0.55, 'baob2', lb.bow, 1, 3);
        for (const kd of lb.kids) c.limb(lb.ex + off, lb.ey, kd.x + off * 1.5, kd.y, lb.w * 0.5, 1.1, 'baob2');
      }
      for (const b of bodies) {
        const Hb = H * b.s, L = [], R = [];
        for (let i = 0; i <= 16; i++) { const f = i / 16, y = 0.6 - (Hb + 1.5) * f; L.push([b.dx - W(f, b.s), y]); R.unshift([b.dx + W(f, b.s), y]); }
        L[0][0] -= 1.5; R[R.length - 1][0] += 1.5; // splayed foot
        c.poly([...L, ...R], 'baob2');
      }
      barkShade(c, null, { keys: ['baob2'], left: 1, right: 1 });
      for (const b of bodies) {
        const Hb = H * b.s;
        // round form: lit left, a pale band, shadowed right
        c.tone((x, y) => {
          if (y > 1 || y < -Hb - 1) return 0;
          const f = clamp(-y / Hb, 0, 1), u = (x - b.dx) / W(f, b.s);
          if (u < -1.1 || u > 1.1) return 0;
          return u < -0.6 ? 1 : u < -0.25 ? 1 : u > 0.45 ? -1 : 0;
        });
        // vertical folds, each with a pale lip on its lit side
        for (const fu of b.folds) {
          for (let y = -1.5; y > -Hb * 0.9; y -= 1) {
            const f = -y / Hb, x = b.dx + fu * W(f, b.s) + Math.sin(y * 0.3 + fu * 7) * 0.6;
            c.nudge(x, y, -1);
            if (fu < 0.2 && (Math.floor(-y + fu * 10) % 9) < 6) c.nudge(x - 1, y, 1);
          }
        }
        c.tone((x, y) => (y > -2.5 && Math.abs(x - b.dx) < W(0, b.s) + 2 ? -1 : 0));
      }
      // twin: the nearer trunk's edge cuts a dark seam into the one behind
      if (o.twin) {
        const b = bodies[1], Hb0 = H * bodies[0].s;
        for (let y = 0.5; y > -Hb0 * 0.98; y -= 1) {
          const x = b.dx - W(-y / (H * b.s), b.s);
          c.px(x - 0.5, y, 'baob0', true); c.nudge(x - 1.5, y, -1); c.nudge(x + 0.5, y, 1);
        }
      }
    });
    if (tufts.length) drawClumps(g, tufts, o.tones, sway, t, { amp, top, flutter: 0.15, core: false });
  }, def, {
    ...room(hw + 2, H + 22), name,
    after: twigs.length ? (g, sway, t) => {
      for (const tw2 of twigs) {
        const off = drift(t, tw2.lb.ph, tw2.lb.ey, amp, top) * 0.9, sw = wob(t, tw2.ph) * 0.6;
        g.pline(tw2.x0 + off, tw2.y0, tw2.x1 + off + sw, tw2.y1, 'baob0');
      }
    } : null,
  });
}
const BAOBAB = [
  { h: [46, 48], bw: [12, 12], tw: [7, 7], n: [6, 6], tones: LEAF }, // classic bottle
  { h: [54, 58], bw: [9, 10], tw: [5, 6], n: [5, 5], tones: LEAF, k: 0.9 }, // tall and slender
  { h: [34, 36], bw: [14, 15], tw: [9, 10], n: [7, 7], tones: LEAF_OLIVE, k: 1.2 }, // squat giant
  { h: [42, 46], bw: [9, 10], tw: [5, 6], n: [4, 4], tones: LEAF, twin: true }, // twin trunk
  { h: [46, 50], bw: [11, 12], tw: [6, 7], n: [7, 7], bare: true }, // leafless (rare)
];

// ======================================================================================
// Fever tree: tall slender yellow-green trunk, sparse feathery flat layers of foliage.
function fever(seed, o, name) {
  const q = oldRng(seed);
  const H = q.range(...o.h), lean = o.lean ? o.lean * sgn(q) : q.range(-2, 2);
  const def = { shadow: { rx: 18, ry: 6, dy: -1 }, shade: 20, solid: 3 };

  const r = rng(seed);
  const stems = o.twin ? [[-2, -0.3], [2, 0.26]] : [[0, 0]];
  const wood = [], layers = [], fringe = [];
  const k = o.k || 1;
  for (const [bx, a0] of stems) {
    const tx = bx + lean + a0 * H * 0.4, ty = -H;
    const forkF = 0.5 + (o.span ? 0.25 - o.span * 0.5 : 0);
    const fx = lerp(bx, tx, forkF) + r.range(-1, 1), fy = ty * forkF;
    const tw = o.twin ? 2.4 : 3;
    wood.push({ kind: 'trunk', pts: [[bx, 0.4, tw + 0.8], [lerp(bx, fx, 0.5) + r.range(-0.6, 0.6), fy * 0.5, tw + 0.2], [fx, fy, tw - 0.2]] });
    // leaders up from the fork, each with side branches holding flat layers
    const leaders = o.twin ? 2 : r.int(2, 3);
    const nb = r.int(...o.n);
    for (let j = 0; j < leaders; j++) {
      const u = leaders > 1 ? j / (leaders - 1) - 0.5 : 0;
      const lx = tx + u * H * 0.32 * k, ly = ty + Math.abs(u) * 8;
      const ph = lx * 0.06;
      wood.push({ kind: 'limb', x0: fx, y0: fy, x1: lx, y1: ly, w0: tw - 0.6, w1: 1.3, ph, y: ly });
      const rx = r.range(7, 9.5) * k;
      layers.push(clump(r, lx, ly - 1.5, rx, r.range(2.2, 2.7), { ph, flat: 0.9, rim: 0.85, tuft: [1, 1.6], n: Math.round(rx * 2.4) }));
    }
    for (let i = 0; i < Math.max(1, nb - leaders); i++) {
      const s = i % 2 ? 1 : -1, tt = r.range(0.3, 0.55 + (o.span || 0.3));
      const sx = lerp(fx, tx, clamp(tt, 0, 0.85)), sy = lerp(fy, ty, clamp(tt, 0, 0.85));
      const L = r.range(10, 16) * k, ex = sx + s * L, ey = sy - L * r.range(0.3, 0.5);
      const ph = ex * 0.06 + r.range(-0.3, 0.3);
      wood.push({ kind: 'limb', x0: sx, y0: sy, x1: ex, y1: ey, w0: 1.8, w1: 1.1, ph, y: ey });
      const rx = r.range(6, 8.5) * k;
      layers.push(clump(r, ex + s * 2, ey - 1.5, rx, r.range(2, 2.5), { ph, flat: 0.9, rim: 0.85, tuft: [1, 1.5], n: Math.round(rx * 2.4) }));
    }
  }
  // feathery wisps over each layer and fronds hanging under it
  for (const L of layers) {
    const n = Math.round(L.rx * 0.9);
    for (let i = 0; i < n; i++) {
      const u = r.range(-0.95, 0.95), up = i % 3 !== 0;
      const x = L.cx + u * L.rx, e = Math.sqrt(1 - u * u) * L.ry;
      fringe.push(up
        ? { x, y: L.cy - e * 0.8, dx: u * 1.2, dy: -r.int(1, 2), col: 3, ph: L.ph }
        : { x, y: L.cy + e * 0.7, dx: u * 0.6, dy: r.int(1, 3), col: 1, ph: L.ph + r.range(-0.4, 0.4) });
    }
  }
  const top = -H - 6, amp = 1.4;
  const hw = Math.max(...layers.map((L) => Math.abs(L.cx) + L.rx));
  relight(layers, lean, -H * 0.85, hw, H * 0.2, 0.3);

  return plant((g, sway, t) => {
    g.part((c) => {
      for (const wd of wood) {
        if (wd.kind === 'trunk') c.chain(wd.pts, 'fever1');
        else bough(c, wd.x0, wd.y0, wd.x1 + drift(t, wd.ph, wd.y, amp, top), wd.y1, wd.w0, wd.w1, 'fever1', (wd.x0 - wd.x1) * 0.2, 0, 3);
      }
      c.limb(-2.6, 0.4, -0.4, -2.5, 1.4, 1.2, 'fever1'); c.limb(2.6, 0.4, 0.4, -2.5, 1.4, 1.2, 'fever1');
      barkShade(c, null, { keys: ['fever1'], left: 1, right: 1 });
      const rr = rng(seed + 3);
      for (let i = 0; i < 12; i++) c.nudge(lean * 0.3 * rr() + rr.range(-1, 1), -rr.range(3, H * 0.45), -1);
      c.tone((x, y) => (y < -H * 0.72 ? -1 : 0));
    });
    drawClumps(g, layers, o.tones, sway, t, { amp, top, flutter: 0.2 });
  }, def, {
    ...room(hw + 3, H + 8), name,
    after: (g, sway, t) => {
      for (const f of fringe) {
        const off = drift(t, f.ph, f.y, amp, top) * 1.1;
        g.pline(f.x + off, f.y, f.x + f.dx + off * 1.25, f.y + f.dy, o.tones[f.col]);
      }
    },
  });
}
const FEVER = [
  { h: [56, 60], n: [5, 5], tones: FEV_LEAF }, // classic
  { h: [66, 70], n: [4, 4], tones: FEV_LEAF, span: 0.2, k: 0.8 }, // very tall
  { h: [40, 44], n: [6, 7], tones: FEV_LIGHT, span: 0.45 }, // short, bushy
  { h: [52, 56], n: [3, 4], tones: FEV_LEAF, twin: true }, // twin stem
  { h: [54, 58], n: [5, 5], tones: FEV_DARK, lean: 7 }, // leaning
];

// ======================================================================================
// Palm: curved ringed trunk, a crown of fronds that bend and bob; leaflets hang off each spine.
function palm(seed, o, name) {
  const q = oldRng(seed);
  const lean = q.range(...o.lean) * (q() < 0.5 ? -1 : 1);
  let hPair = 0;
  if (o.pair) { hPair = q.range(...o.h) * 0.72; for (let i = 0; i < o.fronds * 2; i++) q(); }
  const H = q.range(...o.h);
  const def = { shadow: { rx: 18, ry: 6, dy: -1 }, shade: 20, solid: 3 };

  const r = rng(seed);
  const trees = [];
  let hw = 0, ht = 0;
  const mk = (bx, h, ln, s) => {
    const nf = o.fronds + (o.torn ? 0 : 1);
    const fronds = [];
    const rot = r() * TAU;
    for (let i = 0; i < nf; i++) {
      const a = rot + (i / nf) * TAU + r.range(-0.2, 0.2);
      const dz = Math.sin(a), l = r.range(...o.L) * s * 1.3;
      fronds.push({
        dx: Math.cos(a), dz, l, ph: r() * TAU + bx * 0.1,
        broken: o.torn && r() < 0.4 ? r.range(0.5, 0.7) : 0, holes: o.torn ? 0.25 : 0, rs: (r() * 1e6) | 0,
      });
      hw = Math.max(hw, Math.abs(bx + ln) + Math.abs(Math.cos(a)) * l + 4);
      ht = Math.max(ht, h + l * 0.7);
    }
    fronds.sort((p, q2) => p.dz - q2.dz);
    trees.push({ bx, h, ln, s, fronds, nuts: o.nuts });
  };
  if (o.pair) mk(-11, hPair, -Math.abs(lean) - 4, 0.8);
  mk(0, H, lean, 1);
  const T5 = o.tones, amp = 1.5;

  // point along the curved trunk
  const along = (T, u) => {
    const cx = T.bx + T.ln * 0.75, cy = -T.h * 0.45, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), d = u * u;
    return [a * T.bx + b * cx + d * (T.bx + T.ln), a * 0.4 + b * cy + d * -T.h];
  };
  // a frond's spine at this phase: an arch out from the crown that droops toward the tip
  const spineOf = (T, f, t) => {
    const [tx, ty] = along(T, 1);
    const w = wob(t, f.ph), bob = wob(t, f.ph + 1.6) * 0.3;
    const sx = w * amp * (0.5 + 0.5 * Math.abs(f.dx)), sy = w * 0.3 * Math.abs(f.dx) + bob;
    const steps = Math.max(6, Math.round(f.l * 1.2)), pts = [];
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      let x = tx + f.dx * f.l * u;
      let y = ty - 0.5 + f.dz * f.l * 0.32 * u - f.l * 0.3 * Math.sin(Math.PI * u * 0.75) + (f.l * 0.42 + (o.droop || 0)) * u ** 2.4;
      if (f.broken && u > f.broken) { const k = u - f.broken; x -= f.dx * f.l * k * 0.6; y += f.l * k * 0.5; }
      pts.push([x + sx * u * u, y + sy * u * u, u]);
    }
    return pts;
  };
  const shadeOf = (f) => {
    const back = f.dz < -0.2 ? 1 : 0;
    return { spine: T5[3 - back + (f.dz > 0.4 ? 1 : 0)], hi: T5[2 - back], lo: T5[1 - back] };
  };
  // the rib, drawn before the outline so every frond reads against the ground
  const rib = (g, T, f, t) => {
    const pts = spineOf(T, f, t), { spine } = shadeOf(f);
    for (let i = 1; i < pts.length; i++) {
      const w = lerp(1.9, 0.7, pts[i][2]) * T.s;
      g.limb(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], w, w, spine);
    }
  };
  // leaflets: 1px lines over the outline, longest mid-frond, hanging further down toward the tip
  const leaflets = (g, T, f, t, respine) => {
    const pts = spineOf(T, f, t), { spine, hi, lo } = shadeOf(f), rr = rng(f.rs);
    for (let i = 2; i < pts.length; i++) {
      const [x, y, u] = pts[i], pr = pts[i - 1];
      const tgx = x - pr[0], tgy = y - pr[1], tl = Math.hypot(tgx, tgy) || 1;
      const nx = -tgy / tl, ny = tgx / tl;
      if (rr() < f.holes) continue;
      const ll = (2 + 3.6 * Math.sin(Math.PI * Math.min(1, u * 1.1))) * T.s * (o.torn ? rr.range(0.45, 1) : rr.range(0.85, 1));
      const flut = wob(t, f.ph + 1 - u * 2) * 0.4 * u;
      for (const side of [-1, 1]) {
        const upper = side * ny < 0;
        if (upper ? i % 2 : i % 3 === 1) continue;
        let vx = tgx / tl * 0.4 + side * nx * 0.5, vy = tgy / tl * 0.4 + side * ny * 0.5 + (upper ? 0 : 0.6) + 0.9 * u;
        const vl = Math.hypot(vx, vy); vx /= vl; vy /= vl;
        const L = ll * (upper ? 0.6 : 1);
        g.pline(x, y, x + vx * L + flut, y + vy * L, upper ? hi : (i % 2 ? lo : hi));
      }
    }
    if (respine) for (let i = 1; i < pts.length; i++) g.pline(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], spine);
  };

  return plant((g, sway, t) => {
    for (const T of trees) {
      g.part((c) => {
        const pts = [];
        for (let i = 0; i <= 12; i++) { const u = i / 12, [x, y] = along(T, u); pts.push([x, y, lerp(3.8, 2.8, u) * T.s + (i === 0 ? 0.8 : 0)]); }
        c.chain(pts, 'bark2');
        barkShade(c, null, { keys: ['bark2'], left: 1, right: 1 });
        // leaf-scar rings, tighter toward the crown
        for (let u = 0.04; u < 0.96; u += lerp(0.07, 0.045, u)) {
          const [x, y] = along(T, u), wd = lerp(3.8, 2.8, u) * T.s / 2;
          c.pline(x - wd, y, x + wd - 0.5, y, 'bark1', true);
        }
      });
    }
    for (const T of trees) {
      const [tx, ty] = along(T, 1);
      for (const f of T.fronds) if (f.dz < 0) rib(g, T, f, t);
      // the crown's boot of old leaf bases
      g.ell(tx, ty + 1, 2.6 * T.s, 2.1 * T.s, 'bark1');
      g.px(tx - 1, ty + 0.4, 'bark2'); g.px(tx + 1, ty + 2, 'bark0');
      if (T.nuts) {
        const sw = wob(t, 0.7) * 0.4;
        for (const [nx, ny] of [[-2.2, 2.6], [0, 3.4], [2.2, 2.6], [-1, 4.6], [1.2, 4.8]]) g.ell(tx + nx + sw, ty + ny, 1.25, 1.2, 'clay0');
        for (const [nx, ny] of [[-2.6, 2.1], [-0.4, 2.9], [1.8, 2.1], [-1.4, 4.1], [0.8, 4.3]]) g.px(tx + nx + sw, ty + ny, 'clay2');
      }
      for (const f of T.fronds) if (f.dz >= 0) rib(g, T, f, t);
    }
  }, def, {
    ...room(hw + 2, ht + 2, 6), name,
    after: (g, sway, t) => {
      for (const T of trees) for (const f of T.fronds) if (f.dz < 0) leaflets(g, T, f, t, false);
      for (const T of trees) for (const f of T.fronds) if (f.dz >= 0) leaflets(g, T, f, t, true);
    },
  });
}
const PALM = [
  { h: [50, 54], lean: [2, 8], fronds: 7, L: [13, 19], tones: PALM_T }, // classic
  { h: [60, 64], lean: [8, 12], fronds: 6, L: [12, 16], tones: PALM_T, droop: 2 }, // tall, leaning
  { h: [34, 38], lean: [0, 3], fronds: 8, L: [14, 18], tones: ['palm0', 'palm1', 'palm2', 'palm3', 'leaf4'], nuts: true }, // short, full
  { h: [48, 52], lean: [4, 7], fronds: 7, L: [13, 17], tones: PALM_T, pair: true }, // pair
  { h: [44, 48], lean: [2, 6], fronds: 5, L: [10, 14], tones: ['lushD', 'lush0', 'lush1', 'lush2', 'lush3'], droop: -2, torn: true }, // wind-torn
];

const grow = (list, base, make, tag) => list.map((o, i) => make(base + i * 7, o, `${tag}[${i}]`));

export function build() {
  return {
    props: {
      mopane: grow(MOPANE, 101, mopane, 'mopane'),
      marula: grow(MARULA, 221, marula, 'marula'),
      fig: grow(FIG, 231, fig, 'fig'),
      baobab: grow(BAOBAB, 21, baobab, 'baobab'),
      fever: grow(FEVER, 111, fever, 'fever'),
      mangrove: grow(MANGROVE, 261, mangrove, 'mangrove'),
      palm: grow(PALM, 171, palm, 'palm'),
    },
  };
}

// Acacias: the plain acacia and the wide umbrella thorn. The exemplar tree for the redraw:
// a forked trunk, limbs that fan out to hold a flat layered crown, built from leaf tufts that
// lean and flutter through an 8-frame wind loop.
import { rng, clump, drawClumps, barkShade, plant, lerp, TAU } from './flora.js';

const LEAF = ['leafD', 'leaf0', 'leaf1', 'leaf2', 'leaf3'];
const LEAF_DARK = ['olLeaf', 'leafD', 'leaf0', 'leaf1', 'leaf2'];
const LEAF_LIGHT = ['leaf0', 'leaf1', 'leaf2', 'leaf3', 'leaf4'];
const LEAF_OLIVE = ['leafD', 'lushD', 'lush0', 'lush1', 'lush2'];
const LEAF_DRY = ['thornD', 'thorn0', 'thorn1', 'lush1', 'lush2'];
const BARK = ['barkD', 'bark0', 'bark1', 'bark2', 'bark3'];

function acacia(seed, o) {
  const r = rng(seed);
  const lean = o.lean ? o.lean * r.sign() : r.range(-1.5, 1.5);
  const forkY = -r.range(...o.fork), fx = lean * 0.5;
  const tw = o.trunk || 3.8;
  const n = r.int(...o.n), span = r.range(...o.span), top = -r.range(...o.top);
  // limb tips along a shallow dome
  const tips = [];
  for (let i = 0; i < n; i++) {
    const u = n > 1 ? i / (n - 1) - 0.5 : 0;
    const outer = o.tiers && (i === 0 || i === n - 1);
    const ex = lean + u * span * 0.86 + r.range(-2.5, 2.5);
    const ey = top + 4 + Math.abs(u) * Math.abs(u) * (o.flat ? 14 : 22) + r.range(-1.5, 2) + (outer ? 9 : 0);
    // each limb leaves the fork low and sweeps out, then turns up into the crown
    const mx = lerp(fx, ex, 0.62) + r.range(-2, 2), my = lerp(forkY, ey, 0.42);
    tips.push({ ex, ey, mx, my, outer, w: lerp(2.6, 1.9, Math.abs(u) * 2), twig: r.range(-5, 5), ph: ex * 0.06 });
  }
  // crown: a flat plate of wide thin clumps over the tips, one more layer on top, small ones at the rim
  const clumps = [];
  const k = o.flat ? 1.15 : 1;
  if (!o.sparse) {
    for (const tp of tips) {
      const s = tp.outer ? 0.8 : 1;
      clumps.push(clump(r, tp.ex + r.range(-2, 2), tp.ey - 2.5, r.range(10, 13) * k * s, r.range(3.6, 4.6) * s, { flat: 0.6, rim: 0.7, shade: -1 }));
    }
    clumps.push(clump(r, lean, top - 0.5, (o.tiers ? span * 0.3 : span * 0.4) + 3, o.flat ? 4.2 : 5.4, { flat: 0.8, rim: 0.75 }));
    for (const s of [-1, 1]) clumps.push(clump(r, lean + s * span * 0.3 + r.range(-3, 3), top + 2.5 + r.range(-1, 1), r.range(9, 12) * k, r.range(3.4, 4.2), { flat: 0.7, rim: 0.7 }));
    if (!o.flat) clumps.push(clump(r, lean + r.range(-4, 4), top - 4, span * 0.22, 3.6, { flat: 0.8, rim: 0.7, shade: 0 }));
  } else {
    // dying tree: a few thin tufts left on some of the tips
    for (const tp of tips) if (r() < 0.6) clumps.push(clump(r, tp.ex, tp.ey - 2, r.range(5, 7), r.range(2.2, 3), { flat: 0.5, rim: 0.6, n: 7, tuft: [1.3, 2] }));
  }
  const amp = o.sparse ? 0.9 : 1.5;
  return plant((g, sway, t) => {
    g.part((c) => {
      // root flare, trunk, fork
      c.chain([[0, 0.4, tw + 0.8], [fx * 0.3, forkY * 0.3, tw + 0.3], [fx, forkY, tw]], 'bark1');
      c.limb(-tw * 0.75, 0.4, -0.5, -3, 1.6, 1.4, 'bark1'); c.limb(tw * 0.75, 0.4, 0.5, -3, 1.6, 1.4, 'bark1'); // root flare
      for (const tp of tips) {
        const off = Math.sin(t * TAU - tp.ph) * amp * 0.6;
        c.chain([[fx, forkY + 1, tp.w + 0.6], [tp.mx, tp.my, tp.w], [tp.ex + off, tp.ey, 1.5]], 'bark1');
        if (o.sparse) c.chain([[tp.ex + off, tp.ey, 1.4], [tp.ex + tp.twig + off * 1.4, tp.ey - 5, 1]], 'bark1');
        else c.chain([[tp.mx, tp.my, 1.5], [lerp(tp.mx, tp.ex, 0.3) + tp.twig, tp.ey + 1 + off * 0.3, 1.2]], 'bark1');
      }
      barkShade(c, null, { keys: ['bark1'] });
      for (let y = -3; y > forkY + 2; y -= 4) c.px(lerp(0, fx, y / forkY) + ((y / 4) & 1 ? 0.5 : -0.8), y, 'bark0', true); // bark nicks
      // the crown throws its shadow on the upper limbs
      c.tone((x, y) => (y < top + 13 ? -1 : 0));
    });
    drawClumps(g, clumps, o.tones, sway, t, { amp, top: top - 4, flutter: 0.16 });
  }, o.sparse
    ? { shadow: { rx: span / 2, ry: 6, dy: -1 }, shade: 0, solid: 4, rare: true }
    : { shadow: { rx: span / 2 + 8, ry: o.flat ? 10 : 11, dy: -1 }, shade: span / 2 + 8, solid: 4 },
  { side: 70, up: 84 });
}

const ACACIA = [
  { fork: [16, 22], n: [3, 5], span: [46, 56], top: [44, 52], tones: LEAF }, // classic
  { fork: [24, 28], n: [3, 4], span: [34, 42], top: [56, 62], tones: LEAF_OLIVE, trunk: 3.3 }, // tall, narrow
  { fork: [16, 20], n: [4, 5], span: [48, 56], top: [46, 50], tones: LEAF, lean: 6 }, // wind-leaned
  { fork: [18, 22], n: [5, 5], span: [58, 64], top: [50, 54], tones: LEAF_DARK, tiers: true }, // two-tier
  { fork: [9, 12], n: [3, 3], span: [26, 32], top: [28, 32], tones: LEAF_LIGHT, trunk: 2.8 }, // young
  { fork: [16, 20], n: [4, 5], span: [44, 52], top: [44, 50], tones: LEAF_DRY, sparse: true }, // dying (rare)
];
const UMBRELLA = [
  { flat: true, fork: [16, 22], n: [5, 6], span: [72, 82], top: [46, 50], tones: LEAF_DARK }, // classic
  { flat: true, fork: [20, 24], n: [6, 6], span: [88, 96], top: [52, 56], tones: LEAF_DARK, trunk: 4.6 }, // giant
  { flat: true, fork: [10, 13], n: [5, 5], span: [62, 68], top: [36, 40], tones: LEAF }, // low and flat
  { flat: true, fork: [16, 20], n: [5, 6], span: [70, 78], top: [44, 48], tones: LEAF_OLIVE, lean: 6 }, // leaning
  { flat: true, fork: [18, 22], n: [6, 6], span: [78, 86], top: [50, 54], tones: LEAF_DARK, tiers: true }, // two-tier
  { flat: true, fork: [16, 20], n: [5, 6], span: [70, 80], top: [44, 48], tones: LEAF_DRY, sparse: true }, // dying (rare)
];

export function build() {
  void BARK;
  return {
    props: {
      acacia: ACACIA.map((o, i) => acacia(11 + i * 7, o)),
      umbrella: UMBRELLA.map((o, i) => acacia(16 + i * 7, o)),
    },
  };
}

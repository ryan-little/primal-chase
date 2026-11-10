// Landmarks: the ten secret places. The biggest set pieces in the game, so each one is built as a
// small scene: static masses (rock, bone, wood) are painted once with flat planes, then every frame
// of an 8-frame ambient loop lays its moving parts (grass, smoke, feathers, water) around them.
//
// Coordinates: origin at the anchor on the ground, x right, y down (heights are negative).
// Light comes from above and a little to the left (props are mirrored at random in the game).
import { Pix, cropAnim, lerp, clamp, TAU } from './pix.js';
import { addColors, addRamp } from './pal.js';
import { rng, clump, drawClumps, strand, blade } from './flora.js';

addColors({
  lmBao0: '#3b2c27', lmBao1: '#5b4841', lmBao2: '#7c665b', lmBao3: '#9c8676', lmBao4: '#bba895',
  lmObs0: '#5d6274', lmObs1: '#9aa6bd',
  lmSmoke0: '#8d8a84', lmSmoke1: '#b9b5ad',
  lmWisp0: '#c9c3b6', lmWisp1: '#e6e1d6',
  lmIvory0: '#8f7d55', lmIvory1: '#c9b585', lmIvory2: '#e9d9ab', lmIvory3: '#fbf0d2',
  lmGourd0: '#7a5a22', lmGourd1: '#a8833a', lmGourd2: '#cfae5e',
});
addRamp('lmBao', ['lmBao0', 'lmBao1', 'lmBao2', 'lmBao3', 'lmBao4'], 'olRock');
addRamp('lmIvory', ['lmIvory0', 'lmIvory1', 'lmIvory2', 'lmIvory3'], 'olBone');
addRamp('lmGourd', ['lmGourd0', 'lmGourd1', 'lmGourd2'], 'olFur');

const FR = 8;
const ROCK = ['rock0', 'rock1', 'rock2', 'rock3', 'rock4'];

// ---------- scene builder ----------
// Layers, in paint order:
//   S(fn): static, painted once and laid over (sep: contact line on what is under it)
//   A(fn): animated, painted every frame, before the outline
//   F(fn): fine detail painted after the outline (1px blades, smoke, glints);
//          F(fn, { under: true }) stays behind every S(fn, { front: true }) layer
const S = (fn, o = {}) => ({ k: 's', fn, ...o });
const A = (fn, o = {}) => ({ k: 'a', fn, ...o });
const F = (fn, o = {}) => ({ k: 'f', fn, ...o });

// Pix.flush clears only the part of the shared scratch canvas inside the stage, so a shape that
// spills past a stage edge leaves a ghost that a later, bigger stage picks up. Wipe it all.
function wipeScratch() {
  const p = new Pix(240, 240, 0, 0, { ss: 3 });
  p.rect(-4, -4, 248, 248, 'ink');
  p.flush();
}

function scene([side, up, down], layers, def, { ss = 3, frames = FR } = {}) {
  wipeScratch();
  const mk = () => new Pix(side * 2, up + down, side, up, { ss });
  const masks = [];
  for (const L of layers) if (L.k === 's') {
    const p = mk(); L.fn(p); p.flush(); L.pix = p;
    // a front layer hides fine detail drawn "under" it, outline included
    if (L.front) { const m = mk(); m.over(p); m.outline({}); masks.push(m.buf); }
  }
  const list = [];
  for (let i = 0; i < frames; i++) {
    const t = i / frames, g = mk();
    for (const L of layers) {
      if (L.k === 's') g.over(L.pix, { sep: L.sep || 0 });
      else if (L.k === 'a') { if (L.sep) g.part((c) => L.fn(c, t, i), { sep: L.sep }); else L.fn(g, t, i); }
    }
    g.outline({});
    for (const L of layers) {
      if (L.k !== 'f') continue;
      if (!L.under) { L.fn(g, t, i); continue; }
      const c = mk(); L.fn(c, t, i); c.flush();
      for (let k = 0; k < c.buf.length; k++) if (c.buf[k] && !masks.some((m) => m[k])) g.buf[k] = c.buf[k];
    }
    list.push(g);
  }
  wipeScratch();
  return cropAnim(list, def);
}

// ---------- shared pieces ----------
const wave = (t, ph = 0) => Math.sin(t * TAU - ph);

// Facet shading: split a mass into flat planes (the nearest of scattered seeds), each lit by the
// way its plane faces: up and left are bright. Gives rock and bone faces instead of round blobs.
//   sq: squash of the distance (>1 makes planes wide and flat like bedding), bias: overall tone.
function facets(c, seed, { cx, cy, rx, ry, n = 14, tones = ROCK, bias = 0, jit = 0.3, sq = 1.4, only = null, lx = 0.45 }) {
  const r = rng(seed), pts = [];
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = Math.sqrt(r());
    const nx = Math.cos(a) * d, ny = Math.sin(a) * d;
    pts.push([cx + nx * rx, cy + ny * ry, -ny * 0.95 - nx * lx + r.range(-jit, jit) + bias]);
  }
  const m = tones.length - 1;
  c.remap((x, y, hex) => {
    if (only && !only.includes(hex)) return undefined;
    let best = 1e9, L = 0;
    for (const p of pts) {
      const d = (x - p[0]) ** 2 + ((y - p[1]) * sq) ** 2;
      if (d < best) { best = d; L = p[2]; }
    }
    return tones[clamp(Math.round((L + 1) / 2 * m + 0.25), 0, m)];
  });
  return c;
}

// A faceted rock mass on its own part: silhouette, planes, a lit top rim, a dark base.
function rock(g, seed, pts, o = {}) {
  const tones = o.tones || ROCK;
  g.part((c) => {
    c.blob(pts, tones[2], o.k ?? 0.35);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    facets(c, seed, { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, rx: (x1 - x0) / 2, ry: (y1 - y0) / 2, tones, n: o.n || Math.round(6 + (x1 - x0) * (y1 - y0) / 90), ...(o.f || {}) });
    c.bevel({ up: 1, down: o.down ?? 1, hi: 1, lo: 1 });
    if (o.after) o.after(c);
    if (o.ol) c.outline({}); // for rocks laid on after the scene's outline pass
  }, { sep: o.sep ?? 1 });
  return g;
}

// A grass tuft: blades fanned from a short root line, leaning with the wind. Pixel-exact 1px
// blades; the tall ones at the back are darkest, the short front ones catch the light.
function tuft(g, x, y, t, { seed = 1, n = 7, h = 8, w = 4, cols = ['tall0', 'tall1', 'tall2', 'tall3'], amp = 1.3, ph = x * 0.08, lean = 0 } = {}) {
  const r = rng(seed), wv = wave(t, ph) * amp, bl = [];
  for (let i = 0; i < n; i++) {
    const u = n > 1 ? i / (n - 1) - 0.5 : 0;
    bl.push({ u, rx: u * w + r.range(-0.5, 0.5), len: Math.max(2.5, h * (1 - u * u * 1.8) * r.range(0.65, 1.05)) });
  }
  bl.sort((a, b) => b.len - a.len);
  bl.forEach((b, j) => {
    const col = cols[Math.min(cols.length - 1, Math.floor(j / n * cols.length))];
    blade(g, x + b.rx, y, b.len, b.u * b.len * 0.7 + lean, wv * b.len / h, col);
  });
}

// ---------- 1. the painted cave ----------
// Leaping cat with its spots, running right
const CAT = [
  'o..........o.o',
  '.o........oooo',
  '..oooooooooooo',
  '..ookoookoooo.',
  '.oo........oo.',
  'o...........o.',
];
// San runners: thin, leaning into a long stride
const HUNTER = [
  '.....oo',
  '.....o.',
  '....oo.',
  '...oo..',
  '...o...',
  '..o.o..',
  '.o...o.',
  'o.....o',
];
const HUNTER2 = [
  '....oo.',
  '....o..',
  '...oo..',
  '...o...',
  '..oo...',
  '..o.o..',
  '..o..o.',
  '.o...o.',
];
const ELAND = [
  '.........k.',
  '..oooo...oo',
  '.ooooooooo.',
  'oowwwwwoo..',
  '.o.o..o.o..',
  '.o.o..o.o..',
];
const HAND = [
  'w.w.w',
  'wwwww',
  '.www.',
  '.ww..',
];
const flipRows = (rows) => rows.map((s) => s.split('').reverse().join(''));

function painted() {
  const back = (g) => {
    rock(g, 3, [[-48, 1], [-49, -12], [-45, -26], [-38, -36], [-26, -42], [-10, -44], [10, -44], [28, -42], [40, -36], [47, -24], [49, -10], [49, 1]], { sep: 0, f: { bias: -0.25, jit: 0.4 } });
    // the painted face: a flat, smooth, lit panel left of the mouth
    g.part((c) => {
      c.poly([[-42, -3], [-45, -17], [-41, -30], [-28, -34], [2, -34], [4, -24], [3, -4]], 'rock3');
      c.tone((x, y) => (y > -9 ? -1 : 0));
      c.pline(-41, -22, -37, -20, 'rock2'); c.pline(-37, -20, -36, -15, 'rock2');
      c.pline(-5, -12, -1, -7, 'rock2');
    }, { sep: 1 });
  };
  const brow = (g) => {
    // a perched boulder top left, and the great one that makes the overhang
    rock(g, 13, [[-45, -33], [-44, -42], [-37, -47], [-30, -43], [-29, -33]], { f: { bias: -0.1 } });
    rock(g, 17, [[-30, -36], [-27, -49], [-15, -58], [4, -61], [22, -58], [34, -50], [37, -40], [30, -33], [-24, -33]], {
      f: { bias: 0.05, jit: 0.35 },
      after: (c) => c.tone((x, y) => (y > -37 ? -2 : y > -39 ? -1 : 0)), // its underside, out of the sun
    });
    // the overhang's shadow on the face and over the mouth
    g.tone((x, y) => (y > -33 && y < -29 && x > -28 && x < 31 ? -1 : 0));
    g.part((c) => {
      c.blob([[5, 0], [4, -12], [7, -23], [14, -30], [24, -30], [29, -23], [30, -12], [31, 0]], 'ink', 0.4);
      c.ell(18, -1, 10, 2.4, 'inkSoft');
    });
    g.tone((x, y) => (x > 30 && x < 33 && y > -26 && y < 0 ? -1 : 0));
    g.pline(4, -12, 6, -21, 'rock4', true);
  };
  const front = (g) => {
    rock(g, 7, [[30, 1], [29, -9], [34, -18], [42, -20], [48, -14], [49, 1]]);
    rock(g, 9, [[-49, 2], [-48, -5], [-43, -8], [-38, -6], [-36, 2]]);
    rock(g, 11, [[-4, 3], [-3, -1], [1, -3], [5, -1], [5, 3]], { n: 4 });
    rock(g, 12, [[24, 3], [25, 0], [28, -1], [30, 3]], { n: 3 });
  };
  const art = (g) => {
    const L = { o: 'ochre', k: 'ink', w: 'paint', d: 'ochreD' };
    const faint = { o: 'clay1', k: 'rock2', w: 'rock4', d: 'clay1' };
    // the frieze: the cat leads, three hunters with spears behind it
    g.stamp(-15, -30, CAT, L);
    for (const [x, rows] of [[-23, HUNTER], [-30, HUNTER2], [-37, HUNTER]]) g.stamp(x, -31, rows, L);
    g.pline(-21, -33, -15, -35, 'ochreD'); // the lead hunter's spear, raised to throw
    g.pline(-29, -33, -24, -34, 'ochreD');
    // and behind them more, worn faint
    g.stamp(-43, -19, HUNTER2, faint); g.stamp(-37, -19, HUNTER, faint);
    // elands, one walking each way
    g.stamp(-29, -17, ELAND, L);
    g.stamp(-16, -17, flipRows(ELAND), { ...L, o: 'ochreD' });
    // handprints by the mouth, one white, one red, one high on the far rock
    g.stamp(-4, -30, HAND, L); g.stamp(-4, -23, HAND, { w: 'ochre' });
    g.stamp(39, -31, HAND, L);
  };
  const flicker = (g, t) => {
    // something deep in the mouth: a faint warm breath of light
    const k = 0.5 + 0.5 * Math.sin(t * TAU * 2) * Math.cos(t * TAU);
    g.ell(18, -8, 1.6 + k, 1 + k * 0.5, 'mudD');
    if (k > 0.45) g.px(18, -8, 'mud0');
  };
  const grass = (g, t) => {
    tuft(g, -31, 2, t, { seed: 1, n: 8, h: 10, w: 5 });
    tuft(g, -15, 2, t, { seed: 2, n: 5, h: 7 });
    tuft(g, 8, 2, t, { seed: 3, n: 6, h: 8 });
    tuft(g, 39, 3, t, { seed: 4, n: 8, h: 10, w: 5 });
    tuft(g, 20, -59, t, { seed: 5, n: 5, h: 6, w: 3, amp: 1 });
    tuft(g, -38, -46, t, { seed: 6, n: 4, h: 5, w: 2, amp: 1 });
  };
  return scene([54, 70, 8], [S(back), S(brow), S(art), A(flicker), S(front), F(grass)],
    { solid: 22, shade: 34, shadow: { rx: 40, ry: 9, dy: 0 } });
}

// Round wood or bone: every pixel of color `hex` is lit by where it sits across its own limb.
// The thin direction (left-right for an upright trunk, up-down for a level branch) is the cross
// section; light comes from the left and from above. extra(x, y, L) may add folds or grain.
function roundShade(c, hex, tones, extra = (x, y, L) => L) {
  c.flush();
  const { w, h, buf } = c, src = buf.slice();
  const filled = (i, j) => i >= 0 && j >= 0 && i < w && j < h && src[j * w + i];
  const run = (i, j, di, dj) => { let k = 0; while (k < 30 && filled(i + di * (k + 1), j + dj * (k + 1))) k++; return k; };
  const m = tones.length - 1;
  c.remap((x, y, hx) => {
    if (hx !== hex) return undefined;
    const i = Math.floor(x + c.ax), j = Math.floor(y + c.ay);
    const l = run(i, j, -1, 0), r = run(i, j, 1, 0), u = run(i, j, 0, -1), d = run(i, j, 0, 1);
    const L = l + r <= u + d ? (r - l) / (l + r + 1) * 1.5 + 0.2 : (d - u) / (u + d + 1) * 1.3;
    return tones[clamp(Math.round(extra(x, y, L) + m / 2), 0, m)];
  });
}

// ---------- bone ----------
// Bone on its own part: drawn in one bone tone, then lit on the top/left edges, shaded under.
function bonePart(g, fn, { sep = 1, base = 'bone', up = 1, down = 1, left = 1, right = 0 } = {}) {
  g.part((c) => { fn(c, base); c.bevel({ up, down, left, right, hi: 1, lo: 1 }); }, { sep });
  return g;
}
// A long bone lying on the ground: shaft with knuckled ends.
function longBone(c, x0, y0, x1, y1, w, col) {
  c.limb(x0, y0, x1, y1, w, w * 0.85, col);
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
  for (const [x, y, k] of [[x0, y0, 1], [x1, y1, 0.85]]) {
    c.ell(x + nx * w * 0.45, y + ny * w * 0.45, w * 0.7 * k, w * 0.6 * k, col);
    c.ell(x - nx * w * 0.45, y - ny * w * 0.45, w * 0.7 * k, w * 0.6 * k, col);
  }
}

/// ---------- 2. where the great ones lie ----------
function graveyard() {
  // the cage: a spine that rises toward the head end, ribs hanging off it like a hut frame
  const spineY = (x) => -22 - (x + 24) * 0.1 - Math.sin((x + 24) / 36 * Math.PI) * 3;
  const ribX = [-19, -13, -7, -1, 5];
  const ribLen = (i) => 21 - Math.abs(i - 1.8) * 2.4;
  const farRibs = (g) => {
    bonePart(g, (c) => {
      for (const [i, x] of ribX.entries()) {
        const y0 = spineY(x + 3), L = ribLen(i) - 5;
        c.curve([[x + 3, y0], [x + 6, y0 + L * 0.4], [x + 6.5, y0 + L * 0.8], [x + 5.5, y0 + L]], 1.4, 'bone0');
      }
      // the older one, half buried: rib tips breaking the ground behind its skull
      for (const [x, h] of [[-44, 6], [-40, 9], [-36, 10], [-32, 8]]) c.curve([[x, -3], [x - 1.5, -3 - h * 0.6], [x + 0.5, -3 - h]], 1.5, 'bone0');
    }, { base: 'bone0', sep: 0, left: 0 });
    // shade on the ground inside the cage
    g.part((c) => { c.ell(-6, -4, 17, 3, 'tall0'); }, { sep: 0 });
  };
  const old = (g) => {
    // its skull sunk to the brow, sockets full of dust
    g.part((c) => {
      c.blob([[-46, 1], [-45, -5], [-40, -9], [-33, -9], [-28, -5], [-27, 1]], 'bone0', 0.5);
      facets(c, 41, { cx: -37, cy: -4, rx: 10, ry: 5, n: 5, tones: ['boneD', 'bone0', 'bone0', 'bone', 'bone'], bias: 0.1 });
      c.bevel({ up: 1, down: 0, hi: 1 });
      c.blob([[-41, -5], [-38, -6], [-37, -3], [-40, -2]], 'inkSoft', 0.5);
      c.px(-39, -4, 'ink');
      c.pline(-45, 1, -27, 1, 'sand0'); c.pline(-44, 0, -29, 0, 'sand1', true); // the dust lip it sank into
    }, { sep: 1 });
  };
  const nearRibs = (g) => {
    bonePart(g, (c) => {
      // pelvis at the tail end
      c.blob([[-27, -25], [-23, -28], [-21, -24], [-23, -18], [-26, -19]], 'bone', 0.4);
      // spine with its spines along the top
      const sp = [];
      for (let x = -24; x <= 12; x += 3) sp.push([x, spineY(x)]);
      c.curve(sp, 2.6, 'bone');
      for (let x = -21; x <= 10; x += 3) c.limb(x, spineY(x) - 1, x - 0.8, spineY(x) - 4, 1.5, 1, 'bone');
      for (const [i, x] of ribX.entries()) {
        const y0 = spineY(x) + 1, L = ribLen(i);
        c.curve([[x, y0], [x - 3, y0 + L * 0.35], [x - 3.2, y0 + L * 0.75], [x - 1, y0 + L]], 2.2, 'bone');
      }
    }, { sep: 1 });
  };
  const skull = (g) => {
    // the skull: a big flat brow facing left with the nasal pit high on it, a domed crown,
    // the orbit on its shaded side, tusk sheaths running down into the tusks
    g.part((c) => {
      c.blob([[16, -2], [15, -14], [19, -23], [27, -27], [36, -25], [42, -18], [44, -8], [41, -1], [28, 0]], 'bone0', 0.4);
      c.poly([[16, -2], [15, -13], [18, -21], [25, -24], [29, -17], [28, -7], [25, -2]], 'bone'); // brow plane
      c.poly([[19, -22], [26, -27], [35, -26], [38, -22], [31, -21], [26, -24]], 'bone1'); // crown
      c.poly([[34, -6], [42, -12], [44, -6], [41, -1], [30, 0]], 'boneD'); // under the jaw line
      c.bevel({ up: 1, down: 0, hi: 1, lo: 1 });
      // nasal pit and orbit: deep, with a lit lower lip
      c.blob([[18, -20], [22, -23], [26, -21], [26, -16], [22, -14], [19, -16]], 'ink', 0.5);
      c.px(20, -19, 'inkSoft'); c.px(21, -20, 'inkSoft');
      c.pline(20, -13, 25, -14, 'bone1', true);
      c.blob([[32, -15], [35, -16], [36, -14], [34, -13]], 'inkSoft', 0.5);
      c.pline(32, -17, 36, -17, 'boneD', true); // brow ridge shading the orbit
      // sheaths down the brow
      c.pline(19, -11, 18, -3, 'bone0', true); c.pline(23, -11, 23, -3, 'bone0', true);
      // cracks
      c.pline(37, -24, 39, -21, 'boneD', true); c.pline(39, -21, 38, -19, 'boneD', true);
      c.pline(28, -10, 30, -8, 'boneD', true);
    }, { sep: 1 });
    // tusks: the far one first, then the near one sweeping out and up
    // ivory, yellower than the bleached bone, sweeping out toward you along the ground
    bonePart(g, (c) => {
      c.chain([[24, -4, 3], [21, 0, 2.8], [15, 2, 2.5], [9, 1.5, 2.1], [5, -2, 1.6], [4, -6, 1]], 'lmIvory1');
    }, { base: 'lmIvory1' });
    bonePart(g, (c) => {
      c.chain([[19, -5, 3.8], [16, 1, 3.6], [9, 4.5, 3.2], [1, 4.5, 2.8], [-6, 2, 2.3], [-10, -2, 1.8], [-12, -6, 1.2]], 'lmIvory2');
      c.pline(-1, 6, 9, 6, 'lmIvory0', true);
    }, { base: 'lmIvory2' });
    // long bones scattered in front
    bonePart(g, (c) => {
      longBone(c, -22, 4, -14, 3, 2, 'bone');
      longBone(c, 31, 3, 40, 1.5, 1.8, 'bone');
      c.ell(-26, 3, 1.6, 1.2, 'bone');
    });
  };
  const vulture = (g, t) => {
    // a vulture hunched on the crown: looks around, lifts a wing to cool, settles
    const lift = clamp(Math.sin((t - 0.35) * TAU) * 1.6 - 0.6, 0, 1);
    const look = Math.sin(t * TAU * 2 + 1) > 0.2 ? 1 : 0;
    const x = 30, y = -26;
    g.part((c) => {
      c.limb(x + 3, y - 3, x + 7, y - 1, 2.4, 1.4, 'mudD'); // tail
      c.ell(x + 1.5, y - 4, 4.2, 3.2, 'mud0', -0.25); // hunched body
      if (lift > 0.05) {
        const a = lift;
        c.poly([[x, y - 6], [x + 3 + a, y - 7 - a * 6], [x + 9 + a * 2, y - 6 - a * 6], [x + 8, y - 3], [x + 2, y - 2]], 'mud1');
        for (let k = 0; k < 3; k++) c.limb(x + 6 + k * 1.3 + a * 1.5, y - 5 - a * 4.5 + k, x + 8.5 + k * 1.2 + a * 2, y - 3 - a * 3.5 + k * 1.2, 1, 0.6, 'mudD');
      } else {
        c.ell(x + 2.5, y - 4.5, 3.4, 2.4, 'mud1', -0.25); // folded wing
        c.pline(x + 3, y - 2, x + 6, y - 2, 'mudD');
      }
      c.ell(x - 1.5, y - 6.5, 2, 1.4, 'bone'); // ruff
      c.ell(x - 3 + look * 0.6, y - 8, 1.5, 1.2, 'ostP'); // bare head
      c.px(x - 4.5 + look * 1.2, y - 8, 'boneD'); // hooked beak
      c.px(x - 4.5 + look * 1.2, y - 7, 'ink');
      c.px(x - 3 + look, y - 9, 'ink'); // eye
      c.px(x, y - 0.5, 'boneD'); c.px(x + 2, y - 0.5, 'boneD');
      c.bevel({ up: 1, down: 0, hi: 1, only: ['mud0', 'mud1'] });
    }, { sep: 1 });
  };
  const grass = (g, t) => {
    // dry grass growing up through the cage
    tuft(g, -16, -3, t, { seed: 21, n: 8, h: 12, w: 4 });
    tuft(g, -6, -3, t, { seed: 22, n: 7, h: 10, w: 4 });
    tuft(g, 3, -4, t, { seed: 23, n: 7, h: 13, w: 4 });
  };
  const grass2 = (g, t) => {
    tuft(g, -27, 3, t, { seed: 24, n: 6, h: 8 });
    tuft(g, 12, 3, t, { seed: 25, n: 5, h: 7 });
    tuft(g, 42, 2, t, { seed: 26, n: 6, h: 8 });
    tuft(g, -46, 2, t, { seed: 27, n: 5, h: 6 });
  };
  return scene([54, 56, 10], [S(farRibs), F(grass, { under: true }), S(old), S(nearRibs, { front: true, sep: 1 }), S(skull, { front: true }), A(vulture), F(grass2)],
    { solid: 14, shadow: { rx: 38, ry: 5, dy: 0 } });
}

// ---------- 3. the hidden spring ----------
const LUSH = ['lushD', 'lush0', 'lush1', 'lush2', 'lush3'];

// A date-palm frond from (x, y): leaves at angle a (0 = right), arcs and droops, with a comb of
// leaflets hanging under it. w: wind travel at the tip.
function frond(g, x, y, a, len, droop, w, cols) {
  const pts = [];
  for (let k = 0; k <= 4; k++) {
    const s = k / 4;
    pts.push([x + Math.cos(a) * len * s + w * s * s, y + Math.sin(a) * len * s * 0.8 + droop * s * s - Math.abs(w) * s * s * 0.2]);
  }
  g.curve(pts, 1.8, cols[1]);
  // leaflets: short strokes hanging off the rib, longest mid-frond
  for (let k = 1; k < 9; k++) {
    const s = k / 9, i = Math.min(3, Math.floor(s * 4)), u = s * 4 - i;
    const p = [lerp(pts[i][0], pts[i + 1][0], u), lerp(pts[i][1], pts[i + 1][1], u)];
    const L = 3.2 * Math.sin(s * Math.PI) + 0.8, dir = Math.cos(a) >= 0 ? 1 : -1;
    g.pline(p[0], p[1], p[0] + dir * L * 0.35, p[1] + L, cols[0]);
  }
  g.curve(pts.slice(0, 4), 0.9, cols[2]);
}
// A whole date-palm crown: fronds all round, back ones dark, front ones light, dates under it.
function palmCrown(g, x, y, t, { n = 9, len = 15, ph = 0, amp = 1.6, seed = 1 } = {}) {
  const r = rng(seed), fr = [];
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i / (n - 1)) * Math.PI + r.range(-0.15, 0.15); // left through up to right
    const front = Math.abs(Math.sin(a)) < 0.5;
    fr.push({ a: front ? a : a, len: len * r.range(0.8, 1.1), droop: lerp(10, 2, Math.abs(Math.sin(a))) + r.range(0, 3), back: Math.sin(a) < -0.85, ph: r() * 0.8 });
  }
  fr.sort((p, q) => (q.back ? 1 : 0) - (p.back ? 1 : 0));
  for (const f of fr) {
    const w = wave(t, ph + f.ph) * amp * (0.6 + 0.4 * Math.abs(Math.cos(f.a)));
    frond(g, x, y, f.a, f.len, f.droop, w, f.back ? ['palmD', 'palm0', 'palm1'] : ['palm0', 'palm1', 'palm3']);
  }
  // two hanging drooping dead fronds and the date clusters
  g.curve([[x - 1, y + 1], [x - 4, y + 5], [x - 5, y + 10]], 1.4, 'tall0');
  g.ell(x + 2, y + 3, 1.6, 1.4, 'ochre'); g.ell(x - 2, y + 3.5, 1.4, 1.2, 'ochreD');
  g.ell(x, y, 2, 1.6, 'palm1');
}
// A doum-palm crown: a ball of stiff fan leaves with jagged tips, the ones that face up lit.
function fanCrown(g, x, y, t, { r = 9, n = 17, ph = 0, seed = 1, amp = 1.1 } = {}) {
  const q = rng(seed), leaves = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * Math.PI * 1.9 + q.range(-0.2, 0.2);
    leaves.push({ a, L: r * q.range(0.75, 1.05), d: q.range(0, 1) });
  }
  // a few hanging dead leaves underneath
  g.curve([[x - 2, y + 2], [x - 3, y + 7], [x - 3, y + 10]], 1.4, 'tall0');
  g.curve([[x + 2, y + 2], [x + 3, y + 6]], 1.4, 'tall1');
  g.ell(x, y + 1, r * 0.6, r * 0.45, 'palmD');
  leaves.sort((p, q2) => Math.sin(q2.a) - Math.sin(p.a)); // hanging ones first, the top last
  for (const f of leaves) {
    const w = wave(t, ph + f.d) * amp * (f.L / r), up = -Math.sin(f.a);
    const col = up > 0.6 ? (f.d > 0.5 ? 'palm3' : 'palm2') : up > 0 ? 'palm1' : up > -0.5 ? 'palm0' : 'palmD';
    const bx = x + Math.cos(f.a) * 1.5, by = y + Math.sin(f.a) * 1.2, pts = [[bx, by]];
    for (let k = 0; k <= 4; k++) {
      const aa = f.a + (k / 4 - 0.5) * 0.55, L = f.L * (k % 2 ? 0.62 : 1);
      pts.push([x + Math.cos(aa) * L + w, y + Math.sin(aa) * L * 0.8]);
    }
    g.poly(pts, col);
    // the stiff leaf tips poke out past the fan
    const tl = f.L * 1.18;
    g.pline(x + Math.cos(f.a) * f.L * 0.7 + w, y + Math.sin(f.a) * f.L * 0.56, x + Math.cos(f.a) * tl + w * 1.1, y + Math.sin(f.a) * tl * 0.8, col);
  }
}
// A ringed palm trunk (leaf-base scars) through [[x, y, w], ...]
function palmTrunk(c, pts) {
  c.chain(pts, 'bark2');
  c.bevel({ up: 0, down: 0, left: 1, right: 1, only: ['bark2'] });
  const y0 = Math.max(...pts.map((p) => p[1])), y1 = Math.min(...pts.map((p) => p[1]));
  c.remap((x, y, hex) => {
    if (y > y0 || y < y1 || !['#7a5434', '#9a7448', '#5a3b24'].includes(hex)) return undefined;
    return ((Math.floor(y) % 3) + 3) % 3 === 0 ? 'bark1' : undefined;
  });
}

function oasis() {
  const pool = { dx: 0, dy: -3, rx: 26, ry: 10 };
  const inPool = (x, y, k = 1) => ((x - pool.dx) / (pool.rx * k)) ** 2 + ((y - pool.dy) / (pool.ry * k)) ** 2 <= 1;
  const trunks = (g) => {
    g.part((c) => {
      // a doum palm, forked twice, back left; a tall date palm back right; a young one front right
      palmTrunk(c, [[-26, -9, 4], [-27, -24, 3.4], [-26, -33, 3]]);
      c.chain([[-26, -33, 2.6], [-32, -44, 2.2], [-34, -50, 2]], 'bark2');
      c.chain([[-26, -33, 2.6], [-20, -45, 2.2], [-18, -52, 2]], 'bark2');
      c.bevel({ up: 0, down: 0, left: 1, right: 1, only: ['bark2'] });
      palmTrunk(c, [[18, -11, 4], [21, -30, 3.4], [24, -48, 3], [25, -56, 2.8]]);
      palmTrunk(c, [[-10, -12, 3.2], [-11, -24, 2.8], [-9, -34, 2.6]]);
    });
  };
  const doum = (g, t) => {
    // doum crowns: balls of stiff fan leaves
    fanCrown(g, -34, -51, t, { r: 9, seed: 7, ph: 0.2 });
    fanCrown(g, -18, -53, t, { r: 9, seed: 8, ph: 0.9 });
  };
  const crowns = (g, t) => {
    palmCrown(g, 25, -57, t, { n: 10, len: 16, ph: 0.6, seed: 3 });
    palmCrown(g, -9, -35, t, { n: 8, len: 12, ph: 1.4, seed: 5 });
  };
  const bank = (g) => {
    // green banks round the water, bushier behind it
    g.part((c) => {
      c.blob([[-42, -1], [-38, -11], [-27, -16], [-10, -19], [6, -18], [25, -17], [37, -12], [43, -3], [38, 5], [24, 9], [8, 12], [-10, 10], [-26, 9], [-38, 6]], 'lush1', 0.45);
      c.tone((x, y) => (y < -12 ? 1 : 0));
      c.bevel({ up: 1, down: 0, hi: 1 });
    }, { sep: 1 });
    drawClumps(g, bankClumps, LUSH, 0, 0, { amp: 0, core: false });
    // the wet mud lip and the water
    g.part((c) => {
      c.ell(pool.dx, pool.dy - 0.6, pool.rx + 2, pool.ry + 1.6, 'mud1');
      c.ell(pool.dx, pool.dy, pool.rx, pool.ry, 'water0');
      c.ell(pool.dx, pool.dy - 1.4, pool.rx - 1, pool.ry - 1.2, 'water0');
      c.remap((x, y, hex) => {
        if (hex === P_MUD1 && y < pool.dy - pool.ry + 1) return 'mud2'; // the far bank's wet wall, in the light
        if (hex !== P_WATER0) return undefined;
        const u = (x - pool.dx) / pool.rx, v = (y - pool.dy) / pool.ry;
        if (v < -0.7) return 'water1'; // sky caught at the far edge
        if (u * u + (v - 0.15) ** 2 < 0.35) return 'deep1';
        return undefined;
      });
      // palm reflections, wobbling down from the far edge
      for (const [x0, len] of [[-26, 6], [-18, 4], [18, 7], [23, 5]]) c.pline(x0, pool.dy - pool.ry + 2, x0 + 1, pool.dy - pool.ry + 2 + len, 'deep0', true);
      c.pline(15, pool.dy - pool.ry + 3, 27, pool.dy - pool.ry + 3, 'deep1', true);
      // hoofprints in the mud at the front where things come to drink
      for (const [x, y] of [[-6, 7], [-3, 8], [4, 7.5]]) { c.px(x, y, 'mud0', true); c.px(x + 1, y, 'mud0', true); }
    }, { sep: 0 });
    // a lily pad or two
    g.part((c) => { c.ell(-13, -1, 2.4, 1.1, 'lush2'); c.ell(-9, 1.5, 1.8, 0.9, 'lush1'); c.px(-13, -2, 'paint'); }, { sep: 0 });
  };
  const bankClumps = (() => {
    const r = rng(91), out = [];
    for (const [x, y, rx] of [[-34, -13, 6], [-20, -18, 7], [-4, -20, 6], [10, -19, 7], [30, -15, 7], [38, -6, 4], [-39, -5, 4]]) out.push(clump(r, x, y, rx, 3, { rim: 0.7, tuft: [1.3, 2], shade: y < -14 ? -1 : 0 }));
    return out;
  })();
  const water = (g, t) => {
    // ripple rings spreading where something drips, and glints drifting across
    for (const [cx, cy, ph] of [[-7, -4, 0], [9, -1, 0.5]]) {
      const k = (t + ph) % 1, rx = 1 + k * 5, ry = rx * 0.4;
      const col = k < 0.5 ? 'water2' : 'water1';
      for (let a = 0; a < TAU; a += 0.36) {
        const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
        if (inPool(x, y, 0.92)) g.px(x, y, col, true);
      }
    }
    for (const [x0, y0, ph] of [[-16, -7, 0], [4, -9, 2], [15, -5, 4]]) {
      const s = Math.sin(t * TAU + ph);
      if (s > -0.2) { g.px(x0 + Math.cos(t * TAU + ph) * 2, y0, 'foam', true); if (s > 0.5) g.px(x0 + Math.cos(t * TAU + ph) * 2 + 1, y0, 'water2', true); }
    }
  };
  const reeds = (g, t) => {
    // reeds and papyrus at the water's edge, leaning into the wind
    const r = rng(17);
    for (const [x, y, n] of [[-29, -1, 7], [30, 1, 6], [-22, 5, 4]]) {
      for (let i = 0; i < n; i++) {
        const h = r.range(10, 18), lean = r.range(-2, 2), xi = x + r.range(-3, 3);
        const tip = blade(g, xi, y, h, lean, wave(t, x * 0.07 + i * 0.3) * 1.6 * (h / 18), r() < 0.5 ? 'lush0' : 'palm1');
        if (h > 14) { g.px(tip[0], tip[1], 'tall1'); g.px(tip[0], tip[1] - 1, 'tall0'); } // seed heads
      }
    }
  };
  const front = (g, t) => {
    // the front rim breaks up into grass
    for (const [x, y, s] of [[-39, 6, 1], [-30, 10, 2], [-19, 11, 3], [-7, 12, 4], [5, 13, 5], [16, 11, 6], [27, 10, 7], [37, 6, 8], [43, -1, 9], [-43, 0, 10]]) tuft(g, x, y, t, { seed: 60 + s, n: 6, h: 5, w: 4, cols: ['lush0', 'lush1', 'lush2', 'lush3'] });
  };
  return scene([60, 72, 18], [S(trunks), A(doum), A(crowns), S(bank), A(water), F(reeds), F(front)],
    { shade: 44, shadow: { rx: 44, ry: 12, dy: -4 }, pool });
}
const P_MUD1 = '#65492e', P_WATER0 = '#23667a';

// ---------- 4. the old baobab ----------
const BAO = ['lmBao0', 'lmBao1', 'lmBao2', 'lmBao3', 'lmBao4'];
const LEAF = ['leafD', 'leaf0', 'leaf1', 'leaf2', 'leaf3'];

function baobab() {
  // half width of the trunk at height y (y negative): a swollen bottle
  const half = (y) => {
    const u = clamp(-y / 60, 0, 1);
    return 24 + Math.sin(u * Math.PI * 0.9) * 3 - u * u * 9 + (u < 0.06 ? (0.06 - u) * 40 : 0);
  };
  // limbs: thick, crooked, splitting into twigs. [x, y, width] chains from the top of the trunk
  const LIMBS = [
    [[-12, -56, 10], [-22, -68, 7], [-33, -76, 4.5], [-43, -80, 2.6], [-51, -86, 1.4]],
    [[-26, -71, 3.5], [-30, -84, 2.4], [-35, -92, 1.4]],
    [[-6, -58, 9], [-10, -76, 6], [-16, -90, 4], [-19, -102, 2.2]],
    [[-12, -82, 3], [-6, -94, 2], [-4, -104, 1.2]],
    [[2, -59, 9], [4, -78, 6], [2, -94, 4], [4, -108, 2]],
    [[8, -58, 9], [16, -72, 6], [24, -86, 4], [28, -98, 2.2]],
    [[20, -78, 3], [30, -84, 2], [36, -94, 1.2]],
    [[12, -55, 10], [24, -64, 7], [34, -70, 4.5], [44, -72, 2.6], [51, -78, 1.4]],
    [[-15, -52, 5], [-25, -56, 3.5], [-33, -64, 2.2]],
  ];
  // every big limb forks once more partway out, so the crown spreads into a fan of wood
  for (const L of LIMBS.slice()) {
    if (L.length < 4) continue;
    const [x, y, w] = L[2], [px, py] = L[1], a = Math.atan2(y - py, x - px) + (x < 0 ? 0.7 : -0.7);
    LIMBS.push([[x, y, w * 0.8], [x + Math.cos(a) * 7, y + Math.sin(a) * 7, w * 0.55], [x + Math.cos(a - (x < 0 ? 0.3 : -0.3)) * 13, y + Math.sin(a) * 12 - 2, 1.2]]);
  }
  const tips = [];
  for (const L of LIMBS) {
    const e = L[L.length - 1], p = L[L.length - 2];
    tips.push([e[0], e[1], Math.atan2(e[1] - p[1], e[0] - p[0])]);
  }
  const trunk = (g) => {
    g.part((c) => {
      const pts = [];
      for (let y = 0; y >= -60; y -= 4) pts.push([-half(y) + Math.sin(y * 0.3) * 0.6, y]);
      for (let y = -60; y <= 0; y += 4) pts.push([half(y) + Math.sin(y * 0.27 + 1) * 0.6, y]);
      c.poly(pts, 'lmBao2');
      for (const L of LIMBS) c.chain(L, 'lmBao2');
      c.limb(-25, 1, -30, 2, 4, 3, 'lmBao2'); c.limb(25, 1, 31, 2, 4, 3, 'lmBao2'); // root spurs
      // the bark: round wood lit from the upper left, the trunk broken into vertical folds,
      // each with a lit ridge and a crease
      roundShade(c, '#7c665b', BAO, (x, y, L) => {
        if (y < -58) return L;
        const f = (x + Math.sin(y * 0.11) * 2.2 + Math.sin(y * 0.043 + 2) * 3 + 40) / 6.5, fr = f - Math.floor(f);
        return L + (fr < 0.22 ? 0.9 : fr > 0.8 ? -1.1 : 0);
      });
      c.bevel({ up: 1, down: 0, left: 1, right: 1, hi: 1, lo: 1 });
      // pale scars low on the trunk where elephants tore the bark for water
      for (const [x, y0, len] of [[-13, -3, 9], [-11, -2, 6], [6, -4, 11], [8, -3, 7], [14, -2, 6]]) c.pline(x, y0, x, y0 - len, 'lmBao4', true);
      c.pline(-12, -13, -13, -15, 'lmBao4', true);
      // the hollow: a split in the side, with a worn lit lip and the dark inside
      c.blob([[-6, -1], [-8, -10], [-7, -22], [-3, -30], [1, -27], [3, -16], [2, -5], [1, 0]], 'ink', 0.45);
      c.pline(-9, -2, -9, -12, 'lmBao4', true); c.pline(-8, -13, -8, -21, 'lmBao3', true);
      c.ell(-3, -1.5, 3.4, 1.4, 'inkSoft');
      c.px(-4, -3, 'bone0'); c.px(-3, -3, 'bone0'); // a bone inside, something sheltered here once
    }, { sep: 0 });
    // twigs: fine wood spraying from every limb tip
    const r = rng(41);
    for (const [x, y, a] of tips) {
      for (let k = 0; k < 6; k++) {
        const aa = a + r.range(-0.9, 0.9), L = r.range(6, 11);
        const mx = x + Math.cos(aa) * L * 0.5, my = y + Math.sin(aa) * L * 0.5;
        g.pline(x, y, mx, my, 'lmBao1');
        g.pline(mx, my, mx + Math.cos(aa - 0.4) * L * 0.5, my + Math.sin(aa - 0.4) * L * 0.5, 'lmBao1');
        g.pline(mx, my, mx + Math.cos(aa + 0.5) * L * 0.4, my + Math.sin(aa + 0.5) * L * 0.4, 'lmBao1');
      }
    }
  };
  const crown = (() => {
    // a thin crown: small leaf tufts at the twig ends, not a canopy
    const r = rng(43), out = [];
    for (const [x, y, a] of tips) {
      out.push(clump(r, x + Math.cos(a) * 5, y + Math.sin(a) * 4 - 1, r.range(5, 7), r.range(2.6, 3.4), { n: 7, tuft: [1.3, 2], rim: 0.6 }));
      if (r() < 0.6) out.push(clump(r, x + r.range(-6, 6), y + r.range(1, 5), 4, 2.2, { n: 4, tuft: [1.2, 1.8], shade: -1 }));
    }
    return out;
  })();
  const leaves = (g, t) => drawClumps(g, crown, LEAF, 0, t, { amp: 1.1, top: -110, flutter: 0.2 });
  const hanging = (g, t) => {
    // weaver nests swinging from the limb tips
    for (const [x, y, len, ph] of [[-40, -80, 5, 0], [-35, -77, 7, 1.3], [33, -70, 6, 2.4], [44, -72, 4, 3.4], [39, -71, 8, 4.6]]) {
      const sw = wave(t, ph) * 1.2;
      g.pline(x, y, x + sw, y + len, 'tall0');
      g.ell(x + sw, y + len + 1.8, 1.7, 2.1, 'tall1');
      g.px(x + sw - 0.5, y + len + 3, 'tallD');
    }
    // a charm on a cord from the low limb: beads and a feather, turning in the wind
    const sw = wave(t, 1) * 1.4, x = -28, y = -59;
    g.pline(x, y, x + sw * 0.6, y + 6, 'hideD'); g.pline(x + sw * 0.6, y + 6, x + sw, y + 10, 'hideD');
    g.px(x + sw * 0.4, y + 4, 'bone1'); g.px(x + sw * 0.75, y + 7, 'ochre'); g.px(x + sw * 0.9, y + 9, 'bone1');
    g.pline(x + sw, y + 11, x + sw * 1.3, y + 14, 'paint'); g.px(x + sw * 1.3, y + 14, 'ink');
  };
  const foot = (g) => {
    // offerings at its foot: a horned skull, a little cairn, a bowl
    bonePart(g, (c) => {
      c.ell(12, -1.5, 3, 2, 'bone');
      c.limb(10.5, -3, 8, -8, 1.4, 0.8, 'bone'); c.limb(13.5, -3, 15.5, -8, 1.4, 0.8, 'bone');
      c.px(11, -2, 'boneD'); c.px(13, -2, 'boneD');
      longBone(c, -20, 2, -14, 1, 1.4, 'bone');
    });
    rock(g, 51, [[17, 1], [17, -2], [20, -4], [23, -2], [23, 1]], { n: 3 });
    rock(g, 52, [[18, -3], [19, -6], [22, -6], [22, -3]], { n: 2 });
    g.part((c) => { c.ell(-15, -1, 2.6, 1.6, 'lmGourd1'); c.ell(-15, -2.2, 2, 0.6, 'ink'); c.bevel({ up: 1, hi: 1 }); }, { sep: 1 });
  };
  const grass = (g, t) => {
    for (const [x, y, s] of [[-27, 2, 1], [-8, 2, 2], [27, 3, 3], [4, 3, 4], [-32, 1, 5]]) tuft(g, x, y, t, { seed: 80 + s, n: 7, h: 8, w: 4 });
  };
  return scene([64, 124, 8], [S(trunk), A(leaves), A(hanging), S(foot), F(grass)],
    { solid: 20, shade: 50, shadow: { rx: 50, ry: 14, dy: -2 } });
}

// ---------- 5. a cold camp ----------
const HIDE = ['hideD', 'hide0', 'hide1', 'hide2'];

function camp() {
  const shelter = (g) => {
    // two crossed pole tips poke out above the hide
    g.part((c) => {
      c.limb(-27, -27, -31, -36, 1.6, 1.2, 'bark2'); c.limb(-21, -27, -17, -37, 1.6, 1.2, 'bark2');
      c.limb(-9, -21, -6, -29, 1.4, 1.1, 'bark2');
      c.bevel({ left: 1, right: 1, up: 0, down: 0 });
    });
    // the lean-to: hides lashed over a frame of bent poles, open toward the fire
    g.part((c) => {
      c.blob([[-42, 0], [-41, -11], [-36, -22], [-27, -29], [-17, -29], [-9, -23], [-5, -12], [-4, 0]], 'hide1', 0.45);
      facets(c, 61, { cx: -23, cy: -14, rx: 19, ry: 15, n: 7, tones: HIDE, only: ['#6e4a2c', '#8f6a3e', '#b08a56'], bias: 0.1, jit: 0.2 });
      c.bevel({ up: 1, down: 1, left: 1, right: 0, hi: 1, lo: 1 });
      // the seam between two hides, and the thongs that tie them down over the frame
      c.curve([[-33, -25], [-29, -14], [-28, -1]], 1, 'hide0');
      for (let y = -23; y < -2; y += 4) c.px(-29.5 - (y + 14) * (y < -14 ? 0.3 : 0.05), y, 'hideD', true);
      c.curve([[-41, -9], [-30, -13], [-19, -14], [-8, -10]], 1, 'hideD');
      c.curve([[-38, -19], [-28, -23], [-16, -22]], 1, 'hideD');
      // the opening, with grass bedding inside
      c.blob([[-19, 0], [-18, -10], [-14, -19], [-9, -17], [-6, -9], [-5, 0]], 'ink', 0.5);
      c.ell(-11, -1, 5, 1.6, 'tall0'); c.pline(-15, -2, -8, -2, 'tall1', true);
      // a tie-down peg rope
      c.pline(-41, -1, -45, 1, 'hideD');
    }, { sep: 1 });
  };
  const flap = (g, t) => {
    // the loose hide flap over the opening, stirring
    const w = wave(t, 0.5) * 1.2;
    g.part((c) => {
      c.poly([[-16, -20], [-9, -18], [-8 + w, -11], [-11 + w * 1.3, -9], [-14 + w * 0.8, -12]], 'hide2');
      c.pline(-11 + w * 1.3, -9, -14 + w * 0.8, -12, 'hide1');
      c.px(-15, -19, 'hideD');
    }, { sep: 1 });
  };
  const frame = (g) => {
    // a hide stretched on a frame of poles, laced at the edges
    g.part((c) => {
      c.limb(1, 0, 2, -31, 1.6, 1.4, 'bark1'); c.limb(24, 0, 23, -32, 1.6, 1.4, 'bark1');
      c.limb(-1, -29, 26, -30, 1.4, 1.4, 'bark1'); c.limb(0, -5, 25, -6, 1.4, 1.4, 'bark1');
      c.bevel({ left: 1, up: 1, down: 0, right: 0 });
    }, { sep: 1 });
    g.part((c) => {
      // the pelt: body with four leg flaps, scraped pale on this side
      c.blob([[8, -23], [12.5, -24], [17, -23], [18, -17], [17, -11], [12.5, -10], [8, -11], [7, -17]], 'hide2', 0.45);
      for (const [x, y, dx, dy] of [[8.5, -22, -2.5, -2], [16.5, -22, 2.5, -2], [8.5, -12, -2.5, 2], [16.5, -12, 2.5, 2]]) c.limb(x, y, x + dx, y + dy, 2, 1.2, 'hide2');
      c.limb(12.5, -10, 12.5, -7.5, 1.4, 0.8, 'hide2'); // the tail
      c.tone((x, y) => (x > 15 ? -1 : 0));
      c.pline(12, -22, 12, -12, 'hide1', true); // the spine line
      c.bevel({ up: 1, down: 1, hi: 0, lo: 1 });
    }, { sep: 0 });
    // lacing from pelt to frame
    for (const [x0, y0, x1, y1] of [[6, -25, 3, -28], [19, -25, 22, -28], [6, -9, 3, -7], [19, -9, 22, -7], [7, -17, 3, -17], [18, -17, 22, -17]]) g.pline(x0, y0, x1, y1, 'hideD');
  };
  const fire = (g) => {
    // a ring of stones around dead ashes and the black ends of the last sticks
    g.part((c) => {
      c.ell(10, -1, 7, 2.8, 'ash2'); c.ell(9.5, -1.5, 4.8, 1.8, 'ash3');
      c.px(8, -1, 'ash1'); c.px(12, -1, 'ash1');
      c.limb(5, 0, 13, -2, 1.4, 1.1, 'barkD'); c.limb(15, 0, 8, -3, 1.3, 1, 'ink');
      c.px(11, -1.5, 'emberD');
    }, { sep: 0 });
    const r = rng(71);
    for (let k = 0; k < 11; k++) {
      const a = (k / 11) * TAU + 0.2, x = 10 + Math.cos(a) * 9, y = -1 + Math.sin(a) * 3.6;
      rock(g, 300 + k, [[x - 2, y + 1.2], [x - 1.8, y - 0.8], [x, y - 1.8 - r.range(0, 0.6)], [x + 1.9, y - 0.8], [x + 2, y + 1.2]], { n: 3, sep: 1 });
    }
    // bones picked clean, tossed by the fire
    bonePart(g, (c) => {
      longBone(c, -3, 4, 3, 3, 1.4, 'bone');
      c.curve([[23, 4], [25, 2], [28, 2]], 1.3, 'bone');
      c.ell(-1, -2, 1.2, 1, 'bone');
    });
  };
  const rack = (g) => {
    // spear rack: two forked sticks and a crossbar, four spears leaning on it
    g.part((c) => {
      c.limb(30, 1, 31, -22, 1.6, 1.3, 'bark1'); c.limb(31, -22, 29, -26, 1, 0.8, 'bark1'); c.limb(31, -22, 33, -26, 1, 0.8, 'bark1');
      c.limb(43, 0, 42, -22, 1.6, 1.3, 'bark1'); c.limb(42, -22, 40, -26, 1, 0.8, 'bark1'); c.limb(42, -22, 44, -26, 1, 0.8, 'bark1');
      c.limb(28, -23, 45, -23, 1.4, 1.4, 'bark2');
      c.bevel({ left: 1, up: 1, right: 0, down: 0 });
    }, { sep: 1 });
    g.part((c) => {
      // the spears lean back against the bar, butts in the dirt
      for (const [x0, x1, top] of [[33, 24, -34], [37, 28, -36], [41, 33, -35], [46, 38, -37]]) {
        c.pline(x0, 2, x1, top + 4, 'bark2');
        c.poly([[x1 - 1.4, top + 4.5], [x1 - 0.6, top - 0.5], [x1 + 0.8, top + 4]], 'rock3'); // stone point
        c.px(x1 + 0.3, top + 5, 'hideD'); // its binding
      }
    }, { sep: 1 });
  };
  const gear = (g) => {
    // a gourd, a rolled bundle tied with cord
    g.part((c) => {
      c.ell(-1, -2.5, 3, 2.8, 'lmGourd1'); c.ell(-1, -6.5, 1.2, 1.8, 'lmGourd1'); c.px(-1, -8.5, 'hideD');
      c.bevel({ up: 1, left: 1, down: 1, right: 1, hi: 1, lo: 1 });
      c.pline(-3, -3, 1, -3, 'lmGourd0', true);
    }, { sep: 1 });
    g.part((c) => {
      c.limb(-36, 3, -26, 2, 4.4, 4.4, 'hide1');
      c.ell(-26, 2, 1.6, 2.2, 'hide2');
      c.bevel({ up: 1, down: 1, hi: 1, lo: 1 });
      c.pline(-33, 1, -33, 4, 'hideD', true); c.pline(-29, 0, -29, 4, 'hideD', true);
      c.px(-26, 2, 'hide1');
    }, { sep: 1 });
  };
  const smoke = (g, t) => {
    // a thread of smoke from the ashes: rising, drifting with the wind, fading out
    for (let k = 0; k < 26; k++) {
      const s = ((k + t * 4) % 26) / 26; // climbs four slots per loop and wraps, so frame 7 flows into 0
      const y = -2 - s * 34, x = 10 + Math.sin(s * 6 - t * TAU) * (1 + s * 2.5) + s * s * 8;
      if (s > 0.75 && (k & 1)) continue; // thinning toward the top
      g.px(x, y, s < 0.4 ? 'lmSmoke1' : 'lmSmoke0');
    }
  };
  const grass = (g, t) => {
    for (const [x, y, s] of [[-44, 3, 1], [-22, 3, 2], [26, 3, 3], [47, 2, 4], [5, 3, 5]]) tuft(g, x, y, t, { seed: 90 + s, n: 6, h: 7, w: 4 });
  };
  return scene([52, 52, 10], [S(frame), S(rack), S(shelter), A(flap), S(fire), S(gear), F(smoke), F(grass)],
    { solid: 12, shadow: { rx: 40, ry: 6, dy: 0 } });
}

// ---------- 6. the stone gate ----------
function arch() {
  // half widths of the outer silhouette and the opening at height y (y negative): thick pillars
  // that flare at the foot and pinch at the waist, a span that thins toward its crown
  const outerHalf = (y, x) => {
    const side = x < 0 ? 0 : 1.5; // the right shoulder sits a little higher
    if (y > -40) return 45 - (-y / 40) * 2 + (y > -7 ? (7 + y) * 0.45 : 0) - Math.sin(-y / 40 * Math.PI) * 1.2;
    const u = (y + 40) / (32 + side);
    return u < -1 ? -1 : (43 + side * 0.3) * Math.sqrt(1 - u * u);
  };
  const innerHalf = (y) => (y > -34 ? 20.5 - (y > -7 ? (7 + y) * 0.45 : 0) + Math.sin(-y / 34 * Math.PI) * 1.2 : y < -48 ? -1 : 20.5 * Math.sqrt(1 - ((y + 34) / 14) ** 2));
  const inside = (x, y) => { const ax = Math.abs(x); return ax <= outerHalf(y, x) && ax >= innerHalf(y); };
  // strata: bands that wander a little; the soft ones erode back from every edge
  const bandOf = (x, y) => Math.floor((y + Math.sin(x * 0.07) * 1.4 + x * 0.03 + 90) / 4.4);
  const BANDS = ['dune1', 'dune2', 'clay1', 'dune1', 'dune0', 'dune2', 'dune1', 'clay2', 'dune1', 'dune0'];
  const soft = (b) => b % 3 === 1;
  const TOP = 4; // depth of the span seen from above
  const stone = (g) => {
    g.part((c) => {
      c.rect(-50, -80, 100, 81, 'dune1');
      c.remap((x, y) => {
        if (!inside(x, y)) {
          // the span's top surface, running back from its front edge
          return y < -30 && inside(x, y + TOP) ? 'dune3' : null;
        }
        const oh = outerHalf(y, x), ih = innerHalf(y), ax = Math.abs(x), b = bandOf(x, y);
        if (soft(b) && (ax > oh - 1 || (ih > 0 && ax < ih + 1)) && y > -40) return null; // eroded notch
        let col = BANDS[((b % BANDS.length) + BANDS.length) % BANDS.length];
        // thin dark parting lines between some beds
        const yy = y + Math.sin(x * 0.07) * 1.4 + x * 0.03 + 90;
        if (b % 2 === 0 && yy - b * 4.4 < 0.9) col = 'clay0';
        return col;
      });
      // the top surface: lit, with a bright lip where it meets the front face
      c.tone((x, y, hex) => (hex === '#ebad74' && inside(x, y + 1) ? 1 : 0));
      // planes: the sunlit left faces, the inner faces of the gate (left one turned from the
      // sun, right one into it), and the deep shade under the span
      c.tone((x, y, hex) => {
        if (!inside(x, y)) return 0;
        const oh = outerHalf(y, x), ih = innerHalf(y), ax = Math.abs(x);
        if (ih > 0 && ax < ih + 3.5) {
          if (y < -34 || innerHalf(y + 2) < 0) return -2;
          return x < 0 ? -1 : 1;
        }
        if (y < -34 && innerHalf(y + 2.5) > ax) return -2;
        if (x < 0 && ax > oh - 3) return 1;
        if (x > 0 && ax > oh - 3) return -1;
        return 0;
      });
      // desert varnish: dark streaks run down the face from the top
      for (const [x, len] of [[-31, 12], [-12, 6], [24, 10]]) {
        let y0 = -80;
        while (!inside(x, y0) && y0 < 0) y0++;
        c.pline(x, y0 + 1, x, y0 + len, 'duneD', true);
      }
      // the lip the sand runs off, and the cone it builds
      c.rect(12, -47, 4, 1.2, 'dune3');
      c.ell(14, 0, 3.2, 1.4, 'dune3');
    }, { sep: 0 });
    rock(g, 101, [[44, 2], [44, -2], [47, -4], [51, -2], [51, 2]], { tones: ['duneD', 'dune0', 'dune1', 'dune2', 'dune3'], n: 3 });
    rock(g, 102, [[-52, 2], [-52, -1], [-49, -3], [-46, -1], [-46, 2]], { tones: ['duneD', 'dune0', 'dune1', 'dune2', 'dune3'], n: 3 });
  };
  const trail = (g) => {
    // paw prints come in from the right and stop dead under the span
    for (const [x, y] of [[52, 6], [47, 4], [42, 6], [37, 4], [32, 5.5], [27, 4], [22, 5.5], [17, 4]]) {
      g.px(x, y, 'sand0'); g.px(x + 1, y, 'sand0'); g.px(x - 0.5, y - 1, 'sand0'); g.px(x + 1.5, y - 1, 'sand0');
    }
  };
  const sand = (g, t) => {
    // a thin trickle off the ledge
    for (let k = 0; k < 16; k++) {
      const s = (k / 16 + t) % 1;
      if (k % 3 === 1) continue;
      g.px(14 + (s > 0.6 ? 0.5 : 0), -45 + s * 44, s < 0.5 ? 'dune3' : 'sand2');
    }
  };
  const grass = (g, t) => {
    tuft(g, -8, -73, t, { seed: 111, n: 6, h: 7, w: 3 });
    tuft(g, 13, -71, t, { seed: 112, n: 4, h: 5, w: 2 });
    for (const [x, y, s] of [[-47, 3, 3], [-21, 2, 4], [22, 2, 5], [48, 3, 6]]) tuft(g, x, y, t, { seed: 110 + s, n: 6, h: 7, w: 4 });
  };
  return scene([56, 84, 10], [S(stone), F(trail), F(sand), F(grass)],
    { shade: 30, shadow: { rx: 44, ry: 9, dy: 0 }, arch: true, pillars: [[-33, 0], [33, 0]] });
}

// ---------- 7. the whistling caves ----------
function whistle() {
  const HOLES = [
    [-26, -15, 6], [4, -19, 7], [31, -13, 5], [-12, -30, 3.5], [18, -31, 3.4], [-39, -7, 3],
    [39, -24, 2.6], [-3, -7, 2], [14, -6, 2.2], [-19, -5, 1.8], [27, -35, 1.8], [-31, -26, 2],
  ];
  const mass = (g) => {
    rock(g, 121, [[-49, 1], [-50, -10], [-45, -23], [-35, -32], [-20, -37], [-2, -39], [16, -42], [30, -39], [42, -30], [48, -17], [50, 1]], { sep: 0, f: { bias: -0.15, jit: 0.35 } });
    // the wind-cut cap: a lip of harder rock overhanging the hollows
    rock(g, 122, [[-34, -31], [-30, -42], [-16, -49], [2, -50], [16, -47], [25, -41], [20, -36], [4, -37], [-16, -34]], {
      f: { bias: 0.15 },
      after: (c) => c.tone((x, y) => (y > -37 && x > -30 && x < 22 ? -1 : 0)),
    });
    g.tone((x, y) => (y > -36 && y < -33 && x > -28 && x < 18 ? -1 : 0)); // its shadow
    rock(g, 125, [[-29, -43], [-30, -49], [-25, -54], [-18, -53], [-14, -48], [-16, -44]], { n: 4 }); // a perched boulder
    // the mouths: dark, with the lip above shading in and a lit floor below
    g.part((c) => {
      for (const [x, y, r] of HOLES) {
        c.ell(x, y, r, r * 0.78, 'rock0');
        c.ell(x, y - r * 0.12, r * 0.86, r * 0.62, 'ink');
      }
    }, { sep: 1 });
    for (const [x, y, r] of HOLES) {
      g.pline(x - r * 0.6, y + r * 0.8, x + r * 0.5, y + r * 0.8, 'rock4', true);
      if (r > 3) g.pline(x - r * 0.4, y + r * 0.5, x + r * 0.3, y + r * 0.5, 'inkSoft', true);
    }
    rock(g, 123, [[38, 2], [37, -6], [42, -10], [49, -7], [51, 2]], { n: 4 });
    rock(g, 124, [[-50, 3], [-50, -2], [-46, -4], [-42, -2], [-42, 3]], { n: 3 });
  };
  const wisps = (g, t) => {
    // cold air pouring out of the mouths, streaming off downwind
    for (const [x, y, r, i] of HOLES.map((h, i) => [...h, i])) {
      if (r < 2.5) continue;
      // two curls per mouth, each a short streak that lengthens and thins as it drifts off
      for (let k = 0; k < 2; k++) {
        const s = (k / 2 + t + i * 0.13) % 1;
        const px = x + r * 0.5 + s * (9 + r * 1.4), py = y - s * 3 + Math.sin(s * 5 + i) * 1;
        g.px(px, py, s < 0.5 ? 'lmWisp1' : 'lmWisp0');
        if (s < 0.75) g.px(px - 1, py + (s > 0.4 ? 0.6 : 0), 'lmWisp0');
        if (s > 0.3 && s < 0.6) g.px(px + 1, py - 0.6, 'lmWisp0');
      }
    }
  };
  const grass = (g, t) => {
    for (const [x, y, s] of [[-36, 2, 1], [-14, 2, 2], [8, 2, 3], [30, 2, 4], [36, -36, 5], [-22, -53, 6]]) tuft(g, x, y, t, { seed: 130 + s, n: 6, h: y < 0 ? 6 : 8, w: 4, lean: 2, amp: 1 });
  };
  return scene([56, 60, 8], [S(mass), F(wisps), F(grass)],
    { solid: 24, shade: 40, shadow: { rx: 42, ry: 9, dy: 0 } });
}

// ---------- 8. the carved pole ----------
// faces on the pole, top to bottom: the cat (you), then men
const CATFACE = [
  's.......s',
  'fs.....sf',
  'fffffffff',
  'ffsfffsff',
  'fkwfffwkf',
  'fffffffff',
  'sfffofffs',
  'ffffkffff',
  '.ffkfkff.',
  '..fffff..',
];
const MANFACE = [
  'dbbbbbbbd',
  'doooooood',
  'dbcbbbcbd',
  'dkwbbbwkd',
  'dbbbcbbbd',
  'dbbbcbbbd',
  'dbbdcdbbd',
  'dbbbbbbbd',
  'dbdwwwdbd',
  'ddbbbbbdd',
];
const MANFACE2 = [
  'dbbbbbbbd',
  'dbcbbbcbd',
  'dwkwbwkwd',
  'dbbbbbbbd',
  'dobbcbbod',
  'dobbcbbod',
  'dbbdddbbd',
  'dbbbbbbbd',
  'dbbkkkbbd',
  'ddbbbbbdd',
];
function shrine() {
  const N = 9;
  const ring = (k) => { const a = (k / N) * TAU + 0.85; return [Math.cos(a) * 33, -4 + Math.sin(a) * 12.5, Math.sin(a)]; };
  const HTS = [12, 9, 11, 13, 10, 12, 9, 13, 11];
  const stone = (g, k) => {
    const [x, y] = ring(k), h = HTS[k] * (ring(k)[2] < 0 ? 0.9 : 1), w = 2.4 + (k % 3) * 0.5, tilt = ((k * 7) % 5 - 2) * 0.4;
    if (k === 1) { // the fallen one, lying on its side
      rock(g, 140 + k, [[x - 6, y + 1.5], [x - 6, y - 2.2], [x + 5, y - 3], [x + 6, y + 1.5]], { n: 4 });
      return;
    }
    rock(g, 140 + k, [[x - w, y + 1], [x - w - 0.5, y - h * 0.6], [x - w * 0.6 + tilt, y - h], [x + w * 0.5 + tilt, y - h - 1], [x + w + 0.3, y - h * 0.5], [x + w, y + 1]], {
      n: 4, k: 0.12, f: { lx: 0.9, sq: 0.6 },
      after: (c) => { c.px(x - w * 0.4, y - h * 0.4, 'lush2', true); c.px(x - w * 0.4 + 1, y - h * 0.4 + 1, 'lush1', true); }, // lichen
    });
  };
  const back = (g) => { for (let k = 0; k < N; k++) if (ring(k)[2] < 0) stone(g, k); };
  const front = (g) => { for (let k = 0; k < N; k++) if (ring(k)[2] >= 0) stone(g, k); };
  const pole = (g) => {
    g.part((c) => {
      c.rect(-4.5, -44, 9, 46, 'bark2');
      c.ell(0, -44, 4.5, 1.4, 'bark3');
      c.ell(0, 1.5, 5.5, 1.6, 'bark1'); // packed earth at its foot
    }, { sep: 1 });
    const W = { b: 'bark2', c: 'bark3', d: 'bark0', k: 'ink', w: 'paint', o: 'ochre', f: 'fur2', s: 'spot' };
    g.stamp(-4, -43, CATFACE, W);
    g.stamp(-4, -32, MANFACE, W);
    g.stamp(-4, -21, MANFACE2, W);
    g.stamp(-4, -10, MANFACE, { ...W, o: 'paint' });
    for (const y of [-33, -22, -11]) g.pline(-4, y, 4, y, 'bark0'); // carved rings between the faces
    g.tone((x, y) => (x > 3 && y > -44 && y < 1 ? -1 : 0));
  };
  const crest = (g, t) => {
    // feathered crest: white quills with black tips and red ones between, each on its own flutter
    g.part((c) => {
      for (let k = 0; k < 7; k++) {
        const u = k / 6 - 0.5, a = -Math.PI / 2 + u * 1.9 + wave(t, k * 0.9) * 0.08;
        const L = 8 - Math.abs(u) * 4, x0 = u * 3, y0 = -45;
        const x1 = x0 + Math.cos(a) * L, y1 = y0 + Math.sin(a) * L;
        c.limb(x0, y0, x1, y1, 1.6, 1.4, k % 2 ? 'ochre' : 'paint');
        c.limb(lerp(x0, x1, 0.75), lerp(y0, y1, 0.75), x1, y1, 1.6, 1.3, k % 2 ? 'ochreD' : 'ink');
      }
    }, { sep: 1 });
    // strips of hide and fiber hanging from the top of the pole, streaming in the wind
    for (const [x, len, col, ph] of [[-5, 9, 'hide2', 0], [-5.5, 6, 'ochre', 0.8], [4.5, 8, 'paint', 1.6], [5, 11, 'hide1', 2.2]]) {
      const pts = [];
      for (let k = 0; k <= 3; k++) {
        const s = k / 3;
        pts.push([x + (x < 0 ? -1 : 1) * s * 1.5 + wave(t, ph + s * 2) * 1.6 * s, -42 + s * len]);
      }
      strand(g, pts, col, 3);
    }
  };
  const offering = (g) => {
    g.part((c) => {
      c.ell(9, 0, 3, 1.6, 'clay1'); c.ell(9, -0.8, 2.4, 0.8, 'clayD'); // a bowl
      c.ell(-10, 1, 2.2, 1.2, 'bone'); // a shell
      c.bevel({ up: 1, down: 1, hi: 1, lo: 1 });
    }, { sep: 1 });
  };
  const glint = (g, t) => {
    // something in the bowl catches the light now and then
    const k = Math.floor(t * 8);
    g.px(9, -1, 'lmObs0');
    if (k === 2 || k === 3) g.px(9, -1, 'paint');
    if (k === 3) { g.px(9, -2, 'hint'); g.px(8, -1, 'hint'); g.px(10, -1, 'hint'); }
  };
  const grass = (g, t) => {
    for (const [x, y, s] of [[-20, 6, 1], [18, 7, 2], [-34, -1, 3], [33, -2, 4], [3, 4, 5]]) tuft(g, x, y, t, { seed: 150 + s, n: 6, h: 6, w: 4, cols: ['lush0', 'lush1', 'lush2', 'lush3'] });
  };
  return scene([46, 64, 18], [S(back), S(pole), A(crest), S(offering), S(front), F(glint), F(grass)],
    { solid: 6, shadow: { rx: 32, ry: 8, dy: -3 } });
}

// ---------- 9. bones of the sea ----------
function whale() {
  // the arcade: ribs largest behind the skull, shrinking toward the tail
  const RIBS = [];
  for (let k = 0; k < 9; k++) {
    const x = -42 + k * 9.5, h = 15 + Math.sin((k + 1) / 10 * Math.PI) * 18;
    RIBS.push({ x, h, w: 2.2 + k * 0.08 });
  }
  const spineY = (x) => -9 - Math.sin((x + 56) / 100 * Math.PI) * 3;
  const far = (g) => {
    bonePart(g, (c) => {
      // the far halves of the ribs and the spine they hang from
      for (const r of RIBS) c.curve([[r.x - 5, spineY(r.x) + 1], [r.x - 4.5, -r.h * 0.75], [r.x - 2, -r.h]], r.w * 0.8, 'bone0');
      const sp = [];
      for (let x = -56; x <= 36; x += 4) sp.push([x, spineY(x)]);
      c.curve(sp, 3, 'bone0');
      for (let x = -52; x <= 32; x += 4) { c.ell(x, spineY(x) - 0.5, 1.6, 1.4, 'bone0'); c.limb(x, spineY(x) - 1, x - 1.5, spineY(x) - 4 - (x > -20 ? 1 : 0), 1.4, 1, 'bone0'); }
    }, { base: 'bone0', sep: 0, left: 0 });
  };
  const skull = (g) => {
    // the skull: a broad crown behind, the long flat beak of the rostrum running out to the right,
    // the two great jawbones lying bowed in the sand in front of it
    g.part((c) => {
      c.blob([[30, 1], [29, -9], [34, -17], [42, -18], [48, -12], [62, -6], [63, -3], [48, 0]], 'bone', 0.4);
      facets(c, 171, { cx: 44, cy: -9, rx: 17, ry: 9, n: 8, tones: ['boneD', 'bone0', 'bone0', 'bone', 'bone1'], bias: 0.15, lx: 0.5 });
      c.bevel({ up: 1, down: 1, hi: 1, lo: 1 });
      c.pline(37, -12, 40, -13, 'ink'); c.pline(37, -11, 39, -11, 'boneD'); // the blowhole, a dark slot
      c.pline(44, -8, 58, -5, 'bone0', true); // the beak's ridge
    }, { sep: 1 });
  };
  const near = (g) => {
    bonePart(g, (c) => {
      for (const r of RIBS) c.curve([[r.x - 2, -r.h], [r.x + 2.5, -r.h * 0.85], [r.x + 5, -r.h * 0.4], [r.x + 5, 2]], r.w, 'bone');
    }, { sep: 1 });
    bonePart(g, (c) => {
      c.curve([[30, 2], [42, 4], [54, 3], [64, 0]], 2.4, 'bone');
      c.curve([[33, 0], [44, 1.5], [56, 1], [63, -1]], 1.6, 'bone0');
    });
  };
  const drifts = (g) => {
    // the sand it is sinking into, banked over its bones, with wind ripples
    g.part((c) => {
      c.blob([[-60, 3], [-58, -3], [-50, -6], [-40, -4], [-34, 0], [-30, 3]], 'sand2', 0.5);
      c.blob([[-18, 4], [-14, -1], [-4, -2], [4, 1], [6, 4]], 'sand2', 0.5);
      c.blob([[16, 4], [20, 0], [28, -1], [33, 2], [34, 4]], 'sand2', 0.5);
      c.bevel({ up: 1, down: 0, hi: 1 });
      c.tone((x, y) => (x > 0 && y > 1 ? -1 : 0));
      for (const [x0, x1, y] of [[-56, -46, -1], [-52, -40, 1], [-12, -4, 1], [20, 28, 1]]) c.pline(x0, y, x1, y, 'sand1', true);
    }, { sep: 0 });
    // a draped strand of kelp, a shell
    g.pline(-3, -20, -1, -14, 'palmD', true); g.pline(-1, -14, 0, -10, 'palm0', true);
    g.part((c) => { c.ell(10, 3, 1.3, 0.9, 'flam1'); c.px(10, 2, 'flam2'); }, { sep: 0 });
  };
  const life = (g, t) => {
    // a gull on the tallest rib, bobbing; a crab scuttling between the ribs
    const R = RIBS[5], gx = R.x, gy = -R.h - 1, bob = wave(t * 2) > 0.5 ? 1 : 0;
    g.part((c) => {
      c.ell(gx + 1, gy - 2.5, 3, 1.8, 'salt3');
      c.ell(gx + 2, gy - 3, 2.6, 1.2, 'salt0'); // folded grey wing
      c.limb(gx + 4, gy - 3, gx + 6, gy - 3.5, 1.4, 1, 'ink'); // black wingtips
      c.ell(gx - 1.5, gy - 4.5 - bob * 0.6, 1.4, 1.2, 'salt3');
      c.px(gx - 3, gy - 4.5 - bob * 0.6 + bob * 0.8, 'gold1');
      c.px(gx - 2, gy - 5 - bob * 0.6, 'ink');
      c.px(gx, gy, 'gold0'); c.px(gx + 1.5, gy, 'gold0');
    }, { sep: 1 });
  };
  const crab = (g, t) => {
    // a crab scuttling sideways between the ribs, legs ticking
    const cx = 11 + Math.round(wave(t) * 3), step = Math.floor(t * 16) % 2;
    g.part((c) => {
      c.ell(cx, 1, 2.2, 1.3, 'ochre');
      c.px(cx - 2.5, -0.5, 'ochre1'); c.px(cx + 2.5, -0.5, 'ochre1'); // claws up
      for (const s of [-1, 1]) { c.px(cx + s * 2.5, 1.5 + step, 'ochreD'); c.px(cx + s * 2, 2.5 - step, 'ochreD'); }
      c.px(cx - 0.5, 0, 'ink'); c.px(cx + 0.5, 0, 'ink');
      c.bevel({ up: 1, hi: 1, only: ['ochre'] });
      c.pline(cx - 2, 2.5, cx + 2, 2.5, 'ochreD', true);
    }, { sep: 0 });
  };
  const grass = (g, t) => {
    const cols = ['thorn1', 'fever0', 'thorn2', 'fever1'];
    for (const [x, y, s] of [[-56, 0, 1], [-44, -4, 2], [8, 3, 3], [-26, 4, 4], [60, 3, 5]]) tuft(g, x, y, t, { seed: 170 + s, n: 7, h: 8, w: 4, cols, amp: 1.5 });
  };
  return scene([70, 56, 10], [S(far), S(skull), S(near), A(life), F(drifts), F(crab), F(grass)],
    { shadow: { rx: 54, ry: 6, dy: 0 } });
}

// ---------- 10. the black glass ----------
function spire() {
  // [x, top, half width at the base, lean of the tip]
  const SP = [
    [-15, -50, 7, -3], [-1, -72, 8, 1], [11, -57, 7, 4], [-24, -30, 5, -3], [21, -36, 6, 4], [3, -26, 6, 1], [-9, -18, 5, -1],
  ];
  const ridge = (s, y) => { const [x, top, , lean] = s; const u = clamp(y / top, 0, 1); return lerp(x + 1, x + lean, u); };
  const seams = [];
  const glass = (g) => {
    const r = rng(181);
    for (const s of SP) {
      const [x, top, w, lean] = s;
      g.part((c) => {
        c.poly([[x - w, 1], [x - w * 0.8 + lean * 0.2, top * 0.45], [x - w * 0.35 + lean * 0.7, top * 0.85], [x + lean, top],
          [x + w * 0.3 + lean * 0.75, top * 0.8], [x + w * 0.7 + lean * 0.3, top * 0.4], [x + w, 1]], 'basalt2');
        // three planes: lit glass left of the ridge, dark right of it, a black sliver at the edge
        c.remap((px, py, hex) => {
          if (hex !== '#383536') return undefined;
          const rx = ridge(s, py), hw = lerp(w, 0.5, clamp(py / top, 0, 1));
          if (px < rx - 0.5) return px < rx - hw * 0.55 ? 'basalt3' : 'lmObs0';
          return px > rx + hw * 0.6 ? 'basaltD' : 'basalt1';
        });
        // a hard glassy highlight down the ridge's lit side
        c.pline(lerp(x + 1, x + lean, 0.9) - 1, top * 0.9, x - 1 + lean * 0.2, top * 0.25, 'lmObs1', true);
        // conchoidal fracture lines across the faces
        for (let k = 0; k < 3; k++) {
          const yy = top * r.range(0.2, 0.75), xx = ridge(s, yy);
          c.pline(xx - r.range(1, 4), yy + r.range(-1, 1), xx - 0.5, yy - r.range(1, 3), 'basalt1', true);
        }
      }, { sep: 1 });
      // a glowing seam zigzagging down the dark face of the bigger spires
      if (w >= 6) {
        const pts = [];
        let sy = top * r.range(0.45, 0.6), sx = ridge(s, sy) + r.range(1, 2.5);
        const end = top * 0.08;
        while (sy < end) { pts.push([sx, sy]); sy += r.range(2, 4); sx = ridge(s, sy) + r.range(0.8, 3); }
        seams.push({ pts, ph: r() * TAU });
      }
    }
  };
  const ground = (g, t) => {
    // the ash they stand in, drifted up round their feet (no outline: it is the ground)
    g.part((c) => {
      c.blob([[-33, 3], [-30, -1], [-18, -4], [0, -5], [18, -4], [30, -1], [33, 3], [0, 5]], 'ash1', 0.5);
      c.bevel({ up: 1, down: 0, hi: 1 });
      c.ell(-20, 1, 4, 1.2, 'ash1'); c.ell(16, 2, 4.4, 1.2, 'ash1');
    }, { sep: 0 });
    // cracks in the ash glowing on their own slow beat
    const k = 0.5 + 0.5 * Math.sin(t * TAU + 2);
    for (const [x0, y0, x1, y1] of [[-20, -1, -14, 1], [-14, 1, -10, 0], [8, 0, 15, 2], [15, 2, 19, 1]]) g.pline(x0, y0, x1, y1, k > 0.5 ? 'fireD' : 'emberD', true);
    rock(g, 191, [[-31, 4], [-31, 1], [-28, -1], [-25, 1], [-25, 4]], { n: 3, ol: true, tones: ['basaltD', 'basalt1', 'basalt2', 'basalt3', 'lmObs0'] });
    rock(g, 192, [[25, 4], [25, 1], [28, -2], [32, 1], [32, 4]], { n: 3, ol: true, tones: ['basaltD', 'basalt1', 'basalt2', 'basalt3', 'lmObs0'] });
  };
  const GLOW = ['emberD', 'fireD', 'fire0', 'fire1'];
  const glow = (g, t) => {
    // the seams breathe: dim ember to hot orange and back, each on its own beat
    for (const sm of seams) {
      const k = 0.5 + 0.5 * Math.sin(t * TAU + sm.ph);
      const col = GLOW[clamp(Math.round(k * 2.6), 0, 3)];
      for (let i = 0; i < sm.pts.length - 1; i++) g.pline(sm.pts[i][0], sm.pts[i][1], sm.pts[i + 1][0], sm.pts[i + 1][1], i === 0 ? GLOW[Math.max(0, GLOW.indexOf(col) - 1)] : col, true);
    }
  };
  const embers = (g, t) => {
    for (let k = 0; k < 9; k++) {
      const s = (k / 9 + t) % 1, x0 = -16 + ((k * 37) % 32);
      const x = x0 + Math.sin(s * 6 + k) * 1.5 + s * 4, y = -6 - s * 46 - (k % 3) * 4;
      if (s > 0.85) continue;
      g.px(x, y, s < 0.35 ? 'fire2' : s < 0.6 ? 'fire1' : 'fire0');
    }
  };
  return scene([40, 86, 8], [S(glass), A(glow), F(ground), F(embers)],
    { solid: 10, shadow: { rx: 22, ry: 5, dy: 0 } });
}

export function build() {
  return {
    landmarks: {
      painted: painted(), graveyard: graveyard(), oasis: oasis(), baobab: baobab(), camp: camp(),
      arch: arch(), whistle: whistle(), shrine: shrine(), whale: whale(), spire: spire(),
    },
  };
}

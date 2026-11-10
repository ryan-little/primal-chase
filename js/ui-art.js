// The UI kit, drawn in code at load on the same pixel engine as the sprites (js/art2/pix.js):
// sun-bleached hide stretched on dark wood, sinew lacing, bone and ochre, rock-painting motifs.
//
//   installUI(art)   builds the kit, publishes it as CSS custom properties (data URLs used as
//                    border-image 9-slices and backgrounds at an integer pixel scale), installs the
//                    numeral face, and returns { ms } (build time)
//   icon(name)       16x16 icon as a data URL (built on first use, cached)
//   perkArt(id)      a perk card's painting, featArt(id), secretArt(id)   (data URLs, cached)
//   drawLogo(c, t)   the title lettering, sun and horizon silhouettes into a 340x112 canvas
//   favicon()        sets the 32x32 and 16x16 page icons
//   stage(canvas, draw)  a tiny animation loop that runs only while the canvas is on screen
import { Pix, cid, canvas, hexOf } from './art2/pix.js';
import { addColors } from './art2/pal.js';

let ART = null;
const root = document.documentElement;
// PNG data URLs straight from a Pix buffer: stored (uncompressed) deflate, so encoding a few
// dozen small images costs well under a millisecond each and never reads back from a canvas.
const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const RGBC = new Map();
function pngOf(w, h, rgba) {
  const raw = new Uint8Array((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1);
  const nb = Math.ceil(raw.length / 65535) || 1, idat = new Uint8Array(2 + raw.length + nb * 5 + 4);
  idat[0] = 0x78; idat[1] = 0x01;
  let o = 2, a = 1, b = 0;
  for (let i = 0; i < nb; i++) {
    const len = Math.min(65535, raw.length - i * 65535);
    idat[o++] = i === nb - 1 ? 1 : 0; idat[o++] = len & 255; idat[o++] = len >> 8; idat[o++] = ~len & 255; idat[o++] = (~len >> 8) & 255;
    idat.set(raw.subarray(i * 65535, i * 65535 + len), o); o += len;
  }
  for (let i = 0; i < raw.length; i++) { a = (a + raw[i]) % 65521; b = (b + a) % 65521; }
  idat[o++] = b >> 8; idat[o++] = b & 255; idat[o++] = a >> 8; idat[o++] = a & 255;
  const chunks = [];
  const chunk = (type, data) => {
    const c = new Uint8Array(12 + data.length), dv = new DataView(c.buffer);
    dv.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) c[4 + i] = type.charCodeAt(i);
    c.set(data, 8);
    let crc = 0xFFFFFFFF;
    for (let i = 4; i < 8 + data.length; i++) crc = CRC[(crc ^ c[i]) & 255] ^ (crc >>> 8);
    dv.setUint32(8 + data.length, (crc ^ 0xFFFFFFFF) >>> 0);
    chunks.push(c);
  };
  const hdr = new Uint8Array(13), hv = new DataView(hdr.buffer);
  hv.setUint32(0, w); hv.setUint32(4, h); hdr[8] = 8; hdr[9] = 6;
  chunk('IHDR', hdr); chunk('IDAT', idat); chunk('IEND', new Uint8Array(0));
  let bin = '\x89PNG\r\n\x1a\n';
  for (const c of chunks) for (let i = 0; i < c.length; i += 8192) bin += String.fromCharCode.apply(null, c.subarray(i, i + 8192));
  return 'data:image/png;base64,' + btoa(bin);
}
function pixURL(g) {
  g.flush();
  const { w, h, buf } = g, out = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const id = buf[i];
    if (!id) continue;
    let c = RGBC.get(id);
    if (!c) { const n = parseInt(hexOf(id).slice(1), 16); c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; RGBC.set(id, c); }
    out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = 255;
  }
  return pngOf(w, h, out);
}
const url = (c) => (c instanceof Pix ? pixURL(c) : c.toDataURL());
const css = (k, c) => root.style.setProperty(k, `url("${typeof c === 'string' ? c : url(c)}")`);
const TAU = Math.PI * 2;
function h2(i, j, s = 0) {
  let n = (i * 374761393 + j * 668265263 + s * 1442695041) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
export const reduceMotion = () => document.body.classList.contains('calm') || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

addColors({
  uiInk: '#0d0805', uiShade: '#0b0704',
  wd0: '#24170f', wd1: '#3a2618', wd2: '#5a3b24', wd3: '#7a5434', wd4: '#9a7448', wdG: '#4a301e',
  hd0: '#140d09', hd1: '#1b130d', hd2: '#20160f', hd3: '#271b12', hd4: '#2f2116',
  vl0: '#6e5a40', vl1: '#a8916c', vl2: '#c9b48e', vl3: '#d8c6a0', vl4: '#e5d6b4', vl5: '#efe4c8',
  sinew: '#e6dcc2', sinewD: '#a99d82',
});

// Fill a w x h Pix from fn(x, y) -> color key | null.
function slab(w, h, fn) {
  const g = new Pix(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = fn(x, y); if (c) g.set(x, y, cid(c)); }
  return g;
}
// Where a pixel sits in a 9-slice: distance to the nearest edge, which side, position along it.
function edge(x, y, W, H, S, T) {
  const dx = Math.min(x, W - 1 - x), dy = Math.min(y, H - 1 - y), d = Math.min(dx, dy);
  const horiz = dy <= dx;
  const side = horiz ? (y < H / 2 ? 't' : 'b') : (x < W / 2 ? 'l' : 'r');
  const p = horiz ? x : y;
  return { dx, dy, d, side, q: (((p - S) % T) + T) % T, corner: dx < S && dy < S };
}

// ---------------------------------------------------------------- frames
// Big menu panel: dark wood, an ink groove, hide laced to it with sinew, smoked hide inside.
function panelArt() {
  const S = 10, T = 24, W = 2 * S + T;
  return slab(W, W, (x, y) => {
    const e = edge(x, y, W, W, S, T), { d, side, q } = e;
    if (e.dx + e.dy < 2) return null;
    const lit = side === 't' || side === 'l';
    // corner lashing: sinew wrapped crosswise over the mitred joint
    if (e.corner && d >= 1 && d <= 4) {
      const a = Math.min(e.dx, 6), b = Math.min(e.dy, 6);
      if (e.dx <= 6 && e.dy <= 6 && (a === b || a + b === 7)) return (a + b) % 2 ? 'sinewD' : 'sinew';
    }
    if (d === 0) return 'uiInk';
    if (d === 1) return lit ? 'wd4' : 'wd2';
    if (d === 2 || d === 3) {
      const r = h2(q, d * 7 + (side === 't' || side === 'b' ? 1 : 2), 11);
      return r < 0.22 ? 'wdG' : r > 0.9 ? 'wd4' : 'wd3';
    }
    if (d === 4) return 'wd1';
    if (d === 5) return 'uiInk';
    // lacing: a strand every 6 px through the hide's edge, a hole where it goes in
    const k = q % 6;
    if (d === 6 || d === 7) {
      if (e.corner) return d === 6 ? 'hd0' : 'hd1';
      if (k === 0) return 'sinewD';
      if (k === 1) return 'wd1';
      return d === 6 ? 'hd0' : 'hd1';
    }
    if (d === 8 && !e.corner && k === 0) return 'uiShade';
    if (d === 8 && side === 't') return 'hd1';
    // smoked hide: low, periodic mottling so the 24 px tile repeats without a seam
    const qx = (((x - S) % T) + T) % T, qy = (((y - S) % T) + T) % T;
    const v = 0.55 * Math.sin(TAU * qx / T + 1.4 * Math.sin(TAU * qy / T)) + 0.35 * Math.sin(TAU * (qx + 2 * qy) / T) + (h2(qx, qy, 3) - 0.5) * 0.9;
    return v < -0.55 ? 'hd1' : v > 0.6 ? 'hd3' : 'hd2';
  });
}
// Small frame for HUD chips, tiles and toasts. tone: wood | hot | gold | cool
function frameArt(tone = 'wood') {
  const S = 4, T = 8, W = 2 * S + T;
  const C = { wood: ['wd4', 'wd2', 'wd1'], hot: ['#ff7a52', '#b5322a', '#6a1610'], gold: ['#ffe08a', '#c89648', '#6e4c2e'], cool: ['#bfe3de', '#4aa3ad', '#1a4d5e'] }[tone];
  return slab(W, W, (x, y) => {
    const e = edge(x, y, W, W, S, T), { d, side } = e;
    if (e.dx + e.dy < 1) return null;
    if (e.dx === 1 && e.dy === 1) return 'sinew';
    if ((e.dx === 2 && e.dy === 1) || (e.dx === 1 && e.dy === 2)) return 'sinewD';
    if (d === 0) return 'uiInk';
    if (d === 1) return side === 't' || side === 'l' ? C[0] : C[1];
    if (d === 2) return C[2];
    if (d === 3) return 'uiInk';
    return d === 4 && side === 't' ? 'hd0' : 'hd2';
  });
}
// Pale hide card: rounded, stitched round the edge with dark sinew. hi: an ochre rim (hover/focus).
function vellumArt(hi = false) {
  const S = 6, T = 12, W = 2 * S + T;
  return slab(W, W, (x, y) => {
    const e = edge(x, y, W, W, S, T), { d, side, q } = e;
    if (e.dx + e.dy < 3) return null;
    if (e.dx + e.dy === 3) return hi ? 'ochreD' : '#2a1a10';
    if (d === 0) return hi ? 'ochreD' : '#2a1a10';
    if (d === 1) return hi ? 'ochre1' : side === 'b' || side === 'r' ? 'vl1' : 'vl2';
    if (d === 2) return e.corner ? 'vl3' : q % 3 < 2 ? '#5a3b24' : 'vl3';
    const qx = (((x - S) % T) + T) % T, qy = (((y - S) % T) + T) % T;
    const v = 0.5 * Math.sin(TAU * qx / T + Math.sin(TAU * qy / T) * 1.2) + (h2(qx, qy, 5) - 0.5) * 0.8;
    if (d === 3 && side === 'b') return 'vl3';
    return v < -0.55 ? 'vl3' : v > 0.6 ? 'vl5' : 'vl4';
  });
}
// A ribbon of hide for the Day banner: torn ends, ochre bands along both edges.
function bannerArt() {
  const S = 12, T = 12, W = 2 * S + T, H = 30;
  return slab(W, H, (x, y) => {
    const tx = Math.min(x, W - 1 - x);
    // ragged ends: a jagged edge cut a few pixels in
    const tear = [3, 1, 4, 2, 0, 3, 1, 2, 4, 1, 3, 2, 0, 2, 4, 1, 3, 2, 1, 3, 0, 2, 4, 1, 3, 2, 1, 4, 2, 0][y] ?? 2;
    if (tx < tear) return null;
    if (tx === tear) return 'uiInk';
    if (y === 0 || y === H - 1) return 'uiInk';
    if (y === 1) return 'vl1';
    if (y === 2 || y === 3) return 'ochre';
    if (y === 4) return 'ochreD';
    if (y === H - 2) return 'ochreD';
    if (y === H - 3 || y === H - 4) return 'ochre';
    if (y === H - 5) return 'vl1';
    const qx = (((x - S) % T) + T) % T;
    if ((y === 6 || y === H - 7) && qx % 4 === 0) return 'ochreD';
    return h2(qx, y, 9) < 0.15 ? 'hd3' : 'hd2';
  });
}

// ---------------------------------------------------------------- buttons
// A wooden plank bound at both ends with sinew. 24x17, slices: top 4, bottom 5, sides 6.
const BTN = { W: 24, H: 17 };
function btnArt({ face, hi, lo, lip, lash = 'sinew', lashLo = 'sinewD', ol = 'uiInk', rim = null, pressed = false, grain = null }) {
  const { W, H } = BTN;
  return slab(W, H, (x, y) => {
    if ((x === 0 || x === W - 1) && (y === (pressed ? 1 : 0) || y === H - 1)) return null;
    if (pressed && y === 0) return null;
    const top = pressed ? 1 : 0;
    if (y === top || y === H - 1 || x === 0 || x === W - 1) return rim && y === top ? rim : ol;
    if (!pressed && y === H - 2) return lip;
    if (y === H - 2 || (!pressed && y === H - 3)) return lo;
    if (y === top + 1) return hi;
    if (x === 1) return hi;
    if (x === W - 2) return lo;
    const bx = x < W / 2 ? x - 3 : W - 1 - x - 3;
    if (bx === 0 || bx === 1) return (bx + y) % 2 ? lashLo : lash;
    if (bx === 2) return lo;
    if (grain && y % 8 === 4 && x % 12 > 2 && x % 12 < 8) return grain;
    return face;
  });
}
// Square slot for HUD buttons (MAP, pause): same plank, short. 14x15, slices 4/5/4.
function keyArt({ face, hi, lo, lip, pressed = false }) {
  const W = 10, H = 11;
  return slab(W, H, (x, y) => {
    if ((x === 0 || x === W - 1) && (y === (pressed ? 1 : 0) || y === H - 1)) return null;
    if (pressed && y === 0) return null;
    const top = pressed ? 1 : 0;
    if (y === top || y === H - 1 || x === 0 || x === W - 1) return 'uiInk';
    if (!pressed && y === H - 2) return lip;
    if (y === H - 2 || (!pressed && y === H - 3)) return lo;
    if (y === top + 1 || x === 1) return hi;
    if (x === W - 2) return lo;
    return face;
  });
}

// ---------------------------------------------------------------- bars
function barArt(tone = 'wood') {
  const W = 6, rim = { wood: ['wd3', 'wd1'], hot: ['#ff7a52', '#8e1f1a'], cool: ['#bfe3de', '#2f8295'] }[tone];
  return slab(W, W, (x, y) => {
    const d = Math.min(x, y, W - 1 - x, W - 1 - y);
    if ((x === 0 || x === W - 1) && (y === 0 || y === W - 1)) return null;
    if (d === 0) return 'uiInk';
    if (d === 1) return y === 1 ? rim[0] : rim[1];
    return '#0e0906';
  });
}
// Fill tile: h rows tall, a notch every 4 px so the bar reads in segments.
function fillArt([hi, base, lo, notch], h = 4) {
  return slab(4, h, (x, y) => (x === 3 ? notch : y === 0 ? hi : y === h - 1 ? lo : base));
}

// ---------------------------------------------------------------- icons
// 16x16, flat palette shapes resolved to pixels, ramp-lit, ink outlined (the vitals icons' style).
const ICON = {};
const ic = (name, fn, { ol = true, bev = true } = {}) => { ICON[name] = { fn, ol, bev }; };
const rays = (g, cx, cy, r0, r1, n, col, w = 1.3, a0 = 0) => { for (let k = 0; k < n; k++) { const a = a0 + (k / n) * TAU; g.line([cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1], w, col); } };
const erase = (g, test) => g.remap((x, y) => (test(x, y) ? null : undefined));
function paw(g, cx, cy, s, col) {
  g.ell(cx, cy + 1.9 * s, 2.2 * s, 1.7 * s, col);
  for (const [dx, dy] of [[-3.0, -0.5], [-1.2, -2.3], [1.2, -2.3], [3.0, -0.5]]) g.ell(cx + dx * s, cy + dy * s, 0.75 * s, 1.0 * s, col);
}
ic('sun', (g) => { rays(g, 8, 8, 4.6, 7.1, 8, 'fire1', 1.4, Math.PI / 8); g.ell(8, 8, 3.9, 3.9, 'fire1'); g.ell(7.4, 7.4, 2.4, 2.4, 'fire2'); });
ic('moon', (g) => { g.ell(8, 8, 6, 6, 'salt2'); erase(g, (x, y) => (x - 11) ** 2 + (y - 5.5) ** 2 < 22); g.px(5, 9, 'salt0'); g.px(4, 6, 'salt0'); });
ic('dawn', (g) => { rays(g, 8, 11, 5, 7.4, 7, 'fire1', 1.3, Math.PI); g.ell(8, 11, 4.4, 4.4, 'fire1'); g.ell(7.4, 10.4, 2.6, 2.6, 'fire2'); erase(g, (x, y) => y > 11.5); g.rect(1, 12, 14, 2, 'ochre'); });
ic('dusk', (g) => { g.ell(8, 11, 4.6, 4.6, 'fire0'); g.ell(7.6, 10.6, 2.6, 2.6, 'fire1'); erase(g, (x, y) => y > 11.5); g.rect(1, 12, 14, 2, 'ochreD'); g.px(3, 4, 'salt2'); g.px(12, 3, 'salt2'); });
const cloud = (g, c1, c2, dy = 0) => { g.ell(5, 7 + dy, 3, 2.6, c1); g.ell(9, 5.6 + dy, 3.6, 3.4, c1); g.ell(12, 7.6 + dy, 2.6, 2.2, c1); g.rect(3, 7 + dy, 11, 2.6, c1); g.ell(8.6, 5 + dy, 2, 1.6, c2); };
ic('rain', (g) => { cloud(g, 'rock3', 'rock4', -1); for (const x of [4.5, 8.5, 12.5]) g.line([x, 10.5, x - 1.4, 14], 1.2, 'water2'); });
ic('storm', (g) => { cloud(g, 'rock1', 'rock2', -1); g.poly([[9, 8], [5.5, 12], [8, 12], [6.5, 15.5], [11, 10.5], [8.5, 10.5], [10, 8]], 'gold1'); });
ic('fog', (g) => { for (const [y, x0, x1] of [[4, 2, 12], [8, 4, 14], [12, 2, 11]]) g.curve([[x0, y], [x0 + 3, y - 1], [x1 - 3, y + 1], [x1, y]], 1.6, 'rock4'); }, { bev: false });
ic('dust', (g) => { g.curve([[2, 5], [7, 3.5], [12, 5], [10, 8], [6, 7.5]], 1.6, 'sand2'); g.curve([[3, 11], [8, 9.5], [14, 11]], 1.6, 'sand3'); g.px(13, 3, 'sand1'); g.px(2, 8, 'sand1'); g.px(12, 14, 'sand1'); }, { bev: false });
ic('heatwave', (g) => { g.ell(8, 6, 3.6, 3.6, 'fire1'); g.ell(7.4, 5.4, 2, 2, 'fire2'); rays(g, 8, 6, 4.4, 5.9, 8, 'fire0', 1.2, Math.PI / 8); for (const y of [11.5, 14]) g.curve([[2, y], [5, y - 1.2], [8, y], [11, y - 1.2], [14, y]], 1.2, 'fire0'); }, { bev: false });
ic('paw', (g) => paw(g, 8, 8, 1.55, 'bone'));
ic('prints', (g) => { paw(g, 5, 10.5, 0.85, 'bone'); paw(g, 11, 5, 0.85, 'bone'); });
ic('hand', (g) => { g.ell(8.6, 11, 3.4, 3.4, 'ochre'); for (const [x, y] of [[5.4, 3.2], [7.7, 1.8], [10, 2.2], [12.2, 4.4]]) g.limb(x, y, 8.6 + (x - 8.6) * 0.7, 9.5, 1.5, 1.7, 'ochre'); g.limb(5.6, 12, 2.2, 8.6, 1.6, 1.4, 'ochre'); g.px(9, 11, 'ochre1'); }, { bev: false });
ic('claws', (g) => { for (const dx of [-3.4, 0, 3.4]) g.curve([[5 + dx, 2], [8 + dx, 7], [9.5 + dx, 14]], 1.5, 'blood1'); }, { bev: false });
ic('scroll', (g) => { g.poly([[3, 3], [13, 2], [12.5, 13.5], [3.5, 14]], 'vl4'); g.rect(2, 2, 2, 12, 'bark2'); g.rect(12, 1.5, 2, 12.5, 'bark2'); g.line([6, 10, 7, 6, 8, 10], 1, 'ochre'); g.ell(7, 5, 0.9, 0.9, 'ochre'); g.line([9, 9.5, 10.5, 7], 1, 'ochre'); });
ic('sliders', (g) => { for (const [y, k] of [[4, 10], [8, 5], [12, 8]]) { g.rect(2, y - 0.5, 12, 1.2, 'bark2'); g.ell(k, y, 1.8, 1.8, 'bone'); } });
ic('arrowL', (g) => { g.poly([[2, 8], [9, 2.5], [8, 6], [14, 6], [14, 10], [8, 10], [9, 13.5]], 'bone'); });
ic('spearhead', (g) => { g.poly([[14, 8], [6, 3.5], [3, 8], [6, 12.5]], 'rock3'); g.line([3, 8, 1, 8], 1.4, 'bark3'); g.line([7, 6, 11, 8], 1, 'rock4'); });
ic('spear', (g) => { g.line([2.5, 13.5, 11, 5], 1.4, 'bark3'); g.poly([[10, 4], [14.5, 1.5], [12, 6]], 'rock3'); g.line([9.4, 6.4, 10.4, 7.4], 1.2, 'bone0'); });
ic('spears', (g) => { g.line([2.5, 13.5, 11.5, 4.5], 1.4, 'bark3'); g.poly([[10.5, 3.5], [14.5, 1.5], [12.5, 5.5]], 'rock3'); g.line([13.5, 13.5, 4.5, 4.5], 1.4, 'bark3'); g.poly([[5.5, 3.5], [1.5, 1.5], [3.5, 5.5]], 'rock3'); });
ic('broken', (g) => { g.line([2.5, 13.5, 7, 9], 1.4, 'bark3'); g.line([9, 7.5, 11, 5], 1.4, 'bark3'); g.poly([[10, 4], [14.5, 1.5], [12, 6]], 'rock3'); g.px(8, 8, 'bark4'); });
ic('swirl', (g) => { const pts = []; for (let k = 0; k <= 22; k++) { const a = k * 0.42, r = 1 + k * 0.26; pts.push([8 + Math.cos(a) * r, 8 + Math.sin(a) * r]); } g.curve(pts, 1.6, 'foam'); g.poly([[13.6, 4.5], [15, 9], [11.5, 8]], 'foam'); }, { bev: false });
ic('copy', (g) => { g.poly([[2, 4], [10, 3], [10.5, 12], [2.5, 12.5]], 'vl2'); g.poly([[6, 6.5], [14, 6], [13.5, 14.5], [6.5, 14.5]], 'vl4'); g.line([8, 9, 12, 8.8], 1, 'ochre'); g.line([8, 11.5, 11, 11.3], 1, 'ochre'); });
ic('hut', (g) => { g.ell(8, 12, 6.4, 6.6, 'tall1'); erase(g, (x, y) => y > 13.5); g.rect(1.5, 12, 13, 1.6, 'tall0'); g.ell(8, 12.2, 1.8, 2.6, 'bark0'); erase(g, (x, y) => y > 13.5 && x > 0); g.line([4, 9, 12, 9], 1, 'tall2'); g.line([3, 6.5, 6, 3.5], 0.9, 'tall0'); });
ic('map', (g) => { g.poly([[2, 3], [7, 2], [9.5, 3.5], [14, 2.5], [13.5, 13], [9, 14], [6.5, 12.5], [2.5, 13.5]], 'vl4'); g.line([4, 11, 6, 8.5, 9, 9, 11, 6], 1, 'ochre'); g.line([10.5, 4, 12.5, 6], 1, 'blood1'); g.line([12.5, 4, 10.5, 6], 1, 'blood1'); });
ic('pause', (g) => { g.rect(4, 2.5, 3, 11, 'bark3'); g.rect(9, 2.5, 3, 11, 'bark3'); for (const x of [4, 9]) { g.rect(x, 5, 3, 1, 'sinew'); g.rect(x, 11, 3, 1, 'sinew'); } });
ic('star', (g) => { const p = []; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 2.9 : 6.9; p.push([8 + Math.cos(a) * r, 8.4 + Math.sin(a) * r]); } g.poly(p, 'gold1'); g.px(7, 7, 'gold2'); g.px(8, 6, 'gold2'); });
ic('spark', (g) => { g.poly([[8, 1.5], [9.5, 6.5], [14.5, 8], [9.5, 9.5], [8, 14.5], [6.5, 9.5], [1.5, 8], [6.5, 6.5]], 'gold1'); g.px(7, 7, 'gold2'); });
ic('eye', (g) => { g.ell(8, 8, 6.6, 3.8, 'bone1'); g.ell(8, 8, 2.8, 2.8, 'ochre'); g.ell(8, 8, 1.2, 1.4, 'uiInk'); g.px(7, 7, 'bone1'); });
ic('wave', (g) => { for (const y of [5, 9.5, 14]) g.curve([[1.5, y], [4, y - 2], [6.5, y], [9, y - 2], [11.5, y], [14.5, y - 2]], 1.6, 'water2'); }, { bev: false });
ic('pelt', (g) => { g.blob([[3, 3], [8, 2], [13, 3], [14, 8], [13, 13], [8, 14], [3, 13], [2, 8]], 'fur2'); for (const [x, y] of [[5, 5], [10, 4], [7, 8], [11, 9], [5, 11], [9, 12]]) { g.px(x, y, 'spot'); g.px(x + 1, y, 'spot'); } });
ic('scar', (g) => { g.blob([[3, 3], [8, 2], [13, 3], [14, 8], [13, 13], [8, 14], [3, 13], [2, 8]], 'fur2'); for (const d of [-3, 0, 3]) g.line([4 + d, 3, 11 + d, 13], 1, 'blood'); });
ic('leap', (g) => { g.curve([[2, 13], [5, 5], [10, 3], [14, 8]], 1.3, 'bone'); g.poly([[15, 11], [11.5, 8.5], [15.5, 6.5]], 'bone'); for (const x of [3, 5]) g.px(x, 14, 'bone0'); });
ic('dash', (g) => { for (const x of [3, 8]) g.poly([[x, 3], [x + 5, 8], [x, 13], [x + 2, 8]], 'bone'); g.line([0.5, 6, 2.5, 6], 1, 'bone0'); g.line([0.5, 10, 2.5, 10], 1, 'bone0'); });
ic('fang', (g) => { g.poly([[2, 3], [14, 3], [13, 6], [3, 6]], 'blood1'); g.poly([[4, 6], [6.5, 6], [5.2, 13]], 'bone1'); g.poly([[9.5, 6], [12, 6], [10.8, 13]], 'bone1'); });
ic('gourd', (g) => { g.ell(8, 10.5, 4.6, 4.6, 'clay2'); g.ell(8, 5, 2.4, 2.6, 'clay2'); g.rect(7, 1.5, 2, 2, 'bark2'); g.line([4.4, 8.5, 11.6, 8.5], 1, 'ochreD'); g.px(6, 9, 'clay1'); });
ic('loop', (g) => { g.curve([[8, 8], [5, 4.5], [2, 8], [5, 11.5], [8, 8], [11, 4.5], [14, 8], [11, 11.5], [8, 8]], 1.8, 'sinew'); }, { bev: false });
ic('scent', (g) => { for (const x of [4, 8, 12]) g.curve([[x, 14], [x - 1.5, 11], [x + 1.5, 7], [x - 1, 3]], 1.4, 'bone'); }, { bev: false });
ic('cliff', (g) => { g.poly([[1, 14], [1, 6], [6, 6], [8, 3], [15, 3], [15, 14]], 'rock2'); g.rect(1, 6, 5, 1, 'rock4'); g.rect(8, 3, 7, 1, 'rock4'); g.line([5, 9, 9, 9], 1, 'rock1'); g.line([10, 6, 13, 6], 1, 'rock1'); });
ic('compass', (g) => { g.ell(8, 8, 6.4, 6.4, 'vl3'); g.ell(8, 8, 4.6, 4.6, 'vl4'); g.poly([[8, 2.5], [9.4, 8], [8, 13.5], [6.6, 8]], 'ochre'); g.poly([[8, 2.5], [9.4, 8], [6.6, 8]], 'blood1'); g.poly([[2.5, 8], [8, 6.8], [13.5, 8], [8, 9.2]], 'bark2'); });
ic('secret', (g) => { g.blob([[2, 13], [3, 5], [8, 2], [13, 5], [14, 13]], 'rock2'); g.line([6, 6, 7, 4.5, 9.5, 4.5, 10.5, 6, 8, 8.5, 8, 10], 1.6, 'gold1'); g.px(8, 12, 'gold1'); });
ic('cave', (g) => { g.blob([[1, 14], [2, 6], [8, 2], [14, 6], [15, 14]], 'rock2'); g.ell(8, 11, 3.4, 4.4, 'uiInk'); erase(g, (x, y) => y > 14.5); g.rect(1, 13.6, 14, 1, 'rock1'); });
ic('gazelle', (g) => { g.curve([[6, 6], [4.5, 2], [3, 0.6]], 1.1, 'bone0'); g.curve([[8, 6], [7.5, 2], [6.5, 0.6]], 1.1, 'bone0'); g.blob([[5, 6], [9, 5.5], [11, 9], [13.5, 12], [12, 14], [9, 13], [5, 10]], 'gaz2'); g.ell(4.6, 7, 1.6, 1, 'gaz1'); g.px(9, 8, 'uiInk'); g.line([9.5, 9, 12, 12.5], 1, 'gazW'); });
ic('goldgaz', (g) => { g.curve([[6, 6], [4.5, 2], [3, 0.6]], 1.1, 'gold2'); g.curve([[8, 6], [7.5, 2], [6.5, 0.6]], 1.1, 'gold2'); g.blob([[5, 6], [9, 5.5], [11, 9], [13.5, 12], [12, 14], [9, 13], [5, 10]], 'gold1'); g.ell(4.6, 7, 1.6, 1, 'gold0'); g.px(9, 8, 'uiInk'); });
ic('horns', (g) => { g.blob([[5, 5], [11, 5], [10, 12], [8, 14.5], [6, 12]], 'dog1'); g.curve([[5, 5.5], [2, 5], [1.5, 2]], 1.6, 'bone0'); g.curve([[11, 5.5], [14, 5], [14.5, 2]], 1.6, 'bone0'); g.px(6, 8, 'uiInk'); g.px(9, 8, 'uiInk'); g.rect(6, 12, 4, 2, 'dog0'); });
ic('dog', (g) => { g.blob([[3, 6], [8, 4], [10, 2], [11, 5], [14.5, 9], [13, 12], [9, 12.5], [4, 12]], 'dog2'); g.poly([[8, 4], [9, 0.8], [10.6, 4.5]], 'dog1'); g.px(10, 7, 'uiInk'); g.rect(13.5, 9, 1.5, 1.5, 'uiInk'); g.line([4, 11.5, 12, 11.5], 1, 'dog1'); });
ic('lion', (g) => { g.ell(8, 8.4, 6.8, 6.6, 'mane'); g.ell(8, 9, 4, 4.4, 'lion1'); g.ell(8, 11.4, 2.2, 1.6, 'lion2'); g.px(6, 8, 'uiInk'); g.px(9, 8, 'uiInk'); g.px(7, 10, 'uiInk'); g.px(8, 10, 'uiInk'); });
ic('cathead', (g) => { g.ell(4, 4, 2, 2.2, 'fur2'); g.ell(12, 4, 2, 2.2, 'fur2'); g.ell(8, 9, 6, 5.4, 'fur2'); g.ell(8, 12, 3, 2.2, 'fur4'); g.px(5, 8, 'gold1'); g.px(10, 8, 'gold1'); g.px(7, 11, 'uiInk'); g.px(8, 11, 'uiInk'); g.px(4, 4, 'fur1'); g.px(11, 4, 'fur1'); for (const [x, y] of [[7, 5], [9, 6], [3, 9], [12, 10]]) g.px(x, y, 'spot'); g.pline(5, 9, 6, 11, 'spot'); g.pline(10, 9, 9, 11, 'spot'); });
ic('hunterhead', (g) => { g.ell(8, 9, 4.6, 5.2, 'skin2'); g.ell(8, 5.2, 5, 3, 'mud1'); g.rect(3.6, 6.4, 8.8, 1.4, 'ochre'); g.px(10, 9, 'uiInk'); g.px(12, 10, 'skin1'); g.line([12, 2, 15, 0.5], 1, 'rock3'); });
ic('palm', (g) => { g.curve([[8, 15], [8.5, 10], [8, 5]], 1.6, 'bark3'); for (const a of [-2.6, -1.9, -1.2, -0.5, 0.2]) g.curve([[8, 5], [8 + Math.cos(a) * 4, 5 + Math.sin(a) * 3.4 - 1], [8 + Math.cos(a) * 6.8, 5 + Math.sin(a) * 2 + 2.6]], 1.4, 'palm2'); g.ell(3, 14.5, 3, 1, 'water2'); g.ell(13, 14.5, 3, 1, 'water2'); });
ic('baobab', (g) => { g.blob([[5, 15], [5.5, 9], [5, 6], [11, 6], [10.5, 9], [11, 15]], 'bark3'); for (const [x, y] of [[3, 4], [8, 2.5], [13, 4]]) g.line([8, 6.5, x, y], 1.2, 'bark2'); g.ell(3, 3.5, 2, 1.2, 'leaf2'); g.ell(8, 2.2, 2.2, 1.2, 'leaf2'); g.ell(13, 3.5, 2, 1.2, 'leaf2'); g.ell(8, 11.5, 1, 1.6, 'bark0'); });
ic('fire', (g) => { g.poly([[8, 2], [11.5, 7], [12, 11], [8, 13], [4, 11], [4.5, 7], [6.5, 8]], 'fire0'); g.poly([[8, 6], [10, 9], [9.6, 12], [6.6, 12], [6.4, 9.6]], 'fire1'); g.ell(8, 11.4, 1.2, 1, 'fire2'); g.line([2, 14.5, 14, 12.5], 1.4, 'bark2'); g.line([2, 12.5, 14, 14.5], 1.4, 'bark3'); });
ic('arch', (g) => { g.poly([[1, 15], [2, 5], [5, 2], [11, 2], [14, 5], [15, 15], [11.5, 15], [11, 9], [8, 6.5], [5, 9], [4.5, 15]], 'clay2'); g.line([3, 6, 6, 3.4], 1, 'clay3'); });
ic('pole', (g) => { g.rect(6, 1.5, 4, 13.5, 'bark3'); for (const y of [3, 7.5, 12]) { g.rect(6, y, 4, 2.6, 'bark2'); g.px(7, y + 1, 'uiInk'); g.px(8, y + 1, 'uiInk'); } g.rect(2, 13.5, 3, 2, 'rock2'); g.rect(11, 13.5, 3, 2, 'rock2'); });
ic('ribs', (g) => { g.line([2, 13, 14, 13], 1.4, 'bone'); for (const x of [3.5, 6.5, 9.5, 12.5]) g.curve([[x, 13], [x - 1, 7], [x + 1.4, 2.5]], 1.3, 'bone'); });
ic('tusk', (g) => { g.curve([[2, 13], [5, 14], [10, 12], [13, 7], [13.5, 2.5]], 2.2, 'bone1'); g.ell(4, 12.2, 2.4, 2, 'bone0'); });
ic('shard', (g) => { g.poly([[8, 1], [12, 8], [10.5, 14.5], [5.5, 14.5], [4, 8]], 'basalt3'); g.poly([[8, 1], [9.4, 8], [8, 14.5], [5.5, 14.5], [4, 8]], 'basalt2'); g.line([8, 3, 9, 8], 1, 'basalt4'); g.px(7, 13, 'fire0'); });
ic('breath', (g) => { g.ell(4, 10, 2.4, 2.4, 'bone'); g.ell(8.6, 7.6, 3, 3, 'bone'); g.ell(12.4, 4.4, 2.4, 2.4, 'bone'); g.curve([[1.5, 14], [4, 13.5], [6, 12]], 1.2, 'bone0'); });
ic('drum', (g) => { g.ell(8, 5, 6, 2.4, 'vl4'); g.rect(2, 5, 12, 7, 'clay1'); g.ell(8, 12, 6, 2.4, 'clay1'); g.line([3, 6, 6, 12, 9, 6, 12, 12], 1, 'sinew'); });

const IPIX = new Map(), ICACHE = new Map();
function iconPix(name) {
  let g = IPIX.get(name);
  if (g) return g;
  const def = ICON[name] || ICON.star;
  g = new Pix(16, 16);
  def.fn(g);
  if (def.bev) g.bevel({ up: 1, down: 1, left: 0, right: 0, hi: 1, lo: 1 });
  if (def.ol) g.outline({ col: 'uiInk', tint: false });
  IPIX.set(name, g);
  return g;
}
// as a canvas, for drawing (the minimap's markers)
export function iconCanvas(name) {
  let c = ICACHE.get(name);
  if (!c) { c = iconPix(name).toCanvas(); ICACHE.set(name, c); }
  return c;
}
const IURL = new Map();
export function icon(name) {
  if (ART && ART.icons[name] && !ICON[name]) return ART.icons[name];
  let u = IURL.get(name);
  if (!u) { u = pixURL(iconPix(name)); IURL.set(name, u); }
  return u;
}
export const iconImg = (name, cls = 'ic') => `<img class="${cls}" src="${icon(name)}" alt="">`;

// what each perk, feat, secret and weather shows
export const PERK_ICON = { coat: 'pelt', stride: 'prints', lungs: 'breath', camel: 'gourd', softpaws: 'paw', ghost: 'fog', pounce: 'leap', hide: 'scar', river: 'wave', night: 'moon', scavenger: 'food', wind: 'swirl', sense: 'eye', apex: 'fang', nose: 'scent', marathon: 'loop' };
export const FEAT_ICON = {
  day2: 'dawn', day4: 'sun', day7: 'star', day10: 'sun', untouched: 'pelt', hunt: 'gazelle', glutton: 'food', feast: 'food', menu: 'gazelle', golden: 'goldgaz',
  takedown: 'spears', hunterbane: 'hunter', packbreaker: 'dog', scatter: 'fang', whisker: 'spear', ghost: 'prints', escape: 'dash', wild: 'claws', wilder: 'claws',
  trample: 'horns', pride: 'lion', marathon: 'loop', ultra: 'loop', climber: 'cliff', explorer: 'compass', secret: 'secret', secrets3: 'cave', allsecrets: 'star', instincts: 'spark',
};
export const SECRET_ICON = { painted: 'hand', graveyard: 'tusk', oasis: 'palm', baobab: 'baobab', camp: 'fire', arch: 'arch', whistle: 'cave', shrine: 'pole', whale: 'ribs', spire: 'shard' };

// ---------------------------------------------------------------- rock paintings (perk cards, journal)
// A sprite as a painted silhouette: coverage-sampled at `scale`, one flat pigment, worn in places.
function paintSprite(g, img, x, y, scale, col, { flip = false, wear = 0.06, seed = 1, dither = 0 } = {}) {
  const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
  const c = canvas(w, h), cx = c.getContext('2d', { willReadFrequently: true });
  cx.imageSmoothingEnabled = scale < 1;
  if (flip) { cx.translate(w, 0); cx.scale(-1, 1); }
  cx.drawImage(img, 0, 0, w, h);
  const d = cx.getImageData(0, 0, w, h).data, id = cid(col);
  const on = (i, j) => i >= 0 && j >= 0 && i < w && j < h && d[(j * w + i) * 4 + 3] > 120;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (!on(i, j)) continue;
    const inner = on(i - 1, j) && on(i + 1, j) && on(i, j - 1) && on(i, j + 1);
    if (inner && h2(i + x, j + y, seed) < wear) continue;
    if (dither && (i + j) % 2 && h2(i, j, seed + 3) < dither) continue;
    g.set(Math.round(x) + i, Math.round(y) + j, id);
  }
  return [w, h];
}
const PW = 64, PH = 36;
const RED = 'ochre', DARK = '#5e2412', WHITE = 'bone1';
function dots(g, pts, col = DARK) { for (const [x, y] of pts) g.px(x, y, col); }
const PAINT = {
  coat: (g, A) => { g.ell(50, 9, 5.5, 5.5, RED); rays(g, 50, 9, 7, 10, 10, RED, 1); paintSprite(g, A.cat.lie[0], 2, 12, 0.85, RED); },
  stride: (g, A) => { paintSprite(g, A.cat.run[2], 12, 2, 0.85, RED); for (const y of [12, 17, 22]) g.line([1, y, 9, y], 1, DARK); for (let k = 0; k < 6; k++) g.ell(14 + k * 8, 33 - (k % 2) * 2, 1.2, 0.9, DARK); },
  lungs: (g, A) => { paintSprite(g, A.cat.run[5], 2, 4, 0.85, RED); g.curve([[50, 14], [55, 10], [60, 13], [56, 17], [53, 14]], 1, WHITE); g.curve([[50, 20], [56, 19], [61, 22]], 1, WHITE); },
  camel: (g, A) => { paintSprite(g, A.cat.drink[0], 0, 6, 0.85, RED); g.ell(55, 23, 6, 6.5, DARK); g.ell(55, 14, 2.6, 3, DARK); g.rect(54, 9, 2, 2, RED); g.px(53, 22, WHITE); g.px(52, 21, WHITE); },
  softpaws: (g) => { for (let k = 0; k < 6; k++) { const x = 6 + k * 10, y = 28 - k * 4 + (k % 2) * 4; paw(g, x, y, 0.9, k > 3 ? DARK : RED); } },
  ghost: (g, A) => { paintSprite(g, A.cat.stalk[0], 0, 8, 0.85, RED, { dither: 0.75, wear: 0.2 }); paintSprite(g, A.hunter[0].d.idle[0], 46, 4, 0.6, DARK, { flip: true }); for (let k = 0; k < 4; k++) g.px(40 - k * 3, 14 + k, WHITE); },
  pounce: (g, A) => { paintSprite(g, A.cat.pounce[2], 18, 0, 0.8, RED); for (let k = 0; k < 7; k++) { const t = k / 7; g.px(2 + t * 18, 32 - Math.sin(t * Math.PI * 0.8) * 22, DARK); } },
  hide: (g, A) => { paintSprite(g, A.cat.idle[0], 6, 6, 0.85, RED); for (const d of [0, 5, 10]) g.line([20 + d, 8, 28 + d, 26], 1, WHITE); g.line([50, 4, 60, 30], 1.4, DARK); g.poly([[48.5, 1], [52, 6], [49.4, 6]], DARK); },
  river: (g, A) => { paintSprite(g, A.cat.walk[1], 6, 0, 0.8, RED); for (const y of [27, 32]) g.curve([[2, y], [10, y - 2], [18, y], [26, y - 2], [34, y], [42, y - 2], [50, y], [58, y - 2], [62, y]], 1, WHITE); },
  night: (g, A) => { g.ell(52, 9, 6, 6, WHITE); erase(g, (x, y) => (x - 55.5) ** 2 + (y - 6.5) ** 2 < 30); dots(g, [[40, 4], [44, 10], [34, 6], [60, 20], [30, 2]], WHITE); paintSprite(g, A.cat.stalk[3], 0, 10, 0.85, RED); },
  scavenger: (g, A) => { paintSprite(g, A.carcass.img, 30, 14, 0.75, DARK); paintSprite(g, A.cat.eat[2], 0, 4, 0.85, RED); },
  wind: (g, A) => { paintSprite(g, A.cat.run[1], 16, 4, 0.8, RED); const p = []; for (let k = 0; k <= 20; k++) { const a = k * 0.45, r = 1 + k * 0.42; p.push([8 + Math.cos(a) * r, 13 + Math.sin(a) * r]); } g.curve(p, 1, WHITE); },
  sense: (g, A) => { g.ell(14, 12, 11, 6, WHITE); g.ell(14, 12, 4, 4, RED); g.ell(14, 12, 1.5, 1.6, DARK); paintSprite(g, A.hunter[0].d.windup[2], 34, 0, 0.62, DARK, { flip: true }); for (let k = 0; k < 6; k++) g.px(30 - k * 3, 28, RED); },
  apex: (g, A) => { paintSprite(g, A.hunter[1].d.down[3], 26, 10, 0.62, DARK); paintSprite(g, A.cat.idle[2], 0, 2, 0.8, RED); },
  nose: (g, A) => { paintSprite(g, A.cat.idle[0], 0, 6, 0.85, RED); for (const [x, s] of [[52, 0], [57, 1], [62, 0]]) g.curve([[x, 32], [x - 2, 24 - s * 2], [x + 1, 16], [x - 2, 8]], 1, WHITE); },
  marathon: (g, A) => { for (let k = 0; k <= 14; k++) { const t = k / 14; g.px(4 + t * 56, 24 - Math.sin(t * Math.PI) * 20, DARK); } g.ell(32, 5, 3, 3, RED); paintSprite(g, A.cat.run[3], 14, 14, 0.62, RED); },
};
const PCACHE = new Map();
export function perkArt(id) {
  if (PCACHE.has(id)) return PCACHE.get(id);
  const g = new Pix(PW, PH);
  (PAINT[id] || PAINT.stride)(g, ART);
  const u = url(g);
  PCACHE.set(id, u);
  return u;
}
// A secret place painted the same way, from its landmark sprite.
export function secretArt(id) {
  const key = 'secret:' + id;
  if (PCACHE.has(key)) return PCACHE.get(key);
  const L = ART.landmarks[id];
  const img = L && (L.img || (L.frames && L.frames[0]));
  const g = new Pix(PW, PH);
  if (img) {
    const s = Math.min(1, (PW - 2) / img.width, (PH - 2) / img.height);
    const w = img.width * s, h = img.height * s;
    paintSprite(g, img, (PW - w) / 2, PH - 1 - h, s, RED, { wear: 0.1, seed: id.length });
  }
  const u = url(g);
  PCACHE.set(key, u);
  return u;
}

// ---------------------------------------------------------------- logo
// Hand-built capitals on a 3x4 grid: '#' full cell; a b c d half cells (a: top-left cut,
// b: top-right cut, c: bottom-left cut, d: bottom-right cut).
const LETTERS = {
  P: ['######b', '##...##', '##...##', '##...##', '######d', '##.....', '##.....', '##.....', '##.....'],
  R: ['######b', '##...##', '##...##', '##...##', '######d', '##.##..', '##..##.', '##...##', '##...##'],
  I: ['####', '.##.', '.##.', '.##.', '.##.', '.##.', '.##.', '.##.', '####'],
  M: ['##b...a##', '###b.a###', '##.###.##', '##..#..##', '##.....##', '##.....##', '##.....##', '##.....##', '##.....##'],
  A: ['a#####b', '##...##', '##...##', '##...##', '#######', '##...##', '##...##', '##...##', '##...##'],
  L: ['##....', '##....', '##....', '##....', '##....', '##....', '##....', '##....', '######'],
  C: ['a######', '##.....', '##.....', '##.....', '##.....', '##.....', '##.....', '##.....', 'c######'],
  H: ['##...##', '##...##', '##...##', '##...##', '#######', '##...##', '##...##', '##...##', '##...##'],
  S: ['a######', '##.....', '##.....', '##.....', 'c#####b', '.....##', '.....##', '.....##', '######d'],
  E: ['######', '##....', '##....', '##....', '#####.', '##....', '##....', '##....', '######'],
};
const CW = 3, CH = 4;
function letterMask(ch) {
  const rows = LETTERS[ch], w = rows[0].length * CW, h = rows.length * CH, m = new Uint8Array(w * h);
  rows.forEach((r, j) => [...r].forEach((k, i) => {
    if (k === '.') return;
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const u = (x + 0.5) / CW, v = (y + 0.5) / CH;
      const on = k === '#' || (k === 'a' && u + v >= 1) || (k === 'b' && v >= u) || (k === 'c' && v <= u) || (k === 'd' && u + v <= 1);
      if (on) m[(j * CH + y) * w + i * CW + x] = 1;
    }
  }));
  return { w, h, m };
}
let LOGO = null;
function buildLogoText() {
  const W = 340, H = 48, words = [['PRIMAL', 'bone'], ['CHASE', 'ochre']];
  const gap = 3, space = 10;
  const parts = [];
  let total = 0;
  words.forEach(([wd, tone], wi) => {
    if (wi) total += space;
    [...wd].forEach((ch, i) => { const L = letterMask(ch); if (i) total += gap; parts.push({ ...L, x: total, tone }); total += L.w; });
  });
  const x0 = Math.round((W - total) / 2), y0 = 4;
  const g = new Pix(W, H);
  const fills = { bone: ['bone1', 'bone1', 'bone', 'bone', 'bone', 'bone0'], ochre: ['ochre1', 'ochre1', 'ochre', 'ochre', 'ochre', 'ochreD'] };
  for (const L of parts) for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
    if (!L.m[y * L.w + x]) continue;
    const f = fills[L.tone], t = y / L.h;
    let k = Math.min(f.length - 1, Math.floor(t * f.length));
    // dithered steps between bands, and a little wear in the pigment
    if ((x + y) % 2 && (t * f.length) % 1 > 0.8 && k < f.length - 1) k++;
    let col = f[k];
    if (h2(x + L.x, y, 21) < 0.07) col = f[Math.min(f.length - 1, k + 1)];
    g.set(x0 + L.x + x, y0 + y, cid(col));
  }
  // claw cut: three raking slashes through CHASE
  const cx0 = x0 + parts.find((p) => p.tone === 'ochre').x;
  erase(g, (x, y) => {
    if (x < cx0 + 4 || x > W - 30) return false;
    for (let k = 0; k < 3; k++) { const d = (x - (cx0 + 22 + k * 9)) + (y - y0) * 0.55; if (d >= 0 && d < 2.2 && y > y0 + 3 && y < y0 + 33) return true; }
    return false;
  });
  g.bevel({ up: 1, down: 2, left: 1, right: 0, hi: 1, lo: 1 });
  g.outline({ col: 'uiInk', tint: false, corners: true });
  // a hard drop shadow, three pixels down
  const top = g.toCanvas(), out = canvas(W, H), ox = out.getContext('2d');
  const sh = canvas(W, H), sx = sh.getContext('2d');
  sx.drawImage(top, 0, 0); sx.globalCompositeOperation = 'source-in'; sx.fillStyle = '#0d0805'; sx.fillRect(0, 0, W, H);
  ox.drawImage(sh, 1, 3); ox.drawImage(sh, 0, 3);
  ox.drawImage(top, 0, 0);
  return out;
}
let SUN = null;
function buildSun() {
  const g = new Pix(64, 40);
  for (let y = 0; y < 40; y++) for (let x = 0; x < 64; x++) {
    const r = Math.hypot(x + 0.5 - 32, y + 0.5 - 34), ch = (x + y) % 2;
    let c = null;
    if (r < 13) c = r < 9 && y < 31 ? 'fire2' : 'fire1';
    else if (r < 15) c = ch ? 'fire1' : 'fire0';
    else if (r < 19) c = 'fire0';
    else if (r < 21) c = ch ? 'fire0' : null;
    else if (r < 25 && (x % 2 === 0 && y % 2 === 0)) c = 'ochre';
    if (c) g.set(x, y, cid(c));
  }
  return g.toCanvas();
}
const silCache = new Map();
function silhouette(img) {
  let s = silCache.get(img);
  if (!s) {
    s = canvas(img.width, img.height);
    const x = s.getContext('2d');
    x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#1a110c'; x.fillRect(0, 0, img.width, img.height);
    silCache.set(img, s);
  }
  return s;
}
// dusk: a band of sunset sky behind the horizon, for where the logo sits on black (the opening's last card)
export function drawLogo(c, t = 0, dusk = false) {
  const A = ART, x = c.getContext('2d');
  if (!LOGO) { LOGO = buildLogoText(); SUN = buildSun(); }
  x.imageSmoothingEnabled = false;
  x.clearRect(0, 0, c.width, c.height);
  if (dusk) {
    const bands = [['#5e1210', 74, 8], ['#8e1f1a', 80, 8], ['#c2562e', 87, 8], ['#ff6a1a', 94, 6], ['#ffb13b', 99, 5]];
    for (const [col, y, h] of bands) { x.fillStyle = col; const inset = Math.max(0, (86 - y)) * 2.2; x.fillRect(22 + inset, y, 296 - inset * 2, h); }
  }
  x.drawImage(SUN, 138, 70);
  // the horizon: a line of grass and the chase along it
  x.fillStyle = '#1a110c';
  x.fillRect(22, 104, 296, 2);
  for (let i = 0; i < 26; i++) { const gx = 26 + i * 11 + ((i * 7) % 5), hgt = 2 + ((i * 5) % 4); x.fillRect(gx, 104 - hgt, 1, hgt); x.fillRect(gx + 2, 104 - hgt + 1, 1, hgt - 1); }
  const cat = A.cat.run[Math.floor(t * 12) % A.cat.run.length];
  x.drawImage(silhouette(cat), 248 - A.cat.ox, 105 - A.cat.oy); // well right of the sun, which sits alone mid-horizon
  for (let i = 0; i < 3; i++) {
    const H = A.hunter[i % A.hunter.length], f = H.d.run[Math.floor(t * 10 + i * 3) % H.d.run.length];
    x.drawImage(silhouette(f), 52 + i * 22 - H.ox, 105 - H.oy + (i % 2));
  }
  x.drawImage(LOGO, 0, 6);
}

// ---------------------------------------------------------------- favicon
// The original game's icon, redrawn: the cat's head in three-quarter view, eyes narrowed, against
// a sunset sky over the savanna, in a wooden frame. Shapes scale by k (1 = 32px, 0.5 = 16px);
// the features that must land on exact pixels are placed per size afterwards.
function favScene(g, k) {
  const S = 32 * k;
  g.rect(0, 0, S, S, 'bark2');
  g.rect(1 * k, 1 * k, S - 2 * k, S - 2 * k, 'barkD');
  // sky: deep red down to gold, the sun low on the right
  const x0 = 2 * k, w = S - 4 * k;
  g.rect(x0, 2 * k, w, 8 * k, 'bloodD');
  g.rect(x0, 8 * k, w, 6 * k, 'blood');
  g.rect(x0, 13 * k, w, 6 * k, 'ochre');
  g.rect(x0, 18 * k, w, 8 * k, 'fire0');
  g.ell(27 * k, 22 * k, 9 * k, 6 * k, 'fire1');
  g.ell(27.5 * k, 23 * k, 4.5 * k, 3.5 * k, 'fire2');
  // ground and a far acacia
  g.rect(x0, 25 * k, w, 5 * k, 'bloodD');
  g.rect(x0, 27 * k, w, 3 * k, 'barkD');
  if (k === 1) { g.rect(26, 21.2, 4, 1.2, 'bloodD'); g.rect(27.6, 22, 0.9, 3.4, 'bloodD'); }
  // the head on its own layer so it gets a dark edge against the sky
  g.part((c) => {
    c.blob([[2 * k, 20 * k], [8 * k, 15 * k], [15 * k, 21 * k], [14 * k, 30 * k], [2 * k, 30 * k]], 'fur0', 0.4); // neck and shoulder
    c.ell(9 * k, 8.6 * k, 3.4 * k, 4.2 * k, 'fur1', -0.35); // near ear
    c.ell(9.3 * k, 9.3 * k, 1.8 * k, 2.6 * k, 'furD', -0.35);
    c.ell(21.6 * k, 7.2 * k, 2.4 * k, 2.8 * k, 'fur1', 0.3); // far ear
    c.blob([[8 * k, 13 * k], [11.5 * k, 7.5 * k], [18 * k, 6 * k], [23.5 * k, 8.5 * k], [25.5 * k, 13 * k], [26 * k, 19 * k], [24.5 * k, 23.5 * k], [20 * k, 25.5 * k], [13.5 * k, 23.5 * k], [9 * k, 19 * k]], 'fur2', 0.5);
    c.blob([[14 * k, 10 * k], [20.5 * k, 9 * k], [24.4 * k, 12.5 * k], [24.8 * k, 17 * k], [20 * k, 17.5 * k], [15 * k, 14.5 * k]], 'fur3', 0.5); // lit brow and bridge
    c.blob([[18.4 * k, 18.8 * k], [22 * k, 17.2 * k], [25.6 * k, 18.4 * k], [25.4 * k, 22.4 * k], [23.6 * k, 24.4 * k], [20 * k, 24.8 * k], [17.8 * k, 22.6 * k]], 'fur4', 0.5); // muzzle and chin
    c.blob([[9 * k, 13.5 * k], [11.5 * k, 12.5 * k], [13.5 * k, 19 * k], [14.5 * k, 23 * k], [10 * k, 20 * k]], 'fur1', 0.5); // cheek in shadow
    c.outline({ col: 'olFur', tint: false });
  });
  // frame last, so nothing spills over it
  g.rect(0, 0, S, 2 * k, 'bark2'); g.rect(0, S - 2 * k, S, 2 * k, 'bark2'); g.rect(0, 0, 2 * k, S, 'bark2'); g.rect(S - 2 * k, 0, 2 * k, S, 'bark2');
  if (k === 1) { g.rect(1, 1, 30, 1, 'bark3'); g.rect(1, 1, 1, 30, 'bark3'); g.rect(1, 30, 30, 1, 'barkD'); g.rect(30, 1, 1, 30, 'barkD'); }
}
export function favicon() {
  const big = new Pix(32, 32), small = new Pix(16, 16);
  favScene(big, 1);
  big.flush();
  const B = (x, y, c) => big.px(x + 0.5, y + 0.5, c);
  // narrowed eyes: a dark lid over a sliver of amber
  for (const [x, y] of [[14, 14], [15, 14], [16, 14], [17, 14], [18, 15]]) B(x, y, 'uiInk');
  B(15, 15, 'gold1'); B(16, 15, 'gold2'); B(17, 15, 'uiInk');
  for (const [x, y] of [[22, 13], [23, 13], [24, 13], [25, 14]]) B(x, y, 'uiInk');
  B(23, 14, 'gold1'); B(24, 14, 'uiInk');
  // tear lines down to the mouth
  for (const [x, y] of [[18, 16], [18, 17], [19, 18], [19, 19], [19, 20], [20, 21]]) B(x, y, 'spot');
  for (const [x, y] of [[25, 15], [25, 16], [25, 17]]) B(x, y, 'spot');
  // nose and mouth
  for (const [x, y] of [[22, 18], [23, 18], [24, 18], [25, 18], [23, 19], [24, 19]]) B(x, y, 'uiInk');
  B(22, 19, 'bloodD'); B(25, 19, 'bloodD');
  for (const [x, y] of [[23, 20], [23, 21], [22, 22], [21, 22], [24, 22], [25, 21]]) B(x, y, 'spot');
  // spots: crown, cheek, neck
  for (const [x, y] of [[12, 8], [15, 7], [18, 7], [13, 10], [16, 10], [20, 9], [10, 13], [11, 16], [12, 19], [14, 21], [15, 18], [16, 23], [22, 24], [20, 24], [4, 19], [6, 22], [9, 24], [4, 25], [12, 27], [7, 27]]) B(x, y, 'spot');
  for (const [x, y] of [[20, 20], [21, 21]]) B(x, y, 'fur3'); // whisker pad
  favScene(small, 0.5);
  small.flush();
  const M = (x, y, c) => small.px(x + 0.5, y + 0.5, c);
  for (const [x, y] of [[7, 7], [8, 7], [9, 7]]) M(x, y, 'uiInk');
  M(8, 8, 'gold1');
  M(11, 6, 'uiInk'); M(12, 7, 'uiInk'); M(11, 7, 'gold1');
  M(9, 8, 'spot'); M(9, 9, 'spot'); M(10, 10, 'spot'); M(12, 8, 'spot');
  M(11, 9, 'uiInk'); M(12, 9, 'uiInk'); M(11, 10, 'spot'); M(11, 11, 'spot');
  for (const [x, y] of [[6, 4], [8, 4], [7, 5], [5, 7], [6, 9], [7, 11], [2, 10], [3, 12], [5, 13]]) M(x, y, 'spot');
  const set = (id, c, size) => {
    let l = document.getElementById(id);
    if (!l) { l = document.createElement('link'); l.rel = 'icon'; l.id = id; document.head.appendChild(l); }
    l.type = 'image/png'; l.sizes = size; l.href = url(c);
  };
  set('favicon', big, '32x32');
  set('favicon16', small, '16x16');
  return { big, small };
}

// ---------------------------------------------------------------- numerals
// The bundled pixel face's 5 reads as an S, its 7 as a bracket, its 8 as an S. These ten digits
// are a TrueType font built here at load (5x7 grid, one cell = 0.1 em) and listed ahead of
// Pixelify Sans with unicode-range 0-9, so every number in the UI takes them and letters don't.
const DIGITS = {
  0: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  1: ['..#..', '.##..', '#.#..', '..#..', '..#..', '..#..', '#####'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '..#..', '..#..', '..#..'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
};
function buildNumeralFont() {
  const U = 100, ADV = 600;
  // each glyph: pixel runs merged into rectangles, one closed contour per rectangle
  const glyphs = [{ rects: [] }];
  for (let n = 0; n <= 9; n++) {
    const rows = DIGITS[n], rects = [];
    const open = new Map();
    rows.forEach((r, j) => {
      const runs = [];
      for (let i = 0; i < r.length;) { if (r[i] !== '#') { i++; continue; } let k = i; while (k < r.length && r[k] === '#') k++; runs.push([i, k]); i = k; }
      const seen = new Set();
      for (const [a, b] of runs) {
        const key = a + ',' + b;
        seen.add(key);
        if (open.has(key)) open.get(key).j1 = j; else open.set(key, { a, b, j0: j, j1: j });
      }
      for (const [key, R] of [...open]) if (!seen.has(key)) { rects.push(R); open.delete(key); }
    });
    rects.push(...open.values());
    glyphs.push({ rects: rects.map(({ a, b, j0, j1 }) => [a * U, (7 - j1 - 1) * U, b * U, (7 - j0) * U]) });
  }
  const bufs = [], u8 = (v) => [v & 255], u16 = (v) => [(v >> 8) & 255, v & 255], u32 = (v) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
  const i16 = (v) => u16(v < 0 ? v + 65536 : v);
  // glyf + loca
  const glyf = [], loca = [];
  let maxPts = 0, maxCont = 0;
  for (const G of glyphs) {
    loca.push(glyf.length);
    if (!G.rects.length) continue;
    const pts = [];
    for (const [x0, y0, x1, y1] of G.rects) pts.push([x0, y0], [x0, y1], [x1, y1], [x1, y0]);
    maxPts = Math.max(maxPts, pts.length); maxCont = Math.max(maxCont, G.rects.length);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    glyf.push(...i16(G.rects.length), ...i16(Math.min(...xs)), ...i16(Math.min(...ys)), ...i16(Math.max(...xs)), ...i16(Math.max(...ys)));
    G.rects.forEach((_, k) => glyf.push(...u16(k * 4 + 3)));
    glyf.push(...u16(0));
    for (let k = 0; k < pts.length; k++) glyf.push(1);
    let px = 0; for (const [x] of pts) { glyf.push(...i16(x - px)); px = x; }
    let py = 0; for (const [, y] of pts) { glyf.push(...i16(y - py)); py = y; }
    while (glyf.length % 4) glyf.push(0);
  }
  loca.push(glyf.length);
  const nG = glyphs.length;
  const T = {};
  T.head = [...u32(0x10000), ...u32(0x10000), ...u32(0), ...u32(0x5F0F3CF5), ...u16(0x000B), ...u16(1000), ...u32(0), ...u32(0), ...u32(0), ...u32(0),
    ...i16(0), ...i16(0), ...i16(500), ...i16(700), ...u16(0), ...u16(8), ...i16(2), ...i16(1), ...i16(0)];
  T.hhea = [...u32(0x10000), ...i16(800), ...i16(-200), ...i16(0), ...u16(ADV), ...i16(0), ...i16(100), ...i16(500), ...i16(1), ...i16(0), ...i16(0), 0, 0, 0, 0, 0, 0, 0, 0, ...i16(0), ...u16(nG)];
  T.maxp = [...u32(0x10000), ...u16(nG), ...u16(maxPts), ...u16(maxCont), ...u16(0), ...u16(0), ...u16(2), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u16(0)];
  T['OS/2'] = [...u16(4), ...i16(ADV), ...u16(400), ...u16(5), ...u16(0),
    ...i16(650), ...i16(600), ...i16(0), ...i16(75), ...i16(650), ...i16(600), ...i16(0), ...i16(350), ...i16(50), ...i16(300),
    ...i16(0), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...u32(1), ...u32(0), ...u32(0), ...u32(0), 78, 79, 78, 69,
    ...u16(0x40), ...u16(0x30), ...u16(0x39), ...i16(800), ...i16(-200), ...i16(0), ...u16(800), ...u16(200), ...u32(1), ...u32(0),
    ...i16(500), ...i16(700), ...u16(0), ...u16(0x20), ...u16(0)];
  T.hmtx = []; for (let k = 0; k < nG; k++) T.hmtx.push(...u16(ADV), ...i16(0));
  T.cmap = [...u16(0), ...u16(1), ...u16(3), ...u16(1), ...u32(12),
    ...u16(4), ...u16(32), ...u16(0), ...u16(4), ...u16(4), ...u16(1), ...u16(0),
    ...u16(0x39), ...u16(0xFFFF), ...u16(0), ...u16(0x30), ...u16(0xFFFF), ...u16((1 - 0x30) & 0xFFFF), ...u16(1), ...u16(0), ...u16(0)];
  const names = [[1, 'PC Numerals'], [2, 'Regular'], [4, 'PC Numerals'], [6, 'PCNumerals']];
  const strs = names.map(([, s]) => [...s].flatMap((ch) => u16(ch.charCodeAt(0))));
  T.name = [...u16(0), ...u16(names.length), ...u16(6 + 12 * names.length)];
  let off = 0;
  names.forEach(([id], k) => { T.name.push(...u16(3), ...u16(1), ...u16(0x409), ...u16(id), ...u16(strs[k].length), ...u16(off)); off += strs[k].length; });
  strs.forEach((s) => T.name.push(...s));
  T.post = [...u32(0x30000), ...u32(0), ...i16(-100), ...i16(50), ...u32(0), ...u32(0), ...u32(0), ...u32(0), ...u32(0)];
  T.glyf = glyf;
  T.loca = loca.flatMap((v) => u32(v));
  const tags = Object.keys(T).sort();
  const n = tags.length, es = Math.floor(Math.log2(n)), sr = (1 << es) * 16;
  const head = [...u32(0x10000), ...u16(n), ...u16(sr), ...u16(es), ...u16(n * 16 - sr)];
  let at = 12 + 16 * n;
  const body = [], recs = [];
  const sum = (a) => { let s = 0; for (let k = 0; k < a.length; k += 4) s = (s + ((a[k] << 24) | ((a[k + 1] || 0) << 16) | ((a[k + 2] || 0) << 8) | (a[k + 3] || 0))) >>> 0; return s; };
  let headAt = 0;
  for (const tag of tags) {
    const d = T[tag].slice(); const len = d.length;
    while (d.length % 4) d.push(0);
    if (tag === 'head') headAt = at;
    recs.push(...[...tag].map((ch) => ch.charCodeAt(0)), ...u32(sum(d)), ...u32(at), ...u32(len));
    body.push(...d); at += d.length;
  }
  const all = new Uint8Array([...head, ...recs, ...body]);
  const adj = (0xB1B0AFBA - sum(all)) >>> 0;
  all.set(u32(adj), headAt + 8);
  void bufs; void u8;
  return all.buffer;
}
function installNumerals() {
  try {
    const face = new FontFace('PC Numerals', buildNumeralFont(), { unicodeRange: 'U+30-39' });
    document.fonts.add(face);
    face.load().catch((e) => console.warn('numeral face rejected', e));
  } catch (e) { console.warn('numeral face failed', e); }
}

// ---------------------------------------------------------------- touch controls
function disc(r, { rim, face, faceHi, inner = null, pressed = false }) {
  const S = r * 2 + 2, g = new Pix(S, S);
  const c = r + 1;
  g.ell(c, c + (pressed ? 0.5 : 1), r, r, 'uiInk');
  g.ell(c, c, r - 0.2, r - 0.2 - (pressed ? 0 : 0.6), rim);
  g.ell(c, c + (pressed ? 0.6 : 0), r - 2.2, r - 2.2, face);
  if (faceHi) g.ell(c - r * 0.18, c - r * 0.22 + (pressed ? 0.6 : 0), r * 0.55, r * 0.42, faceHi);
  if (inner) inner(g, c, pressed ? 0.6 : 0);
  return g;
}
function lacingRing(g, c, r, n) { for (let k = 0; k < n; k++) { const a = (k / n) * TAU; g.px(c + Math.cos(a) * r, c + Math.sin(a) * r, 'sinew'); } }

// ---------------------------------------------------------------- animated stages
const STAGES = new Set();
let stageRaf = 0;
function stageLoop(now) {
  stageRaf = 0;
  for (const s of STAGES) {
    if (!s.c.isConnected || !s.c.offsetParent) { s.on = false; continue; }
    if (!s.on) { s.on = true; s.t0 = now; s.last = -1; }
    const t = (now - s.t0) / 1000, f = Math.floor(t * s.fps);
    if (f === s.last) continue;
    s.last = f;
    s.draw(s.x, reduceMotion() ? 0 : t);
  }
  if ([...STAGES].some((s) => s.c.offsetParent)) stageRaf = requestAnimationFrame(stageLoop);
}
export function stage(c, draw, fps = 12) {
  const s = { c, x: c.getContext('2d'), draw, fps, on: false };
  s.x.imageSmoothingEnabled = false;
  STAGES.add(s);
  return () => { if (!stageRaf) stageRaf = requestAnimationFrame(stageLoop); };
}
// draw sprite frame f of creature C (frames share C.ox/oy) with its anchor at (x, y)
export function spr(x, C, f, ax, ay, flip = false) {
  if (!f) return;
  if (!flip) { x.drawImage(f, Math.round(ax - C.ox), Math.round(ay - C.oy)); return; }
  x.save(); x.translate(Math.round(ax + C.ox), Math.round(ay - C.oy)); x.scale(-1, 1); x.drawImage(f, 0, 0); x.restore();
}

// ---------------------------------------------------------------- install
export function installUI(art) {
  const t0 = performance.now();
  ART = art;
  installNumerals();
  const T = { numerals: performance.now() - t0 };
  // one art pixel = a whole number of device pixels, about 2 CSS px
  const dpr = window.devicePixelRatio || 1;
  root.style.setProperty('--px', (Math.max(1, Math.round(2 * dpr)) / dpr) + 'px');
  css('--ui-panel', panelArt());
  css('--ui-frame', frameArt('wood'));
  css('--ui-frame-hot', frameArt('hot'));
  css('--ui-frame-gold', frameArt('gold'));
  css('--ui-frame-cool', frameArt('cool'));
  css('--ui-vellum', vellumArt(false));
  css('--ui-vellum-hi', vellumArt(true));
  css('--ui-banner', bannerArt());
  const wood = { face: 'wd2', hi: 'wd3', lo: 'wd1', lip: 'wd0', grain: 'wdG' };
  const woodHi = { face: 'wd3', hi: 'wd4', lo: 'wd2', lip: 'wd0', rim: 'sinew', grain: 'wd2' };
  const och = { face: '#b9502a', hi: 'ochre1', lo: 'ochreD', lip: '#5e2412', grain: '#a8462a' };
  const ochHi = { face: '#cf6034', hi: '#eb9a62', lo: 'ochreD', lip: '#5e2412', rim: '#ffe08a', grain: '#c25530' };
  css('--ui-btn', btnArt(wood));
  css('--ui-btn-hi', btnArt(woodHi));
  css('--ui-btn-dn', btnArt({ ...woodHi, pressed: true }));
  css('--ui-btn-p', btnArt(och));
  css('--ui-btn-p-hi', btnArt(ochHi));
  css('--ui-btn-p-dn', btnArt({ ...ochHi, pressed: true }));
  css('--ui-btn-on', btnArt({ ...wood, face: '#4a3020', rim: '#ffe08a', lash: '#ffe08a', lashLo: '#c89648' }));
  css('--ui-key', keyArt({ face: 'wd2', hi: 'wd3', lo: 'wd1', lip: 'wd0' }));
  css('--ui-key-hi', keyArt({ face: 'wd3', hi: 'wd4', lo: 'wd2', lip: 'wd0' }));
  css('--ui-key-dn', keyArt({ face: 'wd3', hi: 'wd4', lo: 'wd2', lip: 'wd0', pressed: true }));
  css('--ui-kbd', keyArt({ face: 'bone', hi: 'bone1', lo: 'bone0', lip: 'boneD' }));
  css('--ui-bar', barArt('wood'));
  css('--ui-bar-hot', barArt('hot'));
  css('--ui-bar-cool', barArt('cool'));
  css('--ui-fill-health', fillArt(['fur3', 'fur2', 'fur1', 'fur0']));
  css('--ui-fill-heat', fillArt(['fire1', 'fire0', 'fireD', 'emberD']));
  css('--ui-fill-water', fillArt(['foam', 'water2', 'water1', 'water0']));
  css('--ui-fill-food', fillArt(['#d8452e', 'blood1', 'blood', 'bloodD']));
  css('--ui-fill-danger', fillArt(['#ff7a52', 'danger', 'blood1', 'blood'], 5));
  // focus marker: a knapped flint point
  {
    const g = new Pix(8, 9);
    g.poly([[0.5, 0.5], [7.5, 4.5], [0.5, 8.5], [2.5, 4.5]], 'gold1');
    g.line([2, 3, 4.5, 4.5], 1, 'gold2');
    g.outline({ col: 'uiInk', tint: false });
    css('--ui-mark', g);
  }
  // divider: a band of rock-art dots and a little painted file of figures in the middle
  {
    const g = slab(24, 5, (x, y) => (y === 2 && x % 4 === 0 ? 'ochre' : y === 2 && x % 4 === 2 ? 'ochreD' : null));
    css('--ui-dots', g);
  }
  // settings: slider bead, track, checkbox
  {
    const g = new Pix(12, 12); g.ell(6, 6, 4.6, 4.6, 'bone'); g.ell(5.3, 5.2, 2.2, 2, 'bone1'); g.px(6, 6, 'boneD'); g.outline({ col: 'uiInk', tint: false });
    css('--ui-thumb', g);
    const box = (on) => {
      const b = slab(11, 11, (x, y) => {
        const d = Math.min(x, y, 10 - x, 10 - y);
        if ((x === 0 || x === 10) && (y === 0 || y === 10)) return null;
        return d === 0 ? 'uiInk' : d === 1 ? (y === 1 || x === 1 ? 'wd1' : 'wd3') : '#0e0906';
      });
      if (on) { b.line([2.6, 5.6, 4.6, 8, 8.6, 2.4], 1.6, 'ochre1'); }
      return b;
    };
    css('--ui-check', box(false));
    css('--ui-check-on', box(true));
  }
  // minimap ring: wood bound with sinew at the four quarters, a notch at north
  {
    const R = 37, S = 2 * R + 2, g = new Pix(S, S), c = R + 1;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const r = Math.hypot(x + 0.5 - c, y + 0.5 - c), a = Math.atan2(y + 0.5 - c, x + 0.5 - c);
      let col = null;
      if (r <= R && r > R - 1) col = 'uiInk';
      else if (r <= R - 1 && r > R - 2.4) col = a < 0 && a > -Math.PI * 0.9 ? 'wd4' : 'wd2';
      else if (r <= R - 2.4 && r > R - 5) col = h2(Math.round(a * 40), 0, 7) < 0.3 ? 'wdG' : 'wd3';
      else if (r <= R - 5 && r > R - 6) col = 'uiInk';
      if (col) {
        const q = ((a / TAU) * 8 + 8.5) % 2;
        if (r > R - 5 && r <= R - 1 && q > 0.8 && q < 1.2) col = (Math.round(r) % 2) ? 'sinew' : 'sinewD';
        g.set(x, y, cid(col));
      }
    }
    g.poly([[c - 2.5, 0.5], [c + 2.5, 0.5], [c, 4]], 'ochre1');
    css('--ui-ring', g);
  }
  // touch: a stretched-hide drum for the stick, a bone bead for the knob, two drum buttons
  css('--ui-stick', disc(27, { rim: 'wd2', face: 'hd2', inner: (g, c) => { lacingRing(g, c, 24.5, 24); g.ell(c, c, 15, 15, 'hd3'); g.ell(c, c, 14, 14, 'hd2'); } }));
  css('--ui-knob', disc(12, { rim: 'bone0', face: 'bone', faceHi: 'bone1' }));
  const stalk = (p) => disc(16, { rim: 'wd2', face: 'hd3', pressed: p, inner: (g, c, o) => lacingRing(g, c + o * 0, 14, 14) });
  const pounce = (p) => disc(23, { rim: 'ochreD', face: p ? '#cf6034' : '#b9502a', faceHi: p ? '#eb9a62' : 'ochre1', pressed: p, inner: (g, c) => lacingRing(g, c, 21, 20) });
  css('--ui-stalk', stalk(false)); css('--ui-stalk-dn', stalk(true));
  css('--ui-pounce', pounce(false)); css('--ui-pounce-dn', pounce(true));
  T.kit = performance.now() - t0 - T.numerals;
  // icons the stylesheet places itself
  for (const n of ['sun', 'moon', 'dawn', 'dusk', 'rain', 'storm', 'fog', 'dust', 'heatwave', 'map', 'pause', 'paw', 'hand', 'claws', 'scroll', 'sliders', 'arrowL', 'spearhead', 'broken', 'swirl', 'copy', 'hut', 'prints', 'eye', 'wave', 'cliff', 'secret', 'spark', 'lion', 'spear', 'cathead', 'hunterhead', 'scent'])
    css('--ic-' + n, icon(n));
  for (const n of ['heat', 'water', 'food', 'health', 'hunter']) css('--ic-' + n, art.icons[n]);
  T.icons = performance.now() - t0 - T.numerals - T.kit;
  favicon();
  T.favicon = performance.now() - t0 - T.numerals - T.kit - T.icons;
  return { ms: performance.now() - t0, parts: T };
}

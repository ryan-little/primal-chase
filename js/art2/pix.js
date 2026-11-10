// Pix: the drawing surface every redrawn sprite is built on.
//
// Shapes are drawn as flat palette colors on a supersampled scratch canvas, then resolved to
// art pixels by majority vote: a pixel is filled when at least `cut` of it is covered, and it
// takes the color that covers most of it. No alpha threshold mud, no off-palette blends, and a
// shape that moves by a fraction of a pixel between frames changes its edge cleanly.
//
// On top of that sit pixel-exact operations (px, pline), ramp-aware shading passes (bevel, tone,
// remap), part compositing with a contact line, and a tinted outline.
//
// Coordinates: the origin is the sprite's anchor (usually where it touches the ground), x right,
// y down. A point (x, y) lies in the pixel floor(x), floor(y); use .5 for pixel centers.
import { P2, RAMPS, rampVersion } from './pal.js';

const TAU = Math.PI * 2;

// ---------- color registry ----------
const IDS = new Map(); // hex -> id
const RGB = [null]; // id -> [r, g, b]
const HEXS = [null];
let HOME = [null]; // id -> { ids, i, ol }
let homeVer = -1;

export function cid(c) {
  if (typeof c === 'number') return c;
  const hex = P2[c] || c;
  let id = IDS.get(hex);
  if (!id) {
    if (typeof hex !== 'string' || hex[0] !== '#') throw new Error('unknown color: ' + c);
    const n = parseInt(hex.slice(1), 16);
    id = RGB.length;
    RGB.push([(n >> 16) & 255, (n >> 8) & 255, n & 255]);
    HEXS.push(hex);
    IDS.set(hex, id);
  }
  return id;
}
function homes() {
  if (homeVer === rampVersion) return HOME;
  HOME = [null];
  for (const name in RAMPS) {
    const { keys, ol } = RAMPS[name];
    const ids = keys.map(cid), olId = cid(ol);
    ids.forEach((id, i) => { if (!HOME[id]) HOME[id] = { ids, i, ol: olId, name }; });
  }
  homeVer = rampVersion;
  return HOME;
}
// Move a color d steps along its ramp (positive = lighter). Colors in no ramp stay put.
export function shiftId(id, d) {
  const h = homes()[id];
  if (!h || !d) return id;
  return h.ids[Math.max(0, Math.min(h.ids.length - 1, h.i + d))];
}
export const hexOf = (id) => HEXS[id];

// ---------- shared supersample scratch ----------
let SC = null, SX = null, OWNER = null;
function scratch(w, h) {
  if (!SC || SC.width < w || SC.height < h) {
    const nw = Math.max(w, SC ? SC.width : 0, 512), nh = Math.max(h, SC ? SC.height : 0, 512);
    SC = document.createElement('canvas');
    SC.width = nw; SC.height = nh;
    SX = SC.getContext('2d', { willReadFrequently: true });
  }
  return SX;
}

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export class Pix {
  // w, h: size in art pixels. ax, ay: where the origin sits inside it. ss: supersample factor.
  constructor(w, h, ax = 0, ay = 0, { ss = 4, cut = 0.5 } = {}) {
    this.w = w; this.h = h; this.ax = ax; this.ay = ay; this.ss = ss; this.cut = cut;
    this.buf = new Uint16Array(w * h);
    this.pending = false;
    this.used = new Set();
    this.stack = [];
    this.m = [1, 0, 0, 1, 0, 0]; // current local transform (art space, before the anchor offset)
    this.bb = [1e9, 1e9, -1e9, -1e9];
  }

  // ----- transform -----
  push(x = 0, y = 0, rot = 0, sx = 1, sy = sx) {
    this.stack.push(this.m.slice());
    const [a, b, c, d, e, f] = this.m;
    const cs = Math.cos(rot), sn = Math.sin(rot);
    // m = m * T(x,y) * R(rot) * S(sx,sy)
    const na = (a * cs + c * sn) * sx, nb = (b * cs + d * sn) * sx;
    const nc = (-a * sn + c * cs) * sy, nd = (-b * sn + d * cs) * sy;
    this.m = [na, nb, nc, nd, a * x + c * y + e, b * x + d * y + f];
    if (OWNER === this) this._apply();
    return this;
  }
  pop() { this.m = this.stack.pop(); if (OWNER === this) this._apply(); return this; }
  // local point -> sprite (anchor-relative) point
  pt(x, y) { const m = this.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
  _apply() {
    const s = this.ss, m = this.m;
    SX.setTransform(m[0] * s, m[1] * s, m[2] * s, m[3] * s, (m[4] + this.ax) * s, (m[5] + this.ay) * s);
  }
  _own() {
    if (OWNER !== this) {
      if (OWNER) OWNER.flush();
      scratch(this.w * this.ss, this.h * this.ss);
      OWNER = this;
    }
    this._apply();
    return SX;
  }
  _mark(x0, y0, x1, y1, col) {
    const p = [this.pt(x0, y0), this.pt(x1, y0), this.pt(x0, y1), this.pt(x1, y1)];
    const bb = this.bb;
    for (const [x, y] of p) {
      if (x < bb[0]) bb[0] = x; if (y < bb[1]) bb[1] = y;
      if (x > bb[2]) bb[2] = x; if (y > bb[3]) bb[3] = y;
    }
    this.pending = true;
    const id = cid(col);
    this.used.add(id);
    const [r, g, b] = RGB[id];
    return `rgb(${r},${g},${b})`;
  }

  // ----- vector shapes (supersampled) -----
  ell(cx, cy, rx, ry, col, rot = 0) {
    const x = this._own();
    rx = Math.max(0.3, rx); ry = Math.max(0.3, ry);
    const R = Math.max(rx, ry);
    x.fillStyle = this._mark(cx - R, cy - R, cx + R, cy + R, col);
    x.beginPath(); x.ellipse(cx, cy, rx, ry, rot, 0, TAU); x.fill();
    return this;
  }
  poly(pts, col) {
    const x = this._own();
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [a, b] of pts) { x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, a); y1 = Math.max(y1, b); }
    x.fillStyle = this._mark(x0, y0, x1, y1, col);
    x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]);
    x.closePath(); x.fill();
    return this;
  }
  rect(x0, y0, w, h, col) { return this.poly([[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]], col); }
  // Closed smooth shape through the points (Catmull-Rom). k: 0 = polygon, 0.5 = round.
  blob(pts, col, k = 0.5) {
    const x = this._own(), n = pts.length;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [a, b] of pts) { x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, a); y1 = Math.max(y1, b); }
    x.fillStyle = this._mark(x0 - 2, y0 - 2, x1 + 2, y1 + 2, col);
    x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const t = k / 1.5;
      x.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t,
        p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t, p2[0], p2[1]);
    }
    x.closePath(); x.fill();
    return this;
  }
  // Straight stroke through points given flat: [x0, y0, x1, y1, ...]
  line(pts, w, col) {
    const x = this._own();
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < pts.length; i += 2) { x0 = Math.min(x0, pts[i]); y0 = Math.min(y0, pts[i + 1]); x1 = Math.max(x1, pts[i]); y1 = Math.max(y1, pts[i + 1]); }
    x.strokeStyle = this._mark(x0 - w, y0 - w, x1 + w, y1 + w, col);
    x.lineWidth = w; x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath(); x.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]);
    x.stroke();
    return this;
  }
  // Smooth open stroke through [[x, y], ...]
  curve(pts, w, col, k = 0.5) {
    const x = this._own(), n = pts.length;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [a, b] of pts) { x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, a); y1 = Math.max(y1, b); }
    x.strokeStyle = this._mark(x0 - w - 2, y0 - w - 2, x1 + w + 2, y1 + w + 2, col);
    x.lineWidth = w; x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
      const t = k / 1.5;
      x.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t,
        p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t, p2[0], p2[1]);
    }
    x.stroke();
    return this;
  }
  // Tapered capsule from (x0, y0) width w0 to (x1, y1) width w1.
  limb(x0, y0, x1, y1, w0, w1, col) {
    const x = this._own();
    const R = Math.max(w0, w1) / 2 + 0.5;
    x.fillStyle = this._mark(Math.min(x0, x1) - R, Math.min(y0, y1) - R, Math.max(x0, x1) + R, Math.max(y0, y1) + R, col);
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1e-6;
    const nx = -dy / L, ny = dx / L, r0 = Math.max(0.25, w0 / 2), r1 = Math.max(0.25, w1 / 2);
    x.beginPath();
    x.moveTo(x0 + nx * r0, y0 + ny * r0); x.lineTo(x1 + nx * r1, y1 + ny * r1);
    x.lineTo(x1 - nx * r1, y1 - ny * r1); x.lineTo(x0 - nx * r0, y0 - ny * r0);
    x.closePath(); x.fill();
    x.beginPath(); x.arc(x0, y0, r0, 0, TAU); x.fill();
    x.beginPath(); x.arc(x1, y1, r1, 0, TAU); x.fill();
    return this;
  }
  // Tapered chain through [[x, y, width], ...]
  chain(pts, col) {
    for (let i = 0; i < pts.length - 1; i++) this.limb(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], pts[i][2], pts[i + 1][2], col);
    return this;
  }
  arc(cx, cy, r, a0, a1, w, col) {
    const x = this._own();
    x.strokeStyle = this._mark(cx - r - w, cy - r - w, cx + r + w, cy + r + w, col);
    x.lineWidth = w; x.lineCap = 'round';
    x.beginPath(); x.arc(cx, cy, r, a0, a1); x.stroke();
    return this;
  }

  // Resolve the supersampled drawing into art pixels.
  flush() {
    if (!this.pending) return this;
    this.pending = false;
    const { w, h, ss, bb } = this;
    const x0 = Math.max(0, Math.floor(bb[0] + this.ax) - 1), y0 = Math.max(0, Math.floor(bb[1] + this.ay) - 1);
    const x1 = Math.min(w, Math.ceil(bb[2] + this.ax) + 1), y1 = Math.min(h, Math.ceil(bb[3] + this.ay) + 1);
    // wipe everything this batch drew, including what spilled past the stage, so nothing leaks into the next sprite
    const wipe = () => {
      const a = Math.max(0, Math.floor((bb[0] + this.ax) * ss) - 2 * ss), b = Math.max(0, Math.floor((bb[1] + this.ay) * ss) - 2 * ss);
      SX.clearRect(a, b, Math.ceil((bb[2] + this.ax) * ss) + 2 * ss - a, Math.ceil((bb[3] + this.ay) * ss) + 2 * ss - b);
    };
    const used = [...this.used];
    this.used.clear();
    SX.setTransform(1, 0, 0, 1, 0, 0);
    if (x1 <= x0 || y1 <= y0) { wipe(); this.bb = [1e9, 1e9, -1e9, -1e9]; return this; }
    const rw = (x1 - x0) * ss, rh = (y1 - y0) * ss;
    const d = SX.getImageData(x0 * ss, y0 * ss, rw, rh).data;
    wipe(); this.bb = [1e9, 1e9, -1e9, -1e9];
    const need = Math.ceil(this.cut * ss * ss);
    const cache = new Map();
    const tid = new Int32Array(8), tct = new Int32Array(8);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        let cov = 0, nt = 0;
        for (let sy = 0; sy < ss; sy++) {
          let o = (((y - y0) * ss + sy) * rw + (x - x0) * ss) * 4;
          for (let sx = 0; sx < ss; sx++, o += 4) {
            if (d[o + 3] < 128) continue;
            cov++;
            const key = (d[o] << 16) | (d[o + 1] << 8) | d[o + 2];
            let id = cache.get(key);
            if (id === undefined) {
              let bd = 1e9;
              for (const u of used) {
                const c = RGB[u];
                const dd = (c[0] - d[o]) ** 2 + (c[1] - d[o + 1]) ** 2 + (c[2] - d[o + 2]) ** 2;
                if (dd < bd) { bd = dd; id = u; }
              }
              cache.set(key, id);
            }
            let k = 0;
            for (; k < nt; k++) if (tid[k] === id) { tct[k]++; break; }
            if (k === nt && nt < 8) { tid[nt] = id; tct[nt] = 1; nt++; }
          }
        }
        if (cov < need) continue;
        let best = 0;
        for (let k = 1; k < nt; k++) if (tct[k] > tct[best]) best = k;
        this.buf[y * w + x] = tid[best];
      }
    }
    return this;
  }

  // ----- pixel-exact operations -----
  _ij(x, y) { const [X, Y] = this.pt(x, y); return [Math.floor(X + this.ax), Math.floor(Y + this.ay)]; }
  set(i, j, id) { if (i >= 0 && j >= 0 && i < this.w && j < this.h) this.buf[j * this.w + i] = id; }
  at(i, j) { return i >= 0 && j >= 0 && i < this.w && j < this.h ? this.buf[j * this.w + i] : 0; }
  // color key at a sprite-space point (or null)
  get(x, y) { this.flush(); const [i, j] = this._ij(x, y); const id = this.at(i, j); return id ? HEXS[id] : null; }
  // Fill the pixel containing (x, y). `onlyOn`: only if something is already there.
  px(x, y, col, onlyOn = false) {
    this.flush();
    const [i, j] = this._ij(x, y);
    if (onlyOn && !this.at(i, j)) return this;
    this.set(i, j, cid(col));
    return this;
  }
  pline(x0, y0, x1, y1, col, onlyOn = false) {
    this.flush();
    let [i0, j0] = this._ij(x0, y0);
    const [i1, j1] = this._ij(x1, y1), id = cid(col);
    const dx = Math.abs(i1 - i0), dy = -Math.abs(j1 - j0), sx = i0 < i1 ? 1 : -1, sy = j0 < j1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (!onlyOn || this.at(i0, j0)) this.set(i0, j0, id);
      if (i0 === i1 && j0 === j1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; i0 += sx; }
      if (e2 <= dx) { err += dx; j0 += sy; }
    }
    return this;
  }
  // Stamp hand-placed pixels. rows: strings, one char per pixel; legend: char -> color ('.' and ' ' are empty).
  // (x, y) is where the bitmap's own anchor pixel (ax, ay) lands. flip mirrors it around that pixel.
  stamp(x, y, rows, legend, { ax = 0, ay = 0, flip = false } = {}) {
    this.flush();
    const [i0, j0] = this._ij(x, y);
    for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) {
      const ch = rows[r][c];
      if (ch === '.' || ch === ' ') continue;
      const col = legend[ch];
      if (col === undefined) throw new Error('stamp: no legend for "' + ch + '"');
      this.set(i0 + (flip ? ax - c : c - ax), j0 + r - ay, cid(col));
    }
    return this;
  }
  // Shift the pixel at (x, y) d steps along its ramp.
  nudge(x, y, d) {
    this.flush();
    const [i, j] = this._ij(x, y), id = this.at(i, j);
    if (id) this.set(i, j, shiftId(id, d));
    return this;
  }

  // ----- shading passes -----
  // Light the edges that face up (and left), darken the ones that face down (and right).
  // up/down/left/right: how many pixels deep each band is. hi/lo: ramp steps.
  bevel({ up = 1, down = 1, left = 0, right = 0, hi = 1, lo = 1, only = null } = {}) {
    this.flush();
    const { w, h, buf } = this, src = buf.slice();
    const open = (i, j) => i < 0 || j < 0 || i >= w || j >= h || !src[j * w + i];
    const onlyIds = only && new Set(only.map(cid));
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const id = src[j * w + i];
      if (!id || (onlyIds && !onlyIds.has(id))) continue;
      let lit = false, dark = false;
      for (let k = 1; k <= up && !lit; k++) lit = open(i, j - k);
      for (let k = 1; k <= left && !lit; k++) lit = open(i - k, j);
      for (let k = 1; k <= down && !dark; k++) dark = open(i, j + k);
      for (let k = 1; k <= right && !dark; k++) dark = open(i + k, j);
      if (lit && !dark) buf[j * w + i] = shiftId(id, hi);
      else if (dark && !lit) buf[j * w + i] = shiftId(id, -lo);
    }
    return this;
  }
  // fn(x, y, hex) -> ramp steps to shift (0/undefined = leave). x, y are pixel centers in sprite space.
  tone(fn) {
    this.flush();
    const { w, h, buf } = this;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const id = buf[j * w + i];
      if (!id) continue;
      const d = fn(i + 0.5 - this.ax, j + 0.5 - this.ay, HEXS[id]);
      if (d) buf[j * w + i] = shiftId(id, d | 0);
    }
    return this;
  }
  // fn(x, y, hex) -> new color (key or hex), null to erase, undefined to keep.
  remap(fn) {
    this.flush();
    const { w, h, buf } = this;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const id = buf[j * w + i];
      if (!id) continue;
      const c = fn(i + 0.5 - this.ax, j + 0.5 - this.ay, HEXS[id]);
      if (c === null) buf[j * w + i] = 0;
      else if (c !== undefined) buf[j * w + i] = cid(c);
    }
    return this;
  }
  // Shift everything inside an ellipse d ramp steps (form shadow / highlight that respects markings).
  glow(cx, cy, rx, ry, d) {
    return this.tone((x, y) => (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 ? d : 0));
  }

  // ----- parts -----
  // Draw a part on its own layer, then lay it over this one. sep: darken the pixels of this layer
  // that touch the part's edge by that many ramp steps (the contact line between leg and body).
  part(fn, { sep = 0, sepSides = 'all' } = {}) {
    this.flush();
    const c = new Pix(this.w, this.h, this.ax, this.ay, { ss: this.ss, cut: this.cut });
    c.m = this.m.slice();
    fn(c);
    c.flush();
    return this.over(c, { sep, sepSides });
  }
  over(c, { sep = 0, sepSides = 'all', dx = 0, dy = 0 } = {}) {
    this.flush(); c.flush();
    const { w, h, buf } = this;
    const has = (i, j) => i >= 0 && j >= 0 && i < c.w && j < c.h && c.buf[j * c.w + i];
    if (sep) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const id = buf[j * w + i], ci = i - dx, cj = j - dy;
        if (!id || has(ci, cj)) continue;
        const l = has(ci + 1, cj), r = has(ci - 1, cj), u = has(ci, cj + 1), dn = has(ci, cj - 1);
        const hit = sepSides === 'all' ? (l || r || u || dn) : sepSides === 'sides' ? (l || r) : sepSides === 'back' ? l : sepSides === 'front' ? r : (l || r || u || dn);
        if (hit) buf[j * w + i] = shiftId(id, -sep);
      }
    }
    for (let j = 0; j < c.h; j++) for (let i = 0; i < c.w; i++) {
      const id = c.buf[j * c.w + i];
      if (id) this.set(i + dx, j + dy, id);
    }
    return this;
  }

  // ----- finishing -----
  // 1px outline. tint: color it from the ramp of the pixel it hugs (dark, hue-shifted ink).
  outline({ col = 'ink', tint = true, corners = false } = {}) {
    this.flush();
    const { w, h, buf } = this, src = buf.slice(), H = homes(), ink = cid(col);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (src[j * w + i]) continue;
      let n = 0;
      if (j + 1 < h && src[(j + 1) * w + i]) n = src[(j + 1) * w + i];
      else if (i + 1 < w && src[j * w + i + 1]) n = src[j * w + i + 1];
      else if (i > 0 && src[j * w + i - 1]) n = src[j * w + i - 1];
      else if (j > 0 && src[(j - 1) * w + i]) n = src[(j - 1) * w + i];
      else if (corners) {
        for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
          const ii = i + a, jj = j + b;
          if (ii >= 0 && jj >= 0 && ii < w && jj < h && src[jj * w + ii]) { n = src[jj * w + ii]; break; }
        }
      }
      if (!n) continue;
      buf[j * w + i] = tint && H[n] ? H[n].ol : ink;
    }
    return this;
  }
  bounds() {
    this.flush();
    const { w, h, buf } = this;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (buf[j * w + i]) {
      if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j;
    }
    return x1 < 0 ? null : [x0, y0, x1, y1];
  }
  toCanvas(x0 = 0, y0 = 0, cw = this.w, ch = this.h) {
    this.flush();
    const c = canvas(cw, ch), x = c.getContext('2d');
    const img = x.createImageData(cw, ch), d = img.data, { w, h, buf } = this;
    for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
      const si = i + x0, sj = j + y0;
      if (si < 0 || sj < 0 || si >= w || sj >= h) continue;
      const id = buf[sj * w + si];
      if (!id) continue;
      const o = (j * cw + i) * 4, c3 = RGB[id];
      d[o] = c3[0]; d[o + 1] = c3[1]; d[o + 2] = c3[2]; d[o + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  }
}

// Crop a set of frames ({ name: [Pix, ...] }) to the union of their pixels (+1px clear margin),
// so nothing is cut off and every frame of a creature shares one anchor.
// Returns { w, h, ox, oy, name: [canvas, ...] }.
export function cropFrames(groups, { symmetric = false } = {}) {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, any = null;
  for (const g in groups) for (const p of groups[g]) {
    const b = p.bounds();
    any = any || p;
    if (!b) continue;
    if (b[0] === 0 || b[1] === 0 || b[2] === p.w - 1 || b[3] === p.h - 1) console.warn('sprite hit its stage edge:', g, p.w, p.h);
    x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]);
  }
  if (x1 < 0) { x0 = y0 = 0; x1 = y1 = 0; }
  x0--; y0--; x1++; y1++;
  if (symmetric) { const half = Math.max(any.ax - x0, x1 + 1 - any.ax); x0 = any.ax - half; x1 = any.ax + half - 1; }
  y1 = Math.max(y1, any.ay); // keep the anchor row inside the frame
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const out = { w, h, ox: any.ax - x0, oy: any.ay - y0 };
  for (const g in groups) out[g] = groups[g].map((p) => p.toCanvas(x0, y0, w, h));
  return out;
}

// One still sprite -> { img, ox, oy, ...def }, cropped symmetric around the anchor so flips mirror in place.
export function cropOne(p, def = {}) {
  const f = cropFrames({ a: [p] }, { symmetric: true });
  return { img: f.a[0], ox: f.ox, oy: f.oy, ...def };
}
// Several frames of one prop (sway) -> { img: frames[0], frames, ox, oy, ...def }
export function cropAnim(list, def = {}) {
  const f = cropFrames({ a: list }, { symmetric: true });
  return { img: f.a[0], frames: f.a, ox: f.ox, oy: f.oy, ...def };
}

// ---------- small math helpers shared by the rigs ----------
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const ease = (t) => (1 - Math.cos(clamp(t, 0, 1) * Math.PI)) / 2;
// Periodic keyframes: keys = [[t, v...], ...] with t in 0..1 ascending; smooth (cosine) between, wraps.
export function keyed(keys, t) {
  t = ((t % 1) + 1) % 1;
  const n = keys.length;
  let i = n - 1;
  for (let k = 0; k < n; k++) if (keys[k][0] <= t) i = k;
  const a = keys[i], b = keys[(i + 1) % n];
  let span = b[0] - a[0]; if (span <= 0) span += 1;
  let u = t - a[0]; if (u < 0) u += 1;
  const s = ease(u / span);
  if (a.length === 2) return a[1] + (b[1] - a[1]) * s;
  return a.slice(1).map((v, k) => v + (b[k + 1] - v) * s);
}
// Two-bone IK: joint between (ax, ay) and target (tx, ty) for bone lengths l1, l2.
// bend = +1 puts the joint on the +x side of the line when the limb points down, -1 on the -x side.
export function ik(ax, ay, tx, ty, l1, l2, bend) {
  let dx = tx - ax, dy = ty - ay, d = Math.hypot(dx, dy) || 1e-6;
  const max = l1 + l2 - 0.01, min = Math.abs(l1 - l2) + 0.01;
  if (d > max) { tx = ax + dx / d * max; ty = ay + dy / d * max; dx = tx - ax; dy = ty - ay; d = max; }
  if (d < min) d = min;
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const mx = ax + dx / d * a, my = ay + dy / d * a;
  // perpendicular: for a limb pointing down (dy > 0), (dy, -dx)/d points toward +x
  const jx = mx + (dy / d) * hh * bend, jy = my - (dx / d) * hh * bend;
  return [jx, jy, tx, ty];
}
export { TAU };

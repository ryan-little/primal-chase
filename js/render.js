// Draws the world at a low internal resolution (crisp pixels, scaled up by CSS),
// then grades it with a light map: warm dawns, white noon, blue nights lit by torches.

import { CHUNK, G } from './world.js';
import { drawText } from './font.js';
import { P } from './palette.js';
import { clamp, lerp, TAU, dist, hash2 } from './util.js';
import { canvas } from './art.js';
import { Presenter } from './present.js';

const SKY = [
  // clock, r, g, b
  [0.0, 84, 94, 152],
  [0.025, 160, 130, 165],
  [0.05, 255, 190, 160],
  [0.1, 255, 236, 214],
  [0.3, 255, 255, 246],
  [0.55, 255, 240, 214],
  [0.625, 255, 206, 160],
  [0.665, 210, 150, 160],
  [0.7, 104, 108, 168],
  [0.75, 78, 88, 150],
  [0.95, 76, 86, 146],
  [1.0, 84, 94, 152],
];

function skyAt(c) {
  for (let i = 0; i < SKY.length - 1; i++) {
    const a = SKY[i], b = SKY[i + 1];
    if (c >= a[0] && c <= b[0]) {
      const t = (c - a[0]) / (b[0] - a[0]);
      return [lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)];
    }
  }
  return [255, 255, 255];
}

const TALL_PROPS = new Set(['acacia', 'umbrella', 'baobab', 'kopje', 'mopane', 'marula', 'fig', 'quiver', 'candelabra', 'mangrove', 'fever', 'palm', 'deadtree', 'charred', 'landmark']);

export class Renderer {
  static cpuBuffer = new URLSearchParams(location.search).has('cpu');
  constructor(el, art) {
    this.el = el;
    this.art = art;
    this.cv = el;
    this.presenter = new Presenter(el);
    this.buf = canvas(10, 10);
    this.ctx = this.buf.getContext('2d', { alpha: false, willReadFrequently: Renderer.cpuBuffer });
    this.light = canvas(10, 10);
    this.lctx = this.light.getContext('2d');
    this.cam = { x: 0, y: 0, shake: 0, zoomT: 0 };
    this.parts = [];
    this.pops = [];
    this.rainDrops = [];
    this.dustMotes = [];
    this.flashT = 0;
    this.hurtT = 0;
    this.reducedMotion = false;
    this.resize();
  }

  resize() {
    const W = window.innerWidth, H = window.innerHeight;
    const portrait = H > W;
    const target = portrait ? 300 : 270;
    this.scale = Math.max(2, Math.round(Math.min(H / target, W / (portrait ? 190 : 400))));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.S = this.scale * dpr; // device pixels per art pixel
    this.viewW = W / this.scale; // visible art pixels
    this.viewH = H / this.scale;
    // the art buffer: one pixel of margin so a sub-pixel camera never shows an edge
    this.w = Math.ceil(this.viewW) + 2;
    this.h = Math.ceil(this.viewH) + 2;
    this.buf.width = this.w;
    this.buf.height = this.h;
    this.cv.width = Math.round(W * dpr);
    this.cv.height = Math.round(H * dpr);
    this.cv.style.width = W + 'px';
    this.cv.style.height = H + 'px';
    this.light.width = this.w;
    this.light.height = this.h;
    this.ctx.imageSmoothingEnabled = false;
  }

  shake(a) {
    if (!this.reducedMotion) this.cam.shake = Math.max(this.cam.shake, a);
  }

  pop(text, x, y, color = '#fff') {
    const recent = this.pops.filter((q) => q.t < 0.6 && Math.abs(q.x - x) < 60 && Math.abs(q.y - y) < 30).length;
    this.pops.push({ text, x, y: y - recent * 10, t: 0, color });
  }

  burst(kind, x, y, n = 8, extra = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const s = Math.random();
      let p;
      if (kind === 'dust') p = { x, y, z: 1, vx: Math.cos(a) * 12 * s + (extra.vx || 0), vy: Math.sin(a) * 5 * s, vz: 8 + s * 10, life: 0.5 + s * 0.4, col: extra.col || P.sand3, size: 2, grav: -2, drag: 3 };
      else if (kind === 'splash') p = { x, y, z: 1, vx: Math.cos(a) * 30 * s, vy: Math.sin(a) * 14 * s, vz: 40 + s * 40, life: 0.6, col: s < 0.5 ? P.foam : P.water2, size: 1, grav: 160, drag: 1 };
      else if (kind === 'blood') p = { x, y, z: 6, vx: Math.cos(a) * 40 * s, vy: Math.sin(a) * 20 * s, vz: 30 + s * 40, life: 0.7, col: s < 0.5 ? P.blood : P.blood1, size: 1, grav: 150, drag: 2, stain: true };
      else if (kind === 'ember') p = { x: x + (Math.random() - 0.5) * 3, y, z: extra.z || 38, vx: (Math.random() - 0.5) * 8, vy: 0, vz: 14 + s * 16, life: 0.4 + s * 0.4, col: s < 0.4 ? P.fire2 : s < 0.8 ? P.fire1 : P.fire0, size: 1, grav: -10, drag: 1 };
      else if (kind === 'spark') p = { x, y, z: 4, vx: Math.cos(a) * 70 * s, vy: Math.sin(a) * 35 * s, vz: 20 + s * 30, life: 0.35, col: extra.col || P.hint, size: 1, grav: 60, drag: 3 };
      else if (kind === 'sweat') p = { x: x + (Math.random() - 0.5) * 8, y, z: 18, vx: (Math.random() - 0.5) * 10, vy: 0, vz: 10 + s * 10, life: 0.5, col: P.cool, size: 1, grav: 60, drag: 1 };
      else if (kind === 'steam') p = { x: x + (Math.random() - 0.5) * 6, y, z: 2, vx: (Math.random() - 0.5) * 4, vy: 0, vz: 10 + s * 8, life: 1.6, col: '#d8d4cc', size: 2, grav: -3, drag: 1 };
      else if (kind === 'smoke') p = { x: x + (Math.random() - 0.5) * 6, y, z: 8, vx: (Math.random() - 0.5) * 6 + 8, vy: 0, vz: 12 + s * 10, life: 1.8, col: s < 0.5 ? '#5a524b' : '#6e665d', size: 3, grav: -2, drag: 0.5 };
      else if (kind === 'feather') p = { x, y, z: 30, vx: Math.cos(a) * 20 * s, vy: 0, vz: 10 * s, life: 1.5, col: P.inkSoft, size: 1, grav: 12, drag: 1 };
      this.parts.push(p);
    }
  }

  // ------------------------------------------------------------------
  draw(game, dt, ui) {
    const ctx = this.ctx, A = this.art, W = game.world;
    const p = game.player;
    const w = this.w, h = this.h;
    const t = game.time;
    const S = 1; // drawing happens at art resolution; the presenter scales it up
    const Q = Math.round;
    this.Q = Q;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;

    // camera
    const lookX = p.vx * 0.45, lookY = p.vy * 0.35;
    const tx = p.x + lookX, ty = p.y - 8 + lookY;
    if (!this.camInit) { this.cam.x = tx; this.cam.y = ty; this.camInit = true; }
    this.cam.x = lerp(this.cam.x, tx, Math.min(1, dt * 3.2));
    this.cam.y = lerp(this.cam.y, ty, Math.min(1, dt * 3.2));
    this.cam.shake = Math.max(0, this.cam.shake - dt * 18);
    const sx = (Math.random() - 0.5) * this.cam.shake, sy = (Math.random() - 0.5) * this.cam.shake;
    const camL = this.cam.x - this.viewW / 2 + sx, camT = this.cam.y - this.viewH / 2 + sy;
    const cx = Math.floor(camL), cy = Math.floor(camT);
    this.fx = camL - cx; this.fy = camT - cy;
    this.cx = cx; this.cy = cy;

    // keep painting ahead of the camera (off-thread)
    W.ensure(this.cam.x, this.cam.y, w / 2 + 180, h / 2 + 160);
    W.flush(2);

    // ground
    const x0 = Math.floor(cx / CHUNK), x1 = Math.floor((cx + w) / CHUNK);
    const y0 = Math.floor(cy / CHUNK), y1 = Math.floor((cy + h) / CHUNK);
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        const c = W.get(gx, gy);
        const X0 = Q(gx * CHUNK - cx), Y0 = Q(gy * CHUNK - cy), X1 = Q((gx + 1) * CHUNK - cx), Y1 = Q((gy + 1) * CHUNK - cy);
        if (c) ctx.drawImage(c.img, X0, Y0, X1 - X0, Y1 - Y0);
        else { ctx.fillStyle = P.grass1; ctx.fillRect(X0, Y0, X1 - X0, Y1 - Y0); }
      }
    }

    // water glints
    ctx.fillStyle = P.foam;
    for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
      const c = W.props.get(W.key(gx, gy));
      if (!c) continue;
      const wp = c.waterPts;
      for (let i = 0; i < wp.length; i += 2) {
        const hsh = hash2(wp[i], wp[i + 1], 3);
        const ph = (t * 0.6 + hsh * 10) % 3;
        if (ph > 1) continue;
        const gx2 = wp[i] + Math.sin(hsh * 40) * 6 - cx, gy2 = wp[i + 1] + Math.cos(hsh * 30) * 5 - cy;
        { const gg = W.typeAt(wp[i] + Math.sin(hsh * 40) * 6, wp[i + 1] + Math.cos(hsh * 30) * 5); if (gg !== G.SHALLOW && gg !== G.DEEP) continue; }
        const len = Math.round(Math.sin(ph * Math.PI) * 3);
        ctx.globalAlpha = 0.7;
        ctx.fillRect(Q(gx2), Q(gy2), len, 1);
      }
    }
    ctx.globalAlpha = 1;

    // your trail: the thing they follow
    const tr = game.trail;
    const start = Math.max(0, tr.length - 900);
    for (let i = start; i < tr.length; i++) {
      const q = tr[i];
      if (q.s < 0.08 || q.water) continue;
      const qx = Q(q.x - cx), qy = Q(q.y - cy);
      if (qx < -4 || qy < -4 || qx > w + 4 || qy > h + 4) continue;
      const age = tr.length - i;
      const fade = clamp(1 - age / 900, 0.2, 1);
      ctx.globalAlpha = q.s * 0.5 * fade;
      ctx.fillStyle = q.g === G.MUD ? '#2a1c10' : q.g === G.SAND || q.g === G.CLAY ? '#6e4424' : '#4e3d18';
      const side = (i & 1) ? 2 : -2;
      ctx.fillRect(qx, qy + side * 0.5, 2, 1);
      ctx.fillRect(qx + 1, qy + side * 0.5 - 1, 1, 1);
    }
    ctx.globalAlpha = 1;

    // scorched ground
    if (game.burnt.size) {
      for (const b of game.burnt.values()) {
        const X = b.x - 4 - cx, Y = b.y - 4 - cy;
        if (X < -8 || Y < -8 || X > w || Y > h) continue;
        ctx.fillStyle = 'rgba(38,32,28,0.82)';
        ctx.fillRect(Q(X), Q(Y), 8, 8);
        if (((b.x * 7 + b.y * 3) & 15) === 0) { ctx.fillStyle = P.ash3; ctx.fillRect(Q(X + 3), Q(Y + 2), 1, 1); }
      }
    }
    // lightning about to land here
    for (const st of game.weather.strikes) {
      if (st.done) continue;
      const k = 1 - st.t / 0.9;
      ctx.strokeStyle = `rgba(255,250,210,${0.3 + k * 0.6})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(Q(st.x - cx), Q(st.y - cy), 22 - k * 16, (22 - k * 16) * 0.55, 0, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,250,210,${k * 0.25})`;
      ctx.fill();
    }
    // shadows
    ctx.fillStyle = 'rgba(30,18,10,0.28)';
    const props = [];
    for (const pr of W.propsNear(cx + w / 2, cy + h / 2, Math.max(w, h) / 2 + 80)) {
      const img = pr.def.img;
      if (pr.x - pr.def.ox > cx + w + 4 || pr.x + img.width - pr.def.ox < cx - 4) continue;
      if (pr.y - pr.def.oy > cy + h + 4 || pr.y + 10 < cy) continue;
      if (pr.flat) {
        ctx.drawImage(img, Q(pr.x - pr.def.ox - cx), Q(pr.y - pr.def.oy - cy));
        if (pr.def.vent && Math.random() < dt * 3) this.burst('steam', pr.x, pr.y, 1);
        continue;
      }
      props.push(pr);
      const s = pr.def.shadow;
      if (s) {
        ctx.beginPath();
        ctx.ellipse(Q(pr.x - cx), Q(pr.y - cy + s.dy), s.rx, s.ry, 0, 0, TAU);
        ctx.fill();
      }
    }
    const shadow = (x, y, rx, ry = rx * 0.4, a = 0.28) => {
      ctx.fillStyle = `rgba(30,18,10,${a})`;
      ctx.beginPath();
      ctx.ellipse(Q(x - cx), Q(y - cy), rx, ry, 0, 0, TAU);
      ctx.fill();
    };

    // spear telegraphs on the ground
    for (const hu of [...game.hunters, ...game.runners]) {
      if (hu.windup > 0) {
        const k = clamp(1 - hu.windup / 0.8, 0, 1);
        ctx.fillStyle = `rgba(255,74,46,${0.12 + k * 0.25})`;
        ctx.beginPath();
        ctx.ellipse(Q(hu.tx - cx), Q(hu.ty - cy), 11, 6, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = `rgba(255,74,46,${0.55 + k * 0.45})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.lineDashOffset = -t * 30;
        ctx.beginPath();
        ctx.moveTo(Q(hu.x - cx), Q(hu.y - cy));
        ctx.lineTo(Q(hu.tx - cx), Q(hu.ty - cy));
        ctx.stroke();
        ctx.setLineDash([]);
        const rr = 10 - k * 4;
        ctx.beginPath();
        ctx.ellipse(Q(hu.tx - cx), Q(hu.ty - cy), rr, rr * 0.55, 0, 0, TAU);
        ctx.stroke();
      }
    }
    // band search ring
    if (game.band.mode === 'search') {
      const b = game.band;
      ctx.strokeStyle = 'rgba(127,214,224,0.25)';
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.ellipse(Q(b.searchX - cx), Q(b.searchY - cy), b.searchR, b.searchR * 0.6, 0, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ---------- y-sorted sprites ----------
    const list = [];
    for (const pr of props) list.push({ y: pr.y, k: 0, o: pr });
    for (const c of game.carcasses) list.push({ y: c.y - 8, k: 1, o: c });
    for (const s of game.stuck) list.push({ y: s.y, k: 2, o: s });
    for (const q of game.prey) list.push({ y: q.y, k: 3, o: q });
    for (const d of game.dogs) list.push({ y: d.y, k: 4, o: d });
    for (const hu of game.hunters) list.push({ y: hu.y, k: 5, o: hu });
    for (const r of game.runners) list.push({ y: r.y, k: 5, o: r });
    for (let gy = y0; gy <= y1 + 1; gy++) for (let gx = x0; gx <= x1; gx++) {
      const pc = W.props.get(W.key(gx, gy));
      if (pc && pc.grass) for (const gr of pc.grass) {
        const X = gr.x - cx, Y = gr.y - cy;
        if (X > -12 && X < w + 12 && Y > -4 && Y < h + 24) list.push({ y: gr.y, k: 11, o: gr });
      }
    }
    for (const hy of game.hyenas) list.push({ y: hy.y, k: 7, o: hy });
    for (const gn of game.gnus) list.push({ y: gn.y, k: 8, o: gn });
    for (const L of game.lions) list.push({ y: L.y, k: 10, o: L });
    if (game.croc) list.push({ y: game.croc.y - 4, k: 9, o: game.croc });
    list.push({ y: p.y, k: 6, o: p });
    list.sort((a, b) => a.y - b.y);

    const night = game.isNight || game.clock > 0.64;
    const spr = (img, x, y, ox, oy, flip, alpha = 1, sub = 0) => {
      const X = Q(x - cx), Y = Q(y - cy);
      if (X < -img.width - 10 || X > w + img.width + 10 || Y < -10 || Y > h + img.height + 10) return;
      if (alpha < 1) ctx.globalAlpha = alpha;
      const sh = sub ? Math.max(1, oy - sub + 1) : img.height;
      const dy = Y - oy + sub;
      if (flip) {
        ctx.save();
        ctx.translate(X, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, img.width, sh, -ox, dy, img.width, sh);
        ctx.restore();
      } else ctx.drawImage(img, 0, 0, img.width, sh, X - ox, dy, img.width, sh);
      if (alpha < 1) ctx.globalAlpha = 1;
      if (sub) {
        // waterline ripple
        const rw = Math.min(9, Math.max(4, Math.round(oy * 0.3)));
        const wob = Math.sin(t * 6 + x * 0.1) > 0 ? 1 : 0;
        ctx.fillStyle = P.foam;
        ctx.fillRect(X - rw, Y + 1, rw * 2 + wob, 1);
        ctx.fillStyle = P.water2;
        ctx.fillRect(X - rw - 2, Y + 2, 3, 1);
        ctx.fillRect(X + rw, Y + 2, 3, 1);
      }
    };
    const depth = (x, y, deep, shallow) => {
      const g = W.typeAt(x, y);
      return g === G.DEEP ? deep : g === G.SHALLOW ? shallow : 0;
    };

    for (const it of list) {
      const o = it.o;
      if (it.k === 0) {
        let alpha = 1;
        if (TALL_PROPS.has(o.kind) && p.y < o.y - 3 && p.y > o.y - o.def.oy + 6 && Math.abs(p.x - o.x) < o.def.img.width / 2 - 4) alpha = 0.5;
        if (o.kind === 'landmark' && !game.found.has(o.lm.key) && Math.random() < dt * 5) this.burst('spark', o.x + (Math.random() - 0.5) * o.def.img.width * 0.7, o.y - Math.random() * o.def.oy * 0.8, 1, { col: '#ffe08a' });
        spr(o.def.img, o.x, o.y, o.def.ox, o.def.oy, o.flip, alpha);
      } else if (it.k === 1) {
        shadow(o.x, o.y, 9, 3);
        if (o.small) spr(o.meat > 0 ? A.smallCarcass : A.carcassBones, o.x, o.y, 8, 7, o.face < 0);
        else spr(o.meat > 0 ? A.carcass : A.carcassBones, o.x, o.y, 15, 11, o.face < 0);
      } else if (it.k === 2) {
        const a = o.t > 20 ? 1 - (o.t - 20) / 5 : 1;
        spr(A.spearStuck, o.x, o.y, 4, 17, o.face < 0, a);
      } else if (it.k === 3) {
        const S = A[o.kind] || A.gazelle;
        const spd = Math.hypot(o.vx, o.vy);
        const pick = (arr) => arr[Math.floor(o.anim * arr.length) % arr.length];
        let fr;
        const z = o.z || 0;
        if (z > 2 && S.fly) fr = pick(S.fly);
        else if (spd > 60 && S.run) fr = pick(S.run);
        else if (spd > 5 && (S.walk || S.run)) fr = pick(S.walk || S.run);
        else fr = pick(S.idle);
        const small = o.kind === 'hare' || o.kind === 'fowl' || o.kind === 'hyrax';
        const sb = z > 2 ? 0 : depth(o.x, o.y, small ? 6 : 9, small ? 3 : 5);
        if (!sb) shadow(o.x, o.y, small ? 4 : 8, small ? 1.5 : 2.5, z > 2 ? 0.15 : 0.28);
        spr(fr, o.x, o.y - z, S.ox, S.oy, o.face < 0, 1, sb);
        if (o.kind === 'golden' && Math.random() < dt * 8) this.burst('spark', o.x, o.y - 12, 1, { col: '#fff09a' });
      } else if (it.k === 4) {
        const S = A.dog;
        const spd = Math.hypot(o.vx, o.vy);
        const fr = spd > 70 ? S.run[Math.floor(o.anim * 8) % 8] : spd > 5 ? S.walk[Math.floor(o.anim * 8) % 8] : S.idle[0];
        const sb = depth(o.x, o.y, 7, 4);
        if (!sb) shadow(o.x, o.y, 7, 2.5);
        spr(fr, o.x, o.y, S.ox, S.oy, o.face < 0, o.dead ? 0.8 : 1, sb);
      } else if (it.k === 5) {
        const set = A.hunter[o.variant][night ? 'n' : 'd'];
        let fr;
        const st = o.state;
        if (st === 'down') fr = set.down[0];
        else if (st === 'windup') fr = set.windup[0];
        else if (st === 'throw') fr = set.throw[0];
        else if (st === 'search') fr = set.search[Math.floor(o.anim * 4) % 4];
        else if (st === 'run') fr = set.run[Math.floor(o.anim * 8) % 8];
        else fr = set.walk[Math.floor(o.anim * 8) % 8];
        const sb = st === 'down' ? 0 : depth(o.x, o.y, 12, 6);
        if (!sb) shadow(o.x, o.y, 6, 2);
        spr(fr, o.x, o.y, A.hunter[o.variant].ox, A.hunter[o.variant].oy, o.face < 0, 1, sb);
        if (night && st !== 'down' && st !== 'windup') {
          const fx = o.x - o.face * 4, fy = o.y - 39;
          if (Math.random() < dt * 30) this.burst('ember', fx, o.y, 1, { z: 38 });
          ctx.fillStyle = P.fire1;
          ctx.fillRect(Q(fx - cx) - 1, Q(fy - cy) - 1 - (Math.random() < 0.5 ? 1 : 0), 3, 3);
          ctx.fillStyle = P.fire2;
          ctx.fillRect(Q(fx - cx), Q(fy - cy), 1, 1);
        }
        if (o.mark > 0) {
          const bounce = Math.abs(Math.sin(o.mark * 8)) * 3;
          drawText(ctx, o.markType, o.x - cx - 2, o.y - cy - 52 - bounce, { color: o.markType === '!' ? P.danger : P.cool, snap: S });
        }
      } else if (it.k === 7) {
        const S = A.hyena;
        const spd = Math.hypot(o.vx, o.vy);
        const fr = o.state === 'eat' ? S.drink[Math.floor(t * 3) % 2] : spd > 60 ? S.run[Math.floor(o.anim * 8) % 8] : spd > 4 ? S.walk[Math.floor(o.anim * 8) % 8] : S.idle[0];
        shadow(o.x, o.y, 8, 2.5);
        spr(fr, o.x, o.y, S.ox, S.oy, o.face < 0);
      } else if (it.k === 8) {
        if (game.stampedeWarn > 1.2) continue;
        const S = A.gnu;
        shadow(o.x, o.y, 9, 3);
        spr(S.run[Math.floor(o.anim * 8) % 8], o.x, o.y, S.ox, S.oy, o.face < 0);
        if (Math.random() < dt * 14) this.burst('dust', o.x - Math.cos(o.a) * 10, o.y, 2, { col: P.sand2 });
      } else if (it.k === 11) {
        const wind = Math.sin(t * 1.3 + o.x * 0.02 + o.ph) + Math.sin(t * 2.9 + o.y * 0.03) * 0.4;
        const fr = o.v[wind > 0.5 ? 2 : wind < -0.5 ? 0 : 1];
        ctx.drawImage(fr, Q(o.x - 13 - cx), Q(o.y - 21 - cy));
      } else if (it.k === 10) {
        const S = A.lion;
        const pick = (arr) => arr[Math.floor(o.anim * arr.length) % arr.length];
        const fr = o.state === 'rest' ? pick(S.lie) : o.state === 'charge' ? pick(S.run) : pick(S.walk);
        shadow(o.x, o.y, 11, 3);
        spr(fr, o.x, o.y, S.ox, S.oy, o.face < 0);
      } else if (it.k === 9) {
        const img = A.croc[o.state === 'snap' ? 1 : 0];
        const X = Q(o.x - cx), Y = Q(o.y - cy);
        if (o.state === 'sink') ctx.globalAlpha = Math.max(0, 1 - o.t);
        // wake
        ctx.fillStyle = P.foam;
        for (let i = 1; i < 4; i++) {
          ctx.fillRect(X - o.face * (10 + i * 6), Y - i * 2 + 2, 3, 1);
          ctx.fillRect(X - o.face * (10 + i * 6), Y + i * 2 + 5, 3, 1);
        }
        if (o.face < 0) { ctx.save(); ctx.translate(X, 0); ctx.scale(-1, 1); ctx.drawImage(img, -12, Y - 3); ctx.restore(); }
        else ctx.drawImage(img, X - 12, Y - 3);
        ctx.globalAlpha = 1;
      } else if (it.k === 6) {
        const S = A.cat;
        let arr = S[p.state] || S.idle;
        if (game.over) arr = S.dead;
        const fr = arr[Math.floor(p.anim * arr.length) % arr.length];
        const sb = p.state === 'pounce' ? 0 : depth(p.x, p.y, 8, 4);
        if (!sb) shadow(p.x, p.y, 10, 3);
        if (p.state === 'pounce') {
          ctx.globalAlpha = 0.3;
          spr(fr, p.x - p.vx * 0.04, p.y - p.vy * 0.04, S.ox, S.oy, p.face < 0);
          ctx.globalAlpha = 1;
        }
        const blink = p.iframes > 0 && p.hurt > 0 && Math.floor(t * 20) % 2 === 0;
        const hopY = p.hop > 0 ? Math.sin((1 - p.hop / 0.34) * Math.PI) * 7 : 0;
        if (!blink) spr(fr, p.x, p.y - hopY, S.ox, S.oy, p.face < 0, 1, sb);
      }
    }

    // fire
    if (game.fire.size) {
      for (const f of game.fire.values()) {
        const X = f.x - cx, Y = f.y - cy;
        if (X < -10 || Y < -20 || X > w + 10 || Y > h + 10) continue;
        const life = Math.min(1, (f.max - f.t) / 0.5, f.t / 1.2);
        const hs = ((f.x * 13 + f.y * 7) >>> 0) % 97;
        ctx.fillStyle = `rgba(255,110,30,${0.3 * life})`;
        ctx.beginPath(); ctx.ellipse(Q(X), Q(Y), 7, 3.5, 0, 0, TAU); ctx.fill();
        for (let k = 0; k < 2; k++) {
          const ox = ((hs >> (k * 2)) % 7) - 3;
          const fl = Math.sin(t * (11 + k * 4) + hs + k * 2);
          const hgt = (5 + ((hs >> k) % 5) + fl * 2) * life;
          if (hgt < 1.5) continue;
          const bx = X + ox, lean = Math.cos(game.weather.windA) * 1.5 + fl * 0.6;
          ctx.fillStyle = P.fire0;
          ctx.beginPath(); ctx.moveTo(Q(bx - 2.5), Q(Y)); ctx.lineTo(Q(bx + lean), Q(Y - hgt)); ctx.lineTo(Q(bx + 2.5), Q(Y)); ctx.fill();
          ctx.fillStyle = P.fire1;
          ctx.beginPath(); ctx.moveTo(Q(bx - 1.5), Q(Y)); ctx.lineTo(Q(bx + lean * 0.7), Q(Y - hgt * 0.7)); ctx.lineTo(Q(bx + 1.5), Q(Y)); ctx.fill();
          ctx.fillStyle = P.fire2;
          ctx.fillRect(Q(bx - 0.5), Q(Y - hgt * 0.35), 1, Math.max(1, hgt * 0.3));
        }
        if (Math.random() < dt * 0.8) this.burst('smoke', f.x, f.y - 6, 1);
        if (Math.random() < dt * 1.2) this.burst('ember', f.x, f.y, 1, { z: 6 });
      }
    }
    for (const st of game.weather.strikes) {
      if (!st.done || st.t < -0.25) continue;
      for (const [lw, col] of [[6, 'rgba(200,220,255,0.35)'], [2, '#fffbe0']]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      let bx = st.x - cx, by = -10;
      ctx.moveTo(Q(bx), by);
      const segs = 9;
      for (let i = 1; i <= segs; i++) {
        const yy = -10 + ((st.y - cy + 10) * i) / segs;
        const xx = st.x - cx + (i < segs ? Math.sin(st.x + i * 7.3) * 9 : 0);
        ctx.lineTo(Q(xx), Q(yy));
      }
      ctx.stroke();
      }
    }
    // spears in flight
    for (const s of game.spears) {
      shadow(s.gx, s.gy, 3, 1, 0.3);
      const hx = s.gx - cx, hy = s.gy - s.h - cy;
      const ca = Math.cos(s.ang), sa = Math.sin(s.ang);
      ctx.strokeStyle = P.bark2;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Q(hx - ca * 12), Q(hy - sa * 12));
      ctx.lineTo(Q(hx), Q(hy));
      ctx.stroke();
      ctx.fillStyle = P.rock4;
      ctx.fillRect(Q(hx + ca * 1), Q(hy + sa * 1), 2, 1);
    }

    // vultures over carcasses
    for (const c of game.carcasses) {
      if (c.t < 6) continue;
      const nv = Math.min(3, Math.floor((c.t - 6) / 5) + 1);
      for (let i = 0; i < nv; i++) {
        const a = t * 0.8 + i * 2.1 + c.id;
        const vx = c.x + Math.cos(a) * (26 + i * 6), vy = c.y + Math.sin(a) * 12 - 46 - i * 4;
        shadow(c.x + Math.cos(a) * (26 + i * 6), c.y + Math.sin(a) * 12, 4, 1.2, 0.15);
        const fr = A.vulture[Math.floor(t * 6 + i) % 4];
        ctx.drawImage(fr, Q(vx - cx - 11), Q(vy - cy - 6));
      }
    }

    // particles
    for (const q of this.parts) {
      q.life -= dt;
      q.vz -= q.grav * dt;
      q.z += q.vz * dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
      const dr = Math.max(0, 1 - q.drag * dt);
      q.vx *= dr; q.vy *= dr;
      if (q.z < 0) {
        q.z = 0; q.vz = 0; q.vx = 0; q.vy = 0;
        if (q.stain) { q.life = Math.max(q.life, 6); q.stain = false; q.grav = 0; }
      }
      ctx.globalAlpha = clamp(q.life * 2, 0, 1);
      ctx.fillStyle = q.col;
      ctx.fillRect(Q(q.x - cx), Q(q.y - q.z - cy), q.size, q.size);
    }
    ctx.globalAlpha = 1;
    this.parts = this.parts.filter((q) => q.life > 0);
    if (this.parts.length > 900) this.parts.splice(0, this.parts.length - 900);

    // ---------- lighting ----------
    const L = this.lctx;
    let [r, g, b] = skyAt(game.clock);
    const rain = game.weather.rain;
    r = lerp(r, r * 0.7, rain); g = lerp(g, g * 0.75, rain); b = lerp(b, b * 0.85, rain);
    L.globalCompositeOperation = 'source-over';
    L.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
    L.fillRect(0, 0, w, h);
    const darkness = 1 - (r + g + b) / (3 * 255);
    if (darkness > 0.12) {
      L.globalCompositeOperation = 'lighter';
      const glow = (x, y, rad, cr, cg, cb, a) => {
        const gr = L.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`);
        gr.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        L.fillStyle = gr;
        L.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      };
      const k = clamp((darkness - 0.12) * 2.2, 0, 1);
      glow(p.x - cx, p.y - cy - 6, 100, 120, 118, 150, 0.6 * k);
      let fi = 0;
      for (const f of game.fire.values()) {
        if ((fi++ & 3) !== 0) continue;
        const X = f.x - cx, Y = f.y - cy;
        if (X < -60 || Y < -60 || X > w + 60 || Y > h + 60) continue;
        glow(X, Y - 4, 46, 255, 140, 60, 0.55 * k);
      }
      for (const hu of [...game.hunters, ...game.runners]) {
        if (hu.state === 'down') continue;
        const fl = 0.85 + Math.sin(t * 17 + hu.id) * 0.08 + Math.random() * 0.07;
        glow(hu.x - hu.face * 4 - cx, hu.y - 36 - cy, 78 * fl, 255, 150, 70, 0.8 * k);
      }
      L.globalCompositeOperation = 'source-over';
    }
    if (game.weather.flash > 0) {
      L.fillStyle = `rgba(255,255,255,${game.weather.flash * 0.8})`;
      L.fillRect(0, 0, w, h);
    }
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.light, 0, 0);
    ctx.globalCompositeOperation = 'source-over';

    // fog, dust, heat haze
    const wx = game.weather;
    if (wx.fog > 0.03) {
      const px = p.x - cx, py = p.y - cy;
      const gr = ctx.createRadialGradient(px, py, 30, px, py, Math.max(w, h) * 0.55);
      gr.addColorStop(0, `rgba(222,226,228,${wx.fog * 0.18})`);
      gr.addColorStop(1, `rgba(222,226,228,${wx.fog * 0.72})`);
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 7; i++) {
        const fx = ((i * 97 + t * 6 - cx * 0.6) % (w + 160) + w + 160) % (w + 160) - 80, fy = ((i * 53 - cy * 0.6) % (h + 120) + h + 120) % (h + 120) - 60;
        const g2 = ctx.createRadialGradient(fx, fy, 0, fx, fy, 70);
        g2.addColorStop(0, `rgba(235,238,240,${wx.fog * 0.3})`);
        g2.addColorStop(1, 'rgba(235,238,240,0)');
        ctx.fillStyle = g2;
        ctx.fillRect(fx - 70, fy - 70, 140, 140);
      }
    }
    if (wx.dust > 0.03) {
      ctx.fillStyle = `rgba(186,118,58,${wx.dust * 0.42})`;
      ctx.fillRect(0, 0, w, h);
      const n = Math.floor(wx.dust * 160);
      const ca = Math.cos(wx.windA), sa = Math.sin(wx.windA);
      while (this.dustMotes.length < n) this.dustMotes.push({ x: Math.random() * w, y: Math.random() * h, s: 0.5 + Math.random() });
      this.dustMotes.length = n;
      ctx.fillStyle = 'rgba(232,190,130,0.6)';
      for (const d of this.dustMotes) {
        d.x += ca * 160 * d.s * dt; d.y += sa * 160 * d.s * dt;
        if (d.x < 0) d.x += w; if (d.x > w) d.x -= w; if (d.y < 0) d.y += h; if (d.y > h) d.y -= h;
        ctx.fillRect(d.x, d.y, 3 * d.s, 1);
      }
    }
    if (wx.heat > 0.05 && game.sun > 0.2) {
      const a = wx.heat * game.sun;
      ctx.fillStyle = `rgba(255,190,110,${a * 0.13})`;
      ctx.fillRect(0, 0, w, h);
    }

    // rain
    if (rain > 0.03) {
      const n = Math.floor(rain * 220);
      while (this.rainDrops.length < n) this.rainDrops.push({ x: Math.random() * w, y: Math.random() * h, s: 0.6 + Math.random() * 0.6 });
      this.rainDrops.length = n;
      ctx.strokeStyle = 'rgba(190,210,230,0.5)';
      ctx.beginPath();
      for (const d of this.rainDrops) {
        d.y += 260 * d.s * dt; d.x -= 60 * d.s * dt;
        if (d.y > h) { d.y -= h + 5; d.x = Math.random() * (w + 40); }
        if (d.x < 0) d.x += w;
        ctx.moveTo(Math.round(d.x) + 0.5, Math.round(d.y));
        ctx.lineTo(Math.round(d.x - 2) + 0.5, Math.round(d.y + 6));
      }
      ctx.stroke();
    }

    // vignettes: heat (red), hurt, night edges
    this.vignette(game, dt);

    // instinct arrows at screen edge
    if (ui) this.instincts(game);

    // floating score text
    for (const q of this.pops) {
      q.t += dt;
      const a = q.t < 1.1 ? 1 : 1 - (q.t - 1.1) / 0.4;
      ctx.globalAlpha = clamp(a, 0, 1);
      drawText(ctx, q.text, q.x - cx, q.y - cy - q.t * 16, { color: q.color, align: 'center', snap: S });
    }
    ctx.globalAlpha = 1;
    this.pops = this.pops.filter((q) => q.t < 1.5);

    // stamina ring near the cat when it matters
    if (ui && !game.over && (p.stamina < 99 || p.sprinting)) {
      const X = p.x - cx + 13 * (p.face < 0 ? -1 : 1), Y = p.y - cy - 24;
      const frac = p.stamina / 100;
      ctx.strokeStyle = 'rgba(26,17,12,0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(X, Y, 4, 0, TAU); ctx.stroke();
      ctx.strokeStyle = p.exhausted ? P.danger : frac < 0.3 ? P.fire1 : P.hint;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(X, Y, 4, -Math.PI / 2, -Math.PI / 2 + frac * TAU); ctx.stroke();
    }
    this.presenter.present(this.buf, this.fx, this.fy, this.S);
  }

  vignette(game, dt) {
    const ctx = this.ctx, w = this.w, h = this.h, p = game.player;
    const heat = clamp((p.heat - 62) / 38, 0, 1);
    const pulse = p.overheated ? 0.2 + Math.sin(game.time * 8) * 0.1 : 0;
    const hurt = p.hurt > 0 ? p.hurt / 0.4 : 0;
    const low = p.health < 30 ? (1 - p.health / 30) * (0.5 + Math.sin(game.time * 5) * 0.3) : 0;
    const a = Math.max(heat * 0.5 + pulse, hurt * 0.55, low * 0.45);
    if (a > 0.01) {
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.72);
      const col = hurt > 0.3 || low > 0.2 ? '150,20,15' : '230,90,30';
      g.addColorStop(0, `rgba(${col},0)`);
      g.addColorStop(1, `rgba(${col},${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    // always-on subtle frame
    const g2 = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
    g2.addColorStop(0, 'rgba(10,6,4,0)');
    g2.addColorStop(1, `rgba(10,6,4,${game.isNight ? 0.55 : 0.28})`);
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, w, h);
  }

  instincts(game) {
    const ctx = this.ctx, w = this.w, h = this.h, p = game.player;
    const cx = this.cx, cy = this.cy;
    const arrow = (tx, ty, color, label, pulse = 0) => {
      const sx = tx - cx, sy = ty - cy;
      if (sx > 6 && sy > 6 && sx < w - 6 && sy < h - 6) return false;
      // keep arrows inside a frame that clears the HUD strips
      const top = Math.ceil(84 / this.scale), bot = h - 14, left = 14, right = w - 14;
      const mx = (left + right) / 2, my = (top + bot) / 2;
      const a = Math.atan2(sy - my, sx - mx);
      const k = Math.min(Math.abs((right - mx) / Math.cos(a)), Math.abs((bot - my) / Math.sin(a)));
      const ax = mx + Math.cos(a) * k, ay = my + Math.sin(a) * k;
      const s = 5 + pulse;
      ctx.fillStyle = 'rgba(26,17,12,0.75)';
      ctx.beginPath();
      ctx.moveTo(ax + Math.cos(a) * (s + 2), ay + Math.sin(a) * (s + 2));
      ctx.lineTo(ax + Math.cos(a + 2.4) * (s + 2), ay + Math.sin(a + 2.4) * (s + 2));
      ctx.lineTo(ax + Math.cos(a - 2.4) * (s + 2), ay + Math.sin(a - 2.4) * (s + 2));
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(ax + Math.cos(a) * s, ay + Math.sin(a) * s);
      ctx.lineTo(ax + Math.cos(a + 2.4) * s, ay + Math.sin(a + 2.4) * s);
      ctx.lineTo(ax + Math.cos(a - 2.4) * s, ay + Math.sin(a - 2.4) * s);
      ctx.fill();
      if (label) {
        const lx = ax - Math.cos(a) * 14, ly = ay - Math.sin(a) * 12 - 4;
        drawText(ctx, label, lx, ly, { color, align: 'center' });
      }
      return true;
    };
    if (game.over) return;
    // hunters: always sensed
    let nh = null, nd = 1e9;
    for (const hu of game.hunters) { const d = dist(hu.x, hu.y, p.x, p.y); if (d < nd) { nd = d; nh = hu; } }
    if (nh) arrow(nh.x, nh.y - 10, P.danger, (this.imperial ? Math.round(nd / 10 * 3.281) + 'FT' : Math.round(nd / 10) + 'M'), nd < 300 ? Math.sin(game.time * 10) * 1.5 + 1 : 0);
    for (const d of game.dogs) if (!d.dead && dist(d.x, d.y, p.x, p.y) < 500) arrow(d.x, d.y, P.fire1, null);
    if (game.gnus.length && game.stampedeWarn > 0) { const g0 = game.gnus[0]; arrow(g0.x, g0.y, P.sand3, 'STAMPEDE', Math.sin(game.time * 14) * 2 + 2); }
    for (const r of game.runners) if (!r.leaving) arrow(r.x, r.y - 10, P.danger, null, Math.sin(game.time * 12) * 1.5 + 1);
    // secrets: a pull toward the unknown
    {
      const R = game.has('nose') ? 900 : 520;
      let best = null, bd = R;
      for (const lm of game.world.landmarksNear(p.x, p.y, R)) {
        if (game.found.has(lm.key)) continue;
        const d = dist(lm.x, lm.y, p.x, p.y);
        if (d < bd) { bd = d; best = lm; }
      }
      if (best) arrow(best.x, best.y - 20, P.gold1, '?', Math.sin(game.time * 4) * 0.8);
    }
    // what you learned at their camp
    if (game.intelDay === game.day) for (const hu of game.hunters) arrow(hu.x, hu.y - 10, P.fire1, null);
    // water when thirsty
    if (p.water < 50 || game.has('nose')) {
      const wpt = game.world.nearestWater(p.x, p.y, 900);
      if (wpt) arrow(wpt[0], wpt[1], P.cool, p.water < 25 ? 'WATER' : null);
    }
    // food when hungry
    if (p.food < 45 || game.has('nose')) {
      let best = null, bd = 1e9;
      for (const c of game.carcasses) if (c.meat > 0) { const d = dist(c.x, c.y, p.x, p.y); if (d < bd) { bd = d; best = c; } }
      if (!best) for (const q of game.prey) { const d = dist(q.x, q.y, p.x, p.y); if (d < bd) { bd = d; best = q; } }
      if (best) arrow(best.x, best.y, P.sand3, p.food < 25 ? 'PREY' : null);
    }
  }
}

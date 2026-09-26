// What the cat remembers: a map that fills in only where you've actually been.
import { P } from './palette.js';
import { G } from './terrain.js';

const CELLPX = 24; // world pixels per remembered cell
const COLORS = {
  [G.GRASS]: P.grass2, [G.LUSH]: P.lush1, [G.TALL]: P.tall1, [G.SAND]: P.sand1, [G.CLAY]: P.clay1, [G.MUD]: P.mud1,
  [G.ROCK]: P.rock2, [G.SHALLOW]: P.water1, [G.DEEP]: P.deep1, [G.ASH]: P.ash2, [G.DUNE]: P.dune1, [G.SALT]: P.salt1,
  [G.BEACH]: P.beach1, [G.SEA]: P.sea1, [G.LEAF]: P.litter2, [G.BASALT]: P.basalt2, [G.CLIFF]: P.rock0,
};

export class Minimap {
  constructor(el, bigEl) {
    this.el = el;
    this.ctx = el.getContext('2d');
    this.big = bigEl;
    this.cells = new Map();
    this.t = 0;
    this.minX = 0; this.maxX = 0; this.minY = 0; this.maxY = 0;
  }

  reset() {
    this.cells = new Map();
    this.minX = this.maxX = this.minY = this.maxY = 0;
  }

  key(i, j) { return i * 65536 + j; }

  reveal(world, x, y, r) {
    const i0 = Math.floor((x - r) / CELLPX), i1 = Math.floor((x + r) / CELLPX);
    const j0 = Math.floor((y - r) / CELLPX), j1 = Math.floor((y + r) / CELLPX);
    let n = 0;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const cx = (i + 0.5) * CELLPX, cy = (j + 0.5) * CELLPX;
      if ((cx - x) ** 2 + (cy - y) ** 2 > r * r) continue;
      const k = this.key(i, j);
      if (this.cells.has(k)) continue;
      this.cells.set(k, COLORS[world.typeAt(cx, cy)] || P.grass2);
      this.minX = Math.min(this.minX, cx); this.maxX = Math.max(this.maxX, cx);
      this.minY = Math.min(this.minY, cy); this.maxY = Math.max(this.maxY, cy);
      if (++n > 1200) return false; // spread big reveals over several frames
    }
    return true;
  }

  update(game, dt) {
    const p = game.player;
    this.t -= dt;
    // big reveals (from secrets) trickle in
    if (game.reveals.length) {
      const R = game.reveals[0];
      if (this.reveal(game.world, R.x, R.y, R.r)) game.reveals.shift();
    }
    if (this.t > 0) return;
    this.t = 0.2;
    this.reveal(game.world, p.x, p.y, game.isNight ? 150 : 230);
    this.draw(game);
  }

  // Draw the remembered land into a canvas, centred on (cx, cy) at `scale` screen px per cell.
  paint(ctx, W, H, game, cx, cy, scale, big) {
    ctx.fillStyle = '#140d09';
    ctx.fillRect(0, 0, W, H);
    const cellsW = Math.ceil(W / scale / 2) + 1, cellsH = Math.ceil(H / scale / 2) + 1;
    const ci = Math.floor(cx / CELLPX), cj = Math.floor(cy / CELLPX);
    const fx = (cx / CELLPX - ci) * scale, fy = (cy / CELLPX - cj) * scale;
    for (let dj = -cellsH; dj <= cellsH; dj++) for (let di = -cellsW; di <= cellsW; di++) {
      const col = this.cells.get(this.key(ci + di, cj + dj));
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(Math.floor(W / 2 + di * scale - fx), Math.floor(H / 2 + dj * scale - fy), Math.ceil(scale), Math.ceil(scale));
    }
    const toX = (x) => W / 2 + ((x - cx) / CELLPX) * scale, toY = (y) => H / 2 + ((y - cy) / CELLPX) * scale;
    // secrets found this run
    const range = (Math.max(W, H) / scale) * CELLPX;
    for (const lm of game.world.landmarksNear(cx, cy, range)) {
      if (!game.found.has(lm.key)) continue;
      const X = toX(lm.x), Y = toY(lm.y);
      ctx.fillStyle = P.gold1;
      ctx.beginPath();
      for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 - Math.PI / 2; const rr = k % 2 ? 2 : 5; ctx.lineTo(X + Math.cos(a) * rr * (big ? 1.4 : 1), Y + Math.sin(a) * rr * (big ? 1.4 : 1)); }
      ctx.fill();
    }
    // the band, if you've learned their ways (or they're in sight)
    const intel = game.intelDay === game.day;
    for (const h of game.hunters) {
      const d = Math.hypot(h.x - game.player.x, h.y - game.player.y);
      if (!intel && d > 300) continue;
      ctx.fillStyle = P.danger;
      ctx.fillRect(toX(h.x) - 1.5, toY(h.y) - 1.5, 3, 3);
    }
    // you
    const p = game.player;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(toX(p.x), toY(p.y), big ? 4 : 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.fur2;
    ctx.beginPath(); ctx.arc(toX(p.x), toY(p.y), big ? 2.6 : 1.5, 0, Math.PI * 2); ctx.fill();
  }

  draw(game) {
    const c = this.el;
    const W = c.width, H = c.height;
    this.paint(this.ctx, W, H, game, game.player.x, game.player.y, 3 * (W / 120), false);
  }

  drawBig(game) {
    const c = this.big;
    const r = c.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
    const ctx = c.getContext('2d');
    const spanX = (this.maxX - this.minX) / CELLPX + 12, spanY = (this.maxY - this.minY) / CELLPX + 12;
    const scale = Math.max(1.5, Math.min(c.width / spanX, c.height / spanY, 10 * dpr));
    this.paint(ctx, c.width, c.height, game, (this.minX + this.maxX) / 2, (this.minY + this.maxY) / 2, scale, true);
  }
}

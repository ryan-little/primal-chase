// Scripted "decent player" used for balance runs. Reads game state, returns an input.
import { dist } from '../js/util.js';
export function makeBot(skill = 1) {
  const s = { mode: 'flee', shade: null, tgt: null, jit: 0 };
  const wrap = inner;
  function inner(g) {
    const p = g.player, W = g.world;
    let nh = null, nd = 1e9;
    for (const h of g.hunters) { const d = dist(h.x, h.y, p.x, p.y); if (d < nd) { nd = d; nh = h; } }
    let dogD = 1e9; for (const d of g.dogs) if (!d.dead) dogD = Math.min(dogD, dist(d.x, d.y, p.x, p.y));
    let ax = p.x - g.band.x, ay = p.y - g.band.y; const al = Math.hypot(ax, ay) || 1; ax /= al; ay /= al;
    // weave: a good player doesn't run a straight line
    { const wv = Math.sin(g.time / 9) * 0.9 + (g.lineP > 8 ? 0.8 : 0); const c = Math.cos(wv), sn = Math.sin(wv); const nx = ax * c - ay * sn, ny = ax * sn + ay * c; ax = nx; ay = ny; }
    const chase = g.band.mode === 'chase';
    const inp = { x: 0, y: 0, sprint: false, pounce: false };
    const go = (tx, ty, sprint = false) => { const dx = tx - p.x, dy = ty - p.y, l = Math.hypot(dx, dy) || 1; inp.x = dx / l; inp.y = dy / l; inp.sprint = sprint; return l; };
    // modes with hysteresis
    const safe = nd > (skill > 0 ? 260 : 99999) && !chase;
    if (p.water < 38 || (s.mode === 'drink' && p.water < 96)) s.mode = 'drink';
    else if (p.food < 35 || (s.mode === 'eat' && p.food < 90)) s.mode = 'eat';
    else if (p.heat > 74 || (s.mode === 'cool' && p.heat > 30)) s.mode = 'cool';
    else s.mode = 'flee';
    if (skill <= 0) s.mode = 'flee';
    // dodge: any spear or windup aimed near me -> sidestep perpendicular to its line
    const threats = [];
    for (const h of [...g.hunters, ...g.runners]) if (h.windup > 0) threats.push([h.x, h.y, h.tx, h.ty, h.windup]);
    for (const sp of g.spears) if (!sp.done) threats.push([sp.x0, sp.y0, sp.tx, sp.ty, 0]);
    for (const [x0, y0, tx, ty, wu] of threats) {
      if (dist(tx, ty, p.x, p.y) < 26 && (wu === 0 || wu < 0.35)) {
        const lx = tx - x0, ly = ty - y0, ll = Math.hypot(lx, ly) || 1;
        let px = -ly / ll, py = lx / ll;
        if (px * ax + py * ay < 0) { px = -px; py = -py; }
        inp.x = px + ax * 0.5; inp.y = py + ay * 0.5; inp.sprint = p.heat < 95;
        if (wu > 0 && wu < 0.12 && p.stamina > 22 && skill >= 2) inp.pounce = true;
        return inp;
      }
    }
    const sc = g.runners.find((r) => !r.leaving && r.seen && r.down <= 0) || null;
    if (sc) {
      const sd = dist(sc.x, sc.y, p.x, p.y);
      if (skill >= 2 && sd < 60 && p.stamina > 25) { go(sc.x, sc.y); inp.pounce = sd < 36; return inp; }
      let bx = p.x - sc.x, by = p.y - sc.y; const bl = Math.hypot(bx, by) || 1;
      // run perpendicular-ish to his throwing line
      inp.x = -by / bl * 0.7 + bx / bl * 0.7; inp.y = bx / bl * 0.7 + by / bl * 0.7;
      inp.sprint = p.heat < 90;
      if (sc.windup > 0 && sc.windup < 0.2 && dist(sc.tx, sc.ty, p.x, p.y) < 14 && p.stamina > 20) inp.pounce = true;
      return inp;
    }
    if ((chase && nd < 220) || dogD < 90) {
      // evade: sprint away, weave
      s.jit += 0.05;
      const w = Math.sin(s.jit * 3) * 0.6;
      inp.x = ax * Math.cos(w) - ay * Math.sin(w); inp.y = ax * Math.sin(w) + ay * Math.cos(w);
      inp.sprint = p.heat < 92;
      if (dogD < 30 && p.stamina > 20) inp.pounce = true;
      for (const h of g.hunters) if (h.windup > 0 && h.windup < 0.25 && dist(h.tx, h.ty, p.x, p.y) < 14 && p.stamina > 20) inp.pounce = true;
      return inp;
    }
    if (s.mode === 'drink') {
      const w = W.nearestWater(p.x, p.y, 1400);
      if (!w) { inp.x = ax; inp.y = ay; return inp; }
      if (p.drinking) return inp;
      const l = go(w[0], w[1]);
      if (l < 14 || (p.ground === 7 || p.ground === 8)) { inp.x = 0; inp.y = 0; }
      return inp;
    }
    if (s.mode === 'eat') {
      let c = null, cd = 700;
      for (const k of g.carcasses) if (k.meat > 0) { const d = dist(k.x, k.y, p.x, p.y); if (d < cd) { cd = d; c = k; } }
      if (c) { if (cd < 8) return inp; go(c.x, c.y); return inp; }
      let q = null, qd = 700;
      for (const k of g.prey) { const d = dist(k.x, k.y, p.x, p.y); if (d < qd) { qd = d; q = k; } }
      if (q) { go(q.x + q.vx * 0.2, q.y + q.vy * 0.2, qd < 110 && p.heat < 88); if (qd < 34 && p.stamina > 25) inp.pounce = true; return inp; }
      inp.x = ax; inp.y = ay; return inp;
    }
    if (s.mode === 'cool') {
      if (p.inShade || p.ground === 7 || p.ground === 8) return inp;
      let best = null, bd = 380;
      for (const pr of W.propsNear(p.x, p.y, 380)) {
        if (!pr.shade) continue;
        const d = dist(pr.x, pr.y, p.x, p.y);
        const toward = ((pr.x - p.x) * -ax + (pr.y - p.y) * -ay) / (d || 1);
        const cost = d + (toward > 0.3 ? 200 : 0);
        if (cost < bd) { bd = cost; best = pr; }
      }
      if (best) { go(best.x, best.y + 3); return inp; }
      inp.x = ax; inp.y = ay; return inp;
    }
    // flee: keep moving away, trot; sprint a little if close
    inp.x = ax; inp.y = ay;
    inp.sprint = nd < 280 && p.heat < 60 && skill > 0;
    // rest when far ahead and hot-ish
    if (skill > 0 && nd > 600 && p.heat > 45 && p.inShade) { inp.x = 0; inp.y = 0; }
    return inp;
  }
  // unstick: if pushing but not moving, turn 90 degrees for a second
  let lx = 0, ly = 0, stuckT = 0, turnT = 0;
  return function (g) {
    const inp = wrap(g), p = g.player;
    const moved = Math.hypot(p.x - lx, p.y - ly); lx = p.x; ly = p.y;
    if (Math.hypot(inp.x, inp.y) > 0.5 && moved < 0.3) stuckT += 1 / 30; else stuckT = Math.max(0, stuckT - 1 / 30);
    if (stuckT > 0.6) { turnT = 1; stuckT = 0; }
    if (turnT > 0) { turnT -= 1 / 30; const x = inp.x; inp.x = -inp.y; inp.y = x; }
    return inp;
  };
}

import { chromium } from '../../Primal-Chase-Fable/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.stack));
await p.addInitScript(() => { const s = JSON.parse(localStorage.getItem('pc2_settings') || '{}'); s.cinematic = false; localStorage.setItem('pc2_settings', JSON.stringify(s)); /* cinematic:false */ });
await p.goto('http://127.0.0.1:8791/index.html'); await p.waitForTimeout(1500);
await p.click('#btn-start'); await p.waitForTimeout(1500);
const r = await p.evaluate(async () => {
  const g = window.__pc.game, pl = g.player, W = g.world, SEA = 13;
  // walk outward until we hit sea, then stand 60px inland facing it
  let found = null;
  for (let a = 0; a < 6.28 && !found; a += 0.2) for (let d = 100; d < 40000 && !found; d += 40) {
    const x = pl.x + Math.cos(a) * d, y = pl.y + Math.sin(a) * d;
    if (W.T.ground(x, y) === SEA) found = { x: x - Math.cos(a) * 90, y: y - Math.sin(a) * 90, a };
  }
  if (!found) return 'no coast';
  W.prepare(found.x, found.y, 700, 9999); await new Promise(r => setTimeout(r, 1500));
  pl.x = found.x; pl.y = found.y;
  const res = { intercept: [], stampede: [], bad: 0 };
  for (let trial = 0; trial < 6; trial++) {
    g.hist = []; for (let i = 0; i < 20; i++) g.hist.push({ x: pl.x - Math.cos(found.a) * (20 - i) * 10, y: pl.y - Math.sin(found.a) * (20 - i) * 10 });
    pl.vx = Math.cos(found.a) * 60; pl.vy = Math.sin(found.a) * 60;
    const h = g.heading();
    g.runners = [];
    for (let i = 0; i < 3; i++) { const pos = g.groundPoint(h + (i - 1) * 0.4, 0.15, 230, 290); if (pos) { const ok = g.overLand(pos[0], pos[1], pl.x, pl.y); res.intercept.push(ok); if (!ok) res.bad++; } else res.intercept.push(null); }
    g.gnus = []; g.stampedeT = 0; g.day = 2; g.over = false;
    g.update ? null : null;
    // run the stampede spawn block directly by stepping one tiny update of the stampede section
    const before = g.gnus.length;
    g.updateHazards ? g.updateHazards(0.001) : null;
    res.stampede.push(g.gnus.length ? g.gnus.every(q => W.ground(q.x, q.y) !== SEA) : 'none');
  }
  return res;
});
console.log(JSON.stringify(r));
console.log(errs.join('\n') || 'no errors');
await b.close();

import { chromium } from '../../Primal-Chase-Fable/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.stack));
await p.addInitScript(() => { const s = JSON.parse(localStorage.getItem('pc2_settings') || '{}'); s.cinematic = false; localStorage.setItem('pc2_settings', JSON.stringify(s)); /* cinematic:false */ });
await p.goto('http://127.0.0.1:8791/index.html'); await p.waitForTimeout(1200);
await p.click('#btn-start'); await p.waitForTimeout(1500);
// hunters crossing a solid prop: find a log or boulder, hunter on one side, cat on the other
console.log(JSON.stringify(await p.evaluate(async () => {
  const g = window.__pc.game, W = g.world, pl = g.player;
  const out = {};
  for (const kind of ['log', 'boulder']) {
    let prop = null;
    for (let r = 0; r < 20000 && !prop; r += 300) for (let a = 0; a < 6.28 && !prop; a += 0.5) {
      const x = pl.x + Math.cos(a) * r, y = pl.y + Math.sin(a) * r;
      W.prepare(x, y, 200, 9999);
      for (const q of W.propsNear(x, y, 200)) if (q.kind === kind) { prop = q; break; }
    }
    if (!prop) { out[kind] = 'none'; continue; }
    W.prepare(prop.x, prop.y, 500, 9999);
    const h = g.hunters[0];
    g.hunters.slice(1).forEach(o => { o.x = prop.x + 3000; o.y = prop.y; });
    h.x = prop.x; h.y = prop.y - 30; h.vx = h.vy = 0; h.down = 0; h.windup = 0; h.throwCd = 99;
    pl.x = prop.x; pl.y = prop.y + 90; pl.health = 100; pl.iframes = 99;
    g.band.mode = 'chase'; g.band.x = h.x; g.band.y = h.y;
    window.__pc.override = () => ({ x: 0, y: 0 });
    const t0 = performance.now(); let crossed = null;
    for (let i = 0; i < 120; i++) { await new Promise(r => setTimeout(r, 25)); h.throwCd = 99; pl.x = prop.x; pl.y = prop.y + 90; if (h.y > prop.y + 12) { crossed = Math.round(performance.now() - t0); break; } }
    window.__pc.override = null;
    out[kind] = { crossedMs: crossed, hy: Math.round(h.y - prop.y) };
  }
  return out;
})));
// open-ground hunter chase speed
console.log('prey', JSON.stringify(await p.evaluate(async () => {
  const g = window.__pc.game, pl = g.player, res = {};
  g.band.mode = 'track'; g.band.x = pl.x + 5000; g.hunters.forEach(h => { h.x = pl.x + 5000; }); g.clock = 0.3; g.weather.fog = 0; g.weather.dust = 0; pl.iframes = 0;
  for (const mode of ['stalk', 'trot']) {
    g.prey = [{ id: 9e6, kind: 'gazelle', herd: 0, x: pl.x + 160, y: pl.y, vx: 0, vy: 0, face: 1, anim: 0, state: 'graze', fleeT: 0, z: 0, wt: 99 }];
    const q = g.prey[0];
    window.__pc.override = () => ({ x: 1, y: 0, stalk: mode === 'stalk' });
    let fled = null;
    for (let i = 0; i < 200 && fled == null; i++) { await new Promise(r => setTimeout(r, 25)); const d = Math.hypot(q.x - pl.x, q.y - pl.y); if (q.state === 'flee') fled = Math.round(d); if (d < 8) break; }
    res[mode] = fled; window.__pc.override = null; await new Promise(r => setTimeout(r, 300));
  }
  return res;
})));
console.log(errs.join('\n') || 'no errors');
await b.close();

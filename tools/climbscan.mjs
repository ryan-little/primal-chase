import { chromium } from '../../Primal-Chase-Fable/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.stack));
await p.addInitScript(() => { const s = JSON.parse(localStorage.getItem('pc2_settings') || '{}'); s.cinematic = false; localStorage.setItem('pc2_settings', JSON.stringify(s)); });
await p.goto('http://127.0.0.1:8791/index.html'); await p.waitForTimeout(1000);
await p.click('#btn-start'); await p.waitForTimeout(1500);
console.log(JSON.stringify(await p.evaluate(async () => {
  const g = window.__pc.game, pl = g.player, W = g.world, CLIFF = 16;
  g.band.x = pl.x + 9e4; g.hunters.forEach(h => h.x = pl.x + 9e4); g.scoutT = 1e9;
  const spots = [];
  for (let r = 50; r < 20000 && spots.length < 12; r += 20) for (let a = 0; a < 6.28 && spots.length < 12; a += 12 / r) {
    const x = pl.x + Math.cos(a) * r, y = pl.y + Math.sin(a) * r;
    if (W.T.ground(x, y) === CLIFF && W.T.ground(x, y + 14) !== CLIFF && W.T.ground(x, y + 14) !== 13 && W.T.levelAt(x, y - 14) === W.T.levelAt(x, y + 14) + 1 && !spots.some(s => Math.hypot(s[0] - x, s[1] - y) < 400)) spots.push([x, y + 16]);
  }
  const res = [];
  for (const s of spots) {
    W.prepare(s[0], s[1], 300, 9999); await new Promise(r => setTimeout(r, 500));
    pl.x = s[0]; pl.y = s[1]; pl.vx = pl.vy = 0; pl.stamina = 100; pl.heat = 0; pl.overheated = false; pl.pounceCd = 0;
    const L0 = W.levelAt(pl.x, pl.y); let fired = false; const path = [];
    window.__pc.override = () => { const go = !fired; fired = true; return { x: 0, y: -1, pounce: go }; };
    for (let i = 0; i < 20; i++) { await new Promise(r => setTimeout(r, 25)); path.push([Math.round(pl.y - s[1]), W.typeAt(pl.x, pl.y), W.levelAt(pl.x, pl.y), pl.state]); }
    window.__pc.override = null;
    const ok = W.levelAt(pl.x, pl.y) > L0;
    res.push(ok ? 'ok' : { L0, face: [...Array(20)].map((_, k) => W.levelAt(s[0], s[1] - 4 - k * 3)).join(''), path: path.slice(0, 12).map(q => q.join(':')).join(' ') });
  }
  return res;
})));
console.log(errs.join('\n') || 'no errors');
await b.close();

import { chromium } from '../../Primal-Chase-Fable/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.stack));
await p.addInitScript(() => { const s = JSON.parse(localStorage.getItem('pc2_settings') || '{}'); s.cinematic = false; localStorage.setItem('pc2_settings', JSON.stringify(s)); });
await p.goto('http://127.0.0.1:8791/index.html'); await p.waitForTimeout(1000);
await p.click('#btn-start'); await p.waitForTimeout(1500);
const r = await p.evaluate(async () => {
  const g = window.__pc.game, pl = g.player;
  g.band.x = pl.x + 5000; g.hunters.forEach(h => h.x = pl.x + 5000); g.day = 2; g.stampedeT = 0; g.clock = 0.3;
  await new Promise(r => setTimeout(r, 200));
  const n = g.gnus.length; if (!n) return 'no stampede';
  pl.iframes = 99; const prey0 = g.stats.prey;
  // wait for the herd to arrive, then pounce at the nearest gnu
  let killed = false, frames = [];
  let last = performance.now();
  for (let i = 0; i < 400 && !killed; i++) {
    await new Promise(r => requestAnimationFrame(r));
    const now = performance.now(); frames.push(now - last); last = now;
    const near = g.gnus.filter(q => !q.gone).sort((a, b) => Math.hypot(a.x - pl.x, a.y - pl.y) - Math.hypot(b.x - pl.x, b.y - pl.y))[0];
    if (near && g.stampedeWarn <= 1.2 && Math.hypot(near.x - pl.x, near.y - pl.y) < 60) {
      window.__pc.override = () => ({ x: (near.x - pl.x), y: (near.y - pl.y), pounce: true });
    }
    killed = g.stats.prey > prey0;
  }
  window.__pc.override = null;
  frames.sort((a, b) => a - b);
  return { gnus: n, killed, carcass: g.carcasses.some(c => c.kind === 'gnu'), kinds: g.stats.kinds, p95ms: Math.round(frames[Math.floor(frames.length * 0.95)]) };
});
console.log(JSON.stringify(r));
await p.screenshot({ path: 'tools/shots/fix/stampede.png' });
console.log(errs.join('\n') || 'no errors');
await b.close();

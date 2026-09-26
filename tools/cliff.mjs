import { chromium } from '../../Primal-Chase-Fable/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => console.log('PAGEERR ' + e.stack));
await p.goto('http://127.0.0.1:8791/index.html'); await p.waitForTimeout(1000);
await p.click('#btn-start'); await p.waitForTimeout(500);
const r = await p.evaluate(() => { const g = window.__pc.game; const W = g.world; g.hunters.forEach(h => { h.x += 9000; }); g.band.x += 9000; g.scoutT = 1e9;
  for (let rr = 800; rr < 9000; rr += 60) for (let a = 0; a < 80; a++) { const x = Math.cos(a/80*6.28)*rr, y = Math.sin(a/80*6.28)*rr;
    if (W.T.ground(x, y) === 16 && W.T.ground(x, y + 12) !== 16) { g.player.x = x; g.player.y = y + 22; window.__pc.renderer.camInit = false; g.clock = 0.3; return [x, y]; } }
  return null; });
console.log(r);
await p.waitForTimeout(1500); await p.screenshot({ path: 'tools/shots/cliff.png' });
await b.close();

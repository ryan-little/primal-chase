import { chromium } from '../../Primal-Chase-Fable/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => console.log('PAGEERR ' + e.stack));
await p.goto('http://127.0.0.1:8791/index.html'); await p.waitForTimeout(1000);
await p.click('#btn-start'); await p.waitForTimeout(500);
await p.evaluate(() => { const g = window.__pc.game; g.hunters.forEach(h => { h.x += 9000; }); g.band.x += 9000; g.scoutT = 1e9; g.player.water = 100; });
for (const bi of [1, 2, 3, 4, 5, 6]) {
  const ok = await p.evaluate((bi) => { const g = window.__pc.game; const W = g.world;
    for (let r = 500; r < 9000; r += 150) for (let a = 0; a < 40; a++) { const x = Math.cos(a/40*6.28)*r, y = Math.sin(a/40*6.28)*r;
      if (W.T.biomeAt(x, y) !== bi) continue;
      if (bi === 4 && W.T.levelAt(x, y) < 2) continue;
      if (bi === 6 && W.T.ground(x, y) !== 12) continue;
      const gg = W.T.ground(x, y); if (gg === 13 || gg === 16 || gg === 8) continue;
      g.player.x = x; g.player.y = y; window.__pc.renderer.camInit = false; g.clock = 0.3; return true; }
    return false; }, bi);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `tools/shots/biome-${bi}.png` });
  console.log(bi, ok);
}
await b.close();

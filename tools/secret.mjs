import { chromium } from '../../Primal-Chase-Fable/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => console.log('PAGEERR ' + e.stack));
await p.goto('http://127.0.0.1:8791/index.html'); await p.waitForTimeout(1000);
await p.click('#btn-start'); await p.waitForTimeout(500);
const types = process.argv.slice(2);
for (const ty of types) {
  const r = await p.evaluate((ty) => { const g = window.__pc.game; const W = g.world; g.hunters.forEach(h => { h.x += 9000; }); g.band.x += 9000; g.scoutT = 1e9;
    for (let i = -7; i <= 7; i++) for (let j = -7; j <= 7; j++) { const lm = W.landmark(i, j); if (lm && lm.type === ty) { g.player.x = lm.x; g.player.y = lm.y + 70; window.__pc.renderer.camInit = false; g.clock = 0.35; return [lm.x, lm.y]; } }
    return null; }, ty);
  console.log(ty, r);
  await p.waitForTimeout(1200); await p.screenshot({ path: `tools/shots/lm-${ty}.png` });
}
// walk into the last one to discover it
await p.keyboard.down('KeyW'); await p.waitForTimeout(1600); await p.keyboard.up('KeyW'); await p.waitForTimeout(700);
await p.screenshot({ path: 'tools/shots/lm-discover.png' });
console.log(await p.evaluate(() => JSON.stringify({ found: [...window.__pc.game.found], state: window.__pc.state, lore: document.getElementById('lore').className, title: document.getElementById('lore-title').textContent })));
await b.close();

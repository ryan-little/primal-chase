import { chromium } from '../../Primal-Chase-Fable/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => console.log('PAGEERR ' + e.stack));
await p.goto('http://127.0.0.1:8791/index.html'); await p.waitForTimeout(1000);
await p.click('#btn-start'); await p.waitForTimeout(500);
// stampede
await p.evaluate(() => { const g = window.__pc.game; g.day = 2; g.stampedeT = 0; g.hunters.forEach(h => { h.x += 3000; }); g.band.x += 3000; });
await p.waitForTimeout(2200); await p.screenshot({ path: 'tools/shots/s-stampede.png' });
// hyenas at a carcass
await p.evaluate(() => { const g = window.__pc.game; const q = g.player; g.gnus = []; g.carcasses.push({ id: 999, x: q.x + 40, y: q.y + 10, meat: 60, max: 70, kind: 'gazelle', face: 1, t: 13.5 }); });
await p.waitForTimeout(3500); await p.screenshot({ path: 'tools/shots/s-hyena.png' });
// croc: teleport player into deep water
await p.evaluate(() => { const g = window.__pc.game; const W = g.world; const q = g.player; g.hyenas = [];
  for (let r = 0; r < 3000; r += 16) { let done = false; for (let a = 0; a < 24; a++) { const x = q.x + Math.cos(a/24*6.28)*r, y = q.y + Math.sin(a/24*6.28)*r; W.ensure(x, y, 60, 60, 20); if (W.typeAt(x,y) === 8 && W.typeAt(x+30,y) === 8 && W.typeAt(x-30,y)===8) { q.x = x; q.y = y; done = true; break; } } if (done) break; }
  g.deepT = 5; });
await p.waitForTimeout(400);
await p.evaluate(() => { const g = window.__pc.game; const q = g.player; g.croc = { x: q.x + 50, y: q.y + 5, state: 'stalk', t: 0, face: -1, id: 5 }; });
await p.waitForTimeout(500); await p.screenshot({ path: 'tools/shots/s-croc.png' });
await b.close();

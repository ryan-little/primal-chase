import { chromium } from '../../Primal-Chase-Fable/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.stack));
await p.addInitScript(() => { const s = JSON.parse(localStorage.getItem('pc2_settings') || '{}'); s.cinematic = false; localStorage.setItem('pc2_settings', JSON.stringify(s)); });
await p.goto('http://127.0.0.1:8791/index.html'); await p.waitForTimeout(1000);
await p.click('#btn-start'); await p.waitForTimeout(1500);
const id = process.argv[2];
await p.evaluate((id) => { const g = window.__pc.game, pl = g.player; g.band.x = pl.x + 5000; g.hunters.forEach(h => h.x = pl.x + 5000); g.runners = []; g.dogs = []; g.emit('secret', { secret: id, key: 'test', x: pl.x, y: pl.y }); }, id);
await p.waitForTimeout(1500);
const before = await p.evaluate(() => { const pl = window.__pc.game.player; return { x: pl.x, y: pl.y, held: document.getElementById('lore').className }; });
await p.keyboard.press('Space');
const samples = [];
for (let i = 0; i < 10; i++) { await p.waitForTimeout(50); samples.push(await p.evaluate(() => { const pl = window.__pc.game.player; return [Math.round(pl.x), Math.round(pl.y), pl.state, window.__pc.state]; })); }
console.log(JSON.stringify({ before, lore: await p.evaluate(() => document.getElementById('lore').className), samples }));
console.log(errs.join('\n') || 'no errors');
await b.close();

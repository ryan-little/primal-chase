import { chromium } from '../../Primal-Chase-Fable/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => console.log('PAGEERR ' + e.stack));
await p.goto('http://127.0.0.1:8791/index.html'); await p.waitForTimeout(1000);
await p.click('#btn-start'); await p.waitForTimeout(600);
await p.evaluate(() => { const g = window.__pc.game; g.hunters.forEach(h => { h.x += 9000; }); g.band.x += 9000; g.scoutT = 1e9; g.player.health = 1e6; g.startWeather('storm', 60); g.weather.rain = 1; });
for (let i = 0; i < 6; i++) { await p.waitForTimeout(700); await p.screenshot({ path: `tools/shots/rain-${i}.png` }); }
await p.evaluate(() => { const g = window.__pc.game; g.clock = 0.8; });
await p.waitForTimeout(800); await p.screenshot({ path: 'tools/shots/rain-night.png' });
await b.close();

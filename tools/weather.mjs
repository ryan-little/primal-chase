import { chromium } from '../../Primal-Chase-Fable/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => console.log('PAGEERR ' + e.stack));
await p.goto('http://127.0.0.1:8791/index.html'); await p.waitForTimeout(1000);
await p.click('#btn-start'); await p.waitForTimeout(600);
await p.evaluate(() => { const g = window.__pc.game; g.hunters.forEach(h => { h.x += 9000; }); g.band.x += 9000; g.scoutT = 1e9; g.player.health = 1e6; });
const scen = [
  ['fog', () => { const g = window.__pc.game; g.weather.fogDawn = true; g.clock = 0.05; g.weather.fog = 1; }],
  ['dust', () => { const g = window.__pc.game; g.weather.fogDawn = false; g.weather.fog = 0; g.clock = 0.3; g.startWeather('dust', 60); g.weather.dust = 1; }],
  ['heat', () => { const g = window.__pc.game; g.weather.kind = 'clear'; g.weather.dust = 0; g.weather.heatDay = true; g.weather.heat = 1; g.clock = 0.35; }],
  ['storm', () => { const g = window.__pc.game; g.weather.heatDay = false; g.weather.heat = 0; g.startWeather('storm', 60); g.weather.rain = 1; g.weather.strikeT = 0; }],
  ['fire', () => { const g = window.__pc.game; g.weather.kind = 'clear'; g.weather.target = 0; g.weather.rain = 0; const q = g.player; for (let i = 0; i < 12; i++) g.ignite(q.x + 60 + i * 8, q.y - 20 + (i % 3) * 8); }],
];
for (const [name, fn] of scen) {
  await p.evaluate(fn);
  await p.waitForTimeout(name === 'fire' ? 5000 : name === 'storm' ? 1100 : 1500);
  await p.screenshot({ path: `tools/shots/w-${name}.png` });
}
await p.evaluate(() => { window.__pc.game.clock = 0.8; });
await p.waitForTimeout(600); await p.screenshot({ path: 'tools/shots/w-firenight.png' });
console.log(await p.evaluate(() => JSON.stringify({ fire: window.__pc.game.fire.size, burnt: window.__pc.game.burnt.size })));
await b.close();

import { chromium } from '../../Primal-Chase-Fable/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge', args: ['--disable-gpu-vsync'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto('http://127.0.0.1:8791/index.html'); await p.waitForTimeout(1000);
await p.click('#btn-start');
await p.evaluate(async () => { const { makeBot } = await import('/tools/bot.js'); const bot = makeBot(2); window.__pc.override = (g) => bot(g); });
await p.waitForTimeout(2000);
const r = await p.evaluate(() => new Promise((res) => { const ts = []; let last = performance.now(); const f = (n) => { ts.push(n - last); last = n; if (ts.length < 600) requestAnimationFrame(f); else res(ts); }; requestAnimationFrame(f); }));
r.sort((a, b) => a - b);
console.log('median', r[300].toFixed(1), 'p95', r[570].toFixed(1), 'max', r[599].toFixed(1));
// cost of draw alone
const c = await p.evaluate(() => { const R = window.__pc.renderer, g = window.__pc.game; const t0 = performance.now(); for (let i = 0; i < 100; i++) R.draw(g, 0.016, true); const t1 = performance.now(); for (let i = 0; i < 100; i++) g.update(0.016, { x: 1, y: 0 }); return [(t1 - t0) / 100, (performance.now() - t1) / 100]; });
console.log('draw ms', c[0].toFixed(2), 'update ms', c[1].toFixed(2));
await b.close();

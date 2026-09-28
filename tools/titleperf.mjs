// CPU cost of sitting on the title screen: main-thread busy time and frame pacing over 10 s.
//   node tools/titleperf.mjs [port]
import { chromium } from 'file:///C:/Users/ryan/Projects/Primal-Chase-Fable/node_modules/playwright/index.mjs';
const port = +(process.argv[2] || 8791);
const b = await chromium.launch({ channel: 'msedge', args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.addInitScript(() => { localStorage.setItem('pc2_settings', JSON.stringify({ cinematic: false })); });
await p.goto(`http://127.0.0.1:${port}/index.html`);
await p.waitForTimeout(4000);
const cdp = await p.context().newCDPSession(p);
await cdp.send('Performance.enable');
const m = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
await p.evaluate(() => { window.__fr = []; let l = performance.now(); const f = (t) => { window.__fr.push(t - l); l = t; requestAnimationFrame(f); }; requestAnimationFrame(f); });
const a = await m(); const t0 = Date.now();
await p.waitForTimeout(10000);
const z = await m(); const secs = (Date.now() - t0) / 1000;
const fr = await p.evaluate(() => window.__fr);
const avg = fr.reduce((s, x) => s + x, 0) / fr.length;
const d = (k) => ((z[k] - a[k]) / secs * 1000).toFixed(0);
console.log(JSON.stringify({ taskMsPerSec: d('TaskDuration'), scriptMsPerSec: d('ScriptDuration'), layoutMsPerSec: d('LayoutDuration'), recalcStyleMsPerSec: d('RecalcStyleDuration'), fps: (1000 / avg).toFixed(1), p95FrameMs: fr.sort((x, y) => x - y)[Math.floor(fr.length * 0.95)].toFixed(1), heapMB: (z.JSHeapUsedSize / 1e6).toFixed(1) }));
console.log(errs.join('\n') || 'no errors');
await b.close();

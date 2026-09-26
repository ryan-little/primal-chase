import { chromium } from '../../Primal-Chase-Fable/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => console.log('PAGEERR ' + e.stack));
await p.goto('http://127.0.0.1:8791/index.html');
for (let i = 1; i <= 4; i++) { await p.waitForTimeout(12000); await p.screenshot({ path: `tools/shots/attract-${i}.png` }); }
await p.click('#btn-how'); await p.waitForTimeout(500); await p.screenshot({ path: 'tools/shots/how.png' });
await b.close();

import { chromium } from '../../Primal-Chase-Fable/node_modules/playwright/index.mjs';
const seed = process.argv[2] || 1;
const b = await chromium.launch({ channel: 'msedge' }); const p = await b.newPage({ viewport: { width: 560, height: 560 } });
p.on('pageerror', e => console.log('ERR', e.stack));
await p.goto('http://127.0.0.1:8791/tools/map.html?seed=' + seed); await p.waitForFunction(() => window.result, null, { timeout: 120000 });
console.log(JSON.stringify(await p.evaluate(() => window.result)));
await p.screenshot({ path: `tools/shots/map-${seed}.png` }); await b.close();

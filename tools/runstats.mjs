import { chromium } from '../../Primal-Chase-Fable/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' }); const p = await b.newPage();
p.on('pageerror', e => console.log('ERR', e.stack));
await p.goto('http://127.0.0.1:8791/tools/stats.html'); await p.waitForFunction(() => window.ready);
console.log('types: grass lush tall sand clay mud rock shallow deep');
for (const r of await p.evaluate(() => window.stats([1, 2, 3, 4]))) console.log(JSON.stringify(r));
await b.close();

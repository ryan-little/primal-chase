import { chromium } from '../../Primal-Chase-Fable/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' }); const p = await b.newPage();
await p.goto('http://127.0.0.1:8791/tools/q.html'); await p.waitForFunction(() => window.result);
console.log(JSON.stringify(await p.evaluate(() => window.result), null, 1)); await b.close();

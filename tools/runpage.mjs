import { chromium } from '../../Primal-Chase-Fable/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' }); const p = await b.newPage();
p.on('pageerror', e => console.log('ERR', e.stack));
await p.goto('http://127.0.0.1:8791/tools/' + process.argv[2]); await p.waitForFunction(() => window.result, null, { timeout: 300000 });
console.log(JSON.stringify(await p.evaluate(() => window.result))); await b.close();

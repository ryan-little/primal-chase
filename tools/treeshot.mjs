// Tree/prop variant sheet + clipping report. Needs tools/serve.mjs running.
// node tools/treeshot.mjs [port] [out.png] [kind,kind,...]
import { chromium } from 'file:///C:/Users/ryan/Projects/Primal-Chase-Fable/node_modules/playwright/index.mjs';
const [,, port = '8791', out = 'tools/shots/trees-sheet.png', kinds = ''] = process.argv;
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1600, height: 2400 } });
p.on('pageerror', (e) => console.log('PAGEERR ' + e.stack));
p.on('console', (m) => { if ((m.type() === 'warning' || m.type() === 'error') && !m.text().includes('willReadFrequently')) console.log(m.type(), m.text()); });
await p.goto(`http://127.0.0.1:${port}/tools/treesheet.html${kinds ? '?k=' + kinds : ''}`);
await p.waitForFunction(() => window.done, null, { timeout: 30000 });
const res = await p.evaluate(() => ({ stats: window.stats, clipped: window.clipped }));
console.log(JSON.stringify(res, null, 1));
await p.screenshot({ path: out, clip: { x: 0, y: 0, width: 1600, height: Math.min(2400, res.stats.height + 10) } });
await b.close();

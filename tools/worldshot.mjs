// Screenshots tools/worldmap.html: node tools/worldshot.mjs out.png "mode=biome&R=6000&N=700"
import { chromium } from 'file:///C:/Users/ryan/tools/pw/node_modules/playwright-core/index.mjs';
const [out, qs = ''] = process.argv.slice(2);
const N = +(new URLSearchParams(qs).get('N') || 700);
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: N, height: N } });
p.on('pageerror', (e) => console.log('PAGEERR ' + e.message));
await p.goto('http://127.0.0.1:8791/tools/worldmap.html?' + qs);
await p.waitForFunction(() => window.done, null, { timeout: 120000 });
await p.screenshot({ path: out });
await b.close();

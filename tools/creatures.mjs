// Renders tools/creatures.html without a dev server (requests are served from disk via Playwright
// routing) and prints the canvas-edge clipping audit.  usage: node tools/creatures.mjs out.png [scale]
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pw = [path.join(root, '../Primal-Chase-Fable'), path.join(root, '../../../../Primal-Chase-Fable')]
  .map((d) => path.join(d, 'node_modules/playwright/index.mjs')).find(existsSync);
const { chromium } = await import(pathToFileURL(pw).href);
const [,, out = 'tools/shots/creatures.png', s = '4', only = ''] = process.argv;
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1800, height: 3600 } });
p.on('pageerror', (e) => console.log('ERR', e.stack));
await p.route('http://pc.local/**', async (r) => {
  const f = path.join(root, decodeURIComponent(new URL(r.request().url()).pathname));
  try { await r.fulfill({ body: await readFile(f), contentType: /\.m?js$/.test(f) ? 'text/javascript' : 'text/html' }); }
  catch { await r.fulfill({ status: 404, body: '' }); }
});
await p.goto('http://pc.local/tools/creatures.html?s=' + s + (only ? '&only=' + only : '') + (process.argv[5] ? '&gait=' + process.argv[5] : ''));
await p.waitForFunction(() => window.result, null, { timeout: 60000 });
const res = await p.evaluate(() => window.result);
await p.screenshot({ path: out, clip: { x: 0, y: 0, width: 1800, height: Math.min(3600, res.h + 4) } });
console.log('clipped:', res.clip.length ? '\n' + res.clip.join('\n') : 'none', '\nheight', res.h);
await b.close();

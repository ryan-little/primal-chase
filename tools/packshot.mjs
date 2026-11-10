// Screenshot helper for the sprite pack: node tools/packshot.mjs <url> <out.png> [w] [h] [wait ms] [selector]
// Finds playwright-core wherever this machine has it.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const tries = [
  '../../../tools/pw/node_modules/playwright-core/index.mjs',
  '../../felt.gg/node_modules/playwright-core/index.mjs',
  '../../Primal-Chase-Fable/node_modules/playwright/index.mjs',
].map((p) => path.resolve(here, p));
const lib = tries.find((p) => fs.existsSync(p));
if (!lib) { console.error('playwright-core not found'); process.exit(1); }
const { chromium } = await import(pathToFileURL(lib).href);
const [,, url, out, w = '1400', h = '1000', wait = '600', sel = ''] = process.argv;
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errs = [];
p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('willReadFrequently')) errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(String(e.stack || e)));
await p.goto(url);
await p.waitForFunction(() => window.done === true, null, { timeout: 30000 }).catch(() => errs.push('timeout waiting for window.done'));
await p.waitForTimeout(+wait);
if (sel) await p.locator(sel).first().screenshot({ path: out });
else await p.screenshot({ path: out, fullPage: h === '0' });
const info = await p.evaluate(() => window.info || null);
if (info) console.log(JSON.stringify(info));
console.log(errs.join('\n') || 'no errors');
await b.close();

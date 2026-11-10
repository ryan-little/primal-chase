// Bake the sprite pack into one self-contained HTML file (every strip inlined as a PNG):
//   node tools/packexport.mjs [out.html] [port]
// Needs the static server running (node tools/serve.mjs) and playwright-core + Edge.
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
const out = path.resolve(process.argv[2] || path.join(here, 'spritepack-static.html'));
const port = process.argv[3] || '8791';
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
p.on('pageerror', (e) => console.error(String(e)));
await p.goto(`http://127.0.0.1:${port}/tools/spritepack.html`);
await p.waitForFunction(() => window.done === true, null, { timeout: 60000 });
const json = await p.evaluate(() => window.exportPack());
const info = await p.evaluate(() => window.info);
await b.close();
let html = fs.readFileSync(path.join(here, 'spritepack.html'), 'utf8');
html = html.replace('<!--PACK_DATA-->', () => `<script>window.PACK_DATA = ${json.replace(/<\//g, '<\/')};</script>`);
fs.writeFileSync(out, html);
console.log('wrote', out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB', JSON.stringify(info.missing));

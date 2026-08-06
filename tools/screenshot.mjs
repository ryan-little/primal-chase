// Screenshot harness: builds nothing itself — serves the existing dist/ and
// captures the viewer at a given location/time. Uses the real GPU (no
// software rasterizer flags), one page, one shot, exit.
//
// Run: node tools/screenshot.mjs "seed=7&x=0&z=0&sun=0.55" out.png

import { createServer } from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const query = process.argv[2] ?? 'seed=7&x=0&z=0';
const outName = process.argv[3] ?? 'shot.png';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const outDir = join(root, 'debug');
mkdirSync(outDir, { recursive: true });

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png'
};

const server = createServer((req, res) => {
  const path = (req.url ?? '/').split('?')[0];
  const file = join(dist, path === '/' ? 'index.html' : path);
  try {
    const data = readFileSync(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('nope');
  }
});

await new Promise((r) => server.listen(8788, r));

const browser = await chromium.launch({
  // Real GPU: ANGLE default; explicitly avoid swiftshader fallback silently
  // burning CPU.
  args: ['--use-angle=default', '--disable-software-rasterizer']
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
page.on('pageerror', (e) => console.error('[pageerror]', e.message));

await page.goto(`http://127.0.0.1:8788/?${query}`);
await page.waitForFunction(() => window.__READY === true, undefined, { timeout: 60000 });
const out = join(outDir, outName);
await page.screenshot({ path: out });
await browser.close();
server.close();
console.log(out);

// Automated smoke playtest: boots the real game in Chromium (real GPU),
// plays a few turns through the same code paths a human uses, screenshots
// each state, and prints the sim state line by line.
//
// Run: node tools/playtest.mjs [seed] [turns]

import { createServer } from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const seed = process.argv[2] ?? '7';
const turns = Number(process.argv[3] ?? 4);

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const outDir = join(root, 'debug');
mkdirSync(outDir, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer((req, res) => {
  const path = (req.url ?? '/').split('?')[0];
  const file = join(dist, path === '/' ? 'index.html' : path);
  try {
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8789, r));

const browser = await chromium.launch({ args: ['--use-angle=default', '--disable-software-rasterizer'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('[console]', m.text()); });

await page.goto(`http://127.0.0.1:8789/?test=1&seed=${seed}`);
await page.waitForFunction(() => window.__READY === true, undefined, { timeout: 90000 });

const stateLine = () => page.evaluate(() => {
  const s = window.__pc.game.state;
  return `day ${s.day} ${s.phase} | heat ${Math.round(s.heat)} legs ${Math.round(s.stamina)} ` +
    `thirst ${Math.round(s.thirst)} hunger ${Math.round(s.hunger)} | hunters ${s.hunters.distance.toFixed(1)}mi ` +
    `${s.hunters.state} | alive ${s.isAlive}`;
});

console.log('boot:', await stateLine());
await page.screenshot({ path: join(outDir, `play-${seed}-0-boot.png`) });

for (let t = 1; t <= turns; t++) {
  // Alternate far moves with an occasional rest.
  if (t % 3 === 0) {
    await page.evaluate(() => window.__pc.doAction('rest'));
  } else {
    await page.evaluate(() => { window.__READY = false; window.__pc.doFarthestMove(); });
  }
  await page.waitForFunction(() => window.__READY === true, undefined, { timeout: 60000 });
  await page.waitForTimeout(400);
  console.log(`turn ${t}:`, await stateLine());
  await page.screenshot({ path: join(outDir, `play-${seed}-${t}.png`) });
  const dead = await page.evaluate(() => !window.__pc.game.state.isAlive);
  if (dead) { console.log('died — capturing death screen'); break; }
}

await browser.close();
server.close();
console.log('done; screenshots in debug/');

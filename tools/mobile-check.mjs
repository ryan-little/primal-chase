// Mobile viewport check: boot the game at phone size, screenshot title + play.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { chromium } from 'playwright';

const dist = 'C:/Users/ryan/Projects/Primal-Chase-Fable/dist';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer((req, res) => {
  const p = (req.url ?? '/').split('?')[0];
  const f = join(dist, p === '/' ? 'index.html' : p);
  try { res.writeHead(200, {'content-type': MIME[extname(f)] ?? 'application/octet-stream'}); res.end(readFileSync(f)); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8790, r));
const browser = await chromium.launch({ args: ['--use-angle=default'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto('http://127.0.0.1:8790/?seed=7');
await page.waitForTimeout(9000);
await page.screenshot({ path: 'C:/Users/ryan/Projects/Primal-Chase-Fable/debug/mobile-title.png' });
// Enter play via test hooks? title mode: tap Begin.
await page.tap('text=Begin the Chase');
await page.waitForTimeout(1200);
await page.tap('body'); await page.waitForTimeout(400);
await page.tap('body'); await page.waitForTimeout(400);
await page.tap('body'); await page.waitForTimeout(400);
await page.tap('body'); await page.waitForTimeout(400);
await page.tap('body'); await page.waitForTimeout(1500);
await page.screenshot({ path: 'C:/Users/ryan/Projects/Primal-Chase-Fable/debug/mobile-play.png' });
await browser.close(); server.close();
console.log('mobile shots done');

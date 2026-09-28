import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../Primal-Chase-Fable/node_modules/playwright/index.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url))); // repo root
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png', '.css': 'text/css' };

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  let p = decodeURIComponent(u.pathname);
  if (p === '/') p = '/tools/clipaudit.html';
  const fp = path.join(ROOT, p);
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found: ' + fp); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const b = await chromium.launch({ channel: 'msedge', args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1000, height: 800 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(String(e)));

await p.goto(`http://127.0.0.1:${port}/tools/clipaudit.html`);
await p.waitForFunction(() => window.done === true, { timeout: 20000 });

const report = await p.evaluate(() => window.__report);
const spriteCount = await p.evaluate(() => window.__spriteCount);

fs.writeFileSync(path.join(ROOT, 'tools', 'clipaudit-report.json'), JSON.stringify(report, null, 1));

const viz = await p.$('#viz');
await viz.screenshot({ path: path.join(ROOT, 'tools', 'clipaudit-worst.png') });

console.log('sprites scanned:', spriteCount);
console.log('sprites with any edge-touching opaque pixel:', report.length);
console.log('page errors:', errs.join(' | ') || 'none');
console.log('--- top 40 by total edge pixels ---');
for (const r of report.slice(0, 40)) {
  console.log(`${r.total}\t${r.w}x${r.h}\tt${r.edges.top} b${r.edges.bottom} l${r.edges.left} r${r.edges.right}\t${r.name}`);
}

await b.close();
server.close();

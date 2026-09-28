// Shared rig for the offline audio renders: serves the repo on an ephemeral port and opens tools/audio.html.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PW = process.env.PW || path.resolve(root, '../Primal-Chase-Fable/node_modules/playwright/index.mjs');
const alt = 'C:/Users/ryan/Projects/Primal-Chase-Fable/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(fs.existsSync(PW) ? PW : alt).href);
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html' };
export async function openRig() {
  const srv = http.createServer((req, res) => {
    const f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(f, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const b = await chromium.launch({ channel: 'msedge' });
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.stack));
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'log') console.log('PAGE', m.text()); });
  await p.goto(`http://127.0.0.1:${srv.address().port}/tools/audio.html`);
  await p.waitForFunction(() => window.ready);
  return { p, close: async () => { await b.close(); srv.close(); } };
}

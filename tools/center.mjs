import { chromium } from '../../Primal-Chase-Fable/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' });
for (const [w, h, dsf] of [[1000, 548, 2], [1600, 900, 1.25], [1280, 720, 1]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('PAGEERR ' + e.stack));
  await p.goto('http://127.0.0.1:8791/index.html'); await p.waitForTimeout(800);
  await p.click('#btn-start'); await p.waitForTimeout(4200);
  const r = await p.evaluate(() => { const q = (id) => { const e = document.getElementById(id).getBoundingClientRect(); return [Math.round(e.left), Math.round(e.right), Math.round((e.left + e.right) / 2)]; }; return { vw: innerWidth, doc: document.documentElement.scrollWidth, hud: q('hud'), tracker: q('tracker'), toast: q('toast'), card: q('card'), score: q('score-box') }; });
  console.log(w, JSON.stringify(r));
  await p.screenshot({ path: `tools/shots/center-${w}.png` });
  await ctx.close();
}
await b.close();

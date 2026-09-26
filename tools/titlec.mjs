import { chromium } from '../../Primal-Chase-Fable/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' });
for (const [w, h, dsf] of [[1000, 548, 2], [1600, 900, 1]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8791/index.html'); await p.waitForTimeout(2500);
  const r = await p.evaluate(() => { const e = document.querySelector('#title .title-bottom').getBoundingClientRect(); const l = document.getElementById('logo').getBoundingClientRect(); return { card: [Math.round(e.left), Math.round(e.right), Math.round((e.left + e.right) / 2), Math.round(e.top), Math.round(e.bottom)], logo: Math.round((l.left + l.right) / 2), vw: innerWidth }; });
  console.log(w, JSON.stringify(r));
  await p.screenshot({ path: `tools/shots/titlec-${w}.png` });
  await ctx.close();
}
await b.close();

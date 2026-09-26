import { chromium, devices } from '../../Primal-Chase-Fable/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' });
for (const [name, vp] of [['landscape', { width: 844, height: 390 }], ['portrait', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('ERR', e.stack));
  await p.goto('http://127.0.0.1:8791/index.html'); await p.waitForTimeout(1200);
  await p.screenshot({ path: `tools/shots/m-${name}-title.png` });
  await p.tap('#btn-start'); await p.waitForTimeout(600);
  // simulate a touch drag on the left
  const cdp = await ctx.newCDPSession(p);
  const x0 = vp.width * 0.2, y0 = vp.height * 0.7;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 1 }] });
  for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + i * 6, y: y0 - i * 3, id: 1 }] }); await p.waitForTimeout(40); }
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `tools/shots/m-${name}-play.png` });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const st = await p.evaluate(() => ({ x: window.__pc.game.player.x | 0, y: window.__pc.game.player.y | 0, touch: document.body.className }));
  console.log(name, JSON.stringify(st));
  await ctx.close();
}
await b.close();

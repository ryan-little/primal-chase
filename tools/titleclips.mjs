// Screenshots of the clip-backed title, the opening cinematic and its setting.
//   node tools/titleclips.mjs [port] [cine|title|all]
import { chromium } from 'file:///C:/Users/ryan/Projects/Primal-Chase-Fable/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const port = +(process.argv[2] || 8791);
const what = process.argv[3] || 'all';
const out = 'tools/shots/titleclips';
fs.mkdirSync(out, { recursive: true });
const url = `http://127.0.0.1:${port}/index.html`;
const b = await chromium.launch({ channel: 'msedge' });
const errs = [];
const page = async (w, h, cine, touch = false) => {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`${w}x${h} PAGEERR ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(`${w}x${h} ${m.text()}`); });
  if (!cine) await p.addInitScript(() => localStorage.setItem('pc2_settings', JSON.stringify({ cinematic: false })));
  await p.goto(url);
  return p;
};
const vidState = (p) => p.evaluate(() => [...document.querySelectorAll('#clips video')].map((v) => `${v.dataset.clip || '-'}:${v.classList.contains('on') ? 'on' : 'off'}:${v.currentTime.toFixed(1)}/${(v.duration || 0).toFixed(1)}:${v.paused ? 'paused' : 'playing'}`).join(' | ') + ' state=' + window.__pc.state);

if (what === 'all' || what === 'cine') {
  const p = await page(1600, 900, true);
  let t = 0;
  for (const at of [2.5, 7, 12, 17, 22, 27, 30.5, 34]) {
    await p.waitForTimeout((at - t) * 1000); t = at;
    await p.screenshot({ path: `${out}/cine-${String(at).replace('.', '_')}s.png` });
    console.log('cine', at, await vidState(p));
  }
  await p.waitForTimeout(3000);
  console.log('after cine', await vidState(p));
  await p.screenshot({ path: `${out}/cine-end-title.png` });
  await p.context().close();
  // skip with a key, then with a tap on a phone
  const q = await page(1280, 720, true);
  await q.waitForTimeout(3000);
  await q.keyboard.press('KeyX');
  await q.waitForTimeout(900);
  console.log('skip by key ->', await q.evaluate(() => window.__pc.state));
  await q.screenshot({ path: `${out}/cine-skipped.png` });
  await q.context().close();
  const r = await page(390, 844, true, true);
  await r.waitForTimeout(3500);
  await r.screenshot({ path: `${out}/cine-phone.png` });
  await r.tap('#cine');
  await r.waitForTimeout(900);
  console.log('skip by tap ->', await r.evaluate(() => window.__pc.state));
  await r.context().close();
}
if (what === 'all' || what === 'title') {
  for (const [w, h, touch] of [[1600, 900, false], [390, 844, true], [844, 390, true]]) {
    const p = await page(w, h, false, touch);
    await p.waitForTimeout(3000);
    await p.screenshot({ path: `${out}/title-${w}x${h}.png` });
    console.log('title', w, h, await vidState(p));
    if (w === 1600) {
      // ride through a cut
      await p.waitForTimeout(6500);
      console.log('title later', await vidState(p));
      await p.screenshot({ path: `${out}/title-${w}x${h}-later.png` });
      await p.click('#btn-settings');
      await p.waitForTimeout(400);
      await p.screenshot({ path: `${out}/settings.png` });
      await p.click('#set-cine-on');
      console.log('setting saved', await p.evaluate(() => localStorage.getItem('pc2_settings')));
      await p.click('#set-cine-off');
      console.log('setting saved', await p.evaluate(() => localStorage.getItem('pc2_settings')));
      await p.screenshot({ path: `${out}/settings-off.png` });
      await p.click('[data-back]:visible');
      await p.click('#btn-start');
      await p.waitForTimeout(1500);
      console.log('in run', await vidState(p));
      await p.screenshot({ path: `${out}/run.png` });
    }
    await p.context().close();
  }
}
console.log(errs.join('\n') || 'no errors');
await b.close();

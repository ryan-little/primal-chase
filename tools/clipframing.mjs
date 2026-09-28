// Screenshots of the title reel and the opening over the recorded clips, at desktop, portrait
// phone and landscape phone sizes, to check the action sits clear of the logo, menu and lines.
//   node tools/clipframing.mjs [port]      -> tools/shots/clipframing/
import { chromium } from 'file:///C:/Users/ryan/Projects/Primal-Chase-Fable/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const port = +(process.argv[2] || 8791);
const out = 'tools/shots/clipframing';
fs.mkdirSync(out, { recursive: true });
const url = `http://127.0.0.1:${port}/index.html`;
const b = await chromium.launch({ channel: 'msedge' });
const errs = [];
const SIZES = [[1600, 900, false], [390, 844, true], [844, 390, true]];
// title: hold chosen clips at chosen moments
const HOLD = [['chase', 2.4], ['stampede', 1.4], ['night', 3], ['hunt', 1.6], ['storm', 1.62], ['fire', 3]];
for (const [w, h, touch] of SIZES) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`${w}x${h} PAGEERR ${e.message}`));
  await p.addInitScript(() => localStorage.setItem('pc2_settings', JSON.stringify({ cinematic: false })));
  await p.goto(url);
  await p.waitForTimeout(1500);
  for (const [clip, at] of HOLD) {
    const ok = await p.evaluate(async ({ clip, at }) => {
      const vs = [...document.querySelectorAll('#clips video')];
      const v = vs.find((x) => x.classList.contains('top')) || vs[0];
      for (const o of vs) if (o !== v) o.classList.remove('on');
      v.pause();
      if (v.dataset.clip !== clip) { v.dataset.clip = clip; v.src = `assets/clips/${clip}.mp4`; await new Promise((r) => v.addEventListener('loadeddata', r, { once: true })); }
      v.currentTime = at;
      await new Promise((r) => v.addEventListener('seeked', r, { once: true }));
      v.style.transition = 'none'; v.classList.add('on', 'top');
      return v.videoWidth + 'x' + v.videoHeight;
    }, { clip, at });
    await p.waitForTimeout(150);
    await p.screenshot({ path: `${out}/title-${w}x${h}-${clip}.png` });
    if (w === 1600) console.log('title', clip, ok);
  }
  await ctx.close();
}
// the opening, in real time
for (const [w, h, touch] of SIZES) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`${w}x${h} cine PAGEERR ${e.message}`));
  await p.goto(url);
  let t = 0;
  for (const at of [3, 7.5, 12, 17, 22.5, 27]) {
    await p.waitForTimeout((at - t) * 1000); t = at;
    await p.screenshot({ path: `${out}/cine-${w}x${h}-${String(at).replace('.', '_')}s.png` });
    const st = await p.evaluate(() => [...document.querySelectorAll('#clips video')].map((v) => `${v.dataset.clip}:${v.classList.contains('top') ? 'top' : ''}:${v.currentTime.toFixed(1)}`).join(' '));
    console.log('cine', `${w}x${h}`, at, st);
  }
  await ctx.close();
}
console.log(errs.join('\n') || 'no errors');
await b.close();

import { chromium } from '../../Primal-Chase-Fable/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge', args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage();
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.stack));
await p.addInitScript(() => { const s = JSON.parse(localStorage.getItem('pc2_settings') || '{}'); s.cinematic = false; localStorage.setItem('pc2_settings', JSON.stringify(s)); });
await p.goto('http://127.0.0.1:8791/index.html'); await p.waitForTimeout(1000);
await p.click('#btn-start'); await p.waitForTimeout(2000);
console.log(JSON.stringify(await p.evaluate(async () => {
  const a = window.__pc.audio, out = {};
  let hidden = false; Object.defineProperty(document, 'hidden', { get: () => hidden, configurable: true });
  hidden = true; document.dispatchEvent(new Event('visibilitychange'));
  await new Promise(r => setTimeout(r, 300)); out.hiddenState = a.ctx.state;
  hidden = false; document.dispatchEvent(new Event('visibilitychange'));
  await new Promise(r => setTimeout(r, 300)); out.visibleState = a.ctx.state;
  // simulate a 5 s stall: count how many steps get scheduled in one update
  let n = 0; const orig = a.schedule.bind(a); a.schedule = (...x) => { n++; return orig(...x); };
  a.nextTime = a.ctx.currentTime - 5; a.update(0.016); out.stepsAfterStall = n;
  a.schedule = orig;
  return out;
})));
console.log(errs.join('\n') || 'no errors');
await b.close();

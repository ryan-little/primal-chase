// Firefox-engine check with autoplay fully blocked (Zen's "block audio and video").
import { chromium } from '../../Primal-Chase-Fable/node_modules/playwright/index.mjs';
// Simulated in Edge: play() rejects with NotAllowedError until the page has had a user activation.
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.addInitScript(() => {
  const orig = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    if (!navigator.userActivation.hasBeenActive) return Promise.reject(new DOMException('blocked', 'NotAllowedError'));
    return orig.call(this);
  };
});
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
await p.goto('http://127.0.0.1:8791/index.html'); await p.waitForTimeout(2500);
const snap = () => p.evaluate(() => ({ state: window.__pc.state, hint: document.getElementById('cine-skip').innerText, playing: [...document.querySelectorAll('#clips video')].some(v => !v.paused && v.currentTime > 0), t: [...document.querySelectorAll('#clips video')].map(v => +v.currentTime.toFixed(2)) }));
console.log('load', JSON.stringify(await snap()));
await p.keyboard.press('Space'); await p.waitForTimeout(2500);
console.log('after 1st key', JSON.stringify(await snap()));
await p.keyboard.press('Space'); await p.waitForTimeout(1500);
console.log('after 2nd key', JSON.stringify(await snap()));
console.log(errs.join('\n') || 'no errors');
await b.close();

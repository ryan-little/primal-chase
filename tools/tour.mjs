// Drives the real game with the bot and screenshots interesting moments.
import { chromium } from '../../Primal-Chase-Fable/node_modules/playwright/index.mjs';
const out = process.argv[2] || 'tools/shots/tour';
const W = +(process.argv[3]||1280), H = +(process.argv[4]||720), secs = +(process.argv[5]||150);
import fs from 'fs'; fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: 'msedge', args:['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: W, height: H } });
p.on('pageerror', e => console.log('PAGEERR ' + e.stack));
await p.goto('http://127.0.0.1:8791/index.html'); await p.waitForTimeout(1200);
await p.click('#btn-start'); await p.waitForTimeout(300);
await p.evaluate(async () => { const { makeBot } = await import('/tools/bot.js'); const bot = makeBot(2); window.__pc.game.player.health = 100; window.__pc.override = (g) => bot(g);
  window.__shotQ = []; const g0 = window.__pc.game; const seen = {};
  const orig = g0.emit.bind(g0); g0.emit = (t, d) => { if (['windup','kill','rain','dusk','dawn','scoutsee','hurt','trailcold','secret','perkchoice','intercept','linewarn','pride','weather','strike','wildfire','golden','drop','stampede','croc','hyenas'].includes(t) && !seen[t]) { seen[t] = 1; window.__shotQ.push(t); } orig(t, d); }; });
let n = 0; const t0 = Date.now();
while ((Date.now() - t0) / 1000 < secs) {
  await p.waitForTimeout(250);
  const q = await p.evaluate(() => { const q = window.__shotQ.slice(); window.__shotQ.length = 0; return { q, st: window.__pc.state, clock: window.__pc.game.clock, day: window.__pc.game.day }; });
  for (const t of q.q) { await p.waitForTimeout(t === 'windup' ? 350 : 150); await p.screenshot({ path: `${out}/${String(++n).padStart(2,'0')}-${t}.png` }); }
  if (q.st === 'perk') { await p.waitForTimeout(300); await p.screenshot({ path: `${out}/${String(++n).padStart(2,'0')}-perkui.png` }); await p.keyboard.press('Digit1'); continue; }
  if (q.st !== 'playing') { await p.waitForTimeout(2500); await p.screenshot({ path: `${out}/${String(++n).padStart(2,'0')}-death.png` }); break; }
  // speed through the calm: fast-forward when nothing is near
  await p.evaluate(() => { const g = window.__pc.game; window.__pc.timeScale = g.hunterDist() > 450 && !g.scout ? 3 : 1; });
}
const s = await p.evaluate(() => { const g = window.__pc.game; return { day: g.day, score: g.score, over: g.over, cause: g.cause }; });
console.log(JSON.stringify(s), 'shots', n);
await b.close();

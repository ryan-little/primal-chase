// UI screenshot tour: every screen and HUD state at 1280x720, plus title, HUD, perk choice and
// death on a phone (390x844 portrait, 844x390 landscape). The same shots every time, so a
// restyle can be compared before and after (tools/uipack.html shows the pairs).
//
//   node tools/uishots.mjs before|after [only-these,comma,separated]
//
// Needs the static server on 127.0.0.1:8791 and playwright-core + Edge (found the way
// tools/packshot.mjs finds them). Math.random is seeded so the world, the title reel and the
// perk offer come out the same on every run.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const tries = [
  '../../../tools/pw/node_modules/playwright-core/index.mjs',
  '../../felt.gg/node_modules/playwright-core/index.mjs',
  '../../Primal-Chase-Fable/node_modules/playwright/index.mjs',
].map((p) => path.resolve(here, p));
const lib = tries.find((p) => fs.existsSync(p));
if (!lib) { console.error('playwright-core not found'); process.exit(1); }
const { chromium } = await import(pathToFileURL(lib).href);

const which = process.argv[2] || 'after';
const only = process.argv[3] ? new Set(process.argv[3].split(',')) : null;
const OUT = path.resolve(here, 'uipack', which);
fs.mkdirSync(OUT, { recursive: true });
const URL = 'http://127.0.0.1:8791/index.html';
const errors = [];
const want = (name) => !only || only.has(name) || [...only].some((o) => name.startsWith(o));

// a returning player: some feats, some secrets, a few runs on the board
const SAVE = {
  settings: { music: 0, sfx: 0, reduceShake: false, hints: true, units: 'metric', cinematic: false },
  feats: ['day2', 'day4', 'hunt', 'glutton', 'takedown', 'whisker', 'ghost', 'escape', 'secret', 'marathon', 'climber', 'pride'],
  journal: { painted: 2, oasis: 1, camp: 3, whale: 1, spire: 1 },
  best: 7420, played: true, hints: [], kinds: ['gazelle', 'hare', 'warthog'],
  runs: [{ score: 7420, day: 4, date: 1 }, { score: 5210, day: 3, date: 2 }, { score: 3020, day: 2, date: 3 }, { score: 1880, day: 2, date: 4 }],
};
function initScript({ save, blockPlay }) {
  // seeded Math.random: same world, same reel, same perk offer
  let s = 0x2f6e2b1;
  Math.random = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  if (!sessionStorage.getItem('seeded')) {
    sessionStorage.setItem('seeded', '1');
    for (const k of Object.keys(localStorage)) if (k.startsWith('pc2_')) localStorage.removeItem(k);
    for (const [k, v] of Object.entries(save)) localStorage.setItem('pc2_' + k, JSON.stringify(v));
  }
  if (blockPlay) HTMLMediaElement.prototype.play = function () { return Promise.reject(new DOMException('blocked', 'NotAllowedError')); };
}

const b = await chromium.launch({ channel: 'msedge', args: ['--autoplay-policy=no-user-gesture-required'] });
async function page(vp, { touch = false, save = SAVE, blockPlay = false, dsf = 1 } = {}) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: dsf, hasTouch: touch, isMobile: touch });
  await ctx.addInitScript(initScript, { save, blockPlay });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${vp.width}x${vp.height}: ${e.stack || e}`));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(`${vp.width}x${vp.height} console: ${m.text()}`); });
  await p.goto(URL);
  await p.waitForFunction(() => window.__pc && document.fonts.status === 'loaded');
  return { ctx, p };
}
const shot = async (p, name, wait = 0) => {
  if (!want(name)) return;
  if (wait) await p.waitForTimeout(wait);
  await p.screenshot({ path: path.join(OUT, name + '.png') });
  console.log('  ' + name);
};
const ev = (p, fn, arg) => p.evaluate(fn, arg);
// park the run in a calm, readable moment: full-ish vitals, the band far behind, no hint queue
const calm = (p) => ev(p, () => {
  const g = window.__pc.game, pl = g.player;
  g.discover = () => {}; // a real secret found on the way would hold the run on its lore card
  Object.assign(pl, { health: 86, heat: 34, water: 64, food: 52, stamina: 90, overheated: false });
  g.band.mode = 'track';
  for (const h of g.hunters) { h.x = pl.x - 700; h.y = pl.y + 200; }
  for (const d of g.dogs) { d.x = pl.x - 700; d.y = pl.y + 220; }
  g.spears.length = 0;
});
const bot = (p, on) => ev(p, async (on) => {
  if (!on) { window.__pc.override = null; return; }
  const { makeBot } = await import('/tools/bot.js');
  const bot = makeBot(2);
  window.__pc.override = (g) => bot(g);
}, on);
const startRun = async (p, touch) => {
  if (touch) await p.tap('#btn-start'); else await p.click('#btn-start');
  await p.waitForFunction(() => window.__pc.state === 'playing');
  await ev(p, () => { window.__pc.game.discover = () => {}; });
  if (!touch) await p.mouse.move(640, 700);
};
const toDeath = async (p) => {
  await ev(p, () => {
    const g = window.__pc.game;
    Object.assign(g.stats, { dist: 3480, prey: 4, breaks: 7, dodges: 6, escapes: 2, secrets: 1, knockdowns: 2, dogs: 1, bestMult: 2.5 });
    g.score = 4860; g.day = 3; g.time = 512;
    g.perks = { coat: 2, ghost: 1, river: 1, pounce: 1 };
    g.die('spear');
  });
  await p.waitForFunction(() => !document.getElementById('death').classList.contains('hidden'), null, { timeout: 15000 })
    .catch(async () => { console.log('  death screen not shown; state', await p.evaluate(() => window.__pc.state), errors.join('\n')); await p.screenshot({ path: path.join(OUT, 'zz-fail.png') }); });
  await p.waitForTimeout(2000);
};

// ---------------- desktop ----------------
console.log('desktop 1280x720');
{
  const { ctx, p } = await page({ width: 1280, height: 720 });
  await p.waitForTimeout(1800);
  await shot(p, 'd01-title');
  await p.hover('#btn-daily'); await shot(p, 'd02-title-hover', 250);
  // keyboard focus moves with the arrows
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown');
  await shot(p, 'd03-title-focus', 200);
  for (const [btn, id, name] of [['#btn-how', 'how', 'd04-how'], ['#btn-feats', 'feats', 'd05-feats'], ['#btn-journal', 'journal', 'd06-journal'], ['#btn-settings', 'settings', 'd07-settings']]) {
    await p.click(btn); await p.mouse.move(5, 5);
    await shot(p, name, 600);
    if (id === 'how') { await p.evaluate(() => { const pn = document.querySelector('#how .panel'); pn.scrollTop = pn.scrollHeight; }); await shot(p, 'd04b-how-bottom', 200); }
    await p.click(`#${id} [data-back]`);
    await p.waitForTimeout(200);
  }
  await startRun(p);
  await shot(p, 'd08-hud-start', 900);
  await bot(p, true);
  await p.waitForTimeout(5000);
  await bot(p, false);
  await calm(p);
  await shot(p, 'd09-hud', 1200);
  // a secret: the held lore card
  await ev(p, () => { const g = window.__pc.game; g.events.push({ type: 'secret', secret: 'painted', x: g.player.x, y: g.player.y }); });
  await shot(p, 'd10-lore', 1200);
  await p.keyboard.press('Space'); await p.waitForTimeout(800);
  // a new dawn: the big banner and the news toast
  await ev(p, () => { const g = window.__pc.game; g.events.push({ type: 'dawn', day: 3 }); });
  await shot(p, 'd11-dawn', 1400);
  await p.waitForTimeout(7000);
  // a hint toast with a key cap
  await ev(p, () => { const g = window.__pc.game; g.player.food = 20; });
  await p.waitForFunction(() => document.getElementById('toast').classList.contains('on'), null, { timeout: 8000 }).catch(() => {});
  await shot(p, 'd12-toast', 500);
  await calm(p);
  // night, overheated, thirsty, and the band in sight
  await ev(p, () => {
    const g = window.__pc.game, pl = g.player;
    g.clock = 0.8; g.mult = 2.5;
    Object.assign(pl, { heat: 100, water: 14, health: 24 });
    pl.overheated = true;
    g.hunters.forEach((h, i) => { h.x = pl.x - 110 - i * 16; h.y = pl.y + 12 * i; });
    for (const h of g.hunters) h.throwCd = 99;
    pl.iframes = 99;
  });
  await shot(p, 'd13-hud-chase-night', 700);
  await calm(p);
  await ev(p, () => { window.__pc.game.clock = 0.3; window.__pc.game.player.iframes = 0; });
  await p.waitForTimeout(600);
  // map
  await p.keyboard.press('Tab');
  await shot(p, 'd14-map', 700);
  await p.keyboard.press('Tab'); await p.waitForTimeout(300);
  // pause, with a few instincts held
  await ev(p, () => { window.__pc.game.perks = { coat: 2, ghost: 1, river: 1 }; });
  await p.keyboard.press('Escape');
  await shot(p, 'd15-pause', 600);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // the dawn instinct choice
  await ev(p, () => { window.__pc.game.perkChoices = 1; });
  await p.waitForFunction(() => window.__pc.state === 'perk', null, { timeout: 6000 }).catch(() => {});
  await p.mouse.move(5, 5);
  await shot(p, 'd16-perk', 700);
  await p.hover('.perk-card[data-i="1"]');
  await shot(p, 'd17-perk-hover', 300);
  await p.keyboard.press('Digit1'); await p.waitForTimeout(400);
  await calm(p);
  await toDeath(p);
  await p.mouse.move(5, 5);
  await shot(p, 'd18-death');
  // favicon, scaled up
  if (want('d19-favicon')) {
    const url = await ev(p, () => new Promise((res) => {
      const im = new Image();
      im.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(im, 0, 0, 128, 128); res(c.toDataURL()); };
      im.src = document.getElementById('favicon').href;
    }));
    fs.writeFileSync(path.join(OUT, 'd19-favicon.png'), Buffer.from(url.split(',')[1], 'base64'));
    console.log('  d19-favicon');
    // the 16x16 tab size (before: the browser scales the one 32x32 icon down; after: a hand-placed 16)
    const u16 = await ev(p, () => new Promise((res) => {
      const im = new Image();
      im.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.imageSmoothingEnabled = !document.getElementById('favicon16'); x.drawImage(im, 0, 0, 16, 16); const d = x.getImageData(0, 0, 16, 16); const c2 = document.createElement('canvas'); c2.width = c2.height = 16; c2.getContext('2d').putImageData(d, 0, 0); x.clearRect(0, 0, 128, 128); x.imageSmoothingEnabled = false; x.drawImage(c2, 0, 0, 128, 128); res(c.toDataURL()); };
      im.src = (document.getElementById('favicon16') || document.getElementById('favicon')).href;
    }));
    fs.writeFileSync(path.join(OUT, 'd19b-favicon16.png'), Buffer.from(u16.split(',')[1], 'base64'));
    console.log('  d19b-favicon16');
  }
  await ctx.close();
}

// ---------------- numerals: 0-9 at every size the UI sets them ----------------
// "before" forces the bundled Pixelify Sans (what the UI used); "after" uses the UI's own --pixel stack.
if (want('n01-digits')) {
  const { ctx, p } = await page({ width: 1280, height: 720 });
  await p.evaluate((fam) => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:99;background:#1a110c;color:#ffe08a;padding:14px 20px;overflow:hidden';
    // HUD mult/dist 15, best 14, day 19-20, score 24, stat tiles 20/24, big score 46/70, Day banner 44-72
    for (const s of [12, 14, 15, 19, 20, 24, 30, 46, 60, 70]) {
      const r = document.createElement('div');
      r.style.cssText = `font-family:${fam};font-size:${s}px;line-height:1.15;white-space:nowrap`;
      r.innerHTML = `<span style="font:12px monospace;color:#b89b72;display:inline-block;width:44px">${s}px</span>0123456789 x2.5 4,860 3.48 KM 8:33 Day 5`;
      d.appendChild(r);
    }
    document.body.appendChild(d);
  }, which === 'before' ? "'Pixelify Sans'" : 'var(--pixel)');
  await shot(p, 'n01-digits', 400);
  await ctx.close();
}

// ---------------- opening cinematic ----------------
if (!only || [...only].some((o) => o.startsWith('c'))) {
  console.log('cinematic');
  const save = { ...SAVE, settings: { ...SAVE.settings, cinematic: true } };
  {
    // autoplay refused: the "press any key to begin" card
    const { ctx, p } = await page({ width: 1280, height: 720 }, { save, blockPlay: true });
    await shot(p, 'c01-cine-gate', 1800);
    await ctx.close();
  }
  {
    const { ctx, p } = await page({ width: 1280, height: 720 }, { save });
    await shot(p, 'c02-cine-line', 3200);
    if (want('c03-cine-logo')) { await p.waitForTimeout(31500); await shot(p, 'c03-cine-logo'); }
    await ctx.close();
  }
}

// ---------------- phones ----------------
for (const [tag, vp] of [['p', { width: 390, height: 844 }], ['l', { width: 844, height: 390 }]]) {
  if (only && ![...only].some((o) => o.startsWith(tag))) continue;
  console.log(`phone ${vp.width}x${vp.height}`);
  const { ctx, p } = await page(vp, { touch: true, dsf: 2 });
  await p.waitForTimeout(1800);
  await shot(p, `${tag}01-title`);
  await startRun(p, true);
  await calm(p);
  // thumb on the stick
  const cdp = await ctx.newCDPSession(p);
  const x0 = vp.width * 0.22, y0 = vp.height * 0.72;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 1 }] });
  for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + i * 4, y: y0 - i * 2, id: 1 }] }); await p.waitForTimeout(30); }
  await shot(p, `${tag}02-hud`, 900);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await p.waitForTimeout(3500);
  await calm(p);
  await ev(p, () => { const g = window.__pc.game; g.mult = 1.5; g.score = 1240; });
  await shot(p, `${tag}03-hud-calm`, 500);
  await ev(p, () => { window.__pc.game.perkChoices = 1; });
  await p.waitForFunction(() => window.__pc.state === 'perk', null, { timeout: 6000 }).catch(() => {});
  await shot(p, `${tag}04-perk`, 700);
  await p.tap('.perk-card[data-i="0"]'); await p.waitForTimeout(400);
  await calm(p);
  await toDeath(p);
  await shot(p, `${tag}05-death`);
  await ctx.close();
}

await b.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');

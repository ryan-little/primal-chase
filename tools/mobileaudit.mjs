// Mobile UI audit: every screen at phone/tablet sizes with touch emulation.
// node tools/mobileaudit.mjs <port> <label> [viewportName...]
// Writes tools/shots/mobile-<label>-<viewport>-<screen>.png and prints layout problems
// (horizontal overflow, overlapping HUD pieces, small tap targets, panels clipped off screen).
import { chromium } from 'file:///C:/Users/ryan/Projects/Primal-Chase-Fable/node_modules/playwright/index.mjs';
const port = process.argv[2] || 8791, label = process.argv[3] || 'x';
const VPS = { p390: [390, 844], p360: [360, 740], l844: [844, 390], t820: [820, 1180], d1280: [1280, 720] };
const only = process.argv.slice(4);
const b = await chromium.launch({ channel: 'msedge' });
const url = `http://127.0.0.1:${port}/index.html`;

const audit = (p, screen) => p.evaluate((screen) => {
  const out = [];
  const vis = (el) => el && el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden' && +getComputedStyle(el).opacity > 0.05;
  const W = innerWidth, H = innerHeight;
  if (document.documentElement.scrollWidth > W) out.push('page h-overflow ' + document.documentElement.scrollWidth);
  for (const s of document.querySelectorAll('.screen:not(.hidden) .panel')) {
    if (s.scrollWidth > s.clientWidth + 1) out.push(`panel h-overflow ${s.parentElement.id} ${s.scrollWidth}>${s.clientWidth}`);
    const r = s.getBoundingClientRect();
    if (r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1) out.push(`panel off-screen ${s.parentElement.id}`);
    if (s.scrollHeight > s.clientHeight + 1 && getComputedStyle(s).overflowY === 'hidden') out.push(`panel clipped ${s.parentElement.id}`);
  }
  for (const el of document.querySelectorAll('button, .btn, input')) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1) continue;
    if (r.height < 40 || r.width < 40) out.push(`small target ${el.id || el.className || el.tagName} ${r.width | 0}x${r.height | 0}`);
    if (r.right > W + 1 || r.left < -1) out.push(`target off-screen ${el.id || el.textContent.trim().slice(0, 20)}`);
  }
  if (screen.startsWith('hud')) {
    const ids = ['clock', 'tracker', 'score-box', 'minimap', 'vitals', 'status-line', 'toast', 'lore', 'card', 'pause-btn', 'map-btn', 'btn-sprint', 'btn-pounce'];
    const rs = ids.map((id) => [id, document.getElementById(id)]).filter(([, el]) => vis(el) && (el.textContent.trim() || el.tagName !== 'DIV' || ['tracker', 'vitals', 'clock', 'score-box'].includes(el.id))).map(([id, el]) => [id, el.getBoundingClientRect()]);
    for (let i = 0; i < rs.length; i++) {
      const [a, A] = rs[i];
      if (A.right > W + 1 || A.left < -1 || A.bottom > H + 1 || A.top < -1) out.push(`off-screen ${a}`);
      for (let j = i + 1; j < rs.length; j++) {
        const [c, C] = rs[j];
        const ox = Math.min(A.right, C.right) - Math.max(A.left, C.left), oy = Math.min(A.bottom, C.bottom) - Math.max(A.top, C.top);
        if (ox > 2 && oy > 2) out.push(`overlap ${a} / ${c} (${ox | 0}x${oy | 0})`);
      }
    }
  }
  return out;
}, screen);

for (const [vn, [w, h]] of Object.entries(VPS)) {
  if (only.length ? !only.includes(vn) : vn[0] === 'd') continue;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: vn[0] !== 'd', isMobile: vn[0] !== 'd', deviceScaleFactor: vn[0] === 'd' ? 1 : 2 });
  await ctx.addInitScript(() => {
    const J = { painted: 2, graveyard: 1, oasis: 1, baobab: 1, camp: 3 };
    localStorage.setItem('pc2_journal', JSON.stringify(J));
    localStorage.setItem('pc2_played', 'true');
    localStorage.setItem('pc2_best', '48210');
    localStorage.setItem('pc2_runs', JSON.stringify([{ score: 48210, day: 6 }, { score: 12000, day: 3 }, { score: 9000, day: 2 }, { score: 3000, day: 1 }]));
  });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await p.goto(url); await p.waitForTimeout(1500);
  const tap = (sel) => (vn[0] === 'd' ? p.click(sel, { timeout: 1500 }) : p.tap(sel, { timeout: 1500 })).catch(() => { console.log(`${vn} TAP BLOCKED ${sel}`); return p.evaluate((s) => document.querySelector(s).click(), sel); }); const _unused = (sel) => p.tap(sel, { timeout: 1500 }).catch(() => { console.log(`${vn} TAP BLOCKED ${sel}`); return p.evaluate((s) => document.querySelector(s).click(), sel); });
  const shot = async (name) => {
    await p.screenshot({ path: `tools/shots/mobile-${label}-${vn}-${name}.png` });
    const a = await audit(p, name);
    console.log(`${vn} ${name}: ${a.length ? a.join(' | ') : 'ok'}`);
  };
  await shot('title');
  for (const [btn, name] of [['#btn-how', 'how'], ['#btn-settings', 'settings'], ['#btn-feats', 'feats'], ['#btn-journal', 'journal']]) {
    await tap(btn); await p.waitForTimeout(450);
    await shot(name);
    await p.evaluate((n) => document.querySelector(`#${n} [data-back]`).click(), name);
    await p.waitForTimeout(300);
  }
  await tap('#btn-start'); await p.waitForTimeout(700);
  // keep the band far away so nothing ends the run
  await p.evaluate(() => { const g = window.__pc.game; g.hunters.forEach((h) => { h.x += 9000; }); g.band.x += 9000; g.scoutT = 1e9; });
  await shot('hud-card');
  await p.waitForTimeout(3000);
  await p.evaluate(() => { document.getElementById('stick').classList.add('on'); document.getElementById('stick').style.left = '22%'; document.getElementById('stick').style.top = '70%';
    const g = window.__pc.game; g.player.water = 30; g.player.heat = 80; g.events.push({ type: 'linewarn' }); });
  await p.waitForTimeout(700);
  await shot('hud-toast');
  await p.evaluate(() => { const g = window.__pc.game; g.events.push({ type: 'secret', secret: 'graveyard', x: g.player.x, y: g.player.y }); });
  await p.waitForTimeout(900);
  await shot('hud-lore');
  console.log(vn, 'lore', await p.evaluate(() => JSON.stringify({ cls: document.getElementById('lore').className, t: window.__pc.game.time.toFixed(2) })));
  await p.waitForTimeout(1500);
  console.log(vn, 'held?', await p.evaluate(() => window.__pc.game.time.toFixed(2)));
  await tap('#lore'); await p.waitForTimeout(700);
  console.log(vn, 'after tap', await p.evaluate(() => document.getElementById('lore').className));
  // a secret found with hunters close: no hold, card sits low
  await p.evaluate(() => { const g = window.__pc.game; const p = g.player; g.hunters[0].x = p.x + 300; g.hunters[0].y = p.y; g.events.push({ type: 'secret', secret: 'camp', x: p.x, y: p.y }); });
  await p.waitForTimeout(900);
  await shot('hud-lore-danger');
  await p.evaluate(() => { const g = window.__pc.game; g.hunters.forEach((h) => { h.x += 9000; }); g.band.mode = 'track'; });
  await p.waitForTimeout(9000);
  console.log(vn, 'remembered', await p.evaluate(() => document.getElementById('lore').className + ' ' + document.getElementById('lore-kicker').textContent));
  await shot('hud-lore-remembered');
  await tap('#lore'); await p.waitForTimeout(800);
  await tap('#map-btn'); await p.waitForTimeout(600);
  await shot('map');
  await tap('#btn-map-close'); await p.waitForTimeout(400);
  await tap('#pause-btn'); await p.waitForTimeout(500);
  await shot('pause');
  await tap('#btn-resume'); await p.waitForTimeout(300);
  await p.evaluate(() => { window.__pc.game.perkChoices = 1; });
  await p.waitForTimeout(700);
  await shot('perk');
  await p.evaluate(() => document.querySelector('.perk-card').click());
  await p.waitForTimeout(300);
  await p.evaluate(() => { const g = window.__pc.game; g.stats.secrets = 2; g.die('spear'); });
  await p.waitForTimeout(6000);
  await shot('death');
  await p.evaluate(() => document.querySelector('#death .panel').scrollTo(0, 99999));
  await p.waitForTimeout(200);
  await shot('death-bottom');
  await ctx.close();
}
await b.close();

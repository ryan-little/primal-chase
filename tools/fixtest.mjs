import { chromium } from '../../Primal-Chase-Fable/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.stack)); p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
await p.addInitScript(() => { const s = JSON.parse(localStorage.getItem('pc2_settings') || '{}'); s.cinematic = false; localStorage.setItem('pc2_settings', JSON.stringify(s)); /* cinematic:false */ });
await p.goto('http://127.0.0.1:8791/index.html'); await p.waitForTimeout(1500);
await p.click('#btn-start'); await p.waitForTimeout(1500);
// keep hunters far, no threats
const calm = () => p.evaluate(() => { const g = window.__pc.game; const pl=g.player; g.band.x = pl.x+5000; g.band.y = pl.y; g.hunters.forEach(h=>{h.x=pl.x+5000;h.y=pl.y;}); g.band.mode='track'; g.clock=0.3; if (g.weather) { g.weather.fog=0; g.weather.dust=0; g.weather.rain=0; } g.scoutT=999; g.runners=[]; g.dogs=[]; g.lions=[]; g.hyenas=[]; g.player.health=100; g.player.heat=10; g.player.stamina=100; });
// 1. stalking: one gazelle 150 px east, creep toward it, record distance when it flees
async function approach(mode) {
  await calm();
  const r = await p.evaluate(async (mode) => {
    const g = window.__pc.game, pl = g.player;
    g.prey = [{ id: 99999, kind: 'gazelle', herd: 0, x: pl.x + 160, y: pl.y, vx: 0, vy: 0, face: 1, anim: 0, state: 'graze', fleeT: 0, z: 0, wt: 99 }];
    const q = g.prey[0];
    window.__pc.override = () => ({ x: 1, y: 0, stalk: mode === 'stalk', sprint: mode === 'sprint', pounce: false });
    let fledAt = null;
    for (let i = 0; i < 200; i++) {
      await new Promise(r => setTimeout(r, 25));
      const d = Math.hypot(q.x - pl.x, q.y - pl.y);
      if (q.state === 'flee' && fledAt == null) fledAt = Math.round(d);
      if (fledAt != null || d < 8) break;
    }
    window.__pc.override = null;
    return { mode, fledAt, ground: g.player.ground };
  }, mode);
  return r;
}
for (const m of ['stalk', 'trot', 'sprint']) console.log(JSON.stringify(await approach(m)));
// 2. stalk then pounce: can we catch it?
await calm();
console.log('catch', await p.evaluate(async () => {
  const g = window.__pc.game, pl = g.player; const before = g.stats.prey;
  g.prey = [{ id: 99998, kind: 'gazelle', herd: 0, x: pl.x + 160, y: pl.y, vx: 0, vy: 0, face: 1, anim: 0, state: 'graze', fleeT: 0, z: 0, wt: 99 }];
  const q = g.prey[0]; let pounced = false;
  window.__pc.override = () => { const d = Math.hypot(q.x - pl.x, q.y - pl.y); const go = !pounced && d < 70; if (go) pounced = true; return { x: Math.sign(q.x - pl.x) || 1, y: (q.y - pl.y) / 100, stalk: true, pounce: go }; };
  for (let i = 0; i < 160 && g.stats.prey === before; i++) await new Promise(r => setTimeout(r, 25));
  window.__pc.override = null; return g.stats.prey > before;
}));
// 3. eat: stand 24px from a carcass
await calm();
console.log('eat@24', await p.evaluate(async () => {
  const g = window.__pc.game, pl = g.player; pl.food = 40; pl.water = 100;
  g.carcasses.push({ id: 5, x: pl.x + 24, y: pl.y + 4, meat: 60, max: 60, kind: 'gazelle', small: false, face: 1, t: 0 });
  window.__pc.override = () => ({ x: 0, y: 0 });
  await new Promise(r => setTimeout(r, 800)); window.__pc.override = null; return pl.food > 40.5;
}));
// 4. drinking stutter: at water with full meter, count state toggles over 12s
await calm();
console.log('drink', await p.evaluate(async () => {
  const g = window.__pc.game, pl = g.player, W = g.world;
  const w = W.nearestWater(pl.x, pl.y, 3000); if (!w) return 'no water';
  pl.x = w[0]; pl.y = w[1]; pl.vx = pl.vy = 0; pl.water = 70;
  window.__pc.override = () => ({ x: 0, y: 0 });
  let toggles = 0, last = null, maxW = 0;
  for (let i = 0; i < 480; i++) { await new Promise(r => setTimeout(r, 25)); const s = pl.drinking; if (last !== null && s !== last) toggles++; last = s; maxW = Math.max(maxW, pl.water); }
  window.__pc.override = null; return { toggles, maxW: Math.round(maxW), water: Math.round(pl.water) };
}));
// 5. climb: find a cliff face with the upper terrace one level higher; pounce north into it
await calm();
console.log('climb', await p.evaluate(async () => {
  const g = window.__pc.game, pl = g.player, W = g.world, G = 16;
  let spot = null;
  for (let r = 50; r < 12000 && !spot; r += 20) for (let a = 0; a < 6.28 && !spot; a += 12 / r) {
    const x = pl.x + Math.cos(a) * r, y = pl.y + Math.sin(a) * r;
    if (W.T.ground(x, y) === G && W.T.ground(x, y + 14) !== G && W.T.levelAt(x, y - 14) === W.T.levelAt(x, y + 14) + 1 && W.T.ground(x, y + 14) !== 13) spot = [x, y + 16];
  }
  if (!spot) return 'no cliff found';
  W.prepare(spot[0], spot[1], 400, 9999);
  await new Promise(r => setTimeout(r, 800));
  pl.x = spot[0]; pl.y = spot[1]; pl.vx = pl.vy = 0;
  const L0 = W.levelAt(pl.x, pl.y); const walkT = [];
  window.__pc.override = () => ({ x: 0, y: -1 });
  await new Promise(r => setTimeout(r, 600));
  const afterWalk = W.levelAt(pl.x, pl.y);
  pl.stamina = 100; let fired = false;
  window.__pc.override = () => { const go = !fired; fired = true; return { x: 0, y: -1, pounce: go }; };
  await new Promise(r => setTimeout(r, 700));
  window.__pc.override = null;
  return { L0, afterWalk, afterPounce: W.levelAt(pl.x, pl.y), onCliff: W.typeAt(pl.x, pl.y) === G };
}));
await p.screenshot({ path: 'tools/shots/fix/climb.png' });
// 6. settings + death screen
await p.evaluate(() => { const g = window.__pc.game; g.mult = 1.9; g.stats.bestMult = 2.2; g.score = 22222; });
await p.waitForTimeout(300);
await p.screenshot({ path: 'tools/shots/fix/hud.png', clip: { x: 1000, y: 0, width: 280, height: 90 } });
await p.evaluate(() => { const g = window.__pc.game; g.player.health = 0; g.die(); });
await p.waitForTimeout(3500);
await p.screenshot({ path: 'tools/shots/fix/death.png' });
console.log(errs.join('\n') || 'no errors');
await p.click('text=Title').catch(()=>{}); await p.waitForTimeout(800);
await p.click('#btn-settings'); await p.waitForTimeout(500);
await p.screenshot({ path: 'tools/shots/fix/settings.png' });
await b.close();

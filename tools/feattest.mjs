import { chromium } from '../../Primal-Chase-Fable/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.stack));
await p.goto('http://127.0.0.1:8791/index.html'); await p.waitForTimeout(1200);
await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1200);
await p.click('#btn-start'); await p.waitForTimeout(1200);
const out = [];
await p.evaluate(() => { window.__pc.game.day = 6; });
for (let d = 1; d < 4; d++) {
  await p.evaluate(() => { const g = window.__pc.game; g.clock = 0.995; g.player.health = 100; g.player.water = 100; g.player.food = 100; g.player.heat = 0; const pl = g.player; g.band.x = pl.x + 5000; g.hunters.forEach(h => { h.x = pl.x + 5000; }); });
  await p.waitForTimeout(1500);
  // dismiss perk screen if shown
  const st = await p.evaluate(() => window.__pc.state);
  if (st === 'perk') { await p.click('.perk-card').catch(() => {}); await p.waitForTimeout(600); }
  out.push(await p.evaluate(() => ({ day: window.__pc.game.day, state: window.__pc.state, feats: JSON.parse(localStorage.getItem('pc2_feats') || '[]').filter(f => f.startsWith('day')) })));
}
console.log(JSON.stringify(out));
const clearPerks = async () => { for (let i = 0; i < 5 && await p.evaluate(() => window.__pc.state) === 'perk'; i++) { await p.click('.perk-card').catch(() => {}); await p.waitForTimeout(500); } };
await clearPerks();
const seen = [];
for (let i = 0; i < 20; i++) { seen.push(await p.evaluate(() => window.__pc.state + ':' + document.getElementById('toast').className + ':' + document.getElementById('toast').innerText)); await p.waitForTimeout(400); }
console.log('toasts', seen.join(' | '));
// new feats: kinds, secrets, units text, hunter-bane, climb
await clearPerks();
console.log(await p.evaluate(async () => {
  const g = window.__pc.game;
  g.stats.kinds = { gazelle: 1, hare: 1, zebra: 1, warthog: 1, ostrich: 1, fowl: 1, hyrax: 1, flamingo: 1 };
  g.stats.knockdowns = 5; g.stats.climbs = 5; g.stats.dist = 10001;
  await new Promise(r => setTimeout(r, 1200));
  return JSON.parse(localStorage.getItem('pc2_feats')).join(',') + ' | kinds ' + localStorage.getItem('pc2_kinds');
}));
await clearPerks();
await p.evaluate(() => { const g = window.__pc.game; g.player.health = 0; g.die(); });
await p.waitForTimeout(3000);
console.log('death feats:', await p.evaluate(() => document.getElementById('new-feats').innerText));
for (const u of ['metric', 'imperial']) {
  await p.evaluate((u) => { const s = JSON.parse(localStorage.getItem('pc2_settings') || '{}'); s.units = u; localStorage.setItem('pc2_settings', JSON.stringify(s)); }, u);
  await p.reload(); await p.waitForTimeout(1200);
  await p.click('#btn-feats'); await p.waitForTimeout(500);
  console.log(u, await p.evaluate(() => [...document.querySelectorAll('.feat span')].map(e => e.innerText).filter(t => /Run|every/.test(t)).join(' / ')));
  if (u === 'imperial') await p.screenshot({ path: 'tools/shots/fix/feats.png' });
}
console.log(errs.join('\n') || 'no errors');
await b.close();

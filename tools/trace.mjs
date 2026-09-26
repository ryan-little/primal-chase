import { chromium } from '../../Primal-Chase-Fable/node_modules/playwright/index.mjs';
const seed = +(process.argv[2] || 1051);
const b = await chromium.launch({ channel: 'msedge' }); const p = await b.newPage();
p.on('pageerror', e => console.log('ERR', e.stack));
await p.goto('http://127.0.0.1:8791/tools/sim.html'); await p.waitForFunction(() => window.ready);
const out = await p.evaluate(async (seed) => {
  const { Game } = await import('../js/game.js'); const { makeBot } = await import('./bot.js');
  const art = (await import('../js/art.js')).buildArt();
  const g = new Game(seed, art, { play(){}, sting(){} }, { headless: true }); const bot = makeBot(1); const lines = [];
  for (let i = 0; i < 30 * 170 && !g.over; i++) { const inp = bot(g); g.update(1/30, inp); g.events.length = 0;
    if (i % 150 === 0) { const q = g.player; lines.push(`${(i/30)|0}s x${q.x|0} y${q.y|0} g${q.ground} st${q.state} w${q.water|0} f${q.food|0} h${q.heat|0} hp${q.health|0} in(${inp.x.toFixed(1)},${inp.y.toFixed(1)}) drink${q.drinking} shade${q.inShade} band${g.band.mode} bd${Math.round(g.hunterDist())} idx${g.band.idx}/${g.trail.length} s${g.trail[Math.min(g.band.idx,g.trail.length-1)].s.toFixed(2)} sT${g.band.searchT.toFixed(1)} sR${g.band.searchR|0}`); } }
  return lines;
}, seed);
console.log(out.join('\n')); await b.close();

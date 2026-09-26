import { chromium } from '../../Primal-Chase-Fable/node_modules/playwright/index.mjs';
const seed = +(process.argv[2] || 1034);
const b = await chromium.launch({ channel: 'msedge' }); const p = await b.newPage();
p.on('pageerror', e => console.log('ERR', e.stack));
await p.goto('http://127.0.0.1:8791/tools/sim.html'); await p.waitForFunction(() => window.ready);
const out = await p.evaluate(async (seed) => {
  const { Game } = await import('../js/game.js'); const { makeBot } = await import('./bot.js');
  const art = (await import('../js/art.js')).buildArt();
  const g = new Game(seed, art, { play(){}, sting(){} }); const bot = makeBot(1); const lines = [];
  for (let i = 0; i < 30 * 400 && !g.over; i++) { const inp = bot(g); g.update(1/30, inp);
    for (const e of g.events) if (!['step','pop','drink','eat'].includes(e.type)) { const q=g.player; const sc=g.scout; lines.push(`${(i/30).toFixed(1)} ${e.type}${e.kind?':'+e.kind:''} hp${q.health|0} heat${q.heat|0} st${q.stamina|0} band${g.band.mode} bd${Math.round(g.hunterDist())} sc${sc?Math.round(Math.hypot(sc.x-q.x,sc.y-q.y))+(sc.leaving?'L':''):'-'} in(${inp.x.toFixed(1)},${inp.y.toFixed(1)},${inp.sprint?'S':''})`); }
    g.events.length = 0; }
  return lines;
}, seed);
console.log(out.join('\n')); await b.close();

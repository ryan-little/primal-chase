import { chromium } from '../../Primal-Chase-Fable/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge', headless: false, args: ['--autoplay-policy=no-user-gesture-required', '--disable-frame-rate-limit', '--disable-gpu-vsync', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:8791/index.html'); await p.waitForTimeout(800);
await p.click('#btn-start');
await p.evaluate(async () => { const { makeBot } = await import('/js/bot.js'); const bot = makeBot(2); window.__pc.override = (g) => { g.player.health = Math.max(g.player.health, 50); if (g.perkChoices) { const o = g.offerPerks(1); o.length ? g.takePerk(o[0].id) : (g.perkChoices = 0); } return bot(g); }; window.__pc.timeScale = 2; });
const cdp = await ctx.newCDPSession(p);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start');
await p.waitForTimeout(25000);
const { profile } = await cdp.send('Profiler.stop');
const self = new Map(); const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const dt = profile.timeDeltas; const counts = new Map();
for (let i = 0; i < profile.samples.length; i++) counts.set(profile.samples[i], (counts.get(profile.samples[i]) || 0) + (dt[i] || 0));
for (const [id, us] of counts) { const n = byId.get(id); const cf = n.callFrame; const k = `${cf.functionName || '(anon)'} ${cf.url.split('/').pop()}:${cf.lineNumber}`; self.set(k, (self.get(k) || 0) + us); }
const tot = [...self.values()].reduce((a, b) => a + b, 0);
console.log('total ms', Math.round(tot / 1000));
for (const [k, us] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log((us / 1000).toFixed(0).padStart(7), k);
await b.close();

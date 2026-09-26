import { chromium } from '../../Primal-Chase-Fable/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' }); const p = await b.newPage();
p.on('pageerror', e => console.log('ERR', e.stack));
await p.goto('http://127.0.0.1:8791/tools/audio.html'); await p.waitForFunction(() => window.ready);
const cases = [['title', 0, 0, 0, true], ['savanna', 0, 0, 0], ['woodland', 0, 0, 1], ['wetland', 0, 0, 2], ['desert', 0, 0, 3], ['highland', 0, 0, 4], ['ash', 0, 0, 5], ['coast', 0, 0, 6], ['night', 0, 1, 0], ['hunted I2', 2, 0, 0], ['chase', 3, 0, 0]];
for (const [name, I, n, bio, menu] of cases) {
  const r = await p.evaluate(([I, n, bio, menu]) => window.render(I, n, 10, false, bio, !!menu), [I, n, bio, menu]);
  const pk = Math.max(...r.map(x => x[0])), rms = (r.reduce((s, x) => s + x[1], 0) / r.length).toFixed(3);
  console.log(name.padEnd(10), 'peak', pk.toFixed(2), 'avg rms', rms, '| per-sec rms', r.map(x => x[1].toFixed(2)).join(' '));
}
await b.close();

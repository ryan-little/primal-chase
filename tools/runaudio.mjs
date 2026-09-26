import { chromium } from '../../Primal-Chase-Fable/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' }); const p = await b.newPage();
p.on('pageerror', e => console.log('ERR', e.stack)); p.on('console', m => console.log(m.text()));
await p.goto('http://127.0.0.1:8791/tools/audio.html'); await p.waitForFunction(() => window.ready);
for (const [I, n] of [[0,0],[1,0],[2,0],[3,0],[0,1],[3,1]]) {
  const r = await p.evaluate(([I, n]) => window.render(I, n, 12, false), [I, n]);
  console.log(`I${I} night${n}  peak/rms per sec:`, r.map(x => x.join('/')).join(' '));
}
await b.close();

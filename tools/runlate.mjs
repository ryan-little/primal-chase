// node tools/runlate.mjs [runs] [skill] [startDay] [newSchedule 0|1]
import { chromium } from '../../../tools/pw/node_modules/playwright-core/index.mjs';
const [,, n = '8', skill = '2', day = '5', sched = '1'] = process.argv;
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('ERR', e.stack));
await p.goto('http://127.0.0.1:8791/tools/latesim.html'); await p.waitForFunction(() => window.ready);
const r = await p.evaluate(([n, s, d, sc]) => { window.newSchedule = !!sc; return window.runLate(n, s, d); }, [+n, +skill, +day, +sched]);
for (const x of r) console.log(`t${x.t} d${x.day} fire${x.fd} ${JSON.stringify(x.causes)} ${x.cause}`);
console.log('AVG t', (r.reduce((s, x) => s + x.t, 0) / r.length).toFixed(0), 'median', r.map((x) => x.t).sort((a, b) => a - b)[r.length >> 1]);
await b.close();

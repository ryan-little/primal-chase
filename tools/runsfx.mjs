import { chromium } from '../../Primal-Chase-Fable/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' }); const p = await b.newPage();
p.on('pageerror', e => console.log('ERR', e.stack));
await p.goto('http://127.0.0.1:8791/tools/audio.html'); await p.waitForFunction(() => window.ready);
const names = ['step','pounce','kill','eat','drink','splash','throw','windup','hit','thunk','dodge','shout','sighted','bark','yelp','knockdown','trail','score','overheat','pant','heart','roar','ui','thunder','snarl','rumble','laugh','snap','dawn','dusk','death','start'];
for (const n of names) console.log(JSON.stringify(await p.evaluate((n) => window.sfx(n), n)));
await b.close();

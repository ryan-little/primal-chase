import { chromium } from '../../Primal-Chase-Fable/node_modules/playwright/index.mjs';
const [,, url, out, w='1400', h='1000', wait='500'] = process.argv;
const b = await chromium.launch({ channel: 'msedge', args:['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errs = []; p.on('console', m => { if (m.type()==='error' || m.type()==='warning') errs.push(m.text()); }); p.on('pageerror', e => errs.push(String(e)));
await p.goto(url); await p.waitForTimeout(+wait);
await p.screenshot({ path: out });
console.log(errs.join('\n') || 'no errors');
await b.close();

// Offline one-shot renders: peak, rms over 3.5 s, arms (rms over the audible part), duration, NaN count.
// `node tools/runsfx.mjs` for every cue once; `node tools/runsfx.mjs pounce,eat 6` to repeat and see the spread.
import { openRig } from './audiorig.mjs';
const { p, close } = await openRig();
const names = process.argv[2] ? process.argv[2].split(',') : ['step','pounce','kill','eat','drink','splash','throw','windup','hit','thunk','dodge','shout','sighted','bark','yelp','knockdown','trail','score','overheat','pant','heart','roar','ui','thunder','snarl','rumble','laugh','snap','dawn','dusk','death','start',
  'climb','drop','startle','golden','multloss','secret','perk','rain','storm','heat','dust','fog'];
const reps = +(process.argv[3] || 1);
for (const n of names) {
  for (let i = 0; i < reps; i++) {
    const opts = n === 'startle' && i % 2 ? { fly: true } : n === 'step' ? { g: [0, 3, 6, 14, 5][i % 5] } : {};
    console.log(JSON.stringify(await p.evaluate(([n, o]) => window.sfx(n, o), [n, opts])));
  }
}
await close();

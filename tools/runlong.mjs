// Ten minutes in one place: prints the arrangement sequence and level spread, to check a long
// stay doesn't loop. `node tools/runlong.mjs [biome] [night] [secs]`
import { openRig } from './audiorig.mjs';
const { p, close } = await openRig();
const biome = +(process.argv[2] || 0), night = +(process.argv[3] || 0), secs = +(process.argv[4] || 600);
const r = await p.evaluate(([secs, T]) => window.live(secs, T, { music: 1, amb: 0, sfx: 0 }), [secs, [[0, { biome, night, intensity: 0 }]]]);
const rms = r.per.map((x) => x[1]);
console.log('all', JSON.stringify(r.all), '| 5s-rms min', Math.min(...rms).toFixed(3), 'max', Math.max(...rms).toFixed(3));
const uniq = new Set(r.log.map((s) => s.replace(/\/t-?\d+/, '')));
console.log('arrangements', r.log.length, 'distinct', uniq.size, 'key changes', r.log.filter((s) => !s.includes('/x0/')).length);
console.log(' ', r.log.join(' '));
await close();

// Offline music renders. `node tools/runaudio.mjs` renders each theme for 10 s (plus weather
// variants); `node tools/runaudio.mjs live` drives the real update() loop through a long timeline.
import { openRig } from './audiorig.mjs';
const { p, close } = await openRig();
const mode = process.argv[2] || 'themes';
if (mode === 'themes') {
  const cases = [['title', 0, 0, 0, true], ['savanna', 0, 0, 0], ['woodland', 0, 0, 1], ['wetland', 0, 0, 2], ['desert', 0, 0, 3], ['highland', 0, 0, 4], ['ash', 0, 0, 5], ['coast', 0, 0, 6], ['night', 0, 1, 0], ['night-des', 0, 1, 3], ['hunted I2', 2, 0, 0], ['chase', 3, 0, 0],
    ['sav rain', 0, 0, 0, false, { rain: 1 }], ['sav storm', 0, 0, 0, false, { rain: 1, storm: 1 }], ['sav heat', 0, 0, 0, false, { heat: 1 }], ['sav fog', 0, 0, 0, false, { fog: 1 }], ['sav dust', 0, 0, 0, false, { dust: 1 }]];
  const secs = +(process.argv[3] || 10);
  for (const [name, I, n, bio, menu, wx] of cases) {
    const r = await p.evaluate(([I, n, bio, menu, wx, secs]) => window.render(I, n, secs, false, bio, !!menu, wx || {}), [I, n, bio, menu, wx, secs]);
    const avg = (r.per.reduce((s, x) => s + x[1], 0) / r.per.length).toFixed(3);
    console.log(name.padEnd(10), 'peak', r.all.peak.toFixed(2), 'avg rms', avg, 'nan', r.all.nan, '|', r.log.join(' '), '| per-sec rms', r.per.map((x) => x[1].toFixed(2)).join(' '));
  }
} else if (mode === 'live') {
  // ~4 minutes of play: savanna day, clouds in, a storm, a hunt, a chase, night, dust, fog at dawn, heat
  const T = [[0, { biome: 0, intensity: 0, night: 0 }], [35, { rain: 0.6 }], [50, { rain: 1, storm: 1 }], [80, { rain: 0, storm: 0, intensity: 1 }], [95, { intensity: 2 }], [105, { intensity: 3 }],
    [120, { intensity: 0, biome: 1 }], [140, { night: 1 }], [165, { night: 0, biome: 3, dust: 1 }], [190, { dust: 0, fog: 1, biome: 2 }], [210, { fog: 0, heat: 1, biome: 0 }]];
  const secs = +(process.argv[3] || 230);
  const r = await p.evaluate(([secs, T]) => window.live(secs, T), [secs, T]);
  console.log('all', JSON.stringify(r.all));
  console.log('stings', r.stings.join(' '));
  console.log('arrangements', r.log.length, '\n ', r.log.join('\n  '));
  console.log('per-5s [peak, rms]', r.per.map((x) => `${x[0].toFixed(2)}/${x[1].toFixed(3)}`).join(' '));
  if (process.argv[4] === 'beds') {
    const beds = [['calm', {}], ['rain', { rain: 1 }], ['storm', { rain: 1, storm: 1 }], ['heat', { heat: 1 }], ['dust', { dust: 1 }], ['fog', { fog: 1 }], ['night', { night: 1 }]];
    for (const [n, wx] of beds) {
      const b = await p.evaluate(([wx]) => window.live(20, [[0, { biome: 0, ...wx }]], { music: 0, amb: 1, sfx: 1 }), [wx]);
      console.log('bed', n.padEnd(6), JSON.stringify(b.all), 'stings', b.stings.join(' '));
    }
  }
}
await close();

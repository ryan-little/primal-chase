// Records the title-screen / cinematic clips from the real game, headless and frame-exact.
//   node tools/serve.mjs 8791 &   then   node tools/clips.mjs [port] [only=name,name] [preview] [live] [encode]
// What's recorded is what a player sees: the finished display canvas (1440x810, 3 device pixels
// per art pixel, the renderer's own sub-pixel camera) at 60 fps. Time is virtual:
// requestAnimationFrame is replaced so every captured frame advances the game exactly 1/60 s,
// however long the capture takes. Frames go losslessly to tools/shots/clipframes/<name>.mkv,
// then to H.264 in assets/clips. A per-frame log (camera, where the cat and the action sit on
// the frame) lands next to the lossless file for tools/clipcheck.py.
//   live: also record each scene with the game's own camera (no framing) for comparison.
//
// Framing: the renderer's camera eases toward a target with the same lerp it always uses; here
// the target is the midpoint of the cat and the nearest action (hunter, prey, herd, fire), led
// by the cat's velocity just enough to cancel the easing lag. The cat's input keeps that action
// close and mostly level with it, so everything stays inside the frame's center, which is
// what the title's logo and menu and a portrait phone's center crop leave visible.
import { chromium } from 'file:///C:/Users/ryan/Projects/Primal-Chase-Fable/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';

const port = +(process.argv[2] || 8791);
const only = (process.argv.find((a) => a.startsWith('only=')) || '').slice(5).split(',').filter(Boolean);
const preview = process.argv.includes('preview');
const live = process.argv.includes('live');
const FPS = 60;
const VW = 1440, VH = 810;
const FFMPEG = process.env.FFMPEG || 'C:/Users/ryan/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const OUT = 'assets/clips';
const TMP = 'tools/shots/clipframes';
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

// Each scene: where and when, what to set up, how the cat moves, what the camera frames.
const SCENES = [
  { name: 'dawn', biome: 0, clock: 0.035, secs: 6, pre: 90, setup: `g.weather.fogDawn = true; g.weather.fog = 0.85; clearBand(); level(); gazelles(95, 3);`, input: `trot(0.6, 9)`, aim: `pair(nearPrey(150), 0.35)` },
  { name: 'hunt', avoid: [2], biome: 0, clock: 0.16, secs: 6, pre: 20, setup: `clearBand(); pl.food = 18; level(); gazelles(105, 4);`, input: `hunt()`, aim: `pair(g.stats.prey ? null : nearPrey(110), 0.5)` },
  { name: 'band', crf: 29, biome: 0, clock: 0.22, secs: 6, pre: 150, setup: `level(); bandBehind(85);`, input: `keep(55, 85)`, aim: `pair(nearHunter(), 0.5)` },
  { name: 'heat', biome: 3, clock: 0.36, secs: 7, pre: 150, setup: `g.weather.heatDay = true; g.weather.heat = 1; level(); bandBehind(85); pl.heat = 40;`, input: `keep(55, 85)`, aim: `pair(nearHunter(), 0.5)`, heatCap: 76 },
  { name: 'night', biome: 4, clock: 0.8, secs: 6, pre: 150, setup: `level(); bandBehind(85);`, input: `keep(50, 80)`, aim: `pair(nearHunter(), 0.5)` },
  { name: 'chase', crf: 29, biome: 2, clock: 0.5, secs: 7, pre: 120, setup: `level(); bandBehind(85, true);`, input: `keep(60, 95, 0.45)`, aim: `pair(nearHunter(), 0.5)` },
  { name: 'stampede', avoid: [2], biome: 0, salt: 'b', clock: 0.3, secs: 6, pre: 30, setup: `clearBand(); level(); herd();`, input: `gnu()`, aim: `pair(nearGnus(), 0.3)` },
  { name: 'storm', crf: 29, biome: 2, salt: 'b', clock: 0.45, secs: 6, pre: 90, setup: `clearBand(); level(); g.startWeather('storm', 60); g.weather.rain = 1; g.weather.strikeT = 99; strikes([[2.2, 55], [5.2, -60]]);`, input: `trot(0.45, 7)`, aim: `pair(nearFire(120), 0.4)` },
  { name: 'fire', avoid: [3, 6, 7, 8], check: `g.fire.size > 20`, biome: 0, clock: 0.6, secs: 6, pre: 60, setup: `clearBand(); level(); fireBehind();`, input: `trot(0.3, 8)`, aim: `pair(nearFire(110), 0.4)` },
].filter((s) => !only.length || only.includes(s.name));

// Page-side helpers, evaluated once per scene with g = the running game.
const HELPERS = `
const g = window.__pc.game, pl = g.player, W = g.world, R = window.__pc.renderer;
g.discover = () => {}; // a secret's lore card would hold the game mid-shot
// the way the cat will go: close to level, so it and whatever follows sit side by side
const level = () => { const a = (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.5; window.__away = [Math.cos(a), Math.sin(a)]; };
const clearBand = () => { g.hunters.forEach((h) => { h.x += 9000; }); g.dogs.forEach((d) => { d.x += 9000; }); g.band.x += 9000; g.band.mode = 'track'; g.scoutT = 1e9; g.runners = []; };
const bandBehind = (d, chase) => {
  // lay a fresh trail from behind up to the cat and put the band on it
  const [ax, ay] = window.__away, tr = [];
  for (let i = 0; i <= 40; i++) { const t = i / 40; tr.push({ x: pl.x - ax * (d + 200) * (1 - t), y: pl.y - ay * (d + 200) * (1 - t), s: 1, water: false, id: 1e6 + i }); }
  g.trail = tr;
  const bx = pl.x - ax * d, by = pl.y - ay * d;
  g.band.x = bx; g.band.y = by; g.band.idx = Math.floor(40 * (200 / (d + 200))); g.band.mode = 'track';
  g.hunters.forEach((h, i) => { h.x = bx - ax * (i % 2) * 12; h.y = by + (i - 1) * 9; });
  g.dogs.forEach((dg) => { dg.x += 9000; });
  g.scoutT = 1e9; g.runners = [];
  if (chase) g.band.seen = 1;
};
const gazelles = (d, n) => {
  const [ax, ay] = window.__away;
  for (let i = 0; i < n; i++) g.prey.push({ id: 5e6 + i, kind: 'gazelle', herd: 5e6, x: pl.x + ax * (d + i * 13), y: pl.y + ay * (d + i * 13) + (i % 2 ? 9 : -7),
    vx: 0, vy: 0, face: 1, anim: Math.random(), state: 'graze', fleeT: 0, z: 0 });
};
const herd = () => {
  // a stampede that crosses just in front of the cat, left to right or right to left
  const [ax, ay] = window.__away, a = Math.atan2(ay, ax), perp = a + Math.PI / 2;
  const sx = pl.x - ax * 260 + Math.cos(perp) * 22, sy = pl.y - ay * 260 + Math.sin(perp) * 22;
  for (let i = 0; i < 28; i++) { // as many and as wide as the game's own (24-34, +-62)
    const lat = (Math.random() - 0.5) * 124, back = Math.random() * 260;
    g.gnus.push({ id: 7e6 + i, x: sx + Math.cos(perp) * lat - ax * back, y: sy + Math.sin(perp) * lat - ay * back, a, sp: 150 + Math.random() * 25, anim: Math.random(), face: Math.sign(ax) || 1, life: 0, hitCd: 0 });
  }
  g.stampedeWarn = 1.3; g.stampedeT = 1e9;
  window.__away = [-ax, -ay]; // the cat trots against the herd, so they meet mid-frame
};
const fireBehind = () => {
  // a fire line running level just above the cat; the cat walks slowly along it
  const [ax, ay] = window.__away;
  for (let i = -7; i <= 7; i++) g.ignite(pl.x + ax * i * 8, pl.y - 42 + Math.abs(ay) * i * 2);
};
const strikes = (list) => { window.__strikes = list.map(([t, dx]) => ({ t, dx })); };
`;

// Per-frame helpers (page side): input makers, and what the camera frames.
const INPUTS = `
window.cat = () => window.__pc.game.player;
const near = (list, ok) => { const q = window.cat(); let b = null, bd = 1e9; for (const u of list) { if (ok && !ok(u)) continue; const d = Math.hypot(u.x - q.x, u.y - q.y); if (d < bd) { bd = d; b = u; } } return b ? { x: b.x, y: b.y, d: bd } : null; };
// the nearest hunter and any others close behind it (the band travels as a group)
window.nearHunter = () => {
  const g = window.__pc.game, q = window.cat(), h = near(g.hunters); if (!h || h.d > 230) return null;
  let x = 0, y = 0, n = 0; for (const u of g.hunters) if (Math.hypot(u.x - q.x, u.y - q.y) < h.d + 45) { x += u.x; y += u.y; n++; }
  return [x / n, y / n - 14];
};
window.nearPrey = (r) => { const g = window.__pc.game, h = near(g.prey); return h && h.d < r ? [h.x, h.y - 8] : null; };
window.nearGnus = () => {
  const g = window.__pc.game, q = window.cat(); const h = near(g.gnus); if (!h || h.d > 120) return null;
  let x = 0, y = 0, n = 0; for (const u of g.gnus) if (Math.hypot(u.x - h.x, u.y - h.y) < 70) { x += u.x; y += u.y; n++; }
  return [x / n, y / n - 10];
};
window.nearFire = (r) => { const g = window.__pc.game; const h = near([...g.fire.values()]); return h && h.d < r ? [h.x, h.y - 6] : null; };
// camera target: between the cat and the thing (weight k toward it)
window.pair = (f, k) => { const q = window.cat(); let x = q.x, y = q.y - 10; if (f) { x += (f[0] - x) * k; y += (f[1] - y) * k; } return [x, y]; };
// ...then smoothed with a critically damped spring, so a zig-zagging cat, a new nearest hunter
// or a kill never jerks the frame, and led by the target's low-passed velocity (clamped, jumps
// ignored) by exactly the lag of spring + renderer easing, so it stays centered
window.smooth = (raw, w = 2.4) => {
  let s = null, last = 0;
  return (g) => {
    const r = raw();
    const dt = s ? Math.min(0.05, Math.max(0, g.time - last)) : 0; last = g.time;
    if (!s) s = { x: r[0], y: r[1], vx: 0, vy: 0, ux: 0, uy: 0 };
    if (dt > 0) {
      // the target's own velocity; a jump (new nearest hunter, a kill) is not motion
      let vx = (r[0] - s.rx) / dt, vy = (r[1] - s.ry) / dt; const m = Math.hypot(vx, vy);
      if (m * dt > 4) { vx = s.ux; vy = s.uy; } else if (m > 90) { vx *= 90 / m; vy *= 90 / m; }
      const k = 1 - Math.exp(-dt / 0.6); s.ux += (vx - s.ux) * k; s.uy += (vy - s.uy) * k;
      const lead = 2 / w + 1 / 3.2, tx = r[0] + s.ux * lead, ty = r[1] + s.uy * lead;
      s.vx += (w * w * (tx - s.x) - 2 * w * s.vx) * dt; s.vy += (w * w * (ty - s.y) - 2 * w * s.vy) * dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
    }
    s.rx = r[0]; s.ry = r[1];
    return [s.x, s.y];
  };
};
window.__mk = {
  trot: (mag, period) => { const [ax, ay] = window.__away, a0 = Math.atan2(ay, ax); return (g) => { const a = a0 + Math.sin(g.time / period * 6.283) * 0.45; return { x: Math.cos(a) * mag, y: Math.sin(a) * mag, sprint: false, stalk: false, pounce: false }; }; },
  // move away from the nearest hunter, faster when it's close, easing off when it
  // falls back, so the gap stays between lo and hi
  keep: (lo, hi, weave = 0.3) => (g) => {
    const q = g.player, [ax, ay] = window.__away;
    const h = near(g.hunters, (u) => u.down <= 0), d = h ? h.d : 999;
    const m = d < lo ? 1 : d > hi ? 0.2 : 0.2 + 0.8 * (hi - d) / (hi - lo);
    const w = Math.sin(g.time * 0.6) * weave;
    return { x: (ax * Math.cos(w) - ay * Math.sin(w)) * m, y: (ax * Math.sin(w) + ay * Math.cos(w)) * m, sprint: d < lo - 12 && q.heat < 70, stalk: false, pounce: false };
  },
  // trot at the herd, pounce the first wildebeest that comes close, then stay on the kill
  gnu: () => (g) => { const q = g.player, [ax, ay] = window.__away; if (q.eating || g.stats.prey) return { x: 0, y: 0 }; const h = near(g.gnus); if (h && h.d < 34 && q.stamina > 25) return { x: (h.x - q.x) / h.d, y: (h.y - q.y) / h.d, pounce: true }; return { x: ax * 0.4, y: ay * 0.4, sprint: false, stalk: false, pounce: false }; },
  hunt: () => (g) => { const q = g.player; if (q.eating || g.stats.prey) return { x: 0, y: 0 }; let b = null, bd = 1e9; for (const k of g.prey) { const d = Math.hypot(k.x - q.x, k.y - q.y); if (d < bd) { bd = d; b = k; } } if (!b) return { x: 0, y: 0 }; const dx = b.x - q.x, dy = b.y - q.y; return { x: dx / bd, y: dy / bd, stalk: bd > 40, sprint: false, pounce: bd < 40 && q.stamina > 20 }; },
};
`;

// Per-frame log: where the camera is and where the cat and the action sit on the frame (0..1).
const SAMPLE = `(() => {
  const R = window.__pc.renderer, g = window.__pc.game, q = g.player;
  const L = R.cx + R.fx, T = R.cy + R.fy, fx = (x) => +((x - L) / R.viewW).toFixed(4), fy = (y) => +((y - T) / R.viewH).toFixed(4);
  const on = (x, y) => x > L - 20 && x < L + R.viewW + 20 && y > T - 20 && y < T + R.viewH + 30;
  const act = [];
  for (const h of g.hunters) if (on(h.x, h.y)) act.push(['h', fx(h.x), fy(h.y - 14)]);
  for (const k of g.prey) if (on(k.x, k.y)) act.push(['p', fx(k.x), fy(k.y - 8)]);
  for (const k of g.gnus) if (on(k.x, k.y)) act.push(['g', fx(k.x), fy(k.y - 10)]);
  for (const s of g.spears) if (on(s.x, s.y)) act.push(['s', fx(s.x), fy(s.y - 10)]);
  const f = window.__focus && window.__focus();
  return { cam: [+R.cam.x.toFixed(3), +R.cam.y.toFixed(3)], L: +L.toFixed(3), T: +T.toFixed(3), S: R.S,
    cat: [fx(q.x), fy(q.y - 10)], focus: f ? [fx(f[0]), fy(f[1])] : null, act, mode: g.band.mode, spears: g.spears.length, prey: g.stats.prey };
})()`;

function encode(name, sc = SCENES.find((s) => s.name === name) || {}) {
  const out = path.join(OUT, name + '.mp4');
  const crf = process.env.CRF || 28;
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', path.join(TMP, name + '.mkv'),
    '-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=neighbor+accurate_rnd+full_chroma_int,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'veryslow', '-tune', 'animation', '-crf', String(sc.crf || crf), '-g', '600',
    '-profile:v', 'high', '-level', '4.2', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-movflags', '+faststart', '-an', out]);
  console.log('  ->', out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
}
if (process.argv.includes('encode')) { for (const sc of SCENES) encode(sc.name); process.exit(0); } // re-encode saved frames only

const b = await chromium.launch({ channel: 'msedge' });
const errs = [];
async function record(sc, framed, tries = 0) {
  const tag = sc.name + (framed ? '' : '-live');
  const ctx = await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(tag + ' PAGEERR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(tag + ' ' + m.text()); });
  // no opening cinematic; virtual clock: frames only happen when we say so
  await p.addInitScript(() => {
    localStorage.setItem('pc2_settings', JSON.stringify({ cinematic: false }));
    const q = []; let vt = performance.now();
    window.requestAnimationFrame = (cb) => { q.push(cb); return q.length; };
    window.__advance = (ms) => { vt += ms; const cbs = q.splice(0); for (const cb of cbs) cb(vt); };
  });
  await p.goto(`http://127.0.0.1:${port}/index.html`);
  await p.waitForFunction(() => window.__pc && window.__advance);
  await p.evaluate(() => { window.__advance(16); window.__pc.startRun(); window.__advance(16); });
  // move to the biome, set the hour
  const seed = (sc.name + (sc.salt || '')).split('').reduce((s, c) => s * 31 + c.charCodeAt(0), 7) % 1e6;
  const ok = await p.evaluate(({ bi, clock, seed, avoid }) => {
    // the same spot and the same randomness every time a scene is recorded
    let s = seed; Math.random = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    const g = window.__pc.game, W = g.world;
    const a0 = Math.random() * 6.283;
    for (let r = 400; r < 12000; r += 120) for (let k = 0; k < 40; k++) {
      const a = a0 + k / 40 * 6.283, x = g.player.x + Math.cos(a) * r, y = g.player.y + Math.sin(a) * r;
      if (W.T.biomeAt(x, y) !== bi) continue;
      let good = true;
      for (let j = 0; j < 12 && good; j++) { const gg = W.T.ground(x + Math.cos(j) * 110, y + Math.sin(j) * 60); if (gg === 13 || gg === 16 || gg === 8 || gg === 7) good = false; }
      for (let j = 0; j < 10 && good; j++) if (W.T.biomeAt(x + Math.cos(j * 0.63) * 260, y + Math.sin(j * 0.63) * 180) !== bi) good = false;
      // grounds that spoil the shot (tall grass hides the cat; fire won't take on rock or sand)
      for (let j = 0; j < 24 && good && avoid.length; j++) if (avoid.includes(W.T.ground(x + Math.cos(j * 0.26) * (60 + j * 6), y + Math.sin(j * 0.26) * (40 + j * 3)))) good = false;
      if (!good) continue;
      g.player.x = x; g.player.y = y; g.clock = clock; window.__pc.renderer.camInit = false;
      return true;
    }
    return false;
  }, { bi: sc.biome, clock: sc.clock, seed, avoid: sc.avoid || [] });
  if (!ok) console.log(tag, 'no biome spot found');
  // let the terrain worker paint around the new spot while game time stands still
  await p.evaluate(() => { const R = window.__pc.renderer, d = R.draw.bind(R); R.draw = (g, dt) => d(g, dt, false); R.pop = () => {}; });
  for (let i = 0; i < 40; i++) { await p.evaluate(() => window.__advance(1)); await p.waitForTimeout(15); }
  await p.evaluate('(() => {' + HELPERS + sc.setup + INPUTS + `
    const heatCap = ${sc.heatCap || 62};
    const inner = window.__mk.${sc.input};

    window.__focus = ${sc.aim ? '() => ' + sc.aim.replace(/^pair\((.*), [\d.]+\)$/, '$1') : 'null'};
    R.aim = ${framed && sc.aim ? 'window.smooth(() => ' + sc.aim + ')' : 'null'};
    R.reducedMotion = true; window.__pc.steady = true; // no shake, hit-freeze or dodge slow-mo: on a backdrop they read as hitches
    window.__pc.override = (g) => {
      const q = g.player; q.health = 100; q.water = Math.max(q.water, 60); if (!${sc.name === 'hunt'}) q.food = Math.max(q.food, 60);
      q.heat = Math.min(q.heat, heatCap); g.perkChoices = 0;
      for (const s of window.__strikes || []) if (!s.done && g.time >= window.__t0 + s.t) { s.done = true; g.weather.strikes.push({ x: q.x + s.dx, y: q.y - 6, t: 0.9 }); }
      return inner(g);
    };})()`);
  // pre-roll: the scene gets going before the first captured frame
  await p.evaluate(() => { window.__t0 = window.__pc.game.time; });
  for (let i = 0; i < (sc.pre ?? 30); i++) { await p.evaluate(() => window.__advance(1000 / 60)); if (i % 4 === 0) await p.waitForTimeout(10); }
  // the scene didn't take (say, the fire found nothing to burn): somewhere else
  if (sc.check && tries < 6 && !(await p.evaluate('(() => { const g = window.__pc.game; return ' + sc.check + '; })()'))) {
    console.log(tag, 'retry', tries + 1);
    await ctx.close();
    return record({ ...sc, salt: (sc.salt || '') + 'r' }, framed, tries + 1);
  }
  const N = sc.secs * FPS, log = [];
  let ff = null;
  if (!preview) ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264rgb', '-qp', '0', '-preset', 'ultrafast', path.join(TMP, tag + '.mkv')], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < N; i++) {
    const [url, meta] = await p.evaluate((S) => { window.__advance(1000 / 60); return [document.getElementById('game').toDataURL('image/png'), eval(S)]; }, SAMPLE);
    log.push(meta);
    const png = Buffer.from(url.split(',')[1], 'base64');
    if (ff) { if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r)); }
    else if (i % 60 === 0) fs.writeFileSync(path.join(TMP, `${tag}-p${String(i / 60).padStart(2, '0')}.png`), png);
  }
  if (ff) { ff.stdin.end(); await new Promise((r) => ff.on('close', r)); }
  fs.writeFileSync(path.join(TMP, tag + '.json'), JSON.stringify(log));
  const info = await p.evaluate(() => { const g = window.__pc.game; return { biome: g.world.biomeAt(g.player.x, g.player.y), clock: +g.clock.toFixed(2), mode: g.band.mode, prey: g.stats.prey, fire: g.fire.size, gnus: g.gnus.length, state: window.__pc.state, S: window.__pc.renderer.S }; });
  console.log(tag, JSON.stringify(info));
  await ctx.close();
  if (preview) execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', path.join(TMP, tag + '-p%02d.png'), '-vf', 'scale=iw/2:-1,tile=3x3', '-frames:v', '1', path.join(TMP, 'sheet-' + tag + '.png')]);
  else if (framed) encode(sc.name);
}
for (const sc of SCENES) {
  await record(sc, true);
  if (live) await record(sc, false);
}
console.log(errs.join('\n') || 'no errors');
await b.close();

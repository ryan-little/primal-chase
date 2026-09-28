// Records the title-screen / cinematic clips from the real game, headless and frame-exact.
//   node tools/serve.mjs 8791 &   then   node tools/clips.mjs [port] [only=name,name] [preview]
// Time is virtual: requestAnimationFrame is replaced so each captured frame advances the game
// exactly 1/30 s, however long the capture takes. Frames are grabbed from the renderer's own
// art-resolution buffer (480x270, no HUD, no edge arrows), then ffmpeg doubles them with
// nearest-neighbour (so 4:2:0 chroma lands on whole art pixels) and encodes H.264 MP4.
import { chromium } from 'file:///C:/Users/ryan/Projects/Primal-Chase-Fable/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const port = +(process.argv[2] || 8791);
const only = (process.argv.find((a) => a.startsWith('only=')) || '').slice(5).split(',').filter(Boolean);
const preview = process.argv.includes('preview');
const FPS = 30;
const FFMPEG = process.env.FFMPEG || 'C:/Users/ryan/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const OUT = 'assets/clips';
const TMP = 'tools/shots/clipframes';
fs.mkdirSync(OUT, { recursive: true });

// Each scene: where and when, what to set up, how the cat moves (default: the demo bot).
const SCENES = [
  { name: 'dawn', biome: 0, clock: 0.035, secs: 8, setup: `g.weather.fogDawn = true; g.weather.fog = 0.85; clearBand();`, input: `trot(0.75, 9)` },
  { name: 'band', biome: 0, clock: 0.22, secs: 8, pre: 10, setup: `bandBehind(190);`, input: `stalkAway(0.5)`, cam: `mid(0.5)` },
  { name: 'heat', biome: 3, clock: 0.36, secs: 7, setup: `g.weather.heatDay = true; g.weather.heat = 1; clearBand(); pl.heat = 40;`, input: `trot(0.65, 5)`, heatCap: 76 },
  { name: 'night', biome: 1, clock: 0.8, secs: 8, pre: 10, setup: `bandBehind(170);`, input: `stalkAway(0.55)`, cam: `mid(0.45)` },
  { name: 'chase', crf: 27, biome: 2, clock: 0.5, secs: 8, pre: 6, setup: `bandBehind(100, true);`, input: `stalkAway(0.8)`, cam: `mid(0.4)` },
  { name: 'hunt', biome: 0, clock: 0.16, pre: 4, setup: `clearBand(); pl.food = 18; gazelles(105);`, input: `hunt()`, secs: 6 },
  { name: 'stampede', biome: 0, clock: 0.3, secs: 7, pre: 40, setup: `clearBand(); g.day = 2; g.stampedeT = 0.1;`, input: `trot(0.3, 12)`, cam: `herd()` },
  { name: 'storm', crf: 29, biome: 1, clock: 0.45, secs: 8, setup: `clearBand(); g.startWeather('storm', 60); g.weather.rain = 1; g.weather.strikeT = 0.5;`, input: `trot(0.8, 7)` },
  { name: 'fire', crf: 29, biome: 0, clock: 0.6, secs: 8, pre: 75, setup: `clearBand(); fireBehind();`, input: `stalkAway(0.4)`, cam: `[cat().x + (window.__fire[0] - cat().x) * 0.4, cat().y - 8 + (window.__fire[1] - cat().y) * 0.4]` },
  { name: 'highland', biome: 4, clock: 0.63, secs: 7, setup: `clearBand();`, input: `trot(0.7, 11)` },
].filter((s) => !only.length || only.includes(s.name));

// Page-side helpers, evaluated once per scene with g = the running game.
const HELPERS = `
const g = window.__pc.game, pl = g.player, W = g.world, R = window.__pc.renderer;
const clearBand = () => { g.hunters.forEach((h) => { h.x += 9000; }); g.dogs.forEach((d) => { d.x += 9000; }); g.band.x += 9000; g.band.mode = 'track'; g.scoutT = 1e9; g.runners = []; };
const bandBehind = (d, chase) => {
  // lay a fresh trail from behind up to the cat and put the band on it
  const a = Math.random() * 6.283, tr = [];
  for (let i = 0; i <= 40; i++) { const t = i / 40; tr.push({ x: pl.x + Math.cos(a) * (d + 200) * (1 - t), y: pl.y + Math.sin(a) * (d + 200) * (1 - t), s: 1, water: false, id: 1e6 + i }); }
  g.trail = tr;
  const bx = pl.x + Math.cos(a) * d, by = pl.y + Math.sin(a) * d;
  g.band.x = bx; g.band.y = by; g.band.idx = Math.floor(40 * (200 / (d + 200))); g.band.mode = 'track';
  g.hunters.forEach((h, i) => { h.x = bx + (i - 1) * 14; h.y = by + (i % 2) * 10; });
  g.dogs.forEach((dg) => { dg.x += 9000; });
  g.scoutT = 1e9; g.runners = [];
  if (chase) { g.band.seen = 1; }
  window.__away = [-Math.cos(a), -Math.sin(a)];
};
const gazelles = (d) => {
  const a = Math.random() * 6.283; window.__away = [Math.cos(a), Math.sin(a)];
  for (let i = 0; i < 4; i++) g.prey.push({ id: 5e6 + i, kind: 'gazelle', herd: 5e6, x: pl.x + Math.cos(a) * (d + i * 14), y: pl.y + Math.sin(a) * (d + i * 14) + (i % 2 ? 10 : -8),
    vx: 0, vy: 0, face: 1, anim: Math.random(), state: 'graze', fleeT: 0, z: 0 });
};
const fireBehind = () => {
  const a = g.weather.windA; // fire runs downwind; start it upwind of the cat
  const ux = -Math.cos(a), uy = -Math.sin(a), px = -uy, py = ux;
  for (let i = -6; i <= 6; i++) g.ignite(pl.x + ux * 70 + px * i * 9, pl.y + uy * 70 + py * i * 9);
  window.__away = [Math.cos(a), Math.sin(a)];
  window.__fire = [pl.x + ux * 70, pl.y + uy * 70];
};
`;

// Per-frame input makers (page side). Each returns (g) => input.
const INPUTS = `
window.mid = (k) => { const g = window.__pc.game, q = g.player; let h = null, hd = 1e9; for (const u of g.hunters) { const d = Math.hypot(u.x - q.x, u.y - q.y); if (d < hd) { hd = d; h = u; } } return h && hd < 420 ? [q.x + (h.x - q.x) * k * 0.9, q.y - 8 + (h.y - q.y) * k * 0.9] : [q.x, q.y - 8]; };
window.cat = () => window.__pc.game.player;
window.herd = () => { const g = window.__pc.game, q = g.player; if (!g.gnus.length) return [q.x, q.y - 8]; let x = 0, y = 0; for (const u of g.gnus) { x += u.x; y += u.y; } x /= g.gnus.length; y /= g.gnus.length; return Math.hypot(x - q.x, y - q.y) < 300 ? [(x + q.x) / 2, (y + q.y) / 2 - 8] : [q.x, q.y - 8]; };
window.__mk = {
  trot: (mag, period, sprint) => { let a0 = Math.random() * 6.283; return (g) => { const t = g.time; const a = a0 + Math.sin(t / period * 6.283) * 0.7; return { x: Math.cos(a) * mag, y: Math.sin(a) * mag * 0.8, sprint: !!sprint && g.player.heat < 70, stalk: false, pounce: false }; }; },
  stalkAway: (m) => (g) => { const [x, y] = window.__away; const w = Math.sin(g.time * 0.5) * 0.5; return { x: (x * Math.cos(w) - y * Math.sin(w)) * m, y: (x * Math.sin(w) + y * Math.cos(w)) * m, stalk: false, sprint: false, pounce: false }; },
  hunt: () => (g) => { const q = g.player; if (q.eating || g.stats.prey) return { x: 0, y: 0 }; let b = null, bd = 1e9; for (const k of g.prey) { const d = Math.hypot(k.x - q.x, k.y - q.y); if (d < bd) { bd = d; b = k; } } if (!b) return { x: 0, y: 0 }; const dx = b.x - q.x, dy = b.y - q.y; return { x: dx / bd, y: dy / bd, stalk: bd > 40, sprint: false, pounce: bd < 40 && q.stamina > 20 }; },
  flee: () => (g) => { const [x, y] = window.__away; const w = Math.sin(g.time * 0.7) * 0.4; return { x: x * Math.cos(w) - y * Math.sin(w), y: x * Math.sin(w) + y * Math.cos(w), sprint: g.player.heat < 70, stalk: false, pounce: false }; },
};
`;

function encode(sc) {
  const out = path.join(OUT, sc.name + '.mp4');
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(TMP, sc.name, 'f%04d.png'),
    '-vf', 'scale=iw*2:ih*2:flags=neighbor', '-c:v', 'libx264', '-preset', 'veryslow', '-tune', 'animation', '-crf', String(sc.crf || process.env.CRF || 26),
    '-profile:v', 'high', '-level', '4.0', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out]);
  console.log('  ->', out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
}
if (process.argv.includes('encode')) { for (const sc of SCENES) encode(sc); process.exit(0); } // re-encode saved frames only

const b = await chromium.launch({ channel: 'msedge' });
const errs = [];
for (const sc of SCENES) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(sc.name + ' PAGEERR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(sc.name + ' ' + m.text()); });
  // virtual clock: frames only happen when we say so
  await p.addInitScript(() => {
    const q = []; let vt = performance.now();
    window.requestAnimationFrame = (cb) => { q.push(cb); return q.length; };
    window.__advance = (ms) => { vt += ms; const cbs = q.splice(0); for (const cb of cbs) cb(vt); };
  });
  await p.goto(`http://127.0.0.1:${port}/index.html`);
  await p.waitForFunction(() => window.__pc && window.__advance);
  await p.evaluate(() => { window.__advance(16); window.__pc.startRun(); window.__advance(16); });
  // move to the biome, set the hour
  const ok = await p.evaluate(({ bi, clock }) => {
    const g = window.__pc.game, W = g.world;
    const a0 = Math.random() * 6.283;
    for (let r = 400; r < 12000; r += 120) for (let k = 0; k < 40; k++) {
      const a = a0 + k / 40 * 6.283, x = g.player.x + Math.cos(a) * r, y = g.player.y + Math.sin(a) * r;
      if (W.T.biomeAt(x, y) !== bi) continue;
      let good = true;
      for (let j = 0; j < 12 && good; j++) { const gg = W.T.ground(x + Math.cos(j) * 90, y + Math.sin(j) * 70); if (gg === 13 || gg === 16 || gg === 8 || gg === 7) good = false; }
      for (let j = 0; j < 10 && good && bi !== 6; j++) if (W.T.biomeAt(x + Math.cos(j * 0.63) * 260, y + Math.sin(j * 0.63) * 180) !== bi) good = false;
      if (bi === 6) { good = W.T.ground(x, y) === 12; }
      if (!good) continue;
      g.player.x = x; g.player.y = y; g.clock = clock; window.__pc.renderer.camInit = false;
      return true;
    }
    return false;
  }, { bi: sc.biome, clock: sc.clock });
  if (!ok) console.log(sc.name, 'no biome spot found');
  // let the terrain worker paint around the new spot while game time stands still
  await p.evaluate(() => { const R = window.__pc.renderer, d = R.draw.bind(R); R.draw = (g, dt) => d(g, dt, false); R.pop = () => {}; });
  for (let i = 0; i < 40; i++) { await p.evaluate(() => window.__advance(1)); await p.waitForTimeout(15); }
  await p.evaluate(async () => { window.__botMake = (await import('/js/bot.js')).makeBot; });
  await p.evaluate('(() => {' + HELPERS + sc.setup + INPUTS + `
    const heatCap = ${sc.heatCap || 62};
    let inner = ${sc.input ? 'window.__mk.' + sc.input : 'null'};
    if (!inner) { const bot = window.__botMake(2); inner = (g) => bot(g); }
    const camFn = ${sc.cam ? '(g) => ' + sc.cam : 'null'};
    window.__pc.override = (g) => {
      if (camFn) { const c = camFn(g), R = window.__pc.renderer, S = window.__camS || (window.__camS = c.slice()); S[0] += (c[0] - S[0]) * 0.08; S[1] += (c[1] - S[1]) * 0.08; R.camInit = true; R.cam.x = S[0]; R.cam.y = S[1]; }
      const q = g.player; q.health = 100; q.water = Math.max(q.water, 60); if (!${sc.name === 'hunt'}) q.food = Math.max(q.food, 60);
      q.heat = Math.min(q.heat, heatCap); g.perkChoices = 0;
      return inner(g);
    };})()`);
  // pre-roll: the scene gets going before the first captured frame
  for (let i = 0; i < (sc.pre ?? 30); i++) { await p.evaluate(() => window.__advance(1000 / 30)); await p.waitForTimeout(12); }
  const dir = path.join(TMP, sc.name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const N = sc.secs * FPS;
  for (let i = 0; i < N; i++) {
    const url = await p.evaluate(() => {
      window.__advance(1000 / 30);
      const R = window.__pc.renderer;
      let c = window.__rec;
      if (!c) { c = window.__rec = document.createElement('canvas'); c.width = 480; c.height = 270; }
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = false;
      x.drawImage(R.buf, Math.round(R.fx), Math.round(R.fy), 480, 270, 0, 0, 480, 270);
      return c.toDataURL('image/png');
    });
    const png = Buffer.from(url.split(',')[1], 'base64');
    if (!preview) fs.writeFileSync(path.join(dir, `f${String(i).padStart(4, '0')}.png`), png);
    else if (i % 30 === 0) fs.writeFileSync(path.join(dir, `p${String(i / 30).padStart(2, '0')}.png`), png);
  }
  const info = await p.evaluate(() => { const g = window.__pc.game; return { biome: g.world.biomeAt(g.player.x, g.player.y), clock: +g.clock.toFixed(2), mode: g.band.mode, prey: g.stats.prey, fire: g.fire.size, gnus: g.gnus.length, state: window.__pc.state }; });
  console.log(sc.name, JSON.stringify(info));
  await ctx.close();
  if (preview) {
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', path.join(dir, 'p%02d.png'), '-vf', 'tile=3x3', '-frames:v', '1', path.join(TMP, 'sheet-' + sc.name + '.png')]);
    continue;
  }
  encode(sc);
}
console.log(errs.join('\n') || 'no errors');
await b.close();

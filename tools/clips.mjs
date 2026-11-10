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
import { chromium } from 'file:///C:/Users/ryan/tools/pw/node_modules/playwright-core/index.mjs';
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
  { name: 'dawn', biome: 0, clock: 0.035, secs: 9, pre: 90, setup: `g.weather.fogDawn = true; g.weather.fog = 0.85; clearBand(); level(); gazelles(95, 3);`, input: `trot(0.6, 9)`, aim: `pair(nearPrey(150), 0.35)` },
  // a flat-out sprint at grazing gazelles on open ground, ending on the catch
  { name: 'hunt', avoid: [2], tries: 40, catchAt: [1.3, 2.4], post: `openAt(g.carcasses[0])`, biome: 0, clock: 0.16, secs: 6, pre: 8, check: `!g.stats.prey && !window.__wet`, setup: `clearBand(); pl.food = 18; level(); dryAhead(400); gazelles(125, 1);`, input: `sprint()`, aim: `pair(nearPrey(140) || (g.carcasses[0] && [g.carcasses[0].x, g.carcasses[0].y - 6]), 0.45)` },
  { name: 'band', crf: 29, biome: 0, clock: 0.22, secs: 6, pre: 150, setup: `level(); bandBehind(420); g.sightRange = () => 0;`, quiet: true, input: `keep(380, 460)`, aim: `pair(bandAt(), 1)` },
  { name: 'heat', avoid: [6, 7, 8], biome: 3, clock: 0.36, secs: 9, pre: 150, setup: `g.weather.heatDay = true; g.weather.heat = 1; level(); bandBehind(420); pl.heat = 40; g.sightRange = () => 0;`, quiet: true, input: `keep(380, 460)`, aim: `pair(bandAt(), 1)`, heatCap: 76 },
  { name: 'night', avoid: [6, 7, 8, 2], biome: 0, salt: 'n', clock: 0.8, secs: 9, pre: 150, setup: `g.day = 5; level(); bandBehind(420); g.sightRange = () => 0;`, quiet: true, input: `keep(380, 460)`, aim: `pair(bandAt(), 1)` },
  { name: 'chase', crf: 29, biome: 2, clock: 0.5, secs: 7, pre: 120, setup: `level(); bandBehind(85, true);`, input: `keep(60, 95, 0.45)`, aim: `pair(nearHunter(), 0.5)` },
  { name: 'stampede', avoid: [2], biome: 0, salt: 'b', clock: 0.3, secs: 6, pre: 30, setup: `clearBand(); level(); herd();`, input: `aside(96)`, aim: `pair(nearGnus(), 0.3)` },
  { name: 'storm', crf: 29, biome: 2, salt: 'b', clock: 0.45, secs: 6, pre: 90, setup: `clearBand(); level(); g.startWeather('storm', 60); g.weather.rain = 1; g.weather.strikeT = 99; strikes([[2.2, 55], [5.2, -60]]);`, input: `trot(0.45, 7)`, aim: `pair(nearFire(120), 0.4)` },
  { name: 'fire', avoid: [2, 3, 6, 7, 8], check: `g.fire.size > 20`, biome: 0, clock: 0.6, secs: 6, pre: 60, setup: `clearBand(); level(); fireBehind(); fireproof();`, input: `wary(0.3, 8, 34)`, aim: `pair(nearFire(110), 0.4)` },
  // the quiet life between chases: no hunters anywhere
  { name: 'drink', biome: 0, clock: 0.12, secs: 7, pre: 20, check: `!!window.__water`, setup: `clearBand(); level(); pl.water = 22; waterAhead(70, 150); gazelles(150, 3);`, input: `drink()`, aim: `pair(null, 0)`, still: true },
  { name: 'feast', avoid: [2], biome: 0, clock: 0.42, secs: 7, pre: 20, check: `window.__open`, setup: `clearBand(); level(); pl.food = 20; carcassAhead(75);`, input: `feast()`, aim: `pair(null, 0)`, still: true },
  { name: 'rest', avoid: [2], biome: 0, clock: 0.52, secs: 7, pre: 20, check: `!!window.__shade`, setup: `clearBand(); level(); pl.heat = 55; shadeAhead(60, 150); gazelles(140, 4);`, input: `rest()`, aim: `pair(null, 0)`, still: true },
  // the band at home: sat around their fire while the cat watches from the grass
  { name: 'camp', biome: 0, landmark: 'camp', clock: 0.6, secs: 9, pre: 40, check: `!!window.__lm`, setup: `level(); bandAtCamp();`, input: `watch(150)`, aim: `pair([window.__lm.x + 6, window.__lm.y - 12], 0.62)`, still: true },
  // a pride on its kill: the cat gives it a wide berth, and one of them sees it off
  { name: 'pride', avoid: [2], biome: 0, clock: 0.3, secs: 6, pre: 30, setup: `clearBand(); level(); prideAhead(150, 84);`, input: `trot(0.42, 9)`, aim: `pair(nearLion(), 0.5)` },
  // a secret place, not yet found
  { name: 'secret', biome: 4, salt: 'c', avoid: [2], landmark: 'painted', clock: 0.3, secs: 9, pre: 30, check: `!!window.__lm`, setup: `clearBand(); level();`, input: `visit(34)`, aim: `pair([window.__lm.x, window.__lm.y - 26], 0.5)`, still: true },
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
  window.__herd = { x: sx, y: sy, ax, ay };
  window.__away = [-ax, -ay]; // the cat trots against the herd, so they meet mid-frame
};
const fireBehind = () => {
  // a fire line running level just above the cat; the cat walks slowly along it
  const [ax, ay] = window.__away;
  for (let i = -7; i <= 7; i++) g.ignite(pl.x + ax * i * 8, pl.y - 42 + Math.abs(ay) * i * 2);
};
// water within reach, preferably the way the cat is already heading
const waterAhead = (lo, hi) => { const w = W.nearestWater(pl.x, pl.y, hi); window.__water = w && Math.hypot(w[0] - pl.x, w[1] - pl.y) > lo ? w : null; };
// a fresh kill a short walk ahead, already found by the vultures
const carcassAhead = (d) => { const [ax, ay] = window.__away; const cx = pl.x + ax * d, cy = pl.y + ay * d; g.carcasses.push({ id: 8e6, x: cx, y: cy, meat: 60, max: 60, kind: 'gazelle', small: false, face: Math.sign(ax) || 1, t: 9 }); window.__open = true; for (const pr of W.propsNear(cx, cy, 90)) if ((pr.shade || pr.solid > 6) && Math.abs(pr.x - cx) < 60 && pr.y - cy > -14 && pr.y - cy < 80) window.__open = false; };
// the nearest shade tree a short walk away
const shadeAhead = (lo, hi) => { let b = null, bd = 1e9; for (const pr of W.propsNear(pl.x, pl.y, hi)) { if (!pr.shade || pr.kind === 'landmark') continue; const d = Math.hypot(pr.x - pl.x, pr.y - pl.y); if (d > lo && d < bd) { bd = d; b = pr; } } window.__shade = b; };
// the whole band idle around the camp fire (the band's own logic is held still for the shot)
const bandAtCamp = () => {
  const lm = window.__lm; if (!lm) return;
  const spots = [[10, 12], [34, 2], [-8, 9], [22, 14], [44, 10]];
  g.updateBand = () => {};
  g.band.x = lm.x; g.band.y = lm.y; g.band.mode = 'track'; g.scoutT = 1e9; g.runners = g.runners.filter((r) => r.keeper);
  g.hunters.forEach((h, i) => { const s = spots[i % spots.length]; h.x = lm.x + s[0]; h.y = lm.y + s[1]; h.vx = 0; h.vy = 0; h.state = 'walk'; h.windup = 0; h.face = s[0] > 17 ? -1 : 1; });
  g.dogs.forEach((d) => { d.x += 9000; });
};
// lions tearing at a gazelle, ahead and a little to one side of the cat's line
const prideAhead = (d, off) => {
  const [ax, ay] = window.__away, cx = pl.x + ax * d - ay * off, cy = pl.y + ay * d + ax * off;
  g.carcasses.push({ id: 8e6 + 1, x: cx, y: cy, meat: 60, max: 60, kind: 'gazelle', face: 1, t: 0, lions: true });
  // muzzles on the kill: one from each side, one reaching in over it
  [[-38, 2, 1], [46, 5, -1], [24, -7, -1]].forEach(([dx, dy, f], i) => g.lions.push({ id: 9e6 + i, x: cx + dx, y: cy + dy, hx: cx + dx, hy: cy + dy, vx: 0, vy: 0, face: f, anim: Math.random(), state: 'feed', t: 0, target: null, bite: 0, life: 110 }));
  g.prideT = 1e9;
  // they stay on their kill for the shot, feeding; nobody charges
  g.updateLions = (dt) => { for (const L of g.lions) { L.anim = (L.anim + dt * 0.3) % 1; L.state = 'feed'; } };
};
// is there water or a cliff on the line ahead (a fleeing animal is turned back), or tall grass (it hides the cat)?
const dryAhead = (d) => { const [ax, ay] = window.__away; window.__wet = false; for (let r = 0; r <= d; r += 12) for (const o of [-30, 0, 30]) { const t = W.typeAt(pl.x + ax * r - ay * o, pl.y + ay * r + ax * o); if (W.isWater(t) || t === 2 || t === 13 || t === 16) window.__wet = true; } };
// the shot is about the fire, not about getting burned: no hurt flash or knockback from flames
const fireproof = () => { const h = g.hurtPlayer.bind(g); g.hurtPlayer = (d, x, y, kind) => kind === 'fire' ? false : h(d, x, y, kind); };
// is this spot clear of trees and big rocks that would hide what happens on it?
window.openAt = (c) => { if (!c) return false; for (const pr of W.propsNear(c.x, c.y, 90)) if ((pr.shade || pr.solid > 6) && Math.abs(pr.x - c.x) < 60 && pr.y - c.y > -14 && pr.y - c.y < 80) return false; return true; };
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
// the band as a group, wherever the cat is (for shots of them alone)
window.bandAt = () => { const g = window.__pc.game, hs = g.hunters.filter((u) => Math.hypot(u.x - g.band.x, u.y - g.band.y) < 200); if (!hs.length) return null; let x = 0, y = 0; for (const u of hs) { x += u.x; y += u.y; } return [x / hs.length, y / hs.length - 14]; };
window.nearLion = () => { const g = window.__pc.game, h = near(g.lions); return h && h.d < 260 ? [h.x, h.y - 8] : null; };
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
// Routing: bend any scripted heading around solid props (rocks, trunks, termite mounds, landmarks)
// before the cat reaches them, so it flows past instead of pushing into one.
window.steer = (inp, g) => {
  const m = Math.hypot(inp.x || 0, inp.y || 0);
  if (m < 0.05) return inp;
  const q = g.player, W = g.world;
  let dx = inp.x / m, dy = inp.y / m;
  const nx = -dy, ny = dx;
  let turn = 0;
  for (const pr of W.propsNear(q.x, q.y, 90)) {
    if (!pr.solid) continue;
    const rx = pr.x - q.x, ry = pr.y - 2 - q.y;
    const along = rx * dx + ry * dy, side = rx * nx + ry * ny;
    const R = Math.max(pr.solid, pr.solidW || 0) + 11;
    if (along < -R * 0.5 || along > 58 || Math.abs(side) > R) continue;
    // the nearer and the more dead-ahead, the harder the turn; pass on the side it already favors
    const w = (1 - Math.abs(side) / R) * (1 - Math.max(0, along) / 62);
    turn += (side >= 0 ? -1 : 1) * (0.6 + 1.8 * w);
  }
  turn = Math.max(-2.2, Math.min(2.2, turn));
  // eased, and committed to a side once chosen, so the heading never flickers frame to frame
  const S = window.__steer || (window.__steer = { v: 0 });
  if (turn && S.v && Math.sign(turn) !== Math.sign(S.v) && Math.abs(S.v) > 0.25) turn = Math.sign(S.v) * Math.abs(turn);
  S.v += (turn - S.v) * 0.12;
  if (Math.abs(S.v) < 0.02) return inp;
  dx += nx * S.v; dy += ny * S.v;
  const l = Math.hypot(dx, dy) || 1;
  return { ...inp, x: dx / l * m, y: dy / l * m };
};
window.__mk = {
  trot: (mag, period) => { const [ax, ay] = window.__away, a0 = Math.atan2(ay, ax); return (g) => { const a = a0 + Math.sin(g.time / period * 6.283) * 0.45; return { x: Math.cos(a) * mag, y: Math.sin(a) * mag, sprint: false, stalk: false, pounce: false }; }; },
  // trot, but bend away from any flames closer than r
  wary: (mag, period, r) => { const t = window.__mk.trot(mag, period); return (g) => { const v = t(g), q = g.player; let px = 0, py = 0; for (const f of g.fire.values()) { const dx = q.x - f.x, dy = q.y - f.y, d = Math.hypot(dx, dy); if (d < r && d > 0.1) { px += dx / d * (1 - d / r); py += dy / d * (1 - d / r); } } const pm = Math.hypot(px, py); if (pm > 0) { const k = Math.min(1, pm) * 1.4; v.x += px / pm * k * 0.7; v.y += py / pm * k * 0.7; v.sprint = pm > 0.6; } return v; }; },
  // move away from the nearest hunter, faster when it's close, easing off when it
  // falls back, so the gap stays between lo and hi
  keep: (lo, hi, weave = 0.3) => (g) => {
    const q = g.player, [ax, ay] = window.__away;
    const h = near(g.hunters, (u) => u.down <= 0), d = h ? h.d : 999;
    const m = d < lo ? 1 : d > hi ? 0.2 : 0.2 + 0.8 * (hi - d) / (hi - lo);
    const w = Math.sin(g.time * 0.6) * weave;
    return { x: (ax * Math.cos(w) - ay * Math.sin(w)) * m, y: (ax * Math.sin(w) + ay * Math.cos(w)) * m, sprint: d < lo - 12 && q.heat < 70, stalk: false, pounce: false };
  },
  // walk to the water's edge and drink
  drink: () => (g) => { const q = g.player, w = window.__water; if (!w || q.drinking) return { x: 0, y: 0 }; const d = Math.hypot(w[0] - q.x, w[1] - q.y); if (d < 12 || q.ground === 7 || q.ground === 8) return { x: 0, y: 0 }; const m = d < 30 ? 0.45 : 0.7; return { x: (w[0] - q.x) / d * m, y: (w[1] - q.y) / d * m }; },
  // walk up to the kill and eat
  feast: () => (g) => { const q = g.player, c = g.carcasses[0]; if (!c || q.eating) return { x: 0, y: 0 }; const d = Math.hypot(c.x - q.x, c.y - q.y); if (d < 14) return { x: 0, y: 0 }; const m = d < 34 ? 0.45 : 0.7; return { x: (c.x - q.x) / d * m, y: (c.y - q.y) / d * m }; },
  // amble into the shade just below the tree and lie down
  rest: () => (g) => { const q = g.player, t = window.__shade; if (!t) return { x: 0, y: 0 }; const tx = t.x + (q.x < t.x ? -1 : 1) * (t.solid + 12), ty = t.y + 7, d = Math.hypot(tx - q.x, ty - q.y); if (d < 5 || window.__resting) { window.__resting = true; return { x: 0, y: 0 }; } const m = d < 26 ? 0.4 : 0.6; return { x: (tx - q.x) / d * m, y: (ty - q.y) / d * m }; },
  // creep toward a landmark and stop short of it, watching
  watch: (stop) => (g) => { const q = g.player, lm = window.__lm; if (!lm) return { x: 0, y: 0 }; const d = Math.hypot(lm.x - q.x, lm.y + 8 - q.y); if (d < stop) return { x: 0, y: 0 }; return { x: (lm.x - q.x) / d * 0.3, y: (lm.y + 8 - q.y) / d * 0.3, stalk: true }; },
  // walk up to a landmark
  visit: (stop) => (g) => { const q = g.player, lm = window.__lm; if (!lm) return { x: 0, y: 0 }; const tx = lm.x + (q.x < lm.x ? -stop : stop), ty = lm.y + 6, d = Math.hypot(tx - q.x, ty - q.y); if (d < 5) return { x: 0, y: 0 }; const m = d < 24 ? 0.4 : 0.62; return { x: (tx - q.x) / d * m, y: (ty - q.y) / d * m }; },
  // a herd is coming down the line the cat is on: break sideways until it is clear by the gap, then turn and watch it pass
  aside: (gap) => (g) => { const q = g.player, H = window.__herd; if (!H) return { x: 0, y: 0 }; const nx = -H.ay, ny = H.ax, lat = (q.x - H.x) * nx + (q.y - H.y) * ny, sd = lat >= 0 ? 1 : -1; if (Math.abs(lat) >= gap) { q.face = Math.sign(-nx * sd) || q.face; return { x: 0, y: 0 }; } const m = Math.abs(lat) < gap - 30 ? 1 : 0.6; return { x: nx * sd * m - H.ax * 0.25, y: ny * sd * m - H.ay * 0.25, sprint: Math.abs(lat) < 55 }; },
  // trot at the herd, pounce the first wildebeest that comes close, then stay on the kill
  gnu: () => (g) => { const q = g.player, [ax, ay] = window.__away; if (q.eating || g.stats.prey) return { x: 0, y: 0 }; const h = near(g.gnus); if (h && h.d < 34 && q.stamina > 25) return { x: (h.x - q.x) / h.d, y: (h.y - q.y) / h.d, pounce: true }; return { x: ax * 0.4, y: ay * 0.4, sprint: false, stalk: false, pounce: false }; },
  // charge the nearest gazelle at full speed and pounce once in reach; then stay on the kill
  // (staged: the gazelles flee at their cruising pace, skipping the opening burst that outruns a cat,
  // so the cat visibly closes the gap inside the shot)
  sprint: () => (g) => { for (const k of g.prey) if (k.state === 'flee' && k.fleeT < 2.3) k.fleeT = 2.3; const q = g.player; if (g.stats.prey) return window.__mk.dine(g); const b = near(g.prey); if (!b) return { x: 0, y: 0 }; return { x: (b.x - q.x) / b.d, y: (b.y - q.y) / b.d, sprint: true, stalk: false, pounce: b.d < 52 }; },
  // settle beside the kill, level with it, facing it, head over the body
  dine: (g) => { const q = g.player, c = g.carcasses[0]; if (!c) return { x: 0, y: 0 }; const D = window.__dine || (window.__dine = { side: Math.sign(q.x - c.x) || 1 }); const tx = c.x + D.side * 20, ty = c.y + 1, d = Math.hypot(tx - q.x, ty - q.y); if (D.sat || d < 3) { D.sat = true; q.face = -D.side; return { x: 0, y: 0 }; } const m = d < 20 ? 0.35 : 0.55; return { x: (tx - q.x) / d * m, y: (ty - q.y) / d * m }; },
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
  const ok = await p.evaluate(({ bi, clock, seed, avoid, want }) => {
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
      if (!good && !want) continue;
      if (want) {
        // a scene at a landmark: the nearest one of that kind, the cat a short way off to one side
        let lm = null, bd = 1e9;
        for (const m of W.landmarksNear(x, y, 5000)) { const d = Math.hypot(m.x - x, m.y - y); if (m.type === want && d < bd) { bd = d; lm = m; } }
        if (!lm) continue;
        window.__lm = lm;
        const side = Math.random() < 0.5 ? -1 : 1;
        g.player.x = lm.x + side * 165; g.player.y = lm.y + 26; g.clock = clock; window.__pc.renderer.camInit = false;
        return true;
      }
      g.player.x = x; g.player.y = y; g.clock = clock; window.__pc.renderer.camInit = false;
      return true;
    }
    return false;
  }, { bi: sc.biome, clock: sc.clock, seed, avoid: sc.avoid || [], want: sc.landmark || null });
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
      const q = g.player; q.health = 100; if (!${sc.name === 'drink'}) q.water = Math.max(q.water, 60); if (!${sc.name === 'hunt' || sc.name === 'feast'}) q.food = Math.max(q.food, 60);
      q.heat = Math.min(q.heat, heatCap); g.perkChoices = 0;
      if (${!!sc.quiet}) for (const h of g.hunters) { h.throwCd = 9; h.windup = 0; if (h.markType === '?') h.mark = 0; }
      for (const s of window.__strikes || []) if (!s.done && g.time >= window.__t0 + s.t) { s.done = true; g.weather.strikes.push({ x: q.x + s.dx, y: q.y - 6, t: 0.9 }); }
      return window.steer(inner(g), g);
    };})()`);
  // pre-roll: the scene gets going before the first captured frame
  await p.evaluate(() => { window.__t0 = window.__pc.game.time; });
  for (let i = 0; i < (sc.pre ?? 30); i++) { await p.evaluate(() => window.__advance(1000 / 60)); if (i % 4 === 0) await p.waitForTimeout(10); }
  // the scene didn't take (say, the fire found nothing to burn): somewhere else
  if (sc.check && tries < (sc.tries || 6) && !(await p.evaluate('(() => { const g = window.__pc.game; return ' + sc.check + '; })()'))) {
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
  // a cat that should be traveling but sat still (pinned on something) spoils the clip: go somewhere else
  if (/^(trot|keep)/.test(sc.input) && tries < 6) {
    const pos = log.map((m) => [m.cam[0] + m.cat[0] * 1440 / m.S, m.cam[1] + m.cat[1] * 810 / m.S]);
    let run = 0, worst = 0;
    for (let i = 1; i < pos.length; i++) { run = Math.hypot(pos[i][0] - pos[i - 1][0], pos[i][1] - pos[i - 1][1]) * FPS < 6 ? run + 1 : 0; worst = Math.max(worst, run); }
    if (worst > 24) {
      console.log(tag, 'cat stalled for', worst, 'frames; retry', tries + 1);
      await ctx.close();
      return record({ ...sc, salt: (sc.salt || '') + 's' }, framed, tries + 1);
    }
  }
  // something only known once the shot is done (say, the kill landed under a tree): somewhere else
  if (sc.post && tries < (sc.tries || 6) && !(await p.evaluate('(() => { const g = window.__pc.game; return ' + sc.post + '; })()'))) {
    console.log(tag, 'post check failed; retry', tries + 1);
    await ctx.close();
    return record({ ...sc, salt: (sc.salt || '') + 'p' }, framed, tries + 1);
  }
  // a hunt that ends too soon (prey pinned) or never: somewhere else
  if (sc.catchAt && tries < (sc.tries || 6)) {
    const k = log.findIndex((m) => m.prey) / FPS;
    if (k < sc.catchAt[0] || k > sc.catchAt[1]) {
      console.log(tag, 'catch at', k < 0 ? 'never' : k.toFixed(2) + 's', '; retry', tries + 1);
      await ctx.close();
      return record({ ...sc, salt: (sc.salt || '') + 'k' }, framed, tries + 1);
    }
  }
  const info = await p.evaluate(() => { const g = window.__pc.game; return { biome: g.world.biomeAt(g.player.x, g.player.y), clock: +g.clock.toFixed(2), mode: g.band.mode, prey: g.stats.prey, hurts: g.stats.hurts || 0, fire: g.fire.size, gnus: g.gnus.length, state: window.__pc.state, S: window.__pc.renderer.S }; });
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

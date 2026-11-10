// Boot, screens, the frame loop, and the glue between simulation, sound, pixels and HUD.

import { buildArt } from './art2/build.js';
import { Audio } from './audio.js';
import { Game, BITS, HUNTER_DAYS, TRACKERS_DAY, TORCH_DAY, PACE_DAY, FIRE_DAY } from './game.js';
import { SPECIES } from './fauna.js';
import { PERK_BY_ID } from './perks.js';
import { SECRETS, SECRET_IDS } from './secrets.js';
import { Minimap } from './minimap.js';
import { ClipLayer, TitleReel } from './clips.js';
import { Cinematic } from './cinematic.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { G, GROUND_INFO } from './world.js';
import { installUI, drawLogo as drawLogoArt, iconImg, PERK_ICON, FEAT_ICON, SECRET_ICON, perkArt, secretArt, stage, spr, icon } from './ui-art.js';
import { P } from './palette.js';
import { clamp, dist } from './util.js';

const $ = (id) => document.getElementById(id);
const art = buildArt();
const audio = new Audio();
const renderer = new Renderer($('game'), art);
const input = new Input($('game'));
const minimap = new Minimap($('minimap'), $('bigmap'));

// ---------------- persistence ----------------
const store = {
  get(k, d) { try { const v = localStorage.getItem('pc2_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('pc2_' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const usLocale = /-(US|LR|MM)$/i.test(navigator.language || '');
const settings = Object.assign({ music: 0.8, sfx: 0.9, reduceShake: false, hints: true, units: usLocale ? 'imperial' : 'metric', cinematic: true }, store.get('settings', {}));
// meters → display string; long for run totals, short for the tracker
function fmtDist(m, long = false) {
  if (settings.units === 'imperial') return long ? `${(m / 1609.34).toFixed(2)} mi` : `${Math.round(m * 3.281)} ft`;
  return long ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}
const MX = '<span class="mx">x</span>';
function applySettings() {
  audio.musicVol = settings.music;
  audio.sfxVol = settings.sfx;
  audio.applyVolumes();
  renderer.reducedMotion = settings.reduceShake;
  document.body.classList.toggle('calm', !!settings.reduceShake);
  renderer.imperial = settings.units === 'imperial';
  store.set('settings', settings);
}
applySettings();

// ---------------- UI kit, icons, favicon, logo (js/ui-art.js) ----------------
const uiBuild = installUI(art);
for (const [id, key] of [['v-health', 'health'], ['v-heat', 'heat'], ['v-water', 'water'], ['v-food', 'food']]) {
  $(id).querySelector('img').src = art.icons[key];
}
const drawLogo = (t = 0, c = $('logo')) => drawLogoArt(c, t, c.id === 'cine-logo');
const pxCss = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--px')) || 2;
// How to survive: a strip of the chase over the page, and an icon for each lesson
{
  const how = $('how').querySelector('.panel');
  const fr = document.createElement('canvas');
  fr.className = 'vignette how-strip';
  fr.setAttribute('aria-hidden', 'true');
  how.querySelector('h2').after(fr);
  const icons = ['heat', 'hunter', 'water', 'wave', 'food', 'spear', 'prints', 'cliff', 'secret', 'spark', 'storm', 'lion'];
  how.querySelectorAll('.how-grid > div > h3').forEach((h, i) => h.insertAdjacentHTML('afterbegin', iconImg(icons[i] || 'paw')));
  const kick = stage(fr, (x, t) => drawHowStrip(fr, x, t), 12);
  new MutationObserver(() => { if (!$('how').classList.contains('hidden')) { sizeVignette(fr, 300, 36); kick(); } }).observe($('how'), { attributes: true, attributeFilter: ['class'] });
}
// fit a vignette canvas to its column in whole art pixels
function sizeVignette(c, maxW, h) {
  const px = pxCss(), avail = c.parentElement.clientWidth - 40;
  const w = Math.max(120, Math.min(maxW, Math.floor(avail / px)));
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  c.style.width = w * px + 'px'; c.style.height = h * px + 'px';
}
// a painted backdrop: banded sky, a sun, a strip of grass that can scroll
function backdrop(x, W, H, t, { sky, sun, ground, scroll = 0 }) {
  for (let y = 0; y < H; y++) {
    const k = Math.min(sky.length - 1, Math.floor((y / (H - 8)) * sky.length));
    x.fillStyle = sky[k]; x.fillRect(0, y, W, 1);
    if (k + 1 < sky.length && (y / (H - 8)) * sky.length % 1 > 0.7) { x.fillStyle = sky[k + 1]; for (let i = y % 2; i < W; i += 2) x.fillRect(i, y, 1, 1); }
  }
  if (sun) { x.fillStyle = sun[0]; x.beginPath(); x.arc(sun[1] * W, H - 9, sun[2], Math.PI, 0); x.fill(); }
  x.fillStyle = ground[0]; x.fillRect(0, H - 9, W, 9);
  x.fillStyle = ground[1]; x.fillRect(0, H - 9, W, 1);
  x.fillStyle = ground[2];
  const off = Math.floor(scroll) % 13;
  for (let i = -13; i < W + 13; i += 13) { const gx = i - off; x.fillRect(gx, H - 11, 1, 3); x.fillRect(gx + 2, H - 12, 1, 4); x.fillRect(gx + 7, H - 6, 1, 2); }
}
function drawHowStrip(c, x, t) {
  const W = c.width, H = c.height;
  x.clearRect(0, 0, W, H);
  backdrop(x, W, H, t, { sky: ['#e8c890', '#e0b878', '#d8a868', '#c99a5c'], sun: ['#ffe8a0', 0.62, 7], ground: ['#a8903f', '#c2a64a', '#7a6a2e'], scroll: t * 60 });
  const y = H - 4;
  const C = art.cat, cat = C.run[Math.floor(t * 14) % C.run.length];
  spr(x, C, cat, Math.round(W * 0.74), y);
  // the band: two running, one stopping to throw every few seconds
  for (let i = 0; i < 3; i++) {
    const Hn = art.hunter[i % art.hunter.length];
    let f = Hn.d.run[Math.floor(t * 10 + i * 3) % Hn.d.run.length];
    if (i === 0) {
      const ph = (t % 4) / 4;
      if (ph > 0.55 && ph < 0.75) f = Hn.d.windup[Math.min(3, Math.floor((ph - 0.55) / 0.2 * 4))];
      else if (ph >= 0.75 && ph < 0.95) f = Hn.d.throw[Math.min(4, Math.floor((ph - 0.75) / 0.2 * 5))];
    }
    spr(x, Hn, f, Math.round(W * 0.12 + i * 22), y - (i % 2));
  }
  const G = art.gazelle, gf = G.stot ? G.stot[Math.floor(t * 9) % G.stot.length] : G.run[0];
  if (W > 220) spr(x, G, gf, Math.round(W * 0.93), y - 1);
}
// death: the band over the cat, at dusk
const deathStrip = document.createElement('canvas');
deathStrip.className = 'vignette death-strip';
deathStrip.setAttribute('aria-hidden', 'true');
$('death').querySelector('.kicker').before(deathStrip);
const kickDeath = stage(deathStrip, (x, t) => {
  const W = deathStrip.width, H = deathStrip.height, y = H - 4;
  x.clearRect(0, 0, W, H);
  backdrop(x, W, H, t, { sky: ['#3a2a3a', '#6a3a32', '#a8502a', '#d8803a'], sun: ['#ffb13b', 0.22, 10], ground: ['#5a4a22', '#7a6a2e', '#3a301a'] });
  const C = art.cat, cx = Math.round(W / 2);
  spr(x, C, C.dead[0], cx, y);
  if (art.spearStuck) x.drawImage(art.spearStuck.img, cx + 14 - art.spearStuck.ox, y - 2 - art.spearStuck.oy);
  for (let i = 0; i < 3; i++) {
    const Hn = art.hunter[i % art.hunter.length], f = Hn.d.cheer[Math.floor(t * 7 + i * 2) % Hn.d.cheer.length];
    const hx = [cx - 40, cx + 42, cx - 62][i];
    spr(x, Hn, f, hx, y - (i === 2 ? 1 : 0), i === 1);
  }
}, 10);

// ---------------- screens ----------------
let state = 'title';
let game = null;
let returnTo = 'title';
const screens = ['title', 'how', 'settings', 'pause', 'death', 'feats', 'perk', 'mapview', 'journal'];
function show(name) {
  for (const s of screens) $(s).classList.toggle('hidden', s !== name);
  const first = name && $(name).querySelector('.perk-card, .btn.primary, .btn');
  if (first && !input.usingTouch) setTimeout(() => first.focus({ preventScroll: true }), 30);
}
function bestLine() {
  const best = store.get('best', 0);
  const runs = store.get('runs', []);
  const db = store.get('daily_' + todayKey(), 0);
  return best ? `Best: ${best.toLocaleString()} · ${runs.length} run${runs.length === 1 ? '' : 's'}${db ? ` · today's daily ${db.toLocaleString()}` : ''} · feats ${feats.size}/${FEATS.length}` : '';
}
// Behind the title: recorded clips of real play, not a live game (much lighter on phones).
const clipLayer = new ClipLayer($('clips'));
const reel = new TitleReel(clipLayer);
// autoplay was refused: the first key or tap on the title gets the footage going
for (const ev of ['keydown', 'pointerdown']) addEventListener(ev, () => { if (!cine) clipLayer.unblock(); }, true);
function toTitle() {
  state = 'title';
  document.body.classList.remove('playing');
  $('hud').classList.add('hidden');
  $('best-title').textContent = bestLine();
  audio.menu = true;
  audio.intensity = 0;
  audio.night = 0;
  audio.rain = 0;
  audio.setMuffle(false);
  reel.start();
  show('title');
}
// The opening, once per page load when the setting is on. It starts silent (browsers hold
// audio until a gesture); the key or tap that skips it also wakes the title music.
let cine = null;
function startCinematic() {
  state = 'cine';
  show(null);
  cine = new Cinematic(clipLayer, { root: $('cine'), line: $('cine-line'), logo: $('cine-logo'), skip: $('cine-skip'), voice: settings.sfx > 0 }, () => { cine = null; toTitle(); });
  cine.start();
}

const click = () => audio.play('ui', { pitch: 81 });
$('btn-start').onclick = () => { click(); startRun(); };
$('btn-how').onclick = () => { click(); returnTo = 'title'; show('how'); };
$('btn-daily').onclick = () => { click(); startRun(true); };
$('btn-feats').onclick = () => { click(); returnTo = 'title'; renderFeats(); show('feats'); };
$('btn-journal').onclick = () => { click(); returnTo = 'title'; renderJournal(); show('journal'); };
$('map-btn').onclick = () => openMap();
$('btn-map-close').onclick = () => closeMap();
function openMap() {
  if (state !== 'playing') return;
  state = 'map';
  audio.setMuffle(true);
  show('mapview');
  minimap.drawBig(game);
}
function closeMap() {
  if (state !== 'map') return;
  state = 'playing';
  audio.setMuffle(false);
  show(null);
}
let journal = store.get('journal', {});
function renderJournal() {
  const n = SECRET_IDS.filter((id) => journal[id]).length;
  $('journal-count').textContent = `${n} of ${SECRET_IDS.length} secret places found`;
  $('journal-list').innerHTML = SECRET_IDS.map((id) => {
    const S = SECRETS[id];
    return journal[id]
      ? `<div class="jentry"><img class="jart" src="${secretArt(id)}" alt=""><h3>${iconImg(SECRET_ICON[id])}${S.name}</h3><p>${S.lore}</p><small>found ${journal[id]} time${journal[id] > 1 ? 's' : ''}</small></div>`
      : `<div class="jentry locked"><h3>${iconImg('secret')}???</h3><p>Somewhere out there.</p></div>`;
  }).join('');
}
// Secret lore cards. When nothing is hunting nearby the world holds still until the player
// moves on. With danger close only a short card shows (name and gift) and play never stops;
// the full story comes back once things are quiet, and it is always in the Journal.
let loreT = 0, loreHold = false, loreGrace = 0, loreRest = false, lorePending = null, loreQuietT = 0;
function loreSafe(g) {
  const p = g.player, th = g.threat();
  if (g.over || th.mode === 'chase' || th.d < 480 || th.dogD < 360 || g.spears.length || g.croc) return false;
  return !g.runners.some((r) => !r.leaving && dist(r.x, r.y, p.x, p.y) < 450);
}
function showLore(g, S, kicker) {
  $('lore-kicker').textContent = kicker;
  $('lore-title').textContent = S.name;
  $('lore-text').textContent = S.lore;
  $('lore-gift').textContent = S.gift;
  $('lore').style.setProperty('--lore-ic', `url("${icon(SECRET_ICON[SECRET_IDS.find((k) => SECRETS[k] === S)] || 'secret')}")`);
  loreHold = loreSafe(g);
  loreGrace = 0.7;
  loreRest = false;
  lorePending = loreHold ? null : { S, t: 90 };
  loreQuietT = 0;
  loreT = loreHold ? 1 : 5;
  $('lore-more').innerHTML = loreHold
    ? (input.usingTouch ? 'Tap here or move to go on' : 'Press <kbd>Space</kbd> or move to go on') + ' · kept in your Journal'
    : 'The full story when you are safe. Always in your Journal.';
  $('lore').classList.toggle('hold', loreHold);
  $('lore').classList.toggle('brief', !loreHold);
  $('hud').classList.toggle('lorehold', loreHold);
  $('lore').classList.add('on');
  // a toast would land on top of the card; it waits until the card is gone
  $('toast').classList.remove('on');
}
function hideLore(all = false) {
  loreT = 0; loreHold = false;
  if (all) lorePending = null;
  $('lore').classList.remove('on', 'hold');
  $('hud').classList.remove('lorehold');
}
function updateLore(inp, dt) {
  if (loreT <= 0) {
    // the story found mid-chase returns after a few quiet seconds
    if (!lorePending || !game || game.over) return;
    lorePending.t -= dt;
    loreQuietT = loreSafe(game) ? loreQuietT + dt : 0;
    if (lorePending.t <= 0) lorePending = null;
    else if (loreQuietT > 2.5) showLore(game, lorePending.S, 'Remembered');
    return;
  }
  if (!loreHold) { loreT -= dt; if (loreT <= 0) hideLore(); return; }
  // held: wait for a fresh push of the stick or keys (a held key from walking in does not count)
  loreGrace -= dt;
  const moving = Math.hypot(inp.x, inp.y) > 0.3;
  if (!moving) loreRest = true;
  if (loreGrace <= 0 && ((moving && loreRest) || inp.pounce || inp.confirm || inp.edges.has('Escape'))) hideLore();
}
$('lore').addEventListener('click', () => { if (loreHold && loreGrace <= 0) hideLore(); });
$('btn-settings').onclick = () => { click(); returnTo = 'title'; show('settings'); };
$('btn-resume').onclick = () => { click(); resume(); };
$('btn-pause-how').onclick = () => { click(); returnTo = 'pause'; show('how'); };
$('btn-pause-settings').onclick = () => { click(); returnTo = 'pause'; show('settings'); };
$('btn-pause-journal').onclick = () => { click(); returnTo = 'pause'; renderJournal(); show('journal'); };
$('btn-quit').onclick = () => { click(); game.die('quit'); game.cause = 'You lay down in the grass and let them come.'; resume(); };
$('btn-again').onclick = () => { click(); startRun(); };
$('btn-title').onclick = () => { click(); daily = false; toTitle(); };
$('btn-share').onclick = () => {
  const s = lastResult;
  if (!s) return;
  const text = `Primal Chase${daily ? ' (daily ' + todayKey() + ')' : ''}: I survived to Day ${s.day} (${s.phase}), ran ${fmtDist(s.dist, true)} and scored ${s.score.toLocaleString()}. They always catch you. How long can you last? https://primalchase.com`;
  navigator.clipboard?.writeText(text).then(() => { $('btn-share').textContent = 'Copied'; setTimeout(() => ($('btn-share').textContent = 'Copy result'), 1500); });
};
document.querySelectorAll('[data-back]').forEach((b) => (b.onclick = () => { audio.play('back'); show(returnTo); }));
$('pause-btn').onclick = () => pause();
document.querySelectorAll('.btn').forEach((b) => b.addEventListener('pointerenter', () => audio.play('ui', { pitch: 76 })));

// settings controls
$('set-music').value = settings.music;
$('set-sfx').value = settings.sfx;
$('set-shake').checked = settings.reduceShake;
$('set-hints').checked = settings.hints;
$('set-music').oninput = (e) => { settings.music = +e.target.value; applySettings(); };
$('set-sfx').oninput = (e) => { settings.sfx = +e.target.value; applySettings(); audio.play('ui'); };
$('set-shake').onchange = (e) => { settings.reduceShake = e.target.checked; applySettings(); };
$('set-hints').onchange = (e) => { settings.hints = e.target.checked; applySettings(); };
function showUnits() {
  $('set-metric').classList.toggle('on', settings.units === 'metric');
  $('set-imperial').classList.toggle('on', settings.units === 'imperial');
}
for (const u of ['metric', 'imperial']) $('set-' + u).onclick = () => { click(); settings.units = u; applySettings(); showUnits(); };
showUnits();
function showCine() {
  $('set-cine-on').classList.toggle('on', settings.cinematic);
  $('set-cine-off').classList.toggle('on', !settings.cinematic);
}
for (const [id, v] of [['set-cine-on', true], ['set-cine-off', false]]) $(id).onclick = () => { click(); settings.cinematic = v; applySettings(); showCine(); };
showCine();

// first gesture unlocks audio
const unlock = () => { if (state !== 'paused') audio.init(); };
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);
window.addEventListener('resize', () => renderer.resize());
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') pause();
  // silence everything already scheduled while away; the sequencer skips ahead on return
  if (audio.ctx && document.hidden) audio.ctx.suspend(); // the frame loop resumes it (unless paused)
});
// Paused or away, everything stops: music and sound, not just a muffle.
function syncAudio() {
  const c = audio.ctx;
  if (!c) return;
  const want = state !== 'paused' && !document.hidden;
  if (!want && c.state === 'running') c.suspend();
  else if (want && c.state === 'suspended') c.resume();
}
// The cursor hides while you play and comes back when the mouse moves.
let mouseT = 0;
window.addEventListener('mousemove', () => { mouseT = performance.now(); });

function pause() {
  if (state !== 'playing') return;
  state = 'paused';
  audio.setMuffle(true);
  $('pause-quote').textContent = BITS[Math.floor(Math.random() * BITS.length)];
  $('pause-perks').innerHTML = perkChips(game);
  returnTo = 'pause';
  show('pause');
}
function resume() {
  state = 'playing';
  audio.setMuffle(false);
  show(null);
}

// ---------------- feats ----------------
// Prey kinds count across every run (the golden gazelle has its own feat; wildebeest come only in stampedes).
const PREY_KINDS = [...Object.keys(SPECIES).filter((k) => k !== 'golden'), 'gnu'];
let kindsEaten = new Set(store.get('kinds', []));
const secretsFound = () => SECRET_IDS.filter((id) => journal[id]).length;
const km = (k) => settings.units === 'imperial' ? `${(k / 1.60934).toFixed(1)} mi` : `${k} km`;
// [id, icon, name, description (string or function), test]
const FEATS = [
  ['day2', '☀', 'First dawn', 'Live to see Day 2', (g) => g.day >= 2],
  ['day4', '☀', 'Long legs', 'Live to see Day 4', (g) => g.day >= 4],
  ['day7', '★', 'Legend of the plain', 'Live to see Day 7', (g) => g.day >= 7],
  ['day10', '☀', 'Undying', 'Live to see Day 10', (g) => g.day >= 10],
  ['untouched', '◇', 'Not a scratch', 'See Day 3 without taking a hit', (g) => g.day >= 3 && !(g.stats.hurts > 0)],
  ['hunt', '✦', 'Apex', 'Catch a gazelle', (g) => (g.stats.gazelles || 0) > 0],
  ['glutton', '✦', 'Well fed', 'Catch 8 prey in one run', (g) => g.stats.prey >= 8],
  ['feast', '✦', 'Feast', 'Catch 15 prey in one run', (g) => g.stats.prey >= 15],
  ['menu', '❀', 'Taste of everything', () => `Catch every kind of prey, over all your runs (${PREY_KINDS.filter((k) => kindsEaten.has(k)).length}/${PREY_KINDS.length})`, () => PREY_KINDS.every((k) => kindsEaten.has(k))],
  ['golden', '★', 'Gold on the plain', 'Catch a golden gazelle', (g) => (g.stats.golden || 0) > 0],
  ['takedown', '✕', 'Turn the hunt', 'Knock a hunter flat', (g) => g.stats.knockdowns > 0],
  ['hunterbane', '✖', 'Hunter of hunters', 'Knock 5 hunters flat in one run', (g) => g.stats.knockdowns >= 5],
  ['packbreaker', '⚔', 'Pack breaker', 'Drive off 5 dogs in one run', (g) => g.stats.dogs >= 5],
  ['scatter', '❧', 'Mine, not yours', 'Scatter hyenas from your kill', (g) => (g.stats.scatters || 0) > 0],
  ['whisker', '≈', 'By a whisker', 'Dodge 5 spears in one run', (g) => g.stats.dodges >= 5],
  ['ghost', '~', 'Ghost', 'Break your trail 10 times in one run', (g) => g.stats.breaks >= 10],
  ['escape', '»', 'Slipped away', 'Escape after being seen', (g) => (g.stats.escapes || 0) > 0],
  ['wild', '×', 'Wild', 'Reach a x3 multiplier', (g) => g.mult >= 3],
  ['wilder', '✕', 'Untamed', 'Reach the x4 multiplier', (g) => g.mult >= 4],
  ['trample', '▲', 'Let the herd do it', 'Get a hunter trampled', (g) => (g.stats.trampled || 0) > 0],
  ['pride', '♛', 'Let the lions do it', 'Lead the band into a pride', (g) => (g.stats.lionTakedowns || 0) > 0],
  ['marathon', '∞', 'Marathon', () => `Run ${km(5)} in one run`, (g) => g.stats.dist >= 5000],
  ['ultra', '∞', 'Ultramarathon', () => `Run ${km(10)} in one run`, (g) => g.stats.dist >= 10000],
  ['climber', '▲', 'Ledge leaper', 'Pounce up 5 ledges in one run', (g) => (g.stats.climbs || 0) >= 5],
  ['explorer', '◉', 'Wide wanderer', 'Visit 5 different lands in one run', (g) => (g.biomesSeen ? g.biomesSeen.size : 0) >= 5],
  ['secret', '?', 'Curious cat', 'Find a secret place', (g) => (g.stats.secrets || 0) > 0],
  ['secrets3', '✶', 'Keeper of old places', 'Find 3 secrets in one run', (g) => (g.stats.secrets || 0) >= 3],
  ['allsecrets', '✷', 'Keeper of every secret', () => `Find every secret place, over all your runs (${secretsFound()}/${SECRET_IDS.length})`, () => secretsFound() >= SECRET_IDS.length],
  ['instincts', '✦', 'Old instincts', 'Hold 5 instincts at once', (g) => Object.values(g.perks).reduce((a, b) => a + b, 0) >= 5],
];
const featText = (d) => (typeof d === 'function' ? d() : d);
let feats = new Set(store.get('feats', []));
let runFeats = new Set();
let featQ = []; // feat notices wait for a clear moment in play, so no screen or hint can hide them
let featT = 0;
function checkFeats(g, dt) {
  featT -= dt;
  if (featT > 0) return;
  featT = 0.5;
  if (g.stats.kinds) {
    const n = kindsEaten.size;
    for (const k of Object.keys(g.stats.kinds)) kindsEaten.add(k);
    if (kindsEaten.size !== n) store.set('kinds', [...kindsEaten]);
  }
  for (const [id, , name, , test] of FEATS) {
    if (feats.has(id) || !test(g)) continue;
    feats.add(id);
    runFeats.add(name);
    store.set('feats', [...feats]);
    featQ.push(`<b>Feat:</b> ${iconImg(FEAT_ICON[id] || 'star')} ${name}`);
  }
}
function renderFeats() {
  $('feats-count').textContent = `${feats.size} of ${FEATS.length} earned`;
  $('feats-list').innerHTML = FEATS.map(([id, , name, desc]) => `<div class="feat ${feats.has(id) ? 'got' : ''}"><i>${iconImg(feats.has(id) ? FEAT_ICON[id] || 'star' : 'secret')}</i><div><b>${name}</b><span>${featText(desc)}</span></div></div>`).join('');
}

// ---------------- perks ----------------
let perkOffer = [];
function perkChips(g) {
  return Object.entries(g.perks).map(([id, n]) => `<span class="chip">${iconImg(PERK_ICON[id] || 'spark')}${PERK_BY_ID[id].name}${n > 1 ? ` <b>x${n}</b>` : ''}</span>`).join('');
}
function openPerks(title = 'Choose an instinct', kicker = `Dawn of day ${game.day}`) {
  state = 'perk';
  audio.setMuffle(true);
  perkOffer = game.offerPerks(3);
  if (!perkOffer.length) { game.perkChoices = 0; resume(); return; }
  $('perk-title').textContent = title;
  $('perk-kicker').textContent = kicker;
  $('perk-cards').innerHTML = perkOffer.map((k, i) => {
    const have = game.perks[k.id] || 0;
    return `<button class="perk-card" data-i="${i}"><span class="pk">${i + 1}</span><img class="pa" src="${perkArt(k.id)}" alt=""><span class="pn">${iconImg(PERK_ICON[k.id] || 'spark', 'pi')}${k.name}</span><span class="pt">${k.text}</span><span class="pl">${k.max > 1 ? `Rank ${have + 1} of ${k.max}` : 'Unique'}</span></button>`;
  }).join('');
  $('perk-cards').querySelectorAll('.perk-card').forEach((b) => (b.onclick = () => choosePerk(+b.dataset.i)));
  show('perk');
  audio.play('perkopen');
}
function choosePerk(i) {
  const k = perkOffer[i];
  if (!k || state !== 'perk') return;
  game.takePerk(k.id);
  audio.cue('perk');
  toast(`<b>${iconImg(PERK_ICON[k.id] || 'spark')}${k.name}</b> ${k.text}`, 3);
  if (game.perkChoices > 0) openPerks('Another instinct', 'The land gives more');
  else { state = 'playing'; audio.setMuffle(false); show(null); }
}

// ---------------- hints ----------------
const HINTS = {
  move: () => input.usingTouch ? 'Drag on the left to move. Push to the rim to <b>sprint</b>.' : '<kbd>WASD</kbd> to move. Hold <kbd>Shift</kbd> to sprint.',
  tracks: 'They follow your <b>tracks</b>. Rock and water leave none.',
  heat: 'You are overheating. Stop in <b>shade</b>, lie down, or wade into water.',
  overheat: 'Overheated! You can barely walk until you cool down.',
  water: 'Thirsty. Follow the <b style="color:#7fd6e0">blue arrow</b>, then stand still at the water to drink.',
  food: () => `Hungry. Creep up on prey ${input.usingTouch ? '(tap <b>STALK</b>)' : input.lastDevice === 'pad' ? '(hold LT)' : '(hold <kbd>Q</kbd>)'}, then ${input.usingTouch ? '<b>POUNCE</b>' : '<kbd>Space</kbd> to pounce'}. Stand over the kill to eat.`,
  sighted: 'They see you! Sprint, or lose them in <b>tall grass</b>.',
  spear: () => `Spear! Step off the <b style="color:#ff4a2e">red line</b>, or ${input.usingTouch ? 'POUNCE' : '<kbd>Space</kbd>'} through it.`,
  trail: 'Trail broken. They have to search for your tracks.',
  night: 'Night. Cooler and darker. Their torches show where they are.',
  rain: 'Rain! Your tracks are washing away.',
  dogs: 'Dogs run faster than you and follow scent over rock. Pounce to drive them off.',
  croc: 'Something moves in the water. The longer you stay, the more of them come. Get out!',
  hyenas: 'Hyenas are coming for your kill. Eat fast, or pounce to scatter them.',
  stampede: 'Stampede! Get clear, or pounce one for a big meal. The herd tramples your trail, and anyone in its way.',
  mult: 'Danger survived raises your <b>multiplier</b> (top right). Getting hurt halves it.',
  cliff: 'A ledge. You can <b>leap down</b>; the band has to find a way around. Walk up where the slope is gentle, or <b>pounce</b> up a single ledge.',
  secretnear: 'A golden <b style="color:#e8c040">?</b> at the edge of the screen means a secret place is near. Go and look.',
  map: () => `${input.usingTouch ? 'Tap <b>MAP</b>' : '<kbd>Tab</kbd>'} opens a map of everywhere you have been.`,
  golden: 'A <b style="color:#fff09a">golden gazelle</b> is near. Catch it for a fortune.',
  pride: 'Lions ahead, resting on a kill. Stay clear, or lead the band into them.',
  fire: '<b style="color:#ff9a4a">Grass fire!</b> It spreads with the wind. Hunters cannot pass it, and it burns your trail away. Rock, water and bare ground stop it.',
  scout: () => `A runner is cutting you off! Dodge his spears, or ${input.usingTouch ? 'POUNCE' : '<kbd>Space</kbd>'} to knock him flat.`,
  pounce: () => `A pounce is a dodge. ${input.usingTouch ? 'POUNCE' : '<kbd>Space</kbd>'} a hunter to knock him flat.`,
};
let seenHints = new Set(store.get('hints', []));
const hintQ = [];
let toastT = 0;
function hint(key, force = false) {
  if (!settings.hints && !force) return;
  if (seenHints.has(key) || hintQ.includes(key)) return;
  if (force) {
    // urgent: show now, not after whatever is queued
    seenHints.add(key);
    store.set('hints', [...seenHints]);
    const h = HINTS[key];
    toast(typeof h === 'function' ? h() : h);
    return;
  }
  hintQ.push(key);
}
let toastLock = 0, laterQ = [];
function toast(html, dur = 4.2, hold = false) {
  // a feat notice (or any held toast) keeps the slot; anything else waits its turn
  if (toastLock > 0) { laterQ.push([html, dur, hold]); return; }
  $('toast').innerHTML = html;
  $('toast').classList.add('on');
  toastT = dur;
  if (hold) toastLock = dur;
}
function updateToasts(dt) {
  if (loreT > 0) return; // everything waits behind a lore card
  if (toastT > 0) {
    toastT -= dt;
    if (toastT <= 0) $('toast').classList.remove('on');
    return;
  }
  toastLock = 0;
  if (featQ.length && state === 'playing') {
    toast(featQ.shift(), 3);
    toastLock = 3;
    audio.cue('feat');
    return;
  }
  if (laterQ.length) { toast(...laterQ.shift()); return; }
  if (hintQ.length && cardT <= 0.3) {
    const k = hintQ.shift();
    seenHints.add(k);
    store.set('hints', [...seenHints]);
    const h = HINTS[k];
    toast(typeof h === 'function' ? h() : h);
  }
}
let cardT = 0;
function card(title, sub, dur = 3.2) {
  $('card-title').textContent = title;
  $('card-sub').textContent = sub;
  $('card').classList.add('on');
  cardT = dur;
}

// ---------------- run lifecycle ----------------
let deathShown = false;
let lastResult = null;
let hitstop = 0;
let slow = 1;
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
let daily = false;
function startRun(isDaily = daily) {
  audio.init();
  reel.stop();
  if (game) game.world.destroy();
  audio.menu = false;
  daily = !!isDaily;
  const seed = daily ? [...todayKey()].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7) >>> 0 : (Math.random() * 1e9) | 0;
  game = new Game(seed, art, audio);
  game.grantPerkChoice({ title: 'Choose your first instinct', kicker: 'Before the chase' }); // every run opens with one pick
  runFeats = new Set();
  featQ = []; laterQ = []; toastLock = 0;
  minimap.reset();
  renderer.camInit = false;
  renderer.parts = [];
  renderer.pops = [];
  state = 'playing';
  deathShown = false;
  hitstop = 0;
  slow = 1;
  document.body.classList.add('playing');
  $('hud').classList.remove('hidden');
  $('hud').className = '';
  $('best-inline').textContent = store.get('best', 0) ? 'best ' + store.get('best', 0).toLocaleString() : '';
  show(null);
  card(daily ? 'Daily hunt' : 'Day 1', daily ? `The same land for everyone today, ${todayKey()}.` : 'The hunters have your scent.');
  audio.cue('start');
  audio.sting('start');
  if (!store.get('played', false)) {
    seenHints = new Set();
    store.set('played', true);
  }
  hint('move');
  setTimeout(() => hint('tracks'), 9000);
}

function finishRun() {
  hideLore(true);
  $('toast').classList.remove('on');
  $('card').classList.remove('on');
  toastT = 0;
  cardT = 0;
  const s = game.stats;
  const best = store.get('best', 0);
  const isBest = game.score > best;
  if (isBest) store.set('best', game.score);
  let dailyLine = '';
  if (daily) {
    const dk = 'daily_' + todayKey();
    const db = store.get(dk, 0);
    if (game.score > db) store.set(dk, game.score);
    dailyLine = ` · daily best ${Math.max(db, game.score).toLocaleString()}`;
  }
  $('new-feats').textContent = runFeats.size ? 'Feats earned: ' + [...runFeats].join(', ') : '';
  $('death-perks').innerHTML = perkChips(game);
  const runs = store.get('runs', []);
  const entry = { score: game.score, day: game.day, date: Date.now() };
  runs.push(entry);
  runs.sort((a, b) => b.score - a.score);
  store.set('runs', runs.slice(0, 8));
  lastResult = { score: game.score, day: game.day, phase: game.phaseName.toLowerCase(), dist: s.dist };

  $('death-cause').textContent = game.cause;
  $('rank').textContent = rankOf(game.score) + (daily ? ' (daily hunt)' : '');
  $('new-best').classList.toggle('hidden', !isBest);
  const stats = [
    ['Day', `${game.day}`, game.phaseName.toLowerCase()],
    ['Distance', fmtDist(s.dist, true)],
    ['Prey caught', s.prey],
    ['Trails broken', s.breaks],
    ['Spears dodged', s.dodges],
    ['Escapes', s.escapes || 0],
    ['Secrets', s.secrets || 0],
    ['Takedowns', s.knockdowns + s.dogs],
    ['Time alive', fmtTime(game.time)],
    ['Top multiplier', MX + (s.bestMult || 1).toFixed(1)],
  ];
  $('death-stats').innerHTML = stats.map(([k, v, sub]) => `<div class="stat"><b>${v}</b><span>${k}${sub ? ' · ' + sub : ''}</span></div>`).join('');
  const top = store.get('runs', []).slice(0, 5);
  $('history').innerHTML = `Your longest chases${dailyLine}<ol>${top.map((r, i) => `<li class="${r.date === entry.date ? 'me' : ''}">${i + 1}. ${r.score.toLocaleString()} <small>day ${r.day}</small></li>`).join('')}</ol>`;
  show('death');
  sizeVignette(deathStrip, 200, 40); kickDeath();
  // count the score up
  const el = $('final-score');
  const target = game.score;
  const t0 = performance.now();
  const tick = () => {
    const k = Math.min(1, (performance.now() - t0) / 1400);
    el.textContent = Math.floor(target * (1 - Math.pow(1 - k, 3))).toLocaleString();
    if (k < 1) requestAnimationFrame(tick);
    else audio.play('score', { pitch: 5 });
  };
  tick();
}

function rankOf(sc) {
  const R = [[800, 'A cub, far from its mother.'], [2000, 'A yearling who learned too late.'], [3800, 'A stalker of the tall grass.'],
    [6500, 'A shadow the hunters spoke of.'], [10000, 'An old ghost of the savannah.'], [16000, 'A legend told around their fires.'],
    [Infinity, 'The one they never forgot.']];
  return R.find(([v]) => sc < v)[1];
}
function fmtTime(s) {
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}

// ---------------- events → sound, pixels, hints ----------------
function handleEvents(g) {
  const p = g.player;
  const near = (e, r = 520) => clamp(1 - dist(e.x, e.y, p.x, p.y) / r, 0.05, 1);
  // sound placed where it happened: quieter and duller with distance, panned left or right
  const at = (e, r = 520) => ({ vol: near(e, r), pan: clamp((e.x - p.x) / 320, -0.9, 0.9) });
  const kindAt = (list, e) => { let k = null, bd = 40; for (const q of list) { const d = dist(q.x, q.y, e.x, e.y); if (d < bd) { bd = d; k = q.kind; } } return k; };
  for (const e of g.events) {
    switch (e.type) {
      case 'pop': renderer.pop(e.text, e.x, e.y, e.color); audio.play('score', { pitch: e.text.includes('DAY') ? 7 : 0 }); break;
      case 'step':
        audio.play('step', { water: e.water, g: e.g, vol: e.sprint ? 0.9 : 0.5, sprint: e.sprint, stalk: p.stalking });
        if (e.water) renderer.burst('splash', e.x, e.y, e.sprint ? 4 : 2);
        else if (e.sprint) renderer.burst('dust', e.x - p.face * 6, e.y, 2, { col: e.g === G.ROCK ? P.rock3 : e.g === G.LUSH ? P.lush2 : P.sand3, vx: -p.vx * 0.2 });
        break;
      case 'pounce': audio.play('pounce', { g: p.ground }); renderer.burst('dust', e.x, e.y, 6); renderer.shake(1.5); hint('pounce'); break;
      case 'startle': audio.play('startle', { ...at(e, 500), fly: e.fly, kind: kindAt(g.prey, e) }); break;
      case 'climb': audio.play('climb'); renderer.burst('dust', e.x, e.y, 8); renderer.shake(1); break;
      case 'kill': audio.play('kill', { kind: kindAt(g.carcasses, e) }); audio.cue('kill'); renderer.burst('blood', e.x, e.y, 14); renderer.shake(3); hitstop = 0.07; break;
      case 'eat': audio.play('eat', { vol: 0.8 }); renderer.burst('blood', e.x + p.face * 10, e.y, 2); break;
      case 'drink': audio.play('drink', { vol: 0.8 }); renderer.burst('splash', e.x + p.face * 10, e.y + 2, 2); break;
      case 'hurt':
        audio.play('hit', { kind: e.kind }); audio.cue('hurt');
        renderer.burst('blood', e.x, e.y, 16);
        renderer.shake(6);
        hitstop = 0.09;
        break;
      case 'bite': audio.play('bite'); break;
      case 'throw': audio.play('throw', at(e)); break;
      case 'windup': audio.play('windup', at(e)); hint('spear'); break;
      case 'thunk': audio.play('thunk', { ...at(e), g: g.world.typeAt(e.x, e.y) }); renderer.burst('dust', e.x, e.y, 5); break;
      case 'dodge': audio.play('dodge'); audio.cue('dodge'); if (e.close && !window.__pc.steady) { slow = 0.35; } renderer.burst('spark', e.x, e.y - 6, 6, { col: '#ffffff' }); break;
      case 'sighted':
        audio.play('sighted', { vol: 1 });
        renderer.shake(2);
        hint('sighted');
        break;
      case 'lost': toast('They lost sight of you. Back to your tracks…', 2.4); audio.play('shout', { ...at(e, 900), call: 'lost' }); break;
      case 'trailcold': audio.play('trail'); hint('trail'); break;
      case 'found': audio.play('shout', { ...at(e, 900), call: 'found' }); break;
      case 'knockdown': audio.play('knockdown', at(e, 700)); renderer.burst('dust', e.x, e.y, 10); renderer.shake(5); hitstop = 0.1; break;
      case 'dogdown': audio.play('yelp', at(e, 700)); renderer.burst('dust', e.x, e.y, 8); renderer.shake(3); hitstop = 0.06; break;
      case 'bark': { const a = at(e, 700); a.vol *= e.quiet ? 0.5 : 1; audio.play('bark', a); } hint('dogs'); break;
      case 'overheat': audio.play('overheat'); renderer.burst('sweat', e.x, e.y, 10); hint('overheat', true); break;
      case 'dawn':
        card(`Day ${e.day}`, BITS[(e.day * 3) % BITS.length], 3.8);
        audio.play('chorus');
        {
          const news = [];
          if (e.day === 2) news.push('The band learns you a little more each dawn. A dog has joined them.');
          if (e.day === TRACKERS_DAY) news.push('<b>They have learned how you hide.</b> Broken trails buy less time now.');
          if (e.day === TORCH_DAY) news.push('<b>Torches.</b> They no longer slow down at night, and they see farther in the dark.');
          if (e.day === PACE_DAY) news.push('<b>They have learned your pace.</b> They now walk faster than you trot.');
          if (e.day === FIRE_DAY) news.push('<b>Fire.</b> They will light the grass beyond you and let the wind drive you back to them.');
          if (HUNTER_DAYS.includes(e.day)) news.push('Another hunter joins the band.');
          if (e.day > 2 && e.day % 2 === 0 && e.day <= 10) news.push('Another dog runs with them.');
          if (news.length) toast(news.join('<br>'), 3 + news.length * 1.8, true);
        }
        break;
      case 'dusk': audio.sting('dusk'); hint('night'); break;
      case 'rain': hint('rain', true); audio.play('thunder', { vol: 0.6 }); break;
      case 'thunder': audio.play('thunder'); break;
      case 'death': audio.cue('death'); audio.play('fall'); renderer.shake(8); break;
      case 'scout': audio.play('shout', { ...at(e, 900), call: 'scout' }); hint('scout'); break;
      case 'croc': audio.play('croc', at(e, 600)); hint('croc', true); break;
      case 'crocsnap': audio.play('snap', at(e, 600)); renderer.burst('splash', e.x, e.y, 12); renderer.shake(3); break;
      case 'hyenas': audio.play('laugh', at(e, 600)); hint('hyenas'); break;
      case 'snarl': audio.play('snarl', { ...at(e, 500), who: g.hyenas.some((h) => dist(h.x, h.y, e.x, e.y) < 30) ? 'hyena' : 'warthog' }); break;
      case 'stampede': audio.play('rumble'); renderer.shake(2); hint('stampede', true); break;
      case 'secret': {
        const S = SECRETS[e.secret];
        journal[e.secret] = (journal[e.secret] || 0) + 1;
        store.set('journal', journal);
        showLore(g, S, journal[e.secret] === 1 ? 'A new secret' : 'Secret place');
        audio.cue('secret');
        renderer.burst('spark', e.x, e.y - 30, 24, { col: '#ffe08a' });
        break;
      }
      case 'secondwind': toast('<b>Second wind!</b> Stamina restored.', 2.5); audio.play('saw', { vol: 0.6 }); renderer.burst('spark', e.x, e.y - 8, 10, { col: '#ffe08a' }); break;
      case 'golden': hint('golden', true); audio.play('golden'); break;
      case 'pride': hint('pride', true); audio.play('roar', at(e, 900)); break;
      case 'roar': audio.play('roar', { ...at(e, 600), charge: true }); renderer.shake(2); break;
      case 'weather': {
        const msg = { dust: '<b>Dust storm.</b> Nobody can see far, and the wind is erasing your tracks.', storm: '<b>Thunderstorm.</b> Rain hides your trail. Watch for the glow where lightning will land.', heat: '<b>Heatwave.</b> The sun is brutal today. Stay near water and shade.', rain: null }[e.kind];
        if (msg) toast(msg, 4.5);
        break;
      }
      case 'strike': audio.play('strike', at(e, 900)); renderer.shake(5); renderer.burst('spark', e.x, e.y, 16, { col: '#fffbe0' }); break;
      case 'wildfire': hint('fire', true); audio.play('ignite', at(e, 900)); break;
      case 'firedrive': toast('<b style="color:#ff9a4a">Fire drive!</b> They lit the grass beyond you. Get round the end of the line, or onto rock, water or bare ground.', 4.5, true); audio.play('shout', { ...at(e, 900), call: 'sight' }); audio.play('ignite', at(e, 900)); renderer.shake(2); break;
      case 'mult': multBumpT = 0.25; audio.play('ui', { pitch: 84 + Math.min(12, Math.round(e.v * 3)) }); hint('mult'); break;
      case 'multloss': audio.play('multloss'); break;
      case 'drop': audio.play('drop', { vol: 0.8 }); break;
      case 'linewarn': toast('They are reading your line. <b>Change direction</b> or they will run ahead to meet you.', 4.5); audio.play('shout', { vol: 0.6, call: 'search' }); break;
      case 'intercept': toast('<b style="color:#ff4a2e">Interceptors ahead!</b> They cut across your line.', 3.5); audio.play('sighted'); renderer.shake(2); break;
      case 'ambush': toast('<b style="color:#ff4a2e">Ambush!</b> They were waiting where your line led.', 3.5); audio.play('sighted'); renderer.shake(3); break;
      case 'scoutsee': audio.play('sighted', at(e, 700)); renderer.shake(1.5); break;
      case 'bandclimb': audio.play('shout', { ...at(e, 700), call: 'grunt' }); break;
    }
  }
  g.events.length = 0;
}

// ---------------- HUD ----------------
const SENSE_R = 450; // close enough to hear them coming
let hudT = 0;
let multBumpT = 0;
function updateHUD(g, dt) {
  hudT -= dt;
  multBumpT -= dt;
  if (hudT > 0) return;
  hudT = 0.05;
  const p = g.player;
  $('day-label').textContent = `Day ${g.day}`;
  const wk = g.weather.fog > 0.4 ? 'Fog' : g.weather.dust > 0.4 ? 'Dust storm' : g.weather.kind === 'storm' ? 'Storm' : g.weather.rain > 0.4 ? 'Rain' : g.weather.heat > 0.4 ? 'Heatwave' : '';
  $('phase-label').textContent = g.phaseName + (wk ? ' \u00b7 ' + wk : '');
  const ci = wk === 'Fog' ? 'fog' : wk === 'Dust storm' ? 'dust' : wk === 'Storm' ? 'storm' : wk === 'Rain' ? 'rain' : wk === 'Heatwave' ? 'heatwave' :
    g.isNight ? 'moon' : g.phaseName === 'Dawn' ? 'dawn' : g.phaseName === 'Dusk' ? 'dusk' : 'sun';
  if ($('clock-icon').className !== ci) $('clock-icon').className = ci;
  $('score').textContent = g.score.toLocaleString();
  const mEl = $('mult');
  const mTxt = g.mult.toFixed(1);
  if (mEl.dataset.v !== mTxt) { mEl.dataset.v = mTxt; mEl.innerHTML = MX + mTxt; }
  mEl.className = (g.mult >= 2.5 ? 'hotter' : g.mult >= 1.5 ? 'hot' : '') + (multBumpT > 0 ? ' bump' : '');
  const th = g.threat();
  const d = th.d;
  // You only know where they are when you can see or hear them, or learned it at their camp.
  const mode = g.band.mode;
  const known = mode === 'chase' || d < SENSE_R || g.intelDay === g.day;
  $('band-dist').textContent = known ? fmtDist(d / 10) : '?';
  const fill = known ? clamp(1 - (d - 40) / 900, 0.03, 1) : 0;
  $('tracker-fill').style.width = (fill * 100).toFixed(1) + '%';
  $('band-state').textContent = mode === 'chase' ? 'They see you!' : g.lineP > 14 ? 'Reading your line' :
    !known ? 'Somewhere behind you' : mode === 'search' ? 'Searching for your trail' : d < 300 ? 'Close on your trail' : 'Following your tracks';
  $('hud').className = mode === 'chase' ? 'chase' : mode === 'search' ? 'search' : '';
  const set = (id, v, low, good) => {
    const el = $(id);
    el.querySelector('i').style.width = clamp(v, 0, 100).toFixed(1) + '%';
    el.classList.toggle('low', !!low);
    el.classList.toggle('good', !!good);
  };
  set('v-health', p.health, p.health < 30, false);
  set('v-heat', p.heat, p.heat > 80, false);
  set('v-water', p.water, p.water < 25, p.drinking);
  set('v-food', p.food, p.food < 25, !!p.eating);

  // status line: what the ground and your body are doing right now
  let s = '';
  const gname = GROUND_INFO[p.ground].name;
  if (g.over) s = '';
  else if (p.overheated) s = '<span class="bad">Overheated</span>';
  else if (p.drinking) s = '<span class="cool">Drinking</span>';
  else if (p.eating) s = 'Eating';
  else if (p.exhausted) s = '<span class="hot">Winded</span>';
  else if (p.ground === G.SHALLOW || p.ground === G.DEEP) s = `<span class="cool">${gname} · no tracks · cooling</span>`;
  else if (p.ground === G.DUNE || p.ground === G.SALT) s = `<span class="hot">${gname} · scorching</span>`;
  else if (p.ground === G.LEAF) s = '<span class="cool">Woodland shade · faint tracks</span>';
  else if (p.ground === G.BASALT) s = '<span class="cool">Basalt · no tracks</span>';
  else if (p.lying && p.inShade) s = '<span class="cool">Resting in shade</span>';
  else if (p.lying) s = 'Resting';
  else if (p.inShade && p.still > 0.2) s = '<span class="cool">Shade · cooling</span>';
  else if (p.ground === G.ROCK) s = '<span class="cool">Rock · no tracks</span>';
  else if (p.ground === G.TALL) s = 'Tall grass · hidden';
  else if (p.ground === G.MUD) s = '<span class="hot">Mud · deep tracks</span>';
  else if (p.sprinting && g.sun > 0.5) s = '<span class="hot">Sprinting in the sun</span>';
  $('status-line').innerHTML = s;
}

// ---------------- context hints ----------------
function contextHints(g) {
  const p = g.player;
  g._hintT = (g._hintT || 0) - 1 / 60;
  if (g._hintT <= 0) {
    g._hintT = 0.5;
    const W = g.world;
    for (let k = 0; k < 8; k++) if (W.typeAt(p.x + Math.cos(k * 0.8) * 50, p.y + Math.sin(k * 0.8) * 50) === G.CLIFF) { hint('cliff'); break; }
    for (const lm of W.landmarksNear(p.x, p.y, 520)) if (!g.found.has(lm.key)) { hint('secretnear'); break; }
    if (g.time > 150 || (g.stats.secrets || 0) > 0) hint('map');
  }
  if (p.heat > 70 && !p.overheated) hint('heat');
  if (p.water < 45) hint('water');
  if (p.food < 50) hint('food');
}

// ---------------- music intensity ----------------
function updateMusic(g, dt) {
  const th = g.threat();
  let I = 0;
  const sc = g.runners.some((r) => !r.leaving && dist(r.x, r.y, g.player.x, g.player.y) < 300);
  if (g.band.mode === 'chase' || th.dogD < 180 || sc) I = 3;
  else if (th.d < 260) I = 2;
  else if (th.d < 520) I = 1;
  if (g.over) I = 0;
  audio.intensity = I;
  audio.night = g.isNight ? 1 : 0;
  audio.rain = g.weather.rain;
  audio.dust = g.weather.dust;
  audio.heat = g.weather.heat; audio.fog = g.weather.fog; audio.storm = g.weather.kind === 'storm' ? g.weather.rain : 0;
  audio.fire = g.fireAlarm ? 1 : 0;
  g._bioT = (g._bioT || 0) - dt;
  if (g._bioT <= 0) {
    g._bioT = 1;
    audio.biome = g.world.biomeAt(g.player.x, g.player.y);
    const coast = g.world.T.large(g.player.x, g.player.y)[4];
    audio.coast = clamp(1 - coast / 700, 0, 1);
  }
  // heartbeat when wounded
  if (!g.over && g.player.health < 35) {
    g._hb = (g._hb || 0) - dt;
    if (g._hb <= 0) { g._hb = 0.5 + g.player.health / 50; audio.play('heart', { vol: 1 - g.player.health / 40 }); }
  }
  // panting (its rate follows heat), wind in the trees, herds, footfalls, torches: audio reads the scene
  audio.scene(g, dt);
}

// ---------------- menu navigation (keyboard arrows, gamepad) ----------------
function menuNav(inp) {
  const open = screens.find((n) => !$(n).classList.contains('hidden'));
  if (!open) return;
  const btns = [...$(open).querySelectorAll('.btn, .perk-card')].filter((b) => b.offsetParent);
  if (!btns.length) return;
  let i = btns.indexOf(document.activeElement);
  const E = inp.edges;
  const up = E.has('NavUp') || E.has('ArrowUp') || E.has('ArrowLeft') || E.has('KeyW');
  const down = E.has('NavDown') || E.has('ArrowDown') || E.has('ArrowRight') || E.has('KeyS');
  if (up || down) {
    i = i < 0 ? 0 : (i + (down ? 1 : -1) + btns.length) % btns.length;
    btns[i].focus();
    audio.play('ui', { pitch: 76 });
  }
  if (inp.padConfirm && i >= 0) btns[i].click();
  if (open === 'how' || open === 'settings') inp.pause = false;
  if (E.has('NavBack') || (E.has('Escape') && (open === 'how' || open === 'settings'))) { const back = $(open).querySelector('[data-back]'); if (back) back.click(); else if (open === 'pause') resume(); }
}

// ---------------- main loop ----------------
let last = performance.now();
let logoT = 0;
const prof = { on: false, t: {}, frames: [], gaps: [] };
const tick = (k, t0) => { if (prof.on) prof.t[k] = (prof.t[k] || 0) + performance.now() - t0; return performance.now(); };
function frame(now) {
  const f0 = performance.now();
  let dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  let inp = input.read();
  if (window.__pc?.override && game && state === 'playing') inp = Object.assign(inp, window.__pc.override(game));
  if (inp.edges.has('KeyM')) { audio.muted = !audio.muted; audio.applyVolumes(); }

  menuNav(inp);
  syncAudio();
  document.body.classList.toggle('nocursor', state === 'playing' && now - mouseT > 1500);
  if (state === 'title') {
    logoT += dt;
    if (Math.floor(logoT * 20) !== Math.floor((logoT - dt) * 20)) drawLogo(logoT); // the silhouettes animate at 10-20 fps; no need to repaint every frame
    if (inp.confirm && document.activeElement?.tagName !== 'BUTTON') startRun();
  } else if (state === 'cine') {
    logoT += dt;
    if (cine) { cine.update(dt, inp, input.pad()); if (cine && cine.logoSoon) drawLogo(logoT, $('cine-logo')); }
  } else if (state === 'playing') {
    if (inp.pause && !loreHold) pause(); // Esc on a held lore card only closes the card
    if (hitstop > 0 && !window.__pc.steady) { hitstop -= dt; dt = 0; }
    slow = Math.min(1, slow + (game.over ? 0.12 : 1.4) * dt);
    if (game.over) slow = Math.min(slow, 0.3);
    if (loreHold) {
      updateLore(inp, dt);
      // held: the world waits. Just closed: the key that closed it doesn't also pounce
      inp = loreHold ? { x: 0, y: 0, sprint: false, stalk: false, pounce: false, edges: inp.edges } : { ...inp, pounce: false, confirm: false, pause: false };
    }
    const sdt = loreHold ? 0 : dt * slow * (window.__pc?.timeScale || 1);
    let t0 = performance.now();
    game.update(sdt, inp);
    t0 = tick('update', t0);
    handleEvents(game);
    contextHints(game);
    checkFeats(game, dt);
    updateMusic(game, dt);
    t0 = tick('events', t0);
    renderer.draw(game, sdt, true);
    t0 = tick('draw', t0);
    updateHUD(game, dt);
    t0 = tick('hud', t0);
    minimap.update(game, dt);
    t0 = tick('minimap', t0);
    if (!loreHold) updateLore(inp, dt);
    if (inp.edges.has('Tab') || inp.edges.has('KeyN')) openMap();
    updateToasts(dt);
    if (cardT > 0) { cardT -= dt; if (cardT <= 0) $('card').classList.remove('on'); }
    if (game.perkChoices > 0 && !game.over && cardT < 2.4 && state === 'playing') openPerks(...(game.lastPerkSource ? [game.lastPerkSource.title, game.lastPerkSource.kicker] : []));
    if (game.over && !deathShown && game.time - game.deathTime > 0.9) {
      deathShown = true;
      state = 'dead';
      setTimeout(() => { finishRun(); }, 900);
    }
  } else if (state === 'dead') {
    game.update(dt * 0.3, { x: 0, y: 0 });
    renderer.draw(game, dt * 0.3, true);
    if (inp.confirm && !$('death').classList.contains('hidden') && document.activeElement?.tagName !== 'BUTTON') startRun();
  } else if (state === 'map') {
    if (inp.edges.has('Tab') || inp.edges.has('KeyN') || inp.pause) closeMap();
  } else if (state === 'perk') {
    for (const [k, i] of [['Digit1', 0], ['Digit2', 1], ['Digit3', 2], ['Numpad1', 0], ['Numpad2', 1], ['Numpad3', 2]]) if (inp.edges.has(k)) choosePerk(i);
    renderer.draw(game, 0, true);
  } else if (state === 'paused') {
    if (inp.pause) resume();
  }
  let ta = performance.now();
  audio.update(dt);
  tick('audio', ta);
  if (prof.on) { prof.frames.push(performance.now() - f0); if (prof.last) prof.gaps.push(now - prof.last); prof.last = now; }
  requestAnimationFrame(frame);
}

if (settings.cinematic) startCinematic(); else toTitle();
requestAnimationFrame(frame);

// debug hook for automated testing
window.__pc = { get game() { return game; }, startRun, renderer, audio, art, prof, ui: uiBuild, get state() { return state; } };

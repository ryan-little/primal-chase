// Boot, screens, the frame loop, and the glue between simulation, sound, pixels and HUD.

import { buildArt, canvas } from './art.js';
import { Audio } from './audio.js';
import { Game, BITS } from './game.js';
import { PERK_BY_ID } from './perks.js';
import { SECRETS, SECRET_IDS } from './secrets.js';
import { Minimap } from './minimap.js';
import { makeBot } from './bot.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { drawText } from './font.js';
import { G, GROUND_INFO } from './world.js';
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
const settings = Object.assign({ music: 0.8, sfx: 0.9, reduceShake: false, hints: true, units: usLocale ? 'imperial' : 'metric' }, store.get('settings', {}));
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
  renderer.imperial = settings.units === 'imperial';
  store.set('settings', settings);
}
applySettings();

// ---------------- icons, favicon, logo ----------------
for (const [id, key] of [['v-health', 'health'], ['v-heat', 'heat'], ['v-water', 'water'], ['v-food', 'food']]) {
  $(id).querySelector('img').src = art.icons[key];
}
{
  const f = canvas(32, 32), x = f.getContext('2d');
  x.imageSmoothingEnabled = false;
  const fr = art.cat.run[1];
  x.drawImage(fr, 20, 4, 38, 26, -2, 4, 38, 26);
  $('favicon').href = f.toDataURL();
}
const silCache = new Map();
let logoText = null;
function drawLogo(t = 0) {
  const c = $('logo'), x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.clearRect(0, 0, c.width, c.height);
  // sun
  const g = x.createRadialGradient(170, 66, 4, 170, 66, 44);
  g.addColorStop(0, '#fff0a0'); g.addColorStop(0.5, '#ff9a3a'); g.addColorStop(1, 'rgba(255,106,26,0)');
  x.fillStyle = g;
  x.beginPath(); x.arc(170, 66, 44, 0, Math.PI * 2); x.fill();
  // lettering: a mask of the words, outlined in ink one font-pixel thick, filled with a sunset
  if (!logoText) {
    const s = 4, txt = 'PRIMAL CHASE';
    const W = c.width, H = 60;
    const mask = canvas(W, H), mx = mask.getContext('2d');
    drawText(mx, txt, W / 2, 10, { color: '#fff', shadow: 'rgba(0,0,0,0)', scale: s, align: 'center' });
    const tint = (col) => {
      const k = canvas(W, H), kx = k.getContext('2d');
      kx.drawImage(mask, 0, 0);
      kx.globalCompositeOperation = 'source-in';
      kx.fillStyle = col;
      kx.fillRect(0, 0, W, H);
      return k;
    };
    const g2 = mask.getContext('2d').createLinearGradient(0, 10, 0, 10 + 7 * s);
    g2.addColorStop(0, '#fff3c4'); g2.addColorStop(0.45, '#ffd166'); g2.addColorStop(1, '#e8763a');
    const ink = tint(P.ink), fill = tint(g2);
    logoText = canvas(W, H);
    const lx = logoText.getContext('2d');
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, 2], [1, 2], [-1, 2]]) lx.drawImage(ink, dx * s, dy * s);
    lx.drawImage(fill, 0, 0);
  }
  x.drawImage(logoText, 0, 2);
  // horizon silhouettes: the cat running, the band behind
  x.fillStyle = P.ink;
  x.fillRect(24, 104, 292, 1);
  const cat = art.cat.run[Math.floor(t * 10) % 8];
  const sil = (img, dx, dy, flip) => {
    let tmp = silCache.get(img);
    if (!tmp) {
      tmp = canvas(img.width, img.height);
      const tx = tmp.getContext('2d');
      tx.drawImage(img, 0, 0);
      tx.globalCompositeOperation = 'source-atop';
      tx.fillStyle = P.ink;
      tx.fillRect(0, 0, img.width, img.height);
      silCache.set(img, tmp);
    }
    x.save();
    if (flip) { x.translate(dx + img.width, dy); x.scale(-1, 1); x.drawImage(tmp, 0, 0); } else x.drawImage(tmp, dx, dy);
    x.restore();
  };
  sil(cat, 184, 78);
  for (let i = 0; i < 3; i++) sil(art.hunter[i % 2].d.run[Math.floor(t * 8 + i * 3) % 8], 62 + i * 20, 67 + (i % 2));
}

// ---------------- screens ----------------
let state = 'title';
let game = null;
let attract = null;
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
  makeAttract();
  show('title');
}
// The title screen plays the real game: a bot runs, the band follows, the world turns.
let attractBot = null;
let attractT = 0;
function makeAttract() {
  if (attract) attract.world.destroy();
  attract = new Game((Math.random() * 1e9) | 0, art, audio, { startClock: 0.2 + Math.random() * 0.4 });
  attract.demo = true;
  attractBot = makeBot(2);
  attractT = 0;
  // start the band closer so the chase is on screen soon
  const p = attract.player, b = attract.band;
  const a = Math.atan2(b.y - p.y, b.x - p.x);
  attract.hunters.forEach((h, i) => { h.x = p.x + Math.cos(a) * 260 + i * 12; h.y = p.y + Math.sin(a) * 260 + i * 8; });
  b.x = p.x + Math.cos(a) * 260; b.y = p.y + Math.sin(a) * 260;
  b.idx = Math.max(0, attract.trail.length - 26);
  renderer.camInit = false;
}
function stepAttract(dt) {
  const g = attract;
  attractT += dt;
  const p = g.player;
  // the demo cat cannot die, and never needs to stop for long
  p.health = Math.max(p.health, 60);
  p.water = Math.max(p.water, 45);
  p.food = Math.max(p.food, 45);
  if (g.perkChoices > 0) { const o = g.offerPerks(1); if (o.length) g.takePerk(o[0].id); else g.perkChoices = 0; }
  g.update(dt, attractBot(g));
  if (g.clock > 0.6) g.clock = 0.12; // the demo stays in daylight
  for (const e of g.events) {
    if (e.type === 'kill' || e.type === 'hurt') renderer.burst('blood', e.x, e.y, 10);
    else if (e.type === 'step' && e.sprint && !e.water) renderer.burst('dust', e.x, e.y, 1);
    else if (e.type === 'step' && e.water) renderer.burst('splash', e.x, e.y, 2);
    else if (e.type === 'thunk' || e.type === 'knockdown') renderer.burst('dust', e.x, e.y, 5);
  }
  g.events.length = 0;
  if (g.over || attractT > 110) makeAttract();
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
      ? `<div class="jentry"><h3>${S.name}</h3><p>${S.lore}</p><small>found ${journal[id]} time${journal[id] > 1 ? 's' : ''}</small></div>`
      : '<div class="jentry locked"><h3>???</h3><p>Somewhere out there.</p></div>';
  }).join('');
}
let loreT = 0;
$('btn-settings').onclick = () => { click(); returnTo = 'title'; show('settings'); };
$('btn-resume').onclick = () => { click(); resume(); };
$('btn-pause-how').onclick = () => { click(); returnTo = 'pause'; show('how'); };
$('btn-pause-settings').onclick = () => { click(); returnTo = 'pause'; show('settings'); };
$('btn-quit').onclick = () => { click(); game.die('quit'); game.cause = 'You lay down in the grass and let them come.'; resume(); };
$('btn-again').onclick = () => { click(); startRun(); };
$('btn-title').onclick = () => { click(); daily = false; toTitle(); };
$('btn-share').onclick = () => {
  const s = lastResult;
  if (!s) return;
  const text = `Primal Chase${daily ? ' (daily ' + todayKey() + ')' : ''}: I survived to Day ${s.day} (${s.phase}), ran ${fmtDist(s.dist, true)} and scored ${s.score.toLocaleString()}. They always catch you. How long can you last? https://primalchase.com`;
  navigator.clipboard?.writeText(text).then(() => { $('btn-share').textContent = 'Copied'; setTimeout(() => ($('btn-share').textContent = 'Copy result'), 1500); });
};
document.querySelectorAll('[data-back]').forEach((b) => (b.onclick = () => { click(); show(returnTo); }));
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

// first gesture unlocks audio
const unlock = () => { audio.init(); };
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);
window.addEventListener('resize', () => renderer.resize());
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') pause(); });

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
const FEATS = [
  ['day2', '☀', 'First dawn', 'Live to see Day 2', (g) => g.day >= 2],
  ['day4', '☀', 'Long legs', 'Live to see Day 4', (g) => g.day >= 4],
  ['day7', '★', 'Legend of the plain', 'Live to see Day 7', (g) => g.day >= 7],
  ['hunt', '✦', 'Apex', 'Catch a gazelle', (g) => (g.stats.gazelles || 0) > 0],
  ['glutton', '✦', 'Well fed', 'Catch 8 prey in one run', (g) => g.stats.prey >= 8],
  ['takedown', '✕', 'Turn the hunt', 'Knock a hunter flat', (g) => g.stats.knockdowns > 0],
  ['whisker', '≈', 'By a whisker', 'Dodge 5 spears in one run', (g) => g.stats.dodges >= 5],
  ['ghost', '~', 'Ghost', 'Break your trail 10 times in one run', (g) => g.stats.breaks >= 10],
  ['escape', '»', 'Slipped away', 'Escape after being seen', (g) => (g.stats.escapes || 0) > 0],
  ['wild', '×', 'Wild', 'Reach a x3 multiplier', (g) => g.mult >= 3],
  ['trample', '▲', 'Let the herd do it', 'Get a hunter trampled', (g) => (g.stats.trampled || 0) > 0],
  ['marathon', '∞', 'Marathon', 'Run 5 km (3.1 mi) in one run', (g) => g.stats.dist >= 5000],
  ['secret', '?', 'Curious cat', 'Find a secret place', (g) => (g.stats.secrets || 0) > 0],
  ['secrets3', '\u2736', 'Keeper of old places', 'Find 3 secrets in one run', (g) => (g.stats.secrets || 0) >= 3],
  ['golden', '\u2605', 'Gold on the plain', 'Catch a golden gazelle', (g) => (g.stats.golden || 0) > 0],
  ['pride', '\u265b', 'Let the lions do it', 'Lead the band into a pride', (g) => (g.stats.lionTakedowns || 0) > 0],
  ['instincts', '\u2726', 'Old instincts', 'Hold 5 instincts at once', (g) => Object.values(g.perks).reduce((a, b) => a + b, 0) >= 5],
  ['explorer', '\u25c9', 'Wide wanderer', 'Visit 5 different lands in one run', (g) => (g.biomesSeen ? g.biomesSeen.size : 0) >= 5],
];
let feats = new Set(store.get('feats', []));
let runFeats = new Set();
let featT = 0;
function checkFeats(g, dt) {
  featT -= dt;
  if (featT > 0) return;
  featT = 0.5;
  for (const [id, icon, name, , test] of FEATS) {
    if (feats.has(id) || !test(g)) continue;
    feats.add(id);
    runFeats.add(name);
    store.set('feats', [...feats]);
    toast(`<b>Feat:</b> ${icon} ${name}`, 3);
    audio.play('trail');
  }
}
function renderFeats() {
  $('feats-count').textContent = `${feats.size} of ${FEATS.length} earned`;
  $('feats-list').innerHTML = FEATS.map(([id, icon, name, desc]) => `<div class="feat ${feats.has(id) ? 'got' : ''}"><i>${feats.has(id) ? icon : '·'}</i><div><b>${name}</b><span>${desc}</span></div></div>`).join('');
}

// ---------------- perks ----------------
let perkOffer = [];
function perkChips(g) {
  return Object.entries(g.perks).map(([id, n]) => `<span class="chip">${PERK_BY_ID[id].icon} ${PERK_BY_ID[id].name}${n > 1 ? ` <b>x${n}</b>` : ''}</span>`).join('');
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
    return `<button class="perk-card" data-i="${i}"><span class="pk">${i + 1}</span><span class="pi">${k.icon}</span><span class="pn">${k.name}</span><span class="pt">${k.text}</span><span class="pl">${k.max > 1 ? `Rank ${have + 1} of ${k.max}` : 'Unique'}</span></button>`;
  }).join('');
  $('perk-cards').querySelectorAll('.perk-card').forEach((b) => (b.onclick = () => choosePerk(+b.dataset.i)));
  show('perk');
  audio.play('trail');
}
function choosePerk(i) {
  const k = perkOffer[i];
  if (!k || state !== 'perk') return;
  game.takePerk(k.id);
  audio.play('perk');
  toast(`<b>${k.icon} ${k.name}</b> ${k.text}`, 3);
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
  food: () => `Hungry. Creep up on prey ${input.usingTouch ? '(ease the stick)' : input.lastDevice === 'pad' ? '(hold LT)' : '(hold <kbd>C</kbd>)'}, then ${input.usingTouch ? '<b>POUNCE</b>' : '<kbd>Space</kbd> to pounce'}. Stand over the kill to eat.`,
  sighted: 'They see you! Sprint, or lose them in <b>tall grass</b>.',
  spear: () => `Spear! Step off the <b style="color:#ff4a2e">red line</b>, or ${input.usingTouch ? 'POUNCE' : '<kbd>Space</kbd>'} through it.`,
  trail: 'Trail broken. They have to search for your tracks.',
  night: 'Night. Cooler and darker. Their torches show where they are.',
  rain: 'Rain! Your tracks are washing away.',
  dogs: 'Dogs run faster than you and follow scent over rock. Pounce to drive them off.',
  croc: 'Something moves in the deep water. Get out!',
  hyenas: 'Hyenas are coming for your kill. Eat fast, or pounce to scatter them.',
  stampede: 'Stampede! Get clear. The herd will trample your trail, and anyone in its way.',
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
function toast(html, dur = 4.2) {
  $('toast').innerHTML = html;
  $('toast').classList.add('on');
  toastT = dur;
}
function updateToasts(dt) {
  if (toastT > 0) {
    toastT -= dt;
    if (toastT <= 0) $('toast').classList.remove('on');
    return;
  }
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
  if (attract) { attract.world.destroy(); attract = null; }
  if (game) game.world.destroy();
  audio.menu = false;
  daily = !!isDaily;
  const seed = daily ? [...todayKey()].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7) >>> 0 : (Math.random() * 1e9) | 0;
  game = new Game(seed, art, audio);
  runFeats = new Set();
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
  audio.sting('start');
  if (!store.get('played', false)) {
    seenHints = new Set();
    store.set('played', true);
  }
  hint('move');
  setTimeout(() => hint('tracks'), 9000);
}

function finishRun() {
  $('lore').classList.remove('on');
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
  for (const e of g.events) {
    switch (e.type) {
      case 'pop': renderer.pop(e.text, e.x, e.y, e.color); audio.play('score', { pitch: e.text.includes('DAY') ? 7 : 0 }); break;
      case 'step':
        audio.play('step', { water: e.water, g: e.g, vol: e.sprint ? 0.9 : 0.5 });
        if (e.water) renderer.burst('splash', e.x, e.y, e.sprint ? 4 : 2);
        else if (e.sprint) renderer.burst('dust', e.x - p.face * 6, e.y, 2, { col: e.g === G.ROCK ? P.rock3 : e.g === G.LUSH ? P.lush2 : P.sand3, vx: -p.vx * 0.2 });
        break;
      case 'pounce': audio.play('pounce'); renderer.burst('dust', e.x, e.y, 6); renderer.shake(1.5); hint('pounce'); break;
      case 'startle': audio.play('startle', { vol: near(e, 500), fly: e.fly }); break;
      case 'climb': audio.play('climb'); renderer.burst('dust', e.x, e.y, 8); renderer.shake(1); break;
      case 'kill': audio.play('kill'); renderer.burst('blood', e.x, e.y, 14); renderer.shake(3); hitstop = 0.07; break;
      case 'eat': audio.play('eat', { vol: 0.8 }); renderer.burst('blood', e.x + p.face * 10, e.y, 2); break;
      case 'drink': audio.play('drink', { vol: 0.8 }); renderer.burst('splash', e.x + p.face * 10, e.y + 2, 2); break;
      case 'hurt':
        audio.play('hit');
        renderer.burst('blood', e.x, e.y, 16);
        renderer.shake(6);
        hitstop = 0.09;
        break;
      case 'bite': audio.play('bark', { vol: 1 }); break;
      case 'throw': audio.play('throw', { vol: near(e) }); break;
      case 'windup': audio.play('windup', { vol: near(e) }); hint('spear'); break;
      case 'thunk': audio.play('thunk', { vol: near(e) }); renderer.burst('dust', e.x, e.y, 5); break;
      case 'dodge': audio.play('dodge'); if (e.close) { slow = 0.35; } renderer.burst('spark', e.x, e.y - 6, 6, { col: '#ffffff' }); break;
      case 'sighted':
        audio.play('sighted', { vol: 1 });
        renderer.shake(2);
        hint('sighted');
        break;
      case 'lost': toast('They lost sight of you. Back to your tracks…', 2.4); audio.play('shout', { vol: 0.4 }); break;
      case 'trailcold': audio.play('trail'); hint('trail'); break;
      case 'found': audio.play('shout', { vol: near(e, 900) * 0.7 }); break;
      case 'knockdown': audio.play('knockdown'); renderer.burst('dust', e.x, e.y, 10); renderer.shake(5); hitstop = 0.1; break;
      case 'dogdown': audio.play('yelp'); renderer.burst('dust', e.x, e.y, 8); renderer.shake(3); hitstop = 0.06; break;
      case 'bark': audio.play('bark', { vol: near(e, 700) * (e.quiet ? 0.5 : 1) }); hint('dogs'); break;
      case 'overheat': audio.play('overheat'); renderer.burst('sweat', e.x, e.y, 10); hint('overheat', true); break;
      case 'dawn':
        card(`Day ${e.day}`, BITS[(e.day * 3) % BITS.length], 3.8);
        audio.sting('dawn');
        if (e.day === 2) toast('The band grows faster each dawn. Dogs have joined them.', 4.5);
        else if ([3, 5, 7, 9].includes(e.day)) toast('Another hunter joins the band.', 3.5);
        break;
      case 'dusk': audio.sting('dusk'); hint('night'); break;
      case 'rain': hint('rain', true); audio.play('thunder', { vol: 0.6 }); break;
      case 'thunder': audio.play('thunder'); break;
      case 'death': audio.sting('death'); renderer.shake(8); break;
      case 'scout': audio.play('shout', { vol: 0.5 }); hint('scout'); break;
      case 'croc': audio.play('splash', { vol: 0.5 }); hint('croc', true); break;
      case 'crocsnap': audio.play('snap'); renderer.burst('splash', e.x, e.y, 12); renderer.shake(3); break;
      case 'hyenas': audio.play('laugh', { vol: near(e, 600) }); hint('hyenas'); break;
      case 'snarl': audio.play('snarl'); break;
      case 'stampede': audio.play('rumble'); renderer.shake(2); hint('stampede', true); break;
      case 'secret': {
        const S = SECRETS[e.secret];
        journal[e.secret] = (journal[e.secret] || 0) + 1;
        store.set('journal', journal);
        $('lore-kicker').textContent = journal[e.secret] === 1 ? 'A new secret' : 'Secret place';
        $('lore-title').textContent = S.name;
        $('lore-text').textContent = S.lore;
        $('lore-gift').textContent = S.gift;
        $('lore').classList.add('on');
        loreT = 8;
        audio.sting('secret');
        renderer.burst('spark', e.x, e.y - 30, 24, { col: '#ffe08a' });
        break;
      }
      case 'secondwind': toast('<b>Second wind!</b> Stamina restored.', 2.5); audio.play('roar', { vol: 0.6 }); renderer.burst('spark', e.x, e.y - 8, 10, { col: '#ffe08a' }); break;
      case 'golden': hint('golden', true); audio.play('golden'); break;
      case 'pride': hint('pride', true); audio.play('roar', { vol: near(e, 700) * 0.6 }); break;
      case 'roar': audio.play('roar', { vol: near(e, 600) }); renderer.shake(2); break;
      case 'weather': {
        const msg = { dust: '<b>Dust storm.</b> Nobody can see far, and the wind is erasing your tracks.', storm: '<b>Thunderstorm.</b> Rain hides your trail. Watch for the glow where lightning will land.', heat: '<b>Heatwave.</b> The sun is brutal today. Stay near water and shade.', rain: null }[e.kind];
        if (msg) toast(msg, 4.5);
        break;
      }
      case 'strike': audio.play('thunder', { vol: 1 }); audio.play('snap', { vol: 0.6 }); renderer.shake(5); renderer.burst('spark', e.x, e.y, 16, { col: '#fffbe0' }); break;
      case 'wildfire': hint('fire', true); break;
      case 'mult': multBumpT = 0.25; audio.play('ui', { pitch: 84 + Math.min(12, Math.round(e.v * 3)) }); hint('mult'); break;
      case 'multloss': audio.play('multloss'); break;
      case 'drop': audio.play('drop', { vol: 0.8 }); break;
      case 'linewarn': toast('They are reading your line. <b>Change direction</b> or they will run ahead to meet you.', 4.5); audio.play('shout', { vol: 0.5 }); break;
      case 'intercept': toast('<b style="color:#ff4a2e">Interceptors ahead!</b> They cut across your line.', 3.5); audio.play('sighted'); renderer.shake(2); break;
      case 'ambush': toast('<b style="color:#ff4a2e">Ambush!</b> They were waiting where your line led.', 3.5); audio.play('sighted'); renderer.shake(3); break;
      case 'scoutsee': audio.play('sighted', { vol: 0.9 }); renderer.shake(1.5); break;
    }
  }
  g.events.length = 0;
}

// ---------------- HUD ----------------
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
  $('clock-icon').className = g.isNight ? 'moon' : '';
  $('score').textContent = g.score.toLocaleString();
  const mEl = $('mult');
  const mTxt = g.mult.toFixed(1);
  if (mEl.dataset.v !== mTxt) { mEl.dataset.v = mTxt; mEl.innerHTML = MX + mTxt; }
  mEl.className = (g.mult >= 2.5 ? 'hotter' : g.mult >= 1.5 ? 'hot' : '') + (multBumpT > 0 ? ' bump' : '');
  const th = g.threat();
  const d = th.d;
  $('band-dist').textContent = fmtDist(d / 10);
  const fill = clamp(1 - (d - 40) / 900, 0.03, 1);
  $('tracker-fill').style.width = (fill * 100).toFixed(1) + '%';
  const mode = g.band.mode;
  $('band-state').textContent = mode === 'chase' ? 'They see you!' : g.lineP > 14 ? 'Reading your line' : mode === 'search' ? 'Searching for your trail' : d < 300 ? 'Close on your trail' : 'Following your tracks';
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
  if (!g.over && g.player.overheated) {
    g._pant = (g._pant || 0) - dt;
    if (g._pant <= 0) { g._pant = 0.32; audio.play('pant', { vol: 0.8 }); }
  }
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
  if (state === 'title') {
    logoT += dt;
    drawLogo(logoT);
    if (inp.confirm && document.activeElement?.tagName !== 'BUTTON') startRun();
    stepAttract(dt);
    renderer.draw(attract, dt, false);
  } else if (state === 'playing') {
    if (inp.pause) pause();
    if (hitstop > 0) { hitstop -= dt; dt = 0; }
    slow = Math.min(1, slow + (game.over ? 0.12 : 1.4) * dt);
    if (game.over) slow = Math.min(slow, 0.3);
    const sdt = dt * slow * (window.__pc?.timeScale || 1);
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
    if (loreT > 0) { loreT -= dt; if (loreT <= 0) $('lore').classList.remove('on'); }
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

toTitle();
requestAnimationFrame(frame);

// debug hook for automated testing
window.__pc = { get game() { return game; }, startRun, renderer, audio, art, prof, get state() { return state; } };

// Boot, screens, the frame loop, and the glue between simulation, sound, pixels and HUD.

import { buildArt, canvas } from './art.js';
import { Audio } from './audio.js';
import { Game, BITS } from './game.js';
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

// ---------------- persistence ----------------
const store = {
  get(k, d) { try { const v = localStorage.getItem('pc2_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('pc2_' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const settings = Object.assign({ music: 0.8, sfx: 0.9, reduceShake: false, hints: true }, store.get('settings', {}));
function applySettings() {
  audio.musicVol = settings.music;
  audio.sfxVol = settings.sfx;
  audio.applyVolumes();
  renderer.reducedMotion = settings.reduceShake;
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
  x.drawImage(fr, 12, 4, 38, 26, -2, 4, 38, 26);
  $('favicon').href = f.toDataURL();
}
const silCache = new Map();
function drawLogo(t = 0) {
  const c = $('logo'), x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.clearRect(0, 0, c.width, c.height);
  // sun
  const g = x.createRadialGradient(130, 58, 4, 130, 58, 40);
  g.addColorStop(0, '#fff0a0'); g.addColorStop(0.5, '#ff9a3a'); g.addColorStop(1, 'rgba(255,106,26,0)');
  x.fillStyle = g;
  x.beginPath(); x.arc(130, 58, 40, 0, Math.PI * 2); x.fill();
  // text with ink outline
  const txt = 'PRIMAL CHASE', s = 3, X = 130, Y = 6;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1], [0, 2], [1, 2], [-1, 2]]) {
    drawText(x, txt, X + dx * 2, Y + dy * 2, { color: P.ink, shadow: P.ink, scale: s, align: 'center' });
  }
  drawText(x, txt, X, Y, { color: P.gold || '#ffe08a', shadow: '#c2562e', scale: s, align: 'center' });
  x.globalCompositeOperation = 'source-atop';
  x.fillStyle = 'rgba(255,154,58,0.55)';
  x.fillRect(0, Y + 13, c.width, 10);
  x.globalCompositeOperation = 'source-over';
  // horizon silhouettes: the cat running, the band behind
  x.fillStyle = P.ink;
  x.fillRect(10, 86, 240, 1);
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
  sil(cat, 160, 60);
  for (let i = 0; i < 3; i++) sil(art.hunter[i % 2].d.run[Math.floor(t * 8 + i * 3) % 8], 40 + i * 18, 49 + (i % 2));
}

// ---------------- screens ----------------
let state = 'title';
let game = null;
let attract = null;
let returnTo = 'title';
const screens = ['title', 'how', 'settings', 'pause', 'death'];
function show(name) {
  for (const s of screens) $(s).classList.toggle('hidden', s !== name);
  const first = name && $(name).querySelector('.btn.primary, .btn');
  if (first && !input.usingTouch) setTimeout(() => first.focus({ preventScroll: true }), 30);
}
function bestLine() {
  const best = store.get('best', 0);
  const runs = store.get('runs', []);
  return best ? `Best: ${best.toLocaleString()} · ${runs.length} run${runs.length === 1 ? '' : 's'}` : '';
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
function makeAttract() {
  attract = new Game((Math.random() * 1e9) | 0, art, audio, { startClock: 0.56 });
  // hide the band far away; the title is the calm before
  for (const h of attract.hunters) { h.x += 5000; h.y += 5000; }
  attract.dogs = [];
  attract.player.state = 'lie';
  for (let i = 0; i < 3; i++) attract.spawnHerd();
  renderer.camInit = false;
}

const click = () => audio.play('ui', { pitch: 81 });
$('btn-start').onclick = () => { click(); startRun(); };
$('btn-how').onclick = () => { click(); returnTo = 'title'; show('how'); };
$('btn-settings').onclick = () => { click(); returnTo = 'title'; show('settings'); };
$('btn-resume').onclick = () => { click(); resume(); };
$('btn-pause-how').onclick = () => { click(); returnTo = 'pause'; show('how'); };
$('btn-pause-settings').onclick = () => { click(); returnTo = 'pause'; show('settings'); };
$('btn-quit').onclick = () => { click(); game.die('quit'); game.cause = 'You lay down in the grass and let them come.'; resume(); };
$('btn-again').onclick = () => { click(); startRun(); };
$('btn-title').onclick = () => { click(); toTitle(); };
$('btn-share').onclick = () => {
  const s = lastResult;
  if (!s) return;
  const text = `Primal Chase: I survived to Day ${s.day} (${s.phase}), ran ${(s.dist / 1000).toFixed(2)} km and scored ${s.score.toLocaleString()}. They always catch you. How long can you last? https://primalchase.com`;
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
  returnTo = 'pause';
  show('pause');
}
function resume() {
  state = 'playing';
  audio.setMuffle(false);
  show(null);
}

// ---------------- hints ----------------
const HINTS = {
  move: () => input.usingTouch ? 'Drag on the left to move. Push to the rim to <b>sprint</b>.' : '<kbd>WASD</kbd> to move. Hold <kbd>Shift</kbd> to sprint.',
  tracks: 'They follow your <b>tracks</b>. Rock and water leave none.',
  heat: 'You are overheating. Stop in <b>shade</b>, lie down, or wade into water.',
  overheat: 'Overheated! You can barely walk until you cool down.',
  water: 'Thirsty. Follow the <b style="color:#7fd6e0">blue arrow</b>, then stand still at the water to drink.',
  food: () => `Hungry. Stalk prey slowly, then ${input.usingTouch ? '<b>POUNCE</b>' : '<kbd>Space</kbd> to pounce'}. Stand over the kill to eat.`,
  sighted: 'They see you! Sprint, or lose them in <b>tall grass</b>.',
  spear: () => `Spear! Step off the <b style="color:#ff4a2e">red line</b>, or ${input.usingTouch ? 'POUNCE' : '<kbd>Space</kbd>'} through it.`,
  trail: 'Trail broken. They have to search for your tracks.',
  night: 'Night. Cooler and darker. Their torches show where they are.',
  rain: 'Rain! Your tracks are washing away.',
  dogs: 'Dogs run faster than you and follow scent over rock. Pounce to drive them off.',
  mult: 'Danger survived raises your <b>multiplier</b> (top right). Getting hurt halves it.',
  scout: () => `A runner is cutting you off! Dodge his spears, or ${input.usingTouch ? 'POUNCE' : '<kbd>Space</kbd>'} to knock him flat.`,
  pounce: () => `A pounce is a dodge. ${input.usingTouch ? 'POUNCE' : '<kbd>Space</kbd>'} a hunter to knock him flat.`,
};
let seenHints = new Set(store.get('hints', []));
const hintQ = [];
let toastT = 0;
function hint(key, force = false) {
  if (!settings.hints && !force) return;
  if (seenHints.has(key) || hintQ.includes(key)) return;
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
function startRun() {
  audio.init();
  audio.menu = false;
  game = new Game((Math.random() * 1e9) | 0, art, audio);
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
  card('Day 1', 'The hunters have your scent.');
  audio.sting('start');
  if (!store.get('played', false)) {
    seenHints = new Set();
    store.set('played', true);
  }
  hint('move');
  setTimeout(() => hint('tracks'), 9000);
}

function finishRun() {
  $('toast').classList.remove('on');
  $('card').classList.remove('on');
  toastT = 0;
  cardT = 0;
  const s = game.stats;
  const best = store.get('best', 0);
  const isBest = game.score > best;
  if (isBest) store.set('best', game.score);
  const runs = store.get('runs', []);
  const entry = { score: game.score, day: game.day, date: Date.now() };
  runs.push(entry);
  runs.sort((a, b) => b.score - a.score);
  store.set('runs', runs.slice(0, 8));
  lastResult = { score: game.score, day: game.day, phase: game.phaseName.toLowerCase(), dist: s.dist };

  $('death-cause').textContent = game.cause;
  $('rank').textContent = rankOf(game.score);
  $('new-best').classList.toggle('hidden', !isBest);
  const stats = [
    ['Day', `${game.day}`, game.phaseName.toLowerCase()],
    ['Distance', `${(s.dist / 1000).toFixed(2)} km`],
    ['Prey caught', s.prey],
    ['Trails broken', s.breaks],
    ['Spears dodged', s.dodges],
    ['Escapes', s.escapes || 0],
    ['Takedowns', s.knockdowns + s.dogs],
    ['Time alive', fmtTime(game.time)],
    ['Top multiplier', 'x' + (s.bestMult || 1).toFixed(1)],
    ['Best', Math.max(best, game.score).toLocaleString()],
  ];
  $('death-stats').innerHTML = stats.map(([k, v, sub]) => `<div class="stat"><b>${v}</b><span>${k}${sub ? ' · ' + sub : ''}</span></div>`).join('');
  const top = store.get('runs', []).slice(0, 5);
  $('history').innerHTML = `Your longest chases<ol>${top.map((r, i) => `<li class="${r.date === entry.date ? 'me' : ''}">${i + 1}. ${r.score.toLocaleString()} <small>day ${r.day}</small></li>`).join('')}</ol>`;
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
        audio.play('step', { water: e.g >= G.SHALLOW, vol: e.sprint ? 0.9 : 0.5 });
        if (e.g >= G.SHALLOW) renderer.burst('splash', e.x, e.y, e.sprint ? 4 : 2);
        else if (e.sprint) renderer.burst('dust', e.x - p.face * 6, e.y, 2, { col: e.g === G.ROCK ? P.rock3 : e.g === G.LUSH ? P.lush2 : P.sand3, vx: -p.vx * 0.2 });
        break;
      case 'pounce': audio.play('pounce'); renderer.burst('dust', e.x, e.y, 6); renderer.shake(1.5); hint('pounce'); break;
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
      case 'mult': multBumpT = 0.25; audio.play('ui', { pitch: 84 + Math.min(12, Math.round(e.v * 3)) }); hint('mult'); break;
      case 'multloss': break;
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
  $('phase-label').textContent = g.phaseName;
  $('clock-icon').className = g.isNight ? 'moon' : '';
  $('score').textContent = g.score.toLocaleString();
  const mEl = $('mult');
  mEl.textContent = 'x' + g.mult.toFixed(1);
  mEl.className = (g.mult >= 2.5 ? 'hotter' : g.mult >= 1.5 ? 'hot' : '') + (multBumpT > 0 ? ' bump' : '');
  const th = g.threat();
  const d = th.d;
  $('band-dist').textContent = `${Math.round(d / 10)} m`;
  const fill = clamp(1 - (d - 40) / 900, 0.03, 1);
  $('tracker-fill').style.width = (fill * 100).toFixed(1) + '%';
  const mode = g.band.mode;
  $('band-state').textContent = mode === 'chase' ? 'They see you!' : mode === 'search' ? 'Searching for your trail' : d < 300 ? 'Close on your trail' : 'Following your tracks';
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
  else if (p.ground >= G.SHALLOW) s = `<span class="cool">${gname} · no tracks · cooling</span>`;
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
  if (p.heat > 70 && !p.overheated) hint('heat');
  if (p.water < 45) hint('water');
  if (p.food < 50) hint('food');
}

// ---------------- music intensity ----------------
function updateMusic(g, dt) {
  const th = g.threat();
  let I = 0;
  const sc = g.scout && !g.scout.leaving && dist(g.scout.x, g.scout.y, g.player.x, g.player.y) < 300;
  if (g.band.mode === 'chase' || th.dogD < 180 || sc) I = 3;
  else if (th.d < 260) I = 2;
  else if (th.d < 520) I = 1;
  if (g.over) I = 0;
  audio.intensity = I;
  audio.night = g.isNight ? 1 : 0;
  audio.rain = g.weather.rain;
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

// ---------------- main loop ----------------
let last = performance.now();
let logoT = 0;
function frame(now) {
  let dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  let inp = input.read();
  if (window.__pc?.override && game && state === 'playing') inp = Object.assign(inp, window.__pc.override(game));
  if (inp.edges.has('KeyM')) { audio.muted = !audio.muted; audio.applyVolumes(); }

  if (state === 'title') {
    logoT += dt;
    drawLogo(logoT);
    if (inp.confirm && document.activeElement?.tagName !== 'BUTTON') startRun();
    attract.time += dt;
    attract.clock = 0.56 + Math.sin(attract.time * 0.02) * 0.02;
    attract.player.state = 'lie';
    attract.player.anim = (attract.player.anim + dt * 0.25) % 1;
    attract.updatePrey(dt * 0.6);
    attract.world.ensure(attract.player.x, attract.player.y, 400, 300, 2);
    renderer.draw(attract, dt, false);
  } else if (state === 'playing') {
    if (inp.pause) pause();
    if (hitstop > 0) { hitstop -= dt; dt = 0; }
    slow = Math.min(1, slow + (game.over ? 0.12 : 1.4) * dt);
    if (game.over) slow = Math.min(slow, 0.3);
    const sdt = dt * slow * (window.__pc?.timeScale || 1);
    game.update(sdt, inp);
    handleEvents(game);
    contextHints(game);
    updateMusic(game, dt);
    renderer.draw(game, sdt, true);
    updateHUD(game, dt);
    updateToasts(dt);
    if (cardT > 0) { cardT -= dt; if (cardT <= 0) $('card').classList.remove('on'); }
    if (game.over && !deathShown && game.time - game.deathTime > 0.9) {
      deathShown = true;
      state = 'dead';
      setTimeout(() => { finishRun(); }, 900);
    }
  } else if (state === 'dead') {
    game.update(dt * 0.3, { x: 0, y: 0 });
    renderer.draw(game, dt * 0.3, true);
    if (inp.confirm && !$('death').classList.contains('hidden') && document.activeElement?.tagName !== 'BUTTON') startRun();
  } else if (state === 'paused') {
    if (inp.pause) resume();
  }
  audio.update(dt);
  requestAnimationFrame(frame);
}

toTitle();
requestAnimationFrame(frame);

// debug hook for automated testing
window.__pc = { get game() { return game; }, startRun, renderer, audio, art, get state() { return state; } };

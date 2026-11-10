// Sound-effect audition kit: the cue catalog (old engine vs new), offline renders, loudness and
// shape numbers, and spectrograms. Used by tools/sfxpack.html.
//
// A cue is { id, cat, label, isNew, after, before, secs }. after/before are timelines,
// [[seconds, (engine) => ...], ...], so a cue can be a run of footsteps or a few laps of water.

const P = (name, opts = {}) => (a) => a.play(name, opts);
const run = (fn, n, gap, j = 0) => Array.from({ length: n }, (_, i) => [i * gap + (i ? Math.random() * j : 0), fn]);
const once = (fn) => [[0, fn]];
const G = { grass: 0, lush: 1, tall: 2, sand: 3, clay: 4, mud: 5, rock: 6, shallow: 7, deep: 8, ash: 9, dune: 10, salt: 11, beach: 12, leaf: 14, basalt: 15 };

function buildCues() {
  const C = [];
  const add = (cat, id, label, after, before, o = {}) => C.push({ cat, id, label, after, before, isNew: !before, secs: o.secs || 3.5 });
  // ---- the cat ----
  for (const [k, g] of Object.entries(G)) {
    const water = g === 7 || g === 8;
    add('The cat: footsteps', 'step_' + k, k + ' (walk)', run(P('step', { g, water, vol: 0.5 }), 5, 0.3, 0.02), run(P('step', { g, water, vol: 0.5 }), 5, 0.3, 0.02), { secs: 2.2 });
  }
  add('The cat: footsteps', 'step_run', 'grass (sprint)', run(P('step', { g: 0, vol: 0.9, sprint: true }), 8, 0.17), run(P('step', { g: 0, vol: 0.9 }), 8, 0.17), { secs: 2 });
  add('The cat: footsteps', 'step_runsand', 'sand (sprint)', run(P('step', { g: 3, vol: 0.9, sprint: true }), 8, 0.17), run(P('step', { g: 3, vol: 0.9 }), 8, 0.17), { secs: 2 });
  add('The cat: footsteps', 'step_stalk', 'grass (stalking)', run(P('step', { g: 0, vol: 0.5, stalk: true }), 4, 0.5), run(P('step', { g: 0, vol: 0.5 }), 4, 0.5), { secs: 2.4 });
  add('The cat: footsteps', 'step_stalktall', 'tall grass (stalking)', run(P('step', { g: 2, vol: 0.5, stalk: true }), 4, 0.5), run(P('step', { g: 2, vol: 0.5 }), 4, 0.5), { secs: 2.4 });
  const cat = 'The cat';
  add(cat, 'pounce', 'pounce', once(P('pounce')), once(P('pounce')), { secs: 1.2 });
  add(cat, 'pounce_water', 'pounce into water', once(P('pounce', { g: 7 })), once(P('pounce')), { secs: 1.2 });
  add(cat, 'kill', 'kill: gazelle', once(P('kill', { kind: 'gazelle' })), once(P('kill')), { secs: 1.5 });
  add(cat, 'kill_zebra', 'kill: zebra', once(P('kill', { kind: 'zebra' })), once(P('kill')), { secs: 1.5 });
  add(cat, 'kill_warthog', 'kill: warthog', once(P('kill', { kind: 'warthog' })), once(P('kill')), { secs: 1.5 });
  add(cat, 'kill_hare', 'kill: hare', once(P('kill', { kind: 'hare' })), once(P('kill')), { secs: 1.5 });
  add(cat, 'kill_fowl', 'kill: guineafowl', once(P('kill', { kind: 'fowl' })), once(P('kill')), { secs: 1.5 });
  add(cat, 'eat', 'eating (4 bites)', run(P('eat', { vol: 0.8 }), 4, 0.5), run(P('eat', { vol: 0.8 }), 4, 0.5), { secs: 2.4 });
  add(cat, 'drink', 'drinking (3 rounds)', run(P('drink', { vol: 0.8 }), 3, 0.55), run(P('drink', { vol: 0.8 }), 3, 0.55), { secs: 2 });
  add(cat, 'hit_spear', 'hurt: spear', once(P('hit', { kind: 'spear' })), once(P('hit')), { secs: 1 });
  add(cat, 'hit_dog', 'hurt: dog bite', once(P('hit', { kind: 'dog' })), once(P('hit')), { secs: 1 });
  add(cat, 'hit_warthog', 'hurt: tusk / hoof', once(P('hit', { kind: 'warthog' })), once(P('hit')), { secs: 1 });
  add(cat, 'hit_fire', 'hurt: fire', once(P('hit', { kind: 'fire' })), once(P('hit')), { secs: 1 });
  add(cat, 'snarl', 'snarl', once(P('snarl')), once(P('snarl')), { secs: 1 });
  add(cat, 'pant_warm', 'panting, warm (heat 80)', run(P('pant', { vol: 0.6, per: 0.53 }), 5, 0.53), run(P('pant', { vol: 0.8 }), 5, 0.32), { secs: 3 });
  add(cat, 'pant_hot', 'panting, overheated', run(P('pant', { vol: 1, per: 0.26 }), 10, 0.26), run(P('pant', { vol: 0.8 }), 10, 0.32), { secs: 3.3 });
  add(cat, 'overheat', 'overheat', once(P('overheat')), once(P('overheat')), { secs: 1.2 });
  add(cat, 'heart', 'heartbeat (wounded)', run(P('heart', { vol: 0.8 }), 3, 0.8), run(P('heart', { vol: 0.8 }), 3, 0.8), { secs: 2.6 });
  add(cat, 'climb', 'climb a ledge', once(P('climb')), once(P('climb')), { secs: 1 });
  add(cat, 'drop', 'drop off a ledge', once(P('drop', { vol: 0.8 })), once(P('drop', { vol: 0.8 })), { secs: 1 });
  add(cat, 'settle', 'lie down', once(P('settle')), null, { secs: 1.6 });
  add(cat, 'rise', 'get up', once(P('rise')), null, { secs: 0.8 });
  add(cat, 'saw', 'second wind (leopard sawing)', once(P('saw', { vol: 0.6 })), once(P('roar', { vol: 0.6 })), { secs: 3.4 });
  add(cat, 'fall', 'death: the cat goes down', once(P('fall')), null, { secs: 2 });
  // ---- hunters ----
  const hu = 'The hunters';
  add(hu, 'windup', 'spear windup', once(P('windup')), once(P('windup')), { secs: 1 });
  add(hu, 'throw', 'throw', once(P('throw')), once(P('throw')), { secs: 1 });
  add(hu, 'thunk', 'spear into earth', once(P('thunk', { g: 0 })), once(P('thunk')), { secs: 1 });
  add(hu, 'thunk_rock', 'spear onto rock', once(P('thunk', { g: 6 })), once(P('thunk')), { secs: 1 });
  add(hu, 'thunk_water', 'spear into water', once(P('thunk', { g: 7 })), once(P('thunk')), { secs: 1 });
  add(hu, 'sighted', 'sighted: alarm call', once(P('sighted')), once(P('sighted')), { secs: 2 });
  add(hu, 'shout_lost', 'call: lost you', once(P('shout', { call: 'lost', vol: 0.6 })), once(P('shout', { vol: 0.4 })), { secs: 1.2 });
  add(hu, 'shout_search', 'call: searching', once(P('shout', { call: 'search', vol: 0.7 })), once(P('shout', { vol: 0.5 })), { secs: 1.4 });
  add(hu, 'shout_found', 'call: trail found', once(P('shout', { call: 'found', vol: 0.7 })), once(P('shout', { vol: 0.7 })), { secs: 1.4 });
  add(hu, 'shout_scout', 'scout whistle', once(P('shout', { call: 'scout', vol: 0.6 })), once(P('shout', { vol: 0.5 })), { secs: 1.2 });
  add(hu, 'knockdown', 'knockdown', once(P('knockdown')), once(P('knockdown')), { secs: 1 });
  add(hu, 'footfalls', 'band footfalls (felt, not seen)', run((a) => a.fx('hunt_footfall', a.ctx.currentTime + 0.01, 0.35, { lp: 700, verb: 0 }), 10, 0.16, 0.05), null, { secs: 2.2 });
  add(hu, 'bark', 'dog: barks', once(P('bark')), once(P('bark')), { secs: 1 });
  add(hu, 'bite', 'dog: bite', once(P('bite')), once(P('bark')), { secs: 0.8 });
  add(hu, 'whine', 'dog: whine', once(P('whine')), null, { secs: 1.2 });
  add(hu, 'yelp', 'dog: yelp (knocked down)', once(P('yelp')), once(P('yelp')), { secs: 0.8 });
  // ---- animals ----
  const an = 'Animals';
  for (const [k, l] of [['gazelle', 'gazelle: alarm snort + stotting'], ['zebra', 'zebra: bark + hooves'], ['warthog', 'warthog: grunts'], ['hare', 'hare: foot thump'], ['hyrax', 'hyrax: shriek'], ['ostrich', 'ostrich: hiss + run'], ['fowl', 'guineafowl: chatter + wings'], ['flamingo', 'flamingo: flock lifting']]) {
    const fly = k === 'fowl' || k === 'flamingo';
    add(an, 'startle_' + k, l, once(P('startle', { kind: k, fly })), once(P('startle', { fly })), { secs: 2.2 });
  }
  const fxc = (n, g = 0.45, o = {}) => once((a) => a.fx(n, a.ctx.currentTime + 0.01, g, o));
  add(an, 'zebra', 'zebra call (grazing)', fxc('an_zebra', 0.4), null, { secs: 1.3 });
  add(an, 'gnu', 'wildebeest grunts', fxc('an_gnu', 0.4), null, { secs: 1 });
  add(an, 'boom', 'ostrich boom', fxc('an_boom', 0.4), null, { secs: 1.8 });
  add(an, 'honk', 'flamingo honk', fxc('an_honk', 0.4), null, { secs: 0.6 });
  add(an, 'kek', 'guineafowl chatter', fxc('an_kek', 0.4), null, { secs: 1.4 });
  add(an, 'hoof', 'hooves running away', run((a) => a.fx('an_hoof', a.ctx.currentTime + 0.01, 0.35), 12, 0.09, 0.04), null, { secs: 1.6 });
  add(an, 'laugh', 'hyenas: giggle', once(P('laugh')), once(P('laugh')), { secs: 2.4 });
  add(an, 'whoop', 'hyena whoop', fxc('an_whoop', 0.4), null, { secs: 1.4 });
  add(an, 'hsnarl', 'hyena bite', once(P('snarl', { who: 'hyena' })), once(P('snarl')), { secs: 0.8 });
  add(an, 'wsnarl', 'warthog charge', once(P('snarl', { who: 'warthog' })), once(P('snarl')), { secs: 1 });
  add(an, 'roar', 'lion roar (pride)', once(P('roar', { vol: 0.8 })), once(P('roar', { vol: 0.8 })), { secs: 4.5 });
  add(an, 'charge', 'lion charge', once(P('roar', { charge: true })), once(P('roar')), { secs: 1.6 });
  add(an, 'lgrunt', 'lions grunting at rest', fxc('an_lgrunt', 0.45), null, { secs: 1.8 });
  add(an, 'rumble', 'stampede coming', once(P('rumble')), once(P('rumble')), { secs: 4 });
  add(an, 'croc', 'croc surfaces', once(P('croc', { vol: 0.7 })), once(P('splash', { vol: 0.5 })), { secs: 2 });
  add(an, 'snap', 'croc snap', once(P('snap')), once(P('snap')), { secs: 1 });
  add(an, 'csink', 'croc sinks', fxc('an_csink', 0.5), null, { secs: 1.3 });
  add(an, 'vwing', 'vulture wingbeats', run((a) => a.fx('an_vwing', a.ctx.currentTime + 0.01, 0.3), 3, 0.5), null, { secs: 1.8 });
  add(an, 'vhiss', 'vulture hiss', fxc('an_vhiss', 0.35), null, { secs: 1 });
  // ---- the world ----
  const w = 'Weather, birds, the land';
  add(w, 'thunder_near', 'thunder: near', once(P('thunder', { near: true })), once(P('thunder')), { secs: 5 });
  add(w, 'thunder_far', 'thunder: far', once(P('thunder', { near: false, vol: 0.6 })), once(P('thunder', { vol: 0.6 })), { secs: 5 });
  add(w, 'strike', 'lightning strike', once(P('strike')), [[0, P('thunder', { vol: 1 })], [0, P('snap', { vol: 0.6 })]], { secs: 4 });
  add(w, 'ignite', 'grass fire catches', once(P('ignite')), null, { secs: 1.6 });
  add(w, 'gust', 'dust gust', once((a) => a.gust(a.ctx.currentTime + 0.01)), once((a) => a.gust(a.ctx.currentTime + 0.01)), { secs: 3 });
  add(w, 'vent', 'ashland steam vent', fxc('w_vent', 0.4), null, { secs: 2.2 });
  add(w, 'chorus', 'dawn chorus', once(P('chorus')), null, { secs: 7.5 });
  const BN = ['chirps', 'boubou duet', 'trill', 'dove', 'frog', 'gull', 'nightjar', 'hyena far off', 'owl', 'ground hornbill', 'francolin', 'sunbird'];
  BN.forEach((n, k) => add(w, 'bird' + k, 'bird: ' + n, once((a) => a.birdCall(a.ctx.currentTime + 0.01, k)), k < 10 ? once((a) => a.birdCall(a.ctx.currentTime + 0.01, k)) : null, { secs: 2 }));
  // ---- interface ----
  const ui = 'Interface';
  add(ui, 'ui_move', 'menu move', run(P('ui', { pitch: 76 }), 4, 0.15), run(P('ui', { pitch: 76 }), 4, 0.15), { secs: 1.2 });
  add(ui, 'ui_select', 'menu select', once(P('ui', { pitch: 81 })), once(P('ui', { pitch: 81 })), { secs: 1 });
  add(ui, 'ui_back', 'menu back', once(P('back')), null, { secs: 0.6 });
  const mult = [[0, P('ui', { pitch: 85 })], [0.3, P('ui', { pitch: 88 })], [0.6, P('ui', { pitch: 91 })]];
  add(ui, 'mult', 'multiplier rising', mult, mult, { secs: 1.5 });
  add(ui, 'score', 'score ticks', run(P('score'), 5, 0.12), run(P('score'), 5, 0.12), { secs: 1.4 });
  add(ui, 'multloss', 'multiplier lost', once(P('multloss')), once(P('multloss')), { secs: 1 });
  add(ui, 'trail', 'trail cold / hint', once(P('trail')), once(P('trail')), { secs: 1.2 });
  add(ui, 'dodge', 'dodge (spear past)', once(P('dodge')), once(P('dodge')), { secs: 1 });
  add(ui, 'golden', 'golden gazelle', once(P('golden')), once(P('golden')), { secs: 1.6 });
  add(ui, 'feat', 'feat unlocked', once(P('feat')), null, { secs: 1.4 });
  add(ui, 'perkopen', 'perk choice opens', once(P('perkopen')), null, { secs: 1.2 });
  add(ui, 'pause', 'pause', once(P('pause')), null, { secs: 0.6 });
  return C;
}
export const CUES = buildCues();

// Ambience scenes: engine fields to set, plus what the game's scene() would have reported.
export const SCENES = [
  { id: 'sav_day', label: 'Savanna, day', st: { biome: 0, night: 0 } },
  { id: 'sav_night', label: 'Savanna, night', st: { biome: 0, night: 1 } },
  { id: 'wood_day', label: 'Woodland under trees, day', st: { biome: 1, night: 0 }, sc: { trees: 1 } },
  { id: 'wet_night', label: 'Wetland, night', st: { biome: 2, night: 1 } },
  { id: 'desert_dust', label: 'Desert, dust storm', st: { biome: 3, night: 0, dust: 0.8 } },
  { id: 'highland', label: 'Highlands', st: { biome: 4, night: 0 } },
  { id: 'ash', label: 'Ashlands', st: { biome: 5, night: 0 } },
  { id: 'coast', label: 'Coast', st: { biome: 6, night: 0, coast: 1 } },
  { id: 'rain', label: 'Light rain', st: { biome: 0, night: 0, rain: 0.3 } },
  { id: 'storm', label: 'Thunderstorm', st: { biome: 0, night: 0, rain: 1, storm: 1 } },
  { id: 'heat', label: 'Heatwave', st: { biome: 0, night: 0, heat: 1 } },
  { id: 'fog', label: 'Fog', st: { biome: 1, night: 0, fog: 1 } },
  { id: 'fire', label: 'Grass fire close', st: { biome: 0, night: 0, fire: 1 }, sc: { fire: 1 } },
  { id: 'torch', label: 'Torches at night (day 4+)', st: { biome: 0, night: 1 }, sc: { torch: 0.8, torchPan: 0.4 } },
  { id: 'whistle', label: 'Whistling rocks', st: { biome: 4, night: 0 }, sc: { whistle: 1 } },
  { id: 'camp', label: 'Hunters’ camp embers', st: { biome: 0, night: 1 }, sc: { camp: 1 } },
  { id: 'oasis', label: 'Oasis', st: { biome: 3, night: 0 }, sc: { oasis: 1 } },
  { id: 'tall', label: 'Lying in tall grass', st: { biome: 0, night: 0 }, sc: { tall: 1 } },
  { id: 'herd', label: 'Stampede passing', st: { biome: 0, night: 0 }, sc: { herd: 1, herdPan: -0.3 } },
];
// which scenes the old engine could do anything for
export const OLD_SCENE = new Set(['sav_day', 'sav_night', 'wood_day', 'wet_night', 'desert_dust', 'highland', 'ash', 'coast', 'rain', 'storm', 'heat', 'fog', 'fire']);

export function applyScene(a, s) {
  a.menu = false;
  for (const k of ['biome', 'night', 'rain', 'dust', 'heat', 'fog', 'storm', 'coast', 'fire']) a[k] = 0;
  Object.assign(a, s.st);
  if (s.sc) a.sc = { ...s.sc }; else a.sc = null;
}

// ---- offline renders ----
export async function renderCue(Engine, cue, which = 'after', sr = 44100) {
  const tl = cue[which];
  if (!tl) return null;
  const secs = cue.secs + 0.6;
  const off = new OfflineAudioContext(2, Math.floor(sr * secs), sr);
  const a = new Engine();
  a.init(off);
  // no ambience beds under a one-shot (the old engine runs its wind from the start)
  a.menu = true; a.playing = false; if (a.wind) a.wind.gain.value = 0;
  const at = new Map();
  for (const [t, fn] of tl) { const k = Math.round((0.05 + t) * sr / 128); at.set(k, [...(at.get(k) || []), fn]); }
  for (const [k, fns] of at) off.suspend(k * 128 / sr).then(() => { fns.forEach((fn) => fn(a)); off.resume(); });
  return off.startRendering();
}
// Ambience: the real update() loop driven for `secs`, music silenced.
export async function renderScene(Engine, scene, secs = 8, sr = 44100) {
  const off = new OfflineAudioContext(2, Math.floor(sr * secs), sr);
  const a = new Engine();
  a.init(off);
  a.music.gain.value = 0;
  applyScene(a, scene);
  const dt = 0.05;
  for (let t = dt; t < secs - 0.1; t += dt) off.suspend(+(Math.round(t * sr / 128) * 128 / sr).toFixed(6)).then(() => { a.update(dt); off.resume(); });
  return off.startRendering();
}

// ---- numbers ----
function kweight(x, sr) {
  const biq = (x, b0, b1, b2, a1, a2) => { const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; };
  let K = Math.tan(Math.PI * 1681.974450955533 / sr), Q = 0.7071752369554196;
  const Vh = Math.pow(10, 3.999843853973347 / 20), Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const y = biq(x, (Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0);
  K = Math.tan(Math.PI * 38.13547087602444 / sr); Q = 0.5003270373238773; a0 = 1 + K / Q + K * K;
  return biq(y, 1, -2, 1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0);
}
const db = (v) => (v > 0 ? 20 * Math.log10(v) : -120);
export function analyze(buf) {
  const sr = buf.sampleRate, L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L, n = L.length;
  let pk = 0, nan = 0, clip = 0, first = -1, last = -1, dc = 0;
  for (let i = 0; i < n; i++) {
    const a = L[i], b = R[i];
    if (!Number.isFinite(a) || !Number.isFinite(b)) { nan++; continue; }
    const m = Math.max(Math.abs(a), Math.abs(b));
    if (m > pk) pk = m;
    if (m >= 0.999) clip++;
    if (m > 0.001) { if (first < 0) first = i; last = i; }
  }
  if (first < 0) return { silent: true, nan, peak: -120 };
  for (let i = first; i <= last; i++) dc += (L[i] + R[i]) / 2;
  dc /= last - first + 1;
  const kL = kweight(L, sr), kR = kweight(R, sr);
  // integrated over the audible span, and the loudest 400 ms window (momentary max)
  let s = 0;
  for (let i = first; i <= last; i++) s += kL[i] * kL[i] + kR[i] * kR[i];
  const lufs = -0.691 + 10 * Math.log10(s / (last - first + 1) || 1e-12);
  const W = Math.floor(0.4 * sr), H = Math.floor(0.1 * sr);
  let mm = -120;
  for (let i = first; i + W <= Math.max(last + 1, first + W) && i + W <= n; i += H) { let w = 0; for (let k = i; k < i + W; k++) w += kL[k] * kL[k] + kR[k] * kR[k]; mm = Math.max(mm, -0.691 + 10 * Math.log10(w / W || 1e-12)); }
  // envelope (5 ms) for the attack: start to 90% of its peak
  const E = Math.floor(0.005 * sr);
  let ePk = 0, ePi = first;
  const env = [];
  for (let i = first; i <= last; i += E) { let w = 0; for (let k = i; k < Math.min(n, i + E); k++) w = Math.max(w, Math.abs(L[k]), Math.abs(R[k])); env.push(w); if (w > ePk) { ePk = w; ePi = i; } }
  let att = 0;
  for (let k = 0; k < env.length; k++) if (env[k] >= ePk * 0.9) { att = (k * E) / sr; break; }
  // spectral centroid, energy-weighted over frames
  const N = 1024, cent = centroid(L, sr, first, last, N);
  const tail = (() => { let w = 0; const k0 = Math.max(0, n - Math.floor(0.03 * sr)); for (let i = k0; i < n; i++) w = Math.max(w, Math.abs(L[i])); return db(w); })();
  return { peak: +db(pk).toFixed(1), lufs: +lufs.toFixed(1), mmax: +mm.toFixed(1), dur: +((last - first) / sr).toFixed(2), attack: +(att * 1000).toFixed(0), centroid: Math.round(cent), dc: +dc.toFixed(4), clip, nan, tail: +tail.toFixed(0), start: +(first / sr).toFixed(3) };
}
function fftMag(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr; re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } }
  }
  const m = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) m[i] = Math.hypot(re[i], im[i]);
  return m;
}
const hann = (N) => Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)));
function centroid(x, sr, a, b, N) {
  const w = hann(N);
  let num = 0, den = 0;
  for (let s = a; s + N <= b + N && s + N <= x.length; s += N / 2) {
    const re = new Float32Array(N), im = new Float32Array(N);
    for (let i = 0; i < N; i++) re[i] = x[s + i] * w[i];
    const m = fftMag(re, im);
    for (let k = 1; k < N / 2; k++) { const e = m[k] * m[k]; num += e * (k * sr / N); den += e; }
  }
  return den ? num / den : 0;
}

// ---- pictures ----
// inferno-ish colour ramp
const RAMP = [[0, 0, 4], [40, 11, 84], [101, 21, 110], [159, 42, 99], [212, 72, 66], [245, 125, 21], [250, 193, 39], [252, 255, 164]];
function ramp(v) { v = Math.max(0, Math.min(1, v)) * (RAMP.length - 1); const i = Math.min(RAMP.length - 2, Math.floor(v)), f = v - i, a = RAMP[i], b = RAMP[i + 1]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; }
// Spectrogram on a log-frequency axis (40 Hz to 16 kHz) with the waveform envelope above it.
export function drawSpec(cv, buf, { w = 360, h = 120, wave = 28, labels = false, secs = null } = {}) {
  const sr = buf.sampleRate, x = buf.getChannelData(0), x2 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : x;
  const pad = labels ? 34 : 0;
  cv.width = w + pad; cv.height = h + wave + (labels ? 14 : 0);
  const c = cv.getContext('2d');
  c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
  const span = Math.floor((secs || x.length / sr) * sr);
  const N = 1024, win = hann(N), f0 = 40, f1 = Math.min(16000, sr / 2), img = c.createImageData(w, h);
  for (let col = 0; col < w; col++) {
    const s = Math.floor((col / w) * span) - N / 2;
    const re = new Float32Array(N), im = new Float32Array(N);
    for (let i = 0; i < N; i++) { const k = s + i; re[i] = k >= 0 && k < x.length ? ((x[k] + x2[k]) / 2) * win[i] : 0; }
    const m = fftMag(re, im);
    for (let row = 0; row < h; row++) {
      const fa = f0 * Math.pow(f1 / f0, (h - 1 - row) / h), fb = f0 * Math.pow(f1 / f0, (h - row) / h);
      let ka = Math.floor(fa * N / sr), kb = Math.max(ka + 1, Math.ceil(fb * N / sr)), mx = 0;
      for (let k = ka; k < kb && k < N / 2; k++) mx = Math.max(mx, m[k]);
      const dbv = 20 * Math.log10(mx / (N / 4) + 1e-9);
      const [r, g, b] = ramp((dbv + 95) / 85);
      const o = (row * w + col) * 4; img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
  }
  c.putImageData(img, pad, wave);
  // waveform envelope (peak per column), dB-ish so quiet tails still show
  c.fillStyle = '#7fd6e0';
  for (let col = 0; col < w; col++) {
    const a = Math.floor((col / w) * span), b = Math.floor(((col + 1) / w) * span);
    let mx = 0;
    for (let i = a; i < b && i < x.length; i++) mx = Math.max(mx, Math.abs(x[i]), Math.abs(x2[i]));
    const v = Math.max(0, (20 * Math.log10(mx + 1e-9) + 60) / 60), hh = v * (wave - 2);
    c.fillRect(pad + col, wave / 2 - hh / 2, 1, Math.max(hh, mx > 0.001 ? 1 : 0));
  }
  if (labels) {
    c.fillStyle = '#ccc'; c.font = '10px monospace';
    for (const f of [100, 300, 1000, 3000, 10000]) { const row = h - 1 - Math.log(f / f0) / Math.log(f1 / f0) * h; c.fillText(f >= 1000 ? f / 1000 + 'k' : f, 2, wave + row + 3); c.fillRect(pad - 3, wave + row, 3, 1); }
    const S = span / sr;
    for (let s = 0; s <= S + 1e-6; s += S > 3 ? 1 : 0.25) { const col = pad + (s / S) * w; c.fillText(s.toFixed(S > 3 ? 0 : 2), col - 6, cv.height - 2); c.fillRect(col, wave + h, 1, 3); }
  }
  return cv;
}

// 16-bit WAV of a rendered buffer
export function wav(buf) {
  const ch = buf.numberOfChannels, n = buf.length, sr = buf.sampleRate, b = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const s = (o, t) => [...t].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)));
  s(0, 'RIFF'); b.setUint32(4, 36 + n * ch * 2, true); s(8, 'WAVEfmt '); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, ch, true);
  b.setUint32(24, sr, true); b.setUint32(28, sr * ch * 2, true); b.setUint16(32, ch * 2, true); b.setUint16(34, 16, true); s(36, 'data'); b.setUint32(40, n * ch * 2, true);
  const d = [...Array(ch)].map((_, k) => buf.getChannelData(k));
  for (let i = 0, o = 44; i < n; i++) for (let k = 0; k < ch; k++, o += 2) b.setInt16(o, Math.max(-1, Math.min(1, d[k][i] || 0)) * 32767, true);
  return b.buffer;
}

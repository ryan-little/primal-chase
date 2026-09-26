// All sound is synthesized: no audio files ship with the game.
//
// Instruments are rendered once into AudioBuffers (Karplus-Strong kora plucks, modal marimba
// and mbira, a djembe/talking-drum kit, footsteps for every ground), then played by a
// sequencer. The score follows the land: each biome has its own theme and groove, night
// thins everything out, and the band's drums swell as they close in until a full chase
// groove with chanting takes over.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const D2 = 38, D3 = 50;

// ---------------- composed material ----------------
// Theme A/B (kalimba/flute), per bar: [step, midi, lengthSteps]
const THEME_A = [
  [[0, 74, 3], [3, 69, 3], [6, 72, 2], [8, 74, 4], [12, 77, 2], [14, 76, 2]],
  [[0, 74, 4], [4, 72, 2], [6, 69, 4], [10, 67, 2], [12, 69, 4]],
  [[0, 65, 3], [3, 67, 3], [6, 69, 2], [8, 72, 4], [12, 74, 2], [14, 72, 2]],
  [[0, 69, 4], [4, 67, 2], [6, 65, 2], [8, 62, 8]],
];
const THEME_B = [
  [[0, 77, 2], [2, 76, 2], [4, 74, 4], [8, 72, 2], [10, 74, 6]],
  [[0, 69, 2], [2, 72, 2], [4, 74, 2], [6, 76, 2], [8, 77, 4], [12, 81, 4]],
  [[0, 79, 2], [2, 77, 2], [4, 76, 4], [8, 74, 2], [10, 72, 2], [12, 69, 4]],
  [[0, 72, 3], [3, 74, 3], [6, 69, 10]],
];
const NIGHT_THEME = [
  [[0, 69, 6], [6, 72, 2], [8, 74, 8]],
  [[0, 72, 4], [4, 69, 4], [8, 67, 8]],
  [[0, 65, 6], [6, 67, 2], [8, 69, 6], [14, 72, 2]],
  [[0, 69, 16]],
];
// desert: D phrygian dominant (D Eb F# G A Bb C)
const DESERT_THEME = [
  [[0, 74, 6], [6, 75, 2], [8, 74, 3], [11, 72, 3], [14, 70, 2]],
  [[0, 69, 8], [8, 70, 2], [10, 69, 2], [12, 66, 4]],
  [[0, 67, 3], [3, 69, 3], [6, 70, 2], [8, 72, 6], [14, 70, 2]],
  [[0, 69, 4], [4, 66, 4], [8, 62, 8]],
];
// highland: wide, slow
const HIGH_THEME = [
  [[0, 62, 8], [8, 69, 8]],
  [[0, 67, 6], [6, 65, 2], [8, 64, 8]],
  [[0, 62, 4], [4, 65, 4], [8, 69, 4], [12, 72, 4]],
  [[0, 74, 12], [12, 72, 4]],
];
const TITLE_THEME = [
  [[0, 74, 3], [3, 69, 3], [6, 72, 2], [8, 74, 4], [12, 77, 2], [14, 76, 2]],
  [[0, 74, 4], [4, 72, 2], [6, 69, 4], [10, 67, 2], [12, 69, 4]],
  [[0, 77, 2], [2, 76, 2], [4, 74, 4], [8, 72, 2], [10, 74, 6]],
  [[0, 69, 2], [2, 72, 2], [4, 74, 2], [6, 76, 2], [8, 77, 4], [12, 81, 4]],
  [[0, 79, 2], [2, 77, 2], [4, 76, 4], [8, 74, 2], [10, 72, 2], [12, 69, 4]],
  [[0, 65, 3], [3, 67, 3], [6, 69, 2], [8, 72, 4], [12, 74, 2], [14, 72, 2]],
  [[0, 69, 4], [4, 67, 2], [6, 65, 2], [8, 64, 4], [12, 65, 4]],
  [[0, 62, 16]],
];
const PROG = [
  { root: 50, tones: [62, 65, 69] }, // Dm
  { root: 48, tones: [60, 64, 67] }, // C
  { root: 46, tones: [58, 62, 65] }, // Bb
  { root: 48, tones: [60, 64, 67] }, // C
];
const PROG_DESERT = [
  { root: 50, tones: [62, 66, 69] }, // D (major 3rd, phrygian dominant)
  { root: 51, tones: [63, 67, 70] }, // Eb
  { root: 50, tones: [62, 66, 69] },
  { root: 48, tones: [60, 63, 67] }, // Cm
];
const PROG_ASH = [
  { root: 50, tones: [62, 63, 69] },
  { root: 49, tones: [61, 64, 68] },
  { root: 50, tones: [62, 65, 68] },
  { root: 46, tones: [58, 61, 65] },
];
// biome ids from terrain.js: 0 savanna 1 woodland 2 wetland 3 desert 4 highland 5 volcanic 6 coast
const BIOME_THEME = ['savanna', 'woodland', 'wetland', 'desert', 'highland', 'ash', 'coast'];

// ---------------- sample synthesis ----------------
function noise(n) { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = Math.random() * 2 - 1; return a; }

// RBJ biquad, applied in place
function biquad(buf, sr, type, f, q) {
  const w = (2 * Math.PI * f) / sr, cs = Math.cos(w), sn = Math.sin(w), al = sn / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; }
  else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; }
  else { b0 = al; b1 = 0; b2 = -al; } // bandpass
  a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i];
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    buf[i] = y;
  }
  return buf;
}

function normalize(buf, peak = 0.9) {
  let m = 0;
  for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i]));
  if (m > 0) for (let i = 0; i < buf.length; i++) buf[i] *= peak / m;
  return buf;
}

// Karplus-Strong plucked string: a kora / ngoni voice
function pluck(sr, f, dur, bright = 0.55, decay = 0.9965) {
  const N = Math.max(2, Math.round(sr / f));
  const len = Math.floor(sr * dur);
  const out = new Float32Array(len);
  const buf = new Float32Array(N);
  let lp = 0;
  for (let i = 0; i < N; i++) { lp += (Math.random() * 2 - 1 - lp) * bright; buf[i] = lp; }
  let idx = 0;
  for (let i = 0; i < len; i++) {
    const a = buf[idx], b = buf[(idx + 1) % N];
    buf[idx] = (a + b) * 0.5 * decay;
    out[i] = a;
    idx = (idx + 1) % N;
  }
  // a touch of body resonance and a soft release
  biquad(out, sr, 'bp', Math.min(sr / 2.5, f * 2), 0.7);
  for (let i = 0; i < 64 && i < len; i++) out[len - 1 - i] *= i / 64;
  return normalize(out, 0.8);
}

// modal bar: marimba / mbira
function bar(sr, f, dur, partials, noiseAmt = 0.05, buzz = 0) {
  const len = Math.floor(sr * dur);
  const out = new Float32Array(len);
  for (const [ratio, amp, dec] of partials) {
    const w = (2 * Math.PI * f * ratio) / sr;
    if (f * ratio > sr / 2.2) continue;
    const k = Math.exp(-1 / (dec * sr));
    let e = amp;
    for (let i = 0; i < len; i++) { out[i] += Math.sin(w * i) * e; e *= k; }
  }
  const nl = Math.floor(sr * 0.012);
  for (let i = 0; i < nl && i < len; i++) out[i] += (Math.random() * 2 - 1) * noiseAmt * (1 - i / nl);
  if (buzz) { // the rattling bottle caps of an mbira
    let r = 0;
    for (let i = 0; i < len; i++) { r += ((Math.random() * 2 - 1) - r) * 0.3; out[i] *= 1 + r * buzz * Math.min(1, i / (sr * 0.02)); }
  }
  for (let i = 0; i < Math.min(40, len); i++) out[i] *= i / 40;
  return normalize(out, 0.8);
}

function drum(sr, f0, f1, dur, noiseAmt, noiseF, tone2 = 0) {
  const len = Math.floor(sr * dur);
  const out = new Float32Array(len);
  let ph = 0, ph2 = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const f = f1 + (f0 - f1) * Math.exp(-t * 30);
    ph += (2 * Math.PI * f) / sr;
    ph2 += (2 * Math.PI * f * 1.52) / sr;
    const env = Math.exp(-t / (dur * 0.28));
    out[i] = (Math.sin(ph) + Math.sin(ph2) * tone2) * env;
  }
  if (noiseAmt) {
    const n = biquad(noise(len), sr, 'bp', noiseF, 1.2);
    for (let i = 0; i < len; i++) out[i] += n[i] * noiseAmt * Math.exp(-i / (sr * 0.018));
  }
  return normalize(out, 0.9);
}

function noiseHitBuf(sr, dur, type, f, q, attack = 0.002, curve = 1) {
  const len = Math.floor(sr * dur);
  const out = biquad(noise(len), sr, type, f, q);
  const a = Math.max(1, Math.floor(attack * sr));
  for (let i = 0; i < len; i++) out[i] *= (i < a ? i / a : 1) * Math.pow(1 - i / len, curve);
  return normalize(out, 0.8);
}

export class Audio {
  constructor() {
    this.ctx = null;
    this.musicVol = 0.8;
    this.sfxVol = 0.9;
    this.muted = false;
    this.intensity = 0;
    this.night = 0;
    this.rain = 0;
    this.biome = 0;
    this.coast = 0;
    this.fire = 0;
    this.tempo = 88;
    this.step = 0;
    this.nextTime = 0;
    this.section = 'A';
    this.theme = 'title';
    this.playing = false;
    this.lastBird = 0;
    this.menu = true;
    this.cache = new Map();
  }

  init(offline) {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC && !offline) return;
    const ctx = (this.ctx = offline || new AC());
    this.sr = ctx.sampleRate;
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.music = ctx.createGain();
    this.sfx = ctx.createGain();
    this.amb = ctx.createGain();
    this.music.connect(this.master);
    this.sfx.connect(this.master);
    this.amb.connect(this.master);
    this.applyVolumes();

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    this.noise.getChannelData(0).set(noise(len));

    this.verb = ctx.createConvolver();
    const ir = ctx.createBuffer(2, ctx.sampleRate * 2.6, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const b = ir.getChannelData(ch);
      for (let i = 0; i < b.length; i++) b[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / b.length, 2.8);
    }
    this.verb.buffer = ir;
    this.verbIn = ctx.createGain();
    this.verbIn.gain.value = 0.9;
    this.verbIn.connect(this.verb).connect(this.music);

    this.mbus = ctx.createBiquadFilter();
    this.mbus.type = 'lowpass';
    this.mbus.frequency.value = Math.min(18000, ctx.sampleRate / 2 - 100);
    this.mbus.connect(this.music);

    this.buildKit();
    this.startAmbience();
    // render instrument notes a few per frame instead of on first use
    this.warm = [];
    for (let m = 38; m <= 86; m++) this.warm.push(['kora', m]);
    for (let m = 60; m <= 93; m++) this.warm.push(['kalimba', m]);
    for (let m = 50; m <= 79; m++) this.warm.push(['marimba', m]);
    for (let m = 38; m <= 76; m++) this.warm.push(['mbira', m]);
    this.nextTime = ctx.currentTime + 0.1;
    this.playing = true;
  }

  applyVolumes() {
    if (!this.ctx) return;
    const m = this.muted ? 0 : 1;
    this.music.gain.value = this.musicVol * 0.55 * m;
    this.sfx.gain.value = this.sfxVol * 0.8 * m;
    this.amb.gain.value = this.sfxVol * 0.5 * m;
  }

  setMuffle(on) {
    if (!this.ctx) return;
    this.mbus.frequency.setTargetAtTime(on ? 700 : Math.min(18000, this.ctx.sampleRate / 2 - 100), this.ctx.currentTime, 0.15);
  }

  // ---------------- sample bank ----------------
  buf(data) {
    const b = this.ctx.createBuffer(1, data.length, this.sr);
    b.getChannelData(0).set(data);
    return b;
  }

  buildKit() {
    const sr = this.sr;
    const K = (this.kit = {});
    K.bass = this.buf(drum(sr, 120, 58, 0.55, 0.25, 900));
    K.tone = this.buf(drum(sr, 260, 205, 0.3, 0.4, 2200, 0.35));
    K.slap = this.buf(noiseHitBuf(sr, 0.12, 'bp', 2400, 2.5, 0.001, 3));
    K.shaker = this.buf(noiseHitBuf(sr, 0.07, 'hp', 6500, 0.8, 0.02, 2));
    K.talk = this.buf((() => { // talking drum: the pitch bends up under the arm
      const len = Math.floor(sr * 0.4), o = new Float32Array(len); let ph = 0;
      for (let i = 0; i < len; i++) { const t = i / sr; ph += (2 * Math.PI * (170 + 90 * Math.min(1, t / 0.18))) / sr; o[i] = Math.sin(ph) * Math.exp(-t / 0.13); }
      return normalize(o, 0.9);
    })());
    K.udu = this.buf((() => {
      const len = Math.floor(sr * 0.35), o = new Float32Array(len); let ph = 0;
      for (let i = 0; i < len; i++) { const t = i / sr; ph += (2 * Math.PI * (95 + 70 * Math.min(1, t / 0.08))) / sr; o[i] = Math.sin(ph) * Math.exp(-t / 0.09); }
      return normalize(o, 0.9);
    })());
    K.heart = this.buf(drum(sr, 70, 42, 0.22, 0, 0));
    // footsteps, three takes each
    K.step = {
      grass: [0, 1, 2].map(() => this.buf(noiseHitBuf(sr, 0.07, 'bp', 2600 + Math.random() * 1200, 0.9, 0.012, 2))),
      sand: [0, 1, 2].map(() => this.buf((() => { const b = noiseHitBuf(sr, 0.09, 'bp', 900 + Math.random() * 300, 1.2, 0.004, 1.5); for (let i = 0; i < b.length; i++) b[i] *= Math.random() < 0.4 ? 1.4 : 0.5; return normalize(b, 0.7); })())),
      rock: [0, 1, 2].map(() => this.buf((() => { const b = drum(sr, 1900 + Math.random() * 400, 1400, 0.03, 0.4, 3500); return b; })())),
      water: [0, 1, 2].map(() => this.buf(noiseHitBuf(sr, 0.16, 'lp', 1500 + Math.random() * 600, 0.8, 0.01, 1.2))),
      leaf: [0, 1, 2].map(() => this.buf((() => { const len = Math.floor(sr * 0.1), o = new Float32Array(len); for (let k = 0; k < 6; k++) { const at = Math.floor(Math.random() * len * 0.8); for (let i = 0; i < 90 && at + i < len; i++) o[at + i] += (Math.random() * 2 - 1) * (1 - i / 90); } return normalize(biquad(o, sr, 'hp', 1500, 0.7), 0.7); })())),
      mud: [0, 1, 2].map(() => this.buf((() => { const b = noiseHitBuf(sr, 0.14, 'bp', 320 + Math.random() * 80, 4, 0.01, 1); return b; })())),
    };
  }

  // Cached melodic sample for (instrument, midi)
  note(inst, midi) {
    const key = inst + midi;
    let b = this.cache.get(key);
    if (b) return b;
    const f = NOTE(midi), sr = this.sr;
    let data;
    if (inst === 'kora') data = pluck(sr, f, 2.2, 0.55, midi < 55 ? 0.998 : 0.9965);
    else if (inst === 'marimba') data = bar(sr, f, 1.4, [[1, 1, 0.6], [3.93, 0.35, 0.18], [9.24, 0.1, 0.06]], 0.08);
    else if (inst === 'mbira') data = bar(sr, f, 1.8, [[1, 1, 0.9], [5.4, 0.22, 0.2], [11.3, 0.06, 0.05]], 0.04, 0.35);
    else if (inst === 'kalimba') data = bar(sr, f, 1.6, [[1, 1, 0.7], [5.4, 0.3, 0.1], [2, 0.1, 0.4]], 0.05);
    b = this.buf(data);
    this.cache.set(key, b);
    return b;
  }

  playBuf(b, t, gain = 1, { dest = this.mbus, rate = 1, pan = 0, verb = 0.3 } = {}) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = b;
    s.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = gain;
    let node = s.connect(g);
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      node = node.connect(p);
    }
    node.connect(dest);
    if (verb) { const v = ctx.createGain(); v.gain.value = verb; node.connect(v).connect(this.verbIn); }
    s.start(t);
    return s;
  }

  inst(name, midi, t, vel = 1, pan = 0) {
    const gains = { kora: 0.3, marimba: 0.28, mbira: 0.26, kalimba: 0.24 };
    this.playBuf(this.note(name, midi), t, gains[name] * vel, { pan, verb: name === 'kora' ? 0.35 : 0.3 });
  }

  hit(name, t, vel = 1, rate = 1, pan = 0) {
    this.playBuf(this.kit[name], t, vel * 0.55, { rate, pan, verb: 0.15 });
  }

  // ---------------- ambience ----------------
  loopNoise(filterType, freq, q, gain, rate = 1) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(this.amb);
    src.start();
    return { g, f };
  }

  startAmbience() {
    const ctx = this.ctx;
    const wind = this.loopNoise('lowpass', 380, 0.7, 0.16);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 180;
    lfo.connect(lfoG).connect(wind.f.frequency);
    lfo.start();
    this.wind = wind.g;
    this.windF = wind.f;
    this.rainG = this.loopNoise('bandpass', 2400, 0.4, 0, 0.7).g;
    // surf: slow swells of low noise
    const surf = this.loopNoise('lowpass', 500, 0.5, 0, 0.6);
    this.surfG = surf.g;
    const swell = ctx.createOscillator();
    swell.frequency.value = 0.11;
    const swG = ctx.createGain();
    swG.gain.value = 300;
    swell.connect(swG).connect(surf.f.frequency);
    swell.start();
    // crickets
    const co = ctx.createOscillator();
    co.frequency.value = 4700;
    const am = ctx.createGain();
    am.gain.value = 0;
    const amo = ctx.createOscillator();
    amo.type = 'square';
    amo.frequency.value = 28;
    const amoG = ctx.createGain();
    amoG.gain.value = 0.5;
    amo.connect(amoG).connect(am.gain);
    this.cricketG = ctx.createGain();
    this.cricketG.gain.value = 0;
    co.connect(am).connect(this.cricketG).connect(this.amb);
    const pulse = ctx.createOscillator();
    pulse.frequency.value = 0.9;
    const pg = ctx.createGain();
    pg.gain.value = 0.5;
    pulse.connect(pg).connect(am.gain);
    co.start(); amo.start(); pulse.start();
    // fire roar
    this.fireG = this.loopNoise('bandpass', 700, 0.5, 0, 0.8).g;
  }

  birdCall(t, kind) {
    const ctx = this.ctx;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    if (pan.pan) pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(this.amb);
    const tone = (s, f0, f1, dur, vol, type = 'sine') => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, s);
      o.frequency.exponentialRampToValueAtTime(f1, s + dur);
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(vol, s + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
      o.connect(g).connect(pan);
      o.start(s); o.stop(s + dur + 0.02);
    };
    if (kind === 0) { // chirps
      const base = 2200 + Math.random() * 1600;
      for (let i = 0; i < 3; i++) tone(t + i * 0.13, base, base * 1.35, 0.09, 0.05);
    } else if (kind === 1) { // two-note whistle (a boubou's duet)
      tone(t, 1300, 1250, 0.22, 0.05); tone(t + 0.28, 1750, 1700, 0.18, 0.045);
    } else if (kind === 2) { // descending trill
      for (let i = 0; i < 7; i++) tone(t + i * 0.055, 3600 - i * 180, 3300 - i * 180, 0.045, 0.035);
    } else if (kind === 3) { // dove coo
      tone(t, 520, 480, 0.3, 0.05, 'triangle'); tone(t + 0.4, 560, 500, 0.45, 0.05, 'triangle');
    } else if (kind === 4) { // frog croak
      for (let i = 0; i < 3; i++) tone(t + i * 0.12, 180, 150, 0.08, 0.08, 'sawtooth');
    } else if (kind === 5) { // gull
      tone(t, 1500, 1100, 0.25, 0.04, 'triangle'); tone(t + 0.3, 1450, 1000, 0.3, 0.035, 'triangle');
    }
  }

  // ---------------- instruments that stay oscillator-based ----------------
  env(g, t, a, peak, dec, sus = 0.0001) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t + a + dec);
  }

  flute(midi, t, dur, vel = 1) {
    const ctx = this.ctx, f = NOTE(midi);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.2;
    const vg = ctx.createGain();
    vg.gain.setValueAtTime(0, t);
    vg.gain.linearRampToValueAtTime(f * 0.012, t + dur * 0.6);
    vib.connect(vg).connect(o.frequency);
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = f * 2;
    const h = ctx.createGain(); h.gain.value = 0.08;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.13 * vel, t + 0.09);
    g.gain.setValueAtTime(0.11 * vel, t + Math.max(0.1, dur - 0.1));
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.25);
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 3;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.05 * vel, t);
    ng.gain.exponentialRampToValueAtTime(0.004, t + 0.2);
    n.connect(bp).connect(ng).connect(g);
    o.connect(g); o2.connect(h).connect(g);
    g.connect(this.mbus);
    const send = ctx.createGain(); send.gain.value = 0.6;
    g.connect(send).connect(this.verbIn);
    const end = t + dur + 0.3;
    for (const x of [o, o2, vib]) { x.start(t); x.stop(end); }
    n.start(t, Math.random()); n.stop(end);
  }

  pad(midis, t, dur, bright = 0.5, vel = 1) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(300 + bright * 900, t);
    lp.frequency.linearRampToValueAtTime(420 + bright * 1300, t + dur * 0.5);
    lp.frequency.linearRampToValueAtTime(300 + bright * 900, t + dur);
    lp.Q.value = 0.6;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.045 * vel, t + dur * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.4);
    for (const m of midis) {
      for (const det of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = NOTE(m);
        o.detune.value = det;
        o.connect(lp);
        o.start(t);
        o.stop(t + dur + 0.5);
      }
    }
    lp.connect(g).connect(this.mbus);
    const send = ctx.createGain(); send.gain.value = 0.5;
    g.connect(send).connect(this.verbIn);
  }

  bass(midi, t, dur, vel = 1) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(), o2 = ctx.createOscillator();
    o.type = 'sine'; o2.type = 'triangle';
    o.frequency.value = NOTE(midi); o2.frequency.value = NOTE(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3 * vel, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const g2 = ctx.createGain(); g2.gain.value = 0.25;
    o.connect(g); o2.connect(g2).connect(g);
    g.connect(this.mbus);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }

  noiseHit(t, freq, q, dec, vel, dest = this.sfx, type = 'bandpass', rate = 1) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    s.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t, 0.002, vel, dec);
    s.connect(f).connect(g).connect(dest);
    s.start(t, Math.random() * 1.5);
    s.stop(t + dec + 0.05);
    return f;
  }

  chant(t, dur, vel) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.09 * vel, t + dur * 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const forms = [[700, 8, 1], [1220, 10, 0.5], [2600, 12, 0.25]];
    for (const [m, det] of [[D3, -8], [D3 + 7, 8], [D3 - 12, 0]]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = NOTE(m);
      o.detune.value = det;
      for (const [ff, q, a] of forms) {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = q;
        const ag = ctx.createGain(); ag.gain.value = a;
        o.connect(bp).connect(ag).connect(g);
      }
      o.start(t); o.stop(t + dur + 0.1);
    }
    g.connect(this.mbus);
    const send = ctx.createGain(); send.gain.value = 0.7;
    g.connect(send).connect(this.verbIn);
  }

  // ---------------- sequencer ----------------
  update(dt) {
    if (!this.ctx || !this.playing) return;
    const ctx = this.ctx;
    for (let k = 0; k < 3 && this.warm.length; k++) { const [i, m] = this.warm.shift(); this.note(i, m); }
    const I = this.menu ? 0 : this.intensity;
    const base = { desert: 80, highland: 76, ash: 72, wetland: 84, woodland: 92, title: 90, night: 80 }[this.theme] || 88;
    const want = I >= 3 ? 108 : base + (I >= 2 ? 6 : 0);
    this.tempo += (want - this.tempo) * Math.min(1, dt * 0.8);
    const spb = 60 / this.tempo / 4;
    while (this.nextTime < ctx.currentTime + 0.15) {
      this.schedule(this.step, this.nextTime, spb);
      this.nextTime += spb;
      this.step++;
    }
    const t = ctx.currentTime;
    const night = this.menu ? 0.1 : this.night;
    this.cricketG.gain.setTargetAtTime(night * 0.012 * (this.biome === 3 ? 0.3 : 1), t, 1);
    this.rainG.gain.setTargetAtTime(this.rain * 0.35, t, 0.8);
    this.wind.gain.setTargetAtTime(0.1 + this.rain * 0.12 + (this.dust || 0) * 0.35 + (this.biome === 4 ? 0.06 : 0), t, 1);
    this.windF.frequency.setTargetAtTime(380 + (this.dust || 0) * 500, t, 1);
    this.surfG.gain.setTargetAtTime(this.coast * 0.3, t, 1.5);
    this.fireG.gain.setTargetAtTime(this.fire * 0.35, t, 0.6);
    if (this.fire > 0.1 && Math.random() < dt * 14 * this.fire) this.noiseHit(t, 2500 + Math.random() * 3000, 3, 0.02, 0.2 * this.fire, this.amb);
    if (!this.menu && t - this.lastBird > 2.2 && Math.random() < dt * 0.4 * (1 - this.rain)) {
      this.lastBird = t;
      let kind;
      if (this.night > 0.5) { if (this.biome === 2 || this.biome === 1) kind = 4; else return; }
      else if (this.biome === 6) kind = Math.random() < 0.6 ? 5 : 0;
      else if (this.biome === 1) kind = [0, 1, 2, 3][Math.floor(Math.random() * 4)];
      else if (this.biome === 2) kind = Math.random() < 0.5 ? 4 : 2;
      else if (this.biome === 3 || this.biome === 5) { if (Math.random() < 0.7) return; kind = 3; }
      else kind = [0, 1, 3][Math.floor(Math.random() * 3)];
      this.birdCall(t + 0.05, kind);
    }
  }

  pickTheme() {
    if (this.menu) return 'title';
    if (this.intensity >= 3) return 'chase';
    if (this.night > 0.5) return 'night';
    return BIOME_THEME[this.biome] || 'savanna';
  }

  schedule(step, t, spb) {
    const s16 = step % 16;
    const bar = Math.floor(step / 16);
    // themes change on four-bar lines (a chase cuts in on the next bar)
    if (s16 === 0) {
      const want = this.pickTheme();
      if (want !== this.theme && (bar % 4 === 0 || want === 'chase' || this.theme === 'chase')) {
        this.theme = want;
        this.themeBar = bar;
      }
      if (bar % 8 === 0) this.section = Math.random() < 0.5 ? 'A' : 'B';
    }
    const phrase = (bar - (this.themeBar || 0)) % 8;
    const I = this.menu ? 0 : this.intensity;
    const th = this.theme;
    const prog = th === 'desert' ? PROG_DESERT : th === 'ash' ? PROG_ASH : PROG;
    const chord = prog[bar % 4];
    const pad = (bright, vel) => { if (s16 === 0) this.pad(chord.tones, t, spb * 16, bright, vel); };
    const melody = (bars, fn) => { for (const [st, m, len] of bars[phrase % bars.length]) if (st === s16) fn(m, len); };

    switch (th) {
      case 'title': {
        pad(0.35, 1);
        if (s16 === 0) this.bass(chord.root, t, spb * 8, 0.8);
        if (s16 === 8) this.bass(chord.root + 7, t, spb * 6, 0.5);
        const arp = [chord.tones[0], chord.tones[2], chord.tones[1] + 12, chord.tones[2], chord.tones[0] + 12, chord.tones[2], chord.tones[1] + 12, chord.tones[2]];
        if (s16 % 2 === 0) this.inst('kora', arp[(s16 / 2) % 8] - 12, t, 0.6, -0.3);
        const ph8 = (bar - (this.themeBar || 0)) % 16;
        if (ph8 >= 4) for (const [st, m, len] of TITLE_THEME[ph8 % 8]) if (st === s16) (ph8 >= 12 ? this.flute(m, t, len * spb, 0.8) : this.inst('kalimba', m, t, 0.9, 0.2));
        if (ph8 >= 8) {
          if (s16 === 0 || s16 === 10) this.hit('bass', t, 0.7);
          if (s16 === 4 || s16 === 12) this.hit('tone', t, 0.4);
          if (s16 % 2 === 1) this.hit('shaker', t, 0.18);
        }
        break;
      }
      case 'savanna':
      case 'coast': {
        pad(th === 'coast' ? 0.25 : 0.35, 1);
        if (s16 === 0) this.bass(chord.root, t, spb * 6, 0.8);
        if (s16 === 10 && I >= 1) this.bass(chord.root, t, spb * 4, 0.6);
        // kora ostinato
        const ost = [0, 3, 6, 8, 11, 14];
        const notes = [chord.tones[0], chord.tones[2], chord.tones[1] + 12, chord.tones[2] + 12, chord.tones[1] + 12, chord.tones[2]];
        const oi = ost.indexOf(s16);
        if (oi >= 0 && (th === 'savanna' || s16 % 6 === 0)) this.inst('kora', notes[oi] - 12, t, 0.55, -0.25);
        if (I < 3) melody(this.section === 'A' ? THEME_A : THEME_B, (m, len) => (phrase >= 4 && this.section === 'A' ? this.flute(m, t, len * spb, 0.7) : this.inst('kalimba', m, t, 0.9, 0.2)));
        break;
      }
      case 'woodland': {
        pad(0.3, 0.8);
        if (s16 === 0) this.bass(chord.root, t, spb * 6, 0.7);
        // two interlocking marimba voices (amadinda style)
        const pent = [62, 65, 67, 69, 72, 74, 77];
        const v1 = [0, 2, 4, 2, 5, 4, 2, 1], v2 = [4, 6, 5, 3, 6, 4, 3, 5];
        if (s16 % 2 === 0) this.inst('marimba', pent[v1[(s16 / 2 + bar) % 8]], t, 0.7, -0.3);
        else if (phrase % 2 === 1 || I >= 1) this.inst('marimba', pent[v2[((s16 - 1) / 2 + bar) % 8]], t, 0.45, 0.3);
        if (phrase >= 4) melody(THEME_B, (m, len) => this.flute(m, t, len * spb, 0.6));
        break;
      }
      case 'wetland': {
        pad(0.2, 0.9);
        if (s16 === 0) this.bass(chord.root - 12 + 12, t, spb * 10, 0.6);
        // mbira in threes against the four
        const cyc = [chord.tones[0], chord.tones[1], chord.tones[2] + 12, chord.tones[1] + 12, chord.tones[2], chord.tones[0] + 12];
        if (s16 % 3 === 0) this.inst('mbira', cyc[(step / 3 | 0) % cyc.length] - 12, t, 0.6, 0.15);
        if (Math.random() < 0.06) this.inst('kora', 81 + [0, 3, 5, 7][Math.floor(Math.random() * 4)], t, 0.2, Math.random() - 0.5);
        break;
      }
      case 'desert': {
        if (s16 === 0 && bar % 2 === 0) this.pad([D2 + 12, D2 + 19], t, spb * 32, 0.15, 1.1);
        if (s16 === 0 || s16 === 10) this.hit('bass', t, 0.55);
        if (s16 === 7 && bar % 2 === 1) this.hit('tone', t, 0.3);
        melody(DESERT_THEME, (m, len) => this.flute(m, t, len * spb, 0.85));
        if (s16 === 12 && Math.random() < 0.5) this.inst('kora', chord.tones[0] - 12, t, 0.4);
        break;
      }
      case 'highland': {
        if (s16 === 0 && bar % 2 === 0) this.pad([D2 + 12, D2 + 19, D2 + 24], t, spb * 32, 0.2, 1);
        if (s16 % 4 === 0) this.inst('kora', [chord.tones[0], chord.tones[2], chord.tones[1] + 12, chord.tones[2]][s16 / 4] - 12, t, 0.45, -0.2);
        melody(HIGH_THEME, (m, len) => this.flute(m + 12, t, len * spb, 0.7));
        break;
      }
      case 'ash': {
        if (s16 === 0) this.pad(chord.tones.map((m) => m - 12), t, spb * 16, 0.12, 1.1);
        if (s16 === 0 || s16 === 6) this.hit('heart', t, 0.8);
        if (s16 === 8 && Math.random() < 0.6) this.inst('marimba', chord.tones[Math.floor(Math.random() * 3)] - 12, t, 0.5);
        break;
      }
      case 'night': {
        if (s16 === 0) this.pad(chord.tones, t, spb * 16, 0.08, 0.8);
        melody(NIGHT_THEME, (m, len) => this.flute(m, t, len * spb, 0.8));
        if ((s16 === 4 || s16 === 12) && Math.random() < 0.5) this.inst('kora', chord.tones[Math.floor(Math.random() * 3)], t, 0.3, Math.random() - 0.5);
        break;
      }
      case 'chase': {
        // the band's war groove
        if ([0, 6, 8, 11].includes(s16)) this.hit('bass', t, 0.95);
        if ([2, 4, 10, 14].includes(s16)) this.hit('tone', t, 0.55, 1, -0.2);
        if ([3, 7, 12, 15].includes(s16)) this.hit('slap', t, 0.5, 1, 0.25);
        this.hit('shaker', t, s16 % 2 ? 0.16 : 0.26);
        if (bar % 4 === 3 && s16 >= 8 && s16 % 2 === 0) this.hit('talk', t, 0.6, 1 + (s16 - 8) * 0.03);
        if (s16 % 2 === 0) this.bass(chord.root, t, spb * 1.8, 0.6);
        if (s16 === 0 && bar % 2 === 0) this.chant(t, spb * 30, 1);
        const riff = [62, 0, 65, 62, 0, 67, 0, 69, 72, 0, 69, 0, 67, 0, 65, 0];
        if (riff[s16]) this.inst('kora', riff[s16] + (bar % 4 === 2 ? -2 : 0), t, 0.55, 0.2);
        break;
      }
    }

    // the band's drums creep into every theme as they close in
    if (th !== 'chase' && th !== 'title') {
      if (I >= 1 && (s16 === 0 || s16 === 6)) this.hit('bass', t, 0.5);
      if (I >= 2) {
        if (s16 === 8 || s16 === 11) this.hit('tone', t, 0.35);
        if (s16 % 4 === 2) this.hit('shaker', t, 0.15);
      }
    }
  }

  // ---------------- one-shots ----------------
  sting(kind) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.02;
    const spb = 60 / this.tempo / 4;
    if (kind === 'dawn') {
      [[62, 0], [69, 2], [74, 4], [72, 8], [74, 10]].forEach(([m, s]) => this.flute(m, t + s * spb, spb * 5, 1));
      [50, 57, 62].forEach((m, i) => this.inst('kora', m, t + i * 0.06, 0.7));
    } else if (kind === 'dusk') {
      [[74, 0], [72, 3], [69, 6], [65, 10]].forEach(([m, s]) => this.flute(m, t + s * spb, spb * 5, 0.8));
    } else if (kind === 'death') {
      this.hit('bass', t, 1.2, 0.7);
      this.pad([50, 53, 57], t + 0.1, 3.5, 0.1, 1.4);
      [[69, 0], [67, 4], [65, 8], [62, 14]].forEach(([m, s]) => this.flute(m, t + 0.4 + s * spb * 1.5, spb * 7, 0.9));
    } else if (kind === 'start') {
      this.hit('bass', t, 1); this.hit('bass', t + spb * 3, 0.9); this.hit('talk', t + spb * 6, 0.8);
      this.chant(t, 2.2, 0.8);
    } else if (kind === 'secret') {
      [74, 78, 81, 86].forEach((m, i) => this.inst('kalimba', m, t + i * 0.09, 0.9));
      this.pad([62, 66, 69], t, 2.5, 0.4, 1);
    } else if (kind === 'perk') {
      [62, 69, 74, 77].forEach((m, i) => this.inst('kora', m, t + i * 0.07, 0.8));
    }
  }

  play(name, opts = {}) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.005;
    const v = opts.vol ?? 1;
    const S = this.sfx;
    const K = this.kit;
    switch (name) {
      case 'step': {
        const g = opts.g;
        const set = opts.water ? K.step.water : g === 6 || g === 15 ? K.step.rock : g === 3 || g === 10 || g === 11 || g === 12 || g === 9 ? K.step.sand
          : g === 14 ? K.step.leaf : g === 5 ? K.step.mud : K.step.grass;
        this.playBuf(set[Math.floor(Math.random() * 3)], t, 0.35 * v, { dest: S, rate: 0.9 + Math.random() * 0.2, verb: 0 });
        break;
      }
      case 'pounce': {
        const f = this.noiseHit(t, 600, 0.7, 0.25, 0.4 * v, S, 'bandpass');
        f.frequency.exponentialRampToValueAtTime(2400, t + 0.2);
        this.growl(t, 0.35, 0.8 * v);
        break;
      }
      case 'kill': this.playBuf(K.bass, t, 0.6 * v, { dest: S, rate: 0.8, verb: 0.1 }); this.squeal(t + 0.02, 0.18); break;
      case 'eat': for (let i = 0; i < 3; i++) this.noiseHit(t + i * 0.11, 500 + Math.random() * 300, 2, 0.06, 0.35 * v, S, 'bandpass', 0.6); break;
      case 'drink':
        for (let i = 0; i < 3; i++) {
          const f = this.noiseHit(t + i * 0.13, 700, 5, 0.07, 0.3 * v, S, 'bandpass');
          f.frequency.exponentialRampToValueAtTime(1500, t + i * 0.13 + 0.06);
        }
        break;
      case 'splash': { const f = this.noiseHit(t, 2500, 0.6, 0.35, 0.45 * v, S, 'lowpass'); f.frequency.exponentialRampToValueAtTime(400, t + 0.3); break; }
      case 'throw': { const f = this.noiseHit(t, 400, 0.8, 0.35, 1.8 * v, S, 'bandpass'); f.frequency.exponentialRampToValueAtTime(2200, t + 0.3); break; }
      case 'windup': this.shout(t, 0.9 * v, 1.2); break;
      case 'hit': this.playBuf(K.bass, t, 0.8 * v, { dest: S, rate: 0.75, verb: 0.1 }); this.growl(t + 0.03, 0.4, 1.1 * v, true); break;
      case 'thunk': this.playBuf(K.tone, t, 0.7 * v, { dest: S, rate: 1.4, verb: 0.05 }); break;
      case 'dodge': {
        const f = this.noiseHit(t, 3000, 3, 0.18, 0.25 * v, S, 'bandpass');
        f.frequency.exponentialRampToValueAtTime(900, t + 0.18);
        this.bell(t + 0.08, 88, 0.12);
        break;
      }
      case 'shout': this.shout(t, v, 1); break;
      case 'sighted': this.shout(t, v, 1); this.shout(t + 0.18, v * 0.7, 0.85); this.playBuf(K.bass, t, 0.9 * v, { dest: S, verb: 0.3 }); break;
      case 'bark':
        for (let i = 0; i < 2; i++) {
          const o = ctx.createOscillator();
          o.type = 'square';
          const s = t + i * 0.16;
          o.frequency.setValueAtTime(420, s);
          o.frequency.exponentialRampToValueAtTime(220, s + 0.09);
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 2;
          const g = ctx.createGain();
          this.env(g, s, 0.005, 0.25 * v, 0.1);
          o.connect(bp).connect(g).connect(S);
          o.start(s); o.stop(s + 0.14);
        }
        break;
      case 'yelp': this.squeal(t, 0.12, 900); break;
      case 'knockdown': this.playBuf(K.bass, t, 0.9 * v, { dest: S, rate: 0.9, verb: 0.2 }); this.shout(t + 0.05, 0.8 * v, 0.7); break;
      case 'trail': [74, 78, 81].forEach((m, i) => this.bell(t + i * 0.07, m, 0.14)); break;
      case 'score': this.bell(t, 86 + (opts.pitch || 0), 0.08); break;
      case 'overheat': {
        const f = this.noiseHit(t, 5000, 0.5, 0.8, 0.25 * v, S, 'highpass');
        f.frequency.linearRampToValueAtTime(2000, t + 0.7);
        this.growl(t, 0.6, 0.5, false, 0.5);
        break;
      }
      case 'pant': this.noiseHit(t, 1400, 1.2, 0.14, 0.5 * v, S, 'bandpass', 0.7); break;
      case 'heart': this.playBuf(K.heart, t, 0.6 * v, { dest: S, verb: 0 }); this.playBuf(K.heart, t + 0.2, 0.4 * v, { dest: S, verb: 0 }); break;
      case 'roar': this.growl(t, 1.2, 1.4 * v, true, 0.45); this.noiseHit(t, 300, 0.8, 1.1, 0.5 * v, S, 'lowpass', 0.5); break;
      case 'ui': this.bell(t, opts.pitch || 81, 0.06); break;
      case 'thunder': { const f = this.noiseHit(t, 300, 0.5, 2.2, 0.8 * v, S, 'lowpass', 0.5); f.frequency.exponentialRampToValueAtTime(80, t + 2); break; }
      case 'snarl': this.growl(t, 0.25, 0.7 * v, false, 1.4); break;
      case 'rumble': {
        const f = this.noiseHit(t, 180, 0.7, 3.2, 0.9 * v, S, 'lowpass', 0.4);
        f.frequency.linearRampToValueAtTime(320, t + 2);
        for (let i = 0; i < 14; i++) this.playBuf(K.bass, t + 0.4 + i * 0.17 + Math.random() * 0.06, 0.3 * v, { dest: S, rate: 0.7 + Math.random() * 0.2, verb: 0 });
        break;
      }
      case 'laugh':
        for (let i = 0; i < 5; i++) {
          const o = ctx.createOscillator();
          o.type = 'triangle';
          const s = t + i * 0.11;
          o.frequency.setValueAtTime(700 + i * 40, s);
          o.frequency.linearRampToValueAtTime(1050 + i * 30, s + 0.05);
          o.frequency.linearRampToValueAtTime(650, s + 0.09);
          const g = ctx.createGain();
          this.env(g, s, 0.005, 0.14 * v, 0.08);
          o.connect(g).connect(S);
          o.start(s); o.stop(s + 0.11);
        }
        break;
      case 'snap': this.noiseHit(t, 2500, 1, 0.05, 0.7 * v, S, 'bandpass'); this.playBuf(K.tone, t, 0.5 * v, { dest: S, rate: 1.6, verb: 0 }); break;
      case 'secret': this.sting('secret'); break;
      case 'perk': this.sting('perk'); break;
    }
  }

  bell(t, midi, vel) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(), o2 = ctx.createOscillator();
    o.frequency.value = NOTE(midi);
    o2.frequency.value = NOTE(midi) * 2.76;
    const g = ctx.createGain();
    this.env(g, t, 0.003, vel, 0.6);
    const g2 = ctx.createGain(); g2.gain.value = 0.25;
    o.connect(g); o2.connect(g2).connect(g);
    g.connect(this.sfx);
    o.start(t); o2.start(t); o.stop(t + 0.7); o2.stop(t + 0.7);
  }

  growl(t, dur, vel, hurt = false, pitch = 1) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const base = (hurt ? 120 : 75) * pitch;
    o.frequency.setValueAtTime(base, t);
    o.frequency.linearRampToValueAtTime(base * (hurt ? 1.6 : 1.25), t + dur * 0.3);
    o.frequency.linearRampToValueAtTime(base * 0.8, t + dur);
    const am = ctx.createOscillator();
    am.frequency.value = 32;
    const amg = ctx.createGain(); amg.gain.value = 0.5;
    const g = ctx.createGain();
    am.connect(amg).connect(g.gain);
    const lp = ctx.createBiquadFilter();
    lp.type = 'bandpass'; lp.frequency.value = hurt ? 900 : 500; lp.Q.value = 1.5;
    const eg = ctx.createGain();
    this.env(eg, t, 0.03, 0.55 * vel, dur);
    o.connect(lp).connect(g).connect(eg).connect(this.sfx);
    o.start(t); am.start(t); o.stop(t + dur + 0.1); am.stop(t + dur + 0.1);
    this.noiseHit(t, hurt ? 1400 : 700, 1, dur * 0.8, 0.18 * vel, this.sfx, 'bandpass', 0.5);
  }

  squeal(t, dur, f0 = 1400) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.5, t + dur);
    const g = ctx.createGain();
    this.env(g, t, 0.005, 0.4, dur);
    o.connect(g).connect(this.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }

  shout(t, vel, pitch) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const f = (150 + Math.random() * 40) * pitch;
    o.frequency.setValueAtTime(f * 1.25, t);
    o.frequency.linearRampToValueAtTime(f, t + 0.25);
    const g = ctx.createGain();
    this.env(g, t, 0.02, 2.4 * vel, 0.3);
    for (const [a, b, q] of [[600, 850, 6], [1000, 1250, 8]]) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.Q.value = q;
      bp.frequency.setValueAtTime(a, t);
      bp.frequency.linearRampToValueAtTime(b, t + 0.12);
      o.connect(bp).connect(g);
    }
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    if (pan.pan) pan.pan.value = Math.random() * 0.6 - 0.3;
    g.connect(pan).connect(this.sfx);
    const send = ctx.createGain(); send.gain.value = 0.5;
    g.connect(send).connect(this.verbIn);
    o.start(t); o.stop(t + 0.4);
  }
}

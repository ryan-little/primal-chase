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
// alternate harmony under the same tunes: Dm F Gm C, and a lifting Bb C Dm Am
const PROG_ALT = [
  { root: 50, tones: [62, 65, 69] },
  { root: 53, tones: [60, 65, 69] },
  { root: 55, tones: [62, 67, 70] },
  { root: 48, tones: [60, 64, 67] },
];
const PROG_LIFT = [
  { root: 46, tones: [58, 62, 65] },
  { root: 48, tones: [60, 64, 67] },
  { root: 50, tones: [62, 65, 69] },
  { root: 45, tones: [57, 60, 64] },
];
// Theme C: a call-and-response tune for the open country (D dorian, the B natural is the lift)
const THEME_C = [
  [[0, 69, 2], [2, 72, 2], [4, 74, 3], [7, 72, 1], [8, 69, 4], [12, 67, 4]],
  [[0, 65, 2], [2, 67, 2], [4, 69, 6], [10, 72, 2], [12, 71, 4]],
  [[0, 74, 2], [2, 76, 2], [4, 77, 4], [8, 76, 2], [10, 74, 2], [12, 72, 4]],
  [[0, 69, 3], [3, 67, 3], [6, 65, 2], [8, 62, 8]],
];
const WOOD_THEME = [
  [[0, 74, 2], [2, 77, 2], [4, 74, 2], [6, 72, 2], [8, 69, 4], [12, 72, 4]],
  [[0, 74, 2], [2, 77, 2], [4, 79, 4], [8, 77, 2], [10, 74, 6]],
  [[0, 81, 2], [2, 79, 2], [4, 77, 2], [6, 74, 2], [8, 72, 4], [12, 74, 4]],
  [[0, 69, 2], [2, 72, 2], [4, 74, 12]],
];
const WET_THEME = [
  [[0, 62, 8], [8, 65, 4], [12, 64, 4]],
  [[0, 60, 12], [12, 62, 4]],
  [[0, 65, 6], [6, 67, 2], [8, 69, 8]],
  [[0, 67, 4], [4, 65, 4], [8, 64, 8]],
];
const DESERT_THEME_2 = [
  [[0, 62, 2], [2, 63, 2], [4, 66, 4], [8, 67, 2], [10, 66, 2], [12, 63, 4]],
  [[0, 63, 2], [2, 66, 2], [4, 67, 2], [6, 69, 2], [8, 70, 6], [14, 69, 2]],
  [[0, 66, 3], [3, 67, 3], [6, 69, 2], [8, 70, 2], [10, 72, 2], [12, 70, 4]],
  [[0, 69, 2], [2, 67, 2], [4, 66, 4], [8, 63, 4], [12, 62, 4]],
];
const HIGH_THEME_2 = [
  [[0, 69, 6], [6, 67, 2], [8, 65, 4], [12, 67, 4]],
  [[0, 64, 8], [8, 67, 8]],
  [[0, 65, 4], [4, 62, 4], [8, 58, 8]],
  [[0, 60, 4], [4, 62, 4], [8, 64, 8]],
];
const ASH_THEME = [
  [[0, 62, 8], [8, 63, 8]],
  [[0, 61, 12], [12, 64, 4]],
  [[0, 62, 6], [6, 65, 2], [8, 68, 8]],
  [[0, 65, 8], [8, 61, 8]],
];
// night: an mbira lullaby, and high kalimba "stars"
const NIGHT_THEME_2 = [
  [[0, 74, 4], [4, 72, 4], [8, 69, 4], [12, 72, 4]],
  [[0, 72, 4], [4, 67, 4], [8, 64, 8]],
  [[0, 70, 4], [4, 69, 4], [8, 65, 4], [12, 62, 4]],
  [[0, 64, 6], [6, 67, 2], [8, 72, 8]],
];
const NIGHT_THEME_3 = [
  [[0, 86, 2], [6, 81, 2], [12, 84, 2]],
  [[2, 79, 2], [8, 84, 2]],
  [[0, 82, 2], [4, 81, 2], [10, 77, 2]],
  [[0, 76, 2], [8, 79, 2], [12, 81, 4]],
];
// chase: three riffs and two grooves
const RIFFS = [
  [62, 0, 65, 62, 0, 67, 0, 69, 72, 0, 69, 0, 67, 0, 65, 0],
  [62, 0, 62, 65, 0, 62, 67, 0, 69, 0, 72, 69, 0, 67, 0, 0],
  [74, 0, 72, 0, 69, 0, 67, 69, 0, 65, 0, 67, 0, 62, 0, 0],
];
const GROOVES = [
  { bass: [0, 6, 8, 11], tone: [2, 4, 10, 14], slap: [3, 7, 12, 15] },
  { bass: [0, 3, 8, 10], tone: [4, 6, 12, 14], slap: [2, 7, 11, 15] },
];
// How many arrangements each theme has; a new one is drawn every eight bars.
const VARIANTS = { savanna: 4, coast: 4, woodland: 3, wetland: 3, desert: 3, highland: 3, ash: 3, night: 3, chase: 3, title: 1 };
const LEADS = { savanna: ['kalimba', 'flute', 'marimba'], coast: ['kalimba', 'flute'], woodland: ['flute', 'kalimba'], wetland: ['flute', 'mbira'], desert: ['flute', 'kora'], highland: ['flute', 'kalimba'], ash: ['flute'], night: ['flute'], chase: ['kora'], title: ['kalimba'] };
const PROGS = { savanna: [PROG, PROG, PROG_ALT, PROG_LIFT], coast: [PROG, PROG_LIFT], woodland: [PROG, PROG_ALT], wetland: [PROG, PROG_ALT], highland: [PROG, PROG_LIFT], night: [PROG, PROG_ALT] };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
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
    // weather beds (set each frame by the game; storm/heat/fog are 0..1)
    this.dust = 0;
    this.heat = 0;
    this.fog = 0;
    this.storm = 0;
    this.wxOn = {};
    // the arrangement currently playing: variant, lead voice, harmony, key offset, tempo nudge
    this.sec = { v: 0, lead: 'kalimba', prog: PROG, xp: 0, dt: 0, alt: false };
    this.secN = 0;
    this.last = {}; // round-robin memory per sound
    this.log = null; // set to [] to record arrangement changes (tools/audio.html)
  }

  // A random index in [0, n) that never repeats the previous pick for this key.
  rr(key, n) {
    let i = Math.floor(Math.random() * n);
    if (n > 1 && i === this.last[key]) i = (i + 1 + Math.floor(Math.random() * (n - 1))) % n;
    this.last[key] = i;
    return i;
  }
  jit(a, b) { return a + Math.random() * (b - a); }

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
    // weather colours the band too: fog and dust close the top end
    this.wx = ctx.createBiquadFilter();
    this.wx.type = 'lowpass';
    this.wx.frequency.value = Math.min(18000, ctx.sampleRate / 2 - 100);
    this.mbus.connect(this.wx).connect(this.music);

    this.buildKit();
    this.startAmbience();
    // render instrument notes a few per frame instead of on first use
    this.warm = [];
    // (ranges cover the key changes, up a fourth or down a tone)
    for (let m = 44; m <= 81; m++) this.warm.push(['kora', m]);
    for (let m = 60; m <= 93; m++) this.warm.push(['kalimba', m]);
    for (let m = 48; m <= 86; m++) this.warm.push(['marimba', m]);
    for (let m = 36; m <= 81; m++) this.warm.push(['mbira', m]);
    for (let m = 36; m <= 43; m++) this.warm.push(['kora', m]);
    for (let m = 82; m <= 93; m++) this.warm.push(['kora', m]);
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
    // footsteps, five takes each (picked round-robin, then pitched and levelled at random)
    const takes = (fn) => [0, 1, 2, 3, 4].map(() => this.buf(fn()));
    K.step = {
      grass: takes(() => noiseHitBuf(sr, 0.06 + Math.random() * 0.025, 'bp', 2400 + Math.random() * 1600, 0.9, 0.008 + Math.random() * 0.008, 2)),
      sand: takes(() => { const b = noiseHitBuf(sr, 0.08 + Math.random() * 0.03, 'bp', 850 + Math.random() * 400, 1.2, 0.004, 1.5); for (let i = 0; i < b.length; i++) b[i] *= Math.random() < 0.4 ? 1.4 : 0.5; return normalize(b, 0.7); }),
      rock: takes(() => drum(sr, 1800 + Math.random() * 600, 1300 + Math.random() * 200, 0.03, 0.4, 3000 + Math.random() * 1000)),
      water: takes(() => noiseHitBuf(sr, 0.14 + Math.random() * 0.05, 'lp', 1400 + Math.random() * 800, 0.8, 0.01, 1.2)),
      leaf: takes(() => { const len = Math.floor(sr * 0.1), o = new Float32Array(len); for (let k = 0; k < 5 + Math.floor(Math.random() * 3); k++) { const at = Math.floor(Math.random() * len * 0.8); for (let i = 0; i < 90 && at + i < len; i++) o[at + i] += (Math.random() * 2 - 1) * (1 - i / 90); } return normalize(biquad(o, sr, 'hp', 1500, 0.7), 0.7); }),
      mud: takes(() => noiseHitBuf(sr, 0.12 + Math.random() * 0.04, 'bp', 300 + Math.random() * 110, 4, 0.01, 1)),
    };
    // claws on rock, for climbing and scrambling
    K.scrape = [0, 1, 2, 3].map(() => this.buf((() => {
      const len = Math.floor(sr * 0.06), o = new Float32Array(len);
      for (let k = 0; k < 3; k++) { const at = Math.floor(Math.random() * len * 0.5); for (let i = 0; i < 160 && at + i < len; i++) o[at + i] += (Math.random() * 2 - 1) * Math.pow(1 - i / 160, 2); }
      return normalize(biquad(o, sr, 'bp', 3200 + Math.random() * 1800, 1.4), 0.7);
    })()));
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

    // storm: a low roll that never quite stops
    const storm = this.loopNoise('lowpass', 110, 0.9, 0, 0.35);
    this.stormG = storm.g;
    const roll = ctx.createOscillator();
    roll.frequency.value = 0.045;
    const rollG = ctx.createGain();
    rollG.gain.value = 50;
    roll.connect(rollG).connect(storm.f.frequency);
    roll.start();
    // dust: grit hiss riding the wind
    this.gritG = this.loopNoise('highpass', 4200, 0.7, 0, 1.3).g;
    // heatwave: cicadas, a buzzing band of noise pulsed fast and swelling slowly
    {
      const src = ctx.createBufferSource();
      src.buffer = this.noise; src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 5600; bp.Q.value = 5;
      const am = ctx.createGain(); am.gain.value = 0.5;
      const buzz = ctx.createOscillator(); buzz.type = 'square'; buzz.frequency.value = 42;
      const bz = ctx.createGain(); bz.gain.value = 0.5;
      buzz.connect(bz).connect(am.gain);
      const sw = ctx.createGain(); sw.gain.value = 0.6;
      const swell = ctx.createOscillator(); swell.frequency.value = 0.16;
      const swg = ctx.createGain(); swg.gain.value = 0.4;
      swell.connect(swg).connect(sw.gain);
      this.cicadaG = ctx.createGain(); this.cicadaG.gain.value = 0;
      src.connect(bp).connect(am).connect(sw).connect(this.cicadaG).connect(this.amb);
      src.start(); buzz.start(); swell.start();
    }
    // fog: a soft low drone that beats slowly against itself
    this.fogG = ctx.createGain(); this.fogG.gain.value = 0;
    const fogLp = ctx.createBiquadFilter(); fogLp.type = 'lowpass'; fogLp.frequency.value = 300;
    for (const [f, type] of [[73.4, 'sine'], [73.75, 'sine'], [110.2, 'triangle']]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = type === 'sine' ? 0.5 : 0.25;
      o.connect(g).connect(fogLp); o.start();
    }
    fogLp.connect(this.fogG).connect(this.amb);
  }

  // A gust through the dust: a resonant whistle that swells and falls away.
  gust(t) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 9;
    const f0 = 450 + Math.random() * 400, dur = 1.4 + Math.random() * 1.2;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.linearRampToValueAtTime(f0 * (1.8 + Math.random() * 0.8), t + dur * 0.45);
    f.frequency.linearRampToValueAtTime(f0 * 1.1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.35, t + dur * 0.45);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    if (pan.pan) { pan.pan.setValueAtTime(Math.random() - 0.5, t); pan.pan.linearRampToValueAtTime(Math.random() - 0.5, t + dur); }
    s.connect(f).connect(g).connect(pan).connect(this.amb);
    s.start(t, Math.random() * 1.2); s.stop(t + dur + 0.05);
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
    } else if (kind === 6) { // nightjar churr: a long purring trill
      const n = 14 + Math.floor(Math.random() * 10), f = 900 + Math.random() * 250;
      for (let i = 0; i < n; i++) tone(t + i * 0.035, f, f * 0.93, 0.03, 0.02);
    } else if (kind === 7) { // a hyena's far-off whoop
      const f = 260 + Math.random() * 60;
      for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) tone(t + i * 0.9, f, f * 3.2, 0.7, 0.03, 'triangle');
    } else if (kind === 8) { // owl: hoo, hoo-hoo
      const f = 360 + Math.random() * 60;
      tone(t, f, f * 0.94, 0.35, 0.045); tone(t + 0.6, f * 1.03, f * 0.95, 0.2, 0.035); tone(t + 0.85, f, f * 0.93, 0.3, 0.04);
    } else if (kind === 9) { // ground hornbill: a deep booming duet
      const f = 150 + Math.random() * 30;
      for (let i = 0; i < 4; i++) tone(t + i * 0.32 + (i > 1 ? 0.25 : 0), f * (i % 2 ? 0.85 : 1), f * (i % 2 ? 0.8 : 0.95), 0.22, 0.07, 'triangle');
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
    if (this.warm.length && dt < 0.02) { const [i, m] = this.warm.shift(); this.note(i, m); }
    const I = this.menu ? 0 : this.intensity;
    const base = { desert: 80, highland: 76, ash: 72, wetland: 84, woodland: 92, title: 90, night: 80 }[this.theme] || 88;
    const want = I >= 3 ? 108 + this.sec.dt : base + this.sec.dt + (I >= 2 ? 6 : 0);
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
    // weather beds
    const wxOn = !this.menu;
    const rain = wxOn ? this.rain : 0, dust = wxOn ? this.dust || 0 : 0, heat = wxOn ? this.heat || 0 : 0, fog = wxOn ? this.fog || 0 : 0, storm = wxOn ? this.storm || 0 : 0;
    this.stormG.gain.setTargetAtTime(storm * 0.5, t, 1.5);
    this.gritG.gain.setTargetAtTime(dust * 0.07, t, 1);
    this.cicadaG.gain.setTargetAtTime(heat * (1 - this.night) * 0.4, t, 2);
    this.fogG.gain.setTargetAtTime(fog * 0.05, t, 2);
    const nyq = Math.min(18000, ctx.sampleRate / 2 - 100);
    this.wx.frequency.setTargetAtTime(Math.max(1400, nyq * (1 - 0.8 * fog) * (1 - 0.65 * dust) * (1 - 0.3 * rain)), t, 1.5);
    // rain patter: single drops on leaves and ground
    if (rain > 0.05) {
      const n = Math.min(4, Math.floor(rain * 22 * dt + Math.random()));
      for (let i = 0; i < n; i++) this.noiseHit(t + Math.random() * dt, 2500 + Math.random() * 5000, 4, 0.012 + Math.random() * 0.02, (0.03 + Math.random() * 0.07) * rain, this.amb);
    }
    if (dust > 0.2 && Math.random() < dt * 0.35 * dust) this.gust(t + 0.05);
    this.weatherStings(rain, dust, heat, fog, storm);
    if (!this.menu && t - this.lastBird > 2.2 && Math.random() < dt * 0.4 * (1 - this.rain) * (1 - dust * 0.8)) {
      this.lastBird = t;
      let kind;
      if (fog > 0.4 && Math.random() < 0.5) kind = 9;
      else if (this.night > 0.5) {
        if ((this.biome === 2 || this.biome === 1) && Math.random() < 0.6) kind = 4;
        else if (Math.random() < 0.55) return; // nights are sparser
        else kind = this.biome === 1 ? pick([6, 8, 8]) : this.biome === 5 ? 8 : pick([6, 7, 8]);
      }
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

  // Draw the next eight-bar arrangement for a theme: which tune (variant), which voice carries
  // it, which harmony sits under it, an occasional key change and a small tempo nudge. The
  // variant never repeats back to back, so a long stay in one biome keeps moving.
  newSection(th) {
    const prev = this.sec;
    const fixed = th === 'title' || th === 'chase';
    let xp = 0;
    if (!fixed) {
      if (prev.xp) xp = Math.random() < 0.6 ? 0 : prev.xp;
      else if (this.secN > 1 && Math.random() < 0.22) xp = pick([5, -2]);
    }
    this.sec = {
      th,
      v: th === 'title' ? 0 : this.rr('v' + th, VARIANTS[th] || 1),
      lead: pick(LEADS[th] || ['kalimba']),
      prog: pick(PROGS[th] || [PROG]),
      xp,
      dt: th === 'title' ? 0 : th === 'chase' ? pick([-2, 0, 4]) : pick([-3, 0, 0, 3]),
      alt: Math.random() < 0.5,
    };
    this.secN++;
    if (this.log) this.log.push(`${th}:v${this.sec.v}/${this.sec.lead}/p${[PROG, PROG_ALT, PROG_LIFT].indexOf(this.sec.prog)}/x${xp}/t${this.sec.dt}${this.sec.alt ? '/alt' : ''}`);
  }

  // current key offset (the chase and title always sit in D)
  get key() { return this.theme === 'chase' || this.theme === 'title' ? 0 : this.sec.xp; }

  schedule(step, t, spb) {
    const s16 = step % 16;
    const bar = Math.floor(step / 16);
    // themes change on four-bar lines (a chase cuts in on the next bar); arrangements every eight
    if (s16 === 0) {
      const want = this.pickTheme();
      if (want !== this.theme && (bar % 4 === 0 || want === 'chase' || this.theme === 'chase')) {
        this.theme = want;
        this.themeBar = bar;
        this.newSection(want);
      } else if (bar !== (this.themeBar || 0) && (bar - (this.themeBar || 0)) % 8 === 0) this.newSection(this.theme);
    }
    const phrase = (bar - (this.themeBar || 0)) % 8;
    const I = this.menu ? 0 : this.intensity;
    const th = this.theme;
    const S = this.sec;
    const X = this.key;
    const W = this.menu ? { rain: 0, heat: 0, fog: 0, dust: 0, storm: 0 }
      : { rain: this.rain || 0, heat: this.heat || 0, fog: this.fog || 0, dust: this.dust || 0, storm: this.storm || 0 };
    const prog = th === 'desert' ? PROG_DESERT : th === 'ash' ? PROG_ASH : th === 'title' || th === 'chase' ? PROG : S.prog;
    const chord = prog[bar % 4];
    const ct = chord.tones;
    // everything melodic goes through these so a key change moves the whole band
    const inst = (name, m, vel = 1, pan = 0) => this.inst(name, m + X, t, vel, pan);
    const bass = (m, len, vel) => this.bass(m + X, t, len, vel);
    const pad = (bright, vel) => { if (s16 === 0) this.pad(ct.map((m) => m + X), t, spb * 16, bright * (1 - W.storm * 0.4), vel); };
    const melody = (bars, fn) => { for (const [st, m, len] of bars[phrase % bars.length]) if (st === s16) fn(m, len); };
    // heat and dust sap the tune (notes drop out), fog hushes it, rain turns kalimba to mbira
    const thin = Math.max(W.heat, W.dust) * 0.35;
    const lead = (name, m, len, vel) => {
      if (thin && Math.random() < thin) return;
      if (W.rain > 0.4 && name === 'kalimba') name = 'mbira';
      vel *= 1 - W.fog * 0.2;
      if (name === 'flute') this.flute(m + X, t, len * spb, vel * 0.85);
      else inst(name, m, vel, 0.2);
    };

    switch (th) {
      case 'title': {
        pad(0.35, 1);
        if (s16 === 0) this.bass(chord.root, t, spb * 8, 0.8);
        if (s16 === 8) this.bass(chord.root + 7, t, spb * 6, 0.5);
        const arp = [ct[0], ct[2], ct[1] + 12, ct[2], ct[0] + 12, ct[2], ct[1] + 12, ct[2]];
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
        const coast = th === 'coast';
        pad(coast ? 0.25 : 0.35, S.v === 3 ? 1.15 : 1);
        if (s16 === 0) bass(chord.root, spb * 6, 0.8);
        if (s16 === 10 && (I >= 1 || S.alt)) bass(chord.root + (S.alt && I < 1 ? 7 : 0), spb * 4, 0.6);
        // kora ostinato (marimba on some arrangements, unless the marimba has the tune)
        const ost = [0, 3, 6, 8, 11, 14];
        const notes = [ct[0], ct[2], ct[1] + 12, ct[2] + 12, ct[1] + 12, ct[2]];
        const oi = ost.indexOf(s16);
        if (oi >= 0 && (!coast || s16 % 6 === 0)) {
          if (S.alt && !coast && S.lead !== 'marimba') inst('marimba', notes[oi] - 12, 0.5, -0.25);
          else inst('kora', notes[oi] - 12, 0.55, -0.25);
        }
        if (I < 3) {
          if (S.v === 3) { // a breather: no tune, just answers from the high strings
            if ((s16 === 4 || s16 === 12) && Math.random() < 0.35) inst('kora', pick(ct) + 12, 0.3, Math.random() - 0.5);
            if (phrase >= 4 && s16 % 2 === 0 && Math.random() < 0.2) inst('kalimba', pick([74, 77, 79, 81, 84]), 0.45, 0.3);
          } else {
            // a kalimba tune hands over to the flute halfway through
            const name = phrase >= 4 && S.lead === 'kalimba' ? 'flute' : S.lead;
            melody([THEME_A, THEME_B, THEME_C][S.v], (m, len) => lead(name, m, len, 0.9));
          }
        }
        break;
      }
      case 'woodland': {
        pad(0.3, 0.8);
        if (s16 === 0) bass(chord.root, spb * 6, 0.7);
        // two interlocking marimba voices (amadinda style), in one of two patterns
        const pent = [62, 65, 67, 69, 72, 74, 77];
        const v1 = S.alt ? [0, 3, 2, 4, 1, 3, 2, 5] : [0, 2, 4, 2, 5, 4, 2, 1];
        const v2 = S.alt ? [5, 4, 6, 5, 3, 4, 6, 3] : [4, 6, 5, 3, 6, 4, 3, 5];
        if (s16 % 2 === 0) inst('marimba', pent[v1[(s16 / 2 + bar) % 8]], 0.7, -0.3);
        else if (phrase % 2 === 1 || I >= 1 || S.v === 2) inst('marimba', pent[v2[((s16 - 1) / 2 + bar) % 8]], 0.45, 0.3);
        if (S.v === 0) { if (phrase >= 4) melody(THEME_B, (m, len) => lead('flute', m, len, 0.75)); }
        else if (S.v === 1) melody(WOOD_THEME, (m, len) => lead(S.lead, m, len, 0.85));
        else if (s16 === 12 && bar % 2 === 1) this.hit('talk', t, 0.3, 1.1); // no tune: talking-drum calls
        break;
      }
      case 'wetland': {
        pad(0.2, 0.9);
        if (s16 === 0) bass(chord.root, spb * 10, 0.6);
        // mbira (or kora) in threes against the four
        const cyc = [ct[0], ct[1], ct[2] + 12, ct[1] + 12, ct[2], ct[0] + 12];
        const oInst = S.alt ? 'kora' : 'mbira';
        if (s16 % 3 === 0) inst(oInst, cyc[(step / 3 | 0) % cyc.length] - 12, oInst === 'kora' ? 0.5 : 0.6, 0.15);
        if (Math.random() < 0.06) inst('kora', 81 + pick([0, 3, 5, 7]), 0.2, Math.random() - 0.5);
        if (S.v === 1) melody(WET_THEME, (m, len) => lead(S.lead, m + (S.lead === 'flute' ? 12 : 0), len, 0.75));
        else if (S.v === 2 && (s16 === 5 || s16 === 13) && Math.random() < 0.4) this.hit('udu', t, 0.35, 0.9 + Math.random() * 0.3, Math.random() - 0.5);
        break;
      }
      case 'desert': {
        if (s16 === 0 && bar % 2 === 0) this.pad([D2 + 12 + X, D2 + 19 + X], t, spb * 32, 0.15, 1.1);
        if (s16 === 0 || s16 === (S.alt ? 6 : 10)) this.hit('bass', t, 0.55);
        if (s16 === 7 && bar % 2 === 1) this.hit('tone', t, 0.3);
        if (S.alt && (s16 === 12 || s16 === 14)) this.hit('udu', t, 0.3);
        if (S.v === 0) melody(DESERT_THEME, (m, len) => lead(S.lead, m, len, 0.95));
        else if (S.v === 1) melody(DESERT_THEME_2, (m, len) => lead(S.lead, m + 12, len, 0.95));
        else if (s16 % 2 === 0 && Math.random() < 0.4) inst('kora', pick([62, 63, 66, 67, 69, 70, 74]), 0.55, Math.random() * 0.6 - 0.3); // a free kora taqsim over the drone
        if (s16 === 12 && Math.random() < 0.5) inst('kora', ct[0] - 12, 0.4);
        break;
      }
      case 'highland': {
        if (s16 === 0 && bar % 2 === 0) this.pad([D2 + 12 + X, D2 + 19 + X, D2 + 24 + X], t, spb * 32, 0.2, 1);
        const arp = S.alt ? [ct[0], ct[1] + 12, ct[2] + 12, ct[1] + 12] : [ct[0], ct[2], ct[1] + 12, ct[2]];
        if (s16 % 4 === 0) inst('kora', arp[s16 / 4] - 12, 0.45, -0.2);
        if (S.v === 0) melody(HIGH_THEME, (m, len) => lead(S.lead, m + 12, len, 0.8));
        else if (S.v === 1) melody(HIGH_THEME_2, (m, len) => lead(S.lead, m + 12, len, 0.8));
        else if (s16 === 0 && phrase % 2 === 0) lead('flute', pick([74, 76, 81]), 12, 0.65); // long calls across the valley
        break;
      }
      case 'ash': {
        if (s16 === 0) this.pad(ct.map((m) => m - 12 + X), t, spb * 16, 0.12, 1.1);
        if (s16 === 0 || s16 === 6) this.hit('heart', t, 0.8);
        if (s16 === 8 && Math.random() < 0.6) inst('marimba', pick(ct) - 12, 0.5);
        if (S.v === 1) melody(ASH_THEME, (m, len) => lead('flute', m, len, 0.7));
        else if (S.v === 2) {
          if (s16 === 12 && bar % 2 === 0) this.hit('talk', t, 0.35, 0.6);
          if (s16 === 4 && Math.random() < 0.4) inst('mbira', pick(ct) - 12, 0.5);
        }
        break;
      }
      case 'night': {
        // in open, bare country the night is a drone; elsewhere a slow chord
        const drone = this.biome === 3 || this.biome === 4 || this.biome === 5;
        if (s16 === 0) {
          if (drone) { if (bar % 2 === 0) this.pad([D2 + 12 + X, D2 + 19 + X], t, spb * 32, 0.08, 0.9); }
          else this.pad(ct.map((m) => m + X), t, spb * 16, 0.08, 0.8);
        }
        if (S.v === 0) melody(NIGHT_THEME, (m, len) => lead('flute', m, len, 0.95));
        else if (S.v === 1) melody(NIGHT_THEME_2, (m) => inst('mbira', m - 12, 0.95, -0.1));
        else {
          melody(NIGHT_THEME_3, (m) => inst('kalimba', m, 0.7, Math.random() * 0.8 - 0.4));
          if (s16 === 0 && bar % 2 === 0) inst('kora', ct[0] - 12, 0.6, -0.3);
        }
        if ((s16 === 4 || s16 === 12) && Math.random() < 0.5) inst('kora', pick(ct), 0.3, Math.random() - 0.5);
        break;
      }
      case 'chase': {
        // the band's war groove, in one of three shapes
        const G = GROOVES[S.v === 1 ? 1 : 0], riff = RIFFS[S.v] || RIFFS[0];
        if (G.bass.includes(s16)) this.hit('bass', t, 0.95);
        if (G.tone.includes(s16)) this.hit('tone', t, 0.55, 1, -0.2);
        if (G.slap.includes(s16)) this.hit('slap', t, 0.5, 1, 0.25);
        this.hit('shaker', t, s16 % 2 ? 0.16 : 0.26);
        if ((S.alt ? bar % 4 === 1 : bar % 4 === 3) && s16 >= 8 && s16 % 2 === 0) this.hit(S.v === 2 ? 'udu' : 'talk', t, 0.6, 1 + (s16 - 8) * 0.03);
        if (s16 % 2 === 0) this.bass(chord.root, t, spb * 1.8, 0.6);
        if (s16 === 0 && bar % 2 === 0 && (S.v !== 2 || bar % 4 === 0)) this.chant(t, spb * 30, 1);
        if (riff[s16]) this.inst('kora', riff[s16] + (bar % 4 === 2 ? -2 : 0), t, 0.55, 0.2);
        break;
      }
    }

    if (th !== 'chase' && th !== 'title') {
      // weather in the band: rain drips from the high kalimba, storm drums roll far off, heat shimmers
      if (W.rain > 0.4 && Math.random() < 0.05 * W.rain) inst('kalimba', pick([79, 81, 84, 86]), 0.25, Math.random() - 0.5);
      if (W.storm > 0.4 && s16 === 0 && bar % 2 === 0) this.hit('bass', t, 0.45 * W.storm, 0.6);
      if (W.heat > 0.4 && s16 === 0 && bar % 4 === 0) this.pad([74 + X, 81 + X], t, spb * 64, 0.9, 0.35 * W.heat);
      // the band's drums creep into every theme as they close in
      if (I >= 1 && (s16 === 0 || s16 === 6)) this.hit('bass', t, 0.5);
      if (I >= 2) {
        if (s16 === 8 || s16 === 11) this.hit('tone', t, 0.35);
        if (s16 % 4 === 2) this.hit('shaker', t, 0.15);
      }
    }
  }

  // Weather turning is marked with a short cue (hysteresis so a wobble can't retrigger it).
  weatherStings(rain, dust, heat, fog, storm) {
    if (this.menu) { this.wxOn = {}; return; }
    const on = this.wxOn;
    const edge = (k, v, hi, lo) => {
      if (!on[k] && v > hi) { on[k] = true; return true; }
      if (on[k] && v < lo) on[k] = false;
      return false;
    };
    const s = edge('storm', storm, 0.5, 0.15), r = edge('rain', rain, 0.5, 0.15);
    const d = edge('dust', dust, 0.4, 0.1), h = edge('heat', heat, 0.4, 0.1), f = edge('fog', fog, 0.4, 0.1);
    if (s) this.sting('storm');
    else if (r && !on.storm) this.sting('rain');
    if (d) this.sting('dust');
    if (h) this.sting('heat');
    if (f) this.sting('fog');
  }

  // ---------------- one-shots ----------------
  // Musical stings choose among variants and never play the same one twice running.
  sting(kind) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.02;
    const spb = 60 / this.tempo / 4;
    const x = this.key;
    const fl = (seq, vel, len = 5, off = 0) => seq.forEach(([m, s]) => this.flute(m + x, t + off + s * spb, spb * len, vel));
    const ar = (name, ms, gap, vel, off = 0) => ms.forEach((m, i) => this.inst(name, m + x, t + off + i * gap, vel, (i / Math.max(1, ms.length - 1) - 0.5) * 0.6));
    const calm = this.intensity >= 2 && !this.menu ? 0.6 : 1; // weather cues duck under a hunt
    switch (kind) {
      case 'dawn': {
        const v = this.rr('dawn', 3);
        if (v === 0) { fl([[62, 0], [69, 2], [74, 4], [72, 8], [74, 10]], 1); ar('kora', [50, 57, 62], 0.06, 0.7); }
        else if (v === 1) { ar('kalimba', [62, 65, 69, 74, 77, 81], 0.11, 0.8); fl([[81, 8], [79, 12], [81, 14]], 0.7, 6); this.pad([62 + x, 69 + x, 74 + x], t, 3, 0.45, 0.9); }
        else { ar('kora', [50, 57, 62, 65, 69], 0.05, 0.65); fl([[69, 4], [72, 6], [74, 8], [77, 12]], 0.85); }
        break;
      }
      case 'dusk': {
        const v = this.rr('dusk', 3);
        if (v === 0) fl([[74, 0], [72, 3], [69, 6], [65, 10]], 0.8);
        else if (v === 1) { ar('mbira', [74, 69, 65, 62, 57], 0.2, 0.7); this.pad([50 + x, 57 + x, 62 + x], t, 3.2, 0.12, 1); }
        else { fl([[81, 0], [77, 4], [74, 8]], 0.7, 6); this.inst('kora', 50 + x, t + spb * 12, 0.7); this.inst('kora', 38 + x, t + spb * 12, 0.5); }
        break;
      }
      case 'death':
        this.hit('bass', t, 1.2, 0.7);
        this.pad([50, 53, 57], t + 0.1, 3.5, 0.1, 1.4);
        [[69, 0], [67, 4], [65, 8], [62, 14]].forEach(([m, s]) => this.flute(m, t + 0.4 + s * spb * 1.5, spb * 7, 0.9));
        break;
      case 'start':
        this.hit('bass', t, 1); this.hit('bass', t + spb * 3, 0.9); this.hit('talk', t + spb * 6, 0.8);
        this.chant(t, 2.2, 0.8);
        break;
      case 'secret': {
        const v = this.rr('secret', 3);
        ar(v === 2 ? 'kora' : 'kalimba', [[74, 78, 81, 86], [69, 74, 78, 81, 86, 90], [86, 81, 78, 74, 78, 81, 86]][v], v === 1 ? 0.07 : 0.09, 0.9);
        this.pad([62 + x, 66 + x, 69 + x], t, 2.5, 0.4, 1);
        break;
      }
      case 'perk': {
        const v = this.rr('perk', 3);
        ar('kora', [[62, 69, 74, 77], [57, 62, 65, 69, 74], [74, 77, 81, 86]][v], 0.07, 0.8);
        if (v === 2) this.inst('kalimba', 86 + x, t + 0.35, 0.5);
        break;
      }
      // weather turning
      case 'rain': // drops running down the kalimba
        [86, 81, 79, 74, 72, 69].forEach((m, i) => this.inst('kalimba', m + x, t + i * 0.16 + Math.random() * 0.05, 0.6 * calm, Math.random() - 0.5));
        this.pad([62 + x, 65 + x, 69 + x], t, 3, 0.2, 0.8 * calm);
        break;
      case 'storm': // a dark cluster under a low drum
        this.hit('talk', t, 0.5 * calm, 0.6); this.hit('bass', t + 0.35, 0.6 * calm, 0.55);
        this.pad([50 + x, 51 + x, 57 + x], t, 3.2, 0.1, 1.2 * calm);
        fl([[62, 4], [63, 7], [62, 10]], 0.8 * calm, 4);
        break;
      case 'heat': // a bleached, high shimmer
        this.pad([74 + x, 81 + x, 86 + x], t, 3.5, 0.95, 0.6 * calm);
        fl([[81, 2], [79, 10]], 0.6 * calm, 8);
        break;
      case 'dust': // a quick phrygian run and a hollow fifth
        [74, 75, 72, 70, 69].forEach((m, i) => this.inst('kora', m + x, t + i * 0.08, 0.6 * calm, 0.3));
        this.pad([38 + x, 45 + x], t, 3, 0.15, 1.1 * calm);
        break;
      case 'fog': // a low, veiled call
        fl([[62, 0], [65, 8]], 0.6 * calm, 8);
        this.inst('mbira', 50 + x, t, 0.6 * calm);
        this.pad([50 + x, 57 + x], t, 3.5, 0.08, calm);
        break;
    }
  }

  // A short musical tag when a kill lands, in the band's key, on the sfx bus so it reads as feedback.
  killTag(t) {
    const x = this.key;
    const figs = [[62, 69, 74], [69, 74, 77], [65, 69, 72, 74], [74, 72, 74], [57, 62, 69]];
    const f = figs[this.rr('killtag', figs.length)];
    const name = pick(['kalimba', 'kora', 'marimba']);
    const g = { kora: 0.3, marimba: 0.28, kalimba: 0.24 }[name] * 0.9;
    f.forEach((m, i) => this.playBuf(this.note(name, m + x), t + 0.1 + i * 0.075, g, { dest: this.sfx, pan: (i - 1) * 0.2, verb: 0.3 }));
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
        this.playBuf(set[this.rr('step' + (set === K.step.water ? 'w' : g), set.length)], t, 0.35 * v * this.jit(0.85, 1.1), { dest: S, rate: this.jit(0.88, 1.12), pan: this.jit(-0.08, 0.08), verb: 0 });
        break;
      }
      // Repeated actions vary on every call: sweep ranges, pitches, counts and spacing are drawn
      // fresh, and each keeps near the level of the original single version.
      case 'pounce': {
        const f0 = this.jit(480, 720), dur = this.jit(0.22, 0.29);
        const f = this.noiseHit(t, f0, 0.7, dur, 0.4 * v, S, 'bandpass');
        f.frequency.exponentialRampToValueAtTime(f0 * this.jit(3.2, 4.6), t + dur * 0.8);
        this.growl(t, this.jit(0.28, 0.42), 0.8 * v, false, this.jit(0.85, 1.2));
        if (Math.random() < 0.4) this.playBuf(K.scrape[this.rr('scrape', K.scrape.length)], t + 0.02, 0.25 * v, { dest: S, rate: this.jit(0.9, 1.2), verb: 0 });
        break;
      }
      case 'kill':
        this.playBuf(K.bass, t, 0.6 * v, { dest: S, rate: this.jit(0.72, 0.9), verb: 0.1 });
        this.squeal(t + 0.02, this.jit(0.13, 0.22), this.jit(1150, 1700));
        this.killTag(t);
        break;
      case 'eat': {
        const n = 2 + Math.floor(Math.random() * 3);
        let s = t;
        for (let i = 0; i < n; i++) { this.noiseHit(s, this.jit(380, 900), 2, this.jit(0.045, 0.075), 0.35 * v * this.jit(0.8, 1.05), S, 'bandpass', this.jit(0.5, 0.75)); s += this.jit(0.09, 0.14); }
        if (Math.random() < 0.3) { // a bone gives
          this.noiseHit(s, this.jit(2200, 3200), 3, 0.03, 0.15 * v, S, 'bandpass');
          this.playBuf(K.tone, s, 0.08 * v, { dest: S, rate: this.jit(1.8, 2.3), verb: 0 });
        }
        break;
      }
      case 'drink': {
        const n = 2 + Math.floor(Math.random() * 3), gap = this.jit(0.11, 0.15);
        for (let i = 0; i < n; i++) {
          const f0 = this.jit(560, 850), s = t + i * gap + this.jit(0, 0.02);
          const f = this.noiseHit(s, f0, 5, this.jit(0.055, 0.08), 0.3 * v * this.jit(0.8, 1.05), S, 'bandpass');
          f.frequency.exponentialRampToValueAtTime(f0 * this.jit(1.8, 2.4), s + 0.06);
        }
        break;
      }
      case 'splash': { const f = this.noiseHit(t, this.jit(2000, 3000), 0.6, this.jit(0.3, 0.42), 0.45 * v, S, 'lowpass'); f.frequency.exponentialRampToValueAtTime(this.jit(320, 480), t + 0.3); break; }
      case 'throw': {
        const f0 = this.jit(320, 480), dur = this.jit(0.3, 0.4);
        const f = this.noiseHit(t, f0, 0.8, dur, 1.8 * v, S, 'bandpass');
        f.frequency.exponentialRampToValueAtTime(this.jit(1800, 2700), t + dur * 0.85);
        break;
      }
      case 'windup': this.shout(t, 0.9 * v, this.jit(1.1, 1.3)); break;
      case 'hit': this.playBuf(K.bass, t, 0.8 * v, { dest: S, rate: this.jit(0.68, 0.82), verb: 0.1 }); this.growl(t + 0.03, this.jit(0.33, 0.45), 1.1 * v, true, this.jit(0.9, 1.15)); break;
      case 'thunk':
        this.playBuf(K.tone, t, 0.7 * v, { dest: S, rate: this.jit(1.25, 1.55), verb: 0.05 });
        if (Math.random() < 0.5) this.noiseHit(t, this.jit(1500, 2600), 2, 0.04, 0.2 * v, S, 'bandpass'); // the shaft quivering
        break;
      case 'dodge': {
        const f0 = this.jit(2600, 3400);
        const f = this.noiseHit(t, f0, 3, 0.18, 0.25 * v, S, 'bandpass');
        f.frequency.exponentialRampToValueAtTime(f0 * 0.3, t + 0.18);
        this.bell(t + 0.08, [86, 88, 91][this.rr('dodge', 3)], 0.12);
        break;
      }
      // ---- new cues ----
      case 'climb': { // claws biting rock, a heave, and the body landing on the ledge
        const n = 3 + Math.floor(Math.random() * 2);
        for (let i = 0; i < n; i++) this.playBuf(K.scrape[this.rr('scrape', K.scrape.length)], t + i * this.jit(0.045, 0.07), 0.16 * v * this.jit(0.7, 1), { dest: S, rate: this.jit(0.85, 1.2) + i * 0.05, pan: this.jit(-0.15, 0.15), verb: 0 });
        this.growl(t + 0.05, 0.16, 0.25 * v, false, this.jit(1.1, 1.4));
        this.playBuf(K.bass, t + 0.2 + this.jit(0, 0.04), 0.14 * v, { dest: S, rate: this.jit(1.1, 1.35), verb: 0.05 });
        break;
      }
      case 'drop': // hopping down off a ledge: a soft padded landing and a puff of grit
        this.playBuf(K.bass, t, 0.4 * v, { dest: S, rate: this.jit(1.0, 1.25), verb: 0.05 });
        this.noiseHit(t + 0.01, this.jit(900, 1400), 0.8, 0.12, 0.18 * v, S, 'bandpass', 0.7);
        break;
      case 'startle': { // prey catching wind of you: a snort and a stamp, or wings for birds
        if (opts.fly) {
          for (let i = 0; i < 5; i++) this.noiseHit(t + i * this.jit(0.05, 0.07), this.jit(700, 1100), 1.2, 0.05, 0.22 * v, S, 'bandpass', 0.6);
          this.squeal(t, 0.08, this.jit(1800, 2400));
        } else {
          const f = this.noiseHit(t, this.jit(700, 1100), 1.5, 0.16, 0.22 * v, S, 'bandpass', 0.6);
          f.frequency.exponentialRampToValueAtTime(this.jit(350, 500), t + 0.14);
          for (let i = 0; i < 1 + Math.floor(Math.random() * 2); i++) this.playBuf(K.step.rock[this.rr('hoof', 5)], t + 0.18 + i * 0.12, 0.14 * v, { dest: S, rate: this.jit(0.55, 0.7), verb: 0 });
        }
        break;
      }
      case 'golden': // the golden gazelle shows itself: a shimmer up the bells
        [81, 86, 88, 93].forEach((m, i) => this.bell(t + i * 0.08, m + this.key, 0.09));
        this.playBuf(this.note('kalimba', 74 + this.key), t, 0.2, { dest: S, verb: 0.5 });
        break;
      case 'multloss': this.bell(t, 81, 0.05); this.bell(t + 0.09, 76, 0.05); break;
      case 'shout': this.shout(t, v, 1); break;
      case 'sighted': this.shout(t, v, 1); this.shout(t + 0.18, v * 0.7, 0.85); this.playBuf(K.bass, t, 0.9 * v, { dest: S, verb: 0.3 }); break;
      case 'bark': {
        const n = Math.random() < 0.25 ? 3 : 2, f0 = this.jit(370, 480), gap = this.jit(0.14, 0.19);
        for (let i = 0; i < n; i++) {
          const o = ctx.createOscillator();
          o.type = 'square';
          const s = t + i * gap;
          o.frequency.setValueAtTime(f0 * this.jit(0.95, 1.05), s);
          o.frequency.exponentialRampToValueAtTime(f0 * 0.52, s + 0.09);
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass'; bp.frequency.value = this.jit(950, 1250); bp.Q.value = 2;
          const g = ctx.createGain();
          this.env(g, s, 0.005, 0.25 * v, 0.1);
          o.connect(bp).connect(g).connect(S);
          o.start(s); o.stop(s + 0.14);
        }
        break;
      }
      case 'yelp': this.squeal(t, this.jit(0.1, 0.15), this.jit(800, 1050)); break;
      case 'knockdown': this.playBuf(K.bass, t, 0.9 * v, { dest: S, rate: this.jit(0.82, 0.98), verb: 0.2 }); this.shout(t + 0.05, 0.8 * v, this.jit(0.62, 0.78)); break;
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
      case 'roar': this.growl(t, this.jit(1.05, 1.35), 1.4 * v, true, this.jit(0.4, 0.5)); this.noiseHit(t, 300, 0.8, 1.1, 0.5 * v, S, 'lowpass', 0.5); break;
      case 'ui': this.bell(t, opts.pitch || 81, 0.06); break;
      case 'thunder': { // one main peal, sometimes a crack up front, sometimes a second roll behind
        const f = this.noiseHit(t, this.jit(240, 380), 0.5, this.jit(1.8, 2.6), 0.8 * v, S, 'lowpass', this.jit(0.4, 0.6));
        f.frequency.exponentialRampToValueAtTime(this.jit(65, 100), t + 2);
        if (Math.random() < 0.4) this.noiseHit(t, this.jit(1800, 3000), 0.7, 0.08, 0.3 * v, S, 'bandpass');
        if (Math.random() < 0.5) {
          const s = t + this.jit(0.35, 0.9);
          const f2 = this.noiseHit(s, this.jit(180, 260), 0.6, this.jit(1.2, 1.8), 0.45 * v, S, 'lowpass', 0.4);
          f2.frequency.exponentialRampToValueAtTime(70, s + 1.2);
        }
        break;
      }
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

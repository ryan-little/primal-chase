// All sound is synthesized with WebAudio: no audio files ship with the game.
// The score is adaptive: a kalimba theme and pad carry calm stretches, hunter drums
// creep in as the band closes, and a full chase groove with a chanted drone kicks in
// the moment they have eyes on you. Night swaps to a sparser flute-and-crickets mix.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
// MIDI helpers for D dorian
const D3 = 50, D4 = 62, D5 = 74;

// Theme: four bars of 16 steps each, [step, midi, lengthSteps]
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
// chord roots per bar (4-bar loop): Dm, C, Bb, C
const PROG = [
  { root: 50, tones: [62, 65, 69] },
  { root: 48, tones: [60, 64, 67] },
  { root: 46, tones: [58, 62, 65] },
  { root: 48, tones: [60, 64, 67] },
];

export class Audio {
  constructor() {
    this.ctx = null;
    this.musicVol = 0.8;
    this.sfxVol = 0.9;
    this.muted = false;
    this.intensity = 0; // 0 calm .. 3 chase
    this.night = 0; // 0..1
    this.rain = 0;
    this.tempo = 88;
    this.step = 0;
    this.nextTime = 0;
    this.section = 'A';
    this.bar = 0;
    this.playing = false;
    this.lastBird = 0;
    this.menu = true;
  }

  init(offline) {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC && !offline) return;
    const ctx = (this.ctx = offline || new AC());
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

    // shared noise
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // reverb: synthetic impulse, a wide dry open-air tail
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

    // bus for music with a gentle master filter (used for "muffled" moments)
    this.mbus = ctx.createBiquadFilter();
    this.mbus.type = 'lowpass';
    this.mbus.frequency.value = Math.min(18000, ctx.sampleRate / 2 - 100);
    this.mbus.connect(this.music);

    this.startAmbience();
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

  // ---------------- ambience ----------------
  startAmbience() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    const g = ctx.createGain();
    g.gain.value = 0.16;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 180;
    lfo.connect(lfoG).connect(lp.frequency);
    lfo.start();
    src.connect(lp).connect(g).connect(this.amb);
    src.start();
    this.wind = g;

    const rs = ctx.createBufferSource();
    rs.buffer = this.noise;
    rs.loop = true;
    rs.playbackRate.value = 0.7;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.value = 2400;
    hp.Q.value = 0.4;
    this.rainG = ctx.createGain();
    this.rainG.gain.value = 0;
    rs.connect(hp).connect(this.rainG).connect(this.amb);
    rs.start();

    // crickets: AM sine
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
  }

  bird(t) {
    const ctx = this.ctx;
    const n = 2 + Math.floor(Math.random() * 3);
    const base = 2200 + Math.random() * 1600;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(this.amb);
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const s = t + i * 0.13;
      o.frequency.setValueAtTime(base, s);
      o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.3), s + 0.06);
      o.frequency.exponentialRampToValueAtTime(base * 0.9, s + 0.1);
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.05, s + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.11);
      o.connect(g).connect(pan);
      o.start(s);
      o.stop(s + 0.12);
    }
  }

  // ---------------- instruments ----------------
  env(g, t, a, peak, dec, sus = 0.0001) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t + a + dec);
  }

  kalimba(midi, t, vel = 1, dest = this.mbus) {
    const ctx = this.ctx, f = NOTE(midi);
    const g = ctx.createGain();
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator();
    o1.type = 'sine'; o1.frequency.value = f;
    o2.type = 'sine'; o2.frequency.value = f * 5.4;
    o3.type = 'triangle'; o3.frequency.value = f * 2;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.12 * vel, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    const g3 = ctx.createGain();
    g3.gain.value = 0.12;
    o1.connect(g); o2.connect(g2).connect(g); o3.connect(g3).connect(g);
    this.env(g, t, 0.004, 0.22 * vel, 1.4);
    g.connect(dest);
    const send = ctx.createGain();
    send.gain.value = 0.35;
    g.connect(send).connect(this.verbIn);
    for (const o of [o1, o2, o3]) { o.start(t); o.stop(t + 1.6); }
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
    // breath
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
    g.gain.linearRampToValueAtTime(0.05 * vel, t + dur * 0.35);
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
    g.gain.exponentialRampToValueAtTime(0.32 * vel, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const g2 = ctx.createGain(); g2.gain.value = 0.25;
    o.connect(g); o2.connect(g2).connect(g);
    g.connect(this.mbus);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }

  drum(t, f0, f1, dec, vel, noiseAmt = 0.2) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dec * 0.6);
    const g = ctx.createGain();
    this.env(g, t, 0.002, 0.7 * vel, dec);
    o.connect(g).connect(this.mbus);
    o.start(t); o.stop(t + dec + 0.05);
    if (noiseAmt > 0) this.noiseHit(t, 900, 0.8, 0.04, noiseAmt * vel, this.mbus, 'lowpass');
    const send = ctx.createGain(); send.gain.value = 0.18;
    g.connect(send).connect(this.verbIn);
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
    // formant-filtered saw pair = distant voices holding a note
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
    const I = this.menu ? 0 : this.intensity;
    const want = 88 + (I >= 3 ? 16 : I >= 2 ? 6 : 0);
    this.tempo += (want - this.tempo) * Math.min(1, dt * 0.8);
    const spb = 60 / this.tempo / 4; // seconds per 16th
    while (this.nextTime < ctx.currentTime + 0.15) {
      this.schedule(this.step, this.nextTime, spb);
      this.nextTime += spb;
      this.step++;
    }
    // ambience mix
    const t = ctx.currentTime;
    this.cricketG.gain.setTargetAtTime(this.menu ? 0.004 : this.night * 0.012, t, 1);
    this.rainG.gain.setTargetAtTime(this.rain * 0.35, t, 0.8);
    this.wind.gain.setTargetAtTime(0.12 + this.rain * 0.12, t, 1);
    if (!this.menu && this.night < 0.5 && t - this.lastBird > 2.5 && Math.random() < dt * 0.35 * (1 - this.rain)) {
      this.lastBird = t;
      this.bird(t + 0.05);
    }
  }

  schedule(step, t, spb) {
    const s16 = step % 16;
    const bar = Math.floor(step / 16);
    const chord = PROG[bar % 4];
    const I = this.menu ? 0 : this.intensity;
    const night = this.night > 0.5;
    const phrase = bar % 8;

    if (s16 === 0 && bar % 8 === 0) {
      // choose the next 8-bar section
      const r = Math.random();
      this.section = night ? (r < 0.6 ? 'N' : 'O') : r < 0.4 ? 'A' : r < 0.75 ? 'B' : 'O';
      if (this.menu) this.section = bar % 16 === 0 ? 'A' : 'B';
    }

    // pad: one chord per bar
    if (s16 === 0) {
      const bright = night ? 0.1 : 0.35 + I * 0.15;
      this.pad(chord.tones, t, spb * 16, bright, night ? 0.8 : 1);
    }

    // bass
    if (I >= 1 || this.section !== 'N') {
      if (s16 === 0) this.bass(chord.root - 12 + 12, t, spb * 6, 0.9);
      if (s16 === 10 && I >= 1) this.bass(chord.root, t, spb * 4, 0.6);
      if (I >= 3 && (s16 % 4 === 2)) this.bass(chord.root, t, spb * 2, 0.55);
    }

    // melody
    const mel = this.section === 'A' ? THEME_A : this.section === 'B' ? THEME_B : this.section === 'N' ? NIGHT_THEME : null;
    if (mel && I < 3) {
      const bar4 = mel[phrase % 4];
      for (const [st, m, len] of bar4) {
        if (st !== s16) continue;
        if (night) this.flute(m, t, len * spb, 0.9);
        else if (phrase >= 4 && this.section === 'A') this.flute(m, t, len * spb, 0.7);
        else this.kalimba(m, t, 0.9);
      }
    }
    // ostinato (kalimba arpeggio) — present in calm day and in 'O' sections
    if (!night && (this.section === 'O' || I >= 1) && I < 3 && s16 % 2 === 0) {
      const tones = [chord.tones[0], chord.tones[2], chord.tones[1] + 12, chord.tones[2]];
      this.kalimba(tones[(s16 / 2) % 4] - (s16 % 8 === 0 ? 0 : 0), t, 0.45);
    }

    // hunter drums, layered by intensity
    if (I >= 1) {
      if (s16 === 0 || s16 === 6) this.drum(t, 110, 48, 0.45, 0.9, 0.15); // distant heartbeat
    }
    if (I >= 2) {
      if (s16 === 8 || s16 === 11) this.drum(t, 160, 80, 0.25, 0.55, 0.3);
      if (s16 % 4 === 2) this.noiseHit(t, 7000, 1, 0.05, 0.12, this.mbus, 'highpass');
    }
    if (I >= 3) {
      if ([3, 12, 14].includes(s16)) this.drum(t, 220, 120, 0.12, 0.65, 0.6);
      if (s16 % 4 === 0) this.drum(t, 95, 42, 0.3, 1.0, 0.25);
      if (s16 % 2 === 1) this.noiseHit(t, 8000, 1, 0.03, 0.08, this.mbus, 'highpass');
      if (s16 === 0 && bar % 2 === 0) this.chant(t, spb * 30, 1);
      // urgent riff
      const riff = [62, 0, 65, 62, 0, 67, 0, 69, 72, 0, 69, 0, 67, 0, 65, 0];
      if (riff[s16]) this.kalimba(riff[s16] + (bar % 4 === 2 ? -2 : 0), t, 0.55);
    }
  }

  // ---------------- one-shot SFX ----------------
  sting(kind) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.02;
    const spb = 60 / this.tempo / 4;
    if (kind === 'dawn') {
      [[62, 0], [69, 2], [74, 4], [72, 8], [74, 10]].forEach(([m, s]) => this.flute(m, t + s * spb, spb * 5, 1));
    } else if (kind === 'dusk') {
      [[74, 0], [72, 3], [69, 6], [65, 10]].forEach(([m, s]) => this.flute(m, t + s * spb, spb * 5, 0.8));
    } else if (kind === 'death') {
      this.drum(t, 90, 30, 1.6, 1, 0.6);
      this.pad([50, 53, 57], t + 0.1, 3.5, 0.1, 1.4);
      [[69, 0], [67, 4], [65, 8], [62, 14]].forEach(([m, s]) => this.flute(m, t + 0.4 + s * spb * 1.5, spb * 7, 0.9));
    } else if (kind === 'start') {
      this.drum(t, 120, 40, 0.8, 1, 0.3);
      this.drum(t + spb * 3, 120, 40, 0.8, 0.9, 0.3);
      this.chant(t, 2.2, 0.8);
    }
  }

  play(name, opts = {}) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.005;
    const v = opts.vol ?? 1;
    const S = this.sfx;
    switch (name) {
      case 'step': {
        this.noiseHit(t, opts.water ? 900 : 380 + Math.random() * 200, 1.2, opts.water ? 0.09 : 0.04, 0.4 * v, S, 'bandpass', 0.8);
        break;
      }
      case 'pounce': {
        const f = this.noiseHit(t, 600, 0.7, 0.25, 0.4 * v, S, 'bandpass');
        f.frequency.exponentialRampToValueAtTime(2400, t + 0.2);
        this.growl(t, 0.35, 0.8 * v);
        break;
      }
      case 'kill': {
        this.drum(t, 140, 50, 0.25, 0.9 * v, 0.5);
        this.squeal(t + 0.02, 0.18);
        break;
      }
      case 'eat': {
        for (let i = 0; i < 3; i++) this.noiseHit(t + i * 0.11, 500 + Math.random() * 300, 2, 0.06, 0.35 * v, S, 'bandpass', 0.6);
        break;
      }
      case 'drink': {
        for (let i = 0; i < 3; i++) {
          const f = this.noiseHit(t + i * 0.13, 700, 5, 0.07, 0.3 * v, S, 'bandpass');
          f.frequency.exponentialRampToValueAtTime(1500, t + i * 0.13 + 0.06);
        }
        break;
      }
      case 'splash': {
        const f = this.noiseHit(t, 2500, 0.6, 0.35, 0.45 * v, S, 'lowpass');
        f.frequency.exponentialRampToValueAtTime(400, t + 0.3);
        break;
      }
      case 'throw': {
        const f = this.noiseHit(t, 400, 0.8, 0.35, 1.8 * v, S, 'bandpass');
        f.frequency.exponentialRampToValueAtTime(2200, t + 0.3);
        break;
      }
      case 'windup': {
        this.shout(t, 0.9 * v, 1.2);
        break;
      }
      case 'hit': {
        this.drum(t, 90, 40, 0.3, 1.1 * v, 0.9);
        this.growl(t + 0.03, 0.4, 1.1 * v, true);
        break;
      }
      case 'thunk': {
        this.drum(t, 260, 120, 0.1, 1.3 * v, 0.9);
        break;
      }
      case 'dodge': {
        const f = this.noiseHit(t, 3000, 3, 0.18, 0.25 * v, S, 'bandpass');
        f.frequency.exponentialRampToValueAtTime(900, t + 0.18);
        this.bell(t + 0.08, 88, 0.12);
        break;
      }
      case 'shout': {
        this.shout(t, v, 1);
        break;
      }
      case 'sighted': {
        this.shout(t, v, 1);
        this.shout(t + 0.18, v * 0.7, 0.85);
        this.drum(t, 100, 40, 0.6, 1, 0.5);
        break;
      }
      case 'bark': {
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
      }
      case 'yelp': {
        this.squeal(t, 0.12, 900);
        break;
      }
      case 'knockdown': {
        this.drum(t, 110, 45, 0.35, 1 * v, 0.7);
        this.shout(t + 0.05, 0.8 * v, 0.7);
        break;
      }
      case 'trail': {
        [74, 78, 81].forEach((m, i) => this.bell(t + i * 0.07, m, 0.14));
        break;
      }
      case 'score': {
        this.bell(t, 86 + (opts.pitch || 0), 0.08);
        break;
      }
      case 'overheat': {
        const f = this.noiseHit(t, 5000, 0.5, 0.8, 0.25 * v, S, 'highpass');
        f.frequency.linearRampToValueAtTime(2000, t + 0.7);
        this.growl(t, 0.6, 0.5, false, 0.5);
        break;
      }
      case 'pant': {
        this.noiseHit(t, 1400, 1.2, 0.14, 0.5 * v, S, 'bandpass', 0.7);
        break;
      }
      case 'heart': {
        this.drum(t, 70, 40, 0.18, 0.7 * v, 0);
        this.drum(t + 0.2, 60, 38, 0.2, 0.5 * v, 0);
        break;
      }
      case 'roar': {
        this.growl(t, 1.0, 1.3 * v, true, 0.6);
        break;
      }
      case 'ui': {
        this.bell(t, opts.pitch || 81, 0.06);
        break;
      }
      case 'thunder': {
        const f = this.noiseHit(t, 300, 0.5, 2.2, 0.8 * v, S, 'lowpass', 0.5);
        f.frequency.exponentialRampToValueAtTime(80, t + 2);
        break;
      }
      case 'rumble': {
        const f = this.noiseHit(t, 180, 0.7, 3.2, 0.9 * v, S, 'lowpass', 0.4);
        f.frequency.linearRampToValueAtTime(320, t + 2);
        for (let i = 0; i < 14; i++) this.drum(t + 0.4 + i * 0.17 + Math.random() * 0.06, 70, 40, 0.12, 0.35 * v, 0.2);
        break;
      }
      case 'laugh': {
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
      }
      case 'snap': {
        this.noiseHit(t, 2500, 1, 0.05, 0.7 * v, S, 'bandpass');
        this.drum(t, 300, 90, 0.1, 0.6 * v, 0.5);
        break;
      }
      case 'snarl': {
        this.growl(t, 0.25, 0.7 * v, false, 1.4);
        break;
      }
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
    // "Hah!" — saw through two sweeping formants
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
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 0.6 - 0.3;
    g.connect(pan).connect(this.sfx);
    const send = ctx.createGain(); send.gain.value = 0.5;
    g.connect(send).connect(this.verbIn);
    o.start(t); o.stop(t + 0.4);
  }
}

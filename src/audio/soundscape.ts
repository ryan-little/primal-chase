// The soundscape — entirely synthesized, no assets, nothing fetched.
// Layers: wind (always, shaped by daylight), insects (day), crickets
// (night), water (near rivers/lakes), hunter drums (close pursuit),
// heartbeat (danger). One update() with a handful of scalars drives it all;
// discrete events (footsteps, phase swell, death) are one-shots.

export interface SoundscapeState {
  /** 0..1 — how much day is in the sky. */
  daylight: number;
  /** Miles to the hunters; Infinity while they search. */
  hunterDistance: number;
  /** 0..1 — proximity to open water. */
  nearWater: number;
  /** 0..1 — vitals/proximity danger for the heartbeat. */
  danger: number;
  /** Rain intensity 0..1. */
  rain: number;
}

function noiseBuffer(ctx: AudioContext, seconds: number, brown = false): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + white * 0.02) / 1.02;
      d[i] = last * 3.5;
    } else {
      d[i] = white;
    }
  }
  return buf;
}

/** A short cricket chirp train baked into a loopable buffer. */
function cricketBuffer(ctx: AudioContext): AudioBuffer {
  const seconds = 2.7;
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  const sr = ctx.sampleRate;
  // Three chirps then silence, like the real thing.
  for (let c = 0; c < 3; c++) {
    const start = (0.14 + c * 0.19) * sr;
    for (let i = 0; i < 0.09 * sr; i++) {
      const t = i / sr;
      const env = Math.sin((i / (0.09 * sr)) * Math.PI);
      const am = 0.55 + 0.45 * Math.sin(2 * Math.PI * 41 * t);
      d[Math.floor(start + i)] = Math.sin(2 * Math.PI * 4300 * t) * env * am * 0.5;
    }
  }
  return buf;
}

export class Soundscape {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private layers: Record<string, GainNode> = {};
  private drumTimer = 0;
  private stepTimer = 0;
  private state: SoundscapeState = {
    daylight: 1, hunterDistance: 25, nearWater: 0, danger: 0, rain: 0
  };
  volume = 0.7;
  enabled = true;

  /** Must be called from a user gesture. Safe to call repeatedly. */
  init(): void {
    if (this.ctx || !this.enabled) return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);

    const addLoop = (
      name: string, buf: AudioBuffer,
      filterType: BiquadFilterType, freq: number, q = 0.8, rate = 1
    ): BiquadFilterNode => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.playbackRate.value = rate;
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = freq;
      filter.Q.value = q;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(this.master!);
      src.start();
      this.layers[name] = gain;
      return filter;
    };

    const white = noiseBuffer(ctx, 4);
    const brown = noiseBuffer(ctx, 4, true);
    const windFilter = addLoop('wind', brown, 'lowpass', 420, 0.6);
    addLoop('windHigh', white, 'bandpass', 900, 0.4, 0.85);
    addLoop('insects', white, 'bandpass', 6200, 2.2);
    addLoop('crickets', cricketBuffer(ctx), 'bandpass', 4300, 3);
    addLoop('water', brown, 'lowpass', 900, 0.7, 1.35);
    addLoop('rain', white, 'highpass', 1800, 0.5);

    // Slow wander on the wind cutoff so it breathes.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 160;
    lfo.connect(lfoGain).connect(windFilter.frequency);
    lfo.start();
  }

  setVolume(v: number): void {
    this.volume = v;
    this.master?.gain.setTargetAtTime(v, this.ctx?.currentTime ?? 0, 0.2);
  }

  update(s: Partial<SoundscapeState>, dt: number): void {
    Object.assign(this.state, s);
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const st = this.state;
    const set = (name: string, v: number, tc = 1.2) =>
      this.layers[name]?.gain.setTargetAtTime(Math.max(0, v), t, tc);

    set('wind', 0.16 + st.daylight * 0.08);
    set('windHigh', 0.05 + st.daylight * 0.04);
    set('insects', st.daylight > 0.4 ? 0.045 : 0, 2);
    set('crickets', st.daylight < 0.25 ? 0.16 : 0, 2);
    set('water', st.nearWater * 0.22);
    set('rain', st.rain * 0.30, 0.8);

    // Hunter drums: a slow pulse that quickens as they close.
    if (Number.isFinite(st.hunterDistance) && st.hunterDistance < 7) {
      this.drumTimer -= dt;
      if (this.drumTimer <= 0) {
        const closeness = 1 - Math.max(0, st.hunterDistance) / 7;
        this.drum(0.10 + closeness * 0.25);
        this.drumTimer = 2.4 - closeness * 1.5;
      }
    }

    // Heartbeat under real danger.
    if (st.danger > 0.55) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.thump(0.09 + st.danger * 0.08, 46);
        setTimeout(() => this.thump(0.07 + st.danger * 0.06, 40), 190);
        this.stepTimer = 1.35 - st.danger * 0.45;
      }
    }
  }

  private tone(
    freq: number, gainV: number, attack: number, decay: number, type: OscillatorType = 'sine'
  ): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gainV, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + attack + decay + 0.05);
  }

  private drum(v: number): void { this.tone(52, v, 0.008, 0.5); }
  private thump(v: number, f: number): void { this.tone(f, v, 0.006, 0.22); }

  /** Soft footfall — call on a rhythm while the cat runs. */
  footstep(): void { this.tone(70 + Math.random() * 25, 0.05, 0.004, 0.11); }

  /** The world turning: a filtered swell on phase change. */
  phaseSwell(toNight: boolean): void {
    this.tone(toNight ? 98 : 147, 0.11, 0.9, 1.6, 'triangle');
  }

  death(): void {
    this.tone(55, 0.2, 0.03, 3.2);
    this.tone(41, 0.16, 0.4, 3.6);
  }

  trailBreak(): void {
    // A breath of relief: rising fifth, quiet.
    this.tone(220, 0.05, 0.02, 0.5, 'triangle');
    setTimeout(() => this.tone(330, 0.04, 0.02, 0.7, 'triangle'), 160);
  }
}

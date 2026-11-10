// Music lab: offline renders of the score for either engine (before = tools/audio-before.js,
// after = js/audio.js), with a note capture, a piano roll, a spectrogram and the numbers used to
// judge the writing. Shared by tools/musicpack.html and tools/musicrun.mjs.

// ---------------- scenes ----------------
// tl: [[sec, {audio fields}]]; cues: [[sec, kind]] (kind is a music cue; the old engine maps it to
// whatever it played for that moment).
const B = ['savanna', 'woodland', 'wetland', 'desert', 'highland', 'volcanic', 'coast'];
export const SCENES = [
  { id: 'title', group: 'Title and death', title: 'Title theme', secs: 56, tl: [[0, { menu: true }]] },
  { id: 'death', group: 'Title and death', title: 'Death: chase, then the elegy', secs: 44, tl: [[0, { biome: 0, intensity: 3 }], [6, { intensity: 0, over: true }]], cues: [[6, 'death']] },
  ...B.map((b, i) => ({ id: 'day-' + b, group: 'Biomes by day', title: b + ' by day', secs: 48, tl: [[0, { biome: i }]] })),
  { id: 'night-savanna', group: 'Night', title: 'Night, open grass', secs: 48, tl: [[0, { biome: 0, night: 1 }]] },
  { id: 'night-woodland', group: 'Night', title: 'Night, woodland', secs: 48, tl: [[0, { biome: 1, night: 1 }]] },
  { id: 'night-desert', group: 'Night', title: 'Night, desert', secs: 48, tl: [[0, { biome: 3, night: 1 }]] },
  { id: 'daycycle', group: 'Night', title: 'Day, dusk, night, dawn (savanna)', secs: 64, tl: [[0, { biome: 0 }], [14, { night: 1 }], [40, { night: 0 }]], cues: [[14, 'dusk'], [40, 'dawn']] },
  { id: 'trail', group: 'Tension ladder', title: 'On your trail (I=1)', secs: 32, tl: [[0, { biome: 0, intensity: 1 }]] },
  { id: 'closing', group: 'Tension ladder', title: 'Closing in (I=2)', secs: 32, tl: [[0, { biome: 0, intensity: 2 }]] },
  { id: 'chase', group: 'Tension ladder', title: 'Sighted, full chase (I=3)', secs: 40, tl: [[0, { biome: 0, intensity: 3 }]] },
  { id: 'ladder', group: 'Tension ladder', title: 'Whole ladder: calm, trail, closing, chase, escape', secs: 76, tl: [[0, { biome: 0 }], [10, { intensity: 1 }], [22, { intensity: 2 }], [34, { intensity: 3 }], [56, { intensity: 0 }]] },
  { id: 'travel', group: 'Transitions', title: 'Biome to biome: savanna, woodland, desert, coast', secs: 64, tl: [[0, { biome: 0 }], [15, { biome: 1 }], [31, { biome: 3 }], [47, { biome: 6 }]] },
  { id: 'stingers', group: 'Stingers', title: 'Stingers over savanna: kill, dodge, secret, feat, perk, hurt, start', secs: 40, tl: [[0, { biome: 0 }]], cues: [[3, 'kill'], [8, 'dodge'], [13, 'secret'], [19, 'feat'], [25, 'perk'], [31, 'hurt'], [36, 'start']] },
];

// The old engine had no music cues; map each to what it played in the game for that moment.
export function oldCue(a, kind) {
  const m = { kill: () => a.play('kill'), dodge: () => a.play('dodge'), secret: () => a.sting('secret'), feat: () => a.play('score', { pitch: 5 }), perk: () => a.sting('perk'),
    hurt: () => a.play('hit'), start: () => a.sting('start'), death: () => a.sting('death'), dawn: () => a.sting('dawn'), dusk: () => a.sting('dusk') }[kind];
  if (m) m();
}

// ---------------- capture ----------------
// The new engine records into a.score through a.rec(); the old one is wrapped here.
function capture(a, old) {
  const ev = [];
  if (!old && typeof a.rec === 'function') { a.score = ev; return ev; }
  const wrap = (name, fn) => { const o = a[name]; if (!o) return; a[name] = function (...x) { fn(...x); return o.apply(this, x); }; };
  wrap('inst', (name, midi, t, vel = 1, pan = 0) => ev.push({ p: name, m: midi, t, d: 0.25, v: vel, pan }));
  wrap('flute', (midi, t, dur, vel = 1) => ev.push({ p: 'flute', m: midi, t, d: dur, v: vel }));
  wrap('bass', (midi, t, dur, vel = 1) => ev.push({ p: 'bass', m: midi, t, d: Math.min(dur, 1), v: vel }));
  wrap('pad', (ms, t, dur, b, vel = 1) => ms.forEach((m) => ev.push({ p: 'pad', m, t, d: dur, v: vel })));
  wrap('chant', (t, dur, vel = 1) => [38, 50, 57].forEach((m) => ev.push({ p: 'chant', m, t, d: dur, v: vel })));
  wrap('hit', (name, t, vel = 1) => ev.push({ p: 'drum', k: name, t, d: 0.05, v: vel }));
  wrap('schedule', (step, t) => { if (step % 16 === 0) ev.push({ p: 'bar', t }); });
  return ev;
}

// ---------------- render ----------------
// Drives the engine's real update() loop (so theme changes, sections and transitions all happen
// the way they do in game), with ambience and sfx muted unless asked for.
export async function renderScene(AudioClass, scene, { sr = 32000, old = false, secs = scene.secs, sfx = false } = {}) {
  const off = new OfflineAudioContext(2, Math.floor(sr * secs), sr);
  const a = new AudioClass();
  a.init(off);
  a.menu = false;
  a.amb.gain.value = 0;
  if (!sfx && !old) a.sfx.gain.value = 0;
  const ev = capture(a, old);
  a.log = [];
  const tl = scene.tl.slice(), cues = (scene.cues || []).slice();
  const dt = 1 / 30;
  const t0 = performance.now();
  for (let t = dt; t < secs - 0.1; t += dt) {
    off.suspend(+t.toFixed(4)).then(() => {
      while (tl.length && tl[0][0] <= off.currentTime + 1e-6) Object.assign(a, tl.shift()[1]);
      while (cues.length && cues[0][0] <= off.currentTime + 1e-6) { const k = cues.shift()[1]; if (old) oldCue(a, k); else if (a.cue) a.cue(k); }
      a.update(dt);
      off.resume();
    });
  }
  const buffer = await off.startRendering();
  return { buffer, ev, log: a.log || [], ms: Math.round(performance.now() - t0), secs, sr };
}

// ---------------- analysis ----------------
const db = (x) => (x > 1e-9 ? 20 * Math.log10(x) : -180);
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, ai = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k + len / 2] = re[i + k] - ar; im[i + k + len / 2] = im[i + k] - ai;
        re[i + k] += ar; im[i + k] += ai;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}
// Magnitude frames (mono), N=2048 Hann, `cols` frames spread over the buffer.
export function spectra(buffer, cols = 600, N = 2048) {
  const L = buffer.getChannelData(0), R = buffer.getChannelData(1);
  const hop = Math.max(1, Math.floor((L.length - N) / cols));
  const win = new Float32Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  const out = [];
  for (let c = 0; c < cols; c++) {
    const s = c * hop;
    if (s + N > L.length) break;
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = (L[s + i] + R[s + i]) * 0.5 * win[i];
    fft(re, im);
    const mag = new Float32Array(N / 2);
    for (let i = 0; i < N / 2; i++) mag[i] = Math.hypot(re[i], im[i]) / (N / 4);
    out.push(mag);
  }
  return { frames: out, N, sr: buffer.sampleRate };
}

const MELODIC = ['kora', 'kalimba', 'marimba', 'mbira', 'flute', 'balafon', 'ngoni', 'voice', 'chant', 'bass', 'pad', 'krar', 'bell'];
export function analyze(r) {
  const { buffer, ev, secs } = r;
  const sr = buffer.sampleRate, L = buffer.getChannelData(0), R = buffer.getChannelData(1);
  let pk = 0, sum = 0, nan = 0, clip = 0, mid = 0, side = 0;
  for (let i = 0; i < L.length; i++) {
    const l = L[i], rr = R[i];
    if (!Number.isFinite(l) || !Number.isFinite(rr)) { nan++; continue; }
    const v = Math.max(Math.abs(l), Math.abs(rr));
    if (v > pk) pk = v;
    if (v >= 0.999) clip++;
    sum += (l * l + rr * rr) / 2;
    mid += ((l + rr) / 2) ** 2; side += ((l - rr) / 2) ** 2;
  }
  const rms = Math.sqrt(sum / L.length);
  // loudness per second (rms dB)
  const loud = [];
  for (let s = 0; s + 1 <= secs; s++) {
    let q = 0; const a = s * sr, b = Math.min(L.length, (s + 1) * sr);
    for (let i = a; i < b; i++) q += (L[i] * L[i] + R[i] * R[i]) / 2;
    loud.push(+db(Math.sqrt(q / (b - a))).toFixed(1));
  }
  const live = loud.filter((x) => x > -60);
  // band balance from averaged power spectra
  const sp = spectra(buffer, 160);
  const bands = { sub: [20, 60], low: [60, 250], mid: [250, 2000], pres: [2000, 6000], air: [6000, sr / 2] };
  const pw = {}; let tot = 0;
  for (const k in bands) pw[k] = 0;
  for (const f of sp.frames) for (let i = 1; i < f.length; i++) {
    const hz = (i * sr) / sp.N, p = f[i] * f[i];
    for (const k in bands) if (hz >= bands[k][0] && hz < bands[k][1]) { pw[k] += p; tot += p; }
  }
  const balance = {}; for (const k in pw) balance[k] = +(100 * pw[k] / (tot || 1)).toFixed(1);
  // score numbers
  const bars = ev.filter((e) => e.p === 'bar').map((e) => e.t).sort((x, y) => x - y);
  const notes = ev.filter((e) => e.p !== 'bar');
  const parts = {};
  for (const e of notes) (parts[e.k ? 'drum:' + e.k : e.p] ||= []).push(e);
  const nb = Math.max(1, bars.length);
  const density = {}; for (const k in parts) density[k] = +(parts[k].length / nb).toFixed(1);
  // pitch classes against the intended mode (new engine reports it on its bar events)
  const pcs = new Array(12).fill(0); let out = 0, inMode = 0;
  const modeAt = (t) => { let m = null; for (const e of ev) if (e.p === 'bar' && e.t <= t + 1e-3 && e.mode) m = e.mode; return m; };
  for (const e of notes) if (e.m != null && e.p !== 'drum') {
    pcs[((e.m % 12) + 12) % 12]++;
    const m = modeAt(e.t);
    if (m) { if (m.includes(((e.m % 12) + 12) % 12)) inMode++; else out++; }
  }
  // melodic leaps per lead part
  const leaps = {};
  for (const k of ['flute', 'kalimba', 'kora', 'marimba', 'mbira', 'voice', 'krar', 'balafon', 'ngoni']) {
    const p = (parts[k] || []).slice().sort((x, y) => x.t - y.t);
    if (p.length < 4) continue;
    let s = 0, big = 0;
    for (let i = 1; i < p.length; i++) { const d = Math.abs(p[i].m - p[i - 1].m); s += d; if (d > 7) big++; }
    leaps[k] = { mean: +(s / (p.length - 1)).toFixed(1), over5th: Math.round(100 * big / (p.length - 1)) };
  }
  // register collisions: two different melodic parts sounding within a whole tone at once
  let coll = 0;
  const mel = notes.filter((e) => e.m != null && e.p !== 'drum' && e.p !== 'pad' && e.p !== 'chant').sort((x, y) => x.t - y.t);
  for (let i = 0; i < mel.length; i++) for (let j = i + 1; j < mel.length && mel[j].t < mel[i].t + Math.min(mel[i].d, 0.4); j++) {
    if (mel[j].p !== mel[i].p && Math.abs(mel[j].m - mel[i].m) <= 2 && mel[j].m !== mel[i].m) coll++;
  }
  // literal repeats: bars whose content (parts, pitches, quantized onsets) appeared before
  const sig = new Map(); let rep = 0, repMel = 0, nbar = 0;
  for (let i = 0; i + 1 < bars.length; i++) {
    const a = bars[i], b = bars[i + 1], len = b - a;
    const inBar = notes.filter((e) => e.t >= a - 1e-4 && e.t < b - 1e-4);
    const key = (f) => inBar.filter(f).map((e) => `${e.p}${e.k || ''}${e.m ?? ''}@${Math.round(((e.t - a) / len) * 48)}`).sort().join(',');
    const all = key(() => true), m = key((e) => e.m != null && e.p !== 'pad' && e.p !== 'bass' && e.p !== 'drum');
    nbar++;
    if (sig.has('a' + all)) rep++; sig.set('a' + all, 1);
    if (m && sig.has('m' + m)) repMel++; if (m) sig.set('m' + m, 1);
  }
  return {
    peak: +pk.toFixed(3), peakDb: +db(pk).toFixed(1), rmsDb: +db(rms).toFixed(1), crestDb: +(db(pk) - db(rms)).toFixed(1), nan, clip,
    width: +(side / (mid || 1)).toFixed(3), loudMin: Math.min(...live, 0), loudMax: Math.max(...live, -99), loud,
    balance, bars: bars.length, density, pcs, outOfMode: inMode + out ? Math.round(100 * out / (inMode + out)) : null, leaps, collPerMin: +(coll / (secs / 60)).toFixed(1),
    repeatBarsPct: nbar ? Math.round(100 * rep / nbar) : 0, repeatMelPct: nbar ? Math.round(100 * repMel / nbar) : 0, notes: notes.length,
  };
}

// ---------------- pictures ----------------
const COL = { kora: '#e8a33a', kalimba: '#7fd3ff', marimba: '#d1773a', balafon: '#d1773a', mbira: '#b58cff', flute: '#ffffff', bass: '#4f9a4f', pad: '#3a5a7a', chant: '#ff5a5a', voice: '#ff8a8a', bolon: '#7fbf6a', krar: '#ffd36a', ngoni: '#e8c23a', bell: '#c8ffd0' };
const DRUMS = ['dun', 'bass', 'ken', 'tone', 'slap', 'talk', 'talkDn', 'udu', 'heart', 'clap', 'bell', 'bellLo', 'shek', 'shekUp', 'shaker'];
export function drawRoll(canvas, r, { w = 900, h = 300 } = {}) {
  const { ev, secs } = r;
  canvas.width = w; canvas.height = h;
  const x = canvas.getContext('2d');
  x.fillStyle = '#14100c'; x.fillRect(0, 0, w, h);
  const lo = 26, hi = 100, drumH = 56, top = h - drumH;
  const X = (t) => (t / secs) * w, Y = (m) => top - ((m - lo) / (hi - lo)) * top;
  for (let m = lo; m <= hi; m++) if (m % 12 === 2) { x.fillStyle = '#2a2018'; x.fillRect(0, Y(m), w, 1); x.fillStyle = '#6e5a44'; x.font = '9px monospace'; x.fillText('D' + (Math.floor(m / 12) - 1), 2, Y(m) - 1); }
  for (const e of ev) if (e.p === 'bar') { x.fillStyle = e.first ? '#7a5434' : '#2e241a'; x.fillRect(X(e.t), 0, 1, h); if (e.th && e.first) { x.fillStyle = '#e0bb84'; x.font = '10px monospace'; x.fillText(e.th, X(e.t) + 2, 10); } }
  x.fillStyle = '#20180f'; x.fillRect(0, top, w, drumH);
  for (const e of ev) {
    if (e.p === 'bar') continue;
    if (e.p === 'drum') {
      const i = Math.max(0, DRUMS.indexOf(e.k));
      x.fillStyle = `hsla(${(i * 37) % 360},70%,60%,${0.35 + 0.65 * Math.min(1, e.v)})`;
      x.fillRect(X(e.t), top + 2 + i * 3.6, 2, 3);
      continue;
    }
    if (e.m == null) continue;
    x.fillStyle = COL[e.p] || '#ccc';
    x.globalAlpha = e.p === 'pad' ? 0.35 : 0.35 + 0.65 * Math.min(1, e.v);
    x.fillRect(X(e.t), Y(e.m) - 1.5, Math.max(2, X(e.t + Math.min(e.d, 4)) - X(e.t)), e.p === 'pad' ? 2 : 3);
    x.globalAlpha = 1;
  }
  x.font = '10px monospace'; let lx = w - 8;
  const seen = [...new Set(ev.filter((e) => e.m != null && e.p !== 'drum').map((e) => e.p))];
  for (const p of seen.reverse()) { const tw = x.measureText(p).width; lx -= tw + 10; x.fillStyle = COL[p] || '#ccc'; x.fillText(p, lx, 10); }
}
export function drawSpec(canvas, r, { w = 900, h = 180 } = {}) {
  const sp = spectra(r.buffer, w, 2048);
  canvas.width = w; canvas.height = h;
  const x = canvas.getContext('2d'), img = x.createImageData(w, h);
  const f0 = 30, f1 = sp.sr / 2;
  for (let c = 0; c < sp.frames.length; c++) {
    const f = sp.frames[c];
    for (let y = 0; y < h; y++) {
      const hz = f0 * Math.pow(f1 / f0, 1 - y / (h - 1)), bin = Math.min(f.length - 1, Math.round((hz * sp.N) / sp.sr));
      const v = Math.max(0, Math.min(1, (db(f[bin]) + 90) / 80));
      const o = (y * w + c) * 4;
      img.data[o] = 255 * Math.min(1, v * 1.6); img.data[o + 1] = 255 * Math.max(0, v * 1.5 - 0.5); img.data[o + 2] = 255 * Math.max(0, Math.min(1, 0.4 + v - v * v * 1.6)) * (v > 0.02 ? 1 : 0.2); img.data[o + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  x.fillStyle = '#ffffffaa'; x.font = '9px monospace';
  for (const hz of [60, 250, 1000, 2000, 6000]) { const y = (1 - Math.log(hz / f0) / Math.log(f1 / f0)) * (h - 1); x.fillRect(0, y, 6, 1); x.fillText(hz >= 1000 ? hz / 1000 + 'k' : hz, 8, y + 3); }
}

// 16-bit stereo WAV
export function wav(buffer) {
  const L = buffer.getChannelData(0), R = buffer.getChannelData(1), n = L.length, sr = buffer.sampleRate;
  const out = new DataView(new ArrayBuffer(44 + n * 4));
  const s = (o, str) => { for (let i = 0; i < str.length; i++) out.setUint8(o + i, str.charCodeAt(i)); };
  s(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); s(8, 'WAVEfmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true);
  out.setUint32(24, sr, true); out.setUint32(28, sr * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true); s(36, 'data'); out.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) { out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
  return new Uint8Array(out.buffer);
}

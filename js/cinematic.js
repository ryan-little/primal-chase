// The opening: real footage from the game under a few lines of narration, then the title.
// Driven by the main loop's clock; a key press (a tap on touch screens, or a pad button) skips it.
// A mouse click doesn't, so clicking into the tab never cuts it short.

// [start second, clip, seconds into the clip, line]. A null line keeps the one already up.
const SHOTS = [
  [0, 'dawn', 0.4, 'Before the fields and the walls there was the grass, and everything that moved in it.'],
  [6.2, 'hunt', 0.2, 'You were the fastest thing in it. You still are.'],
  [11.0, 'stampede', 1.6, 'The land had its own herds, and its own teeth.'],
  [14.0, 'pride', 1.2, null],
  [17.0, 'storm', 1.4, 'It had its storms, and its fires.'],
  [20.0, 'fire', 1.6, null],
  [23.0, 'camp', 0.6, 'Then they came. Thin, and slow, and upright. They carry water. They carry fire.'],
  [29.6, 'heat', 0.5, 'They do not run you down. They walk you down, through the heat of the day.'],
  [36.0, 'secret', 0.8, 'But the land is older than they are, and it keeps places only you can find.'],
  [42.2, 'night', 0.3, 'They follow your tracks into the dark. They sing to keep awake.'],
  [47.8, 'chase', 1.5, 'Every runner tires. They are counting on it.'],
];
const BLACK = 52.4; // footage fades out
const CATCH = 53.0; // "They always catch you."
const LOGO = 56.4; // title reveal
const END = 60.0;
const SPOKEN = SHOTS.filter((x) => x[3] !== null).length; // files 00..SPOKEN-1 are the shots' lines, then the two closing ones

// Narration read aloud with the browser's own speech voice, when it has one. A low, slow English
// voice is picked if available; no voice, or a browser that refuses to speak, just leaves the text.
let VOICE = null;
function pickVoice() {
  const all = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
  const en = all.filter((v) => /^en/i.test(v.lang));
  // neural voices first (Edge's "Natural" set, Chrome's Google voices, Apple's premium ones): they read like a person
  const want = [/Natural.*(Ryan|Thomas|Christopher|Guy|Eric|Davis|Andrew|Brian)/i, /(Ryan|Thomas|Christopher|Guy|Andrew|Brian).*Natural/i, /Natural/i,
    /Google UK English Male/i, /(Premium|Enhanced)/i, /Daniel/i, /Microsoft (Ryan|George|Guy)/i, /Male/i, /en-GB/i];
  for (const re of want) { const v = en.find((x) => re.test(x.name) || re.test(x.lang)); if (v) return v; }
  return en[0] || null;
}
function say(text) {
  const ss = window.speechSynthesis;
  if (!ss) return;
  ss.cancel();
  if (!text) return;
  VOICE = VOICE || pickVoice();
  const u = new SpeechSynthesisUtterance(text);
  if (VOICE) u.voice = VOICE;
  u.lang = (VOICE && VOICE.lang) || 'en-GB';
  // a neural voice is left at its own pitch (shifting it is what makes speech sound robotic); older voices get a lower, slower read
  const neural = VOICE && /Natural|Google|Premium|Enhanced/i.test(VOICE.name);
  u.rate = neural ? 0.9 : 0.86; u.pitch = neural ? 1 : 0.7; u.volume = 0.95;
  ss.speak(u);
}
// The narration proper: recorded lines in assets/voice (made with tools/voicegen.py), one file per
// spoken line in order. If a file won't play, the browser's speech voice reads the line instead.
let LINE = null;
function speak(i, text, vol = 1) {
  hush();
  const a = new Audio('assets/voice/' + String(i).padStart(2, '0') + '.mp3');
  a.volume = Math.max(0, Math.min(1, vol));
  LINE = a;
  const fallback = () => { if (LINE === a) { LINE = null; say(text); } };
  a.addEventListener('error', fallback);
  a.play().catch(fallback);
}
function hush() {
  if (LINE) { LINE.pause(); LINE = null; }
  say('');
}
if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => { VOICE = pickVoice(); };

export class Cinematic {
  constructor(layer, els, onDone) {
    this.layer = layer;
    this.el = els.root;
    this.line = els.line;
    this.logo = els.logo;
    this.skipEl = els.skip;
    this.onDone = onDone;
    this.t = 0;
    this.shot = -1;
    this.done = false;
    // a black veil the shots cut behind: dip out, change clip unseen, come back up on the new one
    this.dip = document.createElement('div');
    this.dip.className = 'dip';
    this.el.insertBefore(this.dip, this.el.firstChild);
    this.needGesture = els.needGesture || null; // () => true while the browser is holding sound back for a first press
    this.voice = els.voice !== false;
    this.voiceVol = els.voiceVol ?? 1; // narration spoken aloud (settings can turn it off)
    this.padHeld = true; // a button already down at load doesn't count until it's released
    this.skipAsked = false;
    const touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    this.skipEl.textContent = touch ? 'Tap to skip' : 'Press any key to skip';
    if (touch) this.el.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { e.preventDefault(); this.skipAsked = true; } });
  }

  start() {
    this.el.classList.remove('hidden');
    this.layer.show();
    this.layer.prime?.(SHOTS[0][1]);
  }

  setLine(text, cls = '') {
    if (this.line.dataset.text === text) return;
    this.line.dataset.text = text;
    this.line.classList.remove('on');
    clearTimeout(this.lineT);
    // let the old line fade before the new one arrives
    this.lineT = setTimeout(() => {
      this.line.textContent = text;
      this.line.className = cls;
      if (text) requestAnimationFrame(() => this.line.classList.add('on'));
    }, this.line.textContent ? 450 : 0);
  }

  // inp: this frame's input; pad: the connected gamepad, if any
  update(dt, inp, pad) {
    if (this.done) return;
    // skip: a real key (not pad-stick drift), a tap, or a fresh pad button
    const padDown = !!(pad && pad.buttons.some((b) => b.pressed));
    if (!padDown) this.padHeld = false;
    const key = [...inp.edges].some((k) => !k.startsWith('Nav'));
    const pressed = this.skipAsked || key || (padDown && !this.padHeld);
    if (padDown) this.padHeld = true;
    // Autoplay refused: hold at the start until the first press, which begins it instead of skipping.
    // Sound refused until a press (most browsers, first visit): wait at the start like a refused video does,
    // so the music and the narration begin with the pictures instead of joining late.
    this.wait = (this.wait || 0) + dt;
    const mute = this.t < 1.5 && !this.begun && this.needGesture && this.needGesture() && this.wait > 0.35;
    if (this.gated && this.muteGate && !this.needGesture()) { this.gated = false; this.muteGate = false; this.skipEl.classList.remove('gate'); } // it came on by itself
    if (this.layer.blocked || this.gated || mute) {
      if (!this.gated) {
        this.muteGate = !this.layer.blocked;
        this.gated = true;
        const touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
        this.skipEl.textContent = touch ? 'Tap to begin' : 'Press any key to begin';
        this.skipEl.classList.add('on', 'gate');
      }
      if (!pressed) return;
      this.gated = false; this.skipAsked = false; this.begun = true;
      this.layer.blocked = false;
      this.t = 0; this.shot = -1;
      const touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
      this.skipEl.textContent = touch ? 'Tap to skip' : 'Press any key to skip';
      this.skipEl.classList.remove('gate');
      return;
    }
    if (pressed) { this.finish(); return; }
    if (this.needGesture && !this.begun && this.wait < 0.45) return; // settle whether sound is allowed before the first line starts
    this.t += dt;
    const t = this.t;

    let i = -1;
    for (let k = 0; k < SHOTS.length; k++) if (t >= SHOTS[k][0]) i = k;
    if (i !== this.shot && t < BLACK) {
      this.shot = i;
      const [, clip, from, text] = SHOTS[i];
      if (text !== null && this.voice) speak(SHOTS.slice(0, i).filter((x) => x[3] !== null).length, text, this.voiceVol);
      if (i === 0) this.layer.play(clip, from, 1.6);
      else {
        const shot = i;
        this.dip.classList.add('on');
        clearTimeout(this.dipT);
        this.dipT = setTimeout(() => {
          if (this.done || this.shot !== shot) return;
          let lifted = false;
          const lift = () => { if (lifted) return; lifted = true; setTimeout(() => this.dip.classList.remove('on'), 120); };
          this.layer.play(clip, from, 0.05, lift);
          setTimeout(lift, 900); // never sit in the dark if the clip is slow to start
        }, 340);
      }
      if (SHOTS[i + 1]) setTimeout(() => this.layer.prime(SHOTS[i + 1][1]), 1200);
      if (text !== null) this.setLine(text);
    }
    if (t >= BLACK) { this.el.classList.add('black'); this.dip.classList.remove('on'); }
    if (t >= BLACK && t < CATCH) this.setLine('');
    if (t >= CATCH && t < LOGO) { if (this.voice && !this.saidCatch) { this.saidCatch = true; speak(SPOKEN, 'They always catch you.', this.voiceVol); } this.setLine('They always catch you.', 'big'); }
    this.logoSoon = t > LOGO - 1.4;
    if (t >= LOGO) { if (this.voice && !this.saidTag) { this.saidTag = true; speak(SPOKEN + 1, 'How long can you run?', this.voiceVol); } this.setLine('How long can you run?', 'tag'); this.logo.classList.add('on'); }
    this.skipEl.classList.toggle('on', t > 1 && t < LOGO);
    if (t >= END) this.finish();
  }

  finish() {
    if (this.done) return;
    this.done = true;
    hush();
    clearTimeout(this.lineT);
    this.el.classList.add('out');
    setTimeout(() => this.el.classList.add('hidden'), 1900); // the title comes up out of the black
    this.onDone();
  }
}

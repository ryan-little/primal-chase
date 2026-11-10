// The opening: real footage from the game under a few lines of narration, then the title.
// Driven by the main loop's clock; a key press (a tap on touch screens, or a pad button) skips it.
// A mouse click doesn't, so clicking into the tab never cuts it short.

// [start second, clip, seconds into the clip, line]. A null line keeps the one already up.
const SHOTS = [
  [0, 'dawn', 0.4, 'Before the fields and the walls there was the grass, and everything that moved in it.'],
  [6.2, 'hunt', 0.2, 'You were the fastest thing in it. You still are.'],
  [11.0, 'stampede', 1.6, 'The land had its own herds, and its own teeth.'],
  [14.0, 'pride', 1.2, null],
  [17.0, 'camp', 0.6, 'Then they came. Thin, and slow, and upright. They carry water. They carry fire.'],
  [23.6, 'heat', 0.5, 'They do not run you down. They walk you down, through the heat of the day.'],
  [30.0, 'secret', 0.8, 'But the land is older than they are, and it keeps places only you can find.'],
  [36.2, 'night', 0.3, 'They follow your tracks into the dark. They sing to keep awake.'],
  [41.8, 'chase', 1.5, 'Every runner tires. They are counting on it.'],
];
const BLACK = 46.4; // footage fades out
const CATCH = 47.0; // "They always catch you."
const LOGO = 50.4; // title reveal
const END = 54.0;

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
    this.voice = els.voice !== false; // narration spoken aloud (settings can turn it off)
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
    if (this.layer.blocked || this.gated) {
      if (!this.gated) {
        this.gated = true;
        const touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
        this.skipEl.textContent = touch ? 'Tap to begin' : 'Press any key to begin';
        this.skipEl.classList.add('on', 'gate');
      }
      if (!pressed) return;
      this.gated = false; this.skipAsked = false;
      this.layer.blocked = false;
      this.t = 0; this.shot = -1;
      const touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
      this.skipEl.textContent = touch ? 'Tap to skip' : 'Press any key to skip';
      this.skipEl.classList.remove('gate');
      return;
    }
    if (pressed) { this.finish(); return; }
    this.t += dt;
    const t = this.t;

    let i = -1;
    for (let k = 0; k < SHOTS.length; k++) if (t >= SHOTS[k][0]) i = k;
    if (i !== this.shot && t < BLACK) {
      this.shot = i;
      const [, clip, from, text] = SHOTS[i];
      if (text !== null && this.voice) say(text);
      this.layer.play(clip, from, i === 0 ? 1.6 : 0.8);
      if (SHOTS[i + 1]) setTimeout(() => this.layer.prime(SHOTS[i + 1][1]), 1200);
      if (text !== null) this.setLine(text);
    }
    if (t >= BLACK) this.el.classList.add('black');
    if (t >= BLACK && t < CATCH) this.setLine('');
    if (t >= CATCH && t < LOGO) { if (this.voice && !this.saidCatch) { this.saidCatch = true; say('They always catch you.'); } this.setLine('They always catch you.', 'big'); }
    this.logoSoon = t > LOGO - 1.4;
    if (t >= LOGO) { this.setLine('How long can you run?', 'tag'); this.logo.classList.add('on'); }
    this.skipEl.classList.toggle('on', t > 1 && t < LOGO);
    if (t >= END) this.finish();
  }

  finish() {
    if (this.done) return;
    this.done = true;
    say('');
    clearTimeout(this.lineT);
    this.el.classList.add('out');
    setTimeout(() => this.el.classList.add('hidden'), 700);
    this.onDone();
  }
}

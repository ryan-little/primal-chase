// The opening: real footage from the game under a few lines of narration, then the title.
// Driven by the main loop's clock; a key press (a tap on touch screens, or a pad button) skips it.
// A mouse click doesn't, so clicking into the tab never cuts it short.

// [start second, clip, seconds into the clip, line]
const SHOTS = [
  [0, 'dawn', 0.4, 'Before the fields and the walls there was the grass, and what moved in it.'],
  [4.6, 'hunt', 0.2, 'You were the fastest thing in it. You still are.'],
  [9.2, 'band', 0.0, 'Then they came. Thin, and slow, and upright. They carry water. They carry fire.'],
  [14.2, 'heat', 0.5, 'They do not run you down. They walk you down, through the heat, while every other thing lies still.'],
  [19.6, 'night', 0.3, 'They follow your tracks into the dark. They sing to keep awake.'],
  [24.2, 'chase', 3.0, 'Every runner tires. They are counting on it.'],
];
const BLACK = 28.6; // footage fades out
const CATCH = 29.2; // "They always catch you."
const LOGO = 32.4; // title reveal
const END = 36.0;

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
        this.skipEl.classList.add('on');
      }
      if (!pressed) return;
      this.gated = false; this.skipAsked = false;
      this.layer.blocked = false;
      this.t = 0; this.shot = -1;
      const touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
      this.skipEl.textContent = touch ? 'Tap to skip' : 'Press any key to skip';
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
      this.layer.play(clip, from, i === 0 ? 1.6 : 0.8);
      if (SHOTS[i + 1]) setTimeout(() => this.layer.prime(SHOTS[i + 1][1]), 1200);
      this.setLine(text);
    }
    if (t >= BLACK) this.el.classList.add('black');
    if (t >= BLACK && t < CATCH) this.setLine('');
    if (t >= CATCH && t < LOGO) this.setLine('They always catch you.', 'big');
    if (t >= LOGO) { this.setLine('How long can you run?', 'tag'); this.logo.classList.add('on'); }
    this.skipEl.classList.toggle('on', t > 1 && t < LOGO);
    if (t >= END) this.finish();
  }

  finish() {
    if (this.done) return;
    this.done = true;
    clearTimeout(this.lineT);
    this.el.classList.add('out');
    setTimeout(() => this.el.classList.add('hidden'), 700);
    this.onDone();
  }
}

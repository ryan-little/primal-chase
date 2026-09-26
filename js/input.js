// Keyboard, gamepad and touch, folded into one small input state.

export class Input {
  constructor(el) {
    this.keys = new Set();
    this.edges = new Set();
    this.touch = { id: null, ox: 0, oy: 0, x: 0, y: 0, active: false };
    this.touchPounce = false;
    this.touchSprint = false;
    this.usingTouch = false;
    this.padPrev = {};
    this.lastDevice = 'keyboard';

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Space'].includes(e.key) || e.code === 'Space') e.preventDefault();
      const k = e.code;
      if (!this.keys.has(k)) this.edges.add(k);
      this.keys.add(k);
      this.lastDevice = 'keyboard';
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    const stick = document.getElementById('stick');
    const knob = document.getElementById('knob');
    this.stickEl = stick;
    this.knobEl = knob;
    el.addEventListener('touchstart', (e) => {
      this.usingTouch = true;
      document.body.classList.add('touch');
      for (const t of e.changedTouches) {
        if (t.clientX < window.innerWidth * 0.55 && this.touch.id === null) {
          this.touch = { id: t.identifier, ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY, active: true };
          stick.style.left = t.clientX + 'px';
          stick.style.top = t.clientY + 'px';
          stick.classList.add('on');
        }
      }
      e.preventDefault();
    }, { passive: false });
    el.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.touch.id) {
          this.touch.x = t.clientX;
          this.touch.y = t.clientY;
          const dx = t.clientX - this.touch.ox, dy = t.clientY - this.touch.oy;
          const R = 56, l = Math.hypot(dx, dy);
          const k = l > R ? R / l : 1;
          knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
          // drag the stick base along if the thumb runs past it
          if (l > R * 1.6) {
            this.touch.ox = t.clientX - (dx / l) * R * 1.6;
            this.touch.oy = t.clientY - (dy / l) * R * 1.6;
            stick.style.left = this.touch.ox + 'px';
            stick.style.top = this.touch.oy + 'px';
          }
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.touch.id) {
          this.touch = { id: null, active: false };
          knob.style.transform = '';
          stick.classList.remove('on');
        }
      }
    };
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);

    const pb = document.getElementById('btn-pounce');
    const sb = document.getElementById('btn-sprint');
    pb.addEventListener('touchstart', (e) => { this.touchPounce = true; pb.classList.add('down'); e.preventDefault(); }, { passive: false });
    pb.addEventListener('touchend', () => pb.classList.remove('down'));
    sb.addEventListener('touchstart', (e) => { this.touchSprint = !this.touchSprint; sb.classList.toggle('down', this.touchSprint); e.preventDefault(); }, { passive: false });
  }

  pad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }

  read() {
    const K = this.keys;
    let x = 0, y = 0;
    if (K.has('KeyA') || K.has('ArrowLeft')) x -= 1;
    if (K.has('KeyD') || K.has('ArrowRight')) x += 1;
    if (K.has('KeyW') || K.has('ArrowUp')) y -= 1;
    if (K.has('KeyS') || K.has('ArrowDown')) y += 1;
    let sprint = K.has('ShiftLeft') || K.has('ShiftRight');
    let pounce = this.edges.has('Space') || this.edges.has('KeyJ');
    let pause = this.edges.has('Escape') || this.edges.has('KeyP');
    let confirm = this.edges.has('Enter') || this.edges.has('NumpadEnter');

    const gp = this.pad();
    if (gp) {
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      if (Math.hypot(ax, ay) > 0.2) { x = ax; y = ay; this.lastDevice = 'pad'; }
      const b = (i) => gp.buttons[i] && gp.buttons[i].pressed;
      if (b(12)) y = -1; if (b(13)) y = 1; if (b(14)) x = -1; if (b(15)) x = 1;
      if (b(7) || b(5) || b(1)) sprint = true;
      const edge = (i) => b(i) && !this.padPrev[i];
      if (edge(0) || edge(2)) { pounce = true; this.lastDevice = 'pad'; }
      if (edge(9)) pause = true;
      if (edge(0) || edge(9)) confirm = true;
      for (let i = 0; i < gp.buttons.length; i++) this.padPrev[i] = b(i);
    }

    if (this.touch.active) {
      const dx = this.touch.x - this.touch.ox, dy = this.touch.y - this.touch.oy;
      const l = Math.hypot(dx, dy);
      if (l > 6) {
        x = dx / 56; y = dy / 56;
        const m = Math.hypot(x, y);
        if (m > 1) { x /= m; y /= m; }
      }
      // pushing the stick to its rim is a sprint
      if (l > 50) sprint = true;
    }
    if (this.touchSprint) sprint = true;
    if (this.touchPounce) { pounce = true; this.touchPounce = false; }

    const edges = new Set(this.edges);
    this.edges.clear();
    return { x, y, sprint, pounce, pause, confirm, edges };
  }
}

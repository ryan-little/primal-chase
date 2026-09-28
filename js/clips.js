// Pre-recorded gameplay behind the title and the opening: two muted <video>s that cross-dissolve,
// over a still poster that shows whenever video can't play (autoplay refused, low-power mode,
// Save-Data, reduced motion, a codec the device lacks). Clips come from tools/clips.mjs.

const DIR = 'assets/clips/';
export const CLIPS = ['dawn', 'band', 'heat', 'night', 'chase', 'hunt', 'stampede', 'storm', 'fire', 'highland'];

export class ClipLayer {
  constructor(root) {
    this.root = root;
    this.vids = [...root.querySelectorAll('video')];
    this.cur = null; // the video on screen
    this.token = 0;
    this.fade = 1.2;
    this.onNearEnd = null; // (secondsLeft) => void, for the title reel
    const conn = navigator.connection;
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.enabled = !(conn && conn.saveData) && !reduce && !!document.createElement('video').canPlayType('video/mp4; codecs="avc1.640028"');
    for (const v of this.vids) {
      v.muted = true; v.defaultMuted = true; v.playsInline = true; v.loop = false;
      v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', '');
      v.disableRemotePlayback = true;
      v.addEventListener('timeupdate', () => {
        if (v === this.cur && this.onNearEnd && v.duration) this.onNearEnd(v.duration - v.currentTime);
      });
      // nothing queued in time: hold on this clip rather than freezing on its last frame
      v.addEventListener('ended', () => { if (v === this.cur) { v.currentTime = 0; v.play().catch(() => {}); } });
      v.addEventListener('error', () => { if (v === this.cur) this.root.classList.remove('live'); });
    }
    document.addEventListener('visibilitychange', () => {
      if (!this.cur || this.root.classList.contains('hidden')) return;
      if (document.hidden) this.cur.pause(); else this.cur.play().catch(() => {});
    });
  }

  // Load a clip into the idle video ahead of time so the next cut starts instantly.
  prime(name) {
    if (!this.enabled || !this.cur) return false;
    const v = this.vids.find((x) => x !== this.cur);
    if (v.classList.contains('on')) return false; // still dissolving out
    const src = DIR + name + '.mp4';
    if (v.dataset.clip === name) return true;
    v.dataset.clip = name;
    v.preload = 'auto';
    v.src = src;
    v.load();
    return true;
  }

  // Cut (with a dissolve of `fade` seconds) to clip `name`, starting `from` seconds in.
  play(name, from = 0, fade = this.fade) {
    if (!this.enabled) return;
    this.want = [name, from, fade];
    const tok = ++this.token;
    const v = this.vids.find((x) => x !== this.cur);
    const old = this.cur;
    if (v.dataset.clip !== name) { v.dataset.clip = name; v.preload = 'auto'; v.src = DIR + name + '.mp4'; }
    const seekAndGo = () => {
      if (tok !== this.token) return;
      if (from > 0 && Math.abs(v.currentTime - from) > 0.05) v.currentTime = from;
      else if (from === 0 && v.currentTime > 0.05) v.currentTime = 0;
      v.play().then(() => {
        if (tok !== this.token) return;
        const show = () => {
          if (tok !== this.token) return;
          this.cur = v;
          v.style.transitionDuration = fade + 's';
          v.classList.add('top', 'on');
          if (old) {
            old.classList.remove('top');
            setTimeout(() => { if (tok === this.token && old !== this.cur) { old.classList.remove('on'); old.pause(); } }, fade * 1000 + 60);
          }
          this.root.classList.add('live');
        };
        // wait for a real frame so the dissolve never fades in a blank
        if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(show); else show();
      }).catch((err) => {
        if (tok !== this.token) return;
        // the browser blocks autoplay until the player interacts (e.g. Firefox/Zen "block audio and video")
        if (err && err.name === 'NotAllowedError') this.blocked = true;
        if (!old) this.root.classList.remove('live');
      });
    };
    if (v.readyState >= 1) seekAndGo(); else v.addEventListener('loadedmetadata', seekAndGo, { once: true });
  }

  // After the first key or tap, try again what autoplay refused.
  unblock() {
    if (!this.blocked) return false;
    this.blocked = false;
    if (this.want && !this.root.classList.contains('hidden')) this.play(...this.want);
    return true;
  }

  show() { this.root.classList.remove('hidden'); }
  hide() {
    this.token++;
    this.onNearEnd = null;
    this.cur = null;
    this.root.classList.add('hidden');
    this.root.classList.remove('live');
    for (const v of this.vids) { v.pause(); v.classList.remove('on', 'top'); }
  }
}

// The title background: clips in shuffled order, never the same one twice running.
export class TitleReel {
  constructor(layer) {
    this.layer = layer;
    this.order = [];
    this.last = null;
  }
  pick() {
    if (!this.order.length) {
      this.order = CLIPS.slice().sort(() => Math.random() - 0.5);
      if (this.order[0] === this.last) this.order.push(this.order.shift());
    }
    return (this.last = this.order.shift());
  }
  // From whatever is on screen (the opening's last shot, if any), keep cutting to fresh clips.
  start() {
    const L = this.layer;
    L.show();
    if (!L.cur) L.play(this.pick(), 0);
    let next = this.pick(), primed = false, from = null, since = 0;
    L.onNearEnd = (left) => {
      if (from) { // a cut is under way: wait for it to land (or give up on a clip that never loads)
        if (L.cur === from && performance.now() - since < 8000) return;
        from = null;
      }
      if (!primed) primed = L.prime(next);
      if (left > L.fade + 0.15) return;
      from = L.cur; since = performance.now();
      L.play(next, 0);
      next = this.pick();
      primed = false;
    };
  }
  stop() { this.layer.hide(); }
}

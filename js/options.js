// ============================================================
// OPTIONS.JS — persisted player settings for the 3D build
// Same storage key and shape as V1's Options (declared inside
// js/ui.js), so a player's settings carry across both versions.
// The classic build keeps using its own copy; only one of the two
// files is ever loaded on a given page.
// ============================================================

const Options = {
  _defaults: {
    difficulty: 'normal',
    showTutorial: true,
    showOpening: true,
    typewriterEffect: true,
    situationTypewriter: true,
    typewriterSpeed: 30,
    // 3D-only
    quality: 'auto',
    cameraShake: true,
    showTrail: true,
    reduceMotion: false
  },

  _values: null,

  load() {
    try {
      const stored = localStorage.getItem('primalChaseOptions');
      this._values = stored ? { ...this._defaults, ...JSON.parse(stored) } : { ...this._defaults };
    } catch (e) {
      this._values = { ...this._defaults };
    }
    // Respect the OS-level preference unless the player has overridden it.
    if (this._values.reduceMotion === undefined || this._values.reduceMotion === null) {
      this._values.reduceMotion = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  },

  save() {
    try {
      localStorage.setItem('primalChaseOptions', JSON.stringify(this._values));
    } catch (e) { /* private browsing */ }
  },

  get(key) {
    if (!this._values) this.load();
    return this._values[key] !== undefined ? this._values[key] : this._defaults[key];
  },

  set(key, value) {
    if (!this._values) this.load();
    this._values[key] = value;
    this.save();
  },

  toggle(key) {
    this.set(key, !this.get(key));
    return this.get(key);
  }
};

if (typeof window !== 'undefined') window.Options = Options;

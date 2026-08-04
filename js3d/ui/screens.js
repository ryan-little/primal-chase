// ============================================================
// SCREENS.JS — everything that is not the HUD
// Title, cinematic intro, how-to, options, leaderboard, pause and
// the death screen. Scoring, achievements and sharing all come from
// V1's score.js unchanged.
// ============================================================

const $ = (id) => document.getElementById(id);

const SCREENS = ['screen-loading', 'screen-unsupported', 'screen-title', 'screen-death',
  'screen-leaderboard', 'screen-howto', 'screen-options', 'screen-pause'];

export const Screens = {
  current: null,
  _returnTo: 'screen-title',
  _typewriterTimer: null,
  _introSkip: null,

  /** Wired up by main.js. */
  onStart: null,
  onResume: null,
  onAbandon: null,
  onQualityChange: null,
  onOptionChange: null,

  init() {
    this.bind();
    this.syncOptions();
    const fb = $('feedback-email');
    if (fb) fb.href = 'mai' + 'lto:' + 'ryan' + '@' + 'ryanpdlittle' + '.com';
  },

  show(id) {
    for (const s of SCREENS) {
      const el = $(s);
      if (el) el.classList.toggle('active', s === id);
    }
    document.body.className = id ? id.replace('screen-', 'screen-') + '-active' : '';
    this.current = id;
  },

  hideAll() {
    for (const s of SCREENS) { const el = $(s); if (el) el.classList.remove('active'); }
    document.body.className = 'screen-game-active';
    this.current = null;
  },

  setLoading(fraction, text) {
    const fill = $('loading-fill');
    if (fill) fill.style.width = Math.round(fraction * 100) + '%';
    if (text) $('loading-text').textContent = text;
  },

  // ------------------------------------------------------------
  // Bindings
  // ------------------------------------------------------------

  bind() {
    $('btn-start').addEventListener('click', () => this.startFlow());
    $('btn-howto').addEventListener('click', () => { this._returnTo = 'screen-title'; this.show('screen-howto'); });
    $('btn-options').addEventListener('click', () => { this._returnTo = 'screen-title'; this.show('screen-options'); });
    $('btn-leaderboard').addEventListener('click', () => this.renderLeaderboard());

    $('btn-howto-back').addEventListener('click', () => this.show(this._returnTo));
    $('btn-options-back').addEventListener('click', () => this.show(this._returnTo));
    $('btn-leaderboard-back').addEventListener('click', () => this.show('screen-title'));
    $('btn-leaderboard-clear').addEventListener('click', () => {
      if (typeof Score !== 'undefined') Score.clearLeaderboard();
      this.renderLeaderboard();
    });

    $('btn-resume').addEventListener('click', () => { this.hideAll(); if (this.onResume) this.onResume(); });
    $('btn-pause-howto').addEventListener('click', () => { this._returnTo = 'screen-pause'; this.show('screen-howto'); });
    $('btn-pause-options').addEventListener('click', () => { this._returnTo = 'screen-pause'; this.show('screen-options'); });
    $('btn-abandon').addEventListener('click', () => { this.show('screen-title'); if (this.onAbandon) this.onAbandon(); });

    $('btn-try-again').addEventListener('click', () => this.startFlow(true));
    $('btn-return-title').addEventListener('click', () => { this.show('screen-title'); if (this.onAbandon) this.onAbandon(); });
    $('btn-share-text').addEventListener('click', (e) => {
      if (this._scoreData && typeof Score !== 'undefined') {
        Score.copyToClipboard(Score.generateShareText(this._scoreData), e.currentTarget);
      }
    });
    $('btn-share-image').addEventListener('click', () => {
      if (this._scoreData && typeof Score !== 'undefined') Score.generateShareImage(this._scoreData);
    });

    // Options
    for (const btn of document.querySelectorAll('.option-btn')) {
      btn.addEventListener('click', () => {
        const key = btn.dataset.option;
        Options.set(key, btn.dataset.value);
        this.syncOptions();
        if (key === 'quality' && this.onQualityChange) this.onQualityChange(btn.dataset.value);
        if (this.onOptionChange) this.onOptionChange(key, btn.dataset.value);
      });
    }
    for (const btn of document.querySelectorAll('.option-toggle')) {
      btn.addEventListener('click', () => {
        const key = btn.dataset.option;
        Options.toggle(key);
        this.syncOptions();
        if (this.onOptionChange) this.onOptionChange(key, Options.get(key));
      });
    }
    const slider = $('opt-typewriter-speed');
    slider.addEventListener('input', () => Options.set('typewriterSpeed', parseInt(slider.value, 10)));
  },

  syncOptions() {
    for (const btn of document.querySelectorAll('.option-btn')) {
      btn.classList.toggle('active', Options.get(btn.dataset.option) === btn.dataset.value);
    }
    for (const btn of document.querySelectorAll('.option-toggle')) {
      const on = !!Options.get(btn.dataset.option);
      btn.classList.toggle('active', on);
      btn.textContent = on ? 'ON' : 'OFF';
    }
    const slider = $('opt-typewriter-speed');
    if (slider) slider.value = Options.get('typewriterSpeed');
    const speedRow = document.querySelector('.speed-row');
    if (speedRow) speedRow.style.display = Options.get('typewriterEffect') ? '' : 'none';
  },

  // ------------------------------------------------------------
  // Start flow
  // ------------------------------------------------------------

  startFlow(skipIntro) {
    const wantsIntro = Options.get('showOpening') && !skipIntro;
    if (!wantsIntro) {
      this.hideAll();
      if (this.onStart) this.onStart();
      return;
    }
    this.playIntro(() => {
      this.hideAll();
      if (this.onStart) this.onStart();
    });
  },

  playIntro(done) {
    const overlay = $('typewriter-overlay');
    const content = $('typewriter-content');
    const set = NARRATIVE.intros[Math.floor(Math.random() * NARRATIVE.intros.length)];
    overlay.classList.add('active');
    content.textContent = '';

    let paragraph = 0;
    let finished = false;
    const speed = Options.get('typewriterEffect') && !Options.get('reduceMotion')
      ? Options.get('typewriterSpeed') : 0;

    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(this._typewriterTimer);
      document.removeEventListener('keydown', onKey);
      overlay.removeEventListener('click', onTap);
      overlay.removeEventListener('touchstart', onTap);
      overlay.classList.remove('active');
      if (done) done();
    };
    const onKey = (e) => { if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') { e.preventDefault(); finish(); } };
    const onTap = () => finish();
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', onTap);
    overlay.addEventListener('touchstart', onTap, { passive: true });
    this._introSkip = finish;

    const nextParagraph = () => {
      if (finished) return;
      if (paragraph >= set.length) { this._typewriterTimer = setTimeout(finish, 900); return; }
      const text = set[paragraph++];
      if (speed === 0) {
        content.textContent = text;
        this._typewriterTimer = setTimeout(nextParagraph, 1900);
        return;
      }
      let i = 0;
      const type = () => {
        if (finished) return;
        content.textContent = text.slice(0, ++i);
        if (i < text.length) this._typewriterTimer = setTimeout(type, speed);
        else this._typewriterTimer = setTimeout(nextParagraph, 1500);
      };
      content.textContent = '';
      type();
    };
    nextParagraph();
  },

  // ------------------------------------------------------------
  // Leaderboard
  // ------------------------------------------------------------

  renderLeaderboard() {
    this.show('screen-leaderboard');
    const tbody = $('leaderboard-body');
    tbody.innerHTML = '';
    const scores = (typeof Score !== 'undefined') ? Score.loadLeaderboard() : [];
    if (!scores.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5;
      td.className = 'leaderboard-empty';
      td.textContent = 'No runs yet. The land is waiting.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }
    scores.forEach((s, i) => {
      const tr = document.createElement('tr');
      for (const value of [i + 1, s.days, `${s.distance} mi`, s.timesLostHunters || 0, formatCause(s.deathCause)]) {
        const td = document.createElement('td');
        td.textContent = value;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
  },

  // ------------------------------------------------------------
  // Death
  // ------------------------------------------------------------

  /**
   * @param {Object} state - final game state
   * @param {Array<string>} extraAchievements - spatial achievements from Game3D
   */
  renderDeath(state, extraAchievements) {
    this.show('screen-death');

    $('death-cause-badge').textContent =
      (typeof Score !== 'undefined') ? Score.formatDeathCauseUpper(state.deathCause) : String(state.deathCause).toUpperCase();

    const pool = NARRATIVE.deaths[state.deathCause] || NARRATIVE.deaths.caught;
    const narrative = pool[Math.floor(Math.random() * pool.length)];
    const el = $('death-narrative');

    const reveal = () => this._renderScore(state, extraAchievements);

    clearTimeout(this._typewriterTimer);
    if (Options.get('typewriterEffect') && !Options.get('reduceMotion')) {
      el.textContent = '';
      let i = 0;
      let skipped = false;
      const onSkip = (e) => {
        if (e.type === 'keydown' && e.code !== 'Space') return;
        if (e.type === 'keydown') e.preventDefault();
        skipped = true;
      };
      document.addEventListener('keydown', onSkip);
      $('screen-death').addEventListener('click', onSkip);
      const cleanup = () => {
        document.removeEventListener('keydown', onSkip);
        $('screen-death').removeEventListener('click', onSkip);
      };
      const type = () => {
        if (skipped) { el.textContent = narrative; cleanup(); reveal(); return; }
        i = Math.min(narrative.length, i + 2);
        el.textContent = narrative.slice(0, i);
        if (i < narrative.length) this._typewriterTimer = setTimeout(type, CONFIG.typewriter.speed / 2);
        else { cleanup(); reveal(); }
      };
      type();
    } else {
      el.textContent = narrative;
      reveal();
    }
  },

  _renderScore(state, extraAchievements) {
    if (typeof Score === 'undefined') return;
    const scoreData = Score.calculate(state);
    if (extraAchievements && extraAchievements.length) {
      scoreData.achievements = scoreData.achievements.concat(extraAchievements);
    }
    this._scoreData = scoreData;

    $('score-days').textContent = scoreData.days;
    $('score-distance').textContent = `${scoreData.distance} mi`;
    $('score-regions').textContent = `${Object.keys(state.regionsVisited || {}).length} lands`;

    const pct = $('percentile-stats');
    pct.innerHTML = '';
    for (const line of Score.calculatePercentiles(scoreData)) {
      const div = document.createElement('div');
      div.textContent = line;
      pct.appendChild(div);
    }

    const list = $('achievements-list');
    list.innerHTML = '';
    scoreData.achievements.forEach((a, i) => {
      const div = document.createElement('div');
      div.className = 'achievement';
      div.textContent = a;
      div.style.animationDelay = (i * 90) + 'ms';
      list.appendChild(div);
    });

    Score.save(scoreData);
  }
};

function formatCause(cause) {
  const map = {
    caught: 'Caught', heatstroke: 'Heatstroke', exhaustion: 'Exhaustion',
    dehydration: 'Dehydration', starvation: 'Starvation'
  };
  return map[cause] || (cause ? cause[0].toUpperCase() + cause.slice(1) : '—');
}

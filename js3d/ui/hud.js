// ============================================================
// HUD.JS — the in-game overlay
// Vitals, the hunter tracker, the situation panel, the action bar
// and the move preview. Pure DOM; it never touches the 3D scene.
// ============================================================

const $ = (id) => document.getElementById(id);

/** Danger colours, matching V1's thresholds. */
const DANGER = [
  [0.85, '#c44536'],
  [0.70, '#c4763a'],
  [0.55, '#c49a3a'],
  [0.00, '#4a7c3f']
];

function dangerColor(fraction) {
  for (const [threshold, color] of DANGER) if (fraction >= threshold) return color;
  return DANGER[DANGER.length - 1][1];
}

export const HUD = {
  el: {},
  _typewriterTimer: null,
  _typewriterDone: true,
  _hintDismissed: false,
  onAction: null,        // (actionKey) => void
  onMoveConfirm: null,
  onMoveCancel: null,

  init() {
    const ids = ['hud', 'phase-indicator', 'bar-heat', 'bar-stamina', 'bar-thirst', 'bar-hunger',
      'val-heat', 'val-stamina', 'val-thirst', 'val-hunger', 'tracker', 'tracker-label',
      'tracker-distance', 'tracker-fill', 'tracker-sub', 'hunt-flavor', 'panel', 'panel-body',
      'panel-title', 'panel-toggle', 'situation-text', 'monologue', 'spatial-note',
      'move-preview', 'mp-terrain', 'mp-gait', 'mp-costs', 'mp-notes', 'mp-go', 'mp-cancel',
      'action-bar', 'hint', 'vignette', 'flash'];
    for (const id of ids) this.el[id] = $(id);

    this.el['panel-toggle'].addEventListener('click', () => {
      const collapsed = this.el.panel.classList.toggle('collapsed');
      this.el['panel-toggle'].setAttribute('aria-expanded', String(!collapsed));
    });
    this.el['mp-go'].addEventListener('click', () => this.onMoveConfirm && this.onMoveConfirm());
    this.el['mp-cancel'].addEventListener('click', () => this.onMoveCancel && this.onMoveCancel());
  },

  show() { this.el.hud.hidden = false; },
  hide() { this.el.hud.hidden = true; this.hideMovePreview(); },

  // ------------------------------------------------------------
  // Vitals & tracker
  // ------------------------------------------------------------

  renderPhase(state) {
    const el = this.el['phase-indicator'];
    el.textContent = `${state.phase === 'night' ? 'NIGHT' : 'DAY'} ${state.day}`;
    el.classList.toggle('night', state.phase === 'night');
  },

  renderVitals(state) {
    // Fatigue is displayed inverted: the bar shows how spent you are.
    this._bar('heat', state.heat, state.heat / 100);
    this._bar('stamina', 100 - state.stamina, (100 - state.stamina) / 100);
    this._bar('thirst', state.thirst, state.thirst / 100);
    this._bar('hunger', state.hunger, state.hunger / 100);
  },

  _bar(name, displayValue, fraction) {
    const bar = this.el['bar-' + name];
    const val = this.el['val-' + name];
    const pct = Math.max(0, Math.min(100, Math.round(displayValue)));
    bar.style.width = pct + '%';
    bar.style.backgroundColor = dangerColor(fraction);
    val.textContent = pct + '%';
    const wrap = bar.closest('.vital');
    if (wrap) wrap.classList.toggle('critical', fraction >= 0.85);
  },

  renderTracker(state) {
    const max = CONFIG.ui.hunterTracker.maxDisplayDistance;
    const d = Math.max(0, state.hunterDistance);
    // The bar fills from the right as they close, so it reads as encroachment.
    const fill = Math.max(0, Math.min(100, (1 - d / max) * 100));
    this.el['tracker-fill'].style.width = fill + '%';
    this.el['tracker-distance'].textContent = d.toFixed(1) + ' mi';
    this.el['tracker-sub'].textContent = `covered ${Math.round(state.distanceCovered)} mi`;

    const tracking = state.hunterState === 'tracking';
    this.el['tracker-label'].textContent = tracking ? 'TRAIL LOST' : 'THE HUNTERS';
    this.el.tracker.classList.toggle('tracking', tracking);
    this.el.tracker.classList.toggle('close', d < 8);
  },

  setFlavor(text) {
    const el = this.el['hunt-flavor'];
    if (!text) { el.classList.remove('show'); return; }
    el.classList.remove('show');
    // Let the fade-out land before swapping the words.
    setTimeout(() => {
      el.textContent = text;
      el.classList.add('show');
    }, 180);
  },

  /**
   * Darken and desaturate the frame as the hunters close, mirroring V1's
   * visual escalation stages.
   */
  updateEscalation(state) {
    const max = CONFIG.ui.hunterTracker.maxDisplayDistance;
    const closeness = 1 - Math.min(1, Math.max(0, state.hunterDistance) / max);
    let vignette = 0.15, tint = 0;
    for (const stage of CONFIG.ui.visualEscalation.stages) {
      if (closeness >= stage.threshold) { vignette = stage.vignette; tint = stage.desaturation; }
    }
    this.el.vignette.style.boxShadow = `inset 0 0 ${140 + vignette * 260}px rgba(0,0,0,${0.3 + vignette * 0.5})`;
    this.el.vignette.style.backgroundColor = `rgba(120, 20, 12, ${tint * 0.13})`;
  },

  flash(strength = 0.5, duration = 130) {
    const el = this.el.flash;
    el.style.transition = 'none';
    el.style.opacity = String(strength);
    requestAnimationFrame(() => {
      el.style.transition = `opacity ${duration}ms ease-out`;
      el.style.opacity = '0';
    });
  },

  // ------------------------------------------------------------
  // Situation panel
  // ------------------------------------------------------------

  renderSituation(state, opts = {}) {
    const enc = state.currentEncounter;
    if (!enc) return;
    this.el['panel-title'].textContent = enc.name || 'The land';

    const text = [state.lastOutcome, enc.text].filter(Boolean).join('\n\n');
    this.el.monologue.textContent = '';
    this.el['spatial-note'].textContent = opts.spatialNote || '';

    const useTypewriter = Options.get('situationTypewriter') && !Options.get('reduceMotion') && !opts.instant;
    this._stopTypewriter();
    if (useTypewriter) {
      this._typewrite(this.el['situation-text'], text, Math.max(6, Options.get('typewriterSpeed') / 2), () => {
        this.el.monologue.textContent = state.monologue || '';
      });
    } else {
      this.el['situation-text'].textContent = text;
      this.el.monologue.textContent = state.monologue || '';
      this._typewriterDone = true;
    }
    this.el['panel-body'].scrollTop = 0;
  },

  _typewrite(element, text, speed, done) {
    this._typewriterDone = false;
    element.textContent = '';
    let i = 0;
    const step = () => {
      if (this._typewriterDone) { element.textContent = text; if (done) done(); return; }
      // A few characters per tick keeps long passages from dragging.
      i = Math.min(text.length, i + 2);
      element.textContent = text.slice(0, i);
      if (i >= text.length) {
        this._typewriterDone = true;
        if (done) done();
        return;
      }
      this._typewriterTimer = setTimeout(step, speed);
    };
    step();
  },

  /** Finish any in-flight typing immediately. */
  skipTypewriter() {
    if (this._typewriterDone) return false;
    this._typewriterDone = true;
    clearTimeout(this._typewriterTimer);
    return true;
  },

  _stopTypewriter() {
    clearTimeout(this._typewriterTimer);
    this._typewriterTimer = null;
  },

  // ------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------

  /**
   * @param {Array} actions - in-place actions from the encounter
   * @param {Object} state
   */
  renderActions(actions, state) {
    const bar = this.el['action-bar'];
    bar.innerHTML = '';
    this._actionKeys = [];

    actions.forEach((action, index) => {
      const btn = document.createElement('button');
      btn.className = 'action-btn';
      btn.type = 'button';

      const name = document.createElement('span');
      name.className = 'ab-name';
      const num = index + 1;
      name.innerHTML = `<span class="ab-key">${num}</span>${escapeHTML(action.name || action.key)}`;
      btn.appendChild(name);

      const costs = document.createElement('span');
      costs.className = 'ab-costs';
      costs.innerHTML = this._costSummary(action, state);
      btn.appendChild(costs);

      btn.setAttribute('aria-label', `${action.name}. ${stripTags(this._costSummary(action, state))}`);
      btn.addEventListener('click', () => this.onAction && this.onAction(action.key));
      bar.appendChild(btn);
      this._actionKeys.push(action.key);
    });
  },

  /** Number-key shortcut lookup. */
  actionKeyAt(index) {
    return this._actionKeys ? this._actionKeys[index] : null;
  },

  /** Total effect of an action including the phase's passive drain, as V1 did. */
  _costSummary(action, state) {
    const e = action.effects || {};
    const drains = CONFIG.passiveDrain[state.phase] || {};
    const parts = [];
    const add = (label, value, goodIsNegative) => {
      const v = Math.round(value);
      if (v === 0) return;
      const good = goodIsNegative ? v < 0 : v > 0;
      parts.push(`<span class="${good ? 'good' : 'bad'}">${label} ${v > 0 ? '+' : ''}${v}</span>`);
    };
    add('Heat', (e.heat || 0) + (drains.heat || 0), true);
    // Stamina is shown as fatigue, so a stamina gain is a fatigue drop.
    add('Fatigue', -((e.stamina || 0) + (drains.stamina || 0)), true);
    add('Thirst', (e.thirst || 0) + (drains.thirst || 0), true);
    add('Hunger', (e.hunger || 0) + (drains.hunger || 0), true);

    let out = parts.join(' · ');
    if (action.chance !== undefined && action.chance < 1) {
      out += ` <span class="ab-chance">${Math.round(action.chance * 100)}%</span>`;
    }
    return out || 'no cost';
  },

  setActionsEnabled(enabled) {
    for (const btn of this.el['action-bar'].querySelectorAll('button')) btn.disabled = !enabled;
    this.el['mp-go'].disabled = !enabled;
  },

  // ------------------------------------------------------------
  // Move preview
  // ------------------------------------------------------------

  showMovePreview(preview, terrainName) {
    const p = this.el['move-preview'];
    p.hidden = false;
    this.el['mp-terrain'].textContent = terrainName;
    this.el['mp-gait'].textContent = `${preview.gait.toUpperCase()} · ${preview.miles} MI`;

    const t = preview.total;
    const cost = (label, v, invert) => {
      const value = invert ? -v : v;
      const good = value < 0;
      return `<span class="mp-cost ${good ? 'good' : 'bad'}">${label} <b>${value > 0 ? '+' : ''}${value}</b></span>`;
    };
    this.el['mp-costs'].innerHTML = [
      cost('Heat', t.heat, false),
      cost('Fatigue', t.stamina, true),
      cost('Thirst', t.thirst, false),
      cost('Hunger', t.hunger, false)
    ].join('');

    const notes = [];
    if (preview.trailBreakChance > 0.02) {
      notes.push(`${Math.round(preview.trailBreakChance * 100)}% chance this ground loses them`);
    }
    if (preview.dest.landmark) notes.push('Something stands here.');
    if (preview.dest.water) notes.push('Water.');
    if (preview.extra > 2) notes.push('Hard going.');
    notes.push(`They gain ${preview.hunterAdvance} mi`);
    this.el['mp-notes'].textContent = notes.join(' · ');

    this.dismissHint();
  },

  hideMovePreview() { this.el['move-preview'].hidden = true; },
  isMovePreviewOpen() { return !this.el['move-preview'].hidden; },

  dismissHint() {
    if (this._hintDismissed) return;
    this._hintDismissed = true;
    this.el.hint.classList.add('gone');
  }
};

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function stripTags(s) { return String(s).replace(/<[^>]*>/g, ''); }

const Options = {
  _defaults: {
    difficulty: 'normal',
    showTutorial: true,
    showOpening: true,
    typewriterEffect: true,
    situationTypewriter: true,
    typewriterSpeed: 30
  },

  _values: null,

  load() {
    try {
      const stored = localStorage.getItem('primalChaseOptions');
      this._values = stored ? { ...this._defaults, ...JSON.parse(stored) } : { ...this._defaults };
    } catch (e) {
      this._values = { ...this._defaults };
    }
  },

  save() {
    try {
      localStorage.setItem('primalChaseOptions', JSON.stringify(this._values));
    } catch (e) { /* localStorage not available */ }
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

const INTRO_SETS = [
  [
    "You stand at the crest of a ridge, the savanna golden and endless beneath you. The air is still. The land is yours.",
    "But today, something is different. On the far horizon, where the heat bends the light — shapes. Upright. Moving.",
    "They do not run. They do not crouch or stalk. They just walk. Steady. Patient. Toward you.",
    "Something deeper than thought tells you what this means. Something old. Something the body knows before the mind can name it.",
    "You turn. You run. The chase begins."
  ],
  [
    "The morning is warm and the grass is high and the world belongs to you. You have eaten well. You are strong.",
    "Then the wind shifts. A scent — strange, sharp, wrong. And beneath it, the faintest vibration in the earth. Footsteps. Many of them.",
    "You see them now. Distant figures, moving in a line across the open plain. They carry no fear. They carry no hurry.",
    "Every instinct screams at once. Not to fight. Not to hide. To run. To run and never stop.",
    "The savanna stretches ahead. You choose distance. The chase begins."
  ],
  [
    "Dawn breaks over the thornwood and you drink from a still pool, unhurried. Nothing here can threaten you. You are the reason other creatures run.",
    "A bird screams. Then another. The acacia grove goes silent in a wave, spreading outward from a point behind you.",
    "You turn and see them. Small against the vastness, but unmistakable. Walking. Two legs. Steady as the sun's arc.",
    "You have never seen anything walk toward you like that. Without hesitation. Without fear. The wrongness of it settles in your chest like a stone.",
    "You do not understand what is happening. But your legs do. The chase begins."
  ]
];

/**
 * Reverse lookup: terrain ID → category name
 */
function getTerrainCategory(terrainId) {
  if (!terrainId) return null;
  const cats = CONFIG.terrainCategories;
  for (const cat in cats) {
    if (cats[cat].indexOf(terrainId) !== -1) return cat;
  }
  return null;
}

/**
 * Determine weather condition from current encounter
 * @param {Object} encounter - currentEncounter from game state
 * @returns {null|'light'|'heavy'} weather condition
 */
function getWeatherCondition(encounter, skipRandom) {
  if (!encounter) return null;
  if (encounter.id === 'sig_rainstorm' || encounter.id === 'rare_lightning_fire') {
    return 'heavy';
  }
  if (encounter.pressure?.id === 'storm_approaching') {
    return 'light';
  }
  if (skipRandom) return null;
  // Random rain chance (rolled once per encounter via cached flag)
  if (encounter._weatherRoll === undefined) {
    encounter._weatherRoll = Math.random() < CONFIG.ui.weather.rain.randomChance ? 'light' : null;
  }
  return encounter._weatherRoll;
}

const UI = {
  _currentWeather: null,
  _currentEncounter: null,
  _lightningInterval: null,

  /**
   * Show a specific screen, hide all others
   * @param {string} screenId - ID of the screen to show
   */
  showScreen(screenId) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
      screen.classList.remove('active');
    });

    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
      targetScreen.classList.add('active');
    }
  },

  /**
   * Render the title screen with random logo selection
   */
  renderTitle() {
    const isReturn = this._titleShown;
    this._titleShown = true;

    this.showScreen('screen-title');
    document.body.classList.remove('night-mode');
    this.resetVisualOverlays();
    // Random logo selection
    const logos = [
      'assets/primalchaselogo.png',
      'assets/primalchaselogoout.png',
      'assets/primalchaselogoreign.png'
    ];
    const logo = document.getElementById('title-logo');
    if (logo) {
      logo.src = logos[Math.floor(Math.random() * logos.length)];
    }
    // On return visits, force elements visible (CSS animations don't replay)
    if (isReturn) {
      const credit = document.querySelector('#screen-title .creator-credit');
      if (credit) credit.style.opacity = '1';
      if (logo) logo.style.opacity = '1';
      document.querySelectorAll('.title-btn').forEach(btn => {
        btn.style.opacity = '1';
      });
    }
  },

  /**
   * Play typewriter cinematic intro, then call callback
   */
  playTypewriterIntro(callback) {
    const overlay = document.getElementById('typewriter-overlay');
    const content = document.getElementById('typewriter-content');
    if (!overlay || !content) {
      callback();
      return;
    }

    content.innerHTML = '';
    this._typewriterCallback = callback;
    this._typewriterSkipped = false;
    this._typewriterFinished = false;

    // Pick a random intro set
    const introParagraphs = INTRO_SETS[Math.floor(Math.random() * INTRO_SETS.length)];

    // Create paragraph elements
    introParagraphs.forEach(text => {
      const p = document.createElement('p');
      p.innerHTML = text;
      content.appendChild(p);
    });

    // Show overlay
    overlay.classList.add('active');
    overlay.classList.remove('fading');

    // Bind skip handlers
    this._skipHandler = (e) => {
      if (e.type === 'keydown' && e.code !== 'Space') return;
      if (e.type === 'keydown') e.preventDefault();
      this._skipTypewriter();
    };
    document.addEventListener('keydown', this._skipHandler);
    overlay.addEventListener('click', this._skipHandler);

    // Start typing after brief pause
    setTimeout(() => this._typeNextParagraph(0), 600);
  },

  /**
   * Type out a single paragraph character by character
   */
  _typeNextParagraph(index) {
    if (this._typewriterSkipped) return;

    const content = document.getElementById('typewriter-content');
    const paragraphs = content.querySelectorAll('p');

    if (index >= paragraphs.length) {
      setTimeout(() => this._finishTypewriter(), 1500);
      return;
    }

    const p = paragraphs[index];
    const fullText = p.textContent;
    p.classList.add('visible');

    // Start with all text hidden (layout stable from the start)
    let charIndex = 0;
    const typeSpeed = (typeof CONFIG !== 'undefined' && CONFIG.typewriter) ? CONFIG.typewriter.introSpeed : 35;

    const render = () => {
      const typed = fullText.substring(0, charIndex);
      const untyped = fullText.substring(charIndex);
      p.innerHTML = typed + '<span class="tw-hidden">' + untyped + '</span>';
    };

    render();

    const typeNext = () => {
      if (this._typewriterSkipped) return;
      if (charIndex >= fullText.length) {
        p.textContent = fullText;
        setTimeout(() => this._typeNextParagraph(index + 1), 800);
        return;
      }
      charIndex++;
      render();
      setTimeout(typeNext, typeSpeed);
    };

    typeNext();
  },

  /**
   * Skip the typewriter and go straight to game
   */
  _skipTypewriter() {
    if (this._typewriterSkipped) return;
    this._typewriterSkipped = true;
    this._finishTypewriter();
  },

  /**
   * Finish typewriter — fade out and start game
   */
  _finishTypewriter() {
    if (this._typewriterFinished) return;
    this._typewriterFinished = true;
    const overlay = document.getElementById('typewriter-overlay');

    if (this._skipHandler) {
      document.removeEventListener('keydown', this._skipHandler);
      if (overlay) overlay.removeEventListener('click', this._skipHandler);
      this._skipHandler = null;
    }

    // Start the game BEFORE fading so the overlay reveals the game screen, not the title
    if (this._typewriterCallback) {
      this._typewriterCallback();
      this._typewriterCallback = null;
    }

    if (overlay) {
      overlay.classList.add('fading');

      setTimeout(() => {
        overlay.classList.remove('active', 'fading');
      }, 1500);
    }
  },

  /**
   * Main render function - updates all game screen content
   * @param {Object} gameState - current game state
   * @param {Object} opts - { transition: bool }
   */
  renderGame(gameState, opts = {}) {
    this.showScreen('screen-game');
    this.renderPhaseHeader(gameState);
    this.applyTerrainPalette(gameState);

    if (opts.transition) {
      // Animate bars slowly
      document.querySelectorAll('.status-bar-fill').forEach(bar => {
        bar.classList.add('transitioning');
      });
      this.renderVitals(gameState);
      this.renderHunt(gameState);

      setTimeout(() => {
        document.querySelectorAll('.status-bar-fill').forEach(bar => {
          bar.classList.remove('transitioning');
        });
      }, CONFIG.transition.barAnimationDuration);

      const useTypewriter = Options.get('typewriterEffect') && Options.get('situationTypewriter');

      if (useTypewriter) {
        // Fade out, then typewrite new content with staggered actions
        const scroll = document.querySelector('.situation-scroll');
        const actionsContainer = document.getElementById('action-buttons');
        if (scroll) scroll.classList.add('fading');
        if (actionsContainer) actionsContainer.classList.add('fading');

        setTimeout(() => {
          this._renderSituation(gameState, { stagger: true });
          if (scroll) scroll.classList.remove('fading');
          if (actionsContainer) actionsContainer.classList.remove('fading');
        }, 300);
      } else {
        // No typewriter — render situation immediately, stagger action buttons
        this._renderSituation(gameState, { stagger: true });
      }
    } else {
      // No transition — render everything immediately
      this.renderVitals(gameState);
      this.renderHunt(gameState);
      this._renderSituation(gameState);
    }

    // Visual overlays (applied after every render)
    this.updateVisualEscalation(gameState);
    this.updateHunterGlow(gameState);
    this.updateWeatherEffects(gameState);
    this.updateDayAtmosphere(gameState);
  },

  /**
   * Render situation text, monologue, and action buttons
   * Uses typewriter effect when enabled
   */
  _renderSituation(gameState, opts = {}) {
    const situationElement = document.getElementById('situation-text');
    if (!situationElement) return;

    const encounterText = (gameState.currentEncounter && gameState.currentEncounter.text)
      ? gameState.currentEncounter.text
      : 'The land stretches endlessly before you. Heat shimmers on the horizon.';

    const useTypewriter = Options.get('typewriterEffect') && Options.get('situationTypewriter');
    // Stagger actions during transitions or when typewriter will play
    const stagger = opts.stagger || useTypewriter;

    // Render available actions (hidden if staggering)
    if (gameState.currentEncounter && gameState.currentEncounter.actions) {
      this.renderActions(gameState.currentEncounter.actions, stagger);
    }

    if (useTypewriter) {
      // Show outcome text instantly, then typewrite encounter text
      situationElement.innerHTML = '';
      if (gameState.lastOutcome) {
        situationElement.innerHTML = `<p class="outcome-text">${gameState.lastOutcome}</p>`;
        gameState.lastOutcome = null;
      }

      // Hide old monologue immediately so it doesn't linger during typewriter
      this.renderMonologue(null);

      const speed = Options.get('typewriterSpeed') || CONFIG.typewriter.speed;
      this.typewriteText(situationElement, encounterText, speed, () => {
        // Reveal actions as soon as situation text finishes (don't wait for monologue)
        this._revealActions();

        // Typewrite monologue after situation finishes (or show instantly if skipped)
        if (gameState.monologue) {
          if (this._situationSkipped) {
            this.renderMonologue(gameState.monologue);
          } else {
            const monologueEl = document.getElementById('monologue');
            if (monologueEl) {
              monologueEl.innerHTML = '<span class="monologue-label">Inner voice</span>';
              monologueEl.style.display = 'block';
              this.typewriteText(monologueEl, gameState.monologue, speed);
            }
          }
        }
      });
    } else {
      // No typewriter — render everything instantly
      let html = '';
      if (gameState.lastOutcome) {
        html += `<p class="outcome-text">${gameState.lastOutcome}</p>`;
        gameState.lastOutcome = null;
      }
      situationElement.innerHTML = html + `<p>${encounterText}</p>`;
      this._situationTypewriterDone = true;

      // Render internal monologue
      this.renderMonologue(gameState.monologue);

      // Stagger-reveal actions if in transition mode
      if (stagger) {
        this._revealActions();
      }
    }
  },

  /**
   * Enable or disable action buttons
   */
  disableActions(disabled) {
    const buttons = document.querySelectorAll('#action-buttons .action-btn');
    buttons.forEach(btn => {
      if (disabled) {
        btn.classList.add('disabled');
      } else {
        btn.classList.remove('disabled');
      }
    });
  },

  /**
   * Update the phase header (DAY X or NIGHT X)
   * @param {Object} gameState - current game state
   */
  renderPhaseHeader(gameState) {
    const phaseIndicator = document.getElementById('phase-indicator');
    if (!phaseIndicator) return;

    const isDay = gameState.phase === 'day';
    const phaseText = isDay ? 'DAY' : 'NIGHT';
    phaseIndicator.textContent = `${phaseText} ${gameState.day}`;

    // Add appropriate CSS class for styling
    phaseIndicator.className = 'phase-indicator';
    phaseIndicator.classList.add(isDay ? 'day' : 'night');

    // Toggle night mode on body and particles
    if (isDay) {
      document.body.classList.remove('night-mode');
      this.spawnClouds();
      setTimeout(() => {
        if (document.body.classList.contains('night-mode') === false) {
          this.clearFireflies();
          this.clearStars();
        }
      }, 2000);
    } else {
      this.clearClouds();
      this.spawnStars();
      if (Math.random() < CONFIG.ui.weather.fireflies.chance) {
        this.spawnFireflies();
      }
      document.body.classList.add('night-mode');
    }
  },

  /**
   * Update all status bars
   * @param {Object} gameState - current game state
   */
  renderVitals(gameState) {
    // Heat: 0% = safe (green), 100% = death (red)
    this.updateStatusBar('heat', gameState.heat, false);

    // Stamina: 100% = safe (green), 0% = death (red) - INVERTED
    this.updateStatusBar('stamina', gameState.stamina, true);

    // Thirst: 0% = safe (green), 100% = death (red)
    this.updateStatusBar('thirst', gameState.thirst, false);

    // Hunger: 0% = safe (green), 100% = death (red)
    this.updateStatusBar('hunger', gameState.hunger, false);
  },

  /**
   * Update a single status bar
   * @param {string} statName - name of the stat (heat, stamina, thirst, hunger)
   * @param {number} value - current value (0-100)
   * @param {boolean} inverted - if true, high values are good (stamina only)
   */
  updateStatusBar(statName, value, inverted = false) {
    const valueElement = document.getElementById(`${statName}-value`);
    const barElement = document.getElementById(`${statName}-bar`);

    if (!valueElement || !barElement) return;

    // Clamp value to 0-100
    const clampedValue = Math.max(0, Math.min(100, value));

    // All bars display as danger level: 0% = safe, 100% = death
    // For inverted stats (stamina→fatigue), flip the display
    const dangerLevel = inverted ? (100 - clampedValue) : clampedValue;

    // Update text and bar width to show danger uniformly
    valueElement.textContent = `${Math.round(dangerLevel)}%`;
    barElement.style.width = `${dangerLevel}%`;

    // Position value at midpoint of filled bar (left-aligned when near 0)
    if (dangerLevel <= 5) {
      valueElement.style.left = '4px';
    } else {
      valueElement.style.left = `${dangerLevel / 2}%`;
    }

    // Color based on danger
    const container = barElement.parentElement.parentElement;
    if (dangerLevel > 65) {
      container.classList.add('critical');
      barElement.style.backgroundColor = '#c44536';
    } else {
      container.classList.remove('critical');
      barElement.style.backgroundColor = this.getDangerColor(dangerLevel);
    }

    // Continuous shake when in danger — starts at 75%, ramps up rapidly toward 100%
    if (dangerLevel > 75) {
      const t = (dangerLevel - 75) / 25;          // 0→1 over 75%→100%
      const intensity = t * t;                     // quadratic ramp: slow start, rapid finish
      const speed = 0.5 - (intensity * 0.4);      // 0.5s→0.1s
      container.style.setProperty('--shake-speed', speed + 's');
      container.classList.add('shaking');
    } else {
      container.classList.remove('shaking');
      container.style.removeProperty('--shake-speed');
    }
  },

  /**
   * Get color for a danger level (0-100)
   * @param {number} danger - 0 = safe, 100 = death
   * @returns {string} - hex color
   */
  getDangerColor(danger) {
    // Green at 0%, amber at 50%, red at 100%
    const green = '#4a7c3f';
    const amber = '#d4883a';
    const red = '#c44536';

    if (danger <= 50) {
      // Interpolate green → amber
      return this.interpolateColor(green, amber, danger / 50);
    } else {
      // Interpolate amber → red
      return this.interpolateColor(amber, red, (danger - 50) / 50);
    }
  },

  /**
   * Interpolate between two hex colors
   * @param {string} color1 - start color (hex)
   * @param {string} color2 - end color (hex)
   * @param {number} factor - 0-1, where 0 = color1, 1 = color2
   * @returns {string} - interpolated hex color
   */
  interpolateColor(color1, color2, factor) {
    const c1 = this.hexToRgb(color1);
    const c2 = this.hexToRgb(color2);

    const r = Math.round(c1.r + (c2.r - c1.r) * factor);
    const g = Math.round(c1.g + (c2.g - c1.g) * factor);
    const b = Math.round(c1.b + (c2.b - c1.b) * factor);

    return this.rgbToHex(r, g, b);
  },

  /**
   * Convert hex color to RGB object
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  },

  /**
   * Convert RGB to hex color
   */
  rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  },

  /**
   * Render hunter information
   * @param {Object} gameState - current game state
   */
  renderHunt(gameState) {
    const flavorElement = document.getElementById('hunt-flavor');

    if (flavorElement && typeof Hunters !== 'undefined') {
      const flavorText = Hunters.getHunterFlavorText(
        gameState.hunterDistance,
        gameState.hunterState,
        gameState.phase
      );
      flavorElement.textContent = flavorText;
    }

    // Hunter distance tracker bar
    this.renderHunterTracker(gameState);
  },

  /**
   * Render the visual hunter distance tracker bar
   */
  renderHunterTracker(gameState) {
    const maxDist = CONFIG.ui.hunterTracker.maxDisplayDistance;
    const dist = Math.min(gameState.hunterDistance, maxDist);
    const pressure = ((maxDist - dist) / maxDist) * 100;

    // Determine proximity tier
    let tier;
    if (gameState.hunterState === 'tracking') {
      tier = 'tracking';
    } else if (dist <= 5) {
      tier = 'critical';
    } else if (dist <= 10) {
      tier = 'danger';
    } else if (dist <= 18) {
      tier = 'caution';
    } else {
      tier = 'safe';
    }

    // Remove legacy tracker strip if present
    const oldTracker = document.getElementById('hunter-tracker');
    if (oldTracker) oldTracker.remove();

    // --- Pursuit trail inside hunt-info ---
    let trail = document.getElementById('pursuit-trail');
    if (!trail) {
      trail = document.createElement('div');
      trail.id = 'pursuit-trail';
      trail.className = 'pursuit-trail';
      trail.innerHTML = `
        <div class="pursuit-trail-path"></div>
        <span class="pursuit-trail-cat"><img src="assets/jaguar.png" alt="You" class="pursuit-icon"><span class="pursuit-label">You</span></span>
        <span class="pursuit-trail-distance"></span>
        <span class="pursuit-trail-hunters"><img src="assets/hunter.png" alt="Hunters" class="pursuit-icon"><span class="pursuit-label">Hunters</span></span>
      `;
      const huntInfo = document.getElementById('hunt-info');
      if (huntInfo) {
        huntInfo.appendChild(trail);
      }
    }

    // Both markers move — midpoint stays at 50%, gap shrinks as hunters close
    const maxSpread = 40; // each marker can be up to 40% from center
    const halfGap = Math.max(2, (dist / maxDist) * maxSpread);
    const catPos = 50 - halfGap;
    const hunterPos = 50 + halfGap;

    const catMarker = trail.querySelector('.pursuit-trail-cat');
    if (catMarker) catMarker.style.left = catPos + '%';

    const hunterMarker = trail.querySelector('.pursuit-trail-hunters');
    if (hunterMarker) {
      hunterMarker.style.left = hunterPos + '%';
      hunterMarker.classList.remove('trail-safe', 'trail-caution', 'trail-danger', 'trail-critical', 'trail-tracking');
      hunterMarker.classList.add('trail-' + tier);
    }

    // Colored dotted line connecting the two markers
    const path = trail.querySelector('.pursuit-trail-path');
    if (path) {
      path.style.left = catPos + '%';
      path.style.width = (halfGap * 2) + '%';
      path.classList.remove('trail-safe', 'trail-caution', 'trail-danger', 'trail-critical', 'trail-tracking');
      path.classList.add('trail-' + tier);
    }

    // Distance label at the midpoint (always center)
    const distLabel = trail.querySelector('.pursuit-trail-distance');
    if (distLabel) {
      const roundedDist = Math.round(gameState.hunterDistance * 10) / 10;
      distLabel.textContent = `${roundedDist} mi`;
      distLabel.style.left = '50%';
      distLabel.classList.remove('trail-safe', 'trail-caution', 'trail-danger', 'trail-critical', 'trail-tracking');
      distLabel.classList.add('trail-' + tier);
    }
  },

  // renderSituation is handled inline in renderGame

  /**
   * Update visual escalation based on worst stat danger
   */
  updateVisualEscalation(gameState) {
    const dangers = [
      gameState.heat / 100,
      (100 - gameState.stamina) / 100,
      gameState.thirst / 100,
      gameState.hunger / 100
    ];
    const worst = Math.max(...dangers);
    const hunterDanger = Math.max(0, 1 - (gameState.hunterDistance / 15));
    const desperation = Math.max(worst, hunterDanger);

    const stages = CONFIG.ui.visualEscalation.stages;
    let stage = null;
    for (let i = stages.length - 1; i >= 0; i--) {
      if (desperation >= stages[i].threshold) {
        stage = stages[i];
        break;
      }
    }

    const overlay = document.getElementById('vignette-overlay');
    const gameScreen = document.getElementById('screen-game');

    if (stage) {
      const v = stage.vignette;
      // Wider spread + stronger opacity for visible vignette
      const spread = 80 + v * 200;
      if (overlay) overlay.style.boxShadow = `inset 0 0 ${spread}px rgba(0, 0, 0, ${v})`;
      if (gameScreen && stage.desaturation > 0) {
        gameScreen.style.filter = `saturate(${1 - stage.desaturation})`;
      } else if (gameScreen) {
        gameScreen.style.filter = '';
      }
    } else {
      if (overlay) overlay.style.boxShadow = 'inset 0 0 150px rgba(0, 0, 0, 0)';
      if (gameScreen) gameScreen.style.filter = '';
    }
  },

  /**
   * Update hunter proximity visual glow
   */
  updateHunterGlow(gameState) {
    const glow = document.getElementById('hunter-glow');
    if (!glow) return;

    // No glow in tracking mode or when far away
    if (gameState.hunterState === 'tracking' || gameState.hunterDistance > 15) {
      glow.style.boxShadow = 'inset 0 0 80px rgba(196, 69, 54, 0)';
      glow.classList.remove('glow-pulse');
      return;
    }

    // Continuous intensity: 0 at 15mi, 1 at 0mi
    const intensity = Math.max(0, 1 - (gameState.hunterDistance / 15));
    const isNight = gameState.phase === 'night';

    // Scale spread and opacity continuously
    const spread = 60 + intensity * 100;   // 60px → 160px
    const opacity = intensity * 0.6;        // 0 → 0.6

    const r = isNight ? 212 : 196;
    const g = isNight ? 136 : 69;
    const b = isNight ? 58 : 54;

    glow.style.boxShadow = `inset 0 0 ${spread}px rgba(${r}, ${g}, ${b}, ${opacity.toFixed(2)})`;

    // Add pulse when very close (<6mi)
    if (gameState.hunterDistance <= 6) {
      glow.classList.add('glow-pulse');
    } else {
      glow.classList.remove('glow-pulse');
    }
  },

  /**
   * Spawn firefly particles for night phase
   */
  spawnFireflies() {
    const container = document.getElementById('particle-container');
    if (!container) return;
    container.innerHTML = '';
    const count = 15 + Math.floor(Math.random() * 10); // 15-24 fireflies
    for (let i = 0; i < count; i++) {
      const fly = document.createElement('div');
      fly.className = 'firefly';
      fly.style.left = Math.random() * 100 + '%';
      fly.style.top = Math.random() * 100 + '%';
      // Random static frame from one of 24 sprites (2 sheets x 12 frames)
      const sheet = Math.random() < 0.5 ? 1 : 2;
      const frame = Math.floor(Math.random() * 12);
      fly.style.backgroundImage = `url(assets/firefly${sheet}-${String(frame).padStart(2, '0')}.png)`;
      fly.style.setProperty('--flip', Math.random() < 0.5 ? 'scaleX(-1)' : 'scaleX(1)');
      fly.style.setProperty('--duration', (6 + Math.random() * 8) + 's');
      fly.style.setProperty('--glow-duration', (2 + Math.random() * 3) + 's');
      fly.style.setProperty('--dx1', (Math.random() * 60 - 30) + 'px');
      fly.style.setProperty('--dy1', (Math.random() * 60 - 30) + 'px');
      fly.style.setProperty('--dx2', (Math.random() * 60 - 30) + 'px');
      fly.style.setProperty('--dy2', (Math.random() * 60 - 30) + 'px');
      fly.style.setProperty('--dx3', (Math.random() * 60 - 30) + 'px');
      fly.style.setProperty('--dy3', (Math.random() * 60 - 30) + 'px');
      fly.style.animationDelay = Math.random() * 5 + 's';
      container.appendChild(fly);
    }
  },

  /**
   * Clear firefly particles
   */
  clearFireflies() {
    const container = document.getElementById('particle-container');
    if (container) container.innerHTML = '';
  },

  /**
   * Spawn dynamic star field for night sky
   * Count varies per phase to simulate traveling
   */
  spawnStars() {
    const container = document.getElementById('star-container');
    if (!container) return;
    container.innerHTML = '';
    const cfg = CONFIG.ui.weather.stars;
    const count = cfg.minCount + Math.floor(Math.random() * (cfg.maxCount - cfg.minCount + 1));
    for (let i = 0; i < count; i++) {
      const star = document.createElement('div');
      star.className = 'star';
      star.style.left = Math.random() * 100 + '%';
      star.style.top = Math.random() * 100 + '%';

      // Size: 1-3px, most are 1px
      const size = Math.random() < 0.7 ? 1 : (Math.random() < 0.7 ? 2 : 3);
      star.style.width = size + 'px';
      star.style.height = size + 'px';

      // Brightness
      const baseOpacity = 0.2 + Math.random() * 0.7;
      star.style.opacity = baseOpacity;

      // Bright stars get glow
      if (Math.random() < cfg.brightChance) {
        star.classList.add('bright');
      }

      // Twinkle animation on some stars — set inline to avoid CSS var() issues
      if (Math.random() < cfg.twinkleChance) {
        const twinkleDur = 2 + Math.random() * 4;
        const twinkleDelay = -(Math.random() * twinkleDur);
        star.style.animation = `star-drift 60s linear infinite, star-twinkle ${twinkleDur}s ease-in-out ${twinkleDelay}s infinite`;
        star.style.setProperty('--star-base-opacity', baseOpacity);
      }

      container.appendChild(star);
    }
  },

  /**
   * Clear star field
   */
  clearStars() {
    const container = document.getElementById('star-container');
    if (container) container.innerHTML = '';
  },

  // ---- Day atmosphere effects ----

  /**
   * Spawn floating dust motes — density based on terrain category
   */
  spawnDust(terrainCategory) {
    const container = document.getElementById('dust-container');
    if (!container) return;
    container.innerHTML = '';
    const cfg = CONFIG.ui.weather.dust;
    const mult = cfg.terrainMultiplier[terrainCategory] || 1;
    const count = Math.round(cfg.baseCount * mult);

    for (let i = 0; i < count; i++) {
      const mote = document.createElement('div');
      mote.className = 'dust-mote';
      mote.style.left = Math.random() * 100 + '%';
      mote.style.top = Math.random() * 100 + '%';

      const size = 1 + Math.random() * 3;
      mote.style.width = size + 'px';
      mote.style.height = size + 'px';

      const opacity = 0.2 + Math.random() * 0.4;
      mote.style.setProperty('--dust-opacity', opacity);
      const dx = (40 + Math.random() * 80) * (Math.random() < 0.5 ? 1 : -1);
      const dy = -20 + Math.random() * 40;
      mote.style.setProperty('--dust-dx', dx + 'px');
      mote.style.setProperty('--dust-dy', dy + 'px');

      const duration = 8 + Math.random() * 16;
      const delay = -(Math.random() * duration);
      mote.style.animation = `dust-float ${duration}s linear ${delay}s infinite`;

      container.appendChild(mote);
    }
  },

  clearDust() {
    const container = document.getElementById('dust-container');
    if (container) container.innerHTML = '';
  },

  /**
   * Spawn drifting cloud shadows
   */
  spawnClouds() {
    const container = document.getElementById('cloud-container');
    if (!container) return;
    container.innerHTML = '';
    const cfg = CONFIG.ui.weather.clouds;
    if (Math.random() > cfg.chance) return;

    const count = cfg.minCount + Math.floor(Math.random() * (cfg.maxCount - cfg.minCount + 1));
    for (let i = 0; i < count; i++) {
      const cloud = document.createElement('div');
      cloud.className = 'cloud-shadow';

      const w = 200 + Math.random() * 400;
      const h = w * (0.4 + Math.random() * 0.3);
      cloud.style.width = w + 'px';
      cloud.style.height = h + 'px';
      cloud.style.top = (Math.random() * 80) + '%';

      const duration = cfg.durationRange[0] + Math.random() * (cfg.durationRange[1] - cfg.durationRange[0]);
      const delay = -(Math.random() * duration);
      cloud.style.animation = `cloud-drift ${duration}s linear ${delay}s infinite`;

      container.appendChild(cloud);
    }
  },

  clearClouds() {
    const container = document.getElementById('cloud-container');
    if (container) container.innerHTML = '';
  },

  /**
   * Toggle sun rays based on terrain category
   */
  updateSunRays(terrainCategory, isDay) {
    const rays = document.getElementById('sun-rays');
    if (!rays) return;
    const cfg = CONFIG.ui.weather.sunRays;
    if (isDay && cfg.terrains.includes(terrainCategory)) {
      rays.classList.add('active');
    } else {
      rays.classList.remove('active');
    }
  },

  /**
   * Update heat shimmer effect on situation area
   */
  updateHeatShimmer(gameState) {
    const situationScroll = document.querySelector('.situation-scroll');
    if (!situationScroll) return;
    const cfg = CONFIG.ui.weather.heatShimmer;
    if (gameState.phase === 'day' && gameState.heat >= cfg.threshold) {
      situationScroll.classList.add('heat-shimmer');
    } else {
      situationScroll.classList.remove('heat-shimmer');
    }
  },

  /**
   * Update all day atmosphere effects
   */
  _lastDustCategory: null,

  updateDayAtmosphere(gameState) {
    const isDay = gameState.phase === 'day';
    const terrain = gameState.currentEncounter?.terrain;
    const category = getTerrainCategory(terrain?.id);

    if (isDay) {
      // Only re-spawn dust when terrain category changes
      if (category !== this._lastDustCategory) {
        this._lastDustCategory = category;
        this.spawnDust(category);
      }
      this.updateSunRays(category, true);
    } else {
      if (this._lastDustCategory !== null) {
        this._lastDustCategory = null;
        this.clearDust();
      }
      this.updateSunRays(null, false);
    }

    // Heat shimmer updates every render (reacts to heat changes)
    this.updateHeatShimmer(gameState);
  },

  /**
   * Spawn rain particles
   * @param {'light'|'heavy'} intensity
   */
  spawnRain(intensity) {
    const container = document.getElementById('rain-container');
    if (!container) return;
    container.innerHTML = '';
    const cfg = CONFIG.ui.weather.rain;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Randomize density, angle, and speed for this rain event
    const range = intensity === 'heavy' ? cfg.heavyCount : cfg.lightCount;
    let count = range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1));
    if (reduceMotion) count = Math.floor(count / 4);
    const angle = cfg.angle[0] + Math.random() * (cfg.angle[1] - cfg.angle[0]);
    const direction = Math.random() < 0.5 ? 1 : -1;
    const speedMult = cfg.speedMultiplier[0] + Math.random() * (cfg.speedMultiplier[1] - cfg.speedMultiplier[0]);
    const driftPx = Math.tan(angle * Math.PI / 180) * window.innerHeight * direction;

    for (let i = 0; i < count; i++) {
      const drop = document.createElement('div');
      drop.className = 'raindrop';
      drop.style.left = (Math.random() * 120 - 10) + '%';

      const height = intensity === 'heavy'
        ? (15 + Math.random() * 10)
        : (10 + Math.random() * 8);
      drop.style.height = height + 'px';

      const baseDuration = intensity === 'heavy'
        ? (0.4 + Math.random() * 0.4)
        : (0.6 + Math.random() * 0.6);
      const duration = baseDuration / speedMult;
      const delay = -(Math.random() * duration);
      const drift = driftPx * (0.8 + Math.random() * 0.4);

      drop.style.animation = `rain-fall ${duration}s linear ${delay}s infinite`;
      drop.style.setProperty('--rain-drift', drift + 'px');

      container.appendChild(drop);
    }
    document.body.classList.add('weather-rain');
    // Rain and fireflies don't mix
    this.clearFireflies();
  },

  /**
   * Clear rain particles and weather state
   */
  clearRain() {
    const container = document.getElementById('rain-container');
    if (container) container.innerHTML = '';
    document.body.classList.remove('weather-rain');
    this.stopLightning();
  },

  /**
   * Update weather visual effects based on current encounter
   * Called every renderGame()
   */
  updateWeatherEffects(gameState) {
    const encounter = gameState.currentEncounter;
    const encounterChanged = encounter !== this._currentEncounter;
    this._currentEncounter = encounter;
    const weather = gameState.day === 1 ? getWeatherCondition(encounter, true) : getWeatherCondition(encounter);
    // Skip if same weather AND same encounter (no need to re-spawn)
    if (weather === this._currentWeather && !encounterChanged) return;
    this._currentWeather = weather;

    if (weather) {
      this.spawnRain(weather);
      this.startLightning(weather);
    } else {
      this.clearRain();
    }
  },

  /**
   * Start periodic lightning flashes during rain
   * @param {'light'|'heavy'} intensity
   */
  startLightning(intensity) {
    this.stopLightning();
    const cfg = CONFIG.ui.weather.lightning;
    const scheduleNext = () => {
      const minI = intensity === 'heavy' ? cfg.minInterval : cfg.minInterval + 2;
      const maxI = intensity === 'heavy' ? cfg.maxInterval : cfg.maxInterval + 3;
      const delay = (minI + Math.random() * (maxI - minI)) * 1000;
      this._lightningInterval = setTimeout(() => {
        this.triggerLightning();
        scheduleNext();
      }, delay);
    };
    this._lightningInterval = setTimeout(() => {
      this.triggerLightning();
      scheduleNext();
    }, (2 + Math.random() * 4) * 1000);
  },

  /**
   * Stop lightning flashes
   */
  stopLightning() {
    if (this._lightningInterval) {
      clearTimeout(this._lightningInterval);
      this._lightningInterval = null;
    }
    const overlay = document.getElementById('lightning-overlay');
    if (overlay) {
      overlay.style.animation = '';
      overlay.style.background = 'rgba(255, 255, 255, 0)';
    }
  },

  /**
   * Trigger a single lightning flash (one of three tiers)
   */
  triggerLightning() {
    const overlay = document.getElementById('lightning-overlay');
    if (!overlay) return;
    const cfg = CONFIG.ui.weather.lightning;

    const roll = Math.random();
    let tier;
    if (roll < cfg.thunderChance) {
      tier = 'thunder';
    } else if (roll < cfg.thunderChance + cfg.strikeChance) {
      tier = 'strike';
    } else {
      tier = 'sheet';
    }

    overlay.style.animation = '';
    void overlay.offsetWidth; // force reflow to reset animation

    if (tier === 'sheet') {
      overlay.style.setProperty('--flash-opacity', cfg.sheetOpacity);
      overlay.style.animation = 'lightning-sheet 200ms ease-out forwards';
    } else if (tier === 'strike') {
      overlay.style.setProperty('--flash-opacity', cfg.strikeOpacity);
      overlay.style.animation = 'lightning-strike 500ms ease-out forwards';
    } else {
      overlay.style.setProperty('--flash-opacity', cfg.strikeOpacity);
      overlay.style.animation = 'lightning-strike 400ms ease-out forwards';
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const main = document.querySelector('main');
        if (main) {
          main.style.animation = 'lightning-shake 150ms ease-in-out';
          setTimeout(() => { main.style.animation = ''; }, 150);
        }
      }
    }
  },

  /**
   * Reset all visual overlays (for title/death screens)
   */
  resetVisualOverlays() {
    const overlay = document.getElementById('vignette-overlay');
    const glow = document.getElementById('hunter-glow');
    if (overlay) overlay.style.boxShadow = 'inset 0 0 150px rgba(0, 0, 0, 0)';
    if (glow) {
      glow.className = 'hunter-glow';
      glow.style.boxShadow = 'inset 0 0 80px rgba(196, 69, 54, 0)';
    }
    this.clearFireflies();
    this.clearStars();
    this.clearRain();
    this.clearDust();
    this.clearClouds();
    this.updateSunRays(null, false);
    const shimmer = document.querySelector('.situation-scroll');
    if (shimmer) shimmer.classList.remove('heat-shimmer');
    this._currentWeather = null;
    this._currentEncounter = null;
    const gameScreen = document.getElementById('screen-game');
    if (gameScreen) gameScreen.style.filter = '';
  },

  /**
   * Apply terrain-specific color palette to the game screen
   */
  applyTerrainPalette(gameState) {
    const gameScreen = document.getElementById('screen-game');
    if (!gameScreen) return;

    const terrain = gameState.currentEncounter?.terrain;
    const category = getTerrainCategory(terrain?.id);
    const palette = CONFIG.terrainPalettes[category];

    if (palette) {
      gameScreen.style.setProperty('--terrain-accent', palette.accent);
      gameScreen.style.setProperty('--terrain-tint', palette.tint);
      gameScreen.style.setProperty('--terrain-text', palette.text);
    } else {
      gameScreen.style.setProperty('--terrain-accent', 'transparent');
      gameScreen.style.removeProperty('--terrain-tint');
      gameScreen.style.removeProperty('--terrain-text');
    }
  },

  /**
   * Render internal monologue
   * @param {string|null} text - monologue text
   */
  renderMonologue(text) {
    const monologueElement = document.getElementById('monologue');
    if (!monologueElement) return;

    if (text) {
      monologueElement.innerHTML = `<span class="monologue-label">Inner voice</span>${text}`;
      monologueElement.style.display = 'block';
    } else {
      monologueElement.style.display = 'none';
    }
  },

  /**
   * Render action buttons
   * @param {Array} actions - array of action objects
   * @param {boolean} stagger - if true, buttons start hidden for stagger reveal
   */
  renderActions(actions, stagger = false) {
    const container = document.getElementById('action-buttons');
    if (!container) return;

    // Clear existing buttons
    container.innerHTML = '';

    // Use grid layout for 4+ actions on desktop to reduce vertical space
    container.classList.toggle('grid-layout', actions.length >= 4);

    // Create button for each action
    actions.forEach((action, index) => {
      const button = document.createElement('button');
      button.className = stagger ? 'action-btn pending-reveal' : 'action-btn';

      // Build button content
      let html = `<div class="action-name"><span class="action-key">${index + 1}</span> ${action.name}</div>`;

      if (action.description) {
        html += `<div class="action-description">${action.description}</div>`;
      }

      // Show stat changes
      const costs = this.formatActionCosts(action);
      if (costs) {
        html += `<div class="action-details">${costs}</div>`;
      }

      button.innerHTML = html;

      // Wire up click handler
      button.onclick = () => {
        if (button.classList.contains('disabled') || button.classList.contains('pending-reveal')) return;
        if (typeof Game !== 'undefined' && Game.processAction) {
          Game.processAction(action.key);
        }
      };

      container.appendChild(button);
    });
  },

  /**
   * Stagger-reveal action buttons one at a time
   */
  _revealActions() {
    const buttons = document.querySelectorAll('#action-buttons .action-btn');
    buttons.forEach((btn, i) => {
      setTimeout(() => {
        btn.classList.remove('pending-reveal');
        btn.classList.add('reveal');
      }, i * 120);
    });
  },

  /**
   * Format action costs for display
   * @param {Object} action - action object with effects
   * @returns {string} - formatted costs string
   */
  formatActionCosts(action) {
    const parts = [];
    const effects = action.effects || action;

    // Get passive drains for current phase to show TOTAL real effect
    const phase = (typeof Game !== 'undefined' && Game.state) ? Game.state.phase : 'day';
    const passive = CONFIG.passiveDrain[phase] || {};

    // Distance
    const dist = action.distance !== undefined ? action.distance : (effects.distance || 0);
    if (dist > 0) {
      parts.push(`<span class="action-gain">+${dist} mi</span>`);
    } else if (dist === 0) {
      parts.push(`<span class="action-warning">0 mi</span>`);
    } else if (dist < 0) {
      parts.push(`<span class="action-cost">${dist} mi</span>`);
    }

    // Heat (action + passive)
    const heat = (effects.heat || 0) + (passive.heat || 0);
    if (heat !== 0) {
      const cls = heat > 0 ? 'action-cost' : 'action-gain';
      parts.push(`<span class="${cls}">${heat > 0 ? '+' : ''}${heat} heat</span>`);
    }

    // Fatigue (inverted stamina: losing stamina = gaining fatigue)
    const stam = (effects.stamina || 0) + (passive.stamina || 0);
    if (stam !== 0) {
      const fatigue = -stam; // flip sign: stamina loss → fatigue gain
      const cls = fatigue > 0 ? 'action-cost' : 'action-gain';
      parts.push(`<span class="${cls}">${fatigue > 0 ? '+' : ''}${fatigue} fatigue</span>`);
    }

    // Thirst (action + passive)
    const thirstRaw = effects.thirst || 0;
    const thirstTotal = thirstRaw + (passive.thirst || 0);
    if (thirstRaw <= -100) {
      parts.push('<span class="action-gain">resets thirst</span>');
    } else if (thirstTotal !== 0) {
      const cls = thirstTotal > 0 ? 'action-cost' : 'action-gain';
      parts.push(`<span class="${cls}">${thirstTotal > 0 ? '+' : ''}${thirstTotal} thirst</span>`);
    }

    // Hunger (action + passive)
    const hungerRaw = effects.hunger || 0;
    const hungerTotal = hungerRaw + (passive.hunger || 0);
    if (hungerRaw <= -100) {
      parts.push('<span class="action-gain">resets hunger</span>');
    } else if (hungerTotal !== 0) {
      const cls = hungerTotal > 0 ? 'action-cost' : 'action-gain';
      parts.push(`<span class="${cls}">${hungerTotal > 0 ? '+' : ''}${hungerTotal} hunger</span>`);
    }

    // Chance indicator for situational actions
    if (action.chance !== undefined && action.chance < 1.0) {
      parts.push(`<span class="action-cost">${Math.round(action.chance * 100)}% chance</span>`);
    }

    // Lose hunters indicator
    if (action.loseHunters) {
      parts.push('<span class="action-gain">may lose hunters</span>');
    }

    // Risk indicator
    if (action.risk) {
      parts.push(`<span class="action-cost">${Math.round(action.risk.chance * 100)}% risk</span>`);
    }

    return parts.join('<span class="action-separator"> | </span>');
  },

  // renderOutcome is handled inline in renderGame

  /**
   * General-purpose typewriter for any text element
   * @param {HTMLElement} element - container to type into
   * @param {string} text - HTML text to type out
   * @param {number} speed - ms per character
   * @param {Function} callback - called when typing finishes
   */
  typewriteText(element, text, speed, callback) {
    const p = document.createElement('p');
    element.appendChild(p);

    // Set full text immediately (invisible) so layout is stable — no reflow as we type
    p.textContent = text;

    let charIndex = 0;
    this._situationTypewriterDone = false;
    this._situationSkipped = false;

    const render = () => {
      const typed = text.substring(0, charIndex);
      const untyped = text.substring(charIndex);
      p.innerHTML = typed + '<span class="tw-hidden">' + untyped + '</span>';
    };

    render(); // start with all text hidden

    const typeNext = () => {
      if (this._situationSkipped) {
        p.textContent = text;
        this._situationTypewriterDone = true;
        if (callback) callback();
        return;
      }
      if (charIndex >= text.length) {
        p.textContent = text;
        this._situationTypewriterDone = true;
        if (callback) callback();
        return;
      }
      charIndex++;
      render();
      setTimeout(typeNext, speed);
    };

    typeNext();
  },

  /**
   * Render the death screen
   * @param {Object} gameState - final game state
   */
  renderDeath(gameState) {
    this.showScreen('screen-death');
    document.body.classList.remove('night-mode');
    this.resetVisualOverlays();

    // Build feedback mailto at runtime to prevent scraper harvesting
    const fb = document.getElementById('feedback-email');
    if (fb && !fb.dataset.set) {
      fb.href = 'mai' + 'lto:' + 'ryan' + '@' + 'ryanpdlittle' + '.com';
      fb.dataset.set = '1';
    }

    // Remove results-visible class from previous death screen
    const deathContainer = document.querySelector('.death-container');
    if (deathContainer) deathContainer.classList.remove('death-results-visible');

    const showResults = () => {
      if (deathContainer) deathContainer.classList.add('death-results-visible');
    };

    // Render death narrative (with optional typewriter)
    const narrativeElement = document.getElementById('death-narrative');
    if (narrativeElement) {
      const narrative = this.getDeathNarrative(gameState.deathCause);
      if (Options.get('typewriterEffect')) {
        narrativeElement.innerHTML = '';
        this._situationSkipped = false;
        this._situationTypewriterDone = false;

        // Skip handler for death typewriter (cleaned up on skip OR completion)
        const cleanupSkipHandlers = () => {
          document.removeEventListener('keydown', deathSkipHandler);
          const deathScreen = document.getElementById('screen-death');
          if (deathScreen) deathScreen.removeEventListener('click', deathSkipHandler);
        };
        const deathSkipHandler = (e) => {
          if (e.type === 'keydown' && e.code !== 'Space') return;
          if (e.type === 'keydown') e.preventDefault();
          this._situationSkipped = true;
          cleanupSkipHandlers();
        };
        document.addEventListener('keydown', deathSkipHandler);
        document.getElementById('screen-death').addEventListener('click', deathSkipHandler);

        this.typewriteText(narrativeElement, narrative, CONFIG.typewriter.speed, () => {
          cleanupSkipHandlers();
          showResults();
        });
      } else {
        narrativeElement.innerHTML = `<p>${narrative}</p>`;
        showResults();
      }
    }

    // Calculate and display score (populate data immediately, but CSS hides until showResults)
    if (typeof Score !== 'undefined' && Score.calculate) {
      const scoreData = Score.calculate(gameState);

      document.getElementById('score-days').textContent = scoreData.days;
      document.getElementById('score-distance').textContent = `${scoreData.distance} mi`;

      // Render percentile comparisons
      const percentileContainer = document.getElementById('percentile-stats');
      if (percentileContainer && Score.calculatePercentiles) {
        const percentiles = Score.calculatePercentiles(scoreData);
        if (percentiles.length > 0) {
          percentileContainer.innerHTML = percentiles
            .map(p => `<div class="percentile-stat">${p}</div>`)
            .join('');
        } else {
          percentileContainer.innerHTML = '';
        }
      }

      // Render achievements
      const achievementsList = document.getElementById('achievements-list');
      if (achievementsList && scoreData.achievements) {
        achievementsList.innerHTML = '';

        if (scoreData.achievements.length > 0) {
          const title = document.createElement('h3');
          title.textContent = 'Achievements';
          achievementsList.appendChild(title);

          const ul = document.createElement('ul');
          scoreData.achievements.forEach(achievement => {
            const li = document.createElement('li');
            li.textContent = achievement;
            ul.appendChild(li);
          });
          achievementsList.appendChild(ul);
        }
      }

      // Auto-save to leaderboard
      if (Score.save) Score.save(scoreData);
    }
  },

  /**
   * Get a death narrative for the given cause
   * @param {string} cause - death cause
   * @returns {string} - narrative text
   */
  getDeathNarrative(cause) {
    const narratives = DEATH_NARRATIVES[cause] || DEATH_NARRATIVES.caught;
    const randomIndex = Math.floor(Math.random() * narratives.length);
    return narratives[randomIndex];
  },

  /**
   * Render the leaderboard screen
   */
  renderLeaderboard() {
    this.showScreen('screen-leaderboard');

    if (typeof Score === 'undefined' || !Score.loadLeaderboard) return;

    const scores = Score.loadLeaderboard();
    const tbody = document.getElementById('leaderboard-body');

    if (!tbody) return;

    tbody.innerHTML = '';

    if (scores.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="5" style="text-align: center;">No runs yet. Be the first to chase.</td>';
      tbody.appendChild(row);
      return;
    }

    scores.forEach((score, index) => {
      const row = document.createElement('tr');

      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${score.days}</td>
        <td>${score.distance} mi</td>
        <td>${score.timesLostHunters}</td>
        <td>${this.formatDeathCause(score.deathCause)}</td>
      `;

      tbody.appendChild(row);
    });
  },

  /**
   * Format death cause for display
   * @param {string} cause - death cause
   * @returns {string} - formatted cause
   */
  formatDeathCause(cause) {
    const causes = {
      caught: 'Caught',
      heatstroke: 'Heatstroke',
      exhaustion: 'Exhaustion',
      dehydration: 'Dehydration',
      starvation: 'Starvation'
    };
    return causes[cause] || cause;
  },

  /**
   * Render how-to-play screen (static content)
   */
  renderHowTo() {
    this.showScreen('screen-howto');
  },

  /**
   * Render options screen with synced toggle states
   */
  renderOptions() {
    this.showScreen('screen-options');
    // Sync difficulty button active state
    const currentDifficulty = Options.get('difficulty');
    document.querySelectorAll('.option-btn[data-option="difficulty"]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === currentDifficulty);
    });
    // Sync toggle states
    const tutorialBtn = document.getElementById('opt-tutorial');
    const openingBtn = document.getElementById('opt-opening');
    const typewriterBtn = document.getElementById('opt-typewriter');
    const situationBtn = document.getElementById('opt-situation-typewriter');
    if (tutorialBtn) {
      const on = Options.get('showTutorial');
      tutorialBtn.textContent = on ? 'ON' : 'OFF';
      tutorialBtn.classList.toggle('off', !on);
    }
    if (openingBtn) {
      const on = Options.get('showOpening');
      openingBtn.textContent = on ? 'ON' : 'OFF';
      openingBtn.classList.toggle('off', !on);
    }
    if (typewriterBtn) {
      const on = Options.get('typewriterEffect');
      typewriterBtn.textContent = on ? 'ON' : 'OFF';
      typewriterBtn.classList.toggle('off', !on);
    }
    if (situationBtn) {
      const on = Options.get('situationTypewriter');
      situationBtn.textContent = on ? 'ON' : 'OFF';
      situationBtn.classList.toggle('off', !on);
    }
    // Sync speed slider and situation toggle visibility
    this._syncSpeedSlider();
  },

  _syncSpeedSlider() {
    const speedInline = document.getElementById('typewriter-speed-inline');
    const speedSlider = document.getElementById('opt-typewriter-speed');
    const situationRow = document.getElementById('opt-situation-row');
    const on = Options.get('typewriterEffect');
    if (speedInline) {
      speedInline.classList.toggle('hidden', !on);
    }
    if (situationRow) {
      situationRow.classList.toggle('hidden', !on);
    }
    if (speedSlider) {
      const speed = Options.get('typewriterSpeed') || CONFIG.typewriter.speed;
      speedSlider.value = speed;
    }
  },

  /**
   * Bind all event handlers
   */
  bindEvents() {
    // Title screen buttons
    const btnStart = document.getElementById('btn-start');
    if (btnStart) {
      btnStart.onclick = () => {
        if (Options.get('showOpening')) {
          this.playTypewriterIntro(() => {
            if (typeof Game !== 'undefined' && Game.newGame) Game.newGame();
          });
        } else {
          if (typeof Game !== 'undefined' && Game.newGame) Game.newGame();
        }
      };
    }

    const btnHowTo = document.getElementById('btn-howto');
    if (btnHowTo) {
      btnHowTo.onclick = () => this.renderHowTo();
    }

    const btnLeaderboard = document.getElementById('btn-leaderboard');
    if (btnLeaderboard) {
      btnLeaderboard.onclick = () => this.renderLeaderboard();
    }

    // Death screen buttons
    const btnTryAgain = document.getElementById('btn-try-again');
    if (btnTryAgain) {
      btnTryAgain.onclick = () => {
        if (typeof Game !== 'undefined' && Game.newGame) {
          Game.newGame();
        }
      };
    }

    const btnReturnTitle = document.getElementById('btn-return-title');
    if (btnReturnTitle) {
      btnReturnTitle.onclick = () => this.renderTitle();
    }

    const btnShareText = document.getElementById('btn-share-text');
    if (btnShareText) {
      btnShareText.onclick = () => {
        if (typeof Score !== 'undefined' && Score.copyToClipboard && typeof Game !== 'undefined') {
          const scoreData = Score.calculate(Game.state);
          const shareText = Score.generateShareText(scoreData);
          Score.copyToClipboard(shareText, btnShareText);

          // Add visual confirmation
          const originalText = btnShareText.textContent;
          btnShareText.textContent = '✓ Copied!';
          btnShareText.style.backgroundColor = 'var(--text-safe)';
          btnShareText.style.color = 'var(--bg-dark)';

          setTimeout(() => {
            btnShareText.textContent = originalText;
            btnShareText.style.backgroundColor = '';
            btnShareText.style.color = '';
          }, 2000);
        }
      };
    }

    const btnShareImage = document.getElementById('btn-share-image');
    if (btnShareImage) {
      btnShareImage.onclick = () => {
        if (typeof Score !== 'undefined' && Score.generateShareImage && typeof Game !== 'undefined') {
          // Disable button and show loading
          btnShareImage.disabled = true;
          const originalText = btnShareImage.textContent;
          btnShareImage.textContent = 'Generating...';

          setTimeout(() => {
            const scoreData = Score.calculate(Game.state);
            Score.generateShareImage(scoreData);

            // Reset button
            btnShareImage.disabled = false;
            btnShareImage.textContent = originalText;
          }, 100);
        }
      };
    }

    // Leaderboard auto-saves on death — no manual submit button needed

    // Keyboard shortcuts for action buttons (1-5) + spacebar skip
    document.addEventListener('keydown', (e) => {
      const gameScreen = document.getElementById('screen-game');
      if (!gameScreen || !gameScreen.classList.contains('active')) return;

      // Spacebar skips situation typewriter
      if (e.code === 'Space' && !this._situationTypewriterDone) {
        e.preventDefault();
        this._situationSkipped = true;
        return;
      }

      // Number keys for action buttons (only when not disabled)
      const num = parseInt(e.key);
      if (num >= 1 && num <= 5) {
        const buttons = document.querySelectorAll('#action-buttons .action-btn');
        if (buttons[num - 1] && !buttons[num - 1].classList.contains('disabled')) {
          buttons[num - 1].click();
        }
      }
    });

    // Tap to skip situation typewriter (mobile)
    const situationEl = document.getElementById('situation-text');
    if (situationEl) {
      situationEl.addEventListener('click', () => {
        if (!this._situationTypewriterDone) {
          this._situationSkipped = true;
        }
      });
    }

    // Back buttons
    const btnHowToBack = document.getElementById('btn-howto-back');
    if (btnHowToBack) {
      btnHowToBack.onclick = () => this.renderTitle();
    }

    const btnLeaderboardBack = document.getElementById('btn-leaderboard-back');
    if (btnLeaderboardBack) {
      btnLeaderboardBack.onclick = () => this.renderTitle();
    }

    const btnLeaderboardClear = document.getElementById('btn-leaderboard-clear');
    if (btnLeaderboardClear) {
      btnLeaderboardClear.onclick = () => {
        if (confirm('Clear all runs from the leaderboard? This cannot be undone.')) {
          Score.clearLeaderboard();
          this.renderLeaderboard();
        }
      };
    }

    // Options
    const btnOptions = document.getElementById('btn-options');
    if (btnOptions) {
      btnOptions.onclick = () => this.renderOptions();
    }

    const btnOptionsBack = document.getElementById('btn-options-back');
    if (btnOptionsBack) {
      btnOptionsBack.onclick = () => this.renderTitle();
    }

    // Difficulty buttons
    document.querySelectorAll('.option-btn[data-option="difficulty"]').forEach(btn => {
      btn.onclick = () => {
        Options.set('difficulty', btn.dataset.value);
        document.querySelectorAll('.option-btn[data-option="difficulty"]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      };
    });

    // Toggle buttons
    document.querySelectorAll('.option-toggle').forEach(btn => {
      btn.onclick = () => {
        const key = btn.dataset.option;
        const newVal = Options.toggle(key);
        btn.textContent = newVal ? 'ON' : 'OFF';
        btn.classList.toggle('off', !newVal);
        // Show/hide speed slider when typewriter toggled
        if (key === 'typewriterEffect') {
          this._syncSpeedSlider();
        }
      };
    });

    // Typewriter speed slider
    const speedSlider = document.getElementById('opt-typewriter-speed');
    if (speedSlider) {
      speedSlider.oninput = () => {
        const speed = parseInt(speedSlider.value, 10);
        Options.set('typewriterSpeed', speed);
        CONFIG.typewriter.speed = speed;
      };
    }
  },

  /**
   * Initialize UI system
   */
  init() {
    Options.load();
    // Apply saved typewriter speed
    const savedSpeed = Options.get('typewriterSpeed');
    if (savedSpeed && typeof CONFIG !== 'undefined') {
      CONFIG.typewriter.speed = savedSpeed;
    }
    this.bindEvents();
    this.renderTitle();
  }
};

// Death narratives for each cause
const DEATH_NARRATIVES = {
  caught: [
    "The rhythm of the footfalls has finally stopped. Not yours—theirs. You turn, and they are there. Closer than they have ever been. The lead hunter's eyes meet yours, and you see something unexpected: respect. Perhaps even sorrow. They have run you down across impossible distance, through days that blurred into agony. And now, at the end, there is only stillness. The chase is over.",

    "You stumble. It is not exhaustion—not quite. It is inevitability. Behind you, the footsteps slow but do not stop. They close the final distance with the patience they have shown from the beginning. You could fight, but your body will not answer. You have run farther than any of your kind has ever run. And it was not enough. The hunters stand over you now. The chase ends not with violence, but with certainty.",

    "The shadow you have carried for days finally overtakes you. You feel them before you see them—a presence that has become part of the landscape, part of your breath. When you turn, they are already there. Not triumphant. Not cruel. Simply there, as inevitable as the sun. You have led them across the world, and they have followed. Now the following is done."
  ],

  heatstroke: [
    "The world shimmers and fades into a blinding white. The heat has been building for hours—days, maybe. You cannot remember when it became unbearable. Your legs fold beneath you, and the ground rushes up, scorching. The sky is too bright. Everything is too bright. In the distance, through the haze, you see the shapes of the hunters. Still walking. Still following. They will find you here, but by then, the sun will have already claimed you.",

    "You no longer feel the heat. That should worry you, but you cannot remember why. The savanna tilts and blurs, and you realize you are on the ground. The earth beneath you radiates warmth like a living thing. Above, the sun is a white void that has swallowed the sky. You try to rise, but your body no longer obeys. Somewhere behind you, the hunters continue their steady approach. They do not need to hurry. The sun has done their work for them.",

    "The heat becomes a sound—a high, ringing whine that drowns out everything else. Your vision narrows to a white tunnel, and at the end of it, nothing. You collapse, and the dust rises around you in slow motion. The ground is like a furnace, but you can barely feel it. The last thing you see, before the white takes everything, is the distant line of the hunters. They are still coming. They will find only bones."
  ],

  exhaustion: [
    "Your legs simply stop. There is no warning, no gradual fade. One moment you are running, and the next you are kneeling in the dust, muscles locked in total refusal. You have asked too much of this body for too long. It has carried you farther than it was ever meant to go, and now it is done. You try to command it to rise, but nothing happens. Behind you, the footsteps grow louder. The hunters have won not through speed, but through endurance. And you have none left.",

    "The collapse comes in stages. First your legs lose their strength, turning to water beneath you. Then your vision dims at the edges, a creeping shadow that no amount of will can push back. You fall forward, catching yourself on trembling forelegs. One more step. Just one. But your body will not give it. You have run until there was nothing left to run on. The hunters are close now—you can hear their breathing. You wonder, distantly, if they feel what you feel. If they, too, are empty. But they are still standing. And you are not.",

    "Your muscles seize all at once, a full-body cramp that drops you like a stone. You lie in the dust, lungs heaving, unable to move. Every fiber of your being has been used, wrung out, consumed. The world narrows to the patch of earth in front of your eyes and the sound of your own ragged breathing. The hunters' footsteps are close now—rhythmic, relentless, unbothered by the heat or the distance or the days. They will reach you soon. You try to rise one last time. Your body does not even respond."
  ],

  dehydration: [
    "Your tongue is a useless slab of leather. Your throat has closed to a pinprick. The world tilts and sways, and you realize the ground is rushing up to meet you. There is no saliva left, no moisture in your mouth, no tears in your eyes. You are dust, held together by will alone, and now even the will is evaporating. The hunters are coming, but they seem distant, unreal. Everything is distant. The only thing that feels real is the terrible, burning thirst—and then, mercifully, even that fades.",

    "You can no longer swallow. Your body has shut down everything that is not essential, and even the essential systems are failing now. You stumble, fall, rise, stumble again. Each time it takes longer to stand. The savanna shimmers with phantom water—pools and rivers that vanish when you approach. You know they are not real, but you stagger toward them anyway. Behind you, the hunters follow. They have water. You can smell it on the wind. But they will not share. They will only wait for you to fall one final time.",

    "The cracked earth mirrors the cracked lining of your throat. You have not drunk in days—or is it hours? Time has become meaningless, measured only in the desperate need for water. Your body is shutting down, conserving what little moisture remains. Your vision blurs and doubles. You collapse, and the world tilts sideways. The hunters are there, at the edge of your fading sight. They carry water skins. You can see them. They will drink when you are gone. The irony is almost enough to make you laugh. Almost."
  ],

  starvation: [
    "The hunger has become something beyond hunger. It is a hollowness that has consumed everything—thought, will, identity. You are an empty skin stretched over bones, moving out of habit rather than purpose. When you finally collapse, it is almost a relief. The ground is cool. The sky is distant. The hunters are coming, but it does not matter anymore. You have been eating yourself from the inside for days, and there is nothing left to consume.",

    "Your body has been burning itself for fuel. First the fat, then the muscle. Now there is nothing left but bone and the thin membrane of will that holds you upright. And even that is failing. You sway, stumble, crash into the earth. You try to rise, but your legs will not support your weight—there is no weight left to support. You are hollow. A husk. The hunters will find you here, light enough for the wind to carry away.",

    "The gnawing emptiness has spread from your belly to your entire being. You are a void, collapsing in on yourself. Each step is a negotiation with a body that has already given up. When you fall, you fall slowly, almost gracefully. The earth receives you like an old friend. Above, the sky is a pale expanse. Behind, the hunters approach. But you are already gone, consumed by your own hunger long before they arrive."
  ]
};

// Initialize UI on page load
document.addEventListener('DOMContentLoaded', () => UI.init());

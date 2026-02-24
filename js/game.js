const Game = {
  state: null,

  /**
   * Deep-merge source onto target (plain objects only, no arrays)
   */
  _deepMerge(target, source) {
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) &&
          target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
        this._deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  },

  /**
   * Apply difficulty settings to CONFIG
   * @param {string} level - 'easy', 'normal', or 'hard'
   */
  applyDifficulty(level) {
    if (!CONFIG._base) return;
    // Restore CONFIG to base values
    const base = JSON.parse(JSON.stringify(CONFIG._base));
    for (const key of Object.keys(base)) {
      if (key === '_base') continue;
      CONFIG[key] = base[key];
    }
    // Apply difficulty overrides
    if (level && level !== 'normal' && CONFIG.difficulty[level]) {
      this._deepMerge(CONFIG, CONFIG.difficulty[level]);
    }
  },

  newGame() {
    // Apply difficulty before reading CONFIG values
    const difficulty = (typeof Options !== 'undefined') ? Options.get('difficulty') : 'normal';
    this.applyDifficulty(difficulty);

    this.state = {
      day: 1,
      phase: 'day',
      heat: CONFIG.starting.heat,
      stamina: CONFIG.starting.stamina,
      thirst: CONFIG.starting.thirst,
      hunger: CONFIG.starting.hunger,
      hunterDistance: CONFIG.starting.hunterDistance,
      hunterSpeed: CONFIG.hunter.baseSpeed,
      hunterState: 'pursuit',
      hunterWaterBoostDays: 0,
      trackingDaysLeft: 0,
      timesLostHunters: 0,
      distanceCovered: 0,
      currentEncounter: null,
      monologue: null,
      lastAction: null,
      lastOutcome: null,
      isAlive: true,
      deathCause: null,
      // Achievement tracking
      achievementStats: {
        nightPushes: 0,
        timesRested: 0,
        phasesWithHighThirst: 0,
        phasesNearDeath: 0
      },
      lastActionSucceeded: null
    };

    if (typeof Encounters !== 'undefined') {
      Encounters.reset();
      this.state.currentEncounter = Encounters.generate(this.state);
    }

    if (typeof Monologue !== 'undefined') {
      Monologue.reset();
      this.state.monologue = Monologue.select(this.state, null);
    }

    if (typeof UI !== 'undefined') {
      UI.resetVisualOverlays();
      UI.renderGame(this.state);
    }
  },

  /**
   * Process a player action — THE MAIN GAME LOOP
   * actionKey can be a standard key ('push','trot','rest') or a custom encounter action key
   */
  processAction(actionKey) {
    if (!this.state || !this.state.isAlive) return;

    // Find the action data from the current encounter's actions array
    const action = this.findAction(actionKey);
    if (!action) {
      console.error('Invalid action:', actionKey);
      return;
    }

    this.state.lastAction = actionKey;

    // Track achievement stats
    if (actionKey === 'push' && this.state.phase === 'night') {
      this.state.achievementStats.nightPushes++;
    }
    if (actionKey === 'rest') {
      this.state.achievementStats.timesRested++;
    }

    // Capture stats before effects for history tracking
    const statsBefore = {
      heat: this.state.heat,
      stamina: this.state.stamina,
      thirst: this.state.thirst,
      hunger: this.state.hunger,
      hunterDistance: this.state.hunterDistance
    };

    // Get the effects — either from the action's effects object or CONFIG standard
    const effects = action.effects || {};
    const playerDistance = action.distance !== undefined ? action.distance : (effects.distance || 0);

    // Handle risk-based actions (signature encounters with chance of failure/penalty)
    let riskTriggered = false;
    if (action.risk && Math.random() < action.risk.chance) {
      riskTriggered = true;
    }

    // Handle chance-based situational actions (combinatorial drink/eat with % success)
    let chanceSucceeded = true;
    if (action.chance !== undefined && action.chance < 1.0) {
      chanceSucceeded = Math.random() < action.chance;
    }

    // Apply effects
    if (action.isStandard || !action.isSituational || chanceSucceeded) {
      this.state.heat += effects.heat || 0;
      this.state.stamina += effects.stamina || 0;
      this.state.thirst += effects.thirst || 0;
      this.state.hunger += effects.hunger || 0;
    }

    // Apply risk penalty if triggered
    if (riskTriggered && action.risk && action.risk.penalty) {
      const penalty = action.risk.penalty;
      this.state.heat += penalty.heat || 0;
      this.state.stamina += penalty.stamina || 0;
      this.state.thirst += penalty.thirst || 0;
      this.state.hunger += penalty.hunger || 0;
    }

    // Apply passive drains
    const drains = CONFIG.passiveDrain[this.state.phase];
    this.state.heat += drains.heat || 0;
    this.state.stamina += drains.stamina || 0;
    this.state.thirst += drains.thirst || 0;
    this.state.hunger += drains.hunger || 0;

    // Calculate hunter distance change
    if (typeof Hunters !== 'undefined') {
      const distanceChange = Hunters.calculateDistanceChange(playerDistance, this.state);
      this.state.hunterDistance += distanceChange;
    }

    // Update hunter tracking (every phase, not just night)
    if (typeof Hunters !== 'undefined') {
      Hunters.updateTracking(this.state);
    }

    // Handle trail loss from this specific action
    if (action.loseHunters && typeof Hunters !== 'undefined') {
      Hunters.loseTrail(this.state);
    }

    // Track distance covered
    if (playerDistance > 0) {
      this.state.distanceCovered += playerDistance;
    }

    // Water boost for hunters when player drinks
    if (actionKey === 'drink' || action.key === 'drink') {
      this.state.hunterWaterBoostDays = CONFIG.hunter.waterBoostDuration;
    }
    if (this.state.hunterWaterBoostDays > 0) {
      this.state.hunterWaterBoostDays -= 1;
    }

    // Track near-death and high-thirst phases for achievements
    if (this.state.thirst >= 80) this.state.achievementStats.phasesWithHighThirst++;
    if (this.state.heat >= 90 || this.state.stamina <= 10 || this.state.thirst >= 90 || this.state.hunger >= 90 || this.state.hunterDistance <= 3) {
      this.state.achievementStats.phasesNearDeath++;
    }

    // Clamp stats
    this.clampStats();

    // Check death
    const deathCause = this.checkDeath();
    if (deathCause) {
      this.state.isAlive = false;
      this.state.deathCause = deathCause;
      if (typeof UI !== 'undefined') UI.renderDeath(this.state);
      return;
    }

    // Track whether the last action succeeded (for monologue system)
    this.state.lastActionSucceeded = chanceSucceeded;

    // Track chance-based failure for UI flash feedback
    this.state.lastActionFailed = (action.chance !== undefined && action.chance < 1.0 && !chanceSucceeded);

    // Build outcome text
    this.state.lastOutcome = this.buildOutcomeText(action, riskTriggered, chanceSucceeded);

    // Advance phase
    this.advancePhase();

    // Generate next encounter — rest keeps same terrain with fresh opportunity/pressure
    if (typeof Encounters !== 'undefined') {
      if (actionKey === 'rest' && this.state.currentEncounter) {
        this.state.currentEncounter = Encounters.regenerateSameLocation(this.state.currentEncounter, this.state);
      } else {
        this.state.currentEncounter = Encounters.generate(this.state);
      }
    }

    // Generate monologue (skip drink/eat triggers if the action failed)
    if (typeof Monologue !== 'undefined') {
      this.state.monologue = Monologue.select(this.state, chanceSucceeded ? actionKey : null);
    }

    // Render (with transition animation on phase changes)
    if (typeof UI !== 'undefined') UI.renderGame(this.state, { transition: true });
  },

  /**
   * Find action data from the current encounter's actions array
   */
  findAction(actionKey) {
    if (!this.state.currentEncounter || !this.state.currentEncounter.actions) {
      // Fallback: build from CONFIG if no encounter
      const phase = this.state.phase;
      const configAction = CONFIG.actions[phase] && CONFIG.actions[phase][actionKey];
      if (configAction) {
        return {
          key: actionKey,
          effects: configAction,
          distance: configAction.distance || 0,
          isStandard: true
        };
      }
      return null;
    }

    return this.state.currentEncounter.actions.find(a => a.key === actionKey) || null;
  },

  advancePhase() {
    if (this.state.phase === 'day') {
      this.state.phase = 'night';
    } else {
      this.state.phase = 'day';
      this.state.day += 1;
    }
  },

  checkDeath() {
    if (this.state.hunterDistance <= CONFIG.death.minHunterDistance) return 'caught';
    if (this.state.heat >= CONFIG.death.maxHeat) return 'heatstroke';
    if (this.state.stamina <= CONFIG.death.minStamina) return 'exhaustion';
    if (this.state.thirst >= CONFIG.death.maxThirst) return 'dehydration';
    if (this.state.hunger >= CONFIG.death.maxHunger) return 'starvation';
    return null;
  },

  clampStats() {
    this.state.heat = Math.max(0, Math.min(100, this.state.heat));
    this.state.stamina = Math.max(0, Math.min(100, this.state.stamina));
    this.state.thirst = Math.max(0, Math.min(100, this.state.thirst));
    this.state.hunger = Math.max(0, Math.min(100, this.state.hunger));
  },

  /**
   * Build outcome narrative for the action taken
   */
  buildOutcomeText(action, riskTriggered, chanceSucceeded) {
    // Signature/rare encounters with risk
    if (riskTriggered && action.risk && action.risk.text) {
      return action.risk.text;
    }

    // Chance-based actions that failed — text varies by action type
    if (action.chance !== undefined && !chanceSucceeded) {
      const k = action.key;
      let failTexts;

      if (k === 'dig' || k === 'drink' || k === 'wallow' || k === 'search') {
        // Water-related failures
        failTexts = [
          'You dig until your claws ache. The earth gives nothing. Dry all the way down.',
          'The scent of water led you here but the source is gone. Cracked mud and old bones.',
          'You nose along the bank and find only sand. The river moved on without you.',
          'Nothing. The ground is baked through and the effort leaves you worse than before.'
        ];
      } else if (k === 'eat' || k === 'hunt' || k === 'scavenge' || k === 'feed' || k === 'forage' || k === 'steal') {
        // Food-related failures
        failTexts = [
          'The carcass is stripped clean. Vultures and hyenas have left you nothing but bone.',
          'You crouch and spring but the prey was faster. Hunger remains and the delay costs you.',
          'Teeth close on empty air. Whatever was here scattered long before you arrived.',
          'You search the undergrowth and come away with nothing. The land is picked clean.'
        ];
      } else {
        // Generic fallback
        failTexts = [
          'You search but find nothing. The effort was wasted, and the hunters gain ground.',
          'Your attempt yields nothing. The land does not always provide.',
          'The search comes up empty. Time lost, nothing gained.'
        ];
      }

      return failTexts[Math.floor(Math.random() * failTexts.length)];
    }

    // Use action description for signature encounter choices (not chance-based situational actions)
    if (action.description && !action.isStandard && action.chance === undefined) {
      return action.description;
    }

    // Standard action outcomes
    const phase = this.state.phase;
    const isNight = phase === 'night';
    const key = action.key;
    const distance = action.distance || (action.effects && action.effects.distance) || 0;

    if (key === 'push') {
      const texts = isNight
        ? [`You push through the darkness, covering ${distance} miles. Exhaustion follows.`,
           `Hard miles in the dark. ${distance} miles gained. The shadows offer no comfort.`]
        : [`You push hard through the heat, covering ${distance} miles. The dust rises behind you.`,
           `${distance} miles of relentless flight. Your body protests but obeys.`];
      return texts[Math.floor(Math.random() * texts.length)];
    }

    if (key === 'trot') {
      const texts = isNight
        ? [`A steady ${distance} miles through the night. You preserve yourself.`,
           `You trot through the darkness, covering ${distance} miles.`]
        : [`You maintain a steady trot, covering ${distance} miles. Is it enough?`,
           `${distance} miles at a sustainable pace. The hunters match your rhythm.`];
      return texts[Math.floor(Math.random() * texts.length)];
    }

    if (key === 'rest') {
      const texts = isNight
        ? ['You rest under the stars. Your body recovers, but they draw closer.',
           'The cool night soothes your burning skin. Dawn will come too soon.']
        : ['You find shade and rest. The heat drains away. The hunters do not rest.',
           'You stop to recover. The gap between you and them narrows.'];
      return texts[Math.floor(Math.random() * texts.length)];
    }

    if (key === 'drink' || key === 'dig' || key === 'wallow' || key === 'search') {
      const texts = [
        'Water. The world makes sense again when your throat is cool. They will know you were here.',
        'You drink deep and feel the life return to your limbs. The mud holds your tracks like a confession.',
        'Cool water against cracked tongue. For a moment the fear loosens its grip. But the scent you leave is a beacon.',
        'The water is silted and warm but it is water. You drink until your belly aches. Somewhere behind you they will find this place.'
      ];
      return texts[Math.floor(Math.random() * texts.length)];
    }

    if (key === 'eat' || key === 'scavenge' || key === 'hunt' || key === 'feed' || key === 'forage' || key === 'steal') {
      const texts = [
        'Meat in your belly. Strength returning. But the delay costs you distance.',
        'You eat fast and without grace. Blood on your muzzle and the old power flowing back into tired muscle.',
        'Flesh and sinew. The body remembers what it is built for. But every moment spent feeding is a moment they spend closing.',
        'You gorge on what the land offers and feel the hunger retreat. The kill site will draw their eyes like a signal fire.'
      ];
      return texts[Math.floor(Math.random() * texts.length)];
    }

    return 'You act. The world responds. The hunt continues.';
  }
};

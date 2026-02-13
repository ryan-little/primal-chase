const Game = {
  state: null,

  newGame() {
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
      }
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

    // Update hunter tracking
    if (this.state.phase === 'night' && typeof Hunters !== 'undefined') {
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
    if (this.state.hunterWaterBoostDays > 0 && this.state.phase === 'night') {
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

    // Build outcome text
    this.state.lastOutcome = this.buildOutcomeText(action, riskTriggered, chanceSucceeded);

    // Advance phase
    this.advancePhase();

    // Generate next encounter
    if (typeof Encounters !== 'undefined') {
      this.state.currentEncounter = Encounters.generate(this.state);
    }

    // Generate monologue
    if (typeof Monologue !== 'undefined') {
      this.state.monologue = Monologue.select(this.state, actionKey);
    }

    // Render
    if (typeof UI !== 'undefined') UI.renderGame(this.state);
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

    // Chance-based actions that failed
    if (action.chance !== undefined && !chanceSucceeded) {
      const failTexts = [
        'You search but find nothing. The effort was wasted, and the hunters gain ground.',
        'Your attempt yields nothing. The land does not always provide.',
        'The search comes up empty. Time lost, nothing gained.'
      ];
      return failTexts[Math.floor(Math.random() * failTexts.length)];
    }

    // Use action description if it's a signature encounter choice
    if (action.description && !action.isStandard) {
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
      return 'Water. The world makes sense again when your throat is cool. They will know you were here.';
    }

    if (key === 'eat' || key === 'scavenge' || key === 'hunt' || key === 'feed' || key === 'forage' || key === 'steal') {
      return 'Meat in your belly. Strength returning. But the delay costs you distance.';
    }

    return 'You act. The world responds. The hunt continues.';
  }
};

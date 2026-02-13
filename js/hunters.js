const Hunters = {
  /**
   * Calculate how the distance between player and hunters changes this turn
   * @param {number} playerDistance - miles the player moved
   * @param {Object} gameState - current game state
   * @returns {number} - positive means player gained distance, negative means hunters gained
   */
  calculateDistanceChange(playerDistance, gameState) {
    const hunterAdvance = this.getHunterAdvance(playerDistance, gameState);
    return playerDistance - hunterAdvance;
  },

  /**
   * Calculate how far hunters advance this turn
   * @param {number} playerDistance - miles the player moved
   * @param {Object} gameState - current game state
   * @returns {number} - miles hunters advance
   */
  getHunterAdvance(playerDistance, gameState) {
    const isNight = gameState.phase === 'night';
    const isPlayerStationary = playerDistance === 0;

    // Night behavior: hunters camp, advance much less
    if (isNight) {
      if (isPlayerStationary) {
        return CONFIG.hunterGainOnStationaryNight;
      } else {
        return CONFIG.hunter.nightGain;
      }
    }

    // Day behavior: hunters always move at full effective speed
    const effectiveSpeed = this.getEffectiveSpeed(gameState);
    return effectiveSpeed;
  },

  /**
   * Get the current effective speed of hunters (with all modifiers)
   * @param {Object} gameState - current game state
   * @returns {number} - effective speed in miles per phase
   */
  getEffectiveSpeed(gameState) {
    // Start with base speed
    let speed = CONFIG.hunter.baseSpeed;

    // If in tracking mode, use tracking speed instead
    if (gameState.hunterState === 'tracking') {
      return CONFIG.hunter.trackingSpeed;
    }

    // Add escalation from previous trail losses
    speed += CONFIG.hunter.escalationPerLoss * gameState.timesLostHunters;

    // Apply terrain modifiers if we have currentTerrain
    if (gameState.currentTerrain) {
      const terrain = gameState.currentTerrain;
      if (terrain === 'mountain' || terrain === 'mountains') {
        speed *= CONFIG.hunter.mountainPenalty;
      } else if (terrain === 'jungle' || terrain === 'dense') {
        speed *= CONFIG.hunter.junglePenalty;
      } else if (terrain === 'plain' || terrain === 'plains' || terrain === 'grassland') {
        speed *= CONFIG.hunter.plainBoost;
      }
    }

    // Apply water boost if active
    if (gameState.hunterWaterBoostDays > 0) {
      speed *= CONFIG.hunter.waterBoost;
    }

    return speed;
  },

  /**
   * Called when an encounter triggers trail loss
   * @param {Object} gameState - current game state (mutated)
   */
  loseTrail(gameState) {
    gameState.hunterState = 'tracking';

    // Random duration between min and max
    const min = CONFIG.hunter.trackingDuration.min;
    const max = CONFIG.hunter.trackingDuration.max;
    gameState.trackingDaysLeft = Math.floor(Math.random() * (max - min + 1)) + min;

    gameState.timesLostHunters += 1;
  },

  /**
   * Update tracking state (call once per day)
   * @param {Object} gameState - current game state (mutated)
   */
  updateTracking(gameState) {
    if (gameState.hunterState === 'tracking' && gameState.trackingDaysLeft > 0) {
      gameState.trackingDaysLeft -= 1;

      // When countdown reaches 0, return to pursuit
      if (gameState.trackingDaysLeft === 0) {
        gameState.hunterState = 'pursuit';
      }
    }
  },

  /**
   * Get atmospheric flavor text about hunter proximity
   * @param {number} distance - miles between player and hunters
   * @param {string} hunterState - 'pursuit' or 'tracking'
   * @param {string} phase - 'day' or 'night'
   * @returns {string} - atmospheric description
   */
  getHunterFlavorText(distance, hunterState, phase) {
    const isNight = phase === 'night';

    // Special text for tracking mode
    if (hunterState === 'tracking') {
      const trackingTexts = [
        "The hunters have lost your scent. Their confusion echoes across the distance.",
        "You sense their uncertainty. They circle, search, hesitate. But they will not give up.",
        "The pursuit has paused. They move in patterns now, searching for signs. You are a ghost to them, for now."
      ];
      return trackingTexts[Math.floor(Math.random() * trackingTexts.length)];
    }

    // Distance-based flavor text
    if (distance >= 20) {
      const texts = isNight
        ? [
            "At night, you can barely sense them. A distant point of firelight, perhaps. Or perhaps nothing.",
            "The darkness hides them well. But you know they are out there, resting as you should be.",
            "They are far behind. Their campfire smoke reaches you on the wind, faint as a memory."
          ]
        : [
            "They are distant. A smudge on the horizon that might be dust or heat shimmer.",
            "You can barely sense them, but they are there. Always there.",
            "The hunters are far enough that you could almost forget them. Almost."
          ];
      return texts[Math.floor(Math.random() * texts.length)];
    }

    if (distance >= 10) {
      const texts = isNight
        ? [
            "You can see their campfire clearly now. Orange light against the dark. They do not rest as deeply as normal prey.",
            "At night they stop, but they are close. You smell the smoke of their fire.",
            "Their fire burns bright enough to see. They are a presence on the edge of every thought."
          ]
        : [
            "The hunters are a persistent smudge on the horizon. They never break stride.",
            "You can see the dust they raise. It follows you like your own shadow.",
            "They maintain the gap, never gaining, never losing. The patience is unnatural."
          ];
      return texts[Math.floor(Math.random() * texts.length)];
    }

    if (distance >= 5) {
      const texts = isNight
        ? [
            "Their campfire is close enough to hear voices. Strange sounds. Laughter, maybe. You do not understand it.",
            "The fire's light reaches you. You can smell meat cooking. They are close.",
            "You watch their fire and wonder what drives them. They should have given up days ago."
          ]
        : [
            "You can see the dust they kick up. Individual figures are visible when you look back.",
            "They are close enough that you recognize their rhythm. The lead hunter moves with purpose.",
            "The gap narrows. You see them when you crest each rise. They see you."
          ];
      return texts[Math.floor(Math.random() * texts.length)];
    }

    if (distance >= 2) {
      const texts = isNight
        ? [
            "Their fire is so close you could reach it in moments. They know this. They wait for dawn.",
            "You can hear them moving in their camp. Sounds of preparation. They will run at first light.",
            "The firelight reaches your hiding place. They are too close. But the night protects you still."
          ]
        : [
            "You can hear them breathing. The rhythm never breaks. Step after step after step.",
            "They are close enough to see your eyes when you look back. You see theirs. They do not look away.",
            "The distance between you has collapsed to almost nothing. Every movement matters now.",
            "You feel their presence like heat on your back. They are not tired. They should be tired."
          ];
      return texts[Math.floor(Math.random() * texts.length)];
    }

    // Less than 2 miles - critical proximity
    const texts = isNight
      ? [
          "They are close enough to hear your breathing. Only the darkness keeps you apart.",
          "Their fire is within reach. You can see their faces in the light. They are watching for you.",
          "The night is all that stands between you and them. When dawn comes, they will move."
        ]
      : [
          "They are right there. You can see the whites of their eyes. The lead hunter points at you.",
          "The distance has evaporated. You are no longer fleeing. You are barely staying ahead.",
          "They are close enough to throw. To touch. To kill. But they maintain the chase.",
          "This is the end of distance. They are upon you. Only speed remains."
        ];
    return texts[Math.floor(Math.random() * texts.length)];
  }
};

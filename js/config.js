const CONFIG = {
  // Starting conditions
  starting: {
    heat: 0,
    stamina: 100,
    thirst: 0,
    hunger: 0,
    hunterDistance: 25
  },

  // Death thresholds
  death: {
    maxHeat: 100,
    minStamina: 0,
    maxThirst: 100,
    maxHunger: 100,
    minHunterDistance: 0
  },

  // Hunter system
  hunter: {
    baseSpeed: 5.5,
    dailyEscalation: 0.1,     // hunters speed up +0.1 per day
    trackingSpeed: 2,          // speed while searching for trail
    trackingDuration: { min: 1, max: 3 },  // days in tracking mode
    escalationPerLoss: 0.8,    // speed increase each time trail is re-found
    waterBoost: 1.5,           // speed multiplier after player visits water
    waterBoostDuration: 1,     // days the water boost lasts
    mountainPenalty: 0.7,      // speed multiplier in mountains
    junglePenalty: 0.6,        // speed multiplier in jungle/dense
    plainBoost: 1.2,           // speed multiplier on open plains
    nightGain: 0.8             // distance hunters gain at night (they camp)
  },

  // Day actions
  actions: {
    day: {
      push:  { distance: 6, heat: 20, stamina: -20, thirst: 15, hunger: 10 },
      trot:  { distance: 3, heat: 10, stamina: -10, thirst: 10, hunger: 5 },
      rest:  { distance: 0, heat: -25, stamina: 20, thirst: 0, hunger: 3 },
      drink: { distance: 0, heat: 10, stamina: -5, thirst: -100, hunger: 0 },
      eat:   { distance: 0, heat: 15, stamina: -5, thirst: -50, hunger: -100 }
    },
    night: {
      push:  { distance: 5, heat: 10, stamina: -20, thirst: 8, hunger: 10 },
      trot:  { distance: 2, heat: 5, stamina: -10, thirst: 5, hunger: 5 },
      rest:  { distance: 0, heat: -30, stamina: 25, thirst: 0, hunger: 3 },
      drink: { distance: 0, heat: 0, stamina: -5, thirst: -100, hunger: 0 },
      eat:   { distance: 0, heat: 5, stamina: -5, thirst: -50, hunger: -100 }
    }
  },

  // Distance hunters gain when player does non-movement actions
  hunterGainOnStationaryDay: 5,    // full hunter speed during day
  hunterGainOnStationaryNight: 0.5, // hunters camp at night

  // Passive drains per phase (applied regardless of action)
  passiveDrain: {
    day:   { heat: 5, stamina: 0, thirst: 5, hunger: 3 },
    night: { heat: -10, stamina: 5, thirst: 2, hunger: 3 }
  },

  // Encounter system
  encounters: {
    signatureChancePerPhase: 0.15,   // 15% chance of signature encounter
    rareChancePerPhase: 0.008,       // <1% chance of rare/legendary event
    drinkAvailableChance: 0.3,       // 30% base chance drink action appears
    eatAvailableChance: 0.25,        // 25% base chance eat action appears
    loseHuntersChance: 0.1           // 10% base chance for trail-losing event
  },

  // Score
  score: {
    maxLeaderboardEntries: 10
  },

  // Typewriter effect
  typewriter: {
    speed: 20,           // ms per character for situation/death text
    introSpeed: 35       // ms per character for opening intro
  },

  // Phase transition
  transition: {
    duration: 2000,              // ms for phase transition lockout
    barAnimationDuration: 1500   // ms for status bar animation
  }
};

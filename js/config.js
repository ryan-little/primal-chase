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
    nightGain: 0.8             // distance hunters gain at night (they camp)
  },

  // Day actions
  actions: {
    day: {
      push:  { distance: 6, heat: 20, stamina: -20, thirst: 15, hunger: 10 },
      trot:  { distance: 3, heat: 10, stamina: -10, thirst: 10, hunger: 5 },
      rest:  { distance: 0, heat: -20, stamina: 20, thirst: 0, hunger: 3 },
      drink: { distance: 0, heat: 10, stamina: -5, thirst: -100, hunger: 0 },
      eat:   { distance: 0, heat: 15, stamina: -5, thirst: -30, hunger: -100 }
    },
    night: {
      push:  { distance: 5, heat: 10, stamina: -20, thirst: 8, hunger: 10 },
      trot:  { distance: 2, heat: 5, stamina: -10, thirst: 5, hunger: 5 },
      rest:  { distance: 0, heat: -30, stamina: 25, thirst: 0, hunger: 3 },
      drink: { distance: 0, heat: 0, stamina: -5, thirst: -100, hunger: 0 },
      eat:   { distance: 0, heat: 5, stamina: -5, thirst: -30, hunger: -100 }
    }
  },

  // Distance hunters gain when player does non-movement actions
  hunterGainOnStationaryDay: 5,    // full hunter speed during day
  hunterGainOnStationaryNight: 0.5, // hunters camp at night

  // Passive drains per phase (applied regardless of action)
  passiveDrain: {
    day:   { heat: 5, stamina: 0, thirst: 5, hunger: 3 },
    night: { heat: -8, stamina: 5, thirst: 2, hunger: 3 }
  },

  // Encounter system
  encounters: {
    signatureChancePerPhase: 0.15,   // 15% chance of signature encounter
    rareChancePerPhase: 0.008        // <1% chance of rare/legendary event
  },

  // Score
  score: {
    maxLeaderboardEntries: 10
  },

  // Typewriter effect
  typewriter: {
    speed: 30,           // ms per character for death text
    introSpeed: 45       // ms per character for opening intro
  },

  // Phase transition
  transition: {
    duration: 2000,              // ms for phase transition lockout
    barAnimationDuration: 1500   // ms for status bar animation
  },

  // Terrain categories for monologue triggers
  terrainCategories: {
    water: ['watering_hole', 'seasonal_stream', 'reed_bed', 'dry_riverbed', 'sandy_wash', 'dried_marsh'],
    open: ['salt_flat', 'open_plain', 'red_dunes', 'clay_pan', 'burned_ground', 'ash_field', 'dry_lake_bed'],
    dense: ['acacia_grove', 'bamboo_grove', 'fallen_tree_grove', 'thorn_thicket', 'mopane_woodland', 'tall_grass', 'fever_trees'],
    rocky: ['rocky_outcrop', 'kopje', 'granite_plateau', 'volcanic_rock', 'sandstone_arches', 'whistling_caves', 'overhang_cave', 'ridge_line'],
    shelter: ['overhang_cave', 'baobab', 'kopje', 'termite_cathedral']
  },

  // Pressure categories for monologue triggers
  pressureCategories: {
    injury: ['injured_paw', 'bleeding_paw', 'cramps', 'muscle_spasm', 'blurred_vision'],
    weather: ['storm_approaching', 'midday_sun', 'cool_breeze', 'moonless_night', 'dusk_light'],
    hunter_sign: ['hunters_gaining', 'scent_on_wind', 'ground_vibrations'],
    decay: ['flies_swarming', 'circling_vultures_personal']
  },

  // Difficulty overrides (applied on game start)
  difficulty: {
    easy: {
      starting: { hunterDistance: 30 },
      hunter: { baseSpeed: 4.5, dailyEscalation: 0.08 },
      passiveDrain: {
        day:   { heat: 5, stamina: 0, thirst: 3, hunger: 2 },
        night: { heat: -8, stamina: 5, thirst: 1, hunger: 2 }
      }
    },
    hard: {
      starting: { hunterDistance: 18 },
      hunter: { baseSpeed: 6.5, dailyEscalation: 0.15, escalationPerLoss: 1.2 },
      passiveDrain: {
        day:   { heat: 5, stamina: 0, thirst: 7, hunger: 4 },
        night: { heat: -6, stamina: 3, thirst: 3, hunger: 4 }
      }
    }
  }
};

// Snapshot base values for difficulty reset
CONFIG._base = JSON.parse(JSON.stringify(CONFIG));

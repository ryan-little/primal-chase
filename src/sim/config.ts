// Balance constants. The V1 numbers survive because five simulation rounds
// tuned them; the spatial layer prices movement in "effort miles" so the
// same economy plays out on real terrain. No three.js imports anywhere in
// sim/ — this all runs headless.

import type { Phase } from '../content/types';

export interface ActionEffects {
  distance: number;
  heat: number;
  stamina: number;
  thirst: number;
  hunger: number;
}

export interface SimConfig {
  starting: { heat: number; stamina: number; thirst: number; hunger: number; hunterDistance: number };
  death: { maxHeat: number; minStamina: number; maxThirst: number; maxHunger: number; minHunterDistance: number };
  hunter: {
    baseSpeed: number;
    dailyEscalation: number;
    trackingSpeed: number;
    trackingDuration: { min: number; max: number };
    escalationPerLoss: number;
    waterBoost: number;
    waterBoostDuration: number;
    nightGain: number;
    gainOnStationaryNight: number;
    /** How strongly rough ground on the player's path slows them (0..1). */
    terrainSensitivity: number;
    /** Peak odds of the pursuit breaking on ground that holds no print. */
    trailLossBase: number;
    /** Ground with scent >= this reads like a signed confession. */
    scentFloor: number;
    /** Fraction of doubled-back slack they claw back by cutting across. */
    cornerCutRate: number;
    /** Real miles of slack before a route counts as doubling back. */
    cornerCutGraceMiles: number;
    /**
     * Persistence hunters never lose you entirely: the gap cannot exceed
     * this. Without it, early kiting outruns escalation forever.
     */
    maxDistance: number;
  };
  actions: Record<Phase, Record<string, ActionEffects>>;
  passiveDrain: Record<Phase, { heat: number; stamina: number; thirst: number; hunger: number }>;
  encounters: { signatureChancePerPhase: number; rareChancePerPhase: number };
  movement: {
    /** Effort-mile budgets per gait. */
    trotMiles: number;
    pushMiles: number;
    /** Extra vitals per effort-mile spent beyond real miles (rough ground). */
    roughHeatPerMile: number;
    roughStaminaPerMile: number;
    roughThirstPerMile: number;
    /** Night movement surcharge (the dark taxes the body, not the stride). */
    nightPenalty: { pushStamina: number; pushThirst: number; trotStamina: number; trotThirst: number };
  };
  monologue: {
    terrainCategories: Record<string, string[]>;
    pressureCategories: Record<string, string[]>;
  };
}

export const BASE_CONFIG: SimConfig = {
  starting: { heat: 0, stamina: 100, thirst: 0, hunger: 0, hunterDistance: 25 },
  death: { maxHeat: 100, minStamina: 0, maxThirst: 100, maxHunger: 100, minHunterDistance: 0 },
  hunter: {
    baseSpeed: 5.5,
    dailyEscalation: 0.18,
    trackingSpeed: 2,
    trackingDuration: { min: 1, max: 3 },
    escalationPerLoss: 0.8,
    waterBoost: 1.5,
    waterBoostDuration: 1,
    nightGain: 0.8,
    gainOnStationaryNight: 0.5,
    terrainSensitivity: 0.55,
    trailLossBase: 0.34,
    scentFloor: 0.85,
    cornerCutRate: 0.32,
    cornerCutGraceMiles: 2.0,
    maxDistance: 32
  },
  actions: {
    day: {
      push:  { distance: 6.5, heat: 22, stamina: -17, thirst: 15, hunger: 10 },
      trot:  { distance: 3.5, heat: 11, stamina: -10, thirst: 8, hunger: 5 },
      rest:  { distance: 0, heat: -20, stamina: 27, thirst: 0, hunger: 3 },
      drink: { distance: 0, heat: 11, stamina: -5, thirst: -100, hunger: 0 },
      eat:   { distance: 0, heat: 16, stamina: -5, thirst: -30, hunger: -100 }
    },
    night: {
      push:  { distance: 6.5, heat: 10, stamina: -17, thirst: 8, hunger: 10 },
      trot:  { distance: 3.5, heat: 5, stamina: -10, thirst: 5, hunger: 5 },
      rest:  { distance: 0, heat: -30, stamina: 32, thirst: 0, hunger: 3 },
      drink: { distance: 0, heat: 0, stamina: -5, thirst: -100, hunger: 0 },
      eat:   { distance: 0, heat: 5, stamina: -5, thirst: -30, hunger: -100 }
    }
  },
  passiveDrain: {
    // Hunger eased from V1's 3.5: terrain-true encounters make food rarer
    // than V1's random deck did, so the drain compensates (sim-verified).
    day:   { heat: 6, stamina: 0, thirst: 5, hunger: 3.0 },
    night: { heat: -8, stamina: 5, thirst: 2, hunger: 3.0 }
  },
  encounters: { signatureChancePerPhase: 0.15, rareChancePerPhase: 0.008 },
  movement: {
    trotMiles: 3.5,
    pushMiles: 6.5,
    roughHeatPerMile: 3.5,
    roughStaminaPerMile: 6,
    roughThirstPerMile: 3,
    nightPenalty: { pushStamina: 4, pushThirst: 3, trotStamina: 2, trotThirst: 2 }
  },
  monologue: {
    terrainCategories: {
      water: ['watering_hole', 'seasonal_stream', 'reed_bed', 'dry_riverbed', 'sandy_wash', 'dried_marsh'],
      open: ['salt_flat', 'open_plain', 'red_dunes', 'clay_pan', 'burned_ground', 'ash_field', 'dry_lake_bed'],
      dense: ['acacia_grove', 'bamboo_grove', 'fallen_tree_grove', 'thorn_thicket', 'mopane_woodland', 'tall_grass', 'fever_trees'],
      rocky: ['rocky_outcrop', 'granite_plateau', 'volcanic_rock', 'sandstone_arches', 'whistling_caves', 'ridge_line'],
      shelter: ['overhang_cave', 'baobab', 'kopje', 'termite_cathedral']
    },
    pressureCategories: {
      injury: ['injured_paw', 'bleeding_paw', 'cramps', 'muscle_spasm', 'blurred_vision'],
      weather: ['storm_approaching', 'midday_sun', 'cool_breeze', 'moonless_night', 'dusk_light'],
      hunter_sign: ['hunters_gaining', 'scent_on_wind', 'ground_vibrations'],
      decay: ['flies_swarming', 'circling_vultures_personal']
    }
  }
};

export type Difficulty = 'easy' | 'normal' | 'hard';

/** Difficulty variants, cloned from BASE_CONFIG with V1's overrides. */
export function configFor(difficulty: Difficulty): SimConfig {
  const c: SimConfig = structuredClone(BASE_CONFIG);
  if (difficulty === 'easy') {
    c.starting.hunterDistance = 30;
    c.hunter.baseSpeed = 4.5;
    c.hunter.dailyEscalation = 0.08;
    c.passiveDrain.day = { heat: 5, stamina: 0, thirst: 3, hunger: 2 };
    c.passiveDrain.night = { heat: -8, stamina: 5, thirst: 1, hunger: 2 };
  } else if (difficulty === 'hard') {
    c.starting.hunterDistance = 20;
    c.hunter.baseSpeed = 6.3;
    c.hunter.dailyEscalation = 0.13;
    c.hunter.escalationPerLoss = 1.0;
    c.passiveDrain.day = { heat: 6, stamina: 0, thirst: 7, hunger: 3.5 };
    c.passiveDrain.night = { heat: -6, stamina: 3, thirst: 3, hunger: 3.5 };
  }
  return c;
}

// The persistence hunters — V1's escalation math on Fable's real ground.
// hunterDistance stays the authoritative scalar (real miles of separation);
// the world position is derived by walking back along the player's trail.

import type { Rng } from '../world/rng';
import type { SimConfig } from './config';

export type HunterState = 'pursuit' | 'tracking';

export interface HunterModel {
  state: HunterState;
  /** Real miles between the band and the player. */
  distance: number;
  trackingDaysLeft: number;
  timesLost: number;
  waterBoostDays: number;
}

export function newHunters(config: SimConfig): HunterModel {
  return {
    state: 'pursuit',
    distance: config.starting.hunterDistance,
    trackingDaysLeft: 0,
    timesLost: 0,
    waterBoostDays: 0
  };
}

/** Miles per phase the band covers right now, before terrain. */
export function effectiveSpeed(h: HunterModel, day: number, config: SimConfig): number {
  if (h.state === 'tracking') return config.hunter.trackingSpeed;
  let speed = config.hunter.baseSpeed
    + config.hunter.dailyEscalation * (day - 1)
    + config.hunter.escalationPerLoss * h.timesLost;
  if (h.waterBoostDays > 0) speed *= config.hunter.waterBoost;
  return speed;
}

/**
 * Miles the band advances this phase.
 * @param terrainFactor <=1 — how much the ground the player crossed slows them
 */
export function advance(
  h: HunterModel, day: number, phase: 'day' | 'night',
  playerMoved: boolean, terrainFactor: number, config: SimConfig
): number {
  if (phase === 'night') {
    return playerMoved ? config.hunter.nightGain : config.hunter.gainOnStationaryNight;
  }
  return effectiveSpeed(h, day, config) * terrainFactor;
}

/** Terrain factor from the mean hunter-difficulty along the player's path. */
export function terrainFactorFor(avgHunterDifficulty: number, config: SimConfig): number {
  const s = config.hunter.terrainSensitivity;
  // Hard ground slows them; easy ground never makes them faster than base.
  return Math.min(1, 1 + (1 / avgHunterDifficulty - 1) * s);
}

/** Odds that a path whose worst ground holds `minScent` breaks the pursuit. */
export function trailBreakChance(h: HunterModel, minScent: number, config: SimConfig): number {
  if (h.state !== 'pursuit') return 0;
  const hidden = Math.max(0, (config.hunter.scentFloor - minScent) / config.hunter.scentFloor);
  return Math.min(0.75, config.hunter.trailLossBase * hidden);
}

export function loseTrail(h: HunterModel, rng: Rng, config: SimConfig): void {
  h.state = 'tracking';
  h.trackingDaysLeft = rng.int(config.hunter.trackingDuration.min, config.hunter.trackingDuration.max);
  h.timesLost += 1;
}

/** Nightly bookkeeping: tracking countdown and water-boost decay. */
export function nightTick(h: HunterModel): void {
  if (h.state === 'tracking' && h.trackingDaysLeft > 0) {
    h.trackingDaysLeft -= 1;
    if (h.trackingDaysLeft === 0) h.state = 'pursuit';
  }
  if (h.waterBoostDays > 0) h.waterBoostDays -= 1;
}

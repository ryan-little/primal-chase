// The game. Pure logic over the seeded world — no rendering imports — so the
// same class drives the browser game, the tests, and the balance sims.
//
// A turn: choose a destination inside your reach (gait emerges from how much
// effort it takes) or an in-place verb from the encounter. Vitals pay per
// effort-mile at V1's tuned rates; hunters advance at V1's speeds, slowed by
// the ground you dragged them across; low-scent paths can break the pursuit.

import { Biomes } from '../world/biomes';
import { Nav, METERS_PER_MILE, type NavNode } from '../world/nav';
import { Rng } from '../world/rng';
import type { Phase, VitalEffects } from '../content/types';
import { configFor, type Difficulty, type SimConfig } from './config';
import { EncounterEngine, type Encounter, type EncounterAction } from './encounters';
import { MonologueEngine } from './monologue';
import {
  advance, loseTrail, newHunters, nightTick, terrainFactorFor,
  trailBreakChance, type HunterModel
} from './hunters';

export type DeathCause = 'caught' | 'heatstroke' | 'exhaustion' | 'dehydration' | 'starvation';

interface TrailPoint { x: number; z: number; miles: number; }

export interface GameState {
  seed: number;
  day: number;
  phase: Phase;
  heat: number;
  stamina: number;
  thirst: number;
  hunger: number;
  x: number;
  z: number;
  trail: TrailPoint[];
  trailMiles: number;
  hunters: HunterModel;
  distanceCovered: number;
  isAlive: boolean;
  deathCause: DeathCause | null;
  encounter: Encounter | null;
  monologue: string;
  lastAction: string | null;
  outcome: string | null;
  stats: {
    nightPushes: number;
    timesRested: number;
    phasesWithHighThirst: number;
    phasesNearDeath: number;
    highestGround: number;
    trailBreaks: number;
  };
}

export interface MovePreview {
  node: NavNode;
  gait: 'trot' | 'push';
  effortMiles: number;
  realMiles: number;
  effects: Required<VitalEffects>;
  hunterAdvance: number;
  trailBreakChance: number;
  terrainId: string;
}

export interface TurnResult {
  kind: 'move' | 'action';
  actionKey: string;
  gait: 'trot' | 'push' | null;
  realMiles: number;
  hunterAdvance: number;
  brokeTrail: boolean;
  trailBreakKind: 'action' | 'ground' | null;
  cornerCut: number;
  riskTriggered: boolean;
  chanceSucceeded: boolean;
  riskText: string | null;
  died: boolean;
  deathCause: DeathCause | null;
  path: NavNode[] | null;
}

export class Game {
  readonly config: SimConfig;
  readonly rng: Rng;
  readonly biomes: Biomes;
  readonly nav: Nav;
  readonly encounters: EncounterEngine;
  readonly monologueEngine: MonologueEngine;
  state!: GameState;
  tutorial = true;

  constructor(seed: number, difficulty: Difficulty = 'normal') {
    this.config = configFor(difficulty);
    this.rng = new Rng(seed ^ 0x9a7f);
    this.biomes = new Biomes(seed);
    this.nav = new Nav(this.biomes);
    this.encounters = new EncounterEngine(this.config, this.rng);
    this.monologueEngine = new MonologueEngine(this.config, this.rng);
    this.newGame(seed);
  }

  newGame(seed: number): GameState {
    this.encounters.reset();
    this.monologueEngine.reset();

    // Open on true open country: flat grassland, clear of mountain belts and
    // water, so the chase begins the way the fiction says it does — on the
    // wide savannah with sight in every direction.
    let x = 0, z = 0;
    const startAngle = (seed % 360) * (Math.PI / 180);
    outer: for (let r = 0; r < 60000; r += 1200) {
      for (let a = 0; a < 8; a++) {
        const t = startAngle + (a / 8) * Math.PI * 2;
        const sx = Math.cos(t) * r, sz = Math.sin(t) * r;
        const s = this.biomes.sample(sx, sz);
        if (s.terrainId !== 'open_plain' || s.waterDepth > 0) continue;
        if (s.belt > 0.05 || s.river > 0.1 || s.basin > 0.1) continue;
        // Reject bowls: neighbours must sit near the same height.
        let flat = true;
        for (let k = 0; k < 4; k++) {
          const nk = this.biomes.field.height(
            sx + Math.cos(k * 1.57) * 900, sz + Math.sin(k * 1.57) * 900);
          if (Math.abs(nk - s.height) > 60) { flat = false; break; }
        }
        if (flat) { x = sx; z = sz; break outer; }
      }
    }
    const snapped = this.nav.snap(x, z);
    x = snapped.ix * 220; z = snapped.iz * 220;

    const c = this.config;
    this.state = {
      seed,
      day: 1,
      phase: 'day',
      heat: c.starting.heat,
      stamina: c.starting.stamina,
      thirst: c.starting.thirst,
      hunger: c.starting.hunger,
      x, z,
      trail: [{ x, z, miles: 0 }],
      trailMiles: 0,
      hunters: newHunters(c),
      distanceCovered: 0,
      isAlive: true,
      deathCause: null,
      encounter: null,
      monologue: '',
      lastAction: null,
      outcome: null,
      stats: {
        nightPushes: 0, timesRested: 0, phasesWithHighThirst: 0,
        phasesNearDeath: 0, highestGround: 0, trailBreaks: 0
      }
    };
    const here = this.biomes.sample(x, z);
    this.state.encounter = this.encounters.generate(this.view(), here.terrainId, this.tutorial);
    this.state.monologue = this.monologueEngine.select(this.view(), null, this.state.encounter);
    return this.state;
  }

  /** The read-only view content predicates consume. */
  view() {
    const S = this.state;
    return {
      day: S.day, phase: S.phase, heat: S.heat, stamina: S.stamina,
      thirst: S.thirst, hunger: S.hunger,
      hunterDistance: S.hunters.distance, hunterState: S.hunters.state
    };
  }

  /** Full reach map for this phase's push budget. */
  reach(): Map<string, NavNode> {
    return this.nav.reach(this.state.x, this.state.z, this.config.movement.pushMiles);
  }

  /** Per-effort-mile vital rates for a gait in a phase. */
  private gaitRates(gait: 'trot' | 'push', phase: Phase) {
    const a = this.config.actions[phase][gait]!;
    const budget = gait === 'push' ? this.config.movement.pushMiles : this.config.movement.trotMiles;
    const np = this.config.movement.nightPenalty;
    const nightStam = phase === 'night' ? (gait === 'push' ? np.pushStamina : np.trotStamina) / budget : 0;
    const nightThirst = phase === 'night' ? (gait === 'push' ? np.pushThirst : np.trotThirst) / budget : 0;
    return {
      heat: a.heat / budget,
      stamina: a.stamina / budget - nightStam,
      thirst: a.thirst / budget + nightThirst,
      hunger: a.hunger / budget
    };
  }

  /** Path metrics the hunter model needs. */
  private pathMetrics(path: NavNode[]) {
    let minScent = Infinity, hunterSum = 0;
    for (let i = 1; i < path.length; i++) {
      const s = path[i]!.sample;
      const scent = s.waterDepth > 0.05 ? 0.1 : s.terrain.scent;
      if (scent < minScent) minScent = scent;
      hunterSum += s.terrain.hunter;
    }
    const n = Math.max(1, path.length - 1);
    return { minScent: Number.isFinite(minScent) ? minScent : 1, avgHunter: hunterSum / n };
  }

  previewMove(node: NavNode, reachMap: Map<string, NavNode>): MovePreview {
    const S = this.state;
    const effortMiles = node.cost / METERS_PER_MILE;
    const realMiles = node.meters / METERS_PER_MILE;
    const gait: 'trot' | 'push' = effortMiles <= this.config.movement.trotMiles ? 'trot' : 'push';
    const rates = this.gaitRates(gait, S.phase);
    const drains = this.config.passiveDrain[S.phase];
    const mods = S.encounter?.gaitModifiers[gait] ?? {};

    const rough = Math.max(0, effortMiles - realMiles);
    const M = this.config.movement;

    const effects = {
      distance: realMiles,
      heat: rates.heat * effortMiles + drains.heat + rough * M.roughHeatPerMile + (mods.heat ?? 0),
      stamina: rates.stamina * effortMiles + drains.stamina - rough * M.roughStaminaPerMile + (mods.stamina ?? 0),
      thirst: rates.thirst * effortMiles + drains.thirst + rough * M.roughThirstPerMile + (mods.thirst ?? 0),
      hunger: rates.hunger * effortMiles + drains.hunger + (mods.hunger ?? 0)
    };

    const path = this.nav.path(reachMap, node.ix + ',' + node.iz);
    const { minScent, avgHunter } = this.pathMetrics(path);
    const tf = terrainFactorFor(avgHunter, this.config);
    return {
      node, gait, effortMiles, realMiles,
      effects,
      hunterAdvance: advance(S.hunters, S.day, S.phase, true, tf, this.config),
      trailBreakChance: trailBreakChance(S.hunters, minScent, this.config),
      terrainId: node.sample.terrainId
    };
  }

  commitMove(node: NavNode, reachMap: Map<string, NavNode>): TurnResult {
    const S = this.state;
    const path = this.nav.path(reachMap, node.ix + ',' + node.iz);
    const preview = this.previewMove(node, reachMap);
    const { minScent, avgHunter } = this.pathMetrics(path);

    S.lastAction = preview.gait;
    if (preview.gait === 'push' && S.phase === 'night') S.stats.nightPushes++;

    S.heat += preview.effects.heat;
    S.stamina += preview.effects.stamina;
    S.thirst += preview.effects.thirst;
    S.hunger += preview.effects.hunger;

    // Walk the trail.
    for (let i = 1; i < path.length; i++) {
      const p = path[i]!, prev = path[i - 1]!;
      const stepMiles = Math.hypot(p.x - prev.x, p.z - prev.z) / METERS_PER_MILE;
      S.trailMiles += stepMiles;
      S.trail.push({ x: p.x, z: p.z, miles: S.trailMiles });
    }
    if (S.trail.length > 700) S.trail.splice(0, S.trail.length - 700);
    S.x = node.x; S.z = node.z;
    S.distanceCovered += preview.realMiles;
    if (node.sample.height > S.stats.highestGround) S.stats.highestGround = node.sample.height;

    return this.resolveCommon({
      kind: 'move', actionKey: preview.gait, gait: preview.gait,
      realMiles: preview.realMiles,
      terrainFactor: terrainFactorFor(avgHunter, this.config),
      groundBreakChance: trailBreakChance(S.hunters, minScent, this.config),
      action: null, path
    });
  }

  commitAction(key: string): TurnResult | null {
    const S = this.state;
    const action = S.encounter?.actions.find((a) => a.key === key);
    if (!action) return null;
    S.lastAction = key;
    if (key === 'rest') S.stats.timesRested++;

    let riskTriggered = false;
    if (action.risk && this.rng.chance(action.risk.chance)) riskTriggered = true;
    let chanceSucceeded = true;
    if (action.chance !== undefined && action.chance < 1) chanceSucceeded = this.rng.chance(action.chance);

    if (action.isStandard || !action.isSituational || chanceSucceeded) {
      S.heat += action.effects.heat ?? 0;
      S.stamina += action.effects.stamina ?? 0;
      S.thirst += action.effects.thirst ?? 0;
      S.hunger += action.effects.hunger ?? 0;
    }
    if (riskTriggered && action.risk) {
      S.heat += action.risk.penalty.heat ?? 0;
      S.stamina += action.risk.penalty.stamina ?? 0;
      S.thirst += action.risk.penalty.thirst ?? 0;
      S.hunger += action.risk.penalty.hunger ?? 0;
    }
    const drains = this.config.passiveDrain[S.phase];
    S.heat += drains.heat; S.stamina += drains.stamina;
    S.thirst += drains.thirst; S.hunger += drains.hunger;

    const miles = action.distance ?? 0;
    S.distanceCovered += miles;

    return this.resolveCommon({
      kind: 'action', actionKey: key, gait: null, realMiles: miles,
      terrainFactor: 1, groundBreakChance: 0,
      action, riskTriggered, chanceSucceeded, path: null
    });
  }

  private resolveCommon(turn: {
    kind: 'move' | 'action'; actionKey: string; gait: 'trot' | 'push' | null;
    realMiles: number; terrainFactor: number; groundBreakChance: number;
    action: EncounterAction | null; riskTriggered?: boolean; chanceSucceeded?: boolean;
    path: NavNode[] | null;
  }): TurnResult {
    const S = this.state;
    const H = S.hunters;

    const adv = advance(H, S.day, S.phase, turn.realMiles > 0, turn.terrainFactor, this.config);
    H.distance += turn.realMiles - adv;

    // Trail breaks: the encounter's own verb, or ground that keeps no print.
    let brokeTrail = false;
    let breakKind: 'action' | 'ground' | null = null;
    if (turn.action?.loseHunters && (turn.chanceSucceeded ?? true)) {
      loseTrail(H, this.rng, this.config);
      brokeTrail = true; breakKind = 'action'; S.stats.trailBreaks++;
    } else if (turn.groundBreakChance > 0 && this.rng.chance(turn.groundBreakChance)) {
      loseTrail(H, this.rng, this.config);
      brokeTrail = true; breakKind = 'ground'; S.stats.trailBreaks++;
    }

    // Doubling back lets them cut across the loop.
    let cornerCut = 0;
    if (!brokeTrail && H.state === 'pursuit') {
      const hp = this.hunterPosition();
      const straight = Math.hypot(S.x - hp.x, S.z - hp.z) / METERS_PER_MILE;
      const grace = this.config.hunter.cornerCutGraceMiles;
      if (straight < H.distance - grace) {
        cornerCut = (H.distance - straight - grace) * this.config.hunter.cornerCutRate;
        H.distance -= cornerCut;
      }
    }

    // Drinking marks the water; they know where you have to stop.
    if (turn.actionKey === 'drink' || (turn.action && turn.action.key === 'drink')) {
      H.waterBoostDays = this.config.hunter.waterBoostDuration;
    }

    if (S.phase === 'night') nightTick(H);

    if (S.thirst >= 80) S.stats.phasesWithHighThirst++;
    if (S.heat >= 90 || S.stamina <= 10 || S.thirst >= 90 || S.hunger >= 90 || H.distance <= 3) {
      S.stats.phasesNearDeath++;
    }

    // Clamp, death, phase flip, next encounter.
    S.heat = Math.min(100, Math.max(0, S.heat));
    S.stamina = Math.min(100, Math.max(0, S.stamina));
    S.thirst = Math.min(100, Math.max(0, S.thirst));
    S.hunger = Math.min(100, Math.max(0, S.hunger));

    const result: TurnResult = {
      kind: turn.kind, actionKey: turn.actionKey, gait: turn.gait,
      realMiles: Math.round(turn.realMiles * 10) / 10,
      hunterAdvance: Math.round(adv * 10) / 10,
      brokeTrail, trailBreakKind: breakKind,
      cornerCut: Math.round(cornerCut * 10) / 10,
      riskTriggered: turn.riskTriggered ?? false,
      chanceSucceeded: turn.chanceSucceeded ?? true,
      riskText: (turn.riskTriggered && turn.action?.risk) ? turn.action.risk.text : null,
      died: false, deathCause: null,
      path: turn.path
    };

    const death = this.checkDeath();
    if (death) {
      S.isAlive = false;
      S.deathCause = death;
      result.died = true;
      result.deathCause = death;
      return result;
    }

    // Advance the clock and re-read the land.
    if (S.phase === 'day') S.phase = 'night';
    else { S.phase = 'day'; S.day += 1; }

    const here = this.biomes.sample(S.x, S.z);
    S.encounter = this.encounters.generate(this.view(), here.terrainId, this.tutorial);
    S.monologue = this.monologueEngine.select(
      this.view(), result.chanceSucceeded ? turn.actionKey : null, S.encounter);

    return result;
  }

  checkDeath(): DeathCause | null {
    const S = this.state, c = this.config.death;
    if (S.hunters.distance <= c.minHunterDistance) return 'caught';
    if (S.heat >= c.maxHeat) return 'heatstroke';
    if (S.stamina <= c.minStamina) return 'exhaustion';
    if (S.thirst >= c.maxThirst) return 'dehydration';
    if (S.hunger >= c.maxHunger) return 'starvation';
    return null;
  }

  /** Where the band physically is: back along the trail by their distance. */
  hunterPosition(): { x: number; z: number } {
    const S = this.state;
    const target = S.trailMiles - S.hunters.distance;
    const trail = S.trail;
    if (target <= (trail[0]?.miles ?? 0)) {
      // Beyond the recorded trail: extend the first leg backwards.
      const a = trail[0]!, b = trail[Math.min(1, trail.length - 1)]!;
      const dx = a.x - b.x, dz = a.z - b.z;
      const len = Math.hypot(dx, dz) || 1;
      const short = ((trail[0]?.miles ?? 0) - target) * METERS_PER_MILE;
      return { x: a.x + (dx / len) * short, z: a.z + (dz / len) * short };
    }
    for (let i = trail.length - 1; i > 0; i--) {
      const a = trail[i - 1]!, b = trail[i]!;
      if (target >= a.miles && target <= b.miles) {
        const t = (target - a.miles) / Math.max(1e-9, b.miles - a.miles);
        return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
      }
    }
    return { x: trail[trail.length - 1]!.x, z: trail[trail.length - 1]!.z };
  }
}

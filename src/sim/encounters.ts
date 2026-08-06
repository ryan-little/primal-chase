// The encounter engine — V1's three-layer generator, with the terrain layer
// BOUND to the ground the player actually stands on. Where V1 rolled a random
// terrain card, Fable looks up the arrival point's terrain id, so the text
// always describes the visible world.

import {
  opportunities, pressures, rares, signatures, terrains
} from '../content/encounters';
import type {
  EncounterFlags, EncounterStateView, OpportunityEntry, Phase, PressureEntry,
  SignatureEntry, TerrainEntry, VitalEffects
} from '../content/types';
import type { Rng } from '../world/rng';
import type { SimConfig } from './config';

const terrainById = new Map<string, TerrainEntry>(terrains.map((t) => [t.id, t]));

/** Biome ids with no dedicated V1 terrain card fall back to a kin card. */
const TERRAIN_FALLBACK: Record<string, string> = {
  seasonal_stream: 'watering_hole',
  reed_bed: 'watering_hole',
  dried_marsh: 'dry_riverbed',
  sandy_wash: 'dry_riverbed',
  clay_pan: 'salt_flat',
  dry_lake_bed: 'salt_flat',
  red_dunes: 'salt_flat',
  ash_field: 'burned_ground',
  elephant_path: 'open_plain',
  mopane_woodland: 'acacia_grove',
  fever_trees: 'acacia_grove',
  granite_plateau: 'rocky_outcrop',
  volcanic_rock: 'rocky_outcrop',
  ridge_line: 'rocky_outcrop',
  whistling_caves: 'overhang_cave',
  sandstone_arches: 'rocky_outcrop'
};

export function terrainCardFor(terrainId: string): TerrainEntry {
  return terrainById.get(terrainId)
    ?? terrainById.get(TERRAIN_FALLBACK[terrainId] ?? 'open_plain')
    ?? terrains[0]!;
}

export interface EncounterAction {
  key: string;
  name: string;
  description: string;
  effects: VitalEffects;
  distance: number;
  chance?: number;
  loseHunters?: boolean;
  risk?: { chance: number; penalty: VitalEffects; text: string } | null;
  isStandard: boolean;
  isSituational?: boolean;
  special?: string;
}

export interface Encounter {
  type: 'combinatorial' | 'signature' | 'rare';
  id: string;
  name: string;
  text: string;
  terrain?: TerrainEntry;
  opportunity?: OpportunityEntry;
  pressure?: PressureEntry;
  /** In-place verbs (rest/drink/eat/situational or signature choices). */
  actions: EncounterAction[];
  /** Verb-keyed modifiers applied to gait costs (push/trot). */
  gaitModifiers: Record<string, VitalEffects>;
  loseHuntersAvailable: boolean;
}

export class EncounterEngine {
  private usedSignatures = new Set<string>();
  private recentOpportunities: string[] = [];
  private recentPressures: string[] = [];
  readonly flags: EncounterFlags = { usedOldTerritory: false };

  constructor(readonly config: SimConfig, readonly rng: Rng) {}

  reset(): void {
    this.usedSignatures.clear();
    this.recentOpportunities = [];
    this.recentPressures = [];
    this.flags.usedOldTerritory = false;
  }

  /**
   * A landmark site always speaks: force an unused, eligible signature.
   * Falls back to the combinatorial generator when every card is spent.
   */
  forceSignature(state: EncounterStateView, terrainId: string): Encounter {
    const sig = this.tryFrom(signatures, state, false);
    if (sig) {
      this.usedSignatures.add(sig.id);
      return this.formatSignature(sig, state, 'signature');
    }
    return this.buildCombinatorial(state, terrainId);
  }

  /** Generate the encounter for the ground under the player's feet. */
  generate(state: EncounterStateView, terrainId: string, tutorial: boolean): Encounter {
    if (state.day === 1 && tutorial) {
      const id = state.phase === 'day' ? 'tutorial_day' : 'tutorial_night';
      const t = signatures.find((s) => s.id === id);
      if (t && !this.usedSignatures.has(id)) {
        this.usedSignatures.add(id);
        return this.formatSignature(t, state, 'signature');
      }
    }
    if (this.rng.chance(this.config.encounters.rareChancePerPhase)) {
      const rare = this.tryFrom(rares, state, true);
      if (rare) return this.formatSignature(rare, state, 'rare');
    }
    if (this.rng.chance(this.config.encounters.signatureChancePerPhase)) {
      const sig = this.tryFrom(signatures, state, false);
      if (sig) {
        this.usedSignatures.add(sig.id);
        return this.formatSignature(sig, state, 'signature');
      }
    }
    return this.buildCombinatorial(state, terrainId);
  }

  private tryFrom(list: SignatureEntry[], state: EncounterStateView, rare: boolean): SignatureEntry | null {
    const eligible = list.filter((s) => {
      if (!rare && this.usedSignatures.has(s.id)) return false;
      if (s.id.startsWith('tutorial')) return false;
      if (s.minDay && state.day < s.minDay) return false;
      if (s.maxDay && state.day > s.maxDay) return false;
      if (s.nightOnly && state.phase !== 'night') return false;
      if (s.dayOnly && state.phase !== 'day') return false;
      return true;
    });
    return eligible.length ? this.rng.pick(eligible) : null;
  }

  private formatSignature(entry: SignatureEntry, state: EncounterStateView, type: 'signature' | 'rare'): Encounter {
    const actions: EncounterAction[] = [];
    for (const choice of entry.choices) {
      if (choice.effects === null) {
        // "Use the standard action with this key" — V1 semantics.
        const phaseActions = this.config.actions[state.phase];
        const effects = phaseActions[choice.key] ?? phaseActions['trot']!;
        actions.push({
          key: choice.key, name: choice.name, description: choice.description,
          effects, distance: effects.distance, isStandard: true
        });
      } else {
        actions.push({
          key: choice.key, name: choice.name, description: choice.description,
          effects: choice.effects, distance: choice.distance ?? 0,
          loseHunters: choice.loseHunters ?? false, risk: choice.risk ?? null,
          isStandard: false, special: choice.special
        });
      }
    }
    return {
      type, id: entry.id, name: entry.name, text: entry.text, actions,
      gaitModifiers: {},
      loseHuntersAvailable: actions.some((a) => a.loseHunters)
    };
  }

  private buildCombinatorial(state: EncounterStateView, terrainId: string): Encounter {
    const terrain = terrainCardFor(terrainId);

    // Opportunity: compatible with the terrain card, phase-aware, not recent.
    const isNight = state.phase === 'night';
    const dedup = (o: OpportunityEntry) => o.baseId ?? o.id;
    const compatible = (o: OpportunityEntry) =>
      terrain.compatible.includes(dedup(o)) || terrain.compatible.includes(o.id);
    const phaseOk = (o: OpportunityEntry) => !(o.nightOnly && !isNight);

    let pool = opportunities.filter((o) =>
      phaseOk(o) && compatible(o) && !this.recentOpportunities.includes(dedup(o)));
    if (pool.length === 0) pool = opportunities.filter((o) => phaseOk(o) && compatible(o));
    if (pool.length === 0) pool = opportunities.filter(phaseOk);
    const opportunity = this.rng.pick(pool);
    this.recentOpportunities.push(dedup(opportunity));
    if (this.recentOpportunities.length > 12) this.recentOpportunities.shift();

    // Pressure: condition-gated, not recent.
    const test = (p: PressureEntry) => {
      try { return p.condition(state, this.flags); } catch { return p.fallbackCondition; }
    };
    let pPool = pressures.filter((p) => !this.recentPressures.includes(p.id) && test(p));
    if (pPool.length === 0) pPool = pressures.filter(test);
    if (pPool.length === 0) pPool = pressures.filter((p) => p.fallbackCondition);
    const pressure = this.rng.pick(pPool);
    this.recentPressures.push(pressure.id);
    if (this.recentPressures.length > 7) this.recentPressures.shift();
    if (pressure.oneTime) this.flags.usedOldTerritory = true;

    const terrainText = isNight && terrain.nightText ? terrain.nightText : terrain.text;

    return {
      type: 'combinatorial',
      id: `${terrain.id}_${opportunity.id}_${pressure.id}`,
      name: terrain.name,
      text: `${terrainText} ${opportunity.text} ${pressure.text}`,
      terrain, opportunity, pressure,
      actions: this.combinatorialActions(terrain, opportunity, pressure, state.phase),
      gaitModifiers: this.gaitModifiers(terrain, opportunity, pressure),
      loseHuntersAvailable: false
    };
  }

  /** Summed push/trot modifiers from all three layers (applied to moves). */
  private gaitModifiers(
    terrain: TerrainEntry, opportunity: OpportunityEntry, pressure: PressureEntry
  ): Record<string, VitalEffects> {
    const out: Record<string, VitalEffects> = {};
    for (const layer of [terrain.modifiers, opportunity.modifiers, pressure.modifiers]) {
      for (const [verb, mods] of Object.entries(layer)) {
        if (verb !== 'push' && verb !== 'trot') continue;
        const slot = (out[verb] ??= {});
        for (const [stat, delta] of Object.entries(mods!)) {
          if (stat === 'chance') continue;
          (slot as Record<string, number>)[stat] =
            ((slot as Record<string, number>)[stat] ?? 0) + (delta as number);
        }
      }
    }
    return out;
  }

  private combinatorialActions(
    terrain: TerrainEntry, opportunity: OpportunityEntry, pressure: PressureEntry, phase: Phase
  ): EncounterAction[] {
    const actions: EncounterAction[] = [];

    // Rest is always offered in place (movement replaces push/trot buttons).
    const rest = { ...this.config.actions[phase]['rest']! };
    for (const layer of [terrain.modifiers, opportunity.modifiers, pressure.modifiers]) {
      const mods = layer['rest'];
      if (mods) {
        for (const [stat, delta] of Object.entries(mods)) {
          if (stat === 'chance') continue;
          (rest as unknown as Record<string, number>)[stat] =
            ((rest as unknown as Record<string, number>)[stat] ?? 0) + (delta as number);
        }
      }
    }
    actions.push({
      key: 'rest', name: 'Rest', description: 'Rest and recover your strength',
      effects: rest, distance: 0, isStandard: true
    });

    // Situational verbs from terrain, then opportunity (no duplicate keys).
    const addSituational = (src: TerrainEntry | OpportunityEntry) => {
      for (const a of src.actions) {
        if (actions.some((x) => x.key === a.key && x.isSituational)) continue;
        let chance = a.chance;
        if (a.key === 'drink' && 'modifiers' in src) {
          // Crocodile-style risk modifiers adjust drink odds.
          const drinkMod = opportunity.modifiers['drink'];
          if (drinkMod?.chance && src === terrain) chance += drinkMod.chance;
        }
        if (chance <= 0) continue;
        const effects = this.config.actions[phase][a.key] ?? this.config.actions.day[a.key]
          ?? { distance: 0, heat: 10, stamina: -5, thirst: 0, hunger: 0 };
        actions.push({
          key: a.key, name: a.name,
          description: `${a.description} (${Math.round(chance * 100)}% chance)`,
          effects, distance: 0, chance, isStandard: false, isSituational: true
        });
      }
    };
    addSituational(terrain);
    addSituational(opportunity);

    return actions;
  }
}

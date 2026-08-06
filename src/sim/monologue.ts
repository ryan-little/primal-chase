// The cat's inner voice — V1's selection logic, verbatim semantics, with an
// injected RNG so simulations stay deterministic.

import { fragments } from '../content/monologue';
import type { Mood } from '../content/types';
import type { Rng } from '../world/rng';
import type { SimConfig } from './config';
import type { Encounter } from './encounters';

const DRINK_KEYS = new Set(['drink', 'cross', 'wade', 'drink_elephants', 'plunge_pool',
  'dig_deep', 'risk_drink', 'drink_rest', 'drink_go', 'wallow']);
const EAT_KEYS = new Set(['eat', 'hunt', 'scavenge', 'fight', 'steal', 'feast',
  'gorge', 'raid', 'dominate', 'kill_python']);

export interface MonologueView {
  day: number;
  phase: 'day' | 'night';
  heat: number;
  stamina: number;
  thirst: number;
  hunger: number;
  hunterDistance: number;
  hunterState: 'pursuit' | 'tracking';
}

export class MonologueEngine {
  private recentlyUsed: string[] = [];
  private readonly maxRecent = 15;

  constructor(readonly config: SimConfig, readonly rng: Rng) {}

  reset(): void { this.recentlyUsed = []; }

  moodFor(day: number): Mood {
    if (day <= 3) return 'confident';
    if (day <= 6) return 'concerned';
    if (day <= 10) return 'desperate';
    return 'haunted';
  }

  triggersFor(state: MonologueView, lastAction: string | null, encounter: Encounter | null): string[] {
    const t: string[] = [];
    if (lastAction === 'push') t.push('after_push');
    if (lastAction === 'rest') t.push('after_rest');
    if (lastAction && DRINK_KEYS.has(lastAction)) t.push('after_drink');
    if (lastAction && EAT_KEYS.has(lastAction)) t.push('after_eat');

    if (state.heat >= 70) t.push('high_heat');
    if (state.stamina <= 30) t.push('low_stamina');
    if (state.thirst >= 60) t.push('high_thirst');
    if (state.hunger >= 60) t.push('high_hunger');
    if (state.phase === 'night') t.push('night');
    if (state.hunterState === 'tracking') t.push('lost_hunters');

    if (state.hunterDistance > 20) t.push('hunters_far');
    if (state.hunterDistance >= 8 && state.hunterDistance <= 20) t.push('hunters_medium');
    if (state.hunterDistance < 8) t.push('hunters_close');

    if (state.heat >= 85 || state.stamina <= 15 || state.thirst >= 85 ||
        state.hunger >= 85 || state.hunterDistance <= 3) {
      t.push('near_death');
    }
    if (this.rng.chance(0.15 + state.day * 0.02)) t.push('lore');

    if (encounter?.terrain) {
      for (const [cat, ids] of Object.entries(this.config.monologue.terrainCategories)) {
        if (ids.includes(encounter.terrain.id)) t.push('terrain_' + cat);
      }
    }
    if (encounter?.pressure) {
      for (const [cat, ids] of Object.entries(this.config.monologue.pressureCategories)) {
        if (ids.includes(encounter.pressure.id)) t.push('pressure_' + cat);
      }
    }
    return t;
  }

  select(state: MonologueView, lastAction: string | null, encounter: Encounter | null): string {
    const mood = this.moodFor(state.day);
    const triggers = this.triggersFor(state, lastAction, encounter);

    const candidates = fragments.filter((f) => {
      if (f.mood !== mood) return false;
      if (f.minDay && state.day < f.minDay) return false;
      if (f.nightOnly && state.phase !== 'night') return false;
      if (this.recentlyUsed.includes(f.text)) return false;
      return true;
    });

    const triggered = candidates.filter((f) => f.triggers?.some((t) => triggers.includes(t)));

    let selected;
    if (triggered.length > 0 && this.rng.chance(0.75)) {
      selected = this.rng.pick(triggered);
    } else {
      let general = candidates.filter((f) => !f.triggers);
      if (general.length === 0) general = candidates;
      if (general.length === 0) {
        this.recentlyUsed = [];
        general = fragments.filter((f) =>
          f.mood === mood && !f.triggers && !(f.nightOnly && state.phase !== 'night'));
      }
      selected = general.length ? this.rng.pick(general) : undefined;
    }

    if (!selected) return '';
    this.recentlyUsed.push(selected.text);
    if (this.recentlyUsed.length > this.maxRecent) this.recentlyUsed.shift();
    return selected.text;
  }
}

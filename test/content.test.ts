// Integrity of the ported prose content. If these fail, the porter or the
// upstream source changed — the prose contract is "verbatim V1".

import { describe, expect, it } from 'vitest';
import {
  terrains, opportunities, pressures, signatures, rares
} from '../src/content/encounters';
import { fragments } from '../src/content/monologue';
import { intros, deaths } from '../src/content/narrative';
import { distanceBands, trackingTexts } from '../src/content/hunterFlavor';

const MOODS = ['confident', 'concerned', 'desperate', 'haunted'];
const CAUSES = ['caught', 'heatstroke', 'exhaustion', 'dehydration', 'starvation'];

describe('ported content integrity', () => {
  it('carries the full V1 corpus', () => {
    expect(terrains.length).toBe(32);
    expect(opportunities.length).toBe(61);
    expect(pressures.length).toBe(22);
    expect(signatures.length).toBe(50);
    expect(rares.length).toBe(10);
    expect(fragments.length).toBe(387);
    expect(intros.length).toBe(3);
  });

  it('has non-empty prose everywhere', () => {
    for (const list of [terrains, opportunities, pressures, signatures, rares]) {
      for (const e of list) {
        expect(e.id, 'id').toBeTruthy();
        expect(e.text.length, e.id).toBeGreaterThan(10);
      }
    }
    for (const f of fragments) expect(f.text.length).toBeGreaterThan(5);
    for (const t of trackingTexts) expect(t.length).toBeGreaterThan(10);
  });

  it('terrain compatibility lists resolve to real opportunities', () => {
    const oppIds = new Set(opportunities.flatMap((o) => o.baseId ? [o.id, o.baseId] : [o.id]));
    for (const t of terrains) {
      for (const c of t.compatible) {
        expect(oppIds.has(c), `${t.id} -> ${c}`).toBe(true);
      }
    }
  });

  it('every pressure condition is callable against a plausible state', () => {
    const state = {
      day: 3, phase: 'day' as const, heat: 50, stamina: 60, thirst: 40,
      hunger: 30, hunterDistance: 12, hunterState: 'pursuit' as const
    };
    const ctx = { usedOldTerritory: false };
    for (const p of pressures) {
      expect(typeof p.condition(state, ctx), p.id).toBe('boolean');
    }
  });

  it('moods and death causes match the fixed vocabularies', () => {
    for (const f of fragments) expect(MOODS, f.text.slice(0, 30)).toContain(f.mood);
    expect(Object.keys(deaths).sort()).toEqual([...CAUSES].sort());
    for (const cause of CAUSES) {
      expect(deaths[cause as keyof typeof deaths].length).toBeGreaterThanOrEqual(3);
    }
  });

  it('signature choices are well-formed', () => {
    for (const s of [...signatures, ...rares]) {
      expect(s.choices.length, s.id).toBeGreaterThan(0);
      for (const c of s.choices) {
        expect(c.key, s.id).toBeTruthy();
        // effects: null means "standard action" — anything else must be an object
        if (c.effects !== null) expect(typeof c.effects, `${s.id}/${c.key}`).toBe('object');
      }
    }
  });

  it('flavor bands cover all distances down to zero, in descending order', () => {
    expect(distanceBands[0]!.min).toBe(20);
    expect(distanceBands[distanceBands.length - 1]!.min).toBe(0);
    for (let i = 1; i < distanceBands.length; i++) {
      expect(distanceBands[i]!.min).toBeLessThan(distanceBands[i - 1]!.min);
    }
    for (const b of distanceBands) {
      expect(b.day.length).toBeGreaterThanOrEqual(6);
      expect(b.night.length).toBeGreaterThanOrEqual(6);
    }
  });
});

// Sim core correctness + a SMALL smoke batch (heat-budget: seconds, not
// minutes — the real balance batches live in test/balance and are run
// deliberately, never in the default test suite).

import { describe, expect, it } from 'vitest';
import { Game } from '../src/sim/game';
import { METERS_PER_MILE } from '../src/world/nav';

function randomPolicy(game: Game, maxPhases = 120): void {
  const S = game.state;
  for (let i = 0; i < maxPhases && S.isAlive; i++) {
    const r = game.rng.next();
    if (r < 0.55) {
      const reach = game.reach();
      // Prefer far nodes, like a fleeing player would.
      let best = null, bestScore = -1;
      for (const n of reach.values()) {
        const score = n.meters + game.rng.next() * 2000;
        if (score > bestScore) { bestScore = score; best = n; }
      }
      if (best) { game.commitMove(best, reach); continue; }
    }
    const actions = S.encounter?.actions ?? [];
    if (actions.length) {
      const a = actions[Math.floor(game.rng.next() * actions.length)]!;
      game.commitAction(a.key);
    }
  }
}

describe('sim core', () => {
  it('a new game opens alive with an encounter and a monologue', () => {
    const g = new Game(7);
    expect(g.state.isAlive).toBe(true);
    expect(g.state.encounter).not.toBeNull();
    expect(g.state.encounter!.text.length).toBeGreaterThan(20);
    expect(g.state.monologue.length).toBeGreaterThan(5);
    // Day 1 tutorial signature fires (V1 behavior).
    expect(g.state.encounter!.type).toBe('signature');
  });

  it('moving costs vitals, gains ground, and advances hunters', () => {
    const g = new Game(7);
    g.tutorial = false;
    g.newGame(7);
    const reach = g.reach();
    let far = null, m = -1;
    for (const n of reach.values()) if (n.meters > m) { m = n.meters; far = n; }
    const before = { ...g.state, hunters: { ...g.state.hunters } };
    const preview = g.previewMove(far!, reach);
    expect(preview.effortMiles).toBeGreaterThan(3);
    expect(preview.effortMiles).toBeLessThanOrEqual(6.51);
    const res = g.commitMove(far!, reach);
    expect(res.realMiles).toBeGreaterThan(1);
    expect(g.state.distanceCovered).toBeGreaterThan(0);
    expect(g.state.heat).toBeGreaterThan(before.heat);
    expect(g.state.phase).toBe('night');
    // Push by day: hunters advanced their speed, distance changed by real - adv.
    expect(res.hunterAdvance).toBeGreaterThan(0);
  });

  it('the game is unwinnable: random-ish play always ends in death', () => {
    const causes = new Map<string, number>();
    let totalDays = 0;
    const RUNS = 12; // smoke only — heat budget
    for (let seed = 1; seed <= RUNS; seed++) {
      const g = new Game(seed * 13);
      g.tutorial = false;
      g.newGame(seed * 13);
      randomPolicy(g);
      expect(g.state.isAlive).toBe(false);
      expect(g.state.deathCause).not.toBeNull();
      causes.set(g.state.deathCause!, (causes.get(g.state.deathCause!) ?? 0) + 1);
      totalDays += g.state.day;
    }
    const avgDays = totalDays / RUNS;
    // Random play should die within a plausible band (tuning happens later).
    expect(avgDays).toBeGreaterThan(1.5);
    expect(avgDays).toBeLessThan(30);
    expect(causes.size).toBeGreaterThanOrEqual(1);
  });

  it('hunter position walks the trail and stays behind the player', () => {
    const g = new Game(11);
    g.tutorial = false;
    g.newGame(11);
    for (let i = 0; i < 6 && g.state.isAlive; i++) {
      const reach = g.reach();
      let far = null, m = -1;
      for (const n of reach.values()) if (n.meters > m) { m = n.meters; far = n; }
      if (far) g.commitMove(far, reach);
    }
    const hp = g.hunterPosition();
    const sep = Math.hypot(g.state.x - hp.x, g.state.z - hp.z) / METERS_PER_MILE;
    // Straight-line separation can be shorter than trail distance but not
    // wildly longer.
    expect(sep).toBeLessThanOrEqual(g.state.hunters.distance + 1);
    expect(sep).toBeGreaterThan(0);
  });

  it('is deterministic per seed', () => {
    const run = (seed: number) => {
      const g = new Game(seed);
      g.tutorial = false;
      g.newGame(seed);
      randomPolicy(g, 40);
      return `${g.state.day}|${g.state.phase}|${g.state.deathCause}|${g.state.distanceCovered.toFixed(2)}`;
    };
    expect(run(99)).toBe(run(99));
  });
});

describe('landmarks', () => {
  it('forces a signature encounter on arrival at an unvisited landmark', async () => {
    const { nearestLandmark } = await import('../src/world/landmarks');
    const g = new Game(21);
    g.tutorial = false;
    g.newGame(21);
    // March toward the nearest landmark until we stand on it.
    for (let i = 0; i < 40 && g.state.isAlive; i++) {
      const lm = nearestLandmark(21, g.state.x, g.state.z, 60000)!;
      if (Math.hypot(lm.x - g.state.x, lm.z - g.state.z) < 650) break;
      const reach = g.reach();
      let best = null, bestD = Infinity;
      for (const n of reach.values()) {
        const d = Math.hypot(n.x - lm.x, n.z - lm.z);
        if (d < bestD) { bestD = d; best = n; }
      }
      if (!best) break;
      g.commitMove(best, reach);
      if (g.state.stats.landmarksVisited > 0) break;
    }
    expect(g.state.stats.landmarksVisited).toBeGreaterThan(0);
    // The forced encounter is a signature (unless the deck ran out, which
    // cannot happen this early in a run).
    expect(g.state.encounter?.type).toBe('signature');
  });
});

import { describe, expect, it } from 'vitest';
import { Biomes } from '../src/world/biomes';
import { Nav, METERS_PER_MILE, nodeKey } from '../src/world/nav';

describe('navigation lattice', () => {
  const biomes = new Biomes(7);
  const nav = new Nav(biomes);

  it('never reaches into deep water and keeps costs monotonic along paths', () => {
    const reach = nav.reach(0, 0, 6.5);
    expect(reach.size).toBeGreaterThan(300);
    let deepest = 0;
    for (const n of reach.values()) {
      deepest = Math.max(deepest, n.sample.waterDepth);
      if (n.parent !== '') {
        const p = reach.get(n.parent)!;
        expect(p.cost).toBeLessThan(n.cost);
        // Parent is lattice-adjacent.
        expect(Math.max(Math.abs(p.ix - n.ix), Math.abs(p.iz - n.iz))).toBe(1);
      }
    }
    expect(deepest).toBeLessThanOrEqual(1.4);
  });

  it('covers a sane radius on open ground', () => {
    // Find a reasonably open origin: scan for an open_plain node away from belts.
    let ox = 0, oz = 0;
    outer: for (let x = -30000; x < 30000; x += 2500) {
      for (let z = -30000; z < 30000; z += 2500) {
        const s = biomes.sample(x, z);
        if (s.terrainId === 'open_plain' && s.belt < 0.05 && s.river < 0.05) {
          ox = x; oz = z; break outer;
        }
      }
    }
    const reach = nav.reach(ox, oz, 3.5);
    let maxDist = 0;
    for (const n of reach.values()) {
      maxDist = Math.max(maxDist, Math.hypot(n.x - ox, n.z - oz));
    }
    // 3.5 effective miles: on open plain (move 1.0) the crow-flies radius
    // should be near the budget but never exceed it.
    expect(maxDist).toBeLessThanOrEqual(3.5 * METERS_PER_MILE * 1.01);
    expect(maxDist).toBeGreaterThan(3.5 * METERS_PER_MILE * 0.5);
  });

  it('reconstructs contiguous paths from origin to fringe', () => {
    const reach = nav.reach(0, 0, 4);
    let fringe: string | null = null;
    let best = -1;
    for (const [k, n] of reach) {
      if (n.cost > best) { best = n.cost; fringe = k; }
    }
    const path = nav.path(reach, fringe!);
    expect(path.length).toBeGreaterThan(3);
    expect(path[0]!.cost).toBe(0);
    for (let i = 1; i < path.length; i++) {
      expect(Math.max(
        Math.abs(path[i]!.ix - path[i - 1]!.ix),
        Math.abs(path[i]!.iz - path[i - 1]!.iz)
      )).toBe(1);
    }
  });

  it('snap avoids impassable nodes when possible', () => {
    // Find deep water, then snap next to it.
    for (let x = -40000; x < 40000; x += 1500) {
      for (let z = -40000; z < 40000; z += 1500) {
        if (biomes.sample(x, z).waterDepth > 1.4) {
          const s = nav.snap(x, z);
          const snapped = biomes.sample(s.ix * 220, s.iz * 220);
          expect(snapped.waterDepth).toBeLessThanOrEqual(1.4);
          return;
        }
      }
    }
    throw new Error('no deep water found in scan — world too dry?');
  });
});

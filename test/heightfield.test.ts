import { describe, expect, it } from 'vitest';
import { Heightfield } from '../src/world/heightfield';

describe('heightfield', () => {
  it('is deterministic for a given seed', () => {
    const a = new Heightfield(42);
    const b = new Heightfield(42);
    for (let i = 0; i < 50; i++) {
      const x = (i * 971 - 20000) * 3.7, z = (i * 641 - 15000) * 2.3;
      expect(a.sample(x, z)).toEqual(b.sample(x, z));
    }
  });

  it('differs across seeds', () => {
    const a = new Heightfield(1), b = new Heightfield(2);
    let differ = 0;
    for (let i = 0; i < 20; i++) {
      if (a.height(i * 500, i * 300) !== b.height(i * 500, i * 300)) differ++;
    }
    expect(differ).toBeGreaterThan(15);
  });

  it('produces sane heights and consistent water over a broad sweep', () => {
    const f = new Heightfield(7);
    let minH = Infinity, maxH = -Infinity, wet = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) {
      // Deterministic pseudo-random sweep over ~80km.
      const x = ((i * 2654435761) % 80000) - 40000;
      const z = ((i * 1597334677) % 80000) - 40000;
      const s = f.sample(x, z);
      expect(Number.isFinite(s.height)).toBe(true);
      minH = Math.min(minH, s.height); maxH = Math.max(maxH, s.height);
      if (s.waterDepth > 0) {
        wet++;
        expect(s.waterSurface).toBeGreaterThan(s.height);
        expect(s.waterDepth).toBeCloseTo(s.waterSurface - s.height, 6);
      } else {
        expect(s.waterSurface).toBe(s.height);
      }
    }
    // Plains sit near the datum; crests are real mountains; some water exists.
    expect(minH).toBeGreaterThan(-120);
    expect(maxH).toBeGreaterThan(300);
    expect(maxH).toBeLessThan(1200);
    expect(wet / n).toBeGreaterThan(0.01);
    expect(wet / n).toBeLessThan(0.2);
  });
});

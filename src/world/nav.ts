// Movement over the land. An invisible 8-connected lattice (~220 m spacing)
// is sampled on demand from the biome field; Dijkstra from the player's
// position yields the reach contour for a phase's movement budget.
//
// Cost model (effective meters — V1's "effort miles" made spatial):
//   step meters × terrain.move × slope factor × wading factor
// Cliffs (slope > MAX_SLOPE) and deep water are impassable, which is how
// mountains wall you and rivers ford only where they run shallow.

import { Biomes, type WorldSample } from './biomes';

export const GRID = 220; // meters between lattice nodes
export const METERS_PER_MILE = 1609.34;

/** Slope beyond which ground cannot be walked (rise/run ~ 40 degrees). */
const MAX_SLOPE = 0.85;
/** Water deeper than this cannot be crossed on foot. */
const MAX_WADE_DEPTH = 1.4;
const WADE_FACTOR = 2.4;

export interface NavNode {
  ix: number;
  iz: number;
  x: number;
  z: number;
  /** Effective (effort) meters from the origin — what budgets spend. */
  cost: number;
  /** Real ground meters from the origin — what separation is measured in. */
  meters: number;
  /** Straight-line path predecessor key, '' at origin. */
  parent: string;
  sample: WorldSample;
}

export function nodeKey(ix: number, iz: number): string {
  return ix + ',' + iz;
}

export class Nav {
  private cache = new Map<string, { sample: WorldSample; factor: number }>();

  constructor(readonly biomes: Biomes) {}

  /** Cost factor at a lattice node; Infinity = impassable. */
  private nodeInfo(ix: number, iz: number): { sample: WorldSample; factor: number } {
    const key = nodeKey(ix, iz);
    const hit = this.cache.get(key);
    if (hit) return hit;

    const x = ix * GRID, z = iz * GRID;
    const sample = this.biomes.sample(x, z);

    let factor: number;
    if (sample.waterDepth > MAX_WADE_DEPTH) {
      factor = Infinity;
    } else {
      // Central-difference slope over one grid step.
      const e = GRID * 0.5;
      const hx = (this.biomes.field.height(x + e, z) - this.biomes.field.height(x - e, z)) / (2 * e);
      const hz = (this.biomes.field.height(x, z + e) - this.biomes.field.height(x, z - e)) / (2 * e);
      const slope = Math.hypot(hx, hz);
      if (slope > MAX_SLOPE) {
        factor = Infinity;
      } else {
        const slopeFactor = 1 + 5.5 * slope * slope;
        const wade = sample.waterDepth > 0 ? WADE_FACTOR : 1;
        factor = sample.terrain.move * slopeFactor * wade;
      }
    }

    const info = { sample, factor };
    this.cache.set(key, info);
    if (this.cache.size > 60000) this.cache.clear();
    return info;
  }

  /** Snap a world position to the nearest passable lattice node. */
  snap(x: number, z: number): { ix: number; iz: number } {
    const ix0 = Math.round(x / GRID), iz0 = Math.round(z / GRID);
    for (let r = 0; r <= 4; r++) {
      for (let dix = -r; dix <= r; dix++) {
        for (let diz = -r; diz <= r; diz++) {
          if (Math.max(Math.abs(dix), Math.abs(diz)) !== r) continue;
          if (Number.isFinite(this.nodeInfo(ix0 + dix, iz0 + diz).factor)) {
            return { ix: ix0 + dix, iz: iz0 + diz };
          }
        }
      }
    }
    return { ix: ix0, iz: iz0 };
  }

  /**
   * Dijkstra out to `maxMiles` of effective effort.
   * @returns nodes keyed by nodeKey, each with cost and parent for paths.
   */
  reach(originX: number, originZ: number, maxMiles: number): Map<string, NavNode> {
    const maxCost = maxMiles * METERS_PER_MILE;
    const start = this.snap(originX, originZ);

    const out = new Map<string, NavNode>();
    const heap: { key: string; cost: number }[] = [];
    const push = (key: string, cost: number) => {
      heap.push({ key, cost });
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p]!.cost <= heap[i]!.cost) break;
        [heap[p], heap[i]] = [heap[i]!, heap[p]!];
        i = p;
      }
    };
    const pop = (): { key: string; cost: number } | undefined => {
      if (heap.length === 0) return undefined;
      const top = heap[0]!;
      const last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1, r = l + 1;
          let m = i;
          if (l < heap.length && heap[l]!.cost < heap[m]!.cost) m = l;
          if (r < heap.length && heap[r]!.cost < heap[m]!.cost) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i]!, heap[m]!];
          i = m;
        }
      }
      return top;
    };

    const startKey = nodeKey(start.ix, start.iz);
    const startInfo = this.nodeInfo(start.ix, start.iz);
    out.set(startKey, {
      ix: start.ix, iz: start.iz, x: start.ix * GRID, z: start.iz * GRID,
      cost: 0, meters: 0, parent: '', sample: startInfo.sample
    });
    push(startKey, 0);

    while (true) {
      const cur = pop();
      if (!cur) break;
      const node = out.get(cur.key)!;
      if (cur.cost > node.cost) continue; // stale heap entry

      for (let dix = -1; dix <= 1; dix++) {
        for (let diz = -1; diz <= 1; diz++) {
          if (dix === 0 && diz === 0) continue;
          const nix = node.ix + dix, niz = node.iz + diz;
          const nKey = nodeKey(nix, niz);
          const info = this.nodeInfo(nix, niz);
          if (!Number.isFinite(info.factor)) continue;

          const stepMeters = GRID * (dix !== 0 && diz !== 0 ? Math.SQRT2 : 1);
          const hereFactor = this.nodeInfo(node.ix, node.iz).factor;
          const cost = node.cost + stepMeters * (hereFactor + info.factor) * 0.5;
          if (cost > maxCost) continue;

          const existing = out.get(nKey);
          if (existing && existing.cost <= cost) continue;
          out.set(nKey, {
            ix: nix, iz: niz, x: nix * GRID, z: niz * GRID,
            cost, meters: node.meters + stepMeters, parent: cur.key, sample: info.sample
          });
          push(nKey, cost);
        }
      }
    }
    return out;
  }

  /** Reconstruct the path to a node inside a reach result (origin first). */
  path(reach: Map<string, NavNode>, targetKey: string): NavNode[] {
    const out: NavNode[] = [];
    let key = targetKey;
    while (key !== '') {
      const n = reach.get(key);
      if (!n) return [];
      out.push(n);
      key = n.parent;
    }
    return out.reverse();
  }
}

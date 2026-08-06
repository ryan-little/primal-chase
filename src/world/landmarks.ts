// Landmarks: rare, deterministic, visible-from-afar sites. Walking to one is
// how signature encounters become CHOICES on the map instead of dice rolls —
// the strange silhouette on the horizon is Opus's best replayability idea,
// given legs by fog of war (you can only chase what you have seen).

import { hash2 } from './rng';

export type LandmarkKind = 'monolith' | 'great_baobab' | 'arch' | 'cairn';

export interface Landmark {
  id: string;
  kind: LandmarkKind;
  x: number;
  z: number;
}

const CELL = 6200;          // meters between landmark cells
const CHANCE = 0.42;        // fraction of cells that host one

const KINDS: LandmarkKind[] = ['monolith', 'great_baobab', 'arch', 'cairn'];

/** The landmark of a given cell, or null. Deterministic per seed. */
export function landmarkOfCell(seed: number, ci: number, cj: number): Landmark | null {
  const roll = hash2(seed ^ 0x4c414e44, ci, cj);
  if (roll > CHANCE) return null;
  const jx = (hash2(seed ^ 0x4c58, ci, cj) - 0.5) * CELL * 0.55;
  const jz = (hash2(seed ^ 0x4c5a, ci, cj) - 0.5) * CELL * 0.55;
  const kind = KINDS[Math.floor(hash2(seed ^ 0x4c4b, ci, cj) * KINDS.length)]!;
  return {
    id: `${ci},${cj}`,
    kind,
    x: (ci + 0.5) * CELL + jx,
    z: (cj + 0.5) * CELL + jz
  };
}

/** All landmarks whose centers fall inside a world-space rectangle. */
export function landmarksIn(seed: number, x0: number, z0: number, x1: number, z1: number): Landmark[] {
  const out: Landmark[] = [];
  for (let cj = Math.floor(z0 / CELL) - 1; cj <= Math.floor(z1 / CELL) + 1; cj++) {
    for (let ci = Math.floor(x0 / CELL) - 1; ci <= Math.floor(x1 / CELL) + 1; ci++) {
      const l = landmarkOfCell(seed, ci, cj);
      if (l && l.x >= x0 && l.x < x1 && l.z >= z0 && l.z < z1) out.push(l);
    }
  }
  return out;
}

/** Nearest landmark within `radius` meters of a point, or null. */
export function nearestLandmark(seed: number, x: number, z: number, radius: number): Landmark | null {
  let best: Landmark | null = null;
  let bestD = radius;
  const r = Math.ceil(radius / CELL) + 1;
  const ci0 = Math.floor(x / CELL), cj0 = Math.floor(z / CELL);
  for (let cj = cj0 - r; cj <= cj0 + r; cj++) {
    for (let ci = ci0 - r; ci <= ci0 + r; ci++) {
      const l = landmarkOfCell(seed, ci, cj);
      if (!l) continue;
      const d = Math.hypot(l.x - x, l.z - z);
      if (d < bestD) { bestD = d; best = l; }
    }
  }
  return best;
}

// ============================================================
// HEX.JS — flat-top axial hex grid math
// Flat-top orientation gives the player a true North and South
// neighbour, which matters because the whole game is a flight
// away from something behind you.
// ============================================================

export const SQRT3 = Math.sqrt(3);

/** World-space radius of one hex (centre to corner). Tuned against MILES_PER_HEX. */
export const HEX_SIZE = 6;

/** Flat-top axial neighbour offsets, clockwise starting North. */
export const DIRECTIONS = [
  { q: 0,  r: -1 },  // N
  { q: 1,  r: -1 },  // NE
  { q: 1,  r: 0  },  // SE
  { q: 0,  r: 1  },  // S
  { q: -1, r: 1  },  // SW
  { q: -1, r: 0  }   // NW
];

export const DIRECTION_NAMES = ['north', 'northeast', 'southeast', 'south', 'southwest', 'northwest'];

/** Stable string key for a hex coordinate. */
export function key(q, r) {
  return q + ',' + r;
}

export function parseKey(k) {
  const i = k.indexOf(',');
  return { q: +k.slice(0, i), r: +k.slice(i + 1) };
}

/** Axial -> world XZ (y is up, the game is played on the XZ plane). */
export function axialToWorld(q, r, size = HEX_SIZE) {
  return {
    x: size * 1.5 * q,
    z: size * SQRT3 * (r + q / 2)
  };
}

/** World XZ -> fractional axial. */
export function worldToAxialFrac(x, z, size = HEX_SIZE) {
  const q = (2 / 3) * x / size;
  const r = z / (size * SQRT3) - q / 2;
  return { q, r };
}

/** Round fractional axial coordinates to the nearest hex (via cube rounding). */
export function axialRound(qf, rf) {
  let x = qf;
  let z = rf;
  let y = -x - z;

  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);

  const dx = Math.abs(rx - x);
  const dy = Math.abs(ry - y);
  const dz = Math.abs(rz - z);

  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;

  return { q: rx, r: rz };
}

export function worldToAxial(x, z, size = HEX_SIZE) {
  const f = worldToAxialFrac(x, z, size);
  return axialRound(f.q, f.r);
}

/** Grid distance in hex steps. */
export function distance(aq, ar, bq, br) {
  const dq = aq - bq;
  const dr = ar - br;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

export function neighbors(q, r) {
  const out = [];
  for (let i = 0; i < 6; i++) {
    out.push({ q: q + DIRECTIONS[i].q, r: r + DIRECTIONS[i].r });
  }
  return out;
}

export function neighbor(q, r, dir) {
  const d = DIRECTIONS[((dir % 6) + 6) % 6];
  return { q: q + d.q, r: r + d.r };
}

/** All hexes exactly `radius` steps from centre. */
export function ring(cq, cr, radius) {
  if (radius <= 0) return [{ q: cq, r: cr }];
  const results = [];
  // Start at the hex `radius` steps in direction SW, then walk the six sides.
  let q = cq + DIRECTIONS[4].q * radius;
  let r = cr + DIRECTIONS[4].r * radius;
  for (let side = 0; side < 6; side++) {
    for (let step = 0; step < radius; step++) {
      results.push({ q, r });
      q += DIRECTIONS[side].q;
      r += DIRECTIONS[side].r;
    }
  }
  return results;
}

/** All hexes within `radius` steps of centre, centre first, ordered by distance. */
export function spiral(cq, cr, radius) {
  const results = [{ q: cq, r: cr }];
  for (let k = 1; k <= radius; k++) {
    const r = ring(cq, cr, k);
    for (let i = 0; i < r.length; i++) results.push(r[i]);
  }
  return results;
}

function lerp(a, b, t) { return a + (b - a) * t; }

/** Hexes along the straight line between two coordinates, inclusive. */
export function line(aq, ar, bq, br) {
  const n = distance(aq, ar, bq, br);
  if (n === 0) return [{ q: aq, r: ar }];
  const out = [];
  // Nudge off the exact edge midpoints so rounding is deterministic.
  const eps = 1e-6;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push(axialRound(lerp(aq + eps, bq + eps, t), lerp(ar + eps, br + eps, t)));
  }
  return out;
}

/** Continuous world-space direction (radians about Y) from one hex to another. */
export function bearing(aq, ar, bq, br, size = HEX_SIZE) {
  const a = axialToWorld(aq, ar, size);
  const b = axialToWorld(bq, br, size);
  return Math.atan2(b.x - a.x, b.z - a.z);
}

// ------------------------------------------------------------
// Pathfinding
// ------------------------------------------------------------

/**
 * A* over the hex grid.
 * @param {{q:number,r:number}} start
 * @param {{q:number,r:number}} goal
 * @param {(q:number,r:number)=>number} costFn - traversal cost of entering a hex;
 *        return Infinity for impassable.
 * @param {number} maxNodes - safety bound
 * @returns {Array<{q:number,r:number}>|null} path including start and goal
 */
export function findPath(start, goal, costFn, maxNodes = 4000) {
  const startKey = key(start.q, start.r);
  const goalKey = key(goal.q, goal.r);
  if (startKey === goalKey) return [{ q: start.q, r: start.r }];

  const open = [{ k: startKey, q: start.q, r: start.r, f: 0 }];
  const cameFrom = new Map();
  const gScore = new Map([[startKey, 0]]);
  let visited = 0;

  while (open.length > 0) {
    // Small frontiers — a linear scan beats the overhead of a real heap here.
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bestIdx].f) bestIdx = i;
    const current = open.splice(bestIdx, 1)[0];

    if (current.k === goalKey) {
      const path = [{ q: current.q, r: current.r }];
      let k = current.k;
      while (cameFrom.has(k)) {
        k = cameFrom.get(k);
        path.push(parseKey(k));
      }
      return path.reverse();
    }

    if (++visited > maxNodes) break;

    const ns = neighbors(current.q, current.r);
    for (let i = 0; i < 6; i++) {
      const n = ns[i];
      const stepCost = costFn(n.q, n.r);
      if (!isFinite(stepCost)) continue;
      const nk = key(n.q, n.r);
      const tentative = gScore.get(current.k) + stepCost;
      if (gScore.has(nk) && tentative >= gScore.get(nk)) continue;
      cameFrom.set(nk, current.k);
      gScore.set(nk, tentative);
      const h = distance(n.q, n.r, goal.q, goal.r);
      const existing = open.find(o => o.k === nk);
      if (existing) existing.f = tentative + h;
      else open.push({ k: nk, q: n.q, r: n.r, f: tentative + h });
    }
  }
  return null;
}

/**
 * Every hex reachable within `steps` moves, with the cheapest path to each.
 * Used to highlight the move range and to route the jaguar.
 * @returns {Map<string, {q,r,steps,cost,from:string|null}>}
 */
export function reachable(start, steps, costFn) {
  const startKey = key(start.q, start.r);
  const result = new Map([[startKey, { q: start.q, r: start.r, steps: 0, cost: 0, from: null }]]);
  let frontier = [{ q: start.q, r: start.r, k: startKey }];

  for (let depth = 1; depth <= steps; depth++) {
    const next = [];
    for (const cur of frontier) {
      const curEntry = result.get(cur.k);
      const ns = neighbors(cur.q, cur.r);
      for (let i = 0; i < 6; i++) {
        const n = ns[i];
        const stepCost = costFn(n.q, n.r);
        if (!isFinite(stepCost)) continue;
        const nk = key(n.q, n.r);
        const cost = curEntry.cost + stepCost;
        const prev = result.get(nk);
        if (prev && (prev.steps < depth || prev.cost <= cost)) continue;
        result.set(nk, { q: n.q, r: n.r, steps: depth, cost, from: cur.k });
        next.push({ q: n.q, r: n.r, k: nk });
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return result;
}

/** Walk a `reachable` map backwards to build the path to a destination. */
export function pathFromReachable(map, destKey) {
  const path = [];
  let k = destKey;
  while (k) {
    const entry = map.get(k);
    if (!entry) return null;
    path.push({ q: entry.q, r: entry.r });
    k = entry.from;
  }
  return path.reverse();
}

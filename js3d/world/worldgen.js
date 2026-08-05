// ============================================================
// WORLDGEN.JS — deterministic infinite savannah
// Layered value noise picks a region, the region picks a terrain,
// a ridged river field carves watercourses through everything.
// Every hex is a pure function of (seed, q, r), so the world can be
// recomputed at any time and never has to be stored.
// ============================================================

import * as Hex from './hex.js';

const CFG = () => window.CONFIG3D;

// ------------------------------------------------------------
// Noise
// ------------------------------------------------------------

/** Deterministic 32-bit hash of two integers plus a salt. */
function hash2(x, y, salt) {
  let h = x * 374761393 + y * 668265263 + salt * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

function smooth(t) { return t * t * (3 - 2 * t); }

/** 2D value noise in [-1, 1]. */
function valueNoise(x, y, salt) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = smooth(xf), v = smooth(yf);
  const a = hash2(xi, yi, salt);
  const b = hash2(xi + 1, yi, salt);
  const c = hash2(xi, yi + 1, salt);
  const d = hash2(xi + 1, yi + 1, salt);
  const top = a + (b - a) * u;
  const bot = c + (d - c) * u;
  return (top + (bot - top) * v) * 2 - 1;
}

/** Fractal Brownian motion — several octaves of value noise. */
function fbm(x, y, salt, octaves = 4, lacunarity = 2.03, gain = 0.5) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, y * freq, salt + i * 7919) * amp;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/**
 * Work counters, for proving a worldgen change actually cut the cost.
 * Free when nobody reads them; reset via World.resetStats().
 */
const STATS = { getCalls: 0, cacheMisses: 0, landmarkChecks: 0, neighbourHashes: 0 };

/** Pick from a [[id, weight], ...] pool using a 0..1 roll. */
function weightedPick(pool, roll) {
  let total = 0;
  for (let i = 0; i < pool.length; i++) total += pool[i][1];
  let t = roll * total;
  for (let i = 0; i < pool.length; i++) {
    t -= pool[i][1];
    if (t <= 0) return pool[i][0];
  }
  return pool[pool.length - 1][0];
}

// ------------------------------------------------------------
// World
// ------------------------------------------------------------

export class World {
  constructor(seed = Math.floor(Math.random() * 1e9)) {
    this.seed = seed >>> 0;
    this.cache = new Map();
    /** key -> scent strength left by the player, decays each turn. */
    this.trail = new Map();
    /** Landmark ids already consumed so the same signature never repeats. */
    this.usedLandmarks = new Set();
  }

  _salt(n) { return (this.seed + n * 104729) >>> 0; }

  /** Raw noise fields for a hex, in noise-space (uses world XZ so regions are round). */
  _fields(q, r) {
    const w = Hex.axialToWorld(q, r);
    const W = CFG().world;
    return {
      region: fbm(w.x * W.regionScale, w.z * W.regionScale, this._salt(1), 3),
      region2: fbm(w.x * W.regionScale * 1.37 + 91.3, w.z * W.regionScale * 1.37 - 47.1, this._salt(2), 3),
      elevation: fbm(w.x * W.elevationScale, w.z * W.elevationScale, this._salt(3), 5),
      moisture: fbm(w.x * W.moistureScale + 13.7, w.z * W.moistureScale - 22.4, this._salt(4), 4),
      river: fbm(w.x * W.riverScale - 55.2, w.z * W.riverScale + 31.8, this._salt(5), 3),
      detail: hash2(q, r, this._salt(6)),
      detail2: hash2(q, r, this._salt(7)),
      wx: w.x, wz: w.z
    };
  }

  /** Which region a hex belongs to. Two noise fields give six believable zones. */
  _regionFor(f) {
    const regions = CFG().regions;
    // Map the two low-frequency fields onto a 2x3 grid of regions with soft edges.
    const a = f.region, b = f.region2;
    let idx;
    if (a < -0.22) idx = b < 0 ? 1 : 4;          // riverlands / woodland (wet side)
    else if (a > 0.26) idx = b < -0.1 ? 3 : 5;   // highlands / scorched (harsh side)
    else idx = b < -0.28 ? 4 : (b > 0.32 ? 3 : 0); // woodland / highlands / plains
    return regions[Math.max(0, Math.min(regions.length - 1, idx))];
  }

  /**
   * Landmark test: a hex hosts one if its score beats every hex within spacing.
   *
   * The early-out matters far more than it looks. A hex only survives the scan
   * if it is the maximum of ~61 uniform scores, and the maximum of 61 uniforms
   * is below 0.9 only about 0.2% of the time — so gating on a high score costs
   * a negligible number of landmarks and skips the scan for ~90% of hexes.
   * The scan itself iterates rings directly rather than materialising a
   * 61-element array of coordinate objects for every hex in the world.
   */
  _isLandmark(q, r) {
    const W = CFG().world;
    const salt = this._salt(11);
    const score = hash2(q, r, salt);
    STATS.landmarkChecks++;
    if (score < W.landmarkScoreFloor) return false;

    for (let radius = 1; radius <= W.landmarkSpacing; radius++) {
      // Walk the ring in place: start `radius` steps along direction 4, then
      // trace the six sides. Same order as Hex.ring, without the allocation.
      let nq = q + Hex.DIRECTIONS[4].q * radius;
      let nr = r + Hex.DIRECTIONS[4].r * radius;
      for (let side = 0; side < 6; side++) {
        const d = Hex.DIRECTIONS[side];
        for (let step = 0; step < radius; step++) {
          STATS.neighbourHashes++;
          if (hash2(nq, nr, salt) > score) return false;
          nq += d.q;
          nr += d.r;
        }
      }
    }
    return true;
  }

  /**
   * Full data for one hex. Cached; pure in (seed, q, r).
   * @returns {{q,r,key,terrain,cat,height,worldX,worldZ,region,landmark,props}}
   */
  get(q, r) {
    STATS.getCalls++;
    const k = Hex.key(q, r);
    const hit = this.cache.get(k);
    if (hit) return hit;
    STATS.cacheMisses++;

    const C = CFG();
    const f = this._fields(q, r);
    const region = this._regionFor(f);

    let terrainId;
    const riverStrength = Math.abs(f.river);
    const isWatercourse = riverStrength < C.world.riverThreshold;

    if (isWatercourse) {
      // Wet or dry depends on local moisture — the same channel can run and die.
      const wet = f.moisture > 0.08;
      const pool = wet ? C.riverTerrains.wet : C.riverTerrains.dry;
      terrainId = pool[Math.floor(f.detail * pool.length) % pool.length];
      // Standing water is rare: only the deepest part of a wet channel.
      if (terrainId === 'watering_hole' && (riverStrength > C.world.riverThreshold * 0.45 || f.moisture < 0.2)) {
        terrainId = 'seasonal_stream';
      }
    } else {
      // Moisture and elevation bias the roll inside the region's pool.
      const bias = (f.moisture * 0.22) + (f.elevation * 0.18);
      terrainId = weightedPick(region.pool, Math.min(0.9999, Math.max(0, f.detail * 0.82 + (bias + 1) * 0.09)));
    }

    const props = C.terrainOf(terrainId);
    const height = (f.elevation * 0.8 + region.heightBias + props.height) * C.world.heightScale;

    const cell = {
      q, r, key: k,
      terrain: terrainId,
      cat: props.cat,
      props,
      height,
      elevation: f.elevation,
      moisture: f.moisture,
      worldX: f.wx,
      worldZ: f.wz,
      region: region.id,
      regionName: region.name,
      water: !!props.water,
      landmark: this._isLandmark(q, r),
      variant: f.detail2
    };

    this.cache.set(k, cell);
    // Keep the cache from growing without bound on very long runs.
    if (this.cache.size > 12000) {
      const drop = this.cache.keys();
      for (let i = 0; i < 3000; i++) {
        const dk = drop.next().value;
        if (dk !== k) this.cache.delete(dk);
      }
    }
    return cell;
  }

  /** Cost in movement points of entering a hex, including the climb. */
  moveCost(fromCell, q, r) {
    const cell = this.get(q, r);
    let cost = cell.props.move;
    if (fromCell) {
      const climb = (cell.height - fromCell.height) / CFG().world.heightScale;
      if (climb > 0) cost += climb * 0.5;
    }
    return cost;
  }

  /** Cost function bound to a starting cell, for Hex.reachable / Hex.findPath. */
  costFn(fromCell) {
    return (q, r) => this.moveCost(fromCell, q, r);
  }

  // ---- scent trail -------------------------------------------------

  /** Lay scent on a hex the player passed through. */
  markTrail(q, r, strength = 1) {
    const cell = this.get(q, r);
    const k = cell.key;
    const value = strength * cell.props.scent;
    this.trail.set(k, Math.max(this.trail.get(k) || 0, value));
  }

  /** Age every scent mark. Returns nothing; weak marks are dropped. */
  decayTrail(amount) {
    for (const [k, v] of this.trail) {
      const next = v - amount;
      if (next <= 0.02) this.trail.delete(k);
      else this.trail.set(k, next);
    }
  }

  scentAt(q, r) {
    return this.trail.get(Hex.key(q, r)) || 0;
  }

  clearTrail() { this.trail.clear(); }
}

World.stats = () => ({ ...STATS });
World.resetStats = () => { for (const k of Object.keys(STATS)) STATS[k] = 0; };

export { fbm, valueNoise, hash2, STATS };

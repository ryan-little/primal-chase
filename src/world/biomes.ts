// Classifies every point of the heightfield into a biome and a V1 terrain id,
// so the land you SEE is the land the prose DESCRIBES. All 32 V1 terrain ids
// are reachable, each bound to the physical situation it was written about:
// reed beds hug water, ridge lines run the crests, salt flats sit in the
// waterless country.
//
// Per-terrain movement multipliers descend from the Opus spatial balance
// (CONFIG3D.terrain[].move) and feed the navigation lattice.

import { Heightfield, type TerrainSample } from './heightfield';
import { clamp01, fbm, smoothstep } from './noise';
import { hash2 } from './rng';

export type BiomeId =
  | 'riverine' | 'wetland' | 'grassland' | 'thornlands' | 'dryflats'
  | 'burned' | 'foothills' | 'highstone' | 'water';

export interface TerrainClass {
  id: string;
  /** Movement cost multiplier (1 = open plain). */
  move: number;
  /** How well the ground holds a print (V1 scent model; high betrays you). */
  scent: number;
  /** How much the hunters are slowed here (>1 slows them more than you). */
  hunter: number;
}

/** Movement/scent/hunter numbers per V1 terrain id (from the Opus balance). */
export const TERRAIN_CLASSES: Record<string, TerrainClass> = {
  watering_hole:     { id: 'watering_hole',     move: 1.15, scent: 0.30, hunter: 1.0 },
  seasonal_stream:   { id: 'seasonal_stream',   move: 1.15, scent: 0.25, hunter: 0.95 },
  reed_bed:          { id: 'reed_bed',          move: 1.45, scent: 0.40, hunter: 1.25 },
  dried_marsh:       { id: 'dried_marsh',       move: 1.25, scent: 0.95, hunter: 1.1 },
  dry_riverbed:      { id: 'dry_riverbed',      move: 1.0,  scent: 1.20, hunter: 0.9 },
  sandy_wash:        { id: 'sandy_wash',        move: 1.3,  scent: 1.50, hunter: 1.05 },
  open_plain:        { id: 'open_plain',        move: 1.0,  scent: 1.0,  hunter: 0.85 },
  tall_grass:        { id: 'tall_grass',        move: 1.15, scent: 0.75, hunter: 1.1 },
  salt_flat:         { id: 'salt_flat',         move: 0.9,  scent: 1.4,  hunter: 0.75 },
  red_dunes:         { id: 'red_dunes',         move: 1.5,  scent: 1.3,  hunter: 1.2 },
  clay_pan:          { id: 'clay_pan',          move: 0.95, scent: 1.5,  hunter: 0.8 },
  dry_lake_bed:      { id: 'dry_lake_bed',      move: 0.95, scent: 1.35, hunter: 0.8 },
  burned_ground:     { id: 'burned_ground',     move: 1.05, scent: 0.6,  hunter: 0.9 },
  ash_field:         { id: 'ash_field',         move: 1.1,  scent: 0.55, hunter: 0.9 },
  elephant_path:     { id: 'elephant_path',     move: 0.8,  scent: 1.2,  hunter: 0.7 },
  acacia_grove:      { id: 'acacia_grove',      move: 1.2,  scent: 0.7,  hunter: 1.15 },
  mopane_woodland:   { id: 'mopane_woodland',   move: 1.3,  scent: 0.65, hunter: 1.2 },
  bamboo_grove:      { id: 'bamboo_grove',      move: 1.4,  scent: 0.5,  hunter: 1.3 },
  fallen_tree_grove: { id: 'fallen_tree_grove', move: 1.45, scent: 0.6,  hunter: 1.35 },
  thorn_thicket:     { id: 'thorn_thicket',     move: 1.55, scent: 0.55, hunter: 1.45 },
  fever_trees:       { id: 'fever_trees',       move: 1.2,  scent: 0.7,  hunter: 1.1 },
  rocky_outcrop:     { id: 'rocky_outcrop',     move: 1.35, scent: 0.35, hunter: 1.2 },
  granite_plateau:   { id: 'granite_plateau',   move: 1.25, scent: 0.25, hunter: 1.1 },
  volcanic_rock:     { id: 'volcanic_rock',     move: 1.5,  scent: 0.3,  hunter: 1.3 },
  sandstone_arches:  { id: 'sandstone_arches',  move: 1.3,  scent: 0.35, hunter: 1.15 },
  whistling_caves:   { id: 'whistling_caves',   move: 1.35, scent: 0.2,  hunter: 1.2 },
  ridge_line:        { id: 'ridge_line',        move: 1.45, scent: 0.4,  hunter: 1.25 },
  dry_ravine:        { id: 'dry_ravine',        move: 1.4,  scent: 0.45, hunter: 1.25 },
  kopje:             { id: 'kopje',             move: 1.35, scent: 0.3,  hunter: 1.2 },
  baobab:            { id: 'baobab',            move: 1.05, scent: 0.8,  hunter: 0.95 },
  overhang_cave:     { id: 'overhang_cave',     move: 1.2,  scent: 0.25, hunter: 1.1 },
  termite_cathedral: { id: 'termite_cathedral', move: 1.15, scent: 0.85, hunter: 1.0 }
};

export interface WorldSample extends TerrainSample {
  biome: BiomeId;
  terrainId: string;
  /** Convenience view of TERRAIN_CLASSES[terrainId]. */
  terrain: TerrainClass;
  /** 0..1 regional wetness (drives vegetation density + weather later). */
  moisture: number;
}

const MOISTURE_SCALE = 1 / 26000;
const PATCH_SCALE = 1 / 1900;
const BURN_SCALE = 1 / 12000;

/** Point features salted onto compatible ground on a spaced jittered grid. */
const FEATURE_CELL = 2600; // meters

export class Biomes {
  readonly field: Heightfield;

  constructor(readonly seed: number) {
    this.field = new Heightfield(seed);
  }

  sample(x: number, z: number): WorldSample {
    const t = this.field.sample(x, z);
    const s = this.seed;

    // Wetness: slow regional field, pushed up hard near live water.
    const wetBase = fbm(s ^ 0x4d4f4953, x * MOISTURE_SCALE, z * MOISTURE_SCALE, { octaves: 2 });
    const nearWater = Math.max(t.river, t.basin * 0.9);
    const moisture = clamp01(0.37 + wetBase * 0.48 + nearWater * 0.5 - t.belt * 0.25);

    // Local texture noise breaks biomes into patches (groves, thickets, pans).
    const patch = fbm(s ^ 0x50415443, x * PATCH_SCALE, z * PATCH_SCALE, { octaves: 3 });
    // Rare large burn scars sweep across any low country.
    const burn = smoothstep(0.42, 0.55,
      fbm(s ^ 0x4255524e, x * BURN_SCALE, z * BURN_SCALE, { octaves: 2 }));

    const { biome, terrainId } = this.classify(t, moisture, patch, burn, x, z);
    return { ...t, biome, terrainId, terrain: TERRAIN_CLASSES[terrainId]!, moisture };
  }

  private classify(
    t: TerrainSample, moisture: number, patch: number, burn: number,
    x: number, z: number
  ): { biome: BiomeId; terrainId: string } {
    const altitude = t.height - t.regional;

    // --- live water and its margins ---
    if (t.waterDepth > 0.35) {
      return { biome: 'water', terrainId: 'watering_hole' };
    }
    if (t.waterDepth > 0) {
      return { biome: 'riverine', terrainId: t.river > t.basin ? 'seasonal_stream' : 'watering_hole' };
    }
    if (t.river > 0.25) {
      // Carved channel, no water: the dry drainage country.
      if (moisture > 0.62) return { biome: 'riverine', terrainId: 'reed_bed' };
      return {
        biome: 'riverine',
        terrainId: patch > 0.15 ? 'sandy_wash' : (patch < -0.2 ? 'dried_marsh' : 'dry_riverbed')
      };
    }
    if (t.basin > 0.3) {
      // Lake margins: wet reeds, or the cracked bed of a lake that failed.
      if (moisture > 0.55) return { biome: 'wetland', terrainId: patch > 0 ? 'reed_bed' : 'dried_marsh' };
      return { biome: 'dryflats', terrainId: patch > 0 ? 'dry_lake_bed' : 'clay_pan' };
    }

    // --- mountains ---
    if (t.belt > 0.55 && altitude > 160) {
      const p = patch + (hash2(this.seed ^ 0x48494748, Math.floor(x / 900), Math.floor(z / 900)) - 0.5) * 0.4;
      if (altitude > 380) return { biome: 'highstone', terrainId: p > 0.25 ? 'volcanic_rock' : (p < -0.25 ? 'whistling_caves' : 'ridge_line') };
      if (p < -0.28) {
        return {
          biome: 'highstone',
          terrainId: hash2(this.seed ^ 0x43415645, Math.floor(x / 700), Math.floor(z / 700)) < 0.5
            ? 'overhang_cave' : 'sandstone_arches'
        };
      }
      return { biome: 'highstone', terrainId: p > 0.2 ? 'granite_plateau' : 'rocky_outcrop' };
    }
    if (t.belt > 0.32 && altitude > 40) {
      if (patch > 0.3) return { biome: 'foothills', terrainId: 'rocky_outcrop' };
      if (patch < -0.32) return { biome: 'foothills', terrainId: 'dry_ravine' };
      if (patch > 0.02) return { biome: 'foothills', terrainId: 'kopje' };
      return { biome: 'foothills', terrainId: moisture > 0.45 ? 'acacia_grove' : 'open_plain' };
    }

    // --- burned country ---
    if (burn > 0.4) {
      return { biome: 'burned', terrainId: patch > 0.05 ? 'burned_ground' : 'ash_field' };
    }

    // --- point features on open ground (spaced, deterministic) ---
    const feature = this.pointFeature(x, z, moisture);
    if (feature) return feature;

    // --- moisture bands over the plains ---
    if (moisture < 0.3) {
      const p = patch;
      if (p > 0.26) return { biome: 'dryflats', terrainId: 'red_dunes' };
      if (p < -0.26) return { biome: 'dryflats', terrainId: 'salt_flat' };
      return { biome: 'dryflats', terrainId: p > 0 ? 'clay_pan' : 'open_plain' };
    }
    if (moisture < 0.52) {
      if (patch > 0.2) return { biome: 'grassland', terrainId: 'tall_grass' };
      if (patch < -0.24) return { biome: 'grassland', terrainId: 'acacia_grove' };
      return { biome: 'grassland', terrainId: 'open_plain' };
    }
    // Wet country: thick growth.
    if (patch > 0.36) return { biome: 'thornlands', terrainId: 'thorn_thicket' };
    if (patch > 0.14) return { biome: 'thornlands', terrainId: 'mopane_woodland' };
    if (patch < -0.36) return { biome: 'thornlands', terrainId: moisture > 0.6 ? 'bamboo_grove' : 'fallen_tree_grove' };
    if (patch < -0.12) return { biome: 'thornlands', terrainId: 'fever_trees' };
    return { biome: 'thornlands', terrainId: 'acacia_grove' };
  }

  /**
   * Sparse point features: baobabs, termite cities, elephant paths.
   * One candidate per FEATURE_CELL grid cell, jittered, active only when its
   * hash clears a threshold — so features stay rare and never neighbour.
   */
  private pointFeature(x: number, z: number, moisture: number): { biome: BiomeId; terrainId: string } | null {
    const cx = Math.floor(x / FEATURE_CELL), cz = Math.floor(z / FEATURE_CELL);
    const roll = hash2(this.seed ^ 0x46454154, cx, cz);
    if (roll > 0.34) return null;

    // Feature centre, jittered inside the cell.
    const jx = (hash2(this.seed ^ 0x4a495458, cx, cz) - 0.5) * (FEATURE_CELL * 0.6);
    const jz = (hash2(this.seed ^ 0x4a49545a, cx, cz) - 0.5) * (FEATURE_CELL * 0.6);
    const fx = (cx + 0.5) * FEATURE_CELL + jx;
    const fz = (cz + 0.5) * FEATURE_CELL + jz;
    const d = Math.hypot(x - fx, z - fz);

    if (roll < 0.09) {
      // Elephant paths: long thin corridors through the cell, cheap to walk.
      const angle = hash2(this.seed ^ 0x414e474c, cx, cz) * Math.PI;
      const px = Math.cos(angle), pz = Math.sin(angle);
      const lateral = Math.abs((x - fx) * -pz + (z - fz) * px);
      if (lateral < 55 && d < FEATURE_CELL * 0.75) {
        return { biome: moisture < 0.3 ? 'dryflats' : 'grassland', terrainId: 'elephant_path' };
      }
      return null;
    }
    if (d > 260) return null;
    if (roll < 0.18) return { biome: 'grassland', terrainId: 'termite_cathedral' };
    if (roll < 0.26) return { biome: 'grassland', terrainId: 'baobab' };
    return { biome: 'foothills', terrainId: d < 160 ? 'kopje' : 'rocky_outcrop' };
  }
}

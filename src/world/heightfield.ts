// The land itself. Analytic, seeded, and local: any (x, z) in an endless
// world can be sampled without knowledge of its neighbours, which is what
// lets the world stream forever and the sim run headless.
//
// Units: 1 world unit = 1 meter. Height in meters above an abstract datum.
//
// Composition:
//   regional   very-low-frequency swell — the "datum" water planes hang from
//   base       rolling savannah relief, domain-warped
//   mountains  ridged crests inside belt masks (zero-contours of a slow field)
//   basins     lake depressions carved below the regional datum, water-filled
//   rivers     channel corridors carved below the datum, water-filled, kept
//              out of mountain cores so they read as valley rivers
//
// Rivers/lakes share the regional datum so connected water reads at one
// level locally. (True downhill flow needs global simulation; an endless
// analytic world buys plausibility with datums instead.)

import { bandMask, clamp01, fbm, ridged, smoothstep, warp2 } from './noise';

export interface WorldParams {
  /** Peak mountain height (m). */
  mountainHeight: number;
  /** Rolling base relief amplitude (m). */
  baseAmplitude: number;
  /** Regional swell amplitude (m). */
  regionalAmplitude: number;
  /** Lake bed depth below water surface (m). */
  lakeDepth: number;
  /** River bed depth below water surface (m). */
  riverDepth: number;
}

export const DEFAULT_PARAMS: WorldParams = {
  mountainHeight: 640,
  baseAmplitude: 26,
  regionalAmplitude: 40,
  lakeDepth: 14,
  riverDepth: 5.5
};

/** Scales as 1/wavelength-in-meters. */
const REGIONAL_SCALE = 1 / 22000;
const BASE_SCALE = 1 / 2800;
const BASE_WARP = 900;
const BASE_WARP_SCALE = 1 / 7500;
const BELT_SCALE = 1 / 58000;
const MOUNTAIN_SCALE = 1 / 4200;
const BASIN_SCALE = 1 / 15000;
const RIVER_SCALE = 1 / 15500;
const DRAINAGE_SCALE = 1 / 33000;
const RIVER_WARP = 650;
const RIVER_WARP_SCALE = 1 / 3400;
const RIVER_WIDTH_SCALE = 1 / 5200;

/** How far below the regional datum water surfaces sit (m). */
const LAKE_SURFACE_DROP = 3.0;
const RIVER_SURFACE_DROP = 0.8;

export interface TerrainSample {
  /** Ground height in meters (bed height where submerged). */
  height: number;
  /** Water surface height; only meaningful where waterDepth > 0. */
  waterSurface: number;
  /** Water depth in meters; 0 on dry land. */
  waterDepth: number;
  /** 0..1 — inside a mountain belt. */
  belt: number;
  /** 0..1 — inside a river corridor. */
  river: number;
  /** 0..1 — inside a lake basin. */
  basin: number;
  /** The slow regional swell, exposed for biome/moisture layers. */
  regional: number;
}

export class Heightfield {
  constructor(
    readonly seed: number,
    readonly params: WorldParams = DEFAULT_PARAMS
  ) {}

  sample(x: number, z: number): TerrainSample {
    const P = this.params;
    const s = this.seed;

    // Regional swell — the slow breathing of the land.
    const regional = fbm(s ^ 0x52454749, x * REGIONAL_SCALE, z * REGIONAL_SCALE, { octaves: 2 })
      * P.regionalAmplitude;

    // Rolling base, domain-warped so nothing lines up with any axis.
    const wp = warp2(s ^ 0x57415250, x, z, BASE_WARP, BASE_WARP_SCALE);
    const base = fbm(s ^ 0x42415345, wp.x * BASE_SCALE, wp.y * BASE_SCALE, { octaves: 5 })
      * P.baseAmplitude;

    // Mountain belts: ranges live along the zero-contours of a slow field.
    // One octave: the zero-set of a single smooth field gives long, clean
    // range lines; more octaves fragment it into blobby massifs.
    const beltField = fbm(s ^ 0x42454c54, x * BELT_SCALE, z * BELT_SCALE, { octaves: 1 });
    const belt = bandMask(beltField, 0.045, 0.11);
    let mountains = 0;
    if (belt > 0) {
      const m = ridged(s ^ 0x4d544e53, wp.x * MOUNTAIN_SCALE, wp.y * MOUNTAIN_SCALE, { octaves: 5 });
      // Belt shoulders lift before crests spike, so ranges rise out of foothills.
      mountains = (m * m * belt * belt) * P.mountainHeight + belt * 34;
    }

    // Lake basins, carved below the regional datum and filled.
    const basinField = fbm(s ^ 0x4241534e, x * BASIN_SCALE, z * BASIN_SCALE, { octaves: 3 });
    // Mountains suppress lakes; open low country invites them.
    const basin = smoothstep(0.38, 0.62, basinField) * (1 - belt);
    const lakeSurface = regional - LAKE_SURFACE_DROP;

    // River corridors: warped thin bands, kept off the crests.
    const rw = warp2(s ^ 0x52495652, x, z, RIVER_WARP, RIVER_WARP_SCALE);
    const riverField = fbm(s ^ 0x464c4f57, rw.x * RIVER_SCALE, rw.y * RIVER_SCALE, { octaves: 2 });
    const widthNoise = fbm(s ^ 0x57494454, x * RIVER_WIDTH_SCALE, z * RIVER_WIDTH_SCALE, { octaves: 2 });
    const halfWidth = 0.006 + clamp01(widthNoise * 0.5 + 0.5) * 0.011;
    // Dry country exists: rivers only run where the drainage field allows,
    // so some regions are river webs and others are waterless flats.
    const drainage = smoothstep(-0.25, 0.15,
      fbm(s ^ 0x4452414e, x * DRAINAGE_SCALE, z * DRAINAGE_SCALE, { octaves: 2 }));
    const river = bandMask(riverField, halfWidth, halfWidth * 2.6) * (1 - belt * 0.75) * drainage;
    const riverSurface = regional - RIVER_SURFACE_DROP;

    // Compose ground height.
    let height = regional + base + mountains;

    // Carve lake beds: blend ground toward a bed below the lake surface.
    if (basin > 0) {
      const bed = lakeSurface - P.lakeDepth * basin;
      height = height + (bed - height) * smoothstep(0.15, 0.85, basin);
    }

    // Carve river channels into whatever ground remains.
    if (river > 0.02) {
      const bed = riverSurface - P.riverDepth * river;
      if (bed < height) {
        height = height + (bed - height) * smoothstep(0.1, 0.9, river);
      }
    }

    // Water fills wherever ground sits below the local water datum.
    let waterSurface = -Infinity;
    if (basin > 0.02 && height < lakeSurface) waterSurface = lakeSurface;
    if (river > 0.02 && height < riverSurface) {
      waterSurface = Math.max(waterSurface, riverSurface);
    }
    const waterDepth = waterSurface > -Infinity ? waterSurface - height : 0;

    return {
      height,
      waterSurface: waterDepth > 0 ? waterSurface : height,
      waterDepth,
      belt,
      river,
      basin,
      regional
    };
  }

  /** Ground height only (hot path for meshing/navigation). */
  height(x: number, z: number): number {
    return this.sample(x, z).height;
  }
}

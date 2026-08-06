// Fog of war. Three states painted over the land:
//   unseen     — unknown country, near-black parchment; no information
//   remembered — explored: relief stays, color drains, nothing lives there
//   visible    — line of sight right now: full color, live entities
//
// Visibility is computed by horizon-walking rays over a cached coarse height
// grid: from the eye, along each ray, a texel is visible while its elevation
// angle beats the highest angle seen so far. High ground therefore *buys*
// sight — stand on the ridge and the world opens; drop into the valley and
// it closes to the nearest rise. Night pulls the whole radius in.

import {
  DataTexture, LinearFilter, Material, RGFormat, UnsignedByteType, Vector2
} from 'three';
import type { Heightfield } from '../world/heightfield';

const TEX_SIZE = 384;
const METERS_PER_TEXEL = 64;          // region covers ~24.6 km
const EYE_HEIGHT = 1.4;               // a big cat's eye above the ground
const RAY_COUNT = 1080;
const RAY_STEP = METERS_PER_TEXEL * 0.75;

export interface FogParams {
  /** Base sight radius by day, meters. */
  dayRadius: number;
  /** Multiplier at deep night. */
  nightFactor: number;
  /** Extra radius per meter of elevation advantage (sqrt-scaled). */
  vantageGain: number;
}

export const DEFAULT_FOG: FogParams = {
  dayRadius: 5200,
  nightFactor: 0.38,
  vantageGain: 480
};

export class FogOfWar {
  readonly texture: DataTexture;
  private data: Uint8Array;
  /** Cached ground+water heights for the covered region. */
  private heights: Float32Array | null = null;
  private originX = 0;               // world coords of texture center
  private originZ = 0;
  readonly uniforms = {
    fogMap: { value: null as DataTexture | null },
    fogOrigin: { value: new Vector2(0, 0) },
    fogSizeInv: { value: 1 / (TEX_SIZE * METERS_PER_TEXEL) }
  };

  constructor(readonly field: Heightfield, readonly params: FogParams = DEFAULT_FOG) {
    this.data = new Uint8Array(TEX_SIZE * TEX_SIZE * 2);
    this.texture = new DataTexture(this.data, TEX_SIZE, TEX_SIZE, RGFormat, UnsignedByteType);
    this.texture.magFilter = LinearFilter;
    this.texture.minFilter = LinearFilter;
    this.texture.needsUpdate = true;
    this.uniforms.fogMap.value = this.texture;
  }

  /**
   * Center the region on (x, z) and build the height cache. Expensive
   * (~150k heightfield samples) — call on new game / major relocation.
   */
  recenter(x: number, z: number): void {
    this.originX = x;
    this.originZ = z;
    this.uniforms.fogOrigin.value.set(x, z);
    const h = new Float32Array(TEX_SIZE * TEX_SIZE);
    for (let j = 0; j < TEX_SIZE; j++) {
      const wz = z + (j - TEX_SIZE / 2) * METERS_PER_TEXEL;
      for (let i = 0; i < TEX_SIZE; i++) {
        const wx = x + (i - TEX_SIZE / 2) * METERS_PER_TEXEL;
        const s = this.field.sample(wx, wz);
        // Sight travels over water surfaces, not lake beds.
        h[j * TEX_SIZE + i] = Math.max(s.height, s.waterSurface);
      }
    }
    this.heights = h;
    // New region: everything unseen (explored state lives in the old texels;
    // a persistent explored-store across regions is a later refinement).
    this.data.fill(0);
  }

  /** Is a world point currently visible? (CPU-side read for entity gating.) */
  visibleAt(x: number, z: number): boolean {
    const i = Math.round((x - this.originX) / METERS_PER_TEXEL + TEX_SIZE / 2);
    const j = Math.round((z - this.originZ) / METERS_PER_TEXEL + TEX_SIZE / 2);
    if (i < 0 || j < 0 || i >= TEX_SIZE || j >= TEX_SIZE) return false;
    return (this.data[(j * TEX_SIZE + i) * 2 + 1] ?? 0) > 60;
  }

  /** Height lookup in the cached grid (bilinear). */
  private gridHeight(wx: number, wz: number): number {
    const h = this.heights!;
    const fx = (wx - this.originX) / METERS_PER_TEXEL + TEX_SIZE / 2;
    const fz = (wz - this.originZ) / METERS_PER_TEXEL + TEX_SIZE / 2;
    const i0 = Math.max(0, Math.min(TEX_SIZE - 2, Math.floor(fx)));
    const j0 = Math.max(0, Math.min(TEX_SIZE - 2, Math.floor(fz)));
    const tx = Math.max(0, Math.min(1, fx - i0));
    const tz = Math.max(0, Math.min(1, fz - j0));
    const a = h[j0 * TEX_SIZE + i0]!, b = h[j0 * TEX_SIZE + i0 + 1]!;
    const c = h[(j0 + 1) * TEX_SIZE + i0]!, d = h[(j0 + 1) * TEX_SIZE + i0 + 1]!;
    return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
  }

  /**
   * Recompute the visible channel from an eye at (x, z); explored accumulates.
   * `sunElevation` in [-1, 1] scales the radius (night closes in).
   * Returns the radius used, for HUD/debug.
   */
  computeFrom(x: number, z: number, sunElevation: number): number {
    if (!this.heights) this.recenter(x, z);
    const P = this.params;

    // Elevation advantage over the mean ground within ~1.5 km.
    let mean = 0, n = 0;
    for (let r = 300; r <= 1500; r += 400) {
      for (let a = 0; a < 8; a++) {
        const t = (a / 8) * Math.PI * 2;
        mean += this.gridHeight(x + Math.cos(t) * r, z + Math.sin(t) * r);
        n++;
      }
    }
    mean /= n;
    const eyeGround = this.gridHeight(x, z);
    const advantage = Math.max(0, eyeGround - mean);
    const nightT = Math.min(1, Math.max(0, -sunElevation / 0.3));
    const dayNight = 1 - (1 - P.nightFactor) * nightT;
    const radius = (P.dayRadius + Math.sqrt(advantage) * P.vantageGain) * dayNight;

    // Clear the visible channel.
    for (let i = 0; i < TEX_SIZE * TEX_SIZE; i++) this.data[i * 2 + 1] = 0;

    const eyeY = eyeGround + EYE_HEIGHT;
    const steps = Math.ceil(radius / RAY_STEP);
    for (let ray = 0; ray < RAY_COUNT; ray++) {
      const t = (ray / RAY_COUNT) * Math.PI * 2;
      const dx = Math.cos(t) * RAY_STEP, dz = Math.sin(t) * RAY_STEP;
      let maxTan = -Infinity;
      let wx = x, wz = z;
      for (let s = 1; s <= steps; s++) {
        wx += dx; wz += dz;
        const gi = Math.round((wx - this.originX) / METERS_PER_TEXEL + TEX_SIZE / 2);
        const gj = Math.round((wz - this.originZ) / METERS_PER_TEXEL + TEX_SIZE / 2);
        if (gi < 1 || gj < 1 || gi >= TEX_SIZE - 1 || gj >= TEX_SIZE - 1) break;
        const groundY = this.heights![gj * TEX_SIZE + gi]!;
        const dist = s * RAY_STEP;
        const tan = (groundY - eyeY) / dist;
        if (tan >= maxTan) {
          maxTan = tan;
          const idx = (gj * TEX_SIZE + gi) * 2;
          // Soft distance falloff near the radius edge.
          const fade = Math.min(1, Math.max(0, (radius - dist) / (radius * 0.18)));
          const v = Math.round(255 * fade);
          if (v > this.data[idx + 1]!) this.data[idx + 1] = v;
          if (v > this.data[idx]!) this.data[idx] = v;   // explored accumulates
        }
      }
    }

    // Close the stipple the ray pass leaves: dilate then box-blur the visible
    // channel (a texel seen by any neighbour ray is effectively seen).
    const vis = new Uint8Array(TEX_SIZE * TEX_SIZE);
    for (let i = 0; i < TEX_SIZE * TEX_SIZE; i++) vis[i] = this.data[i * 2 + 1]!;
    const dilated = new Uint8Array(TEX_SIZE * TEX_SIZE);
    for (let j = 1; j < TEX_SIZE - 1; j++) {
      for (let i = 1; i < TEX_SIZE - 1; i++) {
        let m = 0;
        for (let dj = -1; dj <= 1; dj++) {
          for (let di = -1; di <= 1; di++) {
            const v = vis[(j + dj) * TEX_SIZE + i + di]!;
            if (v > m) m = v;
          }
        }
        dilated[j * TEX_SIZE + i] = m;
      }
    }
    for (let j = 1; j < TEX_SIZE - 1; j++) {
      for (let i = 1; i < TEX_SIZE - 1; i++) {
        let sum = 0;
        for (let dj = -1; dj <= 1; dj++) {
          for (let di = -1; di <= 1; di++) sum += dilated[(j + dj) * TEX_SIZE + i + di]!;
        }
        // Renormalize after blur so solidly-seen ground stays fully seen.
        const v = Math.min(255, Math.round((sum / 9) * 1.45));
        const idx = (j * TEX_SIZE + i) * 2;
        this.data[idx + 1] = v;
        if (v > this.data[idx]!) this.data[idx] = v;
      }
    }

    // The eye's own texel and immediate ring are always visible.
    const ci = Math.round((x - this.originX) / METERS_PER_TEXEL + TEX_SIZE / 2);
    const cj = Math.round((z - this.originZ) / METERS_PER_TEXEL + TEX_SIZE / 2);
    for (let dj = -2; dj <= 2; dj++) {
      for (let di = -2; di <= 2; di++) {
        const idx = ((cj + dj) * TEX_SIZE + ci + di) * 2;
        if (idx >= 0 && idx < this.data.length - 1) {
          this.data[idx] = 255; this.data[idx + 1] = 255;
        }
      }
    }

    this.texture.needsUpdate = true;
    return radius;
  }
}

/** A shader injection: extra uniforms plus GLSL declarations and body code. */
export interface FogInjection {
  uniforms: Record<string, { value: unknown }>;
  decls: string;
  glsl: string;
}

/**
 * Patch a built-in material to grade its output by the fog state, with
 * optional extra injections (reach field, water glint) that run in the same
 * pass, before the fog grade — so nothing paints over unknown country.
 */
export function attachFog(
  material: Material, fog: FogOfWar, injections: FogInjection[] = []
): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms['fogMap'] = fog.uniforms.fogMap;
    shader.uniforms['fogOrigin'] = fog.uniforms.fogOrigin;
    shader.uniforms['fogSizeInv'] = fog.uniforms.fogSizeInv;
    for (const inj of injections) Object.assign(shader.uniforms, inj.uniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFowWorldPos;')
      .replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvFowWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;');

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vFowWorldPos;
        uniform sampler2D fogMap;
        uniform vec2 fogOrigin;
        uniform float fogSizeInv;
        ${injections.map((i) => i.decls).join('\n')}`)
      .replace('#include <dithering_fragment>', `
        {
          ${injections.map((i) => i.glsl).join('\n')}
          vec2 fuv = (vFowWorldPos.xz - fogOrigin) * fogSizeInv + 0.5;
          vec2 fw = texture2D(fogMap, fuv).rg;
          float inRegion = step(0.005, fuv.x) * step(fuv.x, 0.995)
                         * step(0.005, fuv.y) * step(fuv.y, 0.995);
          float explored = max(fw.r, fw.g) * inRegion;
          float visible = fw.g * inRegion;

          vec3 lit = gl_FragColor.rgb;
          float lum = dot(lit, vec3(0.299, 0.587, 0.114));
          // Remembered land: drained and dimmed, relief kept.
          vec3 remembered = mix(vec3(lum), lit, 0.3) * 0.42;
          // Unknown land: deep shadow with relief barely breathing through,
          // so it reads as night country, not a hole in the screen.
          vec3 unknown = vec3(0.030, 0.024, 0.018) + vec3(lum) * 0.085;

          vec3 known = mix(remembered, lit, smoothstep(0.12, 0.45, visible));
          gl_FragColor.rgb = mix(unknown, known, smoothstep(0.02, 0.28, explored));
        }
        #include <dithering_fragment>`);
  };
  material.needsUpdate = true;
}

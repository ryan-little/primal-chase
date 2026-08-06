// Reach as a field, not a swarm of discs: a small texture over the region
// around the player holds normalized effort cost per texel; the terrain
// shader tints the trot and push zones and draws their contour edges.

import { DataTexture, LinearFilter, RedFormat, UnsignedByteType, Vector2 } from 'three';
import type { NavNode } from '../world/nav';
import { METERS_PER_MILE } from '../world/nav';

const SIZE = 256;
const METERS_PER_TEXEL = 96; // region ~24.5 km

export class ReachField {
  readonly texture: DataTexture;
  private data: Uint8Array;
  readonly uniforms = {
    reachMap: { value: null as DataTexture | null },
    reachOrigin: { value: new Vector2() },
    reachSizeInv: { value: 1 / (SIZE * METERS_PER_TEXEL) },
    reachShow: { value: 0 },
    /** Trot budget as a fraction of the push budget. */
    reachTrotFrac: { value: 0.54 }
  };

  constructor() {
    this.data = new Uint8Array(SIZE * SIZE);
    this.texture = new DataTexture(this.data, SIZE, SIZE, RedFormat, UnsignedByteType);
    this.texture.magFilter = LinearFilter;
    this.texture.minFilter = LinearFilter;
    this.uniforms.reachMap.value = this.texture;
  }

  /** Fill from a reach map; value = cost / pushBudget, splatted per node. */
  show(reach: Map<string, NavNode>, originX: number, originZ: number, pushMiles: number, trotMiles: number): void {
    this.data.fill(0);
    this.uniforms.reachOrigin.value.set(originX, originZ);
    this.uniforms.reachTrotFrac.value = trotMiles / pushMiles;
    const maxCost = pushMiles * METERS_PER_MILE;

    for (const n of reach.values()) {
      const v = Math.max(8, Math.round(255 * (1 - n.cost / maxCost) * 0.92 + 20));
      const ci = Math.round((n.x - originX) / METERS_PER_TEXEL + SIZE / 2);
      const cj = Math.round((n.z - originZ) / METERS_PER_TEXEL + SIZE / 2);
      // Splat 3x3 — node spacing (220m) is coarser than texels (96m).
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const i = ci + di, j = cj + dj;
          if (i < 0 || j < 0 || i >= SIZE || j >= SIZE) continue;
          const idx = j * SIZE + i;
          if (v > this.data[idx]!) this.data[idx] = v;
        }
      }
    }
    this.texture.needsUpdate = true;
    this.uniforms.reachShow.value = 1;
  }

  hide(): void {
    this.uniforms.reachShow.value = 0;
  }
}

export const REACH_DECLS = /* glsl */`
  uniform sampler2D reachMap;
  uniform vec2 reachOrigin;
  uniform float reachSizeInv;
  uniform float reachShow;
  uniform float reachTrotFrac;
`;

/** GLSL block for the terrain fragment patch (expects fuv-style sampling). */
export const REACH_GLSL = /* glsl */`
  if (reachShow > 0.5) {
    vec2 ruv = (vFowWorldPos.xz - reachOrigin) * reachSizeInv + 0.5;
    float rv = texture2D(reachMap, ruv).r;
    if (rv > 0.03) {
      // rv encodes remaining budget: high near the cat, low at the fringe.
      float trotEdge = 20.0 / 255.0 + (1.0 - reachTrotFrac) * 0.92 * (235.0 / 255.0);
      float inTrot = smoothstep(trotEdge - 0.015, trotEdge + 0.015, rv);
      vec3 reachTintC = mix(vec3(0.85, 0.56, 0.29), vec3(0.96, 0.82, 0.54), inTrot);
      float band = smoothstep(0.03, 0.10, rv);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * 0.96 + reachTintC * 0.09, band);
      // Bright rim at the outer contour.
      float rim = smoothstep(0.03, 0.055, rv) * (1.0 - smoothstep(0.055, 0.10, rv));
      gl_FragColor.rgb += reachTintC * rim * 0.35;
    }
  }
`;

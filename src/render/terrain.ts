// Chunked terrain meshing of the analytic heightfield. Chunks are built
// asynchronously (budgeted per frame) in a ring around a focus point and
// recycled when the focus moves on. Ground color comes from the biome
// classification per vertex, tinted by slope (rock shows through on steeps)
// and a stable variation noise so plains never read as flat paint.

import {
  BufferAttribute, BufferGeometry, Group, InstancedMesh, Mesh, MeshStandardMaterial
} from 'three';
import type { Biomes } from '../world/biomes';
import { hash2 } from '../world/rng';
import { ROCK_COLOR, TERRAIN_COLORS, WATER_DEEP, WATER_SHALLOW } from './palette';
import { buildChunkVegetation } from './vegetation';

export const CHUNK_SIZE = 2048;        // meters on a side
export const CHUNK_QUADS = 96;         // quads per side (~21m per vertex)

const STEP = CHUNK_SIZE / CHUNK_QUADS;

export interface ChunkKeyed { cx: number; cz: number; }
const chunkKey = (cx: number, cz: number) => cx + ',' + cz;

export class TerrainChunks {
  readonly group = new Group();
  private chunks = new Map<string, Mesh>();
  private waterChunks = new Map<string, Mesh>();
  private vegChunks = new Map<string, Group>();
  private pending: ChunkKeyed[] = [];
  private focusCx = Infinity;
  private focusCz = Infinity;
  /** Vegetation density multiplier (quality tier hook). */
  vegetationDensity = 1.0;

  readonly groundMaterial = new MeshStandardMaterial({
    vertexColors: true, roughness: 1.0, metalness: 0
  });
  readonly waterMaterial = new MeshStandardMaterial({
    vertexColors: true, roughness: 0.12, metalness: 0,
    transparent: true, opacity: 0.86
  });

  constructor(readonly biomes: Biomes, readonly radiusChunks = 5) {}

  /** Retarget the ring; queues builds nearest-first. Cheap to call often. */
  focus(x: number, z: number): void {
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE);
    if (cx === this.focusCx && cz === this.focusCz) return;
    this.focusCx = cx; this.focusCz = cz;

    const wanted = new Set<string>();
    this.pending = [];
    for (let dz = -this.radiusChunks; dz <= this.radiusChunks; dz++) {
      for (let dx = -this.radiusChunks; dx <= this.radiusChunks; dx++) {
        const k = chunkKey(cx + dx, cz + dz);
        wanted.add(k);
        if (!this.chunks.has(k)) this.pending.push({ cx: cx + dx, cz: cz + dz });
      }
    }
    this.pending.sort((a, b) =>
      (Math.abs(a.cx - cx) + Math.abs(a.cz - cz)) - (Math.abs(b.cx - cx) + Math.abs(b.cz - cz)));

    for (const [k, mesh] of this.chunks) {
      if (!wanted.has(k)) {
        this.disposeMesh(mesh);
        this.chunks.delete(k);
        const w = this.waterChunks.get(k);
        if (w) { this.disposeMesh(w); this.waterChunks.delete(k); }
        const v = this.vegChunks.get(k);
        if (v) {
          this.group.remove(v);
          // Geometry/materials are shared module-wide; only instance buffers die.
          v.traverse((o) => { if (o instanceof InstancedMesh) o.dispose(); });
          this.vegChunks.delete(k);
        }
      }
    }
  }

  /** Build up to `budget` queued chunks (call once per frame). */
  tick(budget = 1): boolean {
    let built = 0;
    while (built < budget && this.pending.length) {
      const c = this.pending.shift()!;
      this.build(c.cx, c.cz);
      built++;
    }
    return this.pending.length > 0;
  }

  /** True once every wanted chunk exists (initial load complete). */
  get idle(): boolean { return this.pending.length === 0; }

  private disposeMesh(mesh: Mesh): void {
    this.group.remove(mesh);
    mesh.geometry.dispose();
  }

  private build(cx: number, cz: number): void {
    const n = CHUNK_QUADS + 1;
    const x0 = cx * CHUNK_SIZE, z0 = cz * CHUNK_SIZE;

    const positions = new Float32Array(n * n * 3);
    const colors = new Float32Array(n * n * 3);
    let waterCount = 0;
    const waterMask = new Float32Array(n * n); // water surface height or NaN
    const depths = new Float32Array(n * n);

    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = x0 + i * STEP, z = z0 + j * STEP;
        const s = this.biomes.sample(x, z);
        const idx = j * n + i;
        positions[idx * 3] = x;
        positions[idx * 3 + 1] = s.height;
        positions[idx * 3 + 2] = z;

        // Base terrain color, rock on steep ground, stable variation.
        const base = TERRAIN_COLORS[s.terrainId] ?? TERRAIN_COLORS['open_plain']!;
        const e = STEP * 0.5;
        const hx = (this.biomes.field.height(x + e, z) - this.biomes.field.height(x - e, z)) / (2 * e);
        const hz = (this.biomes.field.height(x, z + e) - this.biomes.field.height(x, z - e)) / (2 * e);
        const slope = Math.hypot(hx, hz);
        const rockMix = Math.min(1, Math.max(0, (slope - 0.28) * 2.2));
        const vary = (hash2(this.biomes.seed ^ 0x56415259, Math.round(x * 0.11), Math.round(z * 0.11)) - 0.5) * 0.14;

        let r = base.r + (ROCK_COLOR.r - base.r) * rockMix;
        let g = base.g + (ROCK_COLOR.g - base.g) * rockMix;
        let b = base.b + (ROCK_COLOR.b - base.b) * rockMix;
        r = Math.max(0, r * (1 + vary));
        g = Math.max(0, g * (1 + vary));
        b = Math.max(0, b * (1 + vary * 0.8));
        colors[idx * 3] = r; colors[idx * 3 + 1] = g; colors[idx * 3 + 2] = b;

        if (s.waterDepth > 0) {
          waterMask[idx] = s.waterSurface;
          depths[idx] = s.waterDepth;
          waterCount++;
        } else {
          waterMask[idx] = NaN;
        }
      }
    }

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(positions, 3));
    geo.setAttribute('color', new BufferAttribute(colors, 3));
    geo.setIndex(gridIndices(n));
    geo.computeVertexNormals();

    const mesh = new Mesh(geo, this.groundMaterial);
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.chunks.set(chunkKey(cx, cz), mesh);

    if (waterCount > 0) this.buildWater(cx, cz, n, positions, waterMask, depths);

    const veg = buildChunkVegetation(this.biomes, cx, cz, CHUNK_SIZE, this.vegetationDensity);
    this.group.add(veg);
    this.vegChunks.set(chunkKey(cx, cz), veg);
  }

  /**
   * Water surface: same grid, vertices at the water surface where wet and
   * tucked just under the ground where dry, so shorelines meet cleanly.
   */
  private buildWater(
    cx: number, cz: number, n: number,
    ground: Float32Array, waterMask: Float32Array, depths: Float32Array
  ): void {
    const positions = new Float32Array(n * n * 3);
    const colors = new Float32Array(n * n * 3);

    for (let idx = 0; idx < n * n; idx++) {
      const gx = ground[idx * 3]!, gy = ground[idx * 3 + 1]!, gz = ground[idx * 3 + 2]!;
      const wet = !Number.isNaN(waterMask[idx]!);
      positions[idx * 3] = gx;
      positions[idx * 3 + 1] = wet ? waterMask[idx]! : gy - 0.35;
      positions[idx * 3 + 2] = gz;

      const t = Math.min(1, (wet ? depths[idx]! : 0) / 7);
      colors[idx * 3] = WATER_SHALLOW.r + (WATER_DEEP.r - WATER_SHALLOW.r) * t;
      colors[idx * 3 + 1] = WATER_SHALLOW.g + (WATER_DEEP.g - WATER_SHALLOW.g) * t;
      colors[idx * 3 + 2] = WATER_SHALLOW.b + (WATER_DEEP.b - WATER_SHALLOW.b) * t;
    }

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(positions, 3));
    geo.setAttribute('color', new BufferAttribute(colors, 3));
    geo.setIndex(gridIndices(n));
    geo.computeVertexNormals();

    const mesh = new Mesh(geo, this.waterMaterial);
    mesh.renderOrder = 2;
    this.group.add(mesh);
    this.waterChunks.set(chunkKey(cx, cz), mesh);
  }
}

function gridIndices(n: number): BufferAttribute {
  const idx = new Uint32Array(CHUNK_QUADS * CHUNK_QUADS * 6);
  let o = 0;
  for (let j = 0; j < CHUNK_QUADS; j++) {
    for (let i = 0; i < CHUNK_QUADS; i++) {
      const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
      idx[o++] = a; idx[o++] = c; idx[o++] = b;
      idx[o++] = b; idx[o++] = c; idx[o++] = d;
    }
  }
  return new BufferAttribute(idx, 1);
}

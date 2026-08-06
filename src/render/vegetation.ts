// Vegetation and ground scenery: instanced low-poly flora per chunk, placed
// from the biome field with stable hashes, so the thornlands actually bristle
// and the acacia country carries its flat-topped trees. Materials are shared
// module-wide so fog of war can be attached once.

import {
  AdditiveBlending, CylinderGeometry, ConeGeometry, DodecahedronGeometry,
  Group, InstancedMesh, Material, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Quaternion, SphereGeometry, TorusGeometry, Vector3
} from 'three';
import type { Biomes, WorldSample } from '../world/biomes';
import { hash2, hash3 } from '../world/rng';
import { landmarksIn, type Landmark } from '../world/landmarks';

const trunkMat = new MeshStandardMaterial({ color: 0x5a4530, roughness: 0.95 });
const canopyMat = new MeshStandardMaterial({ color: 0x6b7a3a, roughness: 0.9 });
const bushMat = new MeshStandardMaterial({ color: 0x7a7442, roughness: 0.95 });
const rockMat = new MeshStandardMaterial({ color: 0x776b5f, roughness: 1 });
const reedMat = new MeshStandardMaterial({ color: 0x718048, roughness: 0.9 });
const deadMat = new MeshStandardMaterial({ color: 0x6b5a42, roughness: 1 });

export const vegetationMaterials: Material[] = [trunkMat, canopyMat, bushMat, rockMat, reedMat, deadMat];

interface Archetype {
  build: () => { geo: import('three').BufferGeometry; mat: Material }[];
  /** Base scale in meters and jitter. */
  scale: number;
  jitter: number;
}

// Geometry is shared per archetype part; instances differ by matrix only.
const acaciaTrunk = new CylinderGeometry(0.5, 0.9, 7, 5);
acaciaTrunk.translate(0, 3.5, 0);
const acaciaCanopy = new ConeGeometry(6.5, 2.4, 7);
acaciaCanopy.translate(0, 8.2, 0);
const treeTrunk = new CylinderGeometry(0.6, 1.0, 6, 5);
treeTrunk.translate(0, 3, 0);
const treeCanopy = new SphereGeometry(4.2, 6, 5);
treeCanopy.scale(1, 0.75, 1);
treeCanopy.translate(0, 7.2, 0);
const bushGeo = new SphereGeometry(1.8, 5, 4);
bushGeo.scale(1, 0.62, 1);
bushGeo.translate(0, 1.1, 0);
const rockGeo = new DodecahedronGeometry(1.6, 0);
rockGeo.scale(1, 0.72, 1);
rockGeo.translate(0, 0.7, 0);
const reedGeo = new ConeGeometry(1.1, 3.4, 4);
reedGeo.translate(0, 1.7, 0);
const deadGeo = new CylinderGeometry(0.25, 0.5, 5.5, 4);
deadGeo.rotateZ(0.5);
deadGeo.translate(0, 2.2, 0);
const baobabTrunk = new CylinderGeometry(2.6, 3.4, 11, 7);
baobabTrunk.translate(0, 5.5, 0);
const baobabCanopy = new SphereGeometry(5.4, 6, 5);
baobabCanopy.scale(1, 0.5, 1);
baobabCanopy.translate(0, 12.2, 0);

type Kind = 'acacia' | 'tree' | 'bush' | 'rock' | 'reed' | 'dead' | 'baobab';

const PARTS: Record<Kind, { geo: import('three').BufferGeometry; mat: Material }[]> = {
  acacia: [{ geo: acaciaTrunk, mat: trunkMat }, { geo: acaciaCanopy, mat: canopyMat }],
  tree: [{ geo: treeTrunk, mat: trunkMat }, { geo: treeCanopy, mat: canopyMat }],
  bush: [{ geo: bushGeo, mat: bushMat }],
  rock: [{ geo: rockGeo, mat: rockMat }],
  reed: [{ geo: reedGeo, mat: reedMat }],
  dead: [{ geo: deadGeo, mat: deadMat }],
  baobab: [{ geo: baobabTrunk, mat: trunkMat }, { geo: baobabCanopy, mat: canopyMat }]
};

/** What grows where: [kind, density 0..1, scale, scaleJitter]. */
function floraFor(s: WorldSample): [Kind, number, number, number][] {
  switch (s.terrainId) {
    case 'acacia_grove': return [['acacia', 0.5, 1.0, 0.35], ['bush', 0.25, 1, 0.4]];
    case 'mopane_woodland': return [['tree', 0.65, 1.0, 0.3], ['bush', 0.3, 1, 0.4]];
    case 'fever_trees': return [['tree', 0.5, 1.1, 0.3]];
    case 'bamboo_grove': return [['reed', 0.9, 2.2, 0.4]];
    case 'fallen_tree_grove': return [['dead', 0.7, 1.2, 0.4], ['bush', 0.3, 1, 0.3]];
    case 'thorn_thicket': return [['bush', 0.95, 1.35, 0.45], ['dead', 0.15, 1, 0.3]];
    case 'tall_grass': return [['bush', 0.3, 0.8, 0.3]];
    case 'open_plain': return [['acacia', 0.05, 0.9, 0.3], ['bush', 0.12, 0.8, 0.3]];
    case 'baobab': return [['baobab', 0.16, 1.0, 0.25], ['bush', 0.2, 1, 0.3]];
    case 'reed_bed': case 'dried_marsh': return [['reed', 0.8, 1.0, 0.35]];
    case 'rocky_outcrop': case 'kopje': return [['rock', 0.3, 2.2, 0.6], ['bush', 0.12, 0.9, 0.3]];
    case 'granite_plateau': case 'ridge_line': return [['rock', 0.18, 2.0, 0.5]];
    case 'volcanic_rock': case 'whistling_caves': case 'overhang_cave':
      return [['rock', 0.3, 2.4, 0.6]];
    case 'sandstone_arches': return [['rock', 0.25, 3.0, 0.7]];
    case 'dry_ravine': case 'dry_riverbed': return [['rock', 0.2, 1.6, 0.5], ['dead', 0.12, 1, 0.3]];
    case 'burned_ground': case 'ash_field': return [['dead', 0.35, 1.0, 0.4]];
    case 'termite_cathedral': return [['rock', 0.5, 1.6, 0.4]];
    default: return [];
  }
}

const SPACING = 58; // meters between candidate points

/** Builds (and owns) the instanced scenery for one terrain chunk. */
export function buildChunkVegetation(
  biomes: Biomes, cx: number, cz: number, chunkSize: number, density: number
): Group {
  const group = new Group();
  const placements = new Map<Kind, Matrix4[]>();
  const n = Math.floor(chunkSize / SPACING);
  const seed = biomes.seed ^ 0x56454745;

  const pos = new Vector3(), scl = new Vector3();
  const quat = new Quaternion(), up = new Vector3(0, 1, 0);

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const gx = cx * chunkSize + (i + 0.5) * SPACING;
      const gz = cz * chunkSize + (j + 0.5) * SPACING;
      const jx = (hash3(seed, i, j, cx * 7919 + cz) - 0.5) * SPACING * 0.9;
      const jz = (hash3(seed ^ 0x9e37, i, j, cx * 7919 + cz) - 0.5) * SPACING * 0.9;
      const x = gx + jx, z = gz + jz;

      const s = biomes.sample(x, z);
      if (s.waterDepth > 0.15 && s.terrainId !== 'reed_bed') continue;

      const flora = floraFor(s);
      if (!flora.length) continue;
      const roll = hash2(seed ^ 0x464c4f, Math.round(x), Math.round(z));
      let acc = 0;
      for (const [kind, d, scale, jitter] of flora) {
        acc += d * density;
        if (roll < acc) {
          const sc = scale * (1 + (hash2(seed ^ 0x53434c, Math.round(x), Math.round(z)) - 0.5) * 2 * jitter);
          const rot = hash2(seed ^ 0x524f54, Math.round(x), Math.round(z)) * Math.PI * 2;
          pos.set(x, s.height, z);
          quat.setFromAxisAngle(up, rot);
          scl.setScalar(sc);
          const m = new Matrix4().compose(pos, quat, scl);
          let list = placements.get(kind);
          if (!list) { list = []; placements.set(kind, list); }
          list.push(m);
          break;
        }
      }
    }
  }

  for (const [kind, mats] of placements) {
    for (const part of PARTS[kind]) {
      const im = new InstancedMesh(part.geo, part.mat, mats.length);
      for (let k = 0; k < mats.length; k++) im.setMatrixAt(k, mats[k]!);
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = kind !== 'reed' && kind !== 'bush';
      im.frustumCulled = false;
      group.add(im);
    }
  }

  // Landmark structures inside this chunk.
  for (const l of landmarksIn(biomes.seed, cx * chunkSize, cz * chunkSize,
    (cx + 1) * chunkSize, (cz + 1) * chunkSize)) {
    group.add(buildLandmark(l, biomes.sample(l.x, l.z).height));
  }
  return group;
}

// ---- landmark structures ----

const monolithGeo = new CylinderGeometry(2.2, 4.4, 34, 6);
monolithGeo.translate(0, 17, 0);
const cairnStone = new DodecahedronGeometry(3.2, 0);
const archLeg = new CylinderGeometry(2.4, 3.2, 20, 6);
const archTop = new TorusGeometry(9, 2.2, 6, 10, Math.PI);
const beaconGeo = new CylinderGeometry(2.2, 4.2, 260, 6, 1, true);
beaconGeo.translate(0, 130, 0);

const landmarkStone = new MeshStandardMaterial({ color: 0x8d8072, roughness: 1 });
/** Beacons pierce the fog — a strangeness sensed, not seen. Not fog-attached. */
const beaconMat = new MeshBasicMaterial({
  color: 0xffe9b8, transparent: true, opacity: 0.11,
  blending: AdditiveBlending, depthWrite: false, fog: false
});

export const landmarkMaterials: Material[] = [landmarkStone];

function buildLandmark(l: Landmark, groundY: number): Group {
  const g = new Group();
  if (l.kind === 'monolith') {
    const m = new Mesh(monolithGeo, landmarkStone);
    m.castShadow = true;
    g.add(m);
  } else if (l.kind === 'great_baobab') {
    const trunk = new Mesh(baobabTrunk, trunkMat);
    const canopy = new Mesh(baobabCanopy, canopyMat);
    trunk.castShadow = canopy.castShadow = true;
    trunk.scale.setScalar(2.6);
    canopy.scale.setScalar(2.6);
    g.add(trunk, canopy);
  } else if (l.kind === 'arch') {
    const a = new Mesh(archLeg, landmarkStone);
    a.position.set(-9, 10, 0);
    const b = new Mesh(archLeg, landmarkStone);
    b.position.set(9, 10, 0);
    const top = new Mesh(archTop, landmarkStone);
    top.position.y = 20;
    a.castShadow = b.castShadow = top.castShadow = true;
    g.add(a, b, top);
  } else {
    for (let i = 0; i < 5; i++) {
      const s = new Mesh(cairnStone, landmarkStone);
      s.position.set(Math.cos(i * 2.4) * (4 - i * 0.6), 2 + i * 3.4, Math.sin(i * 2.4) * (4 - i * 0.6));
      s.scale.setScalar(1 - i * 0.13);
      s.castShadow = true;
      g.add(s);
    }
  }
  g.add(new Mesh(beaconGeo, beaconMat));
  g.position.set(l.x, groundY, l.z);
  return g;
}

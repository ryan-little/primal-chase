// ============================================================
// SCENERY.JS — everything that grows out of or lies on the hexes
// All props are procedural low-poly geometry merged into single
// vertex-coloured meshes, then drawn with InstancedMesh so a whole
// savannah costs a dozen draw calls.
// ============================================================

import * as THREE from '../../js/vendor/three.module.min.js';
import * as Hex from './hex.js';

// ------------------------------------------------------------
// Geometry helpers
// ------------------------------------------------------------

/** Concatenate non-indexed geometries that all carry position/normal/color. */
function mergeGeos(geos) {
  let total = 0;
  for (const g of geos) total += g.getAttribute('position').count;
  const pos = new Float32Array(total * 3);
  const nrm = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  let off = 0;
  for (const g of geos) {
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const c = g.getAttribute('color');
    pos.set(p.array, off * 3);
    nrm.set(n.array, off * 3);
    col.set(c.array, off * 3);
    off += p.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}

/** Give a geometry a flat vertex colour and bake a transform into it. */
function prep(geo, hexColor, transform) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (transform) g.applyMatrix4(transform);
  g.computeVertexNormals();
  const count = g.getAttribute('position').count;
  const c = new THREE.Color(hexColor);
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3));
  return g;
}

function T(x, y, z, sx, sy, sz, rx, ry, rz) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0));
  m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz));
  return m;
}

/** Push vertices around to break up primitive silhouettes. */
function jitter(geo, amount, seed = 1) {
  const p = geo.getAttribute('position');
  let s = seed * 9301;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 - 0.5; };
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(i,
      p.getX(i) + rnd() * amount,
      p.getY(i) + rnd() * amount,
      p.getZ(i) + rnd() * amount);
  }
  p.needsUpdate = true;
  return geo;
}

// ------------------------------------------------------------
// Prop archetypes
// ------------------------------------------------------------

const BARK = 0x5a4530;
const BARK_PALE = 0x9aa270;
const BARK_BAOBAB = 0x8a7a63;
const LEAF = 0x6f7f3e;
const LEAF_DRY = 0x8a8443;
const ROCK_C = 0x7a7168;
const DEAD = 0x6d6252;

function buildAcacia() {
  // Twisted trunk that splits into the flat umbrella canopy of the real thing.
  const parts = [];
  parts.push(prep(new THREE.CylinderGeometry(0.16, 0.34, 3.0, 6), BARK, T(0, 1.5, 0, 1)));
  parts.push(prep(new THREE.CylinderGeometry(0.09, 0.16, 1.5, 5), BARK, T(0.45, 3.3, 0.1, 1, 1, 1, 0, 0, -0.42)));
  parts.push(prep(new THREE.CylinderGeometry(0.09, 0.16, 1.4, 5), BARK, T(-0.4, 3.2, -0.15, 1, 1, 1, 0.3, 0, 0.38)));
  const canopy = jitter(new THREE.IcosahedronGeometry(1, 0), 0.18, 3);
  parts.push(prep(canopy, LEAF, T(0.1, 4.15, 0, 2.35, 0.62, 2.1)));
  const canopy2 = jitter(new THREE.IcosahedronGeometry(1, 0), 0.2, 7);
  parts.push(prep(canopy2, LEAF_DRY, T(-0.6, 3.85, 0.35, 1.35, 0.45, 1.25)));
  return mergeGeos(parts);
}

function buildFeverTree() {
  const parts = [];
  parts.push(prep(new THREE.CylinderGeometry(0.14, 0.26, 3.6, 6), BARK_PALE, T(0, 1.8, 0, 1)));
  const canopy = jitter(new THREE.IcosahedronGeometry(1, 0), 0.16, 11);
  parts.push(prep(canopy, 0x93a84e, T(0, 4.2, 0, 1.7, 0.9, 1.7)));
  return mergeGeos(parts);
}

function buildBaobab() {
  const parts = [];
  parts.push(prep(jitter(new THREE.CylinderGeometry(0.85, 1.45, 4.4, 8), 0.12, 5), BARK_BAOBAB, T(0, 2.2, 0, 1)));
  // Bare branches like roots reaching up
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    parts.push(prep(new THREE.CylinderGeometry(0.06, 0.16, 1.7, 4),
      BARK_BAOBAB, T(Math.cos(a) * 0.7, 5.0, Math.sin(a) * 0.7, 1, 1, 1, Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7)));
  }
  return mergeGeos(parts);
}

function buildBamboo() {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    const r = 0.25 + (i % 3) * 0.12;
    const h = 3.2 + (i % 4) * 0.7;
    parts.push(prep(new THREE.CylinderGeometry(0.055, 0.075, h, 5),
      0x7d8f4a, T(Math.cos(a) * r, h / 2, Math.sin(a) * r, 1, 1, 1, Math.cos(a) * 0.06, 0, Math.sin(a) * 0.06)));
  }
  return mergeGeos(parts);
}

function buildThornBush() {
  const parts = [];
  const body = jitter(new THREE.IcosahedronGeometry(0.85, 0), 0.3, 13);
  parts.push(prep(body, 0x7c7040, T(0, 0.7, 0, 1.2, 0.75, 1.2)));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    parts.push(prep(new THREE.ConeGeometry(0.05, 0.5, 4), 0x8d7f4c,
      T(Math.cos(a) * 0.7, 1.0, Math.sin(a) * 0.7, 1, 1, 1, Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9)));
  }
  return mergeGeos(parts);
}

function buildRock() {
  return prep(jitter(new THREE.IcosahedronGeometry(1, 0), 0.32, 17), ROCK_C, T(0, 0.72, 0, 1, 0.82, 1));
}

function buildBoulderStack() {
  const parts = [];
  parts.push(prep(jitter(new THREE.IcosahedronGeometry(1, 0), 0.3, 19), ROCK_C, T(0, 0.9, 0, 1.5, 1.05, 1.4)));
  parts.push(prep(jitter(new THREE.IcosahedronGeometry(1, 0), 0.28, 23), 0x6f665d, T(0.35, 2.35, -0.2, 0.95, 0.85, 0.95)));
  parts.push(prep(jitter(new THREE.IcosahedronGeometry(1, 0), 0.26, 29), 0x83786c, T(-0.2, 3.3, 0.25, 0.6, 0.55, 0.6)));
  return mergeGeos(parts);
}

function buildArch() {
  const parts = [];
  parts.push(prep(new THREE.BoxGeometry(0.7, 3.0, 1.1), 0xa8724c, T(-1.3, 1.5, 0, 1)));
  parts.push(prep(new THREE.BoxGeometry(0.7, 3.0, 1.1), 0xa8724c, T(1.3, 1.5, 0, 1)));
  parts.push(prep(new THREE.BoxGeometry(3.3, 0.65, 1.05), 0xb37c53, T(0, 3.2, 0, 1)));
  return mergeGeos(parts);
}

function buildCaveMouth() {
  const parts = [];
  parts.push(prep(jitter(new THREE.IcosahedronGeometry(1, 0), 0.25, 31), 0x6d6259, T(0, 1.3, 0, 2.5, 1.5, 1.9)));
  parts.push(prep(new THREE.SphereGeometry(0.95, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0x14100c, T(0, 0.35, 1.35, 1.1, 1.25, 0.7)));
  return mergeGeos(parts);
}

function buildTermiteMound() {
  const parts = [];
  parts.push(prep(jitter(new THREE.ConeGeometry(0.75, 3.1, 7), 0.13, 37), 0xa8703f, T(0, 1.55, 0, 1)));
  parts.push(prep(new THREE.ConeGeometry(0.3, 1.2, 6), 0x9c6737, T(0.55, 0.6, 0.3, 1)));
  return mergeGeos(parts);
}

function buildDeadwood() {
  const parts = [];
  parts.push(prep(new THREE.CylinderGeometry(0.22, 0.3, 3.6, 6), DEAD, T(0, 0.3, 0, 1, 1, 1, 0, 0, Math.PI / 2)));
  parts.push(prep(new THREE.CylinderGeometry(0.1, 0.14, 1.1, 5), DEAD, T(0.7, 0.55, 0.4, 1, 1, 1, 0.5, 0, 1.1)));
  return mergeGeos(parts);
}

function buildBurntStump() {
  const parts = [];
  parts.push(prep(new THREE.CylinderGeometry(0.16, 0.32, 1.5, 6), 0x2b2420, T(0, 0.75, 0, 1)));
  parts.push(prep(new THREE.CylinderGeometry(0.06, 0.11, 0.9, 4), 0x231d1a, T(0.2, 1.5, 0.05, 1, 1, 1, 0, 0, -0.5)));
  return mergeGeos(parts);
}

function buildReedCluster() {
  const parts = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.7;
    const r = 0.18 + (i % 3) * 0.16;
    const h = 1.4 + (i % 4) * 0.35;
    parts.push(prep(new THREE.CylinderGeometry(0.025, 0.045, h, 4), 0x7d8a48,
      T(Math.cos(a) * r, h / 2, Math.sin(a) * r, 1, 1, 1, Math.cos(a) * 0.18, 0, Math.sin(a) * 0.18)));
  }
  return mergeGeos(parts);
}

function buildGrassTuft() {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    parts.push(prep(new THREE.ConeGeometry(0.09, 0.85, 3), 0x9a8a45,
      T(Math.cos(a) * 0.11, 0.42, Math.sin(a) * 0.11, 1, 1, 1, Math.cos(a) * 0.26, 0, Math.sin(a) * 0.26)));
  }
  return mergeGeos(parts);
}

function buildTallGrass() {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    parts.push(prep(new THREE.ConeGeometry(0.11, 1.9, 3), 0xa8913f,
      T(Math.cos(a) * 0.16, 0.95, Math.sin(a) * 0.16, 1, 1, 1, Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2)));
  }
  return mergeGeos(parts);
}

function buildStone() {
  return prep(jitter(new THREE.IcosahedronGeometry(1, 0), 0.3, 41), 0x8b8073, T(0, 0.22, 0, 0.55, 0.34, 0.5));
}

function buildBones() {
  const parts = [];
  parts.push(prep(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 4), 0xcfc4a8, T(0, 0.08, 0, 1, 1, 1, 0, 0.3, Math.PI / 2)));
  parts.push(prep(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 4), 0xc4b89c, T(0.15, 0.08, 0.3, 1, 1, 1, 0, 1.1, Math.PI / 2)));
  return mergeGeos(parts);
}

/** archetype id -> builder + how many fit on one hex at density 1. */
const ARCHETYPES = {
  acacia:   { build: buildAcacia,       per: 2.2, cap: 700,  scale: [0.75, 1.25], shadow: true },
  fever:    { build: buildFeverTree,    per: 2.4, cap: 500,  scale: [0.8, 1.2],  shadow: true },
  baobab:   { build: buildBaobab,       per: 0.7, cap: 140,  scale: [0.9, 1.3],  shadow: true },
  bamboo:   { build: buildBamboo,       per: 3.0, cap: 600,  scale: [0.8, 1.15], shadow: true },
  thorn:    { build: buildThornBush,    per: 3.4, cap: 800,  scale: [0.7, 1.3],  shadow: true },
  rocks:    { build: buildRock,         per: 2.8, cap: 900,  scale: [0.6, 1.6],  shadow: true },
  boulders: { build: buildBoulderStack, per: 1.2, cap: 320,  scale: [0.8, 1.4],  shadow: true },
  arches:   { build: buildArch,         per: 0.8, cap: 200,  scale: [0.9, 1.5],  shadow: true },
  caves:    { build: buildCaveMouth,    per: 0.9, cap: 220,  scale: [0.9, 1.4],  shadow: true },
  termite:  { build: buildTermiteMound, per: 2.6, cap: 600,  scale: [0.7, 1.5],  shadow: true },
  deadwood: { build: buildDeadwood,     per: 2.4, cap: 600,  scale: [0.8, 1.3],  shadow: true },
  burnt:    { build: buildBurntStump,   per: 3.0, cap: 700,  scale: [0.7, 1.3],  shadow: true },
  reeds:    { build: buildReedCluster,  per: 3.6, cap: 800,  scale: [0.8, 1.4],  shadow: false },
  grass:    { build: buildGrassTuft,    per: 4.5, cap: 1800, scale: [0.7, 1.5],  shadow: false },
  tallgrass:{ build: buildTallGrass,    per: 5.0, cap: 1800, scale: [0.8, 1.4],  shadow: false },
  stones:   { build: buildStone,        per: 3.2, cap: 900,  scale: [0.7, 1.7],  shadow: false },
  cracks:   { build: buildBones,        per: 0.8, cap: 260,  scale: [0.8, 1.4],  shadow: false }
};

/** Terrain `scenery` value -> archetypes actually placed there. */
const SCENERY_MIX = {
  none:     [],
  grass:    [['grass', 1.0], ['acacia', 0.16], ['thorn', 0.2]],
  tallgrass:[['tallgrass', 1.0], ['thorn', 0.15]],
  acacia:   [['acacia', 1.0], ['grass', 0.5], ['thorn', 0.3]],
  fever:    [['fever', 1.0], ['grass', 0.4], ['reeds', 0.2]],
  baobab:   [['baobab', 1.0], ['grass', 0.55], ['thorn', 0.2]],
  bamboo:   [['bamboo', 1.0], ['grass', 0.3]],
  thorn:    [['thorn', 1.0], ['grass', 0.35], ['deadwood', 0.2]],
  deadwood: [['deadwood', 1.0], ['grass', 0.3], ['thorn', 0.25]],
  rocks:    [['rocks', 1.0], ['stones', 0.7], ['grass', 0.2]],
  boulders: [['boulders', 1.0], ['rocks', 0.6], ['stones', 0.5]],
  arches:   [['arches', 1.0], ['rocks', 0.5], ['stones', 0.5]],
  caves:    [['caves', 1.0], ['rocks', 0.7], ['stones', 0.4]],
  termite:  [['termite', 1.0], ['grass', 0.5]],
  reeds:    [['reeds', 1.0], ['grass', 0.3]],
  stones:   [['stones', 1.0], ['rocks', 0.35], ['cracks', 0.2]],
  cracks:   [['cracks', 1.0], ['stones', 0.5]],
  burnt:    [['burnt', 1.0], ['stones', 0.4], ['cracks', 0.3]]
};

// ------------------------------------------------------------
// Scenery manager
// ------------------------------------------------------------

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

export class Scenery {
  constructor(scene, world, quality) {
    this.scene = scene;
    this.world = world;
    this.quality = quality;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.meshes = {};
    this._centerKey = null;
    this._radius = 0;

    for (const [id, def] of Object.entries(ARCHETYPES)) {
      const geo = def.build();
      const cap = Math.max(24, Math.round(def.cap * (quality.sceneryDensity || 1)));
      const mesh = new THREE.InstancedMesh(geo, this.material, cap);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = def.shadow && quality.shadows;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.userData.cap = cap;
      // Per-instance tint so a thousand identical trees do not look identical.
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      this.group.add(mesh);
      this.meshes[id] = mesh;
    }
  }

  setQuality(quality) {
    this.quality = quality;
    for (const [id, def] of Object.entries(ARCHETYPES)) {
      const mesh = this.meshes[id];
      if (mesh) mesh.castShadow = def.shadow && quality.shadows;
    }
    this._centerKey = null; // force a repopulate
  }

  update(centerQ, centerR, radius) {
    const ck = Hex.key(centerQ, centerR);
    if (ck === this._centerKey && radius === this._radius) return;
    this._centerKey = ck;
    this._radius = radius;
    this.populate(centerQ, centerR, radius);
  }

  populate(centerQ, centerR, radius) {
    const counts = {};
    for (const id of Object.keys(this.meshes)) counts[id] = 0;

    const density = this.quality.sceneryDensity || 1;
    const cells = Hex.spiral(centerQ, centerR, radius);
    const size = Hex.HEX_SIZE;

    for (let i = 0; i < cells.length; i++) {
      const cell = this.world.get(cells[i].q, cells[i].r);
      const mix = SCENERY_MIX[cell.props.scenery] || SCENERY_MIX.grass;
      if (!mix.length) continue;

      // Distant hexes get fewer props — a cheap, invisible LOD.
      const dist = Hex.distance(cell.q, cell.r, centerQ, centerR);
      const falloff = dist > radius * 0.62 ? 0.45 : 1.0;
      let seed = (cell.q * 73856093) ^ (cell.r * 19349663);

      for (const [archId, weight] of mix) {
        const def = ARCHETYPES[archId];
        const mesh = this.meshes[archId];
        if (!mesh) continue;
        const want = def.per * weight * (cell.props.density || 0.6) * density * falloff;
        const n = Math.floor(want) + (rand(seed++) < (want % 1) ? 1 : 0);

        for (let k = 0; k < n; k++) {
          if (counts[archId] >= mesh.userData.cap) break;
          // Rejection-sample inside the hex so nothing straddles a tile edge.
          let ox = 0, oz = 0;
          for (let attempt = 0; attempt < 6; attempt++) {
            ox = (rand(seed++) - 0.5) * 2 * size * 0.82;
            oz = (rand(seed++) - 0.5) * 2 * size * 0.82;
            if (Math.abs(oz) < size * 0.84 - Math.abs(ox) * 0.5) break;
          }
          const sc = def.scale[0] + rand(seed++) * (def.scale[1] - def.scale[0]);
          _p.set(cell.worldX + ox, cell.height - 0.06, cell.worldZ + oz);
          _q.setFromAxisAngle(UP, rand(seed++) * Math.PI * 2);
          _s.set(sc, sc * (0.85 + rand(seed++) * 0.35), sc);
          _m.compose(_p, _q, _s);
          mesh.setMatrixAt(counts[archId], _m);

          const tint = 0.82 + rand(seed++) * 0.32;
          _c.setRGB(tint, tint * (0.96 + rand(seed++) * 0.08), tint * 0.94);
          mesh.instanceColor.setXYZ(counts[archId], _c.r, _c.g, _c.b);
          counts[archId]++;
        }
      }
    }

    for (const [id, mesh] of Object.entries(this.meshes)) {
      mesh.count = counts[id];
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    }
  }

  setWindPhase() { /* reserved for a future vertex-shader sway */ }

  dispose() {
    for (const mesh of Object.values(this.meshes)) {
      mesh.geometry.dispose();
      this.group.remove(mesh);
    }
    this.material.dispose();
    this.scene.remove(this.group);
  }
}

const UP = new THREE.Vector3(0, 1, 0);

/** Deterministic 0..1 from an integer seed. */
function rand(seed) {
  let h = (seed | 0) * 1103515245 + 12345;
  h = (h ^ (h >>> 15)) >>> 0;
  return (h % 100000) / 100000;
}

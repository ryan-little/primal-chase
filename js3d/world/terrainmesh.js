// ============================================================
// TERRAINMESH.JS — the hex board
// Visible hexes are merged into one vertex-coloured mesh that is
// rebuilt only when the visible set changes. Water gets its own
// translucent surface. Highlight caps float just above the ground.
// ============================================================

import * as THREE from '../../js/vendor/three.module.min.js';
import * as Hex from './hex.js';

const TOP_INSET = 0.975;
const SKIRT_MIN = 1.4;

/** Flat-top corner offsets in XZ, unit radius. */
const CORNERS = [];
for (let i = 0; i < 6; i++) {
  const a = (Math.PI / 180) * (60 * i);
  CORNERS.push({ x: Math.cos(a), z: Math.sin(a) });
}

export class TerrainMesh {
  /**
   * @param {THREE.Scene} scene
   * @param {import('./worldgen.js').World} world
   */
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.visibleKeys = new Set();
    this._centerKey = null;
    this._radius = 0;

    this.geometry = new THREE.BufferGeometry();
    this.material = new THREE.MeshLambertMaterial({
      vertexColors: true,
      flatShading: true
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    // Water surface, drawn as a separate translucent pass.
    this.waterGeometry = new THREE.BufferGeometry();
    this.waterMaterial = new THREE.MeshStandardMaterial({
      color: 0x2f5d6b,
      transparent: true,
      opacity: 0.82,
      roughness: 0.14,
      metalness: 0.0,
      flatShading: false
    });
    this.waterMesh = new THREE.Mesh(this.waterGeometry, this.waterMaterial);
    this.waterMesh.frustumCulled = false;
    this.waterMesh.renderOrder = 2;
    scene.add(this.waterMesh);

    this._tmpColor = new THREE.Color();
  }

  /** Rebuild if the player moved to a new hex or the draw radius changed. */
  update(centerQ, centerR, radius) {
    const ck = Hex.key(centerQ, centerR);
    if (ck === this._centerKey && radius === this._radius) return false;
    this._centerKey = ck;
    this._radius = radius;
    this.rebuild(centerQ, centerR, radius);
    return true;
  }

  rebuild(centerQ, centerR, radius) {
    const world = this.world;
    const size = Hex.HEX_SIZE;
    const cells = Hex.spiral(centerQ, centerR, radius);

    this.visibleKeys = new Set();
    const positions = [];
    const colors = [];
    const waterPositions = [];

    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      const cell = world.get(c.q, c.r);
      this.visibleKeys.add(cell.key);

      const cx = cell.worldX;
      const cz = cell.worldZ;
      const h = cell.height;

      // Per-hex colour: terrain base, nudged by a stable per-hex variant and by
      // elevation so ridges read lighter and hollows read darker.
      this._tmpColor.setHex(cell.props.color);
      const v = (cell.variant - 0.5) * 0.13;
      const lift = cell.elevation * 0.09;
      this._tmpColor.r = clamp01(this._tmpColor.r + v + lift);
      this._tmpColor.g = clamp01(this._tmpColor.g + v * 0.95 + lift);
      this._tmpColor.b = clamp01(this._tmpColor.b + v * 0.8 + lift * 0.7);
      const cr = this._tmpColor.r, cg = this._tmpColor.g, cb = this._tmpColor.b;

      // --- top cap (fan of 6 triangles) ---
      const corner = [];
      for (let k = 0; k < 6; k++) {
        corner.push({ x: cx + CORNERS[k].x * size * TOP_INSET, z: cz + CORNERS[k].z * size * TOP_INSET });
      }
      for (let k = 0; k < 6; k++) {
        const a = corner[k];
        const b = corner[(k + 1) % 6];
        positions.push(cx, h, cz, b.x, h, b.z, a.x, h, a.z);
        colors.push(cr, cg, cb, cr, cg, cb, cr, cg, cb);
      }

      // --- skirt: down to just below the lowest neighbour so no seams show through ---
      let lowest = h;
      const ns = Hex.neighbors(c.q, c.r);
      for (let k = 0; k < 6; k++) {
        const nh = world.get(ns[k].q, ns[k].r).height;
        if (nh < lowest) lowest = nh;
      }
      const base = Math.min(h - SKIRT_MIN, lowest - 0.45);
      // Sides are darker — a cheap ambient-occlusion read at the tile edges.
      const sr = cr * 0.70, sg = cg * 0.66, sb = cb * 0.64;
      for (let k = 0; k < 6; k++) {
        const a = corner[k];
        const b = corner[(k + 1) % 6];
        positions.push(a.x, h, a.z, b.x, h, b.z, b.x, base, b.z);
        positions.push(a.x, h, a.z, b.x, base, b.z, a.x, base, a.z);
        for (let n = 0; n < 6; n++) colors.push(sr, sg, sb);
      }

      // --- water surface for water hexes ---
      if (cell.water) {
        const wy = h + 0.42;
        for (let k = 0; k < 6; k++) {
          const a = corner[k];
          const b = corner[(k + 1) % 6];
          waterPositions.push(cx, wy, cz, b.x, wy, b.z, a.x, wy, a.z);
        }
      }
    }

    this.geometry.dispose();
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.geometry.computeVertexNormals();
    this.mesh.geometry = this.geometry;

    this.waterGeometry.dispose();
    this.waterGeometry = new THREE.BufferGeometry();
    if (waterPositions.length) {
      this.waterGeometry.setAttribute('position', new THREE.Float32BufferAttribute(waterPositions, 3));
      this.waterGeometry.computeVertexNormals();
    }
    this.waterMesh.geometry = this.waterGeometry;
    this.waterMesh.visible = waterPositions.length > 0;
  }

  /** Surface height a creature should stand at on a hex. */
  surfaceY(q, r) {
    const cell = this.world.get(q, r);
    return cell.height + (cell.water ? 0.42 : 0);
  }

  /** Raycast to a hex. Returns {q, r} or null. */
  pick(raycaster) {
    const hits = raycaster.intersectObject(this.mesh, false);
    if (!hits.length) return null;
    const p = hits[0].point;
    return Hex.worldToAxial(p.x, p.z);
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.scene.remove(this.waterMesh);
    this.geometry.dispose();
    this.waterGeometry.dispose();
    this.material.dispose();
    this.waterMaterial.dispose();
  }
}

// ------------------------------------------------------------
// Highlight overlay — reachable hexes, hover, chosen path
// ------------------------------------------------------------

const HL_COLORS = {
  reach:  { color: 0xf0c48a, opacity: 0.62 },
  hover:  { color: 0xfff0cf, opacity: 0.95 },
  path:   { color: 0xf5a94e, opacity: 0.80 },
  target: { color: 0xfff4dd, opacity: 1.00 },
  danger: { color: 0xe0563f, opacity: 0.85 },
  water:  { color: 0x9fdcea, opacity: 0.80 },
  hunter: { color: 0xc44536, opacity: 0.70 }
};

/** Build a flat hex band lying in the XZ plane. */
function hexBand(outer, inner) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const c = CORNERS[i];
    const x = c.x * Hex.HEX_SIZE * outer;
    const z = c.z * Hex.HEX_SIZE * outer;
    if (i === 0) shape.moveTo(x, z); else shape.lineTo(x, z);
  }
  shape.closePath();
  if (inner > 0) {
    const hole = new THREE.Path();
    for (let i = 0; i < 6; i++) {
      const c = CORNERS[i];
      const x = c.x * Hex.HEX_SIZE * inner;
      const z = c.z * Hex.HEX_SIZE * inner;
      if (i === 0) hole.moveTo(x, z); else hole.lineTo(x, z);
    }
    hole.closePath();
    shape.holes.push(hole);
  }
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(Math.PI / 2);
  return geo;
}

export class HighlightLayer {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.group = new THREE.Group();
    scene.add(this.group);

    // A bright outline reads over busy ground where a translucent wash does not.
    this.capGeometry = hexBand(0.94, 0.80);
    this.fillGeometry = hexBand(0.86, 0);

    this._pool = [];
    this._used = 0;
    this._materials = {};
    this._fillMaterials = {};
    for (const name of Object.keys(HL_COLORS)) {
      this._materials[name] = new THREE.MeshBasicMaterial({
        color: HL_COLORS[name].color,
        transparent: true,
        opacity: HL_COLORS[name].opacity,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false
      });
      this._fillMaterials[name] = new THREE.MeshBasicMaterial({
        color: HL_COLORS[name].color,
        transparent: true,
        opacity: HL_COLORS[name].opacity * 0.22,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false
      });
    }
    this._pulse = 0;
  }

  begin() { this._used = 0; }

  /** Place one highlight on a hex: an outline ring plus a faint fill. */
  add(q, r, kind = 'reach') {
    const cell = this.world.get(q, r);
    const y = cell.height + (cell.water ? 0.62 : 0.18);

    const ring = this._take();
    ring.geometry = this.capGeometry;
    ring.position.set(cell.worldX, y, cell.worldZ);
    ring.material = this._materials[kind] || this._materials.reach;
    ring.renderOrder = 6;

    const fill = this._take();
    fill.geometry = this.fillGeometry;
    fill.position.set(cell.worldX, y - 0.02, cell.worldZ);
    fill.material = this._fillMaterials[kind] || this._fillMaterials.reach;
    fill.renderOrder = 5;

    return ring;
  }

  _take() {
    let mesh = this._pool[this._used];
    if (!mesh) {
      mesh = new THREE.Mesh(this.capGeometry, this._materials.reach);
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this._pool.push(mesh);
    }
    mesh.visible = true;
    this._used++;
    return mesh;
  }

  end() {
    for (let i = this._used; i < this._pool.length; i++) this._pool[i].visible = false;
  }

  clear() { this.begin(); this.end(); }

  update(dt) {
    this._pulse += dt * 2.1;
    const p = 0.72 + Math.sin(this._pulse) * 0.28;
    this._materials.target.opacity = HL_COLORS.target.opacity * p;
    this._fillMaterials.target.opacity = HL_COLORS.target.opacity * 0.24 * p;
    this._materials.hover.opacity = HL_COLORS.hover.opacity * (0.8 + p * 0.2);
  }

  setVisible(v) { this.group.visible = v; }
}

function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

// ============================================================
// MARKERS.JS — beacons over landmarks and prints along your trail
// Both are pooled sprites, rebuilt only when the board changes.
// ============================================================

import * as THREE from '../../js/vendor/three.module.min.js';
import * as Hex from '../world/hex.js';
import { starFlare, softDot } from '../render/textures.js';

export class Markers {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;

    this.group = new THREE.Group();
    scene.add(this.group);

    this.beaconMaterial = new THREE.SpriteMaterial({
      map: starFlare(),
      color: 0xffd79a,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false
    });
    this.trailMaterial = new THREE.SpriteMaterial({
      map: softDot(0.3),
      color: 0x6a4c30,
      transparent: true,
      opacity: 0.42,
      depthWrite: false
    });

    this._beacons = [];
    this._trail = [];
    this._beaconKey = null;
    this._trailLength = -1;
    this._pulse = 0;
  }

  /** Show a beacon over every landmark within the draw radius. */
  updateLandmarks(centerQ, centerR, radius) {
    const key = Hex.key(centerQ, centerR) + ':' + radius;
    if (key === this._beaconKey) return;
    this._beaconKey = key;

    const cells = Hex.spiral(centerQ, centerR, radius);
    let used = 0;
    for (const c of cells) {
      const cell = this.world.get(c.q, c.r);
      if (!cell.landmark) continue;
      let sprite = this._beacons[used];
      if (!sprite) {
        sprite = new THREE.Sprite(this.beaconMaterial);
        sprite.scale.set(3.4, 3.4, 1);
        this.group.add(sprite);
        this._beacons.push(sprite);
      }
      sprite.position.set(cell.worldX, cell.height + 5.6, cell.worldZ);
      sprite.visible = true;
      used++;
    }
    for (let i = used; i < this._beacons.length; i++) this._beacons[i].visible = false;
    this._beaconCount = used;
  }

  /** Lay a faint print on each hex the player has crossed. */
  updateTrail(trail, enabled) {
    if (!enabled) {
      for (const s of this._trail) s.visible = false;
      this._trailLength = -1;
      return;
    }
    if (trail.length === this._trailLength) return;
    this._trailLength = trail.length;

    // Only the recent past is worth drawing; older prints have washed out.
    const start = Math.max(0, trail.length - 40);
    let used = 0;
    for (let i = start; i < trail.length - 1; i++) {
      const cell = this.world.get(trail[i].q, trail[i].r);
      let sprite = this._trail[used];
      if (!sprite) {
        sprite = new THREE.Sprite(this.trailMaterial.clone());
        sprite.scale.set(2.4, 2.4, 1);
        this.group.add(sprite);
        this._trail.push(sprite);
      }
      sprite.position.set(cell.worldX, cell.height + 0.35, cell.worldZ);
      // Fade with age so the trail reads as a direction, not a wall.
      const age = (i - start) / Math.max(1, trail.length - 1 - start);
      sprite.material.opacity = 0.1 + age * 0.34;
      sprite.visible = true;
      used++;
    }
    for (let i = used; i < this._trail.length; i++) this._trail[i].visible = false;
  }

  update(dt) {
    this._pulse += dt * 1.7;
    const p = 0.68 + Math.sin(this._pulse) * 0.3;
    this.beaconMaterial.opacity = 0.3 + p * 0.24;
    for (let i = 0; i < (this._beaconCount || 0); i++) {
      const s = this._beacons[i];
      s.position.y += Math.sin(this._pulse + i) * 0.006;
      const sc = 3.1 + p * 0.9;
      s.scale.set(sc, sc, 1);
    }
  }

  setVisible(v) { this.group.visible = v; }

  /** Drop everything — called on a new run. */
  reset() {
    this._beaconKey = null;
    this._trailLength = -1;
    for (const s of this._trail) s.visible = false;
  }
}

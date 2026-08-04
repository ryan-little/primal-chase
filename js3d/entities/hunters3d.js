// ============================================================
// HUNTERS3D.JS — the band that never stops
// A handful of low-poly runners, a dust column by day, a fire at
// night. They are the whole point: the player must be able to look
// back over their shoulder and see how much time is left.
// ============================================================

import * as THREE from '../../js/vendor/three.module.min.js';
import { dustPuff, softDot } from '../render/textures.js';

const SKIN = 0x6b4a30;
const CLOTH = 0x8a6b45;
const HAIR = 0x1c1410;
const SPEAR = 0x6a5436;

function box(w, h, d, mat) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

class Hunter {
  constructor(materials, cast) {
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);

    const torso = box(0.52, 0.78, 0.3, materials.skin);
    torso.position.y = 1.52;
    torso.castShadow = cast;
    this.body.add(torso);

    const hips = box(0.5, 0.34, 0.3, materials.cloth);
    hips.position.y = 1.05;
    this.body.add(hips);

    this.head = new THREE.Group();
    this.head.position.y = 2.06;
    this.body.add(this.head);
    const skull = box(0.34, 0.38, 0.32, materials.skin);
    skull.castShadow = cast;
    this.head.add(skull);
    const hair = box(0.37, 0.16, 0.35, materials.hair);
    hair.position.y = 0.2;
    this.head.add(hair);

    this.legs = [];
    for (const sx of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(sx * 0.15, 1.02, 0);
      this.body.add(hip);
      const upper = box(0.2, 0.55, 0.22, materials.skin);
      upper.position.y = -0.28;
      upper.castShadow = cast;
      hip.add(upper);
      const knee = new THREE.Group();
      knee.position.y = -0.55;
      hip.add(knee);
      const lower = box(0.17, 0.5, 0.19, materials.skin);
      lower.position.y = -0.25;
      knee.add(lower);
      this.legs.push({ hip, knee, side: sx });
    }

    this.arms = [];
    for (const sx of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(sx * 0.33, 1.83, 0);
      this.body.add(shoulder);
      const upper = box(0.16, 0.48, 0.16, materials.skin);
      upper.position.y = -0.24;
      shoulder.add(upper);
      const elbow = new THREE.Group();
      elbow.position.y = -0.48;
      shoulder.add(elbow);
      const lower = box(0.14, 0.42, 0.14, materials.skin);
      lower.position.y = -0.21;
      elbow.add(lower);
      this.arms.push({ shoulder, elbow, side: sx });
    }

    // Spear carried in the right hand, angled back along the run.
    this.spear = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 2.4, 5), materials.spear);
    shaft.castShadow = cast;
    this.spear.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.32, 4), materials.hair);
    tip.position.y = 1.32;
    this.spear.add(tip);
    this.spear.position.set(0.33, 1.5, 0.05);
    this.spear.rotation.x = 0.22;
    this.spear.rotation.z = -0.14;
    this.body.add(this.spear);

    this.phase = Math.random() * Math.PI * 2;
    this.offset = new THREE.Vector3();
    this.searchAngle = Math.random() * Math.PI * 2;
  }

  update(dt, mode, elapsed) {
    const running = mode === 'pursuit' || mode === 'tracking';
    const speed = mode === 'pursuit' ? 9.0 : (mode === 'tracking' ? 4.2 : 0);
    this.phase += speed * dt;

    for (const leg of this.legs) {
      const p = this.phase + (leg.side > 0 ? Math.PI : 0);
      if (running) {
        leg.hip.rotation.x = Math.sin(p) * (mode === 'pursuit' ? 0.85 : 0.45);
        leg.knee.rotation.x = -Math.max(0, -Math.cos(p)) * (mode === 'pursuit' ? 1.15 : 0.6);
      } else {
        leg.hip.rotation.x *= 0.9;
        leg.knee.rotation.x *= 0.9;
      }
    }
    for (const arm of this.arms) {
      const p = this.phase + (arm.side > 0 ? 0 : Math.PI);
      if (arm.side > 0) {
        // Spear arm stays up regardless of gait.
        arm.shoulder.rotation.x = -0.55;
        arm.elbow.rotation.x = -0.9;
      } else if (running) {
        arm.shoulder.rotation.x = Math.sin(p) * 0.75;
        arm.elbow.rotation.x = -0.5 - Math.max(0, Math.sin(p)) * 0.5;
      } else {
        arm.shoulder.rotation.x *= 0.9;
        arm.elbow.rotation.x += (-0.2 - arm.elbow.rotation.x) * 0.1;
      }
    }

    this.body.position.y = running ? Math.abs(Math.sin(this.phase)) * (mode === 'pursuit' ? 0.11 : 0.05) : 0;
    this.body.rotation.x = mode === 'pursuit' ? 0.1 : 0;

    if (mode === 'tracking') {
      // Casting about for the trail: heads sweeping, bodies drifting in arcs.
      this.searchAngle += dt * 0.8;
      this.head.rotation.y = Math.sin(elapsed * 1.4 + this.phase) * 0.8;
      this.head.rotation.x = 0.45;
      this.root.rotation.y = Math.sin(this.searchAngle) * 1.5;
    } else if (mode === 'camp') {
      this.head.rotation.y = Math.sin(elapsed * 0.5 + this.phase) * 0.25;
      this.head.rotation.x = 0;
      this.root.rotation.y = 0;
    } else {
      this.head.rotation.y *= 0.9;
      this.head.rotation.x *= 0.9;
      this.root.rotation.y = 0;
    }
  }
}

export class HunterBand {
  constructor(scene, quality) {
    this.scene = scene;
    this.quality = quality;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.materials = {
      skin: new THREE.MeshLambertMaterial({ color: SKIN }),
      cloth: new THREE.MeshLambertMaterial({ color: CLOTH }),
      hair: new THREE.MeshLambertMaterial({ color: HAIR }),
      spear: new THREE.MeshLambertMaterial({ color: SPEAR })
    };

    this.members = [];
    const n = window.CONFIG3D.hunters.bandSize;
    for (let i = 0; i < n; i++) {
      const h = new Hunter(this.materials, quality.shadows);
      // Loose single-file wedge — the shape a real persistence hunt takes.
      const row = Math.floor(i / 2);
      h.offset.set(((i % 2) * 2 - 1) * (1.4 + row * 0.5), 0, -row * 2.6 - (i % 2) * 0.8);
      h.root.position.copy(h.offset);
      this.group.add(h.root);
      this.members.push(h);
    }

    this.mode = 'pursuit';
    this.position = new THREE.Vector3();
    this._target = new THREE.Vector3();
    this._facing = 0;

    this._buildDust();
    this._buildFire(quality);

    this.visible = true;
  }

  _buildDust() {
    const count = 44;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const seedArr = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 5;
      pos[i * 3 + 1] = Math.random() * 5;
      pos[i * 3 + 2] = -Math.random() * 7;
      seedArr[i] = Math.random();
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seedArr, 1));

    this.dustMat = new THREE.PointsMaterial({
      color: 0xc9a878,
      size: 5.2,
      map: dustPuff(),
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      sizeAttenuation: true,
      blending: THREE.NormalBlending
    });
    this.dust = new THREE.Points(geo, this.dustMat);
    this.dust.frustumCulled = false;
    this.group.add(this.dust);
    this._dustBase = pos.slice();
  }

  _buildFire(quality) {
    this.fireGroup = new THREE.Group();
    this.fireGroup.position.set(0, 0, -1.4);

    const logs = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI;
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.1, 4), this.materials.spear);
      log.position.set(Math.cos(a) * 0.15, 0.1, Math.sin(a) * 0.15);
      log.rotation.set(Math.PI / 2 - 0.3, a, 0);
      logs.add(log);
    }
    this.fireGroup.add(logs);

    this.flameMat = new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.9, fog: false });
    this.flame = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.3, 6), this.flameMat);
    this.flame.position.y = 0.62;
    this.fireGroup.add(this.flame);

    this.fireLight = new THREE.PointLight(0xff8c3a, 0, 34, 1.8);
    this.fireLight.position.set(0, 1.2, 0);
    this.fireGroup.add(this.fireLight);

    // Smoke column, visible from a long way off — often the first sign of them.
    const smokeCount = 26;
    const sgeo = new THREE.BufferGeometry();
    const spos = new Float32Array(smokeCount * 3);
    for (let i = 0; i < smokeCount; i++) {
      spos[i * 3] = (Math.random() - 0.5) * 1.2;
      spos[i * 3 + 1] = 1 + (i / smokeCount) * 14;
      spos[i * 3 + 2] = (Math.random() - 0.5) * 1.2;
    }
    sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
    this.smokeMat = new THREE.PointsMaterial({
      color: 0x9a8e80, size: 3.6, map: softDot(0.1), transparent: true, opacity: 0.28, depthWrite: false
    });
    this.smoke = new THREE.Points(sgeo, this.smokeMat);
    this.smoke.frustumCulled = false;
    this.fireGroup.add(this.smoke);
    this._smokeBase = spos.slice();

    this.group.add(this.fireGroup);
    this.fireGroup.visible = false;
  }

  /** 'pursuit' | 'tracking' | 'camp' */
  setMode(mode) {
    this.mode = mode;
    const camping = mode === 'camp';
    this.fireGroup.visible = camping;
    this.fireLight.intensity = camping ? 2.6 : 0;
    this.dust.visible = mode === 'pursuit' || mode === 'tracking';
    if (camping) {
      // Sit them in a ring around the fire.
      this.members.forEach((h, i) => {
        const a = (i / this.members.length) * Math.PI * 2;
        h.root.position.set(Math.cos(a) * 2.1, 0, Math.sin(a) * 2.1 - 1.4);
        h.root.rotation.y = -a + Math.PI / 2;
      });
    } else {
      this.members.forEach(h => {
        h.root.position.copy(h.offset);
        h.root.rotation.y = 0;
      });
    }
  }

  /** Snap to a world position without interpolation. */
  placeAt(x, y, z) {
    this.position.set(x, y, z);
    this._target.set(x, y, z);
    this.group.position.set(x, y, z);
  }

  /** Set where the band should walk to; `update` eases them there. */
  moveTo(x, y, z) { this._target.set(x, y, z); }

  /** Yaw the whole band, so they always face the way they are chasing. */
  setFacing(yaw) { this._facing = yaw; }

  update(dt, elapsed, ease = 3.4) {
    const k = Math.min(1, ease * dt);
    this.position.lerp(this._target, k);
    this.group.position.copy(this.position);

    let d = this._facing - this.group.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.group.rotation.y += d * Math.min(1, dt * 5);

    for (const h of this.members) h.update(dt, this.mode, elapsed);

    if (this.dust.visible) {
      const pos = this.dust.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) + dt * (1.4 + (i % 5) * 0.4);
        let z = pos.getZ(i) - dt * 2.2;
        if (y > 7 || z < -16) {
          y = this._dustBase[i * 3 + 1] * 0.3;
          z = this._dustBase[i * 3 + 2] * 0.2;
        }
        pos.setXYZ(i, this._dustBase[i * 3] + Math.sin(elapsed + i) * 1.2, y, z);
      }
      pos.needsUpdate = true;
    }

    if (this.fireGroup.visible) {
      const flick = 0.82 + Math.sin(elapsed * 13.7) * 0.09 + Math.sin(elapsed * 7.1) * 0.07;
      this.flame.scale.set(flick, 0.85 + flick * 0.35, flick);
      this.flameMat.opacity = 0.75 + flick * 0.22;
      this.fireLight.intensity = 2.2 + flick * 1.5;
      const spos = this.smoke.geometry.getAttribute('position');
      for (let i = 0; i < spos.count; i++) {
        let y = spos.getY(i) + dt * 1.1;
        if (y > 16) y = 1;
        spos.setXYZ(i, this._smokeBase[i * 3] + Math.sin(elapsed * 0.5 + y * 0.3) * (y * 0.14), y, this._smokeBase[i * 3 + 2]);
      }
      spos.needsUpdate = true;
    }
  }

  setQuality(quality) {
    this.quality = quality;
    this.group.traverse(o => { if (o.isMesh) o.castShadow = quality.shadows; });
    this.fireLight.castShadow = false;
  }

  setVisible(v) { this.group.visible = v; }
}

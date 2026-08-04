// ============================================================
// WEATHER.JS — V1's atmosphere system, rebuilt in three dimensions
// Rain, lightning, dust, pollen, insects, fireflies and haze. Every
// system is a single Points cloud that follows the camera inside a
// box, so cost is fixed no matter how far the player has run.
// ============================================================

import * as THREE from '../../js/vendor/three.module.min.js';
import { softDot, dustPuff, rainStreak, loadSprite } from '../render/textures.js';

/** Box the motes live in, centred on the camera target. */
const FIELD = { x: 130, y: 60, z: 130 };

function makeCloud(count, material, spread) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const vel = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * spread.x;
    pos[i * 3 + 1] = Math.random() * spread.y;
    pos[i * 3 + 2] = (Math.random() - 0.5) * spread.z;
    vel[i * 3] = (Math.random() - 0.5);
    vel[i * 3 + 1] = Math.random();
    vel[i * 3 + 2] = (Math.random() - 0.5);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.visible = false;
  points.userData.vel = vel;
  points.userData.spread = spread;
  return points;
}

export class Weather {
  constructor(scene, quality) {
    this.scene = scene;
    this.quality = quality;
    this.group = new THREE.Group();
    scene.add(this.group);

    const density = quality.particles || 1;
    const n = (base) => Math.max(8, Math.round(base * density));

    this.materials = {
      rain: new THREE.PointsMaterial({
        color: 0xbdd4f0, size: 1.5, map: rainStreak(), transparent: true,
        opacity: 0.5, depthWrite: false, sizeAttenuation: true
      }),
      dust: new THREE.PointsMaterial({
        color: 0xd0ab78, size: 2.4, map: dustPuff(), transparent: true,
        opacity: 0.24, depthWrite: false, sizeAttenuation: true
      }),
      pollen: new THREE.PointsMaterial({
        color: 0xe8d79a, size: 0.9, map: softDot(0.2), transparent: true,
        opacity: 0.42, depthWrite: false, sizeAttenuation: true
      }),
      insects: new THREE.PointsMaterial({
        color: 0x6b5a3a, size: 0.55, map: softDot(0.5), transparent: true,
        opacity: 0.5, depthWrite: false, sizeAttenuation: true
      }),
      fireflies: new THREE.PointsMaterial({
        color: 0xd8ff9a, size: 1.5, map: loadSprite('assets/firefly1-04.png'), transparent: true,
        opacity: 0.9, depthWrite: false, sizeAttenuation: true, blending: THREE.AdditiveBlending, fog: false
      }),
      stars: new THREE.PointsMaterial({
        color: 0xffffff, size: 0.6, map: softDot(0.1), transparent: true,
        opacity: 0.0, depthWrite: false, sizeAttenuation: true, blending: THREE.AdditiveBlending, fog: false
      })
    };

    this.rain = makeCloud(n(650), this.materials.rain, { x: 90, y: 62, z: 90 });
    this.dust = makeCloud(n(180), this.materials.dust, FIELD);
    this.pollen = makeCloud(n(150), this.materials.pollen, { x: 90, y: 26, z: 90 });
    this.insects = makeCloud(n(90), this.materials.insects, { x: 60, y: 12, z: 60 });
    this.fireflies = makeCloud(n(70), this.materials.fireflies, { x: 80, y: 16, z: 80 });

    for (const p of [this.rain, this.dust, this.pollen, this.insects, this.fireflies]) this.group.add(p);

    this.condition = null;      // null | 'light' | 'heavy'
    this.phase = 'day';
    this.terrainCat = 'open';
    this.storm = 0;
    this._targetStorm = 0;
    this._lightningIn = 0;
    this._flashTimer = 0;
    this._flashPeak = 0;

    /** main.js can hook this to shake the camera and flash the DOM overlay. */
    this.onLightning = null;
  }

  setQuality(quality) {
    this.quality = quality;
    // Particle counts are baked at construction; scale visibility instead.
    const d = quality.particles || 1;
    this.materials.dust.opacity = 0.24 * d;
    this.materials.pollen.opacity = 0.42 * d;
    this.materials.rain.opacity = 0.5 * Math.max(0.5, d);
  }

  /**
   * Decide what the sky is doing, using V1's rules: signature storms are
   * always heavy, an approaching-storm pressure is light, otherwise it is a
   * per-encounter dice roll that never changes once rolled.
   */
  setCondition(encounter, phase, terrainCat) {
    this.phase = phase;
    this.terrainCat = terrainCat || 'open';
    this.condition = this._conditionFor(encounter);
    this._targetStorm = this.condition === 'heavy' ? 1 : (this.condition === 'light' ? 0.45 : 0);

    const isNight = phase === 'night';
    const W = CONFIG.ui.weather;

    this.rain.visible = !!this.condition;
    this.dust.visible = !this.condition;
    this.pollen.visible = !this.condition && !isNight;
    this.insects.visible = !this.condition;
    this.fireflies.visible = isNight && !this.condition && Math.random() < W.fireflies.chance + 0.25;

    // Terrain drives how much of each mote hangs in the air, as it did in V1.
    const dustMul = W.dust.terrainMultiplier[this.terrainCat] || 1;
    const pollenMul = W.pollen.terrainMultiplier[this.terrainCat] || 1;
    const insectMul = W.insects.terrainMultiplier[this.terrainCat] || 1;
    this.materials.dust.opacity = 0.1 + 0.075 * dustMul * (isNight ? 0.4 : 1);
    this.materials.pollen.opacity = 0.12 + 0.1 * pollenMul;
    this.materials.insects.opacity = 0.18 + 0.13 * insectMul;

    if (this.condition === 'heavy') {
      this._lightningIn = 1.5 + Math.random() * 3;
    } else {
      this._lightningIn = Infinity;
    }
  }

  _conditionFor(encounter) {
    if (!encounter) return null;
    if (encounter.id === 'sig_rainstorm' || encounter.id === 'rare_lightning_fire') return 'heavy';
    if (encounter.pressure && encounter.pressure.id === 'storm_approaching') return 'light';
    if (encounter._weatherRoll === undefined) {
      encounter._weatherRoll = Math.random() < CONFIG.ui.weather.rain.randomChance ? 'light' : null;
    }
    return encounter._weatherRoll;
  }

  update(dt, elapsed, cameraPosition, sky) {
    this.group.position.set(cameraPosition.x, 0, cameraPosition.z);

    this.storm += (this._targetStorm - this.storm) * Math.min(1, dt * 1.6);
    if (sky) sky.setStorm(this.storm);

    if (this.rain.visible) this._fall(this.rain, dt, this.condition === 'heavy' ? 62 : 38);
    if (this.dust.visible) this._drift(this.dust, dt, elapsed, 1.6, 0.5);
    if (this.pollen.visible) this._drift(this.pollen, dt, elapsed, 0.7, 0.35);
    if (this.insects.visible) this._swarm(this.insects, dt, elapsed);
    if (this.fireflies.visible) this._swarm(this.fireflies, dt, elapsed, true);

    // Lightning
    if (isFinite(this._lightningIn)) {
      this._lightningIn -= dt;
      if (this._lightningIn <= 0) {
        const L = CONFIG.ui.weather.lightning;
        this._lightningIn = L.minInterval + Math.random() * (L.maxInterval - L.minInterval);
        const roll = Math.random();
        this._flashPeak = roll < L.strikeChance ? 1.5 : 0.6;
        this._flashTimer = 0.001;
        if (this.onLightning) this.onLightning(this._flashPeak);
      }
    }
    if (this._flashTimer > 0) {
      this._flashTimer += dt;
      // A double-blink reads far more like real lightning than a single fade.
      const t = this._flashTimer;
      let amount = 0;
      if (t < 0.06) amount = this._flashPeak;
      else if (t < 0.12) amount = this._flashPeak * 0.2;
      else if (t < 0.2) amount = this._flashPeak * 0.75;
      else if (t < 0.55) amount = this._flashPeak * (1 - (t - 0.2) / 0.35) * 0.5;
      else { amount = 0; this._flashTimer = 0; }
      if (sky) sky.flash(amount);
    }
  }

  _fall(points, dt, speed) {
    const pos = points.geometry.getAttribute('position');
    const spread = points.userData.spread;
    const drift = speed * 0.16;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) - speed * dt;
      let x = pos.getX(i) + drift * dt;
      if (y < -2) {
        y = spread.y;
        x = (Math.random() - 0.5) * spread.x;
        pos.setZ(i, (Math.random() - 0.5) * spread.z);
      }
      if (x > spread.x / 2) x -= spread.x;
      pos.setXYZ(i, x, y, pos.getZ(i));
    }
    pos.needsUpdate = true;
  }

  _drift(points, dt, elapsed, speed, rise) {
    const pos = points.geometry.getAttribute('position');
    const spread = points.userData.spread;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i) + Math.sin(elapsed * 0.3 + i) * speed * dt + speed * dt;
      let y = pos.getY(i) + rise * dt * (0.4 + (i % 5) * 0.2);
      const z = pos.getZ(i) + Math.cos(elapsed * 0.24 + i * 0.7) * speed * dt;
      if (y > spread.y) y = 0.5;
      if (x > spread.x / 2) x -= spread.x;
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
  }

  _swarm(points, dt, elapsed, bob) {
    const pos = points.geometry.getAttribute('position');
    const spread = points.userData.spread;
    for (let i = 0; i < pos.count; i++) {
      const phase = i * 0.37;
      const x = pos.getX(i) + Math.sin(elapsed * 1.6 + phase) * 2.4 * dt;
      const z = pos.getZ(i) + Math.cos(elapsed * 1.3 + phase * 1.7) * 2.4 * dt;
      let y = pos.getY(i) + Math.sin(elapsed * (bob ? 0.9 : 2.2) + phase) * 1.6 * dt;
      if (y < 0.6) y = 0.6;
      if (y > spread.y) y = spread.y;
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
    if (bob) {
      // Fireflies pulse rather than glow steadily.
      this.materials.fireflies.opacity = 0.45 + Math.sin(elapsed * 2.6) * 0.35;
    }
  }

  setVisible(v) { this.group.visible = v; }
}

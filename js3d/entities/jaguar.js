// ============================================================
// JAGUAR.JS — the player: a procedural low-poly big cat
// Built from grouped primitives so the limbs can be driven by a
// hand-written gait cycle. No skeleton, no loader, no asset.
// ============================================================

import * as THREE from '../../js/vendor/three.module.min.js';

const COAT = 0xc8934c;
const COAT_DARK = 0x9d6f36;
const BELLY = 0xe0c79a;
const DARK = 0x2a1c10;

/** Rosette coat, drawn once onto a canvas and reused by every body part. */
function makeCoatTexture() {
  const size = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, '#d9a55c');
  g.addColorStop(0.55, '#c8934c');
  g.addColorStop(1, '#a97639');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // Rosettes: a broken dark ring with a spot inside, the way a jaguar's are.
  let s = 20250804;
  const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  for (let i = 0; i < 46; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 9 + rnd() * 9;
    ctx.strokeStyle = 'rgba(42, 26, 14, 0.82)';
    ctx.lineWidth = 3 + rnd() * 1.6;
    ctx.beginPath();
    const gap = rnd() * Math.PI * 2;
    ctx.arc(x, y, r, gap, gap + Math.PI * 1.55);
    ctx.stroke();
    ctx.fillStyle = 'rgba(48, 30, 16, 0.62)';
    ctx.beginPath();
    ctx.arc(x + (rnd() - 0.5) * 4, y + (rnd() - 0.5) * 4, 2.4 + rnd() * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  // Small solid spots between the rosettes
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = 'rgba(50, 32, 17, 0.5)';
    ctx.beginPath();
    ctx.arc(rnd() * size, rnd() * size, 1.4 + rnd() * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  // Box UVs stretch the whole texture over each face, so repeat to keep the
  // rosettes at cat scale rather than one giant ring per flank.
  tex.repeat.set(2.4, 2.4);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let COAT_TEX = null;

function box(w, h, d, mat) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

export class Jaguar {
  constructor(scene, quality) {
    if (!COAT_TEX) COAT_TEX = makeCoatTexture();

    // The coat texture already carries the colour; tinting it again only muddies it.
    this.matCoat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: COAT_TEX });
    this.matDarkCoat = new THREE.MeshLambertMaterial({ color: 0xc6a074, map: COAT_TEX });
    this.matBelly = new THREE.MeshLambertMaterial({ color: BELLY });
    this.matDark = new THREE.MeshLambertMaterial({ color: DARK });

    this.root = new THREE.Group();
    // Larger than life: the player must find themselves at a glance from any zoom.
    this.root.scale.setScalar(2.0);
    this.body = new THREE.Group();      // bobs and pitches
    this.root.add(this.body);
    scene.add(this.root);

    // A quiet ring on the ground so the cat never gets lost in the scenery.
    this.markerMat = new THREE.MeshBasicMaterial({
      color: 0xffe0a8, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, fog: false
    });
    this.marker = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.62, 28), this.markerMat);
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.position.y = 0.12;
    this.marker.renderOrder = 7;
    this.root.add(this.marker);

    const cast = quality.shadows;

    // --- torso ---
    const torso = box(1.05, 0.92, 2.5, this.matCoat);
    torso.position.set(0, 1.28, 0);
    torso.castShadow = cast;
    this.body.add(torso);

    const haunch = box(1.14, 1.0, 0.95, this.matCoat);
    haunch.position.set(0, 1.3, -1.05);
    haunch.castShadow = cast;
    this.body.add(haunch);

    const chest = box(1.1, 0.94, 0.85, this.matCoat);
    chest.position.set(0, 1.3, 1.05);
    chest.castShadow = cast;
    this.body.add(chest);

    const underside = box(0.86, 0.3, 2.2, this.matBelly);
    underside.position.set(0, 0.87, 0.05);
    this.body.add(underside);

    // --- neck + head ---
    this.neck = new THREE.Group();
    this.neck.position.set(0, 1.42, 1.42);
    this.body.add(this.neck);

    const neckMesh = box(0.72, 0.66, 0.7, this.matCoat);
    neckMesh.position.set(0, 0.02, 0.3);
    neckMesh.castShadow = cast;
    this.neck.add(neckMesh);

    this.head = new THREE.Group();
    this.head.position.set(0, 0.16, 0.72);
    this.neck.add(this.head);

    const skull = box(0.78, 0.7, 0.8, this.matCoat);
    skull.castShadow = cast;
    this.head.add(skull);

    const muzzle = box(0.5, 0.4, 0.42, this.matBelly);
    muzzle.position.set(0, -0.14, 0.55);
    this.head.add(muzzle);

    const nose = box(0.2, 0.15, 0.12, this.matDark);
    nose.position.set(0, -0.06, 0.79);
    this.head.add(nose);

    for (const sx of [-1, 1]) {
      const ear = box(0.26, 0.3, 0.1, this.matDarkCoat);
      ear.position.set(sx * 0.28, 0.44, -0.06);
      ear.rotation.z = sx * 0.22;
      this.head.add(ear);

      const eye = box(0.14, 0.11, 0.06, new THREE.MeshBasicMaterial({ color: 0xe8c45c }));
      eye.position.set(sx * 0.24, 0.11, 0.41);
      this.head.add(eye);
      this._eyeMat = eye.material;
    }

    // --- legs: [front-left, front-right, back-left, back-right] ---
    this.legs = [];
    const legDefs = [
      { x: -0.42, z: 1.02, front: true },
      { x: 0.42, z: 1.02, front: true },
      { x: -0.45, z: -1.05, front: false },
      { x: 0.45, z: -1.05, front: false }
    ];
    for (const d of legDefs) {
      const hip = new THREE.Group();
      hip.position.set(d.x, 1.02, d.z);
      this.body.add(hip);

      const upper = box(0.3, 0.72, 0.34, this.matCoat);
      upper.position.set(0, -0.36, 0);
      upper.castShadow = cast;
      hip.add(upper);

      const knee = new THREE.Group();
      knee.position.set(0, -0.7, 0);
      hip.add(knee);

      const lower = box(0.24, 0.62, 0.26, this.matDarkCoat);
      lower.position.set(0, -0.31, 0);
      lower.castShadow = cast;
      knee.add(lower);

      const paw = box(0.3, 0.2, 0.42, this.matDark);
      paw.position.set(0, -0.68, 0.06);
      knee.add(paw);

      this.legs.push({ hip, knee, front: d.front, side: Math.sign(d.x) });
    }

    // --- tail: three segments so it can whip ---
    this.tail = [];
    let parent = this.body;
    for (let i = 0; i < 3; i++) {
      const seg = new THREE.Group();
      seg.position.set(0, i === 0 ? 1.42 : 0, i === 0 ? -1.5 : -0.62);
      const mesh = box(0.17 - i * 0.03, 0.17 - i * 0.03, 0.62, i === 2 ? this.matDark : this.matCoat);
      mesh.position.set(0, 0, -0.31);
      seg.add(mesh);
      parent.add(seg);
      parent = seg;
      this.tail.push(seg);
    }

    this.gait = 'idle';
    this.speed = 0;
    this._phase = 0;
    this._breath = Math.random() * 6;
    this._headLook = 0;
    this._collapse = 0;
    this._drink = 0;
    this._exhaustion = 0;
  }

  /** 0..1 — how ragged the animation looks. Driven by fatigue and heat. */
  setExhaustion(v) { this._exhaustion = Math.max(0, Math.min(1, v)); }

  setGait(gait) { this.gait = gait; }

  /** 0..1 head-down drinking pose. */
  setDrinking(v) { this._drink = v; }

  /** 0..1 death collapse. */
  setCollapse(v) { this._collapse = v; }

  setPosition(x, y, z) { this.root.position.set(x, y, z); }

  get position() { return this.root.position; }

  /** Yaw in radians; the cat's nose points down +Z at yaw 0. */
  setFacing(yaw) { this.root.rotation.y = yaw; }

  faceTowards(yaw, dt, rate = 7) {
    let d = yaw - this.root.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.root.rotation.y += d * Math.min(1, rate * dt);
  }

  update(dt, elapsed) {
    const g = this.gait;
    const tired = this._exhaustion;

    let cycleSpeed, stride, bob, lean;
    if (g === 'run') { cycleSpeed = 8.6 - tired * 1.6; stride = 1.05; bob = 0.16; lean = 0.13; }
    else if (g === 'walk') { cycleSpeed = 3.5 - tired * 0.6; stride = 0.62; bob = 0.07; lean = 0.05; }
    else { cycleSpeed = 0; stride = 0; bob = 0; lean = 0; }

    this._phase += cycleSpeed * dt;
    this._breath += dt * (1.5 + tired * 2.6);

    // --- legs ---
    for (let i = 0; i < 4; i++) {
      const leg = this.legs[i];
      // Bounding gait: front pair and back pair each move together, offset by half.
      const offset = leg.front ? 0 : Math.PI;
      const sideOffset = leg.side > 0 ? 0.32 : 0;
      const p = this._phase + offset + sideOffset;
      if (cycleSpeed > 0) {
        leg.hip.rotation.x = Math.sin(p) * stride * (leg.front ? 1 : 0.9);
        const fold = Math.max(0, -Math.cos(p));
        leg.knee.rotation.x = -fold * stride * (leg.front ? 1.15 : 1.5);
      } else {
        leg.hip.rotation.x += (0 - leg.hip.rotation.x) * Math.min(1, dt * 6);
        leg.knee.rotation.x += ((leg.front ? -0.06 : -0.18) - leg.knee.rotation.x) * Math.min(1, dt * 6);
      }
    }

    // --- body bob, pitch and roll ---
    const bounce = cycleSpeed > 0 ? Math.abs(Math.sin(this._phase)) : 0;
    const breathe = Math.sin(this._breath) * (0.018 + tired * 0.03);
    this.body.position.y = bounce * bob + breathe;
    this.body.rotation.x = (cycleSpeed > 0 ? Math.sin(this._phase * 2) * lean : 0) - this._drink * 0.06;
    this.body.rotation.z = cycleSpeed > 0 ? Math.sin(this._phase) * 0.035 : 0;

    // --- head ---
    const headDrop = this._drink * 1.05 + tired * 0.16;
    this.neck.rotation.x = headDrop - (cycleSpeed > 0 ? Math.sin(this._phase * 2) * 0.06 : 0);
    this.head.rotation.x = this._drink * 0.35 + Math.sin(this._breath * 0.4) * 0.03;
    this.head.rotation.y = this._headLook;

    // --- tail ---
    for (let i = 0; i < 3; i++) {
      const t = this.tail[i];
      const lag = i * 0.55;
      t.rotation.y = Math.sin(elapsed * 2.1 - lag) * (0.12 + (cycleSpeed > 0 ? 0.16 : 0));
      t.rotation.x = (i === 0 ? 0.45 : 0.16) + Math.sin(elapsed * 1.6 - lag) * 0.1
        - (cycleSpeed > 0 ? 0.22 : 0);
    }

    this.markerMat.opacity = 0.34 + Math.sin(elapsed * 1.9) * 0.14;

    // --- collapse overrides everything ---
    if (this._collapse > 0) {
      const c = this._collapse;
      this.root.rotation.z = c * 1.42;
      this.body.position.y = -c * 0.55 + breathe * (1 - c);
      this.neck.rotation.x = c * 0.5;
      for (const leg of this.legs) {
        leg.hip.rotation.x = c * 0.7 * (leg.front ? 1 : -0.6);
        leg.knee.rotation.x = -c * 0.9;
      }
    } else {
      this.root.rotation.z = 0;
    }
  }

  /** Glance toward a world point (used when the hunters come into view). */
  lookAtWorld(x, z) {
    const dx = x - this.root.position.x;
    const dz = z - this.root.position.z;
    let a = Math.atan2(dx, dz) - this.root.rotation.y;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    this._headLook = Math.max(-1.0, Math.min(1.0, a));
  }

  clearLook() { this._headLook = 0; }

  setShadows(on) {
    this.root.traverse(o => { if (o.isMesh) o.castShadow = on; });
  }
}

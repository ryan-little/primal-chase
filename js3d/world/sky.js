// ============================================================
// SKY.JS — sky dome, sun and moon, the day/night lighting cycle
// The sky is the game's clock: one turn moves it a quarter turn.
// ============================================================

import * as THREE from '../../js/vendor/three.module.min.js';

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w; // always at the far plane
}`;

const SKY_FRAG = /* glsl */`
precision mediump float;
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
uniform float uSunSize;
uniform float uNight;
uniform float uHaze;
varying vec3 vDir;

// cheap hash for star twinkle
float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
  float grad = pow(clamp(d.y, 0.0, 1.0), 0.38);
  vec3 col = mix(uHorizon, uTop, grad);

  // Warm band hugging the horizon
  float band = exp(-abs(d.y) * (9.0 - uHaze * 4.0));
  col = mix(col, uHorizon, band * 0.4);

  // Sun / moon disc and its glow
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  float disc = smoothstep(1.0 - uSunSize, 1.0 - uSunSize * 0.35, sd);
  float glow = pow(sd, 26.0) * 0.55 + pow(sd, 4.0) * 0.12;
  col += uSunColor * (disc * 1.5 + glow);

  // Stars, only at night, only above the horizon
  if (uNight > 0.01 && d.y > 0.02) {
    vec3 cell = floor(d * 190.0);
    float s = hash(cell);
    if (s > 0.9915) {
      float bright = (s - 0.9915) / 0.0085;
      col += vec3(0.85, 0.9, 1.0) * bright * uNight * smoothstep(0.02, 0.35, d.y);
    }
  }

  gl_FragColor = vec4(col, 1.0);
}`;

/** Blend two sky presets. */
function lerpPreset(a, b, t) {
  const mix = (x, y) => x + (y - x) * t;
  return {
    top: new THREE.Color(a.top).lerp(new THREE.Color(b.top), t),
    horizon: new THREE.Color(a.horizon).lerp(new THREE.Color(b.horizon), t),
    sun: new THREE.Color(a.sun).lerp(new THREE.Color(b.sun), t),
    fog: new THREE.Color(a.fog).lerp(new THREE.Color(b.fog), t),
    fogNear: mix(a.fogNear, b.fogNear),
    fogFar: mix(a.fogFar, b.fogFar),
    ambient: mix(a.ambient, b.ambient),
    sunIntensity: mix(a.sunIntensity, b.sunIntensity)
  };
}

export class Sky {
  /**
   * @param {THREE.Scene} scene
   * @param {{shadows:boolean, shadowSize:number}} quality
   */
  constructor(scene, quality) {
    this.scene = scene;
    this.quality = quality;

    this.uniforms = {
      uTop: { value: new THREE.Color(0x5c7fa3) },
      uHorizon: { value: new THREE.Color(0xe0a862) },
      uSunColor: { value: new THREE.Color(0xfff2d0) },
      uSunDir: { value: new THREE.Vector3(0.3, 0.6, -0.7) },
      uSunSize: { value: 0.006 },
      uNight: { value: 0 },
      uHaze: { value: 0 }
    };

    const geo = new THREE.SphereGeometry(500, 32, 20);
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    scene.add(this.mesh);

    // Lights
    this.sun = new THREE.DirectionalLight(0xfff2d0, 2.0);
    this.sun.position.set(60, 90, -70);
    if (quality.shadows) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
      const s = 78;
      this.sun.shadow.camera.left = -s;
      this.sun.shadow.camera.right = s;
      this.sun.shadow.camera.top = s;
      this.sun.shadow.camera.bottom = -s;
      this.sun.shadow.camera.near = 1;
      this.sun.shadow.camera.far = 320;
      this.sun.shadow.bias = -0.0012;
      this.sun.shadow.normalBias = 0.035;
    }
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.ambient = new THREE.HemisphereLight(0xcfe0f5, 0x6b4b2c, 0.6);
    scene.add(this.ambient);

    /** Bounce light that keeps night shapes readable without washing them out. */
    this.fill = new THREE.DirectionalLight(0x8aa4cc, 0.18);
    this.fill.position.set(-50, 30, 60);
    scene.add(this.fill);

    this.fog = new THREE.Fog(0xcf9a5e, 55, 190);
    scene.fog = this.fog;

    /** 0 = high day, 0.5 = dusk, 1 = deep night, 1.5 = dawn (wraps at 2). */
    this.cycle = 0;
    this._targetCycle = 0;
    this.setPhaseImmediate('day');
  }

  /**
   * Continuous 0..2 clock position for a phase.
   * 0 = sunrise, 0.5 = noon, 1 = sunset, 1.5 = midnight.
   * A phase sits at the middle of its half so DAY looks like day.
   */
  static cycleFor(phase) { return phase === 'night' ? 1.42 : 0.34; }

  setPhaseImmediate(phase) {
    this.cycle = Sky.cycleFor(phase);
    this._targetCycle = this.cycle;
    this.apply();
  }

  /**
   * Begin a smooth sweep forward to where the given phase sits on the clock.
   *
   * The target is derived from the phase rather than accumulated from the
   * current position. An earlier version advanced by a fixed +1 per turn, so
   * any sweep that did not fully converge left the sky permanently behind the
   * game — a DAY phase could end up lit as night and stay that way. Deriving
   * the target means a lagging clock catches up on the next turn instead.
   */
  advanceTo(phase) {
    const base = Sky.cycleFor(phase);
    // The clock only ever runs forward, so pick the next occurrence ahead of it.
    let target = base;
    while (target < this.cycle + 0.01) target += 2;
    this._targetCycle = target;
  }

  /** How far the sky currently is from where `phase` says it should be. */
  driftFrom(phase) {
    const want = Sky.cycleFor(phase);
    const have = ((this.cycle % 2) + 2) % 2;
    const raw = Math.abs(have - want);
    return Math.min(raw, 2 - raw);
  }

  /** Drive the sweep. `speed` in cycle-units per second. */
  update(dt, speed = 0.8) {
    if (Math.abs(this._targetCycle - this.cycle) > 0.0005) {
      const dir = Math.sign(this._targetCycle - this.cycle);
      this.cycle += dir * Math.min(Math.abs(this._targetCycle - this.cycle), speed * dt);
      if (this.cycle >= 2) { this.cycle -= 2; this._targetCycle -= 2; }
      this.apply();
      return true;
    }
    return false;
  }

  /** Recompute sky colours, light directions and fog from `this.cycle`. */
  apply() {
    const P = window.CONFIG3D.sky;
    // Keyframes around the 0..2 clock. Between two keys we simply blend.
    const keys = [
      [0.00, P.dawn], [0.20, P.day], [0.80, P.day], [1.00, P.dusk],
      [1.20, P.night], [1.80, P.night], [2.00, P.dawn]
    ];
    const c = ((this.cycle % 2) + 2) % 2;
    let preset = keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      if (c >= keys[i][0] && c <= keys[i + 1][0]) {
        const span = keys[i + 1][0] - keys[i][0];
        preset = span > 0 ? lerpPreset(keys[i][1], keys[i + 1][1], (c - keys[i][0]) / span) : keys[i][1];
        break;
      }
    }

    this.uniforms.uTop.value.copy(preset.top);
    this.uniforms.uHorizon.value.copy(preset.horizon);
    this.uniforms.uSunColor.value.copy(preset.sun);

    const night = smoothstep(0.94, 1.18, c) * (1 - smoothstep(1.82, 2.0, c));
    this.uniforms.uNight.value = night;
    this.uniforms.uSunSize.value = night > 0.5 ? 0.011 : 0.0075;

    // The sun arcs east to west across the first half of the clock; the moon
    // takes the same arc through the second. Neither ever drops fully below the
    // horizon — a light at y=0 would leave the board unreadable.
    const arc = (c < 1 ? c : c - 1) * Math.PI;
    const elev = Math.sin(arc) * 0.9 + 0.16;
    const dir = new THREE.Vector3(Math.cos(arc + Math.PI) * 0.85, Math.max(0.16, elev), -0.42).normalize();
    this.uniforms.uSunDir.value.copy(dir);

    this.sun.position.copy(dir).multiplyScalar(160);
    this.sun.color.copy(preset.sun);
    this.sun.intensity = preset.sunIntensity;

    this.ambient.intensity = preset.ambient;
    this.ambient.color.copy(preset.top).lerp(new THREE.Color(0xffffff), 0.25);
    this.fill.intensity = 0.1 + night * 0.16;

    this.fog.color.copy(preset.fog);
    this.fog.near = preset.fogNear;
    this.fog.far = preset.fogFar;
    this._preset = preset;
    this.nightAmount = night;
  }

  /** Keep the dome and shadow frustum centred on the player. */
  follow(x, z) {
    this.mesh.position.set(x, 0, z);
    this.sun.target.position.set(x, 0, z);
    this.sun.position.copy(this.uniforms.uSunDir.value).multiplyScalar(160).add(new THREE.Vector3(x, 0, z));
    this.sun.target.updateMatrixWorld();
  }

  /** Storms dull the sky and pull the fog in. */
  setStorm(amount) {
    this.uniforms.uHaze.value = amount;
    if (!this._preset) return;
    const dull = new THREE.Color(0x4a4238);
    this.uniforms.uTop.value.copy(this._preset.top).lerp(dull, amount * 0.6);
    this.uniforms.uHorizon.value.copy(this._preset.horizon).lerp(dull, amount * 0.5);
    this.fog.far = this._preset.fogFar * (1 - amount * 0.45);
    this.sun.intensity = this._preset.sunIntensity * (1 - amount * 0.55);
  }

  /** Lightning: momentarily blow out the ambient. */
  flash(amount) {
    this.ambient.intensity = (this._preset ? this._preset.ambient : 0.5) + amount;
    this.fill.intensity = 0.1 + amount * 0.9;
  }

  setQuality(quality) {
    this.quality = quality;
    this.sun.castShadow = quality.shadows;
    if (quality.shadows && this.sun.shadow.mapSize.width !== quality.shadowSize) {
      this.sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
  }
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

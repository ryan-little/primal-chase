// ============================================================
// CAMERA.JS — follow-orbit rig with unified pointer handling
// One finger / left drag orbits, two fingers or wheel zoom,
// a short press without movement is a tap and selects a hex.
// ============================================================

import * as THREE from '../../js/vendor/three.module.min.js';

const TAP_SLOP = 11;      // px of movement still counted as a tap
const TAP_TIME = 420;     // ms

export class CameraRig {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {HTMLElement} domElement
   */
  constructor(camera, domElement) {
    const cfg = window.CONFIG3D.camera;
    this.camera = camera;
    this.dom = domElement;

    this.target = new THREE.Vector3(0, 0, 0);
    this._smoothTarget = new THREE.Vector3(0, 0, 0);

    this.azimuth = 0;             // 0 looks from the south, i.e. behind a north-fleeing cat
    this.polar = cfg.defaultPolar;
    this.distance = cfg.defaultDistance;
    this._targetDistance = this.distance;

    this.enabled = true;
    /** Set by the game while an action animation plays. */
    this.locked = false;

    this._shake = 0;
    this._shakeDecay = 3.2;
    this._offset = new THREE.Vector3();

    /** Consumers: (clientX, clientY) => void */
    this.onTap = null;
    /** Consumers: (clientX, clientY) => void — fires on every pointer move for hover. */
    this.onHover = null;

    this._pointers = new Map();
    this._pinchStart = 0;
    this._pinchStartDistance = 0;
    this._down = null;
    this._moved = 0;

    this._bind();
  }

  _bind() {
    const dom = this.dom;
    const opts = { passive: false };

    this._onPointerDown = (e) => {
      if (!this.enabled) return;
      dom.setPointerCapture && dom.setPointerCapture(e.pointerId);
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this._pointers.size === 1) {
        this._down = { x: e.clientX, y: e.clientY, t: performance.now() };
        this._moved = 0;
      } else if (this._pointers.size === 2) {
        const p = [...this._pointers.values()];
        this._pinchStart = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        this._pinchStartDistance = this._targetDistance;
        this._down = null; // two fingers is never a tap
      }
    };

    this._onPointerMove = (e) => {
      if (!this.enabled) return;
      const prev = this._pointers.get(e.pointerId);
      if (!prev) {
        if (this.onHover && e.pointerType === 'mouse') this.onHover(e.clientX, e.clientY);
        return;
      }
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      prev.x = e.clientX;
      prev.y = e.clientY;

      if (this._pointers.size === 2) {
        const p = [...this._pointers.values()];
        const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        if (this._pinchStart > 0) {
          this._setDistance(this._pinchStartDistance * (this._pinchStart / Math.max(1, d)));
        }
        e.preventDefault();
        return;
      }

      this._moved += Math.abs(dx) + Math.abs(dy);
      if (this._moved > TAP_SLOP) {
        this.azimuth -= dx * 0.006;
        this.polar = clamp(this.polar - dy * 0.005,
          window.CONFIG3D.camera.minPolar, window.CONFIG3D.camera.maxPolar);
        e.preventDefault();
      }
    };

    this._onPointerUp = (e) => {
      const wasDown = this._down;
      this._pointers.delete(e.pointerId);
      if (this._pointers.size < 2) this._pinchStart = 0;
      if (!this.enabled) return;
      if (wasDown && this._pointers.size === 0) {
        const dt = performance.now() - wasDown.t;
        const dist = Math.hypot(e.clientX - wasDown.x, e.clientY - wasDown.y);
        if (dist <= TAP_SLOP && dt <= TAP_TIME && this.onTap) {
          this.onTap(e.clientX, e.clientY);
        }
      }
      this._down = null;
    };

    this._onWheel = (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      this._setDistance(this._targetDistance * (1 + Math.sign(e.deltaY) * 0.11));
    };

    dom.addEventListener('pointerdown', this._onPointerDown, opts);
    dom.addEventListener('pointermove', this._onPointerMove, opts);
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('pointercancel', this._onPointerUp);
    dom.addEventListener('wheel', this._onWheel, opts);
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _setDistance(d) {
    const cfg = window.CONFIG3D.camera;
    this._targetDistance = clamp(d, cfg.minDistance, cfg.maxDistance);
  }

  zoomBy(factor) { this._setDistance(this._targetDistance * factor); }

  rotateBy(radians) { this.azimuth += radians; }

  /** Snap the smoothing so the camera does not sweep across the map on a new game. */
  snapTo(x, y, z) {
    this.target.set(x, y, z);
    this._smoothTarget.set(x, y, z);
    this.distance = this._targetDistance;
    this.update(0.016);
  }

  setTarget(x, y, z) { this.target.set(x, y, z); }

  shake(amount = 0.6) { this._shake = Math.min(2.4, this._shake + amount); }

  update(dt) {
    const cfg = window.CONFIG3D.camera;
    const lerp = 1 - Math.pow(1 - cfg.followLerp, dt * 60);
    this._smoothTarget.lerp(this.target, lerp);
    this.distance += (this._targetDistance - this.distance) * lerp;

    const sinP = Math.sin(this.polar);
    this._offset.set(
      Math.sin(this.azimuth) * sinP,
      Math.cos(this.polar),
      Math.cos(this.azimuth) * sinP
    ).multiplyScalar(this.distance);

    this.camera.position.copy(this._smoothTarget).add(this._offset);

    if (this._shake > 0.001) {
      this._shake = Math.max(0, this._shake - this._shakeDecay * dt);
      const s = this._shake * this._shake;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.camera.position.z += (Math.random() - 0.5) * s;
    }

    this.camera.lookAt(this._smoothTarget);
  }

  dispose() {
    window.removeEventListener('pointerup', this._onPointerUp);
    window.removeEventListener('pointercancel', this._onPointerUp);
  }
}

function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

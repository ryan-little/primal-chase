// ============================================================
// RENDERER.JS — WebGL context, scene root, quality tiers, resize
// ============================================================

import * as THREE from '../../js/vendor/three.module.min.js';

/** Guess a quality tier from what the device tells us about itself. */
export function detectQuality() {
  // ?quality=low|medium|high forces a tier — handy for debugging and for the
  // headless test runs, where software rendering makes 'high' painfully slow.
  const forced = new URLSearchParams(location.search).get('quality');
  if (forced && window.CONFIG3D.quality[forced]) return forced;

  const stored = (() => {
    try { return localStorage.getItem('primalchase3d_quality'); } catch (e) { return null; }
  })();
  if (stored && stored !== 'auto') return stored;

  const ua = navigator.userAgent || '';
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || coarse;
  const cores = navigator.hardwareConcurrency || (mobile ? 4 : 8);
  const mem = navigator.deviceMemory || (mobile ? 4 : 8);
  const small = Math.min(window.innerWidth, window.innerHeight) < 500;

  if (mobile && (cores <= 4 || mem <= 3 || small)) return 'low';
  if (mobile) return 'medium';
  if (cores <= 4 || mem <= 4) return 'medium';
  return 'high';
}

export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.qualityName = detectQuality();
    this.quality = { ...window.CONFIG3D.quality[this.qualityName] };

    // Headless screenshots capture the page after the drawing buffer has been
    // cleared, so test runs ask to keep it. Never on by default — it costs
    // memory and blocks some driver fast paths.
    const params = new URLSearchParams(location.search);
    const forCapture = params.has('playtest') || params.has('capture');

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.quality.aa,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      preserveDrawingBuffer: forCapture
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality.dpr));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.shadowMap.enabled = this.quality.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();

    const cam = window.CONFIG3D.camera;
    this.camera = new THREE.PerspectiveCamera(cam.fov, 1, 0.5, 900);
    this.camera.position.set(0, 40, 55);

    this._onResize = this.resize.bind(this);
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);
    this.resize();

    // Frame-time smoothing feeds the adaptive quality governor.
    this._frameAvg = 16.7;
    this._degradeCooldown = 0;
  }

  setQuality(name) {
    if (!window.CONFIG3D.quality[name]) return;
    this.qualityName = name;
    this.quality = { ...window.CONFIG3D.quality[name] };
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality.dpr));
    this.renderer.shadowMap.enabled = this.quality.shadows;
    try { localStorage.setItem('primalchase3d_quality', name); } catch (e) { /* private mode */ }
    this.resize();
    if (this.onQualityChange) this.onQualityChange(name);
  }

  /** Drop a tier if we are persistently missing frame budget. */
  governFrame(dtMs) {
    this._frameAvg += (dtMs - this._frameAvg) * 0.05;
    if (this._degradeCooldown > 0) { this._degradeCooldown--; return; }
    if (this._frameAvg > 42 && this.qualityName === 'high') {
      this.setQuality('medium');
      this._degradeCooldown = 600;
    } else if (this._frameAvg > 52 && this.qualityName === 'medium') {
      this.setQuality('low');
      this._degradeCooldown = 600;
    }
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('orientationchange', this._onResize);
    this.renderer.dispose();
  }
}

export { THREE };

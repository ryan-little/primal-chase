// ============================================================
// TEXTURES.JS — small procedural textures shared across systems
// Point sprites default to hard squares, which read as glitches.
// Everything particle-shaped gets a soft dot from here instead.
// ============================================================

import * as THREE from '../../js/vendor/three.module.min.js';

const cache = new Map();

function canvas(size) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  return cv;
}

function finish(cv) {
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Soft round falloff — dust, smoke, pollen, fireflies. */
export function softDot(hardness = 0.25) {
  const k = 'dot' + hardness;
  if (cache.has(k)) return cache.get(k);
  const size = 64;
  const cv = canvas(size);
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.5 * hardness, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.42)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = finish(cv);
  cache.set(k, tex);
  return tex;
}

/** Ragged puff — better than a clean circle for kicked-up dust. */
export function dustPuff() {
  if (cache.has('puff')) return cache.get('puff');
  const size = 64;
  const cv = canvas(size);
  const ctx = cv.getContext('2d');
  let s = 7717;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  for (let i = 0; i < 9; i++) {
    const x = size / 2 + (rnd() - 0.5) * size * 0.42;
    const y = size / 2 + (rnd() - 0.5) * size * 0.42;
    const r = size * (0.16 + rnd() * 0.2);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.42)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = finish(cv);
  cache.set('puff', tex);
  return tex;
}

/** A single vertical streak — rain. */
export function rainStreak() {
  if (cache.has('rain')) return cache.get('rain');
  const cv = canvas(32);
  cv.height = 128;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, 'rgba(200,220,255,0)');
  g.addColorStop(0.5, 'rgba(210,228,255,0.8)');
  g.addColorStop(1, 'rgba(200,220,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(13, 0, 6, 128);
  const tex = finish(cv);
  cache.set('rain', tex);
  return tex;
}

/** Four-pointed star flare for the beacon over landmarks. */
export function starFlare() {
  if (cache.has('flare')) return cache.get('flare');
  const size = 128;
  const cv = canvas(size);
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,240,205,0.95)');
  g.addColorStop(0.22, 'rgba(232,168,100,0.42)');
  g.addColorStop(1, 'rgba(232,168,100,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(255,235,190,0.5)';
  ctx.lineWidth = 2.5;
  for (const [dx, dy] of [[1, 0], [0, 1]]) {
    ctx.beginPath();
    ctx.moveTo(size / 2 - dx * size * 0.46, size / 2 - dy * size * 0.46);
    ctx.lineTo(size / 2 + dx * size * 0.46, size / 2 + dy * size * 0.46);
    ctx.stroke();
  }
  const tex = finish(cv);
  cache.set('flare', tex);
  return tex;
}

/** Load one of the pixel-art sprites shipped with V1 (fireflies, logos). */
export function loadSprite(url) {
  if (cache.has(url)) return cache.get(url);
  const tex = new THREE.TextureLoader().load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;   // keep the pixel art crisp
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  cache.set(url, tex);
  return tex;
}

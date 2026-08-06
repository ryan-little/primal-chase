// World viewer — the renderer's proving ground while gameplay lands.
// URL params: ?seed=7&x=0&z=0&sun=0.6&dist=2600&yaw=0.8
// Sets window.__READY = true once all chunks are built (screenshot harness
// waits on it).

import {
  ACESFilmicToneMapping, PCFSoftShadowMap, PerspectiveCamera, Scene,
  SRGBColorSpace, Vector3, WebGLRenderer
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Biomes } from './world/biomes';
import { TerrainChunks } from './render/terrain';
import { Sky } from './render/sky';

declare global {
  interface Window { __READY?: boolean; }
}

export function start(): void {
  const q = new URLSearchParams(location.search);
  const seed = Number(q.get('seed') ?? 7);
  const fx = Number(q.get('x') ?? 0);
  const fz = Number(q.get('z') ?? 0);
  const sunEl = Number(q.get('sun') ?? 0.55);
  const dist = Number(q.get('dist') ?? 2600);
  const yaw = Number(q.get('yaw') ?? 0.8);

  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('app')!.appendChild(renderer.domElement);
  document.getElementById('boot')?.remove();

  const scene = new Scene();
  const biomes = new Biomes(seed);
  const terrain = new TerrainChunks(biomes, 5);
  scene.add(terrain.group);

  const sky = new Sky(scene);
  sky.elevation = sunEl;

  const focusY = biomes.field.height(fx, fz);
  const focus = new Vector3(fx, focusY, fz);

  const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 2, 60000);
  camera.position.set(
    fx + Math.cos(yaw) * dist,
    focusY + dist * 0.55,
    fz + Math.sin(yaw) * dist
  );

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(focus);
  controls.maxPolarAngle = 1.42;
  controls.minDistance = 120;
  controls.maxDistance = 16000;
  controls.enableDamping = true;

  terrain.focus(fx, fz);
  sky.apply(focus);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  let readyFrames = 0;
  renderer.setAnimationLoop(() => {
    const busy = terrain.tick(3);
    controls.update();
    renderer.render(scene, camera);
    if (!busy) {
      // A few settle frames after the last chunk so shadows/normals land.
      if (++readyFrames === 5) window.__READY = true;
    } else {
      readyFrames = 0;
    }
  });
}

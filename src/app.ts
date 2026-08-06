// Temporary smoke-test scene: proves the toolchain, the renderer, the GPU
// preference, and the resize/DPR handling. Replaced as real systems land.

import {
  ACESFilmicToneMapping, Color, DirectionalLight, Fog, HemisphereLight,
  Mesh, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry,
  Scene, WebGLRenderer
} from 'three';

export function start(): void {
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('app')!.appendChild(renderer.domElement);
  document.getElementById('boot')!.remove();

  const scene = new Scene();
  scene.background = new Color(0xd9c39a);
  scene.fog = new Fog(0xd9c39a, 60, 400);

  const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 24, 46);
  camera.lookAt(0, 0, 0);

  const sun = new DirectionalLight(0xfff4d8, 2.2);
  sun.position.set(40, 60, 20);
  scene.add(sun, new HemisphereLight(0xbfd4e8, 0x8a6a3f, 0.6));

  const ground = new Mesh(
    new PlaneGeometry(600, 600, 128, 128),
    new MeshStandardMaterial({ color: 0xb59a53 })
  );
  ground.rotation.x = -Math.PI / 2;
  const pos = ground.geometry.attributes.position!;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, Math.sin(x * 0.02) * Math.cos(y * 0.03) * 6);
  }
  ground.geometry.computeVertexNormals();
  scene.add(ground);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  renderer.setAnimationLoop(() => renderer.render(scene, camera));
}

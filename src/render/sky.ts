// Sky dome, sun/moon light, and height fog — one system, driven by a single
// scalar: sun elevation in [-1, 1]. The phase transition (day <-> night)
// animates this scalar and the whole world answers: dome gradient, fog color,
// light color/intensity, star visibility.

import {
  BackSide, Color, DirectionalLight, FogExp2, HemisphereLight, Mesh,
  Points, PointsMaterial, BufferGeometry, Float32BufferAttribute,
  Scene, ShaderMaterial, SphereGeometry, Vector3
} from 'three';
import { SKY_STOPS } from './palette';
import { Rng } from '../world/rng';

const DOME_RADIUS = 26000;

const skyVert = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = (projectionMatrix * mv).xyww; // depth = far plane
  }
`;

const skyFrag = /* glsl */`
  varying vec3 vDir;
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  uniform vec3 sunColor;
  uniform vec3 sunDir;
  uniform float sunDisc;
  void main() {
    float h = clamp(vDir.y, 0.0, 1.0);
    vec3 col = mix(horizonColor, topColor, pow(h, 0.35));
    float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
    // Warm scatter around the sun, then the disc itself.
    col += sunColor * pow(s, 18.0) * 0.2;
    col += sunColor * smoothstep(0.9993, 0.9997, s) * sunDisc * 3.0;
    gl_FragColor = vec4(col, 1.0);
    // Route through the renderer's tone mapping + output color space like any
    // built-in material — without these the dome displays raw linear values.
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class Sky {
  readonly sun = new DirectionalLight(0xffffff, 2);
  /** Sky-bounce fill from opposite the sun, so shade never crushes to black. */
  readonly bounce = new DirectionalLight(0xa8c0d8, 0.5);
  readonly hemi = new HemisphereLight(0xbfd4e8, 0x8a6a3f, 0.5);
  readonly fog = new FogExp2(0xd2bc94, 0.000045);
  private dome: Mesh;
  private domeMat: ShaderMaterial;
  private stars: Points;
  private starsMat: PointsMaterial;

  /** Sun elevation in [-1,1]; azimuth precesses slowly with time of day. */
  elevation = 0.6;
  azimuth = 0.9;

  constructor(scene: Scene) {
    this.domeMat = new ShaderMaterial({
      vertexShader: skyVert,
      fragmentShader: skyFrag,
      uniforms: {
        topColor: { value: new Color() },
        horizonColor: { value: new Color() },
        sunColor: { value: new Color() },
        sunDir: { value: new Vector3(0, 1, 0) },
        sunDisc: { value: 1 }
      },
      side: BackSide,
      depthWrite: false
    });
    this.dome = new Mesh(new SphereGeometry(DOME_RADIUS, 32, 16), this.domeMat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -1;
    scene.add(this.dome);

    // Static star shell, faded in by night.
    const rng = new Rng(0x57a125);
    const starPos: number[] = [];
    for (let i = 0; i < 900; i++) {
      const t = rng.next() * Math.PI * 2;
      const y = rng.range(0.03, 1);
      const r = Math.sqrt(1 - y * y);
      starPos.push(Math.cos(t) * r * DOME_RADIUS * 0.98, y * DOME_RADIUS * 0.98, Math.sin(t) * r * DOME_RADIUS * 0.98);
    }
    const starGeo = new BufferGeometry();
    starGeo.setAttribute('position', new Float32BufferAttribute(starPos, 3));
    this.starsMat = new PointsMaterial({
      color: 0xcfe0f5, size: 30, sizeAttenuation: true,
      transparent: true, opacity: 0, fog: false, depthWrite: false
    });
    this.stars = new Points(starGeo, this.starsMat);
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 100;
    this.sun.shadow.camera.far = 30000;
    scene.add(this.sun, this.sun.target, this.hemi, this.bounce, this.bounce.target);
    scene.fog = this.fog;

    this.apply();
  }

  /** Recompute colors/lights from current elevation/azimuth. Cheap. */
  apply(focus?: Vector3): void {
    const e = this.elevation;

    // Interpolate the palette stops.
    let a = SKY_STOPS[0]!, b = SKY_STOPS[SKY_STOPS.length - 1]!;
    for (let i = 0; i < SKY_STOPS.length - 1; i++) {
      if (e >= SKY_STOPS[i]!.at && e <= SKY_STOPS[i + 1]!.at) {
        a = SKY_STOPS[i]!; b = SKY_STOPS[i + 1]!; break;
      }
    }
    const t = a === b ? 0 : Math.min(1, Math.max(0, (e - a.at) / (b.at - a.at)));
    const mix = (x: number, y: number) => {
      const ca = new Color(x), cb = new Color(y);
      return ca.lerp(cb, t);
    };

    const top = mix(a.top, b.top).convertSRGBToLinear();
    const horizon = mix(a.horizon, b.horizon).convertSRGBToLinear();
    const sunC = mix(a.sun, b.sun).convertSRGBToLinear();
    const fogC = mix(a.fog, b.fog).convertSRGBToLinear();

    (this.domeMat.uniforms['topColor']!.value as Color).copy(top);
    (this.domeMat.uniforms['horizonColor']!.value as Color).copy(horizon);
    (this.domeMat.uniforms['sunColor']!.value as Color).copy(sunC);

    // Sun direction from elevation/azimuth. Deep night hands the key light to
    // a high moon so the board stays legible (the land is the interface).
    const nightBlend = Math.min(1, Math.max(0, (-e - 0.1) / 0.3));
    const el = e >= 0 ? Math.max(e, 0.08) : 0.08 + nightBlend * 0.5;
    const dir = new Vector3(
      Math.cos(this.azimuth) * Math.cos(Math.asin(Math.min(1, Math.max(-1, el)))),
      Math.max(0.08, el),
      Math.sin(this.azimuth) * Math.cos(Math.asin(Math.min(1, Math.max(-1, el))))
    ).normalize();
    (this.domeMat.uniforms['sunDir']!.value as Vector3).copy(dir);
    (this.domeMat.uniforms['sunDisc']!.value as number | undefined) !== undefined &&
      (this.domeMat.uniforms['sunDisc']!.value = e > -0.2 ? 1 : 0.4);

    const li = a.sunIntensity + (b.sunIntensity - a.sunIntensity) * t;
    const amb = a.ambient + (b.ambient - a.ambient) * t;
    this.sun.color.copy(sunC);
    this.sun.intensity = li;
    this.hemi.intensity = amb;
    // Day fill leans white; night fill stays cool so the dark actually reads
    // blue instead of overcast-brown.
    const fillWhite = e > 0 ? 0.4 : 0.15;
    this.hemi.color.copy(top).lerp(new Color(0xffffff).convertSRGBToLinear(), fillWhite);
    this.hemi.groundColor.copy(horizon).multiplyScalar(0.75);
    this.fog.color.copy(fogC);
    this.fog.density = e < 0 ? 0.00006 : 0.000045;

    this.starsMat.opacity = Math.min(1, Math.max(0, (-e + 0.06) * 2.4));

    // The bounce mirrors the sun across the vertical axis, cooled and dimmed.
    this.bounce.color.copy(top).lerp(new Color(0xffffff).convertSRGBToLinear(), 0.5);
    this.bounce.intensity = li * 0.22;

    if (focus) {
      this.dome.position.copy(focus);
      this.stars.position.copy(focus);
      this.sun.position.copy(focus).addScaledVector(dir, 18000);
      this.sun.target.position.copy(focus);
      this.bounce.position.copy(focus).addScaledVector(
        new Vector3(-dir.x, Math.max(0.25, dir.y * 0.6), -dir.z).normalize(), 15000);
      this.bounce.target.position.copy(focus);
      // Fit the shadow camera around the focus area.
      const cam = this.sun.shadow.camera;
      cam.left = -3800; cam.right = 3800; cam.top = 3800; cam.bottom = -3800;
      cam.updateProjectionMatrix();
    }
  }
}

// The cat and the hunters — stylized low-poly figures, readable at tactical
// zoom, animated procedurally (bob, sway, stride). No asset files: geometry
// is built in code, so the game stays a single self-contained bundle.

import {
  BoxGeometry, CapsuleGeometry, ConeGeometry, Group, Mesh,
  MeshStandardMaterial, PointLight, SphereGeometry
} from 'three';

const catBody = new MeshStandardMaterial({ color: 0xc9973f, roughness: 0.85 });
const catDark = new MeshStandardMaterial({ color: 0x7a5a28, roughness: 0.9 });
const hunterSkin = new MeshStandardMaterial({ color: 0x5a3a26, roughness: 0.95 });
const hunterWrap = new MeshStandardMaterial({ color: 0x8a2f23, roughness: 0.95 });
const spearMat = new MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9 });

/** The player: a big cat, ~2.4m nose to tail. World scale is meters. */
export class Cat {
  readonly group = new Group();
  private tail: Mesh;
  private head: Mesh;
  private phase = 0;

  constructor() {
    // A low, long silhouette: deep chest, tucked waist, shoulders proud.
    const chest = new Mesh(new CapsuleGeometry(0.44, 0.9, 4, 8), catBody);
    chest.rotation.z = Math.PI / 2;
    chest.position.set(0.3, 0.88, 0);
    chest.castShadow = true;
    const haunch = new Mesh(new CapsuleGeometry(0.38, 0.55, 4, 8), catBody);
    haunch.rotation.z = Math.PI / 2;
    haunch.position.set(-0.62, 0.82, 0);
    haunch.castShadow = true;

    this.head = new Mesh(new SphereGeometry(0.3, 8, 6), catBody);
    this.head.position.set(1.12, 1.22, 0);
    this.head.castShadow = true;
    const muzzle = new Mesh(new BoxGeometry(0.3, 0.17, 0.24), catDark);
    muzzle.position.set(1.34, 1.12, 0);
    const earL = new Mesh(new ConeGeometry(0.09, 0.16, 4), catDark);
    earL.position.set(1.03, 1.45, 0.14);
    const earR = earL.clone();
    earR.position.z = -0.14;

    this.tail = new Mesh(new CapsuleGeometry(0.06, 1.15, 3, 6), catDark);
    this.tail.rotation.z = Math.PI / 2.35;
    this.tail.position.set(-1.15, 1.05, 0);

    const mkLeg = (x: number, z: number, thick: number) => {
      const leg = new Mesh(new CapsuleGeometry(thick, 0.62, 3, 6), catDark);
      leg.position.set(x, 0.38, z);
      leg.castShadow = true;
      return leg;
    };
    this.group.add(chest, haunch, this.head, muzzle, earL, earR, this.tail,
      mkLeg(0.72, 0.24, 0.1), mkLeg(0.72, -0.24, 0.1),
      mkLeg(-0.68, 0.26, 0.13), mkLeg(-0.68, -0.26, 0.13));

    // Figures read as specks at tactical zoom without a scale boost.
    this.group.scale.setScalar(3.2);
  }

  /** dt seconds; `moving` drives the gait bob. */
  update(dt: number, moving: boolean): void {
    this.phase += dt * (moving ? 9 : 1.6);
    const bob = Math.sin(this.phase) * (moving ? 0.1 : 0.02);
    const chest = this.group.children[0]!;
    const haunch = this.group.children[1]!;
    chest.position.y = 0.88 + bob;
    haunch.position.y = 0.82 - bob * 0.7; // counter-bob: the rocking gallop
    this.tail.rotation.x = Math.sin(this.phase * 0.7) * 0.25;
    this.head.position.y = 1.22 + bob * 0.6;
  }
}

/** The band: five walkers in single file, a spear each, a fire at night. */
export class HunterBand {
  readonly group = new Group();
  readonly fire: PointLight;
  private figures: Group[] = [];
  private fireCore: Mesh;
  private phase = 0;

  constructor() {
    for (let i = 0; i < 5; i++) {
      const fig = new Group();
      const torso = new Mesh(new CapsuleGeometry(0.22, 0.75, 3, 6), i === 0 ? hunterWrap : hunterSkin);
      torso.position.y = 1.15;
      torso.castShadow = true;
      const head = new Mesh(new SphereGeometry(0.17, 6, 5), hunterSkin);
      head.position.y = 1.85;
      const legs = new Mesh(new CapsuleGeometry(0.16, 0.7, 3, 6), hunterSkin);
      legs.position.y = 0.45;
      const spear = new Mesh(new CapsuleGeometry(0.03, 2.1, 3, 5), spearMat);
      spear.position.set(0.3, 1.35, 0);
      spear.rotation.z = 0.12;
      fig.add(torso, head, legs, spear);
      // Single file with slight stagger.
      fig.position.set(-i * 2.6, 0, (i % 2 === 0 ? 1 : -1) * 0.5);
      this.figures.push(fig);
      this.group.add(fig);
    }
    this.group.scale.setScalar(3.2);

    this.fire = new PointLight(0xff8c3a, 0, 260, 1.8);
    this.fire.position.y = 2;
    this.fireCore = new Mesh(
      new ConeGeometry(0.5, 1.1, 6),
      new MeshStandardMaterial({
        color: 0xff9c4a, emissive: 0xff7020, emissiveIntensity: 2.4, roughness: 1
      })
    );
    this.fireCore.position.y = 0.5;
    this.fireCore.visible = false;
    this.group.add(this.fire, this.fireCore);
  }

  /** Camped hunters stop and light the fire; walking hunters stride. */
  update(dt: number, camped: boolean): void {
    this.phase += dt * 5.5;
    this.figures.forEach((f, i) => {
      f.position.y = camped ? 0 : Math.abs(Math.sin(this.phase + i * 1.1)) * 0.14;
    });
    this.fire.intensity = camped ? 260 + Math.sin(this.phase * 2.3) * 40 : 0;
    this.fireCore.visible = camped;
    if (camped) this.fireCore.scale.setScalar(1 + Math.sin(this.phase * 2.3) * 0.12);
  }
}

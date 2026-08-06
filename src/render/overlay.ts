// Decision-surface overlay: the reach contour (where this phase's legs can
// carry you) and the chosen path. Instanced discs hug the terrain at nav
// nodes; a raised line strip draws the route preview.

import {
  BufferGeometry, CircleGeometry, Color, DynamicDrawUsage, InstancedMesh,
  Line, LineBasicMaterial, Matrix4, MeshBasicMaterial, Vector3
} from 'three';
import type { NavNode } from '../world/nav';
import { METERS_PER_MILE } from '../world/nav';

const MAX_NODES = 12000;

const trotColor = new Color(0xf5d08a).convertSRGBToLinear();
const pushColor = new Color(0xd88f4a).convertSRGBToLinear();

export class ReachOverlay {
  readonly mesh: InstancedMesh;
  readonly pathLine: Line;
  private mat = new Matrix4();

  constructor() {
    const disc = new CircleGeometry(34, 10);
    disc.rotateX(-Math.PI / 2);
    const material = new MeshBasicMaterial({
      transparent: true, opacity: 0.34, depthWrite: false
    });
    this.mesh = new InstancedMesh(disc, material, MAX_NODES);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;

    this.pathLine = new Line(
      new BufferGeometry(),
      new LineBasicMaterial({ color: 0xfff0cf, transparent: true, opacity: 0.95 })
    );
    this.pathLine.frustumCulled = false;
    this.pathLine.renderOrder = 5;
  }

  /** Show the reach map; nodes within the trot budget read brighter/warmer. */
  show(reach: Map<string, NavNode>, trotMiles: number): void {
    let i = 0;
    const trotCost = trotMiles * METERS_PER_MILE;
    for (const n of reach.values()) {
      if (i >= MAX_NODES) break;
      this.mat.makeTranslation(n.x, Math.max(n.sample.height, n.sample.waterSurface) + 1.5, n.z);
      this.mesh.setMatrixAt(i, this.mat);
      this.mesh.setColorAt(i, n.cost <= trotCost ? trotColor : pushColor);
      i++;
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.mesh.visible = true;
  }

  hide(): void {
    this.mesh.visible = false;
    this.hidePath();
  }

  showPath(path: NavNode[]): void {
    const pts = path.map((n) =>
      new Vector3(n.x, Math.max(n.sample.height, n.sample.waterSurface) + 4, n.z));
    this.pathLine.geometry.dispose();
    this.pathLine.geometry = new BufferGeometry().setFromPoints(pts);
    this.pathLine.visible = true;
  }

  hidePath(): void {
    this.pathLine.visible = false;
  }
}

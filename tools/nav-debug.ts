// Renders trot/push reach contours over the biome map around an origin, so
// barrier behavior (cliffs wall, rivers ford, thickets shrink reach) can be
// verified headlessly.
//
// Run: npx tsx tools/nav-debug.ts [seed] [originXm] [originZm]

import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Biomes } from '../src/world/biomes';
import { Nav, GRID, nodeKey, METERS_PER_MILE } from '../src/world/nav';
import { writePng } from './png';

const seed = Number(process.argv[2] ?? 7);
const ox = Number(process.argv[3] ?? 0);
const oz = Number(process.argv[4] ?? 0);

const TROT_MILES = 3.5, PUSH_MILES = 6.5;

const biomes = new Biomes(seed);
const nav = new Nav(biomes);

const t0 = Date.now();
const reach = nav.reach(ox, oz, PUSH_MILES);
const ms = Date.now() - t0;

let trotN = 0;
for (const n of reach.values()) if (n.cost <= TROT_MILES * METERS_PER_MILE) trotN++;
console.log(`reach: ${reach.size} nodes (${trotN} at trot) in ${ms}ms`);

// Render an ~24km window centred on the origin.
const px = 600;
const metersPerPx = 24000 / px;
const rgb = new Uint8Array(px * px * 3);
const sunX = -0.55, sunY = 0.62, sunZ = -0.55;

for (let j = 0; j < px; j++) {
  const z = oz + (j - px / 2) * metersPerPx;
  for (let i = 0; i < px; i++) {
    const x = ox + (i - px / 2) * metersPerPx;
    const w = biomes.sample(x, z);
    let r: number, g: number, b: number;
    if (w.waterDepth > 0) {
      const d = Math.min(1, w.waterDepth / 10);
      r = 40 - d * 18; g = 96 - d * 38; b = 118 - d * 34;
    } else {
      const e = metersPerPx;
      const hx = biomes.field.height(x + e, z) - w.height;
      const hz = biomes.field.height(x, z + e) - w.height;
      const nx = -hx / e, ny = 1, nz = -hz / e;
      const len = Math.hypot(nx, ny, nz);
      const li = 0.35 + Math.max(0, (nx * sunX + ny * sunY + nz * sunZ) / len) * 0.75;
      r = 165 * li; g = 148 * li; b = 105 * li;
    }
    const node = reach.get(nodeKey(Math.round(x / GRID), Math.round(z / GRID)));
    if (node) {
      if (node.cost <= TROT_MILES * METERS_PER_MILE) { g = Math.min(255, g + 70); r = Math.min(255, r + 30); }
      else { r = Math.min(255, r + 60); g = Math.min(255, g + 30); }
    }
    const o = (j * px + i) * 3;
    rgb[o] = r; rgb[o + 1] = g; rgb[o + 2] = b;
  }
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'debug');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `nav-${seed}-${ox}-${oz}.png`);
writePng(out, px, px, rgb);
console.log(out);

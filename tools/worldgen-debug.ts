// Renders a top-down hillshaded map of the heightfield to a PNG so terrain
// quality can be judged without a browser. Cheap by design: one small image,
// a couple seconds of CPU, no loops.
//
// Run: npx tsx tools/worldgen-debug.ts [seed] [kmAcross] [pixels]

import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Heightfield } from '../src/world/heightfield';
import { writePng } from './png';

const seed = Number(process.argv[2] ?? 1);
const kmAcross = Number(process.argv[3] ?? 36);
const px = Number(process.argv[4] ?? 720);

const field = new Heightfield(seed);
const metersPerPx = (kmAcross * 1000) / px;
const rgb = new Uint8Array(px * px * 3);

// Sun from the northwest for hillshading.
const sunX = -0.55, sunY = 0.62, sunZ = -0.55;

function shade(x: number, z: number, h: number): number {
  const e = metersPerPx;
  const hx = field.height(x + e, z) - h;
  const hz = field.height(x, z + e) - h;
  // Normal of the surface (dx, dz are slope rises over e meters).
  const nx = -hx / e, ny = 1, nz = -hz / e;
  const len = Math.hypot(nx, ny, nz);
  return Math.max(0, (nx * sunX + ny * sunY + nz * sunZ) / len);
}

let minH = Infinity, maxH = -Infinity, waterPx = 0, beltPx = 0;

for (let j = 0; j < px; j++) {
  const z = (j - px / 2) * metersPerPx;
  for (let i = 0; i < px; i++) {
    const x = (i - px / 2) * metersPerPx;
    const s = field.sample(x, z);
    minH = Math.min(minH, s.height); maxH = Math.max(maxH, s.height);

    let r: number, g: number, b: number;
    if (s.waterDepth > 0) {
      waterPx++;
      // Depth-tinted water.
      const d = Math.min(1, s.waterDepth / 10);
      r = 40 - d * 18; g = 96 - d * 38; b = 118 - d * 34;
    } else {
      const t = Math.min(1, Math.max(0, (s.height - (-30)) / 480));
      // Savannah gold -> dry brush -> rock -> pale crest, valued by hillshade.
      if (t < 0.18) { r = 178; g = 152; b = 88; }
      else if (t < 0.42) { r = 150; g = 128; b = 82; }
      else if (t < 0.72) { r = 128; g = 114; b = 98; }
      else { r = 168; g = 160; b = 150; }
      const li = 0.35 + shade(x, z, s.height) * 0.75;
      r *= li; g *= li; b *= li;
      if (s.belt > 0) beltPx++;
    }
    const o = (j * px + i) * 3;
    rgb[o] = Math.min(255, r); rgb[o + 1] = Math.min(255, g); rgb[o + 2] = Math.min(255, b);
  }
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'debug');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `world-${seed}-${kmAcross}km.png`);
writePng(out, px, px, rgb);

console.log(`seed ${seed}, ${kmAcross}km across, ${px}px`);
console.log(`height range: ${minH.toFixed(1)}m .. ${maxH.toFixed(1)}m`);
console.log(`water: ${(100 * waterPx / (px * px)).toFixed(1)}% of area, mountain belts: ${(100 * beltPx / (px * px)).toFixed(1)}%`);
console.log(out);

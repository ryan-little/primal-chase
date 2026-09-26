// Paints terrain chunks off the main thread so walking never hitches.
import { Terrain } from './terrain.js';

let T = null;
self.onmessage = (e) => {
  const { seed, cx, cy } = e.data;
  if (!T || T.seed !== seed) T = new Terrain(seed);
  const r = T.chunkPixels(cx, cy);
  self.postMessage({ seed, cx, cy, ...r }, [r.types.buffer, r.lv.buffer, r.biomes.buffer, r.rgba.buffer]);
};

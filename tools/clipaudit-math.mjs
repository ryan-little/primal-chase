// Pure-math re-derivation of art-trees.js acacia()/canopy() pad extents, to cross-check
// the pixel-scan clipping findings by an independent method (no canvas/browser involved).
function rng(seed) {
  let s = seed >>> 0;
  const f = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (a, b) => a + f() * (b - a);
  f.int = (a, b) => Math.floor(a + f() * (b - a + 1));
  return f;
}

function acacia(seed, flat) {
  const r = rng(seed);
  const w = flat ? 104 : 88, h = flat ? 66 : 72;
  const tx = w / 2 + r.range(-3, 3);
  const forkY = h - r.range(16, 22);
  r.range(-2, 2); // line jitter (consumed, unused for extent)
  const n = flat ? r.int(5, 6) : r.int(3, 5);
  const span = flat ? r.range(70, 84) : r.range(44, 58);
  const top = flat ? r.range(16, 20) : r.range(18, 26);
  const tips = [];
  for (let i = 0; i < n; i++) {
    const ex = w / 2 + (i / (n - 1) - 0.5) * span + r.range(-3, 3);
    const ey = top + r.range(-2, 3) + Math.abs(i / (n - 1) - 0.5) * (flat ? 4 : 8);
    r.range(-3, 3); // mx jitter consumed (my has no random call)
    tips.push([ex, ey]);
  }
  const pads = [];
  for (const [ex, ey] of tips) {
    pads.push([ex, ey - 1, r.range(9, 13) * (flat ? 1.1 : 1), r.range(3.5, 5)]);
    pads.push([ex + r.range(-8, 8), ey - r.range(2, 4), r.range(6, 9), r.range(3, 4)]);
  }
  pads.push([w / 2, top - 1, span / 2 + 4, flat ? 4 : 5]);
  let minX = Infinity, maxX = -Infinity;
  for (const [cx, , rx] of pads) { minX = Math.min(minX, cx - rx); maxX = Math.max(maxX, cx + rx); }
  return { w, h, minX, maxX, overflowLeft: Math.max(0, -minX), overflowRight: Math.max(0, maxX - w) };
}

console.log('Umbrella (flat acacia), canvas width 104:');
for (const s of [16, 17, 18]) {
  const a = acacia(s, true);
  console.log(`  seed ${s}: pad extent x=[${a.minX.toFixed(1)}, ${a.maxX.toFixed(1)}]  overflowLeft=${a.overflowLeft.toFixed(1)}px  overflowRight=${a.overflowRight.toFixed(1)}px`);
}
console.log('Acacia (non-flat), canvas width 88:');
for (const s of [11, 12, 13, 14]) {
  const a = acacia(s, false);
  console.log(`  seed ${s}: pad extent x=[${a.minX.toFixed(1)}, ${a.maxX.toFixed(1)}]  overflowLeft=${a.overflowLeft.toFixed(1)}px  overflowRight=${a.overflowRight.toFixed(1)}px`);
}

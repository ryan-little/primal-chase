// The redrawn sprite set, assembled. Each module builds one family; the result mirrors the shape of
// the original buildArt() (cat, gazelle, ..., hunter[], props{}, landmarks{}, tallgrass, icons) so it
// can replace it once the renderer learns about the new sets and the sway frames.
const MODULES = ['cat', 'predators', 'hoofed', 'birds', 'human', 'acacia', 'trees', 'plants', 'rocks', 'landmarks'];

function merge(into, from) {
  for (const k of Object.keys(from)) {
    const v = from[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof HTMLCanvasElement) && into[k] && typeof into[k] === 'object' && !Array.isArray(into[k]) && !('ox' in v)) merge(into[k], v);
    else into[k] = v;
  }
  return into;
}

// Returns { art, timings, missing }. A module that fails to load or build is reported, not fatal.
export async function buildArt2() {
  const art = {}, timings = {}, missing = [];
  for (const name of MODULES) {
    try {
      const mod = await import(`./${name}.js`);
      const t0 = performance.now();
      merge(art, mod.build());
      timings[name] = Math.round(performance.now() - t0);
    } catch (e) {
      missing.push(name + ': ' + (e && e.message ? e.message : e));
    }
  }
  return { art, timings, missing };
}

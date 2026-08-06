# STATUS — read me first when resuming

Updated: 2026-08-06 (iteration 6 of the goal loop)

## Where things stand

- **GOAL.md** — the mandate and definition of done. Read it.
- **docs/DECISIONS.md** — every V1/Opus system: kept/replaced and why. Done.
- **docs/DESIGN.md** — the full blueprint (continuous terrain, fog of war,
  renderer plan, code layout, milestones M1–M10). Done.
- **M1 scaffold: done.** Vite 6 + TS strict + three.js 0.179 via npm; `npm run build`
  produces a working static `dist/` (relative base). `src/app.ts` is a throwaway
  smoke-test scene proving the pipeline — replace as real systems land.
- **M2 content port: done.** All V1 prose verbatim in `src/content/` (typed,
  tested). Regenerate with `node tools/port-content.mjs` if ever needed.
- **M3 worldgen: heightfield core done.** `src/world/{rng,noise,heightfield}.ts`:
  seeded analytic terrain — linear mountain ranges (belt zero-contours, 1 octave!),
  meandering rivers gated by a drainage field (dry country exists), lakes,
  dry channels. Inspect visually: `npx tsx tools/worldgen-debug.ts <seed> <km> <px>`
  → `debug/*.png` (Read the PNG). Heights: plains ±30m, crests ~680m, water ~5%.
- **M3b biomes + nav: done.** `src/world/biomes.ts` maps every point to a
  V1 terrain id (all 32 reachable; distributions inspected via the biome PNG,
  ~46% open plain on seed 7, dry/wet/burned/rocky country all present, point
  features: baobab/kopje/termite/elephant-path). `src/world/nav.ts`: 220m
  8-connected lattice, Dijkstra reach in effective miles (terrain move ×
  slope² factor × wading), cliffs & deep water impassable — verified visually
  (`npx tsx tools/nav-debug.ts <seed> <x> <z>`): ranges wall movement, rivers
  ford only where shallow, lakes route around. Reach ~150-250ms/turn.
  **Task #4 remaining:** landmark (signature/rare) placement — deferred to the
  encounter-engine work in Task #6 where its binding logic lives.
- **M4a renderer foundation: done.** `src/render/{palette,terrain,sky}.ts` +
  viewer in `src/app.ts`. Chunked terrain meshes (2048m/96-quad chunks, ring
  radius 5, budgeted async builds), biome vertex colors + slope rock + variation,
  water surfaces with depth tint, sky dome shader (NOTE: custom ShaderMaterials
  MUST `#include <tonemapping_fragment>` + `<colorspace_fragment>` or they
  bypass ACES/sRGB — this was a real bug), sun/moon/hemisphere driven by one
  elevation scalar with palette stops, stars, FogExp2, shadows. Night is
  legible (high blue moon). **Screenshot loop works:** `npm run build` then
  `node tools/screenshot.mjs "seed=7&x=0&z=0&sun=0.55&dist=2600&yaw=3.9" out.png`
  → debug/out.png (uses real GPU via Playwright chromium; ~15s round trip).
- **M4b fog of war: done.** `src/render/fogwar.ts` — horizon-walk LOS over a
  cached 384² height grid (64m texels, ~24km region), RG texture
  (explored/visible), dilate+blur to close ray stipple, elevation advantage
  extends sight (sqrt-scaled), night pulls radius to ~38%. attachFog() patches
  built-in materials via onBeforeCompile: unknown = deep shadow w/ faint
  relief, remembered = drained 42%, visible = full. Verified by screenshots:
  LOS shadows behind hills; night = small moonlit pool (the thesis shot).
  Viewer: `&fow=1` puts the eye at the focus.
  **Task #5 remaining:** vegetation instancing, water animation, weather,
  cat + hunter entities, post chain (vignette escalation), quality tiers,
  near-ground mesh detail, fog region recentering/persistent explored store.
- **M5 sim core: done.** `src/sim/{config,hunters,encounters,monologue,game}.ts`
  — pure logic, zero three.js, runs headless. V1 balance constants; gaits as
  per-effort-mile rates (full push = V1 push); reach budgets spend EFFORT
  miles, hunter separation uses REAL miles (rough ground = less ground per
  effort, and slows hunters via terrain factor); scent-based trail breaks;
  corner-cutting via trail-walk hunter position; escalation/tracking/water
  boost verbatim V1; encounter engine BINDS terrain layer to arrival ground
  (fallback kin-card map for ids without V1 cards); monologue selection
  verbatim semantics, seeded RNG throughout → fully deterministic runs.
  19 tests inc. unwinnability smoke batch (12 runs, ~2s).
  **Task #6 remaining:** landmark placement (signatures/rares as visible
  world destinations) + wiring the sim to the renderer for a playable turn
  loop in the browser (with Task #7's UI).

## Environment quirks (this machine)

- **No system Node.** Portable Node 22 lives at `C:\Users\ryan\tools\node`.
  In bash: `export PATH="/c/Users/ryan/tools/node:$PATH"` before npm/npx.
- GPUs: NVIDIA RTX 5070 Ti laptop (target) + AMD 880M iGPU. Renderer requests
  `high-performance`.
- Hardware mandate: no long CPU-heavy runs; balance sims in short batches only.
- Reference repos (do not modify): `..\Primal-Chase` (V1.9 original),
  `..\Primal-Chase-Opus` (Opus hex-3D rewrite, branch v2-3d).
- Playwright not yet installed — set up for screenshot verification when the
  renderer starts landing (use it with the real GPU, headed or
  `--use-angle=default`, not CPU rasterization).

## Task board (harness TaskList mirrors this)

1. ✅ Study + design docs
2. ✅ Scaffold (this commit)
3. ⬜ Content port (encounters/monologue/hunters prose → typed TS in src/content)
4. ⬜ Worldgen (heightfield, hydrology, biomes, nav lattice + debug PNG export)
5. ⬜ Renderer (terrain/water/sky/fog-of-war/post)
6. ⬜ Sim core + turn loop
7. ⬜ UI/UX
8. ⬜ Audio
9. ⬜ Balance (budgeted sims) + percentiles
10. ⬜ Ship + Ryan sign-off

## Next iteration (suggested order)

Start Task #3 (content port — mechanical, unlocks everything) and/or Task #4
worldgen core with headless debug renders. Worldgen debug: write a Node script that
exports top-down biome/height/river PNGs so generation quality is inspectable
without a browser.

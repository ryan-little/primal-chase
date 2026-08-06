# STATUS — read me first when resuming

Updated: 2026-08-06 (iteration 3 of the goal loop)

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

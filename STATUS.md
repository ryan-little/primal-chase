# STATUS — read me first when resuming

Updated: 2026-08-06 (iteration 14 of the goal loop)

- **M12 ship-prep: share card (canvas 1200x630, native share sheet or
  download), achievements on the death screen (7, stat-driven), README with
  both deploy paths (GitHub Pages subtree + Caddy on the Mac mini), mobile
  viewport verified (tools/mobile-check.mjs: title + intro flow at 390x844
  with touch). Task #7 UI/UX: COMPLETE.

- **M11 balance: done (sim-side).** test/balance/run.ts (`npm run sim [N] [emit]`,
  ~1s/run — keep batches ≤200). Findings + fixes this round:
  (1) FROZEN-TURN BUG: commitAction on a key a signature encounter doesn't
  offer returns null — policies must fall back (fixed in harness; impossible
  for humans via HUD). (2) hunter.maxDistance=32 — kiting can't outrun
  escalation forever. (3) trackers LEARN: break chance ×0.72^losses, tracking
  spells shorten — river-country chain-breaking is bounded. (4) passive
  hunger 3.5→3.0 (terrain-true encounters make food rarer than V1's deck).
  Result: smart p25/50/75/90 = 6/7/10/12 days, random = 4/5/6/7, zero
  survivors, all five causes present. Percentiles emitted →
  src/content/percentiles.ts; death screen shows "outlasted X% of runs".
  Remaining for #9: Ryan's playtest feel check.

- **M10 audio: done (tuning by ear pending Ryan's playtest).**
  src/audio/soundscape.ts — fully synthesized Web Audio: wind (LFO-breathing
  lowpassed brown noise) + high wind, day insects, night cricket chirp train,
  water proximity, rain hiss, hunter drums under 7mi quickening as they
  close, heartbeat under danger, footsteps on the run, phase swells, trail-
  break relief notes, death tones. Gated on first user gesture; 'Sound'
  option in Options. No assets, nothing fetched.

- **M9 renderer polish A:** sky-bounce fill light (no more crushed-black
  slopes), animated water glint (time uniform via generalized FogInjection
  API), hunter-proximity escalation (CSS vignette + canvas desaturation —
  V1's stages, spatialized), rain layer on storm pressures, quality tiers
  (low/medium/high/auto: DPR, shadows, vegetation density).
  Task #5 remaining: entity quality (cat/hunter models are primitive),
  near-ground mesh detail, more weather (dust/fireflies/lightning),
  fog texel staircase softening.

- **M8 framing UI: done.** Title (live world behind, slow orbit), how-to,
  options (difficulty/quality/typewriter/tutorial/reduced-motion,
  localStorage), leaderboard ("Past Lives"), intro sequence (V1's three
  openings, typewriter honoring the option), scoring + local top-10 with
  rank on the death screen, keyboard (Enter/Esc/R). ?test=1 boots straight
  into play for the harness. Task #7 remaining: share card, achievements
  display, touch polish pass, prose typewriter option in-game.
- **M7 vegetation + landmarks: done.** Instanced flora per chunk from the
  biome field; landmarks (monolith/great baobab/arch/cairn) as deterministic
  sparse sites with fog-piercing beacons; arriving forces an unused signature
  encounter (test-covered). Task #6 core gameplay: COMPLETE.

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
- **M6 playable skeleton: done.** `src/game/app.ts` + `src/ui/{hud,style.css}`
  + `src/render/{entities,overlay}.ts`. Click land inside reach → path +
  cost preview → Run → animated move, sun sweep, fog recompute, hunters
  reposition (visible only in sight), encounter + monologue update, death
  screen with V1 death prose. Viewer moved to `?mode=view`. Automated
  playtest: `node tools/playtest.mjs <seed> <turns>` — plays real turns via
  window.__pc hooks, screenshots each state. Verified 4 turns on seed 7 inc.
  a ground trail-break.
- **M6b fixes (iteration 8):** reach is now a shader FIELD (src/render/
  reachfield.ts — cost texture tinting trot/push zones with contour rim,
  painted in the same material patch as fog); standard push/trot signature
  buttons removed (movement on the map IS that decision); hunter flavor only
  re-rolls when the situation changes; new-game start scan requires true
  open country (flat grassland, no belt/river/basin) so the opening pool is
  wide; boot camera auto-aims across the cat into the most-visible ground.
  **Known issues for polish:** fog boundary shows 64m texel staircase (soften
  or raise fog texture res); reach compute blocks main thread ~200ms;
  signature choices with non-push/trot null-effect keys (e.g. 'opposite')
  still grant abstract miles without map movement.

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

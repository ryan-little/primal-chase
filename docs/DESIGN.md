# Primal Chase — Fable design

Companion to GOAL.md (the mandate) and DECISIONS.md (system-by-system verdicts).
This is the blueprint the build follows.

## One paragraph

You are the last of something, running. The land is continuous and real: mountains
you can climb for the sight of water, rivers that will carry your scent away, thorn
country that costs you more than it costs them. You see only what your eyes can see —
the rest of the world is memory or blank parchment. Twice a day you choose where your
body goes, and every choice is paid for in heat, legs, water, and meat. Behind you,
always, the hunters: a dust plume over the ridge at noon, a point of firelight in the
black at night, and one morning, close enough to see their eyes. The game cannot be
won. The score is how long the land keeps you.

## Spatial model

- **Continuous heightfield**, sampled from layered noise + ridge/valley shaping,
  deterministic per seed. World streams in chunks around the player; far chunks evict.
- **Navigation lattice:** fine hex-lattice sampling of the heightfield (~0.15 mi
  spacing) used only for pathfinding/reach — invisible to the player. Costs per step:
  base biome cost × slope factor; cliffs and deep water are impassable; fords/passes
  emerge naturally as cheap corridors.
- **Reach contour:** each turn, Dijkstra from the player position with two budgets —
  **Trot** (≈3.5 effective miles) and **Push** (≈6.5). Rendered as two soft contour
  lines on the terrain. Click/tap inside → path preview (line on ground + cost card:
  Δheat/stamina/thirst/hunger, hunter gain, trail-break odds) → confirm → the run plays.
- **Scale:** ~0.5 world units per meter conceptually; tuning free. Miles are the
  player-facing unit, as in V1.

## World generation

Layers, all seeded:
1. **Continent shape** — domain-warped low-frequency base; optional ocean at one rim
   (the land ends somewhere; the chase does not).
2. **Mountain ranges** — ridged multifractal along tectonic-ish spline belts; passes
   where belts pinch low. Peaks are *tall* — multiple hundreds of feet of visual relief.
3. **Hydrology** — rivers traced downhill from range shoulders with carving; lakes
   fill closed basins; wetlands at low gradient outflows. Water is the strategic
   center of the game and must read from a distance.
4. **Moisture/biome** — distance-to-water + elevation + latitude-noise → biome field:
   riverine forest, savannah grassland, thorn scrub, salt flat / clay pan, dunes,
   burned lands, rocky highland, kopje fields, high stone.
   Every V1 terrain id maps to (biome, local feature) so all prose stays reachable.
5. **Features & landmarks** — baobabs, kopjes, caves, arches, termite cities placed
   by biome with spacing control; signature-encounter landmarks placed sparse and
   visible; rare landmarks rarer.
6. **Trails** — game trails and elephant paths as cheap movement corridors,
   faint in the render.

## Fog of war

- Visibility field over the world, three states: **unseen / remembered / visible**.
- Line-of-sight from eye height over the heightfield, radius scaled by elevation
  advantage, time of day (night radius much smaller), and weather.
- Remembered terrain: static relief, desaturated/parchment grade, no entities, no
  current encounter info. Unseen: sculpted "unknown" treatment (dark ground-fog card,
  not hard black).
- Hunters render only when visible; otherwise indirect cues: dust plume (day, if their
  position's sky is in your view), fire glow + smoke column (night), vulture circles,
  audio bed. Tracker bar keeps V1's felt-distance reading at all times.
- Implementation: R8 visibility texture in world XZ (two channels: explored, visible),
  updated on turn resolve (GPU pass or incremental CPU), sampled by terrain/water/
  vegetation/entity materials; soft temporal blend on state changes.

## Renderer

three.js (npm, tree-shaken), WebGL2, `powerPreference: 'high-performance'`.

- **Terrain:** chunked geo-clipmap-style LOD; custom ShaderMaterial: biome splat
  colors, slope-based rock exposure, cavity/AO bake per chunk, subtle macro-variation
  noise; stylized-painterly grade (bold hue families per biome, valued like a
  gouache landscape rather than photo texture).
- **Water:** planar surfaces per body + river ribbons; depth-tinted color, animated
  normal flow, shore foam line, sun glint; scent-carrying water is *visibly* moving.
- **Sky/atmosphere:** gradient dome driven by sun position (analytic Preetham-lite),
  sun/moon discs, star field, height fog with sun scatter color; dawn/dusk are the
  showpiece transitions between phases.
- **Lighting:** single sun/moon directional + hemisphere; cascaded or tight-fitted
  shadow map following camera; night is legible (mandate: the board is the interface).
- **Vegetation/scenery:** instanced grass (wind-swayed, biome-tinted, fades by
  distance), low-poly stylized trees per biome, rocks; density by biome and quality tier.
- **Entities:** the cat and the hunter band as stylized low-poly rigs with simple
  procedural gait animation; dust puffs at their feet; hunters carry visible spears;
  night camp = fire point light + smoke sprite.
- **Post:** ACES tonemap, subtle bloom, vignette + desaturation tied to hunter
  proximity (V1's escalation, done in-camera), optional film grain whisper. FXAA/MSAA
  by tier.
- **Weather:** rain sheets, heat shimmer, dust devils, pollen, fireflies, lightning —
  ported concepts from V1's DOM weather into the 3D scene, driven per-biome.
- **Quality tiers:** low/medium/high/ultra — DPR cap, shadow size, draw distance,
  vegetation density, post toggles; auto-pick with manual override; must hold 60fps
  on an iGPU at low.

## Camera

Follow camera behind/above the cat, user-orbitable within limits, smart framing that
leads toward open decision space (Opus's leadDistance idea, kept). Pinch/scroll zoom
between near-shoulder and tactical overview — but the overview is capped low enough
that fog of war, not the camera, bounds knowledge. Cinematic moves on phase change
and death.

## The turn

1. **Read** — arrival prose + monologue for where you stand; encounter actions offered.
2. **Decide** — move (pick point in reach) or in-place verb (Rest/Drink/Eat/encounter
   verbs with % odds and risk text, exactly V1's economy).
3. **Watch** — the run animates (~2–4s, skippable), sun arcs, visibility updates,
   hunters advance along their own pathing; spatial events surface as one-line notes
   (trail broken at the river; they cut your corner).
4. **Arrive** — new prose, new monologue, vitals settle, phase flips.

## Content binding

Ported verbatim from V1 into `src/content/` as typed data:
- 32 terrain encounter entries → keyed by (biome, feature) of arrival point
- 52 opportunities filtered by terrain compatibility (kept)
- 22 pressures (kept; injury/weather/hunter-sign/decay categories drive monologue)
- 40 signatures → landmark-bound; rares → rare landmarks
- 387 monologue fragments with V1's selection keys
- hunter flavor text bands by distance/state/phase (kept; extended with
  visibility-aware variants: seen vs sensed)

## Audio

Procedural-first Web Audio graph: pink-noise wind shaped by altitude/biome/weather,
granular insect chorus (day) and crickets (night), water proximity loop, rain,
distant thunder, footfall ticks on move, heartbeat layer under critical vitals,
sparse kalimba-ish note motifs on landmarks/deaths (taste-tested; cut if it cheapens
tone). Hunter proximity bed: low drums/voices at <5 mi, audible direction via pan.
Master mute + volume in options; nothing plays before first gesture.

## Code layout

```
src/
  content/    ported prose data (typed, no logic)
  sim/        pure game logic: state, turn resolve, hunters, encounters, scoring
              (no three.js imports — runs headless in Node for tests/balance)
  world/      seeded generation: heightfield, hydrology, biomes, features, nav lattice
  render/     three.js: terrain, water, sky, vegetation, entities, fx, post, fogwar
  ui/         DOM HUD, screens, input, options, leaderboard, share card
  audio/
  main.ts     boot, capability gate, loop
test/         vitest: sim correctness + budgeted balance batches
```

`sim/` + `world/` (minus meshes) must run in Node — that is what makes balance
simulation cheap and heat-safe.

## Performance & hardware care (dev-time)

- Balance sims: pure logic, batches capped (~2000 runs/batch, seconds each), never
  looped unattended.
- Browser testing on this laptop uses the RTX GPU (high-performance context), not
  CPU rasterization; screenshots via Playwright against the real GPU where possible.
- No long dev-server watch storms; vitest run mode (not watch) in loops.

## Milestones (map to Tasks #2–#10)

M1 scaffold → M2 content port → M3 worldgen (headless-verifiable heightfield/biome/
hydrology with debug top-down PNG export) → M4 renderer core (terrain/sky/water/
camera) → M5 sim core + turn loop wired → M6 fog of war → M7 entities + hunters
visualized → M8 UI/screens → M9 weather/audio/post polish → M10 balance + ship.
Each milestone ends with a committed, runnable state and STATUS.md update.

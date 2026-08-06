# Decision log — every system reconsidered

Format: what V1/Opus did → verdict → what Fable does and why.
This file satisfies GOAL.md "definition of done" item 3.

## World model

**Opus:** axial hex grid, 3.25 mi/hex, terrain id per hex, prism rendering, whole map visible.
**Verdict: replaced.**
**Fable:** continuous heightfield world. Movement is "pick a destination inside your
reach contour" — reach computed by Dijkstra over a fine navigation lattice with
slope- and biome-weighted costs, budgeted in miles (trot ≈ 3.5 mi effective, push ≈ 6.5 mi).
The hex board read as a board game; a continuous land reads as a place. V1's mile-based
balance maps cleanly onto path-integrated miles, so the tuned economy survives.

## Terrain literalism

**Opus:** height field with ±0.95 hex height variation over a 4.2 scale — visually near-flat.
Water = translucent flat cap on a hex.
**Verdict: replaced.** (This is an explicit mandate item.)
**Fable:** dramatic relief — real mountain ranges (impassable cliffs, costly slopes,
vantage rewards), carved river valleys, lakes filling real depressions, wetlands.
Water is an animated surface with depth color and shore treatment; rivers are barriers
with fords/crossings. Biome placement is driven by elevation/moisture so the encounter
prose matches what you literally see.

## Fog of war (new system, mandated)

**V1/Opus:** none — the whole board was always visible.
**Fable:** three visibility states: *unseen* (terrain hidden under an "unknown land"
treatment), *remembered* (explored: relief visible, desaturated, no live entities),
*visible* (live). Visibility is elevation-aware line-of-sight: high ground sees far,
valleys are blind. This turns mountains into an information resource — pay the climb to
see where water is and where they are — and makes hunters dreadful: an exact position
only when you can see them; otherwise cues (dust plume over a ridge by day, fire-glow
at night, a felt distance in the tracker bar — a predator always half-knows).

## Hunters

**V1:** scalar miles + escalation/tracking state machine. **Opus:** kept the scalar,
derived a board position by walking back along the player's trail; scent per terrain;
trail-break odds on print-poor ground; corner-cutting on doubled-back routes.
**Verdict: kept in spirit — Opus's spatialization is genuinely good — rebuilt on the
continuous world.** Hunters are entities following your actual path with their own
movement costs. Kept: escalation per day and per trail loss (the "they come back
faster" dread), tracking/fan-out state, water boost, scent per ground type, corner
cutting. Improved: they interact with fog of war (see above), their flavor text keyed
to real spatial situations (they crest the ridge you crossed at dawn), and at night
their camp is a firelight point in the dark.

## Turn structure & pacing

**V1/Opus:** two phases per day (day/night), one action per phase.
**Verdict: kept.** It is the heartbeat of the game and the balance is tuned around it.
The phase transition becomes a cinematic beat: sun arc, light change, the world's
answer to your move.

## Vitals

**V1/Opus:** heat, stamina, thirst, hunger, hunter distance; five death causes.
**Verdict: kept.** The four-vital economy is the best-tuned thing in the game.
Presentation redesigned (see UI). Terrain roughness surcharge from Opus kept,
computed from the actual path profile (climbing costs).

## Encounters & prose

**V1:** 3-layer combinatorial system (terrain × opportunity × pressure) + 40 signatures
+ rares. **Opus:** bound terrain layer to the hex's terrain id; signatures as landmarks.
**Verdict: content kept verbatim; binding deepened.** All prose ported into typed TS
data. The arrival point's biome/feature selects the terrain layer, so the text always
describes the land you're standing on. Signatures/rares are placed landmarks, visible
(when not fogged) and chooseable — Opus's best replayability idea, kept and made
legible by the fog: a strange silhouette on the horizon you *haven't* visited yet.

## Monologue & narration

**V1/Opus:** 387 fragments, selection keyed to state; typewriter option.
**Verdict: kept verbatim, presentation elevated.** The writing is the soul.

## Scoring, achievements, leaderboard, share

**V1/Opus:** local leaderboard, percentiles from sim tables, share card canvas.
**Verdict: kept, rebuilt in TS.** Percentile tables regenerated for the new balance
(budgeted sim). Spatial achievements kept/extended.

## Difficulty

**V1/Opus:** easy/normal/hard overrides. **Verdict: kept.**

## Rendering

**Opus:** three.js Lambert flat-shaded vertex-colored merged hex mesh, one sun light,
linear fog, no post-processing, simple primitive scenery.
**Verdict: replaced wholesale.** See DESIGN.md §Renderer: custom terrain shader
(biome splat, slope rock), real water, sky/atmosphere model, day/night lighting,
instanced wind-blown vegetation, post chain (ACES, subtle bloom, proximity vignette),
fog-of-war compositing, quality tiers, `powerPreference: 'high-performance'`.

## UI

**Opus:** DOM HUD over canvas; V1 screens restyled.
**Verdict: rebuilt.** DOM-over-canvas stays (right call — accessible, cheap), but
designed this time: typographic hierarchy worthy of the prose, diegetic-leaning HUD,
mobile-first layout, reduced-motion support kept.

## Audio (new system)

**V1/Opus:** none.
**Fable:** procedural Web Audio soundscape — wind by biome and altitude, insects by
day/night, water proximity, hunter cues by distance (drums? feet? breath — taste TBD),
heartbeat at critical vitals. All synthesized or CC0-embedded; mutable; off until
first user gesture (autoplay policy anyway).

## Classic text version

**Dropped entirely** per Ryan. Preserved in the Primal-Chase and Primal-Chase-Opus repos.

## Toolchain

**Opus:** no build step, classic scripts + ES modules, vendored three.js, content as
globals. **Verdict: replaced.** Vite + TypeScript + three.js from npm, vitest for logic tests,
static `dist/` with relative base. Portable Node at `C:\Users\ryan\tools\node`
(this machine has no system Node).

## Balance verification

**V1:** 5 rounds of mass simulation. **Opus:** headless-Edge DOM sims.
**Verdict: replaced with cheap, budgeted Node sims.** Game logic is pure TS with no
renderer dependency, so thousands of runs take seconds of CPU, run in short batches
(heat mandate). No browser in the loop for balance.

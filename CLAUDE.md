# Primal Chase

## Project Overview

A text-based, browser-playable survival strategy game. You play as an apex predator (big cat) being persistence-hunted by prehistoric humans. The game is intentionally unwinnable — the goal is to survive as many days as possible.

**Tech stack:** Vanilla HTML/CSS/JS. No frameworks, no build step, no dependencies. Single `index.html` entry point.

**Hosting:** GitHub Pages via `ryan-little/primal-chase`. Custom domain `primalchase.com` (Cloudflare DNS). Game Analytics dashboard at `primalchase.com/stats/`.

**Git workflow:** `main` branch for deployment (GitHub Pages). `v1` branch for development.

**Current status:** V1.7 — live at primalchase.com. Game analytics dashboard deployed at /stats/.

## Critical Rules

### Balance Numbers in Config ONLY

**ALL game balance numbers MUST live in `js/config.js`.** Never hardcode balance values (distances, stat costs, speeds, multipliers, thresholds) anywhere else in the codebase. Every tunable number must be referenced from the CONFIG object. This is non-negotiable — the owner needs to tweak balance constantly without reading game logic.

### No Frameworks, No Dependencies

This is a zero-dependency project. Do not add npm, package.json, build tools, or any external libraries. Everything is vanilla HTML/CSS/JS loaded via `<script>` tags.

### Mobile-Friendly

All actions must be clickable buttons, not text input. The game should work on mobile browsers.

## Architecture

### File Structure

```
PrimalChase/
├── index.html          ← single entry point, loads all scripts
├── css/
│   └── style.css       ← atmospheric styling, savannah textures, night mode, animations
├── js/
│   ├── config.js       ← ALL balance numbers and tunable constants (LOAD FIRST)
│   ├── encounters.js   ← combinatorial generator (32 terrains, 52 opportunities, 22 pressures) + signature + rare
│   ├── monologue.js    ← internal monologue system (182 fragments, mood/event/day/nightOnly-tagged)
│   ├── hunters.js      ← hunter pursuit/tracking/escalation logic + flavor text (6 per tier per phase)
│   ├── game.js         ← core game loop, state machine, phase transitions, action history tracking
│   ├── ui.js           ← DOM rendering, Options system (typewriter/situation toggles), typewriter engine, screen transitions
│   └── score.js        ← scoring, localStorage leaderboard, share card generation, percentile stats
├── assets/
│   ├── primalchaselogo.png       ← randomly selected on title screen
│   ├── primalchaselogoout.png    ← randomly selected on title screen
│   └── primalchaselogoreign.png  ← randomly selected on title screen
├── stats/
│   ├── index.html      ← Game Analytics dashboard (deployed at /stats/)
│   └── results/
│       └── latest.json ← simulation data for the dashboard
├── test/
│   ├── simulate.js     ← reusable simulation engine (runs N games with configurable strategies)
│   ├── report.js       ← ASCII report generator with charts
│   ├── charts.html     ← Game Analytics dashboard (dev copy, same as stats/index.html)
│   ├── baseline-stats.json ← sorted arrays from 3000 sim runs (used for percentile calculations)
│   └── results/        ← timestamped simulation outputs and latest-report.txt
├── docs/               ← reference docs, not deployed
│   └── plans/
│       └── 2026-02-13-primal-chase-v1-design.md
└── CLAUDE.md           ← this file
```

### Script Load Order

Scripts must be loaded in this order in index.html:
1. `config.js` — constants and balance numbers
2. `encounters.js` — encounter data and generator
3. `monologue.js` — monologue fragments and selector
4. `hunters.js` — hunter state machine
5. `game.js` — core loop (depends on all above)
6. `ui.js` — rendering (depends on game state)
7. `score.js` — scoring and sharing (depends on game state + ui)

### Game State

The game state is a single object managed in `game.js`:

```js
{
  day: 1,
  phase: 'day' | 'night',
  heat: 0,
  stamina: 100,
  thirst: 0,
  hunger: 0,
  hunterDistance: 25,
  hunterSpeed: CONFIG.hunter.baseSpeed,
  hunterState: 'pursuit' | 'tracking',
  hunterWaterBoostDays: 0,
  trackingDaysLeft: 0,
  timesLostHunters: 0,
  distanceCovered: 0,
  currentEncounter: null,
  monologue: null,
  lastAction: null,
  lastOutcome: null,
  isAlive: true,
  deathCause: null,
  achievementStats: { nightPushes, timesRested, phasesWithHighThirst, phasesNearDeath },
  actionHistory: [],    // last 5 actions: { day, phase, action, statChanges, hunterGap }
  narrativeLog: []      // full log of all actions (for future personalized death messages)
}
```

### HTML Layout Structure

```
┌──────────────────────────────────────────┐
│ Phase transition overlay (sun/moon arc)  │ ← fixed, z-100, CSS animation
├──────────────────────────────────────────┤
│ Game start transition ("The chase...")   │ ← fixed, z-200, fade overlay
├──────────────────────────────────────────┤
│ PHASE HEADER (DAY X / NIGHT X)          │
├──────────────┬───────────────────────────┤
│ VITALS 2x2   │ HUNT INFO                 │ ← .game-top grid
│ Heat|Stamina │ "Hunters are X mi behind" │
│ Thirst|Hunger│ "You have covered X mi"   │
├──────────────┴───────────────────────────┤
│ SITUATION + MONOLOGUE (scrollable)       │ ← .situation-scroll, flex:1
├──────────────────────────────────────────┤
│ ACTION BUTTONS                           │ ← flex-shrink:0, scrolls on mobile
└──────────────────────────────────────────┘
```

## Game Design Reference

### Core Loop

Each turn = 1 day with DAY phase then NIGHT phase. Player makes one action per phase.

### Actions

| Action | Distance | Available | Notes |
|--------|----------|-----------|-------|
| Push | CONFIG value (~6mi day, less at night) | Always | Heavy stat cost |
| Trot | CONFIG value (~3mi day, less at night) | Always | Moderate stat cost |
| Rest | 0 | Always | Recover heat + stamina, hunters gain |
| Drink/Dig | 0 | Situational | Reset thirst, hunters gain |
| Eat/Scavenge | 0 | Situational | Reset hunger + half thirst, hunters gain |

**Action buttons show TOTAL real effect** (action effects + passive drains combined) so what the player sees is what actually happens.

### Night Phase Differences

- Reduced heat costs (CONFIG.nightMultipliers.heat)
- Reduced thirst costs (CONFIG.nightMultipliers.thirst)
- Hunters only gain passively (they camp at night) — much less distance gain
- Background shifts to dark blue/indigo with star dots (body.night-mode CSS class)
- Terrains show `nightText` variant instead of `text`
- Night-only monologue fragments and pressures can appear

### Hunter System

- Base speed 5.5 with terrain/situation modifiers
- **Daily escalation**: +0.1 speed per day (hunters learn and adapt)
- Can be "lost" via specific encounters → enter tracking mode (1-3 days, reduced speed)
- On trail recovery: speed escalates by CONFIG.hunter.escalationPerLoss (0.8)
- Night gain: 0.8 (hunters camp but still close gap slightly)
- Water boost: hunters speed up when player drinks (they find the water source)
- The game is guaranteed unwinnable long-term due to escalation
- Flavor text: 6 variants per distance tier per phase (far/medium/close/very close/critical + tracking)

### Encounter System (Hybrid)

**Layer 1 — Combinatorial:** Terrain (32) + Opportunity (52) + Pressure (22) = unique situation with contextual actions. Each terrain has `text` and `nightText` variants. Pressures include night-only and condition-gated variants. Recent buffers: terrains=10, opportunities=12, pressures=7.

**Layer 2 — Signature:** ~50 hand-crafted encounters that override the generator. Max once per run. Some day-gated.

**Layer 3 — Rare:** <1% chance legendary events.

**Rest mechanic:** Resting keeps the same terrain but re-rolls opportunity and pressure (via `Encounters.regenerateSameLocation()`). For signature/rare encounters, the same encounter is re-presented.

### Internal Monologue

182 tagged fragments selected by: mood (confident/concerned/desperate/haunted), day range, trigger event, current vitals, nightOnly flag. Displayed between action result and next decision. Recent buffer prevents repeats.

### Death Conditions

- Caught: hunter distance <= 0
- Heatstroke: heat >= 100%
- Exhaustion: stamina <= 0%
- Dehydration: thirst >= 100%
- Starvation: hunger >= 100%

Each has 3 unique narrative death screen texts (in DEATH_NARRATIVES in ui.js).

### Visual Style

- Dark earthy palette: deep brown background (#1a0f08), amber/orange text (#d4883a)
- Savannah texture: SVG noise grain + warm gradient base + grass-like repeating lines
- Night mode: dark blue/indigo gradient with star-like radial dots
- Status bars with color transitions (green → amber → red)
- Day/night transition: `.night-bg` overlay div fades opacity over 2s (CSS can't animate gradients)
- Sun/moon celestial arc animation on phase transitions (1.5s CSS animation)
- "The chase begins..." fade-in/out game start transition
- Death screen: typewriter narrative finishes before score/buttons appear (JS-driven `.death-results-visible` class)
- Title screen: random logo selection from 3 variants, staggered fade-in
- Stable-layout typewriter: renders full text invisible (`color: transparent` via `.tw-hidden`), reveals progressively — no reflow on centered text
- Six screens: Title, Game, Death, Leaderboard, How-to-Play, Options

### Percentile Stats

On death, the player sees "You survived longer than X% of runs" and "Your distance was farther than X% of runs". Pre-computed breakpoints from 3000 simulation runs (6 strategies x 500 games) are embedded in `BASELINE_PERCENTILES` in score.js. Update by re-running `node test/simulate.js --games=500 --strategy=all` and computing new breakpoints.

### Share Card

Two formats:
1. **Clipboard text** — formatted score summary with achievements
2. **Image** — Canvas API renders score card (gradient background, no logo to avoid canvas tainting on file://). Copies to clipboard on HTTPS (secure context), falls back to PNG download on file://.

### Leaderboard

Local only (localStorage). Top 10 runs. Displayed on "The Longest Strides" screen.

## Simulation & Testing

The simulation engine (`test/simulate.js`) is a reusable tool for balance testing:

```bash
# Run full simulation (1000 games x 6 strategies x 3 difficulties)
node test/simulate.js --games=1000 --strategy=all --difficulty=all

# Run normal-only simulation
node test/simulate.js --games=500 --strategy=all

# Generate ASCII report
node test/report.js

# Open charts dashboard locally
open test/charts.html

# After sim: copy updated data to deployed stats page
cp test/results/latest.json stats/results/latest.json
cp test/charts.html stats/index.html
```

**Strategies:** push-heavy, trot-heavy, balanced, rest-heavy, smart (stat-urgency heuristic), GTO (expected-value optimizer)

**Difficulty flag:** `--difficulty=all|easy|normal|hard` (default: `normal`). Output is always nested by difficulty: `{ "normal": { ... }, "easy": { ... }, "hard": { ... } }`. Baseline stats for percentiles computed from normal data only.

**Current balance (from latest sim — Normal difficulty):**
- Balance tweaks in V1.7: eat thirst reset reduced (-50→-30), night heat drain reduced (-10→-8), day rest heat reduced (-25→-20)
- GTO strategy: avg ~10-11 days, median 10-11, max ~23
- Smart strategy: avg ~8-9 days, median 9
- Death distribution: dehydration dominant, caught ~30%, exhaustion ~20%, starvation ~10%, heatstroke ~2-3%

**After balance changes:** Re-run simulation, compute new percentile breakpoints, and update `BASELINE_PERCENTILES` in score.js.

## Version History

### V1.1 — Core Game Complete
All 8 implementation phases complete: simulation engine, stat display honesty, encounter text, UI/layout overhaul, visual polish, content additions, hunter balance tuning, percentile stats.

### V1.2 — Visual Refresh
- Full-width layout (1200px max, no border/shadow)
- Title screen redesign: horizontal buttons (Learn to Run | Start the Hunt | The Longest Strides) with weathered styling
- Typewriter cinematic intro (dark overlay, character-by-character typing, skippable)
- Removed intro paragraph from title screen
- Keyboard shortcuts (1-5) for action buttons
- "THE LAND" and "INNER VOICE" section labels
- Scaled-up game elements, centered situation text
- Background revert (CSS-only landscape was too simple — will revisit with generated assets)

### V1.3 — Options, Tutorial, Typewriter & Transitions
- Options screen with persistent localStorage settings (difficulty, show opening, typewriter effect)
- 3 randomized intro paragraph sets (confidence → unease → dread → flight)
- Death screen: Return to Title button + typewriter on death narrative
- Typewriter effect on situation text with action button lockout
- Phase transition animation: bars animate over 1.5s, 2s action lockout, background color shift
- Tutorial Day 1: fixed encounters for Day phase ("The Ridge") and Night phase ("First Darkness")
- CONFIG: typewriter speeds + transition durations

### V1.4 — Polish & First Shippable Version
- Removed action history sidebar; hunt info now uses natural language ("Hunters are X miles behind")
- Day/night background transition via opacity-based `.night-bg` overlay (2s fade)
- Stable-layout typewriter engine: text typed in-place without reflow (invisible-first approach)
- Situation typewriter: encounter text types in per-phase, with separate on/off toggle in Options
- Death screen: narrative typewriter finishes before score/buttons appear
- Options restructured: speed slider on its own row, situation typewriter sub-toggle, mobile-friendly layout
- Action buttons: centered alignment, dimmed (not opacity) when disabled, non-sticky on mobile
- Share image: gradient-only canvas (avoids tainting), clipboard copy on HTTPS, download fallback
- Learn to Run page rewritten with 2-column grid, all game mechanics, full achievements list
- GTO simulation strategy added (expected-value optimizer, avg 10.4 days)
- Percentile breakpoints refreshed from 3000-game simulation dataset

### V1.5 — Analytics Dashboard & Creator Credit
- "A game by Ryan Little" credit on title screen, "Made by Ryan Little" on death screen (links to ryan-little.com)
- Game Analytics dashboard: renamed from Balance Lab, collapsible sections, deployed at primalchase.com/stats/
- Encounter frequency analysis: HTML/CSS bar charts showing terrain, opportunity, and pressure distribution
- All 8 missing opportunity IDs filled in (mouse_nest, hippo_territory, regrowth_shoots, aardvark_hole, bark_water, mosquito_swarm, frog_chorus, herd_distant)
- Encounter frequency tracking added to simulation engine, ASCII report, and dashboard
- GTO label properly capitalized throughout

### V1.6 — Share Card & Codebase Cleanup
- Share card redesign: savannah gradient background, noise grain texture, border frame, better typography, tighter spacing
- 8 rotating taglines on share card (randomized per generation)
- Removed non-functional death overlay red tint (CSS + HTML)
- Removed dead terrain modifier code from hunters.js (currentTerrain was never set; terrain-based hunter modifiers deferred to V2)
- Removed orphaned CONFIG values (mountainPenalty, junglePenalty, plainBoost)
- Fixed hardcoded CONFIG values in GTO simulation strategy — now reads from sandbox.CONFIG
- Added disabled guard to action button click handlers
- CSS cleanup: removed unused variables (--bg-savannah, --border-light), duplicate .howto-content strong rule, orphaned .situation-label selector, unused .text-center utility, redundant media query overrides
- Replaced hardcoded hex colors with CSS variables in typewriter styles
- Removed unused sparkline() function from report.js
- Removed unused variables from charts.html dashboard (CSS, shown)
- GitHub issue #1 closed (share image clipboard works on HTTPS)

### V1.7 — Difficulty System, Balance Tweaks, Situation-Aware Monologues & Dashboard Overhaul
- **Difficulty system**: Easy / Normal / Hard modes with CONFIG overrides applied at game start
  - `CONFIG.difficulty.easy` and `CONFIG.difficulty.hard` override starting distance, hunter speed, escalation, passive drains
  - `CONFIG._base` snapshot at load time; `Game.applyDifficulty(level)` restores base then deep-merges overrides
  - Options screen: all 3 difficulty buttons now functional, selection persists in localStorage
- **Balance tweaks** (Normal mode): night heat drain -10→-8, day rest heat -25→-20, eat thirst -50→-30 (day+night)
  - Removed vestigial `drinkAvailableChance`, `eatAvailableChance`, `loseHuntersChance` from CONFIG.encounters
- **Simulation**: `--difficulty` flag (`all|easy|normal|hard`), output nested by difficulty level
  - Baseline stats computed from normal-difficulty data only
- **Dashboard overhaul**: TOC 4-column grid, collapsed-by-default sections, difficulty analysis section with summary cards + comparison table + auto-generated insights
- **Dashboard filter system**: difficulty + strategy dropdowns in summary bar; selecting either re-renders entire dashboard (all charts, tables, distributions) with filtered data; section collapse states preserved across re-renders; fade-in animations only on first load
  - `build(diffKey, stratKey)` is parameterized and re-callable; `render()` wrapper saves/restores UI state
  - Single-strategy view hides "Best Strategy" metric, simplifies death analysis to single bar chart, removes per-strategy distribution rows
- Internal monologue system now terrain-aware and pressure-aware (~100 new fragments, ~280 total)
- Terrain categories in CONFIG: water, open, dense, rocky, shelter — mapped to terrain IDs
- Pressure categories in CONFIG: injury, weather, hunter_sign, decay — mapped to pressure IDs
- getTriggers() extended: generates `terrain_*` and `pressure_*` triggers from current encounter
- New fragment types: terrain-reactive, pressure-reactive, combined triggers (e.g. open+hunters_close), extra general mood
- Combined trigger fragments fire on specific terrain+state combos (e.g. water+high_thirst, shelter+near_death)
- Version badge (v1.7): fixed bottom-right corner, visible on all screens, subtle/unobtrusive
- Feedback email link on death screen: "Have an idea or found a bug? Let me know!" above creator credit

## Content Guidelines

The writing tone is atmospheric and primal. Think Cormac McCarthy meets nature documentary. The animal is intelligent but not human — it thinks in sensation, instinct, and growing unease. Avoid modern language or humor. Everything should feel ancient, inevitable, and earned.

## Known Issues

None currently tracked.

## Future Ideas (V2+)

- Personalized death tips based on narrativeLog
- Full narrative recap per game
- Multiple animal species
- Actual map/territory system
- Sound design / ambient audio
- Terrain-based hunter speed modifiers (hunters faster on open plains, slower in dense terrain — adds strategic layer to fleeing direction)
- Web-hosted percentile comparison (not just local sim data)
- stats.primalchase.com subdomain for analytics (currently at /stats/)

# Primal Chase

## Project Overview

A text-based, browser-playable survival strategy game. You play as an apex predator (big cat) being persistence-hunted by prehistoric humans. The game is intentionally unwinnable — the goal is to survive as many days as possible.

**Tech stack:** Vanilla HTML/CSS/JS. No frameworks, no build step, no dependencies. Single `index.html` entry point.

**Hosting:** GitHub Pages via `ryan-little/primal-chase`. Custom domain `primalchase.com` planned.

**Git workflow:** `main` branch holds docs/context. `v1` branch for development. Merge to main when V1 is complete.

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
│   └── style.css       ← atmospheric styling, status bars, layout
├── js/
│   ├── config.js       ← ALL balance numbers and tunable constants (LOAD FIRST)
│   ├── game.js         ← core game loop, state machine, phase transitions
│   ├── encounters.js   ← combinatorial generator + signature encounters + rare events
│   ├── monologue.js    ← internal monologue system (mood/event/day-tagged fragments)
│   ├── hunters.js      ← hunter pursuit/tracking/escalation logic
│   ├── ui.js           ← DOM rendering, screen transitions, status bar updates
│   └── score.js        ← scoring, localStorage leaderboard, share card generation
├── assets/
│   ├── primalchaselogo.png
│   ├── primalchaselogoout.png    ← used on title screen
│   └── primalchaselogoreign.png
├── docs/               ← reference docs, not deployed
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
  trackingDaysLeft: 0,
  timesLostHunters: 0,
  distanceCovered: 0,
  currentEncounter: null,
  monologue: null,
  isAlive: true,
  deathCause: null
}
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

### Night Phase Differences

- Reduced heat costs (CONFIG.nightMultipliers.heat)
- Reduced thirst costs (CONFIG.nightMultipliers.thirst)
- Hunters only gain passively (they camp at night) — much less distance gain
- No situational eat/drink actions at night (for V1)

### Hunter System

- Base speed with terrain/situation modifiers
- Can be "lost" via specific encounters → enter tracking mode (1-3 days, reduced speed)
- On trail recovery: speed escalates by CONFIG.hunter.escalationPerLoss
- The game is guaranteed unwinnable long-term due to escalation

### Encounter System (Hybrid)

**Layer 1 — Combinatorial:** Terrain feature + Opportunity + Pressure modifier = unique situation with contextual actions. Data lives in `encounters.js`.

**Layer 2 — Signature:** ~50 hand-crafted encounters that override the generator. Max once per run. Some day-gated.

**Layer 3 — Rare:** <1% chance legendary events.

### Internal Monologue

Tagged fragments selected by: mood (confident/concerned/desperate/haunted), day range, trigger event, current vitals. Displayed between action result and next decision.

### Death Conditions

- Caught: hunter distance <= 0
- Heatstroke: heat >= 100%
- Exhaustion: stamina <= 0%
- Dehydration: thirst >= 100%
- Starvation: hunger >= 100%

Each has unique narrative death screen text.

### Visual Style

- Dark earthy palette: deep brown background (#2a1a0e), amber/orange text (#d4883a)
- Status bars with color transitions (green → amber → red)
- Atmospheric, dusty, primal feel matching the pixel-art logos
- Three screens: Title, Game, Death

### Share Card

Two formats:
1. **Clipboard text** — formatted score summary with achievements
2. **Image** — Canvas API renders score text over dimmed/cropped logo, downloadable as PNG

### Leaderboard

Local only (localStorage). Top 10 runs. Displayed on "The Longest Strides" screen.

## Design Doc

Full design document with all details: `docs/plans/2026-02-13-primal-chase-v1-design.md`

## Content Guidelines

The writing tone is atmospheric and primal. Think Cormac McCarthy meets nature documentary. The animal is intelligent but not human — it thinks in sensation, instinct, and growing unease. Avoid modern language or humor. Everything should feel ancient, inevitable, and earned.

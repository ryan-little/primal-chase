# Architecture

## System Diagram

```
index.html
    │
    ├── css/style.css        ← all styling, night mode, animations, weather
    │
    └── js/ (loaded in order)
        ├── config.js        ← ALL balance numbers (single source of truth)
        ├── encounters.js    ← 3-layer encounter generator
        ├── monologue.js     ← 387 tagged fragments, contextual selection
        ├── hunters.js       ← pursuit/tracking state machine + flavor text
        ├── game.js          ← core loop, state machine, phase transitions
        ├── ui.js            ← DOM rendering, typewriter, screen management
        └── score.js         ← scoring, leaderboard, share card, percentiles
```

## Components

| Component | Location | Responsibility |
|-----------|----------|----------------|
| Config | `js/config.js` | All balance numbers, difficulty overrides, terrain/pressure categories |
| Encounters | `js/encounters.js` | Combinatorial generator (32x52x22) + signature + rare encounters |
| Monologue | `js/monologue.js` | 387 fragments selected by mood, vitals, terrain, triggers |
| Hunters | `js/hunters.js` | Pursuit/tracking state, escalation, water boost, flavor text |
| Game | `js/game.js` | Core loop, state object, phase transitions, action processing |
| UI | `js/ui.js` | DOM rendering, typewriter engine, 6 screens, options, death narratives |
| Score | `js/score.js` | Scoring, localStorage leaderboard, Canvas share card, percentiles |
| Simulation | `test/simulate.js` | Offline balance testing (5 strategies, 3 difficulties) |
| Dashboard | `stats/index.html` | Game Analytics visualization (deployed at /stats/) |

## Game State

Single object managed in `game.js`:

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
  lastActionSucceeded: null
}
```

## HTML Layout

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

## Data Flow

1. Player selects action → `game.js` processes state changes (stats, distance, hunter movement)
2. `encounters.js` generates next situation (terrain + opportunity + pressure, or signature/rare override)
3. `monologue.js` selects contextual fragment based on mood, vitals, terrain, triggers
4. `ui.js` renders updated vitals, situation text, monologue, action buttons with computed effects
5. On death → `score.js` computes percentile rank against embedded simulation baselines

## Key Design Principles

1. **Config-driven balance** — every tunable number in one file, game logic never hardcodes values
2. **Script load order matters** — no module system; scripts depend on globals from earlier scripts
3. **State in one object** — single game state object in `game.js`, no distributed state
4. **Static site** — no server, no build, no API calls at runtime. Deployed by pushing to main.

## External Dependencies

| Dependency | Purpose | Docs |
|------------|---------|------|
| GitHub Pages | Hosting | Built-in |
| Cloudflare | DNS + domain (primalchase.com) | N/A |
| Node.js (dev only) | Simulation engine (`test/simulate.js`) | Not deployed |

---

*See [CONVENTIONS.md](CONVENTIONS.md) for coding patterns. See knowledge-hub for design decisions and game design reference.*

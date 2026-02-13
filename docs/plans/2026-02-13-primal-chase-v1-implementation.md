# Primal Chase V1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a playable text-based survival game as a single-page web app with no dependencies.

**Architecture:** Vanilla HTML/CSS/JS. All game logic in modular JS files loaded via script tags. All balance numbers isolated in `config.js`. Three screens (Title, Game, Death) managed as DOM visibility toggles. Encounter system uses hybrid approach: combinatorial generator + hand-crafted signature encounters + rare events. Share card uses Canvas API for image generation.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript (ES6+), Canvas API, localStorage

**Parallel Strategy:** Opus generates encounter content, monologue fragments, and death narratives in parallel while Sonnet subagents build the game code. Content is integrated after the code scaffold is ready.

---

## Phase 1: Foundation (Code Scaffold)

### Task 1: Create config.js — All Balance Constants

**Files:**
- Create: `js/config.js`

**Step 1: Write the config object**

This is the single source of truth for ALL game balance. Every number that affects gameplay lives here.

```js
const CONFIG = {
  // Starting conditions
  starting: {
    heat: 0,
    stamina: 100,
    thirst: 0,
    hunger: 0,
    hunterDistance: 25
  },

  // Death thresholds
  death: {
    maxHeat: 100,
    minStamina: 0,
    maxThirst: 100,
    maxHunger: 100,
    minHunterDistance: 0
  },

  // Hunter system
  hunter: {
    baseSpeed: 5,
    trackingSpeed: 2,          // speed while searching for trail
    trackingDuration: { min: 1, max: 3 },  // days in tracking mode
    escalationPerLoss: 0.5,    // speed increase each time trail is re-found
    waterBoost: 1.5,           // speed multiplier after player visits water
    waterBoostDuration: 1,     // days the water boost lasts
    mountainPenalty: 0.7,      // speed multiplier in mountains
    junglePenalty: 0.6,        // speed multiplier in jungle/dense
    plainBoost: 1.2,           // speed multiplier on open plains
    nightGain: 0.5             // distance hunters gain at night (they camp)
  },

  // Day actions
  actions: {
    day: {
      push:  { distance: 6, heat: 20, stamina: -20, thirst: 15, hunger: 10 },
      trot:  { distance: 3, heat: 10, stamina: -10, thirst: 10, hunger: 5 },
      rest:  { distance: 0, heat: -25, stamina: 20, thirst: 0, hunger: 3 },
      drink: { distance: 0, heat: 10, stamina: -5, thirst: -100, hunger: 0 },
      eat:   { distance: 0, heat: 15, stamina: -5, thirst: -50, hunger: -100 }
    },
    night: {
      push:  { distance: 5, heat: 10, stamina: -20, thirst: 8, hunger: 10 },
      trot:  { distance: 2, heat: 5, stamina: -10, thirst: 5, hunger: 5 },
      rest:  { distance: 0, heat: -30, stamina: 25, thirst: 0, hunger: 3 }
    }
  },

  // Distance hunters gain when player does non-movement actions
  hunterGainOnStationaryDay: 5,    // full hunter speed during day
  hunterGainOnStationaryNight: 0.5, // hunters camp at night

  // Passive drains per phase (applied regardless of action)
  passiveDrain: {
    day:   { heat: 5, stamina: 0, thirst: 5, hunger: 3 },
    night: { heat: -10, stamina: 5, thirst: 2, hunger: 3 }
  },

  // Encounter system
  encounters: {
    signatureChancePerPhase: 0.15,   // 15% chance of signature encounter
    rareChancePerPhase: 0.008,       // <1% chance of rare/legendary event
    drinkAvailableChance: 0.3,       // 30% base chance drink action appears
    eatAvailableChance: 0.25,        // 25% base chance eat action appears
    loseHuntersChance: 0.1           // 10% base chance for trail-losing event
  },

  // Score
  score: {
    maxLeaderboardEntries: 10
  }
};
```

**Step 2: Verify file loads**

Open browser console, confirm `CONFIG` is accessible and `CONFIG.starting.hunterDistance === 25`.

**Step 3: Commit**

```bash
git add js/config.js
git commit -m "feat: add config.js with all balance constants"
```

---

### Task 2: Create index.html — Page Structure

**Files:**
- Create: `index.html`

**Step 1: Write the HTML skeleton**

Three screens as `<div>` sections with visibility toggling. All scripts loaded in correct order. Semantic structure matching the design doc's three screens: Title, Game, Death.

The HTML should include:
- `<div id="screen-title">` — logo, intro text, three buttons
- `<div id="screen-game">` — day counter, vitals bars, hunt info, situation text, monologue, action buttons
- `<div id="screen-death">` — death narrative, score, share buttons, replay
- `<div id="screen-leaderboard">` — the longest strides table
- `<div id="screen-howto">` — learn to run instructions
- Script tags in load order: config, encounters, monologue, hunters, game, ui, score
- Link to `css/style.css`
- Meta viewport tag for mobile

**Step 2: Verify page loads**

Open `index.html` in browser. Should see unstyled content. No console errors.

**Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add index.html with screen structure"
```

---

### Task 3: Create style.css — Atmospheric Visual Design

**Files:**
- Create: `css/style.css`

**Step 1: Write the full stylesheet**

Must implement:
- Dark earthy background (#1a0f08 to #2a1a0e gradient)
- Primary text color: warm amber (#d4883a)
- Secondary text: muted gold (#b8944f)
- Danger/red accents for critical states (#c44536)
- Font: system serif stack for narrative, monospace for stats
- Screen visibility: only one screen visible at a time (`.screen { display: none }`, `.screen.active { display: block }`)
- Status bars: horizontal bars with color transitions (green #4a7c3f → amber #d4883a → red #c44536)
- Status bar container with label, percentage, and filled bar
- Action buttons: large, clickable, styled as earthy/bordered buttons with hover states
- Logo image: centered, max-width responsive
- Responsive layout: works on mobile (min 320px) through desktop
- Narrative text: slightly larger, italic for monologue
- Phase indicator styling (DAY in amber, NIGHT in cool blue #6b8cae)
- Subtle text-shadow for atmosphere
- Share card canvas: hidden by default, shown on death screen

**Step 2: Verify styling**

Open in browser. Title screen should have the atmospheric dark/amber look. Status bars should render with color fills. Buttons should be clickable-sized on mobile.

**Step 3: Commit**

```bash
git add css/style.css
git commit -m "feat: add atmospheric styling with earthy savanna palette"
```

---

### Task 4: Create hunters.js — Hunter Pursuit System

**Files:**
- Create: `js/hunters.js`

**Step 1: Write the hunter state machine**

```js
const Hunters = {
  // Calculate hunter distance change for a given player action
  // Returns negative number (hunters gaining) or positive (player gaining)
  calculateDistanceChange(playerDistance, gameState) { ... },

  // Check if a trail-losing event triggers tracking mode
  loseTrail(gameState) { ... },

  // Process tracking mode countdown
  updateTracking(gameState) { ... },

  // Get current effective hunter speed (with all modifiers)
  getEffectiveSpeed(gameState) { ... },

  // Get atmospheric text about hunter proximity
  getHunterFlavorText(distance, hunterState) { ... }
};
```

Key behaviors:
- In pursuit: move at `baseSpeed + (escalationPerLoss * timesLost)` modified by terrain
- In tracking: move at `trackingSpeed` for `trackingDuration` days
- On trail recovery: escalate speed, return to pursuit
- All speed values read from CONFIG
- `getHunterFlavorText` returns different text based on distance ranges:
  - 20+ miles: "You can barely sense them. But they are there."
  - 10-20: "The hunters are a persistent smudge on the horizon."
  - 5-10: "You can see the dust they kick up."
  - 2-5: "You can hear their breathing. The rhythm never breaks."
  - <2: "They are close enough to see your eyes."

**Step 2: Test in console**

Create a mock game state, call `Hunters.getEffectiveSpeed()`, verify it returns CONFIG values.

**Step 3: Commit**

```bash
git add js/hunters.js
git commit -m "feat: add hunter pursuit system with tracking and escalation"
```

---

### Task 5: Create game.js — Core Game Loop

**Files:**
- Create: `js/game.js`

**Step 1: Write the game state machine**

```js
const Game = {
  state: null,

  // Initialize a new game
  newGame() { ... },

  // Process a player action choice
  processAction(actionKey) { ... },

  // Apply passive drains for current phase
  applyPassiveDrains() { ... },

  // Transition from day to night or night to next day
  advancePhase() { ... },

  // Check all death conditions, return cause or null
  checkDeath() { ... },

  // Clamp all stat values to valid ranges (0-100)
  clampStats() { ... },

  // Get available actions for current phase + encounter
  getAvailableActions() { ... },

  // Calculate the actual stat changes for an action (factoring in encounter modifiers)
  calculateActionEffects(actionKey) { ... }
};
```

Key behaviors:
- `newGame()` creates state from CONFIG.starting values
- `processAction()` is the main turn handler:
  1. Apply action effects (from CONFIG + encounter modifiers)
  2. Apply passive drains
  3. Update hunter distance (via Hunters module)
  4. Clamp all stats
  5. Check death conditions
  6. If alive, advance phase
  7. Generate next encounter
  8. Generate monologue
  9. Signal UI to update
- Stats are clamped: heat 0-100, stamina 0-100, thirst 0-100, hunger 0-100
- Negative thirst/hunger from eat/drink clamp to 0 (fully reset)

**Step 2: Test in console**

Call `Game.newGame()`, verify state matches CONFIG.starting. Call `Game.processAction('trot')`, verify stats change by CONFIG values.

**Step 3: Commit**

```bash
git add js/game.js
git commit -m "feat: add core game loop with state machine"
```

---

### Task 6: Create ui.js — Screen Rendering

**Files:**
- Create: `js/ui.js`

**Step 1: Write the UI controller**

```js
const UI = {
  // Show a specific screen, hide all others
  showScreen(screenId) { ... },

  // Render the title screen
  renderTitle() { ... },

  // Render the game screen for current state
  renderGame(gameState) { ... },

  // Render status bars with color transitions
  renderVitals(gameState) { ... },

  // Render hunter information
  renderHunt(gameState) { ... },

  // Render current situation text
  renderSituation(encounter) { ... },

  // Render internal monologue
  renderMonologue(text) { ... },

  // Render action buttons
  renderActions(actions) { ... },

  // Render outcome text after action
  renderOutcome(result) { ... },

  // Render death screen
  renderDeath(gameState) { ... },

  // Render leaderboard
  renderLeaderboard(scores) { ... },

  // Render how-to-play screen
  renderHowTo() { ... },

  // Bind all button click handlers
  bindEvents() { ... }
};
```

Key behaviors:
- Status bars: width percentage matches stat value, background color interpolates green→amber→red
- Action buttons: display action name, distance gain/loss, and stat costs clearly
- Monologue: italic, indented, slightly different color
- Screen transitions: simple show/hide, no animations for V1
- Phase header: "DAY 4" or "NIGHT 4" with appropriate color
- `bindEvents()` wires up: Start button → Game.newGame() + showScreen('game'), action buttons → Game.processAction(), Try Again → Game.newGame(), leaderboard/howto navigation

**Step 2: Verify screens toggle**

Click Start the Hunt → game screen appears. Verify vitals bars render. Verify action buttons are clickable.

**Step 3: Commit**

```bash
git add js/ui.js
git commit -m "feat: add UI controller with screen rendering"
```

---

## Phase 2: Content Integration

> **NOTE:** Tasks 7-9 are CONTENT tasks. These will be generated by Opus in parallel with Phase 1 code tasks, then integrated here.

### Task 7: Create encounters.js — Encounter Data + Generator

**Files:**
- Create: `js/encounters.js`

**Step 1: Write the encounter system**

```js
const Encounters = {
  // Combinatorial building blocks
  terrains: [ /* ~20 terrain objects */ ],
  opportunities: [ /* ~30 opportunity objects */ ],
  pressures: [ /* ~15 pressure objects */ ],

  // Hand-crafted signature encounters (~50)
  signatures: [ /* full encounter objects */ ],

  // Rare/legendary events
  rares: [ /* full encounter objects */ ],

  // Track which signatures have appeared this run
  usedSignatures: new Set(),

  // Generate an encounter for the current phase
  generate(gameState) { ... },

  // Attempt to trigger a signature encounter
  trySignature(gameState) { ... },

  // Attempt to trigger a rare event
  tryRare(gameState) { ... },

  // Assemble a combinatorial encounter
  buildCombinatorial(gameState) { ... },

  // Reset for new game
  reset() { ... }
};
```

Each terrain/opportunity/pressure object has:
- `id`: unique identifier
- `name`: display name
- `text`: narrative fragment (composable into full situation)
- `actions`: array of situational actions this enables (e.g. terrain "dry riverbed" enables {drink} with 50% success)
- `modifiers`: stat modifiers applied to actions (e.g. "shade" gives rest bonus)
- `compatibility`: which other pieces it can/cannot combine with
- `minDay`: earliest day this can appear (for gating advanced content)

Signature encounters override the generator entirely and have:
- `id`, `name`, `text`: full narrative
- `choices`: array of unique action options with outcomes
- `maxOccurrences`: 1 (per run)
- `minDay`: day gate
- `canLoseHunters`: boolean (some signature encounters can lose the trail)

**Step 2: Test encounter generation**

Call `Encounters.generate(mockState)` repeatedly in console, verify variety. Verify signatures don't repeat.

**Step 3: Commit**

```bash
git add js/encounters.js
git commit -m "feat: add encounter system with combinatorial generator and signatures"
```

---

### Task 8: Create monologue.js — Internal Monologue Fragments

**Files:**
- Create: `js/monologue.js`

**Step 1: Write the monologue system**

```js
const Monologue = {
  // Fragment pool tagged by mood, day range, and trigger
  fragments: [ /* large array of tagged monologue strings */ ],

  // Recently used fragments (avoid immediate repeats)
  recentlyUsed: [],

  // Select a monologue for the current state
  select(gameState, lastAction, encounter) { ... },

  // Get mood from day count
  getMood(day) { ... },

  // Reset for new game
  reset() { ... }
};
```

Mood tiers:
- Days 1-3: "confident" — the animal is still in its element
- Days 4-6: "concerned" — something is wrong, these hunters don't stop
- Days 7-10: "desperate" — the body is failing, the mind races
- Days 10+: "haunted" — philosophical, almost resigned, lore questions surface

Each fragment tagged with:
- `mood`: which tier(s) it can appear in
- `triggers`: optional specific triggers (e.g. "after_rest", "low_stamina", "lost_hunters", "near_death")
- `text`: the monologue string

**Step 2: Verify selection**

Call `Monologue.select(mockState)` with different day counts, verify mood-appropriate fragments returned.

**Step 3: Commit**

```bash
git add js/monologue.js
git commit -m "feat: add internal monologue system with mood escalation"
```

---

### Task 9: Populate Death Screen Narratives

**Files:**
- Modify: `js/ui.js` — add death narrative lookup

**Step 1: Add death narratives to the UI death screen renderer**

Five death causes, each with 2-3 narrative variants (selected randomly):
- **Caught** — the hunters finally close the gap
- **Heatstroke** — heat reaches 100%
- **Exhaustion** — stamina reaches 0%
- **Dehydration** — thirst reaches 100%
- **Starvation** — hunger reaches 100%

Use the existing death screen text from the game doc as a starting point, expand with variants.

**Step 2: Verify each death type**

Force each death condition in console, verify unique narrative displays.

**Step 3: Commit**

```bash
git add js/ui.js
git commit -m "feat: add death screen narratives for all five causes"
```

---

## Phase 3: Scoring & Sharing

### Task 10: Create score.js — Leaderboard + Share Cards

**Files:**
- Create: `js/score.js`

**Step 1: Write the scoring system**

```js
const Score = {
  // Calculate final score from game state
  calculate(gameState) { ... },

  // Save score to localStorage
  save(scoreData) { ... },

  // Load leaderboard from localStorage
  loadLeaderboard() { ... },

  // Generate shareable text for clipboard
  generateShareText(scoreData) { ... },

  // Generate shareable image using Canvas API
  generateShareImage(scoreData, callback) { ... },

  // Copy text to clipboard
  copyToClipboard(text) { ... },

  // Download canvas as PNG
  downloadImage(canvas) { ... },

  // Get notable achievements from the run
  getAchievements(gameState) { ... }
};
```

Score data object:
```js
{
  days: 12,
  distance: 42.5,
  deathCause: 'heatstroke',
  timesLostHunters: 2,
  achievements: ['Survived 3 nights without water', ...],
  date: '2026-02-13'
}
```

Share image: Load logo PNG → draw to canvas → apply dark overlay → render score text in game font → export as PNG blob → trigger download.

**Step 2: Verify leaderboard persistence**

Play a game, die, verify score appears in localStorage. Refresh page, verify leaderboard shows saved score.

**Step 3: Verify share card**

Die, click Share → verify text copies to clipboard. Click image share → verify PNG downloads with score overlay.

**Step 4: Commit**

```bash
git add js/score.js
git commit -m "feat: add scoring, localStorage leaderboard, and share card generation"
```

---

## Phase 4: Polish & Integration Testing

### Task 11: End-to-End Playthrough Verification

**Files:**
- Modify: any files that need bug fixes

**Step 1: Full playthrough test**

Play the game start to finish. Verify:
- Title screen loads with logo and intro text
- Start the Hunt begins a game at correct starting stats
- Day phase shows encounter, vitals, actions
- Choosing an action updates stats correctly per CONFIG values
- Night phase follows with correct reduced costs
- Hunter distance changes correctly each phase
- Monologue appears between phases
- Encounters vary between turns
- Situational actions (drink/eat) appear when encounter enables them
- Death triggers at correct thresholds with appropriate narrative
- Score saves to leaderboard
- Share text generates correctly
- Share image generates correctly
- Try Again starts a fresh game
- Leaderboard displays saved scores
- How to Play screen is accessible and accurate

**Step 2: Mobile test**

Open on phone or browser DevTools mobile view. Verify buttons are tappable, text is readable, layout doesn't break.

**Step 3: Fix any issues found**

**Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix: polish and bug fixes from end-to-end testing"
```

---

### Task 12: Push v1 Branch to GitHub

**Step 1: Push**

```bash
git push -u origin v1
```

**Step 2: Verify on GitHub**

Check that `ryan-little/primal-chase` has both `main` and `v1` branches with correct content.

---

## Parallel Content Generation Strategy

While Sonnet subagents execute Tasks 1-6 (code scaffold), Opus generates:

1. **~20 terrain features** with narrative text, compatibility rules, and action enablers
2. **~30 opportunity elements** with narrative text, mechanical effects, and compatibility
3. **~15 pressure modifiers** with narrative text and stat implications
4. **~50 signature encounters** with full narratives, unique choices, outcomes, and day gates
5. **~10 rare/legendary events** with narrative and dramatic outcomes
6. **~100+ monologue fragments** tagged by mood tier, trigger event, and vitals context
7. **~15 death narrative variants** (3 per death cause)
8. **Achievement definitions** — notable run accomplishments for the share card
9. **How to Play text** — explains the game to new players
10. **Title screen intro text** — refined from the existing game doc draft

This content is then integrated during Phase 2 (Tasks 7-9).

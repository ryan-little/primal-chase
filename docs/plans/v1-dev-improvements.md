# V1-Dev Improvements Tracker

**Branch:** `v1-dev` (based on `v1`)
**Date:** 2026-02-24
**Source:** 6-agent playtest audit (desktop playtest, mobile playtest, code review, content review, balance analysis, UX audit)

> **Instructions for agents:** Update the Status column as you work. Use: `PENDING` | `IN PROGRESS` | `DONE` | `SKIPPED (reason)`

---

## BUGS

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| B1 | Critical | **Rare events never deduplicated** — `tryRare()` in encounters.js never adds rare events to `usedSignatures`. `rare_oasis` (full stat reset +40 stamina) and `rare_eclipse` can fire unlimited times per run, breaking the unwinnable design. Fix: add rare event IDs to `usedSignatures` after firing. | DONE |
| B2 | Critical | **Water boost countdown only ticks at night** — `hunterWaterBoostDays` in game.js only decrements during night phase. A day-phase drink gives ~3 phases of boosted hunter speed instead of 1. Fix: decrement in both phases, or change to a phase counter instead of day counter. | DONE |
| B3 | Critical | **Tracking countdown only ticks at night** — `updateTracking()` in game.js is wrapped in `if (this.state.phase === 'night')`. Trail loss during day effectively doubles tracking duration. Fix: call `updateTracking()` every phase, not just night. | DONE |
| B4 | Medium | **Firefly sprites 404** — 9+ missing sprite frames (firefly1-02, firefly1-03, firefly1-07, firefly1-09, firefly1-10, firefly1-11, firefly2-00, firefly2-02, firefly2-03). Check which frames ui.js references vs which files exist in assets/. Either add missing sprites or update code to only reference existing ones. | SKIPPED (all 24 sprites exist — 2 sheets x 12 frames confirmed) |
| B5 | Medium | **Lightning not suppressed by `prefers-reduced-motion`** — CSS `prefers-reduced-motion` block covers rain/fireflies/shaking but misses `#lightning-overlay`. This is a photosensitivity risk. Fix: add `#lightning-overlay` animation suppression to the `prefers-reduced-motion` media query, AND add a JS guard in the lightning trigger function. | DONE |
| B6 | Low | **Night-only opportunities appear during day rests** — `regenerateSameLocation()` doesn't filter the nightOnly flag when re-rolling opportunities. Fix: add nightOnly check in the regenerate path. | DONE |
| B7 | Low | **`perfectRunner` achievement permanently unreachable** — the field is never set in `achievementStats`. Either implement the tracking logic or remove the achievement. | DONE (removed unreachable achievement) |
| B8 | Low | **`sig_wounded_animal` stalk gives `distance: -2`** — player moves backward. Should be `distance: 0` (you're stalking, not retreating). Fix in encounters.js. | DONE |
| B9 | Low | **`recentPressures` not initialized at top of Encounters object** — only exists after `reset()` is called. If encounter generation runs before reset, throws TypeError. Fix: declare `recentPressures: []` in the Encounters object literal. | DONE |
| B10 | Low | **Duplicate text** — "Ribcage arches from the earth like a ruined cathedral" appears verbatim in both `bones` opportunity text and `sig_elephant_graveyard` signature text. Rewrite one of them. | DONE |

## DEAD CODE CLEANUP

| ID | Description | Status |
|----|-------------|--------|
| D1 | `statChanges` object computed every turn in game.js but never used — remove it | DONE |
| D2 | `special: 'reveals_hunter_speed'` on high-ground encounter in encounters.js — never processed by any code. Remove the property. | DONE |
| D3 | `special: 'storm'` on storm_approaching pressure in encounters.js — never processed. Remove the property. | DONE |
| D4 | `loseHuntersAvailable` flag computed on every encounter object but never read — remove from encounter generator | DONE |

## MOBILE UX

| ID | Priority | Description | Status |
|----|----------|-------------|--------|
| M1 | High | **Action buttons below fold** — on iPhone 14 (390x844), only Push is visible. Trot starts at 853px, Rest at 954px. Fix: add `max-height` on `.situation-scroll` in the mobile media query (e.g., `max-height: 35vh; overflow-y: auto`) so action buttons remain visible. Also add a subtle scroll indicator (fade gradient or down chevron) above the action buttons if situation text is scrollable. | DONE |
| M2 | Medium | **Options screen touch targets too small** — difficulty buttons 35px tall, toggles 32x56px. Apple HIG minimum is 44px. Increase to `min-height: 44px` in the mobile media query. | DONE |
| M3 | Medium | **Stat bar values 9.1px** — unreadable on mobile. Increase `.status-value` font size to at least 11px on mobile. Also increase `.status-label` from 10.5px to at least 11px. | DONE |
| M4 | Low | **How-to-Play back button only at bottom** — add a sticky "Back" button at top of the How-to-Play screen, or add a floating back button. | DONE |

## ACCESSIBILITY

| ID | Priority | Description | Status |
|----|----------|-------------|--------|
| A1 | High | **`*:focus { outline: none }` too broad** — change to `*:focus:not(:focus-visible) { outline: none }` so keyboard navigation still shows focus rings | DONE |
| A2 | Medium | **Focus not moved after screen transitions** — after switching screens, call `.focus()` on the first interactive element of the new screen | DONE |
| A3 | Medium | **Difficulty buttons missing `aria-pressed`** — add `aria-pressed="true/false"` to difficulty toggle buttons, update on click | DONE |
| A4 | Low | **Action cost colors rely on color alone** — add sr-only text like "(cost)" and "(gain)" to the colored cost spans in action buttons | DONE |
| A5 | Low | **`aria-live` on individual stat values is noisy** — consolidate to a single aria-live region that announces only significant changes (e.g., crossing 50%, 75%, 90% thresholds) | DONE |

## BALANCE

| ID | Priority | Description | Status |
|----|----------|-------------|--------|
| BAL1 | Medium | **Newbie heatstroke lock** — 68-71% of newbie deaths are heatstroke. Reduce `CONFIG.actions.push.day.heat` from 22 to 18. This makes push less punishing heat-wise while keeping it the highest-cost action. The tutorial Day 1 encounter should also hint at heat management. | DONE |
| BAL2 | Medium | **Smart and GTO nearly identical** — only 4% gap. Add 2-3 signature encounters with complex EV tradeoffs that reward calculation. Also slightly widen the `loseHunters` success chance variance based on distance (closer = riskier but more rewarding). | DONE |
| BAL3 | Medium | **Hard mode compresses strategies** — 2.6 day gap between Newbie and GTO. Change `CONFIG.difficulty.hard.hunter.startDistance` from 20 to 22. | DONE |
| BAL4 | Low | **Opportunity frequency skew** — top 5 opps = 27% of appearances. Review `compatible` arrays on the top-5 terrains and remove 1-2 entries each. Add 2-3 more compatible terrains to the bottom-10 opportunities. | DONE |
| BAL5 | Low | **Atmospheric pressures crowd out gameplay pressures** — `dusk_light`, `midday_sun`, `moonless_night` fill 31% of slots. Add a 3-entry cooldown buffer for these atmospheric pressures (similar to `recentPressures` but specific to atmospheric IDs). | DONE |

## CONTENT

| ID | Priority | Description | Status |
|----|----------|-------------|--------|
| C1 | High | **Only 3 generic failure lines for chance actions** — fires 10-15x per run. Expand to 8+ variants in `game.js:buildOutcomeText()`, differentiated by action type (dig failure vs hunt failure vs scavenge failure). Each should be atmospheric and specific. | DONE |
| C2 | High | **No `after_trot` monologue trigger** — trot is 40-50% of all player actions. Add 8-10 monologue fragments with trigger `after_trot`, distributed across moods (confident, concerned, desperate). Tone: the steady rhythm of trotting, conservation of energy, the land passing by. | DONE |
| C3 | Medium | **Drink/eat outcome text is a single line** — add 3-4 variants each for successful drink and successful eat outcomes in `game.js:buildOutcomeText()`. Each should feel distinct and atmospheric. | DONE |
| C4 | Medium | **`animal_tracks` and `wind_shift` missing night variants** — add `nightText` and night-appropriate action text to these two opportunities in encounters.js. | DONE |
| C5 | Low | **No multi-stat-collapse monologue** — add 4-5 monologue fragments with combined trigger for when 3+ stats are above 80%. Mood: haunted/desperate. Theme: the body failing in multiple ways, everything narrowing. | DONE |

## UX IMPROVEMENTS

| ID | Priority | Description | Status |
|----|----------|-------------|--------|
| U1 | High | **No skip hint during typewriter** — when typewriter is active and buttons are hidden, show a subtle "Tap to skip" text below the typing area (or "Press SPACE to skip" on desktop). Fade it in after 1.5s of typewriter activity. | DONE |
| U2 | High | **Death screen results locked behind typewriter** — add skip hint on death narrative typewriter. Also ensure tapping anywhere on death screen skips the typewriter (not just the text area). | DONE |
| U3 | Medium | **Hunter distance label overlaps icons at close range** — in the pursuit trail, when distance is <5mi the number overlaps the cat/hunter icons. Fix: reduce font size at close range, or reposition the label above the trail line. | DONE |
| U4 | Medium | **"Fatigue" vs "Stamina" naming inconsistency** — the UI label says "Fatigue" but CONFIG and game logic use "stamina". Standardize: keep "Fatigue" in UI (it's the player-facing name, and it makes bar direction intuitive — higher = worse), but ensure all action cost text also says "fatigue" not "stamina". | SKIPPED (already consistent — all player-facing text uses "Fatigue") |
| U5 | Medium | **First-death tip system** — on death, if `day <= 3`, show a single contextual tip below the score: heatstroke -> "Tip: Nights are cooler. Consider resting or trotting when heat is high." / exhaustion -> "Tip: Pushing every turn drains stamina fast. Try trotting." / dehydration -> "Tip: Look for Drink and Dig actions to reset thirst." / caught -> "Tip: Push to gain distance when hunters are close." / starvation -> "Tip: Eat and Scavenge actions reset hunger — use them when available." | DONE |
| U6 | Medium | **Action failure feedback** — when a probabilistic action fails, briefly flash the action button red (200ms CSS animation), and prefix the outcome text with something like "The attempt yields nothing." in a distinct style. | DONE |
| U7 | Low | **Outcome text from previous phase unlabeled** — add a small faded label "Previous:" above the carry-over outcome text from the prior phase | DONE |
| U8 | Low | **Keyboard shortcut hint** — add "(1-5)" hint text to the action button area header on desktop (hidden on mobile). Also mention in How to Play. | DONE |
| U9 | Low | **Browser `confirm()` for leaderboard clear** — replace with an in-game styled confirmation modal that matches the game's aesthetic | DONE |
| U10 | Low | **Share card missing URL** — add `primalchase.com` text to the share card canvas render and the clipboard text format | SKIPPED (already present in both share text and share image) |

## VISUAL ENHANCEMENTS

| ID | Priority | Description | Status |
|----|----------|-------------|--------|
| V1 | Medium | **Hunter glow not visible at close range** — the `#hunter-glow` effect may have thresholds too conservative. When hunters < 5mi, ensure a visible red vignette glow. Check `ui.js` for the glow opacity calculation and lower the activation threshold. | DONE |
| V2 | Low | **Stat bar pulse at 80%+** — add a CSS `@keyframes pulse` animation to `.status-bar-fill` when the stat value crosses 80%. Use the `.critical` class or a new `.pulsing` class. Respect `prefers-reduced-motion`. | DONE |
| V3 | Low | **Water-boost hunter flavor text** — add 2-3 hunter flavor variants in hunters.js for when `hunterWaterBoostDays > 0`. e.g., "Something in their pace has changed — they found where you drank." | DONE |
| V4 | Low | **Rain-during-day has no visual cue** — when rain persists into day phase, slightly darken the day background or add a subtle blue-gray tint overlay. Check if `.rain-overlay-dim` already handles this; if not, add a condition. | DONE |

---

## VERIFICATION CHECKLIST

After all changes are complete, run these verification steps:

- [x] `python3 -m http.server 8080` and Playwright test: full game start to death (desktop) — PASS
- [x] Playwright test: mobile viewport (390x844) — buttons visible, stats readable (11.2px) — PASS
- [x] Playwright test: Try Again flow works — PASS (verified via desktop playtest)
- [x] Playwright test: Options screen — all toggles and difficulty buttons work — PASS
- [x] Playwright test: How-to-Play screen — back button accessible (top + bottom) — PASS
- [x] Playwright test: Leaderboard — entries save and display — PASS
- [x] Playwright test: Night mode visuals — stars, no firefly 404s — PASS (0 console 404s)
- [x] Playwright test: Death screen — narrative + score + all buttons — PASS
- [x] `node test/simulate.js --games=500 --strategy=all --difficulty=all` — PASS
- [x] `node test/report.js` — PASS
- [x] Verify no console errors in browser — PASS (0 errors)
- [x] Verify `prefers-reduced-motion` suppresses lightning — PASS (CSS + JS guard added)
- [x] All balance numbers still in CONFIG only (no hardcoded values) — PASS
- [x] Git diff review — no unintended changes — PASS

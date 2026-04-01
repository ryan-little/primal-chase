# Coding Conventions

## Code Style

- **Language/Version:** Vanilla JS (ES6+), HTML5, CSS3
- **No framework, no build step, no npm** (except dev-only simulation tooling)
- **Naming:** camelCase for functions/variables, UPPER_SNAKE for CONFIG constants, PascalCase for class-like objects (Game, Encounters, Hunters, Monologue, UI, Score)
- **Script load order:** config → encounters → monologue → hunters → game → ui → score (globals depend on this)
- **Comments:** Only where logic isn't self-evident

## File Organization

- `js/` — game scripts, one per system
- `css/` — single stylesheet
- `assets/` — logo variants only
- `stats/` — deployed analytics dashboard
- `test/` — simulation engine and reports (dev only, not deployed)
- `docs/plans/` — historical design docs

## Data Formats

- All balance numbers in CONFIG object (`js/config.js`)
- Distances in miles
- Stats as percentages (0–100)
- Durations in milliseconds (for animations/typewriter)

## Balance Changes

After changing any CONFIG value that affects game outcomes:
1. Re-run simulation: `node test/simulate.js --games=500 --strategy=all`
2. Compute new percentile breakpoints
3. Update `BASELINE_PERCENTILES` in `score.js`
4. Copy results to deployed dashboard: `cp test/results/latest.json stats/results/latest.json`

## Content Guidelines

The writing tone is atmospheric and primal. Cormac McCarthy meets nature documentary. The animal is intelligent but not human — it thinks in sensation, instinct, and growing unease. Avoid modern language or humor. Everything should feel ancient, inevitable, and earned.

## Git

- `main` branch = GitHub Pages deploy (production)
- `v1` branch = active development
- Commit messages: imperative mood, concise
- Don't commit `test/results/` (gitignored)

---

*See [ARCHITECTURE.md](ARCHITECTURE.md) for system design. See knowledge-hub for game design reference and balance details.*

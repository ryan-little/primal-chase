# Project Status

Last updated: 2026-05-14

## Current Phase: Stable (V1.9 live), V2 planning

### Plan of Action (next session)
1. Review `v1-dev` (15 commits ahead of main) — decide whether to merge to main or cherry-pick. Ryan was hesitant about merging previously and wants to review manually.
2. Branch `v2-dev` off main and begin V2 prototyping.
3. V2 direction captured at `knowledge-hub/projects/primal-chase/v2-design.md` — spatial/visual survival, minimap as decision surface, terrain-feature travel, situations as state mutations.

### What's Done
- [x] Core game loop with 5 actions, day/night cycle
- [x] 3-layer encounter system (combinatorial + signature + rare)
- [x] 387 internal monologue fragments with contextual selection
- [x] Hunter pursuit/tracking/escalation system
- [x] Easy/Normal/Hard difficulty with config overrides
- [x] Simulation engine (5 strategies, 3 difficulties)
- [x] Percentile scoring from 3000-game simulation baseline
- [x] Share card (clipboard + download), local leaderboard
- [x] Game Analytics dashboard at /stats/
- [x] Accessibility (focus-visible, ARIA, reduced-motion)
- [x] Weather/atmosphere visual system
- [x] Tutorial Day 1 fixed encounters
- [x] Options with localStorage persistence
- [x] Cloudflare Web Analytics (beacon on index.html + stats/index.html)

### What's Next
- [ ] Review and decide fate of `v1-dev`
- [ ] V2 overhaul — see `knowledge-hub/projects/primal-chase/v2-design.md`
- [ ] See knowledge-hub ideas.md for V2+ roadmap

### Blockers
- None currently

### Key Decisions Made
- **Config-driven balance** — all numbers in config.js, never in game logic
- **Zero dependencies** — vanilla HTML/CSS/JS, no framework
- **Intentionally unwinnable** — escalating hunter speed guarantees loss
- **Simulation-driven tuning** — 5 rounds of automated balance testing in V1.8
- See knowledge-hub decisions.md for full rationale

### Context
Browser game at primalchase.com. V1 is feature-complete. Future work is visual/content expansion (V2+), not mechanical changes.

---

*See [CLAUDE.md](CLAUDE.md) for full documentation index.*

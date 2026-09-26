# Scorecard: v2-arcade

Scores are out of 10. The evidence is screenshots from bot-driven tours (`tools/tour.mjs`, `tools/scen.mjs`, `tools/mobile.mjs`), bot balance runs (`tools/runsim.mjs`), frame timing (`tools/perf.mjs`) and offline audio renders (`tools/runaudio.mjs`, `tools/runsfx.mjs`). No human has played it yet.

| Part | Iter 1 | Iter 2 | Iter 3 | Evidence and limits |
|---|---|---|---|---|
| Core loop and design | 8.0 | 8.5 | 8.5 | Heat forces rest, rest lets the band close in, and a broken trail buys time. Scouts give a fight roughly every minute. |
| Balance and difficulty curve | 7.0 | 7.5 | 8.0 | 16-run bot median is about 5.5 min and day 2.6. The skilled bot reaches day 5 and beyond. Needs human playtesting. |
| Variety and content | 7.5 | 8.5 | 8.5 | 9 ground types, rain, night, scouts, dogs, crocodiles, hyenas, stampedes, 12 feats, daily seed |
| Pixel art | 8.5 | 8.5 | 8.5 | One palette, crisped and outlined procedural sprites. Water wading added. Hunters are still thin at 1x. |
| Animation and juice | 8.0 | 8.5 | 8.5 | Gallop keyframes, hitstop, shake, slow-mo on close dodges, pops, particles |
| Lighting and atmosphere | 8.0 | 8.5 | 8.5 | Light map grading, torchlit nights, rain, lightning, dusk grade toned down |
| Music (the score) | 7.5 | 7.5 | 7.5 | Composed D-dorian themes, adaptive layers that rise from 0 to 3 with the threat, night flute, tempo lift during chases. Levels checked offline, but **not auditioned by ear** |
| Sound effects | 6.5 | 7.0 | 7.5 | 32 synthesized cues. Quiet warning cues (shout, throw, thunk) were rebalanced by measurement. **Not auditioned by ear** |
| UI, HUD, menus | 8.0 | 8.5 | 8.5 | Tracker bar, vitals, status line, instinct arrows kept clear of the HUD, pause, settings, keyboard and gamepad menu nav |
| Onboarding | 7.5 | 8.5 | 8.5 | Contextual one-time hints, urgent hints shown immediately, input-aware wording |
| Scoring system | 8.5 | 9.0 | 9.0 | Wild multiplier, run history, ranks, feats, daily best, copy result |
| Tech and performance | 9.0 | 9.0 | 9.0 | Draws in about 0.4 ms at 1080p. No build step, no dependencies. Chunk key collision fixed. |
| Mobile and input | 7.0 | 8.5 | 8.5 | Touch stick with rim-sprint, POUNCE and RUN buttons, portrait HUD reflow, gamepad support |

## Below 8.5 and why

- **Music and SFX (7.5).** I can measure levels, durations and clipping, but I can't hear the audio, so the ceiling here is set by an ear test that hasn't happened yet.
- **Balance (8.0).** The curve is tuned against a scripted bot. How it feels to a human is still unknown, especially whether the first sighting feels escapable.

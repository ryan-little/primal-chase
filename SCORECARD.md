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


## v2.1 (branch `v2-arcade-next`)

Ryan rated v2 a 9/10. The target for this round was 9.5. Same evidence methods as before, plus a whole-continent map render, a biome tour, weather and fire scenes, and stress tests.

| Part | v2 | v2.1 | What changed / limits |
|---|---|---|---|
| Core loop and design | 8.5 | 9.0 | A straight line now draws interceptors and ambushes. Perks, secrets and ledges add decisions beyond "run away." |
| Balance and difficulty curve | 8.0 | 8.0 | 20-run bot median is about 3.5 min, day 1.8. There are many more threats now; a human playtest is still the missing evidence. |
| Variety and content | 8.5 | 9.5 | 7 biomes, 9 prey species plus lions, 10 secret places, 16 instincts, 6 weather states, spreading fire, 18 feats |
| Pixel art | 8.5 | 9.0 | Biome props, landmarks, new animals, flames and ash. Hunters are still thin at 1x. |
| Animation and feel | 8.5 | 9.0 | Device-resolution renderer with sub-pixel camera (fixes walking jitter), ledge hop, birds that take flight |
| Lighting and atmosphere | 8.5 | 9.0 | Fog, dust haze, heat shimmer, firelight at night, lightning |
| Music (the score) | 7.5 | 8.0 | Sampled kora, marimba, mbira and drums, a theme per biome, title theme, chase groove. Levels verified offline, **not auditioned by ear** |
| Sound effects | 7.5 | 8.0 | Footsteps per ground, biome birdsong, surf, fire, roars. **Not auditioned by ear** |
| UI, HUD, menus | 8.5 | 9.0 | Instinct cards, lore card, minimap, full map, journal. The title now fits any window. |
| Onboarding | 8.5 | 8.5 | Contextual first-time hints for every new system, but there is a lot more to learn now |
| Scoring and meta | 9.0 | 9.0 | 18 feats, secret journal, daily hunt |
| Tech and performance | 9.0 | 9.5 | Terrain painted in a Web Worker. About 8.4 ms frames at 1080p under a 300-cell fire, fog and 700 particles |
| Mobile and input | 8.5 | 8.5 | Portrait and landscape verified. Map button and minimap placed for touch. |

**Overall about 9.0.** The gap to 9.5 is in the parts I can't measure: how the audio sounds, and whether the difficulty feels fair to a person rather than a bot.

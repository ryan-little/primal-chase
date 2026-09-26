# Primal Chase: Arcade (branch `v2-arcade`)

A real-time rebuild of Primal Chase. You are the big cat. The band behind you are persistence hunters: slower than you, but they never tire and they never stop following your tracks.

- **Heat is the leash.** Trotting outpaces them; sprinting leaves them behind. Both build heat, and an overheated cat can barely walk. Cool off in shade, lying down, in water, at night or in rain, while they keep walking.
- **Your trail is the game.** Every step leaves prints they follow. Rock and water leave none, rain washes them out, a stampede tramples them flat. Break the trail and they have to stop and search.
- **Drink, hunt, eat.** Stand still at water to drink. Stalk gazelles and hares (tall grass hides you), pounce, and stand over the kill to eat before the hyenas come.
- **When they see you,** they run and throw spears. Every throw is telegraphed with a red line. Sidestep, or pounce through it; a pounce can also knock a hunter flat.
- **It escalates.** Each dawn the band walks faster. Dogs join on day 2, more hunters on odd days, and a lone runner periodically cuts across to intercept you. Deep water hides crocodiles.
- **Score** comes from distance, days survived, prey, dodges, broken trails, escapes and takedowns, all scaled by a wild multiplier that grows when you survive danger and halves when you get hurt. There are 12 feats and a daily seeded hunt.

## Running it

No build step and no dependencies. Every sprite, sound and music cue is generated in code at load time; the repo ships no image or audio files.

```sh
python -m http.server 8791   # then open http://127.0.0.1:8791
```

Controls: WASD/arrows to move, Shift sprint, Space pounce, P/Esc pause, M mute. Gamepad and touch (drag to move, push to the rim to sprint, POUNCE button) are supported.

## Layout

| File | What it does |
|---|---|
| `js/game.js` | The rules: player vitals, the band's trail following and search, scout, dogs, prey, spears, crocs, hyenas, stampedes, weather, scoring |
| `js/world.js` | Seeded endless terrain streamed in 128px chunks; `ground()` is the single source of truth for both rendering and gameplay |
| `js/art.js` | Procedural pixel art: a rigged quadruped/biped renderer, props, icons, all crisped to one palette |
| `js/audio.js` | WebAudio synth: adaptive score (kalimba theme, pad, hunter drums, chant, night flute) and every SFX |
| `js/render.js` | Low-res canvas renderer, light map for day/night and torches, particles, instinct arrows |
| `js/main.js` | Screens, HUD, hints, feats, persistence, the frame loop |
| `tools/` | Dev-only: balance bot and sim harness, screenshot tours, offline audio level checks (needs Playwright + Edge) |

The original text game (V1.9) stays on `main`.

# Primal Chase: Arcade (branch `v2-arcade`)

A real-time rebuild of Primal Chase. You are the big cat. The band behind you are persistence hunters: slower than you, but they never tire and they never stop following your tracks.

- **Heat is the leash.** Trotting outpaces them; sprinting leaves them behind. Both build heat, and an overheated cat can barely walk. Cool off in shade, lying down, in water, at night or in rain, while they keep walking.
- **Your trail is the game.** Every step leaves prints they follow. Rock and water leave none, rain washes them out, a stampede tramples them flat. Break the trail and they have to stop and search.
- **Drink, hunt, eat.** Stand still at water to drink. Stalk gazelles and hares (tall grass hides you), pounce, and stand over the kill to eat before the hyenas come.
- **When they see you,** they run and throw spears. Every throw is telegraphed with a red line. Sidestep, or pounce through it; a pounce can also knock a hunter flat.
- **It escalates.** Each dawn the band walks faster. Dogs join on day 2, more hunters on odd days, and a lone runner periodically cuts across to intercept you. Deep water hides crocodiles.
- **Don't run a straight line.** Hold one heading too long and the band reads your line: they speed up, then send interceptors ahead, then set ambushes.
- **A whole continent.** Seven biomes (savanna, mopane woodland, wetlands, red desert, terraced highlands where you can leap down ledges that men must climb around, ashlands, and the coast that ends the world), each with its own ground, plants, animals and music.
- **Secrets and instincts.** Ten kinds of secret place (painted caves, a hidden spring, the old baobab, a hunters' cold camp...) with lore and rewards, a journal across runs, and a perk choice every dawn.
- **Weather.** Dawn fog, heatwaves, dust storms, thunderstorms with telegraphed lightning, and grass fires that spread downwind, burn your trail and stop the band.
- **Score** comes from distance, days survived, prey, dodges, broken trails, escapes and takedowns, all scaled by a wild multiplier that grows when you survive danger and halves when you get hurt. There are 18 feats and a daily seeded hunt.

## Running it

No build step and no dependencies. Every sprite, sound and music cue is generated in code at load time; the repo ships no image or audio files.

```sh
python -m http.server 8791   # then open http://127.0.0.1:8791
```

Controls: WASD/arrows to move, Shift sprint, Space pounce, Tab map, P/Esc pause, M mute. Gamepad and touch (drag to move, push to the rim to sprint, POUNCE button) are supported.

## Layout

| File | What it does |
|---|---|
| `js/game.js` | The rules: player vitals, the band's trail following and search, scout, dogs, prey, spears, crocs, hyenas, stampedes, weather, scoring |
| `js/terrain.js` | Pure terrain math: biomes, terraces, coast; runs on the main thread and in `terrain-worker.js`, which paints chunks off-thread |
| `js/world.js` | Chunks, props, landmarks, and the movement rules for cliffs, water, fire and the sea |
| `js/weather.js`, `perks.js`, `secrets.js`, `fauna.js`, `minimap.js`, `bot.js` | Weather and fire, instincts, secret places, species, remembered map, and the bot that plays the title demo |
| `js/art*.js` | Procedural pixel art: a rigged quadruped/biped renderer, 9 prey species, lions, props per biome, landmarks, icons, all crisped to one palette |
| `js/audio.js` | WebAudio: pre-rendered kora/marimba/mbira/drum samples, a theme per biome, title and chase music, footsteps per ground, ambience |
| `js/render.js` | Pixel-art renderer at device resolution (smooth camera), light map, weather and fire, particles, instinct arrows |
| `js/main.js` | Screens, HUD, hints, feats, persistence, the frame loop |
| `tools/` | Dev-only: balance bot and sim harness, screenshot tours, offline audio level checks (needs Playwright + Edge) |

The original text game (V1.9) stays on `main`.

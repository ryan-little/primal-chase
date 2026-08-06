# HANDOFF — resuming this project in a fresh session

Read this + `STATUS.md` first; then `GOAL.md` (the mandate),
`docs/DESIGN.md` (the blueprint), `docs/DECISIONS.md` (why things are so).

## Where the project stands (2026-08-06)

The Fable rebuild is **feature-complete and awaiting Ryan's playtest
sign-off** — that is the only unchecked item in GOAL.md's definition of
done. Ryan opened the game once; no feedback has been recorded yet. Expect
the next session to start from his playtest notes: balance feel, camera,
audio taste, readability, bugs he hit. Treat those as the work queue.

## The three sibling repos (do not confuse them)

| Path | Role |
|---|---|
| `..\Primal-Chase` | Pristine clone of ryan-little/primal-chase (V1.9 text game). REFERENCE ONLY. |
| `..\Primal-Chase-Opus` | Opus hex-3D rewrite, branch `v2-3d`. REFERENCE ONLY. |
| `.` (Primal-Chase-Fable) | The rebuild. All work happens here. Local git only — **never push anywhere without Ryan.** |

## Environment (this machine)

- **No system Node.** Portable Node 22 at `C:\Users\ryan\tools\node`.
  Bash: `export PATH="/c/Users/ryan/tools/node:$PATH"` before any npm/npx.
- GPUs: RTX 5070 Ti laptop (used by the harnesses via
  `--use-angle=default`) + AMD 880M iGPU.
- **Hardware mandate:** this is Ryan's laptop — no long CPU burns. Balance
  batches ≤200 runs (~2 min), spaced. Rendering checks go through the GPU.
- Playwright + Chromium installed as devDependency (screenshots/playtests).

## The verification loop (use it, it's fast)

```sh
npm test                                   # 20 tests, ~3s
npm run build                              # tsc strict + vite, ~1s
node tools/screenshot.mjs "seed=7&sun=0.55&dist=2600&yaw=3.9" out.png
node tools/playtest.mjs 7 4                # real turns on served dist + shots
node tools/mobile-check.mjs                # phone-size title/intro shots
npx tsx tools/worldgen-debug.ts 7 60 720   # terrain/biome maps (no browser)
npx tsx tools/nav-debug.ts 7 0 0           # reach contours (no browser)
npm run sim -- 160                         # balance batch; add 'emit' to
                                           # regenerate src/content/percentiles.ts
```

All debug output lands in `debug/` (gitignored). Read the PNGs — screenshot
verification was how every visual decision in this project was made.
The viewer (free camera, no game) lives at `?mode=view&seed=7&x=0&z=0`.
`?test=1` boots straight into play and exposes `window.__pc` hooks +
`window.__frameTimes`.

## Architecture in one breath

`src/content` (V1 prose, generated — regenerate via `tools/port-content.mjs`,
never hand-edit) → consumed by `src/sim` (pure logic, no three.js, runs in
Node; Game class in `sim/game.ts` is the heart) over `src/world` (seeded
analytic worldgen + Dijkstra nav, also renderer-free) → presented by
`src/render` (terrain chunks, sky, fog of war, reach field, entities,
vegetation+landmarks) + `src/ui` (DOM HUD/screens) + `src/audio`
(synthesized) → assembled in `src/game/app.ts`.

Two invariants to protect:
1. **sim/ and world/ never import three.js** — headless tests and balance
   depend on it.
2. **Custom shader code must include the tonemapping/colorspace chunks**,
   and any shader edge texture needs wobble wavelength > texel size (see
   DECISIONS addendum for the scars behind both rules).

## Known rough edges (candidate work before/alongside Ryan's notes)

- Signature choices with null effects and non-move keys (e.g. 'opposite')
  still grant abstract miles without moving the map position.
- Fog explored-state clears on region recenter (>7 km relocation) — a
  persistent explored store would preserve memory of the land.
- Reach compute blocks the main thread ~200 ms after each turn.
- Entities are stylized-primitive; no dust puffs/animation polish yet.
- Weather beyond rain (dust devils, fireflies, lightning) not yet in 3D.
- Firefox/Safari untested (Chromium only via Playwright).
- Audio levels tuned by construction, not by ear.

## Deploying (when Ryan says ship)

README.md has both paths: GitHub Pages (`git subtree push --prefix dist
origin gh-pages` after a build — requires creating a GitHub repo first;
none exists yet) and the Mac mini (Caddy serving `dist/`, snippet included).
`dist/` is fully static, relative-base, no external requests.

# Primal Chase

*A 3D survival chase across an endless savannah. You are the hunted.*

You are an apex predator — a king of the savannah. Behind you, persistence
hunters who do not tire, do not stop, and do not forget. The land is real:
mountains wall you, rivers ford only where they run shallow, high ground buys
sight, and night takes it away. You see only what your eyes can see.

The game cannot be won. The only question is how long the land keeps you.

This is the third life of Primal Chase — a ground-up 3D rebuild (continuous
terrain, fog of war, spatialized pursuit) carrying every word of the original
game's prose: its encounters, its monologue, its deaths.

## Playing

Modern browser with WebGL2, desktop or mobile. Click or tap the land inside
your reach contour to run there; use the verbs the ground offers; watch the
tracker. Keyboard: **Enter** confirms a move, **Esc** cancels, **R** rests.

## Development

Requires Node 20+.

```sh
npm install
npm run dev        # dev server on :8777
npm test           # unit + integrity tests (fast)
npm run build      # type-check + static build into dist/
npm run preview    # serve the built dist/
```

Useful tools (all headless-friendly):

```sh
npx tsx tools/worldgen-debug.ts 7 60 720     # top-down terrain/biome PNGs -> debug/
npx tsx tools/nav-debug.ts 7 0 0             # reach-contour PNG at a location
node tools/screenshot.mjs "seed=7&sun=0.55" out.png    # GPU screenshot of the app
node tools/playtest.mjs 7 4                  # automated turns + screenshots
npm run sim -- 240                           # balance batch (keep batches small)
npm run sim -- 300 emit                      # ...and regenerate percentiles.ts
```

`src/sim` and `src/world` are renderer-free and run headless in Node — that is
what makes tests and balance work cheap.

## Deploying

`npm run build` produces a fully static `dist/` with relative asset paths.
No server logic, no external requests. Either path below works as-is.

### GitHub Pages

Push `dist/` to a `gh-pages` branch (or use an action):

```sh
npm run build
git subtree push --prefix dist origin gh-pages
```

Then point Pages at the `gh-pages` branch. A custom domain (primalchase.com)
works by adding the usual `CNAME` file to `dist/` before pushing.

### Mac mini (standalone at primalchase.com)

Any static file server. The simplest durable setup is
[Caddy](https://caddyserver.com) (automatic HTTPS):

```
# /opt/homebrew/etc/Caddyfile
primalchase.com {
    root * /var/www/primalchase
    file_server
    encode gzip
}
```

```sh
brew install caddy
npm run build && rsync -a dist/ /var/www/primalchase/
brew services start caddy
```

Point the domain's A/AAAA records at the mini, open 80/443, done. (nginx or
even `python3 -m http.server` behind a tunnel work too — the site is plain
files.)

## Repository layout

```
src/content/   the original prose, ported verbatim (typed data)
src/sim/       pure game logic — turn loop, hunters, encounters, scoring
src/world/     seeded worldgen — heightfield, biomes, landmarks, navigation
src/render/    three.js — terrain, sky, water, fog of war, entities, effects
src/ui/        HUD, screens, options, share card
src/audio/     procedural soundscape (no assets)
tools/         debug renderers, screenshot + playtest harnesses
test/          vitest suites + the balance harness
docs/          DESIGN.md and DECISIONS.md — why everything is the way it is
```

Made by [Ryan Little](https://ryan-little.com).

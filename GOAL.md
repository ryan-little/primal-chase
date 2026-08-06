# Primal Chase — Fable rebuild

**The goal:** a ground-up rebuild of Primal Chase as a 3D, browser-based survival chase
game that is better than the Opus V2 in every system — rendering, world, gameplay, UI,
audio, performance. The loop runs until this is achieved.

Started 2026-08-06. Directed by Ryan Little (ryan@ryanpdlittle.com).

---

## The mandate (from Ryan, verbatim decisions)

- **Keep the soul.** Persistence hunting, the unwinnable premise, the McCarthy-esque
  narration and hand-written prose content. Everything else — phase structure, action
  economy, movement, vitals, hunter model — is mine to redesign where it makes a better game.
- **Reconsider every single system.** Nothing from V1 or the Opus rewrite is sacred except
  the soul. Cost is no factor.
- **3D rendering must be much better.** Specifically called out:
  - **Fog of war** — seeing the whole map is not good. Exploration/visibility must matter.
  - **Terrain must be literal.** A mountain should be tall. A lake or ocean should be
    water. The map should physically express the encounters and situations that arise there.
- **Not bound to hexes.** Any spatial model is allowed. Any libraries/frameworks allowed.
- **Build step approved.** Vite + TypeScript, output is a static `dist/`.
- **Classic text version: dropped entirely.** (Preserved forever in Primal-Chase / -Opus.)
- **Art direction: my call per system.** Mix stylized/realistic as reads best.
- **Deployment constraint (the only hard one):** playable in the browser on any platform;
  deployable either as a standalone static site on an M4 Mac mini at primalchase.com or as
  a GitHub Pages site. Static output satisfies both.
- **Hardware care:** this is Ryan's laptop. Minimize CPU-heavy simulation runs and heat
  buildup — short, budgeted sim batches, never long unattended CPU burns. A discrete GPU
  exists; prefer GPU-accelerated paths (headed/GPU browser testing) where possible.

## The three repositories

| Path | What it is |
|---|---|
| `C:\Users\ryan\Projects\Primal-Chase` | Pristine clone of ryan-little/primal-chase (V1.9 text game). Reference only — do not modify. |
| `C:\Users\ryan\Projects\Primal-Chase-Opus` | Opus V2 rewrite (branch `v2-3d`): hex-grid three.js game. Reference only — do not modify. |
| `C:\Users\ryan\Projects\Primal-Chase-Fable` | This repo. The rebuild lives here. |

## What to salvage (content, not code)

From the Opus/original repos' `js/`: `encounters.js` (32 terrains × 52 opportunities ×
22 pressures + 40 signatures), `monologue.js` (387 fragments), `hunters.js` flavor text,
`narrative.js`. ~200KB of hand-written prose — port the *data*, rewrite the *systems*.

## Definition of done

The loop ends when all are true:

1. Game runs from a static build, playable start-to-death in any modern browser,
   desktop and mobile (touch + mouse + keyboard).
2. Rendering is a clear, obvious upgrade over Opus V2: literal terrain relief, real water,
   fog of war, cohesive art direction, atmosphere (day/night, weather) — verified by
   screenshots at multiple game states.
3. Every V1/Opus system has been deliberately reconsidered (kept, redesigned, or cut),
   recorded in `docs/DECISIONS.md`.
4. The prose content is fully ported and reachable in play.
5. Balance verified with *budgeted* simulation (short batches, heat-conscious).
6. Deploy story proven: `dist/` served locally = the game, plus a README covering both
   Mac-mini and GitHub Pages deployment.
7. Ryan has playtested and signed off.

## Working method

- Design docs and decision log in `docs/`. Status snapshot in `STATUS.md` — every loop
  iteration ends by updating it so any future session can resume cold.
- Commit early and often in this repo. Never push anywhere without Ryan.
- Playtest via the browser (GPU), not via mass CPU simulation.

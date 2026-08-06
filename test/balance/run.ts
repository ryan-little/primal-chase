// Balance harness — run DELIBERATELY, never in the default test suite.
// Heat budget: batches are capped and a full default run stays under ~60s
// of a single core. Usage:
//   npm run sim               (240 runs: 120 smart + 120 random, stats only)
//   npm run sim -- 600 emit   (bigger batch; 'emit' writes percentiles.ts)
//
// The "smart" policy plays like an attentive human: drinks before thirst
// kills, eats when the odds are decent, rests tired legs at night, and
// otherwise runs away from the hunters, preferring ground that hides prints.

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Game } from '../../src/sim/game';
import { scoreRun } from '../../src/sim/score';
import type { NavNode } from '../../src/world/nav';

const N = Number(process.argv[2] ?? 240);
const emit = process.argv.includes('emit');

type Policy = (g: Game) => void;

function farthestFromHunters(g: Game, reach: Map<string, NavNode>, maxCostMiles: number): NavNode | null {
  const hp = g.hunterPosition();
  let best: NavNode | null = null, bestScore = -Infinity;
  for (const n of reach.values()) {
    if (n.cost / 1609.34 > maxCostMiles) continue;
    const away = Math.hypot(n.x - hp.x, n.z - hp.z);
    // Prefer print-poor ground a touch; it breaks pursuits.
    const stealth = (1 - Math.min(1, n.sample.terrain.scent)) * 800;
    const score = away + stealth + g.rng.next() * 500;
    if (score > bestScore) { bestScore = score; best = n; }
  }
  return best;
}

/**
 * Take an in-place action if it exists; otherwise take ANY available action
 * or a far move. Signature encounters replace the standard verbs with their
 * own choices, so a bare commitAction('rest') can be a no-op — a policy that
 * doesn't handle that spins forever (this exact bug froze early batches and
 * masqueraded as immortal survivors).
 */
function act(g: Game, key: string): void {
  if (g.commitAction(key)) return;
  const actions = g.state.encounter?.actions ?? [];
  if (actions.length) { g.commitAction(actions[0]!.key); return; }
  const reach = g.reach();
  const far = farthestFromHunters(g, reach, g.config.movement.trotMiles);
  if (far) g.commitMove(far, reach);
}

const smart: Policy = (g) => {
  const s = g.state;
  const actions = s.encounter?.actions ?? [];
  const drink = actions.find((a) => a.key === 'drink');
  const eat = actions.find((a) => a.key === 'eat');

  if (s.thirst > 55 && drink && (drink.chance ?? 1) >= 0.4) { act(g, 'drink'); return; }
  if (s.hunger > 62 && eat && (eat.chance ?? 1) >= 0.45) { act(g, 'eat'); return; }
  // Heat is managed, not endured: rest it off before it kills, preferring
  // night when they camp anyway.
  if (s.heat > 74 && s.hunters.distance > 5) { act(g, 'rest'); return; }
  if (s.phase === 'night' && (s.stamina < 42 || s.heat > 55) && s.hunters.distance > 6) {
    act(g, 'rest'); return;
  }
  if (s.stamina < 18) { act(g, 'rest'); return; }

  const reach = g.reach();
  const budget = s.phase === 'night' && s.hunters.distance > 8
    ? g.config.movement.trotMiles : g.config.movement.pushMiles;

  // Thirsty: read the land for water and run TO it — the intended play.
  if (s.thirst > 42) {
    let waterNode: NavNode | null = null, bestScore = -Infinity;
    for (const n of reach.values()) {
      if (n.cost / 1609.34 > budget) continue;
      const w = Math.max(n.sample.river, n.sample.basin, n.sample.waterDepth > 0 ? 1 : 0);
      if (w < 0.35) continue;
      const hp = g.hunterPosition();
      const score = w * 3000 + Math.hypot(n.x - hp.x, n.z - hp.z) * 0.4;
      if (score > bestScore) { bestScore = score; waterNode = n; }
    }
    if (waterNode) { g.commitMove(waterNode, reach); return; }
  }

  const target = farthestFromHunters(g, reach, budget);
  if (target) g.commitMove(target, reach);
  else act(g, 'rest');
};

const random: Policy = (g) => {
  const s = g.state;
  if (g.rng.chance(0.45)) {
    const actions = s.encounter?.actions ?? [];
    if (actions.length) {
      act(g, actions[Math.floor(g.rng.next() * actions.length)]!.key);
      return;
    }
  }
  const reach = g.reach();
  let far: NavNode | null = null, m = -1;
  for (const n of reach.values()) if (n.meters > m) { m = n.meters; far = n; }
  if (far) g.commitMove(far, reach);
  else act(g, 'rest');
};

interface RunResult { days: number; cause: string; score: number; miles: number; breaks: number; }

function runOne(seed: number, policy: Policy): RunResult {
  const g = new Game(seed);
  g.tutorial = false;
  g.newGame(seed);
  // 160 phases = 80 days; anything alive past that is a balance bug.
  for (let i = 0; i < 160 && g.state.isAlive; i++) policy(g);
  const sc = scoreRun(g.state, 'normal');
  return {
    days: g.state.day, cause: g.state.deathCause ?? 'SURVIVED-80-DAYS',
    score: sc.score, miles: sc.miles, breaks: g.state.stats.trailBreaks
  };
}

function stats(name: string, rs: RunResult[]): void {
  const days = rs.map((r) => r.days).sort((a, b) => a - b);
  const q = (p: number) => days[Math.min(days.length - 1, Math.floor(p * days.length))]!;
  const causes = new Map<string, number>();
  for (const r of rs) causes.set(r.cause, (causes.get(r.cause) ?? 0) + 1);
  const causeStr = [...causes.entries()].sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `${c} ${Math.round(100 * n / rs.length)}%`).join(', ');
  const avgBreaks = rs.reduce((a, r) => a + r.breaks, 0) / rs.length;
  const avgMiles = rs.reduce((a, r) => a + r.miles, 0) / rs.length;
  console.log(`${name}: days p25/p50/p75/p90 = ${q(0.25)}/${q(0.5)}/${q(0.75)}/${q(0.9)}` +
    ` | avg ${avgMiles.toFixed(0)} mi, ${avgBreaks.toFixed(1)} breaks | ${causeStr}`);
}

const t0 = Date.now();
const half = Math.floor(N / 2);
const smartRuns: RunResult[] = [];
const randomRuns: RunResult[] = [];
for (let i = 0; i < half; i++) smartRuns.push(runOne(1000 + i * 7, smart));
for (let i = 0; i < N - half; i++) randomRuns.push(runOne(5000 + i * 11, random));

console.log(`${N} runs in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
stats('smart ', smartRuns);
stats('random', randomRuns);

if (emit) {
  // Percentile table from the smart-policy score distribution: the death
  // screen's "outlasted X% of runs" compares against competent play.
  const scores = smartRuns.map((r) => r.score).sort((a, b) => a - b);
  const table: number[] = [];
  for (let p = 0; p <= 100; p += 5) {
    table.push(scores[Math.min(scores.length - 1, Math.floor((p / 100) * scores.length))]!);
  }
  const out = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'content', 'percentiles.ts');
  writeFileSync(out,
    `// GENERATED by test/balance/run.ts (${half} smart-policy runs). Do not hand-edit.\n\n` +
    `/** Score at each 5th percentile, 0..100. */\n` +
    `export const scorePercentiles: number[] = ${JSON.stringify(table)};\n\n` +
    `export function percentileFor(score: number): number {\n` +
    `  let p = 0;\n` +
    `  for (let i = 0; i < scorePercentiles.length; i++) {\n` +
    `    if (score >= scorePercentiles[i]!) p = i * 5;\n` +
    `  }\n` +
    `  return p;\n` +
    `}\n`);
  console.log(`wrote ${out}`);
}

// Scoring and the local leaderboard. The formula is new to Fable (the run is
// spatial now); percentile tables are regenerated during balance (Task #9).

import type { GameState } from './game';

export interface RunScore {
  score: number;
  days: number;
  phases: number;
  miles: number;
  trailBreaks: number;
  landmarks: number;
  cause: string;
  difficulty: string;
  date: string;
}

export function scoreRun(s: GameState, difficulty: string): RunScore {
  const phases = (s.day - 1) * 2 + (s.phase === 'night' ? 1 : 0);
  const base =
    s.day * 900 +
    s.distanceCovered * 12 +
    s.stats.trailBreaks * 260 +
    s.stats.landmarksVisited * 320 +
    s.stats.nightPushes * 40;
  const mult = difficulty === 'hard' ? 1.35 : difficulty === 'easy' ? 0.8 : 1;
  return {
    score: Math.round(base * mult),
    days: s.day,
    phases,
    miles: Math.round(s.distanceCovered * 10) / 10,
    trailBreaks: s.stats.trailBreaks,
    landmarks: s.stats.landmarksVisited,
    cause: s.deathCause ?? 'unknown',
    difficulty,
    date: new Date().toISOString().slice(0, 10)
  };
}

/** Achievements earned by a run — V1's spirit, Fable's stats. */
export function achievementsFor(s: GameState): string[] {
  const out: string[] = [];
  if (s.day >= 10) out.push('Long Shadow — ten days ahead of them');
  if (s.distanceCovered >= 60) out.push('Land Eater — sixty miles of ground');
  if (s.stats.trailBreaks >= 3) out.push('Ghost — broke the trail three times');
  if (s.stats.landmarksVisited >= 3) out.push('Wanderer — sought out three landmarks');
  if (s.stats.highestGround >= 300) out.push('Sky Walker — crossed the high stone');
  if (s.stats.nightPushes >= 5) out.push('Night Runner — five hard runs in the dark');
  if (s.stats.phasesNearDeath >= 6) out.push('Edge Dancer — lived long at the brink');
  return out;
}

const LB_KEY = 'primalchase.leaderboard.v3';
const MAX_ENTRIES = 10;

export function loadLeaderboard(): RunScore[] {
  try {
    const raw = localStorage.getItem(LB_KEY);
    if (raw) return JSON.parse(raw) as RunScore[];
  } catch { /* empty */ }
  return [];
}

/** Insert a run; returns its 1-based rank or null if it missed the board. */
export function submitScore(run: RunScore): number | null {
  const board = loadLeaderboard();
  board.push(run);
  board.sort((a, b) => b.score - a.score);
  const idx = board.indexOf(run);
  const trimmed = board.slice(0, MAX_ENTRIES);
  try { localStorage.setItem(LB_KEY, JSON.stringify(trimmed)); } catch { /* ignore */ }
  return idx < MAX_ENTRIES ? idx + 1 : null;
}

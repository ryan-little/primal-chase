#!/usr/bin/env node
// ============================================================
// SIMULATE.JS — Primal Chase Simulation Engine
// Plays N games with configurable strategies and records stats.
// Usage: node test/simulate.js [--games=500] [--strategy=all|push-heavy|...]
// ============================================================

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const JS_DIR = path.join(ROOT, 'js');

// ============================================================
// STRATEGY DEFINITIONS
// ============================================================

const STRATEGIES = {
  'push-heavy': { push: 0.60, trot: 0.20, rest: 0.15, situational: 0.05 },
  'trot-heavy': { push: 0.20, trot: 0.50, rest: 0.20, situational: 0.10 },
  'balanced':   { push: 0.30, trot: 0.30, rest: 0.20, situational: 0.20 },
  'rest-heavy': { push: 0.10, trot: 0.30, rest: 0.40, situational: 0.20 },
  'smart':      null,  // handled by smartPick()
  'gto':        null   // handled by gtoPick()
};

// ============================================================
// GAME LOADER — loads browser JS into Node sandbox
// ============================================================

function createGameSandbox() {
  const sandbox = {
    Math, console, JSON, Array, Object, Set, Date,
    parseInt, parseFloat, isNaN, Infinity, NaN,
    setTimeout: () => {}, setInterval: () => {},
    document: { addEventListener: () => {}, querySelectorAll: () => [], getElementById: () => null },
    localStorage: { getItem: () => null, setItem: () => {} },
    navigator: { clipboard: null },
    // Stubs for UI/Score (not needed for simulation)
    DEATH_NARRATIVES: { caught: [''], heatstroke: [''], exhaustion: [''], dehydration: [''], starvation: [''] }
  };

  vm.createContext(sandbox);

  // Load game scripts in dependency order (skip ui.js and score.js)
  // Note: const/let declarations don't become context properties in vm,
  // so we transform top-level const/let to var
  const loadOrder = ['config.js', 'encounters.js', 'monologue.js', 'hunters.js', 'game.js'];
  for (const file of loadOrder) {
    let code = fs.readFileSync(path.join(JS_DIR, file), 'utf8');
    // Transform top-level const/let to var so they become sandbox properties
    code = code.replace(/^(const|let) /gm, 'var ');
    vm.runInContext(code, sandbox, { filename: file });
  }

  // Stub UI and Score so Game.processAction doesn't crash
  sandbox.UI = {
    renderGame: () => {},
    renderDeath: () => {},
    showScreen: () => {}
  };
  sandbox.Score = {
    calculate: (s) => ({ days: s.day, distance: Math.round(s.distanceCovered * 10) / 10 })
  };

  return sandbox;
}

// ============================================================
// ACTION PICKER — selects actions based on strategy
// ============================================================

function pickAction(actions, strategy, gameState) {
  if (!actions || actions.length === 0) return null;

  if (strategy === 'smart') {
    return smartPick(actions, gameState);
  }
  if (strategy === 'gto') {
    return gtoPick(actions, gameState);
  }

  const weights = STRATEGIES[strategy];
  if (!weights) return actions[0];

  // Classify actions
  const standard = {};
  const situational = [];

  for (const a of actions) {
    if (a.isStandard && ['push', 'trot', 'rest'].includes(a.key)) {
      standard[a.key] = a;
    } else if (a.isSituational || !a.isStandard) {
      situational.push(a);
    }
  }

  // Build weighted pool
  const pool = [];
  if (standard.push) pool.push({ action: standard.push, weight: weights.push });
  if (standard.trot) pool.push({ action: standard.trot, weight: weights.trot });
  if (standard.rest) pool.push({ action: standard.rest, weight: weights.rest });
  if (situational.length > 0) {
    // Spread situational weight among available situational actions
    const perSit = weights.situational / situational.length;
    for (const s of situational) {
      pool.push({ action: s, weight: perSit });
    }
  } else {
    // Redistribute situational weight to trot
    const trotEntry = pool.find(p => p.action.key === 'trot');
    if (trotEntry) trotEntry.weight += weights.situational;
  }

  // Normalize and pick
  const totalWeight = pool.reduce((sum, p) => sum + p.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const p of pool) {
    roll -= p.weight;
    if (roll <= 0) return p.action;
  }
  return pool[pool.length - 1].action;
}

function smartPick(actions, state) {
  const standard = {};
  const situational = { drink: null, eat: null, others: [] };

  for (const a of actions) {
    if (a.isStandard && ['push', 'trot', 'rest'].includes(a.key)) {
      standard[a.key] = a;
    } else {
      // Classify situational by type
      if (['drink', 'dig', 'wallow', 'search'].includes(a.key)) {
        situational.drink = a;
      } else if (['eat', 'scavenge', 'hunt', 'feed', 'forage', 'steal'].includes(a.key)) {
        situational.eat = a;
      } else {
        situational.others.push(a);
      }
    }
  }

  // For signature encounters with custom choices, evaluate by effects
  if (!standard.push && !standard.trot && !standard.rest) {
    // All custom actions — pick the one with best net benefit
    return pickBestSignatureAction(actions, state);
  }

  // Priority-based decision for combinatorial encounters
  // 1. Critical thirst + drink available
  if (state.thirst >= 60 && situational.drink) return situational.drink;
  // 2. Critical hunger + eat available
  if (state.hunger >= 60 && situational.eat) return situational.eat;
  // 3. Critical stamina — rest
  if (state.stamina <= 25 && standard.rest) return standard.rest;
  // 4. Critical heat — rest
  if (state.heat >= 70 && standard.rest) return standard.rest;
  // 5. Hunters very close — push
  if (state.hunterDistance < 5 && standard.push) return standard.push;
  // 6. Moderate thirst + drink available
  if (state.thirst >= 40 && situational.drink) return situational.drink;
  // 7. Moderate hunger + eat available
  if (state.hunger >= 40 && situational.eat) return situational.eat;
  // 8. Hunters medium distance — trot to conserve
  if (state.hunterDistance >= 10 && state.stamina >= 50 && standard.trot) return standard.trot;
  // 9. Good condition — push
  if (state.stamina >= 60 && state.heat <= 50 && standard.push) return standard.push;
  // 10. Default — trot
  if (standard.trot) return standard.trot;
  // 11. Absolute fallback
  return actions[0];
}

// ============================================================
// GTO (Game Theory Optimal) STRATEGY
// Scores every available action by computing expected survival
// value. Considers: death proximity on all 5 axes, hunter threat,
// distance gained, opportunity value, and phase-aware costs.
// ============================================================

function gtoPick(actions, state) {
  if (actions.length === 1) return actions[0];

  let bestAction = actions[0];
  let bestScore = -Infinity;

  for (const action of actions) {
    const score = gtoScoreAction(action, state);
    if (score > bestScore) {
      bestScore = score;
      bestAction = action;
    }
  }

  return bestAction;
}

function gtoScoreAction(action, state) {
  const e = action.effects || {};
  const passive = state.phase === 'day'
    ? { heat: 5, stamina: 0, thirst: 5, hunger: 3 }     // CONFIG.passiveDrain.day
    : { heat: -10, stamina: 5, thirst: 2, hunger: 3 };   // CONFIG.passiveDrain.night

  // Project next-state stats after this action + passive drains
  const nextHeat = Math.max(0, Math.min(100, state.heat + (e.heat || 0) + passive.heat));
  const nextStamina = Math.max(0, Math.min(100, state.stamina + (e.stamina || 0) + passive.stamina));

  // Thirst/hunger: handle resets (large negative values mean "reset to 0")
  let nextThirst = state.thirst + (e.thirst || 0) + passive.thirst;
  if ((e.thirst || 0) <= -100) nextThirst = passive.thirst; // reset
  nextThirst = Math.max(0, Math.min(100, nextThirst));

  let nextHunger = state.hunger + (e.hunger || 0) + passive.hunger;
  if ((e.hunger || 0) <= -100) nextHunger = passive.hunger; // reset
  nextHunger = Math.max(0, Math.min(100, nextHunger));

  const dist = action.distance !== undefined ? action.distance : (e.distance || 0);

  // ---- DEATH PENALTY: exponential penalty as stats approach lethal thresholds ----
  // Each stat contributes a survival score from 0 (dead) to 1 (safe)
  const heatSurvival    = 1 - Math.pow(nextHeat / 100, 3);
  const staminaSurvival = 1 - Math.pow((100 - nextStamina) / 100, 3);
  const thirstSurvival  = 1 - Math.pow(nextThirst / 100, 2.5);
  const hungerSurvival  = 1 - Math.pow(nextHunger / 100, 2);

  // Immediate death = -1000
  if (nextHeat >= 100 || nextStamina <= 0 || nextThirst >= 100 || nextHunger >= 100) {
    return -1000;
  }

  // Combined survival score (geometric mean penalizes any single weak axis)
  const survivalScore = Math.pow(
    heatSurvival * staminaSurvival * thirstSurvival * hungerSurvival,
    0.25
  ) * 40;  // scale to ~0-40 range

  // ---- HUNTER THREAT ----
  // Estimate hunter gain for this action (rough: 0 distance = hunters gain ~5-6 mi)
  const hunterSpeed = state.hunterSpeed || 5.5;
  const nextHunterDist = state.hunterDistance + dist - hunterSpeed;
  const hunterScore = nextHunterDist <= 0 ? -1000 :
    nextHunterDist < 3 ? -30 :
    nextHunterDist < 6 ? -10 :
    nextHunterDist < 10 ? 0 :
    Math.min(nextHunterDist * 0.5, 10);

  // ---- DISTANCE VALUE ----
  const distanceScore = dist * 2;

  // ---- LOSE HUNTERS BONUS ----
  const loseHuntersBonus = action.loseHunters ? 25 : 0;

  // ---- CHANCE DISCOUNT ----
  // If action has a success chance < 100%, discount its value
  const chance = action.chance !== undefined ? action.chance : 1.0;
  const chanceMultiplier = chance;

  // ---- RISK PENALTY ----
  const riskPenalty = action.risk ? action.risk.chance * 15 : 0;

  // ---- OPPORTUNITY VALUE: drinking/eating when needed is very valuable ----
  let opportunityBonus = 0;
  if ((e.thirst || 0) <= -100) {
    // Thirst reset value scales with current thirst
    opportunityBonus += state.thirst * 0.4;
  }
  if ((e.hunger || 0) <= -100) {
    opportunityBonus += state.hunger * 0.3;
  }

  // ---- PHASE AWARENESS ----
  // Night: resting is less costly (hunters barely gain), more valuable for recovery
  let phaseBonus = 0;
  if (state.phase === 'night' && action.key === 'rest') {
    phaseBonus += 5;
  }
  // Day: pushing when cool and fresh is optimal
  if (state.phase === 'day' && action.key === 'push' && state.heat < 30 && state.stamina > 70) {
    phaseBonus += 3;
  }

  const rawScore = survivalScore + hunterScore + distanceScore +
    loseHuntersBonus + opportunityBonus + phaseBonus - riskPenalty;

  // Apply chance multiplier to the positive portion
  return rawScore > 0 ? rawScore * chanceMultiplier : rawScore;
}

function pickBestSignatureAction(actions, state) {
  // Score each action by net benefit
  let bestAction = actions[0];
  let bestScore = -Infinity;

  for (const a of actions) {
    if (!a.effects) continue;
    let score = 0;
    const e = a.effects;

    // Distance is very valuable
    score += (a.distance || e.distance || 0) * 3;
    // Losing hunters is extremely valuable
    if (a.loseHunters) score += 15;
    // Stat improvements
    score -= (e.heat || 0) * 0.5;      // less heat is better
    score += (e.stamina || 0) * 0.5;   // more stamina is better
    score -= (e.thirst || 0) * 0.8;    // less thirst is better
    score -= (e.hunger || 0) * 0.4;    // less hunger is better
    // Risk penalty
    if (a.risk) score -= a.risk.chance * 10;
    // Urgency adjustments
    if (state.thirst >= 60 && (e.thirst || 0) < -50) score += 20;
    if (state.hunger >= 60 && (e.hunger || 0) < -50) score += 15;
    if (state.heat >= 70 && (e.heat || 0) < -20) score += 10;
    if (state.hunterDistance < 8 && a.loseHunters) score += 20;

    if (score > bestScore) {
      bestScore = score;
      bestAction = a;
    }
  }
  return bestAction;
}

// ============================================================
// SIMULATION RUNNER
// ============================================================

function simulateOneGame(sandbox, strategy) {
  const { CONFIG, Encounters, Monologue, Hunters, Game } = sandbox;

  // Reset game state
  Encounters.reset();
  Monologue.reset();

  Game.state = {
    day: 1,
    phase: 'day',
    heat: CONFIG.starting.heat,
    stamina: CONFIG.starting.stamina,
    thirst: CONFIG.starting.thirst,
    hunger: CONFIG.starting.hunger,
    hunterDistance: CONFIG.starting.hunterDistance,
    hunterSpeed: CONFIG.hunter.baseSpeed,
    hunterState: 'pursuit',
    hunterWaterBoostDays: 0,
    trackingDaysLeft: 0,
    timesLostHunters: 0,
    distanceCovered: 0,
    currentEncounter: null,
    monologue: null,
    lastAction: null,
    lastOutcome: null,
    isAlive: true,
    deathCause: null,
    achievementStats: {
      nightPushes: 0,
      timesRested: 0,
      phasesWithHighThirst: 0,
      phasesNearDeath: 0
    },
    actionHistory: [],
    narrativeLog: []
  };

  // Generate first encounter
  Game.state.currentEncounter = Encounters.generate(Game.state);

  // Tracking data
  const phaseLog = [];
  const terrainsSeen = [];
  const encounterIdsSeen = new Set();
  const terrainCounts = {};
  const opportunityCounts = {};
  const pressureCounts = {};
  const MAX_PHASES = 500; // safety cap (250 days)
  let phaseCount = 0;

  while (Game.state.isAlive && phaseCount < MAX_PHASES) {
    phaseCount++;
    const encounter = Game.state.currentEncounter;

    // Record phase snapshot
    phaseLog.push({
      day: Game.state.day,
      phase: Game.state.phase,
      heat: Game.state.heat,
      stamina: Game.state.stamina,
      thirst: Game.state.thirst,
      hunger: Game.state.hunger,
      hunterDistance: Game.state.hunterDistance,
      hunterState: Game.state.hunterState
    });

    // Track encounters
    if (encounter) {
      encounterIdsSeen.add(encounter.id);
      if (encounter.terrain) {
        terrainsSeen.push(encounter.terrain.id);
        terrainCounts[encounter.terrain.id] = (terrainCounts[encounter.terrain.id] || 0) + 1;
      }
      if (encounter.opportunity) {
        opportunityCounts[encounter.opportunity.id] = (opportunityCounts[encounter.opportunity.id] || 0) + 1;
      }
      if (encounter.pressure) {
        pressureCounts[encounter.pressure.id] = (pressureCounts[encounter.pressure.id] || 0) + 1;
      }
    }

    // Pick action
    const actions = encounter ? encounter.actions : [];
    if (actions.length === 0) break; // no actions = stuck

    const action = pickAction(actions, strategy, Game.state);
    if (!action) break;

    // Execute action (this handles effects, death check, phase advance, new encounter)
    Game.processAction(action.key);
  }

  // Calculate terrain repeat stats
  const terrainRepeatGaps = calculateTerrainRepeatGaps(terrainsSeen);

  return {
    days: Game.state.day,
    distance: Math.round(Game.state.distanceCovered * 10) / 10,
    deathCause: Game.state.deathCause || 'survived',
    timesLostHunters: Game.state.timesLostHunters,
    phases: phaseCount,
    phaseLog: phaseLog,
    uniqueEncounters: encounterIdsSeen.size,
    terrainRepeatGaps: terrainRepeatGaps,
    terrainCounts: terrainCounts,
    opportunityCounts: opportunityCounts,
    pressureCounts: pressureCounts,
    finalStats: {
      heat: Game.state.heat,
      stamina: Game.state.stamina,
      thirst: Game.state.thirst,
      hunger: Game.state.hunger,
      hunterDistance: Game.state.hunterDistance
    }
  };
}

function calculateTerrainRepeatGaps(terrainsSeen) {
  if (terrainsSeen.length === 0) return { avg: 0, min: 0, max: 0 };

  const lastSeen = {};
  const gaps = [];

  for (let i = 0; i < terrainsSeen.length; i++) {
    const t = terrainsSeen[i];
    if (lastSeen[t] !== undefined) {
      gaps.push(i - lastSeen[t]);
    }
    lastSeen[t] = i;
  }

  if (gaps.length === 0) return { avg: Infinity, min: Infinity, max: Infinity };
  return {
    avg: Math.round((gaps.reduce((a, b) => a + b, 0) / gaps.length) * 10) / 10,
    min: Math.min(...gaps),
    max: Math.max(...gaps)
  };
}

// ============================================================
// AGGREGATE RESULTS
// ============================================================

function aggregateResults(results) {
  const days = results.map(r => r.days).sort((a, b) => a - b);
  const distances = results.map(r => r.distance).sort((a, b) => a - b);

  // Death cause distribution
  const deathCauses = {};
  for (const r of results) {
    deathCauses[r.deathCause] = (deathCauses[r.deathCause] || 0) + 1;
  }

  // Hunter distance over time (avg per day)
  const hunterDistByDay = {};
  for (const r of results) {
    for (const p of r.phaseLog) {
      if (!hunterDistByDay[p.day]) hunterDistByDay[p.day] = [];
      hunterDistByDay[p.day].push(p.hunterDistance);
    }
  }
  const avgHunterDistByDay = {};
  for (const [day, dists] of Object.entries(hunterDistByDay)) {
    avgHunterDistByDay[day] = Math.round((dists.reduce((a, b) => a + b, 0) / dists.length) * 10) / 10;
  }

  // Stat trajectories (avg per day)
  const statsByDay = {};
  for (const r of results) {
    for (const p of r.phaseLog) {
      if (!statsByDay[p.day]) statsByDay[p.day] = { heat: [], stamina: [], thirst: [], hunger: [], count: 0 };
      const d = statsByDay[p.day];
      d.heat.push(p.heat);
      d.stamina.push(p.stamina);
      d.thirst.push(p.thirst);
      d.hunger.push(p.hunger);
      d.count++;
    }
  }
  const avgStatsByDay = {};
  for (const [day, s] of Object.entries(statsByDay)) {
    const avg = (arr) => Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
    avgStatsByDay[day] = {
      heat: avg(s.heat),
      stamina: avg(s.stamina),
      thirst: avg(s.thirst),
      hunger: avg(s.hunger)
    };
  }

  // Terrain repeat gaps
  const allTerrainGaps = results.map(r => r.terrainRepeatGaps.avg).filter(g => isFinite(g));
  const avgTerrainRepeatGap = allTerrainGaps.length > 0
    ? Math.round((allTerrainGaps.reduce((a, b) => a + b, 0) / allTerrainGaps.length) * 10) / 10
    : 'N/A';

  // Times lost hunters
  const lostHuntersCounts = results.map(r => r.timesLostHunters);

  // Encounter component frequencies (total appearances across all games)
  const terrainFreq = {};
  const opportunityFreq = {};
  const pressureFreq = {};
  let totalEncounters = 0;

  for (const r of results) {
    for (const [id, count] of Object.entries(r.terrainCounts || {})) {
      terrainFreq[id] = (terrainFreq[id] || 0) + count;
      totalEncounters += count;
    }
    for (const [id, count] of Object.entries(r.opportunityCounts || {})) {
      opportunityFreq[id] = (opportunityFreq[id] || 0) + count;
    }
    for (const [id, count] of Object.entries(r.pressureCounts || {})) {
      pressureFreq[id] = (pressureFreq[id] || 0) + count;
    }
  }

  return {
    n: results.length,
    days: {
      avg: Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10,
      median: days[Math.floor(days.length / 2)],
      min: days[0],
      max: days[days.length - 1],
      sorted: days
    },
    distance: {
      avg: Math.round((distances.reduce((a, b) => a + b, 0) / distances.length) * 10) / 10,
      median: distances[Math.floor(distances.length / 2)],
      min: distances[0],
      max: distances[distances.length - 1],
      sorted: distances
    },
    deathCauses: deathCauses,
    avgHunterDistByDay: avgHunterDistByDay,
    avgStatsByDay: avgStatsByDay,
    avgTerrainRepeatGap: avgTerrainRepeatGap,
    lostHunters: {
      avg: Math.round((lostHuntersCounts.reduce((a, b) => a + b, 0) / lostHuntersCounts.length) * 10) / 10,
      max: Math.max(...lostHuntersCounts)
    },
    uniqueEncountersAvg: Math.round(results.reduce((s, r) => s + r.uniqueEncounters, 0) / results.length),
    encounterFrequency: {
      totalEncounters: totalEncounters,
      terrains: terrainFreq,
      opportunities: opportunityFreq,
      pressures: pressureFreq
    }
  };
}

// ============================================================
// MAIN
// ============================================================

function parseArgs() {
  const args = { games: 500, strategy: 'all' };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--games=')) args.games = parseInt(arg.split('=')[1], 10);
    if (arg.startsWith('--strategy=')) args.strategy = arg.split('=')[1];
  }
  return args;
}

function run() {
  const args = parseArgs();
  const strategies = args.strategy === 'all'
    ? Object.keys(STRATEGIES)
    : [args.strategy];

  console.log(`\nPRIMAL CHASE SIMULATION ENGINE`);
  console.log(`${'='.repeat(50)}`);
  console.log(`Games per strategy: ${args.games}`);
  console.log(`Strategies: ${strategies.join(', ')}`);
  console.log();

  const allResults = {};

  for (const strategy of strategies) {
    if (!STRATEGIES.hasOwnProperty(strategy)) {
      console.error(`Unknown strategy: ${strategy}`);
      continue;
    }

    process.stdout.write(`Running ${strategy}... `);

    // Create fresh sandbox for each strategy
    const sandbox = createGameSandbox();
    const results = [];

    for (let i = 0; i < args.games; i++) {
      results.push(simulateOneGame(sandbox, strategy));
    }

    const summary = aggregateResults(results);
    allResults[strategy] = summary;

    console.log(`done (avg ${summary.days.avg} days, median ${summary.days.median})`);
  }

  // Save full results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputPath = path.join(__dirname, 'results', `sim-${timestamp}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2));
  console.log(`\nResults saved to: ${outputPath}`);

  // Also save as latest
  const latestPath = path.join(__dirname, 'results', 'latest.json');
  fs.writeFileSync(latestPath, JSON.stringify(allResults, null, 2));

  // Generate baseline stats for percentile system
  generateBaselineStats(allResults);

  return allResults;
}

function generateBaselineStats(allResults) {
  // Combine all strategies for baseline
  const allDays = [];
  const allDistances = [];
  const deathCauseTotals = {};

  for (const [strategy, data] of Object.entries(allResults)) {
    allDays.push(...data.days.sorted);
    allDistances.push(...data.distance.sorted);
    for (const [cause, count] of Object.entries(data.deathCauses)) {
      deathCauseTotals[cause] = (deathCauseTotals[cause] || 0) + count;
    }
  }

  allDays.sort((a, b) => a - b);
  allDistances.sort((a, b) => a - b);

  const baseline = {
    generatedAt: new Date().toISOString(),
    totalGames: allDays.length,
    days: allDays,
    distances: allDistances,
    deathCauses: deathCauseTotals
  };

  const baselinePath = path.join(__dirname, 'baseline-stats.json');
  fs.writeFileSync(baselinePath, JSON.stringify(baseline));
  console.log(`Baseline stats saved to: ${baselinePath}`);
}

// Run if executed directly
if (require.main === module) {
  run();
}

module.exports = { run, simulateOneGame, createGameSandbox, STRATEGIES };

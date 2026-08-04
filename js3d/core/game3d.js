// ============================================================
// GAME3D.JS — the turn loop, played on a map
// V1's balance model is kept intact: hunterDistance is still an
// authoritative scalar in miles, still driven by Hunters.js. What
// changes is that the player's *choice* is now a destination, and
// the hunters' position on the board is derived by walking back
// along the trail the player actually left.
// ============================================================

import * as Hex from '../world/hex.js';
import { World } from '../world/worldgen.js';

const MPH = () => window.CONFIG3D.milesPerHex;

export const Game3D = {
  state: null,
  world: null,

  /** Consumers set these; the presentation layer owns everything visual. */
  onTurnResolved: null,
  onDeath: null,

  // ------------------------------------------------------------
  // Setup
  // ------------------------------------------------------------

  _deepMerge(target, source) {
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) &&
          target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
        this._deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  },

  applyDifficulty(level) {
    if (!CONFIG._base) return;
    const base = JSON.parse(JSON.stringify(CONFIG._base));
    for (const key of Object.keys(base)) {
      if (key === '_base') continue;
      CONFIG[key] = base[key];
    }
    if (level && level !== 'normal' && CONFIG.difficulty[level]) {
      this._deepMerge(CONFIG, CONFIG.difficulty[level]);
    }
    this.applySpatialBalance();
  },

  /**
   * The board decides how far a stride carries you, so movement distances come
   * from hex geometry rather than from V1's flat numbers. Night keeps its
   * disadvantage through cost, not through a shorter stride.
   */
  applySpatialBalance() {
    const mph = MPH();
    const G = window.CONFIG3D.gaitRange;
    for (const phase of ['day', 'night']) {
      const acts = CONFIG.actions[phase];
      if (!acts) continue;
      if (acts.push) acts.push.distance = G.push * mph;
      if (acts.trot) acts.trot.distance = G.trot * mph;
    }
    // Compensate night's now-longer stride so darkness stays a trade, not a gift.
    if (CONFIG.actions.night) {
      const n = window.CONFIG3D.nightPenalty;
      CONFIG.actions.night.push.stamina -= n.pushStamina;
      CONFIG.actions.night.push.thirst += n.pushThirst;
      CONFIG.actions.night.trot.stamina -= n.trotStamina;
      CONFIG.actions.night.trot.thirst += n.trotThirst;
    }
  },

  newGame(seed) {
    const difficulty = (typeof Options !== 'undefined') ? Options.get('difficulty') : 'normal';
    this.applyDifficulty(difficulty);

    const useSeed = (seed === undefined || seed === null) ? Math.floor(Math.random() * 1e9) : (seed >>> 0);
    this.world = new World(useSeed);

    this.state = {
      seed: useSeed,
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
      lastActionSucceeded: null,

      // ---- spatial ----
      pos: { q: 0, r: 0 },
      /** Every hex the player has stood on, oldest first. */
      trail: [{ q: 0, r: 0 }],
      regionsVisited: {},
      landmarksVisited: 0,
      hexesTravelled: 0,
      highestGround: 0,
      waterDaysRun: 0,
      lastCornerCut: 0,
      lastTrailBreak: null
    };

    // Start on ground worth standing on rather than whatever noise produced.
    this._nudgeToOpeningHex();

    const startCell = this.world.get(this.state.pos.q, this.state.pos.r);
    this.state.regionsVisited[startCell.region] = true;
    this.world.markTrail(this.state.pos.q, this.state.pos.r, 1);

    if (typeof Encounters !== 'undefined') {
      Encounters.reset();
      this.state.currentEncounter = Encounters.forCell(startCell, this.state);
    }
    if (typeof Monologue !== 'undefined') {
      Monologue.reset();
      this.state.monologue = Monologue.select(this.state, null);
    }
    return this.state;
  },

  /** Walk the origin to a hex that is open and passable, so turn 1 has choices. */
  _nudgeToOpeningHex() {
    const candidates = Hex.spiral(0, 0, 3);
    for (const c of candidates) {
      const cell = this.world.get(c.q, c.r);
      if (cell.props.cat === 'open' && !cell.landmark) {
        this.state.pos = { q: c.q, r: c.r };
        this.state.trail = [{ q: c.q, r: c.r }];
        return;
      }
    }
  },

  // ------------------------------------------------------------
  // Reading the board
  // ------------------------------------------------------------

  cell(q, r) { return this.world.get(q, r); },

  currentCell() { return this.world.get(this.state.pos.q, this.state.pos.r); },

  /**
   * Every hex the player could move to this turn, keyed by hex key.
   * @returns {Map<string, {q,r,steps,cost,gait,path}>}
   */
  moveOptions() {
    const from = this.currentCell();
    const maxSteps = window.CONFIG3D.gaitRange.push;
    const reach = Hex.reachable(this.state.pos, maxSteps, this.world.costFn(from));
    const out = new Map();
    for (const [k, e] of reach) {
      if (e.steps === 0) continue;
      const path = Hex.pathFromReachable(reach, k);
      out.set(k, {
        q: e.q, r: e.r,
        steps: e.steps,
        cost: e.cost,
        gait: e.steps >= 2 ? 'push' : 'trot',
        path
      });
    }
    return out;
  },

  /**
   * What moving to a hex would cost, in the same terms V1 printed on buttons:
   * the action's own effects plus the phase's passive drain.
   */
  previewMove(option) {
    const gaitAction = Encounters.gaitAction(this.state.currentEncounter, option.gait);
    const effects = gaitAction ? { ...(gaitAction.effects || {}) } : { ...CONFIG.actions[this.state.phase][option.gait] };
    const drains = CONFIG.passiveDrain[this.state.phase];
    const dest = this.world.get(option.q, option.r);

    // Rough ground taxes the body beyond the flat cost of the gait.
    const roughness = (option.cost / option.steps) - 1;
    const extra = Math.round(roughness * window.CONFIG3D.roughnessCost * option.steps);

    const total = {
      heat: Math.round((effects.heat || 0) + (drains.heat || 0) + extra * 0.5),
      stamina: Math.round((effects.stamina || 0) + (drains.stamina || 0) - extra),
      thirst: Math.round((effects.thirst || 0) + (drains.thirst || 0) + extra * 0.4),
      hunger: Math.round((effects.hunger || 0) + (drains.hunger || 0))
    };

    return {
      option,
      gait: option.gait,
      miles: Math.round(option.steps * MPH() * 10) / 10,
      total,
      extra,
      dest,
      hunterAdvance: this._hunterAdvanceFor(option.steps * MPH(), this._pathHunterFactor(option.path)),
      trailBreakChance: this._trailBreakChance(option.path)
    };
  },

  /** In-place verbs available on the hex the player is standing on. */
  inPlaceActions() {
    return Encounters.inPlaceActions(this.state.currentEncounter);
  },

  // ------------------------------------------------------------
  // Hunters on the board
  // ------------------------------------------------------------

  /** Average difficulty the hunters face on the ground the player just crossed. */
  _pathHunterFactor(path) {
    if (!path || path.length < 2) return 1;
    let sum = 0;
    for (let i = 1; i < path.length; i++) sum += this.world.get(path[i].q, path[i].r).props.hunter;
    const avg = sum / (path.length - 1);
    const sensitivity = window.CONFIG3D.hunters.terrainSensitivity;
    // Capped at 1: hard ground slows them, but easy ground never makes them
    // faster than their base speed. Terrain is a lever the player pulls, not a
    // tax on choosing the sensible route.
    return Math.min(1, 1 + (1 / avg - 1) * sensitivity);
  },

  _hunterAdvanceFor(playerMiles, terrainFactor) {
    if (typeof Hunters === 'undefined') return 0;
    const raw = Hunters.getHunterAdvance(playerMiles, this.state);
    return Math.round(raw * terrainFactor * 10) / 10;
  },

  /** Odds that ground this poor at holding a print breaks the pursuit. */
  _trailBreakChance(path) {
    if (this.state.hunterState !== 'pursuit') return 0;
    if (!path || path.length < 2) return 0;
    let worst = Infinity;
    for (let i = 1; i < path.length; i++) {
      const s = this.world.get(path[i].q, path[i].r).props.scent;
      if (s < worst) worst = s;
    }
    const H = window.CONFIG3D.hunters;
    const hidden = Math.max(0, (H.scentFloor - worst) / H.scentFloor);
    return Math.min(0.75, H.trailLossBase * hidden);
  },

  /**
   * Where the band physically is: `hunterDistance` miles back along the trail
   * the player left. Falls off the end of the trail by extending the last leg.
   * @returns {{x:number, z:number, q:number, r:number, yaw:number}}
   */
  hunterWorldPosition() {
    const trail = this.state.trail;
    const mph = MPH();
    let remaining = Math.max(0, this.state.hunterDistance);

    for (let i = trail.length - 1; i > 0; i--) {
      const a = this.world.get(trail[i].q, trail[i].r);
      const b = this.world.get(trail[i - 1].q, trail[i - 1].r);
      if (remaining <= mph) {
        const t = remaining / mph;
        return {
          x: a.worldX + (b.worldX - a.worldX) * t,
          z: a.worldZ + (b.worldZ - a.worldZ) * t,
          y: a.height + (b.height - a.height) * t,
          q: t > 0.5 ? b.q : a.q,
          r: t > 0.5 ? b.r : a.r,
          yaw: Math.atan2(a.worldX - b.worldX, a.worldZ - b.worldZ)
        };
      }
      remaining -= mph;
    }

    // Past the beginning of the trail: keep going the way the trail was heading.
    const first = this.world.get(trail[0].q, trail[0].r);
    const second = this.world.get(trail[Math.min(1, trail.length - 1)].q, trail[Math.min(1, trail.length - 1)].r);
    let dx = first.worldX - second.worldX;
    let dz = first.worldZ - second.worldZ;
    const len = Math.hypot(dx, dz) || 1;
    const scale = (remaining / mph) * Hex.HEX_SIZE * Hex.SQRT3;
    dx = dx / len * scale;
    dz = dz / len * scale;
    return {
      x: first.worldX + dx,
      z: first.worldZ + dz,
      y: first.height,
      q: first.q, r: first.r,
      yaw: Math.atan2(-dx, -dz)
    };
  },

  // ------------------------------------------------------------
  // Turn resolution
  // ------------------------------------------------------------

  /** Move to a hex. `option` comes from moveOptions(). */
  commitMove(option) {
    if (!this.state || !this.state.isAlive) return null;
    const gaitAction = Encounters.gaitAction(this.state.currentEncounter, option.gait) || {
      key: option.gait,
      effects: { ...CONFIG.actions[this.state.phase][option.gait] },
      isStandard: true
    };
    const preview = this.previewMove(option);
    return this._resolve({
      kind: 'move',
      action: gaitAction,
      actionKey: option.gait,
      path: option.path,
      steps: option.steps,
      playerMiles: option.steps * MPH(),
      roughExtra: preview.extra,
      terrainFactor: this._pathHunterFactor(option.path),
      trailBreakChance: this._trailBreakChance(option.path)
    });
  },

  /** Take an in-place action: rest, drink, eat, or an encounter's own verb. */
  commitAction(actionKey) {
    if (!this.state || !this.state.isAlive) return null;
    const action = (this.state.currentEncounter.actions || []).find(a => a.key === actionKey);
    if (!action) return null;
    return this._resolve({
      kind: 'action',
      action,
      actionKey,
      path: [{ ...this.state.pos }],
      steps: 0,
      playerMiles: action.distance || 0,
      roughExtra: 0,
      terrainFactor: 1,
      trailBreakChance: 0
    });
  },

  _resolve(turn) {
    const S = this.state;
    const action = turn.action;
    S.lastAction = turn.actionKey;

    if (turn.actionKey === 'push' && S.phase === 'night') S.achievementStats.nightPushes++;
    if (turn.actionKey === 'rest') S.achievementStats.timesRested++;

    const before = { heat: S.heat, stamina: S.stamina, thirst: S.thirst, hunger: S.hunger, hunterDistance: S.hunterDistance };

    const effects = action.effects || {};

    // Risk and chance behave exactly as V1's processAction.
    let riskTriggered = false;
    if (action.risk && Math.random() < action.risk.chance) riskTriggered = true;

    let chanceSucceeded = true;
    if (action.chance !== undefined && action.chance < 1.0) chanceSucceeded = Math.random() < action.chance;

    if (action.isStandard || !action.isSituational || chanceSucceeded) {
      S.heat += effects.heat || 0;
      S.stamina += effects.stamina || 0;
      S.thirst += effects.thirst || 0;
      S.hunger += effects.hunger || 0;
    }

    if (riskTriggered && action.risk && action.risk.penalty) {
      const p = action.risk.penalty;
      S.heat += p.heat || 0;
      S.stamina += p.stamina || 0;
      S.thirst += p.thirst || 0;
      S.hunger += p.hunger || 0;
    }

    // Crossing hard ground costs more than crossing easy ground.
    if (turn.roughExtra) {
      S.heat += turn.roughExtra * 0.3;
      S.stamina -= turn.roughExtra;
      S.thirst += turn.roughExtra * 0.4;
    }

    const drains = CONFIG.passiveDrain[S.phase];
    S.heat += drains.heat || 0;
    S.stamina += drains.stamina || 0;
    S.thirst += drains.thirst || 0;
    S.hunger += drains.hunger || 0;

    // ---- move on the board ----
    if (turn.kind === 'move') {
      for (let i = 1; i < turn.path.length; i++) {
        const step = turn.path[i];
        S.pos = { q: step.q, r: step.r };
        S.trail.push({ q: step.q, r: step.r });
        this.world.markTrail(step.q, step.r, 1);
        S.hexesTravelled++;
      }
      if (S.trail.length > 400) S.trail.splice(0, S.trail.length - 400);
    }

    const cell = this.currentCell();
    S.regionsVisited[cell.region] = true;
    if (cell.height > S.highestGround) S.highestGround = cell.height;
    if (cell.cat === 'water') S.waterDaysRun++; else S.waterDaysRun = 0;
    if (cell.landmark && turn.kind === 'move') S.landmarksVisited++;

    // ---- hunters ----
    const advance = this._hunterAdvanceFor(turn.playerMiles, turn.terrainFactor);
    S.hunterDistance += turn.playerMiles - advance;

    if (S.phase === 'night' && typeof Hunters !== 'undefined') Hunters.updateTracking(S);

    // The encounter's own trail-loss choice still works exactly as it did.
    let brokeTrail = false;
    if (action.loseHunters && typeof Hunters !== 'undefined') {
      Hunters.loseTrail(S);
      brokeTrail = true;
      S.lastTrailBreak = 'action';
    }
    // Ground that holds no print can break the pursuit on its own.
    if (!brokeTrail && turn.trailBreakChance > 0 && Math.random() < turn.trailBreakChance) {
      Hunters.loseTrail(S);
      brokeTrail = true;
      S.lastTrailBreak = 'ground';
    }

    // Doubling back lets them cut the corner — the trail is long, the land is not.
    S.lastCornerCut = 0;
    if (!brokeTrail && S.hunterState === 'pursuit') {
      const hunterHex = this.hunterWorldPosition();
      const straight = Hex.distance(S.pos.q, S.pos.r, hunterHex.q, hunterHex.r) * MPH();
      // A hex grid makes every route a little crooked, so only a genuine
      // doubling-back — several hexes of slack — is worth them cutting across.
      const grace = MPH() * window.CONFIG3D.hunters.cornerCutGraceHexes;
      if (straight < S.hunterDistance - grace) {
        const cut = (S.hunterDistance - straight - grace) * window.CONFIG3D.hunters.cornerCutRate;
        S.hunterDistance -= cut;
        S.lastCornerCut = Math.round(cut * 10) / 10;
      }
    }

    if (turn.playerMiles > 0) S.distanceCovered += turn.playerMiles;

    if (turn.actionKey === 'drink' || action.key === 'drink') {
      S.hunterWaterBoostDays = CONFIG.hunter.waterBoostDuration;
    }
    if (S.hunterWaterBoostDays > 0 && S.phase === 'night') S.hunterWaterBoostDays -= 1;

    if (S.thirst >= 80) S.achievementStats.phasesWithHighThirst++;
    if (S.heat >= 90 || S.stamina <= 10 || S.thirst >= 90 || S.hunger >= 90 || S.hunterDistance <= 3) {
      S.achievementStats.phasesNearDeath++;
    }

    this.world.decayTrail(window.CONFIG3D.hunters.scentDecayPerTurn);
    this.clampStats();

    const result = {
      kind: turn.kind,
      actionKey: turn.actionKey,
      action,
      path: turn.path,
      steps: turn.steps,
      gait: turn.kind === 'move' ? turn.actionKey : 'rest',
      miles: Math.round(turn.playerMiles * 10) / 10,
      hunterAdvance: advance,
      brokeTrail,
      trailBreakKind: brokeTrail ? S.lastTrailBreak : null,
      cornerCut: S.lastCornerCut,
      riskTriggered,
      chanceSucceeded,
      before,
      landmark: cell.landmark
    };

    const deathCause = this.checkDeath();
    if (deathCause) {
      S.isAlive = false;
      S.deathCause = deathCause;
      result.died = true;
      result.deathCause = deathCause;
      if (this.onDeath) this.onDeath(S, result);
      return result;
    }

    S.lastActionSucceeded = chanceSucceeded;
    S.lastOutcome = this.buildOutcomeText(action, riskTriggered, chanceSucceeded, result);

    this.advancePhase();

    // Resting keeps the same hex, so the land itself should not change —
    // only what the land is offering you right now.
    const nextCell = this.currentCell();
    if (typeof Encounters !== 'undefined') {
      S.currentEncounter = Encounters.forCell(nextCell, S);
    }
    if (typeof Monologue !== 'undefined') {
      S.monologue = Monologue.select(S, chanceSucceeded ? turn.actionKey : null);
    }

    result.outcome = S.lastOutcome;
    if (this.onTurnResolved) this.onTurnResolved(S, result);
    return result;
  },

  advancePhase() {
    if (this.state.phase === 'day') {
      this.state.phase = 'night';
    } else {
      this.state.phase = 'day';
      this.state.day += 1;
    }
  },

  checkDeath() {
    const S = this.state;
    if (S.hunterDistance <= CONFIG.death.minHunterDistance) return 'caught';
    if (S.heat >= CONFIG.death.maxHeat) return 'heatstroke';
    if (S.stamina <= CONFIG.death.minStamina) return 'exhaustion';
    if (S.thirst >= CONFIG.death.maxThirst) return 'dehydration';
    if (S.hunger >= CONFIG.death.maxHunger) return 'starvation';
    return null;
  },

  clampStats() {
    const S = this.state;
    S.heat = Math.max(0, Math.min(100, S.heat));
    S.stamina = Math.max(0, Math.min(100, S.stamina));
    S.thirst = Math.max(0, Math.min(100, S.thirst));
    S.hunger = Math.max(0, Math.min(100, S.hunger));
  },

  // ------------------------------------------------------------
  // Narration
  // ------------------------------------------------------------

  buildOutcomeText(action, riskTriggered, chanceSucceeded, result) {
    if (riskTriggered && action.risk && action.risk.text) return action.risk.text;

    if (action.chance !== undefined && !chanceSucceeded) {
      const failTexts = [
        'You search but find nothing. The effort was wasted, and the hunters gain ground.',
        'Your attempt yields nothing. The land does not always provide.',
        'The search comes up empty. Time lost, nothing gained.'
      ];
      return failTexts[Math.floor(Math.random() * failTexts.length)];
    }

    if (action.description && !action.isStandard && action.chance === undefined) return action.description;

    const S = this.state;
    const isNight = S.phase === 'night';
    const key = action.key;
    const miles = result ? result.miles : 0;
    const dest = this.currentCell();

    if (key === 'push') {
      const texts = isNight
        ? [`You push through the darkness into ${dest.name || 'new ground'}, ${miles} miles behind you. Exhaustion follows.`,
           `Hard miles in the dark. ${miles} miles gained. The shadows offer no comfort.`]
        : [`You push hard through the heat, covering ${miles} miles. The dust rises behind you.`,
           `${miles} miles of relentless flight. Your body protests but obeys.`];
      return texts[Math.floor(Math.random() * texts.length)];
    }

    if (key === 'trot') {
      const texts = isNight
        ? [`A steady ${miles} miles through the night. You preserve yourself.`,
           `You trot through the darkness, covering ${miles} miles.`]
        : [`You maintain a steady trot, covering ${miles} miles. Is it enough?`,
           `${miles} miles at a sustainable pace. The hunters match your rhythm.`];
      return texts[Math.floor(Math.random() * texts.length)];
    }

    if (key === 'rest') {
      const texts = isNight
        ? ['You rest under the stars. Your body recovers, but they draw closer.',
           'The cool night soothes your burning skin. Dawn will come too soon.']
        : ['You find shade and rest. The heat drains away. The hunters do not rest.',
           'You stop to recover. The gap between you and them narrows.'];
      return texts[Math.floor(Math.random() * texts.length)];
    }

    if (key === 'drink' || key === 'dig' || key === 'wallow' || key === 'search') {
      return 'Water. The world makes sense again when your throat is cool. They will know you were here.';
    }
    if (key === 'eat' || key === 'scavenge' || key === 'hunt' || key === 'feed' || key === 'forage' || key === 'steal') {
      return 'Meat in your belly. Strength returning. But the delay costs you distance.';
    }
    return 'You act. The world responds. The hunt continues.';
  },

  /** One line about what the ground just did to the pursuit. */
  spatialNote(result) {
    if (!result) return null;
    if (result.brokeTrail && result.trailBreakKind === 'ground') {
      const cell = this.currentCell();
      if (cell.cat === 'water') return 'The water takes your scent and gives nothing back. Behind you, the pursuit falters.';
      if (cell.cat === 'rocky') return 'Bare stone holds no print. For the first time in days, you are not a line on the ground.';
      return 'The ground here keeps your secret. Their certainty breaks.';
    }
    if (result.cornerCut > 0.4) {
      return `They read the shape of your flight and cut across it. ${result.cornerCut} miles, gone for nothing.`;
    }
    return null;
  },

  /** Achievements that only make sense on a map, appended to Score's list. */
  spatialAchievements() {
    const S = this.state;
    const A = window.CONFIG3D.spatialAchievements;
    const out = [];
    if (S.highestGround > window.CONFIG3D.world.heightScale * 1.2) out.push(A.highGround);
    if (Object.keys(S.regionsVisited).length >= window.CONFIG3D.regions.length) out.push(A.everyRegion);
    if (S.landmarksVisited >= 3) out.push(A.landmarks);
    if (S.waterDaysRun >= 6) out.push(A.riverRunner);
    return out;
  }
};

if (typeof window !== 'undefined') window.Game3D = Game3D;

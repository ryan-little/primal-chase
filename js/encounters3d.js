// ============================================================
// ENCOUNTERS3D.JS — bind V1's encounter generator to a map hex
// V1 chose the terrain itself. In 3D the world chose it, so the
// generator needs a way to compose an encounter for a terrain it
// was handed. Everything else — opportunities, pressures, actions,
// signatures, rares — is V1's, untouched.
// ============================================================

(function (E) {
  if (!E) return;

  /** Look up a terrain definition by the id the worldgen produced. */
  E.terrainById = function (id) {
    if (!this._terrainIndex) {
      this._terrainIndex = new Map();
      for (const t of this.terrains) this._terrainIndex.set(t.id, t);
    }
    return this._terrainIndex.get(id) || null;
  };

  /** Pick an opportunity compatible with a terrain, honouring the phase. */
  E.pickOpportunity = function (terrain, gameState) {
    const isNight = gameState.phase === 'night';
    const dedup = (o) => o.baseId || o.id;
    const compatible = (o) => {
      const checkId = o.baseId || o.id;
      return terrain.compatible.includes(checkId) || terrain.compatible.includes(o.id);
    };
    const phaseOk = (o) => {
      if (o.nightOnly && !isNight) return false;
      return true;
    };

    let pool = this.opportunities.filter(o => phaseOk(o) && compatible(o) && !this.recentOpportunities.includes(dedup(o)));
    if (!pool.length) pool = this.opportunities.filter(o => phaseOk(o) && compatible(o));
    if (!pool.length) pool = this.opportunities.filter(o => phaseOk(o));
    const opportunity = pool[Math.floor(Math.random() * pool.length)];
    this.recentOpportunities.push(dedup(opportunity));
    if (this.recentOpportunities.length > 12) this.recentOpportunities.shift();
    return opportunity;
  };

  /** Pick a pressure whose condition the current state satisfies. */
  E.pickPressure = function (gameState) {
    const test = (p) => { try { return p.condition(gameState); } catch (e) { return p.fallbackCondition; } };
    let pool = this.pressures.filter(p => !this.recentPressures.includes(p.id) && test(p));
    if (!pool.length) pool = this.pressures.filter(test);
    if (!pool.length) pool = this.pressures.filter(p => p.fallbackCondition);
    const pressure = pool[Math.floor(Math.random() * pool.length)];
    this.recentPressures.push(pressure.id);
    if (this.recentPressures.length > 7) this.recentPressures.shift();
    if (pressure.oneTime) this._usedOldTerritory = true;
    return pressure;
  };

  /**
   * Compose a full encounter for a terrain the map already decided on.
   * @param {string} terrainId
   * @param {Object} gameState
   * @returns {Object} same shape as Encounters.buildCombinatorial()
   */
  E.buildForTerrain = function (terrainId, gameState) {
    const terrain = this.terrainById(terrainId);
    if (!terrain) return this.buildCombinatorial(gameState);

    const opportunity = this.pickOpportunity(terrain, gameState);
    const pressure = this.pickPressure(gameState);

    const terrainText = (gameState.phase === 'night' && terrain.nightText) ? terrain.nightText : terrain.text;
    const text = `${terrainText} ${opportunity.text} ${pressure.text}`;
    const actions = this.buildCombinatorialActions(terrain, opportunity, pressure, gameState);

    return {
      type: 'combinatorial',
      id: `${terrain.id}_${opportunity.id}_${pressure.id}`,
      name: terrain.name,
      text,
      terrain,
      opportunity,
      pressure,
      actions,
      loseHuntersAvailable: false
    };
  };

  /**
   * A landmark hex hands out a hand-crafted encounter instead of a generated
   * one. Rares are rolled first, then unused signatures, then — if the run has
   * exhausted them — a normal encounter, so a landmark is never a dead end.
   */
  E.buildLandmark = function (terrainId, gameState) {
    if (Math.random() < 0.22) {
      const rare = this.tryRare(gameState);
      if (rare) { rare.fromLandmark = true; return rare; }
    }
    const sig = this.trySignature(gameState);
    if (sig) { sig.fromLandmark = true; return sig; }
    const fallback = this.buildForTerrain(terrainId, gameState);
    fallback.fromLandmark = true;
    return fallback;
  };

  /** Day-1 tutorial encounters, kept from V1. Returns null when not applicable. */
  E.buildTutorial = function (gameState) {
    const showTutorial = (typeof Options !== 'undefined') ? Options.get('showTutorial') : true;
    if (gameState.day !== 1 || showTutorial === false) return null;
    const id = gameState.phase === 'day' ? 'tutorial_day' : 'tutorial_night';
    if (this.usedSignatures.has(id)) return null;
    const tutorial = this.signatures.find(s => s.id === id);
    if (!tutorial) return null;
    this.usedSignatures.add(id);
    return this.formatSignatureEncounter(tutorial, gameState);
  };

  /**
   * The encounter for arriving on a hex.
   * @param {{terrain:string, landmark:boolean}} cell
   */
  E.forCell = function (cell, gameState) {
    const tutorial = this.buildTutorial(gameState);
    let encounter;
    if (tutorial) encounter = tutorial;
    else if (cell.landmark) encounter = this.buildLandmark(cell.terrain, gameState);
    else encounter = this.buildForTerrain(cell.terrain, gameState);
    this.ensureRest(encounter, gameState);
    this.ensureHunt(encounter, cell, gameState);
    return encounter;
  };

  /** Verbs that count as feeding, however the encounter happens to name them. */
  const EAT_KEYS = ['eat', 'scavenge', 'hunt', 'feed', 'forage', 'steal'];

  /** How likely a hunt is to pay off, by terrain category. */
  const HUNT_ODDS = { water: 0.5, open: 0.42, dense: 0.4, shelter: 0.34, rocky: 0.26 };

  const HUNT_TEXT = {
    water: 'Lie up in the reeds and wait for something to come down to drink',
    open: 'Stalk the open ground for anything slow enough to catch',
    dense: 'Work the thickets for whatever is sheltering in them',
    shelter: 'Search the broken ground for something worth killing',
    rocky: 'Hunt the crevices for hyrax and whatever else lives in stone'
  };

  /**
   * The player is an apex predator. On any ground, they can spend a phase
   * trying to kill something — poor odds on bare rock, better beside water.
   * Without this the map's terrain distribution starves the player in a way
   * V1's uniform terrain roll never did.
   */
  E.ensureHunt = function (encounter, cell, gameState) {
    if (!encounter || !encounter.actions) return;
    if (encounter.actions.some(a => EAT_KEYS.includes(a.key))) return;
    const cat = (cell && cell.cat) || 'open';
    const chance = HUNT_ODDS[cat] !== undefined ? HUNT_ODDS[cat] : 0.36;
    const effects = this.getSituationalEffects(gameState.phase, 'eat');
    encounter.actions.push({
      key: 'hunt',
      name: 'Hunt',
      description: `${HUNT_TEXT[cat] || HUNT_TEXT.open} (${Math.round(chance * 100)}% chance)`,
      effects,
      distance: 0,
      chance,
      isStandard: false,
      isSituational: true
    });
  };

  /**
   * V1 guaranteed the player could always stop and recover. Hand-crafted
   * encounters list their own choices and may not include one, so add it back.
   */
  E.ensureRest = function (encounter, gameState) {
    if (!encounter || !encounter.actions) return;
    if (encounter.actions.some(a => a.key === 'rest')) return;
    const base = CONFIG.actions[gameState.phase] && CONFIG.actions[gameState.phase].rest;
    if (!base) return;
    encounter.actions.push({
      key: 'rest',
      name: 'Rest',
      description: 'Rest and recover your strength',
      effects: { ...base },
      distance: 0,
      isStandard: true
    });
  };

  /** In-place verbs only — movement is chosen on the map, not in the action bar. */
  E.inPlaceActions = function (encounter) {
    if (!encounter || !encounter.actions) return [];
    return encounter.actions.filter(a => a.key !== 'push' && a.key !== 'trot');
  };

  /** The push/trot entries, which the map uses for gait effects. */
  E.gaitAction = function (encounter, gait) {
    if (!encounter || !encounter.actions) return null;
    return encounter.actions.find(a => a.key === gait) || null;
  };
})(typeof Encounters !== 'undefined' ? Encounters : null);

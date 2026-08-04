// ============================================================
// CONFIG3D.JS — spatial layer on top of CONFIG (js/config.js)
// Loaded as a classic script so it can extend the V1 globals.
// Every tunable number for the 3D game lives here.
// ============================================================

const CONFIG3D = {
  version: '2.0.0',

  /** One hex step of ground. V1's Trot was 3.5mi, Push 6.5mi over two steps. */
  milesPerHex: 3.25,

  /** Move range in hex steps, by gait. Rest stays put. */
  gaitRange: { rest: 0, trot: 1, push: 2 },

  /**
   * Night strides are now as long as day strides because the board says so,
   * so night pays for the extra ground in the body instead.
   */
  nightPenalty: { pushStamina: 4, pushThirst: 3, trotStamina: 2, trotThirst: 2 },

  /** Stamina charged per unit of terrain roughness above the easiest going. */
  roughnessCost: 4,

  world: {
    /** Hexes generated around the player each frame-budgeted stream tick. */
    streamRadius: 14,
    /** Hexes kept alive; beyond this they are recycled. */
    keepRadius: 20,
    /** Vertical world units per unit of normalised elevation. */
    heightScale: 4.2,
    /** Chance per hex of hosting a landmark (signature encounter site). */
    landmarkChance: 0.032,
    /** Never place a landmark within this many hexes of another. */
    landmarkSpacing: 4,
    /** Low-frequency region field scale (smaller = larger regions). */
    regionScale: 0.022,
    elevationScale: 0.075,
    moistureScale: 0.055,
    riverScale: 0.021,
    /**
     * |riverNoise| below this becomes a watercourse. Water is the single most
     * important thing on the board — the player has to be able to see it from
     * a distance and plan a route to it, so channels are generous.
     */
    riverThreshold: 0.085
  },

  camera: {
    minDistance: 34,
    maxDistance: 175,
    defaultDistance: 78,
    minPolar: 0.20,
    maxPolar: 1.28,
    defaultPolar: 0.87,
    followLerp: 0.09,
    fov: 50,
    /**
     * World units the camera looks *past* the player, along the flight
     * direction. Lifts the cat clear of the situation panel and puts the
     * ground still to be chosen from in the middle of the frame.
     */
    leadDistance: 15
  },

  /** Seconds of animation for one turn's movement, per hex step. */
  timing: {
    stepDuration: 0.85,
    restDuration: 1.5,
    phaseSweep: 1.4,
    hunterCatchup: 1.0
  },

  /** Quality tiers. `auto` picks one from device capability at boot. */
  quality: {
    low:    { dpr: 1.0, shadows: false, shadowSize: 0,    drawHexes: 8,  sceneryDensity: 0.35, particles: 0.3, grass: false, aa: false },
    medium: { dpr: 1.5, shadows: true,  shadowSize: 1024, drawHexes: 11, sceneryDensity: 0.7,  particles: 0.7, grass: true,  aa: false },
    high:   { dpr: 2.0, shadows: true,  shadowSize: 2048, drawHexes: 14, sceneryDensity: 1.0,  particles: 1.0, grass: true,  aa: true  }
  },

  /** Palette lifted from css/style.css so 2D and 3D read as one game. */
  palette: {
    bgDark: 0x1a0f08,
    bgDarker: 0x2a1a0e,
    amber: 0xd4883a,
    gold: 0xd4a574,
    danger: 0xc44536,
    safe: 0x4a7c3f,
    night: 0x6b8cae,
    border: 0x4a3526
  },

  sky: {
    day:   { top: 0x4a7fb8, horizon: 0xd9c39a, sun: 0xfff4d8, fog: 0xd2bC94, fogNear: 90, fogFar: 260, ambient: 0.66, sunIntensity: 2.15 },
    dusk:  { top: 0x3d3358, horizon: 0xcf7a3e, sun: 0xffb060, fog: 0xa8703f, fogNear: 70, fogFar: 215, ambient: 0.44, sunIntensity: 1.35 },
    // Night has to stay legible: the board is the interface, and a player who
    // cannot read the terrain cannot make the decision the game is asking for.
    night: { top: 0x0e1728, horizon: 0x2b3850, sun: 0xbcd2f2, fog: 0x1e2a3e, fogNear: 60, fogFar: 195, ambient: 0.66, sunIntensity: 0.92 },
    dawn:  { top: 0x415070, horizon: 0xc98a5e, sun: 0xffd8b0, fog: 0x9a7250, fogNear: 70, fogFar: 215, ambient: 0.48, sunIntensity: 1.32 }
  },

  hunters: {
    /** How many hunter figures walk in the band. */
    bandSize: 5,
    /** Extra miles per turn the hunters shed when crossing hard ground. */
    terrainSensitivity: 0.55,
    /** Scent decay applied to the whole trail each turn. */
    scentDecayPerTurn: 0.09,
    /** Peak chance of breaking the pursuit on ground that holds no print. */
    trailLossBase: 0.34,
    /** Ground with `scent` at or above this leaves a trail a tracker can read. */
    scentFloor: 0.85,
    /** Fraction of a doubled-back detour the hunters claw back by cutting across. */
    cornerCutRate: 0.32,
    /** Slack, in hexes, before a crooked route counts as doubling back. */
    cornerCutGraceHexes: 2.5,
    /** Distance (miles) at which the player can hear/see them clearly. */
    visibleRange: 26
  },

  /** Per-terrain spatial properties. Category matches CONFIG.terrainCategories. */
  terrain: {
    // ---- water ----
    // `scent` is how well the ground holds a print: sand and clay betray you,
    // running water and bare rock give nothing back to a tracker.
    watering_hole:    { cat: 'water',   color: 0x6d7a4a, height: -0.55, move: 1.15, hunter: 1.0,  scent: 0.30, scenery: 'reeds',    density: 0.7, water: true },
    seasonal_stream:  { cat: 'water',   color: 0x6f8352, height: -0.45, move: 1.15, hunter: 0.95, scent: 0.25, scenery: 'reeds',    density: 0.6, water: true },
    reed_bed:         { cat: 'water',   color: 0x5f7742, height: -0.35, move: 1.45, hunter: 1.25, scent: 0.40, scenery: 'reeds',    density: 1.2 },
    dried_marsh:      { cat: 'water',   color: 0x7d7a52, height: -0.3,  move: 1.25, hunter: 1.1,  scent: 0.95, scenery: 'reeds',    density: 0.8 },
    dry_riverbed:     { cat: 'water',   color: 0xa08a62, height: -0.5,  move: 1.0,  hunter: 0.9,  scent: 1.20, scenery: 'stones',   density: 0.7 },
    sandy_wash:       { cat: 'water',   color: 0xd4b483, height: -0.25, move: 1.3,  hunter: 1.05, scent: 1.50, scenery: 'stones',   density: 0.35 },

    // ---- open ----
    open_plain:       { cat: 'open',    color: 0xb59a53, height: 0.0,   move: 1.0,  hunter: 0.85, scent: 1.0,  scenery: 'grass',    density: 1.0 },
    tall_grass:       { cat: 'dense',   color: 0xa8913f, height: 0.05,  move: 1.15, hunter: 1.1,  scent: 0.75, scenery: 'tallgrass',density: 1.4 },
    salt_flat:        { cat: 'open',    color: 0xdcd7c4, height: -0.15, move: 0.9,  hunter: 0.75, scent: 1.4,  scenery: 'none',     density: 0 },
    red_dunes:        { cat: 'open',    color: 0xc27a4a, height: 0.35,  move: 1.5,  hunter: 1.2,  scent: 1.3,  scenery: 'none',     density: 0 },
    clay_pan:         { cat: 'open',    color: 0xbfa070, height: -0.1,  move: 0.95, hunter: 0.8,  scent: 1.5,  scenery: 'cracks',   density: 0.5 },
    dry_lake_bed:     { cat: 'open',    color: 0xc9bda0, height: -0.35, move: 0.95, hunter: 0.8,  scent: 1.35, scenery: 'cracks',   density: 0.6 },
    burned_ground:    { cat: 'open',    color: 0x5c4d3f, height: 0.0,   move: 1.05, hunter: 0.9,  scent: 0.6,  scenery: 'burnt',    density: 0.9 },
    ash_field:        { cat: 'open',    color: 0x7a7066, height: -0.05, move: 1.1,  hunter: 0.9,  scent: 0.55, scenery: 'burnt',    density: 0.7 },
    elephant_path:    { cat: 'open',    color: 0xa88a5c, height: 0.0,   move: 0.8,  hunter: 0.7,  scent: 1.2,  scenery: 'grass',    density: 0.4 },

    // ---- dense ----
    acacia_grove:     { cat: 'dense',   color: 0x7e8449, height: 0.1,   move: 1.2,  hunter: 1.15, scent: 0.7,  scenery: 'acacia',   density: 1.0 },
    mopane_woodland:  { cat: 'dense',   color: 0x6f7a45, height: 0.12,  move: 1.3,  hunter: 1.2,  scent: 0.65, scenery: 'acacia',   density: 1.3 },
    bamboo_grove:     { cat: 'dense',   color: 0x6d8a4c, height: 0.15,  move: 1.4,  hunter: 1.3,  scent: 0.5,  scenery: 'bamboo',   density: 1.5 },
    fallen_tree_grove:{ cat: 'dense',   color: 0x7a6f4c, height: 0.08,  move: 1.45, hunter: 1.35, scent: 0.6,  scenery: 'deadwood', density: 1.2 },
    thorn_thicket:    { cat: 'dense',   color: 0x8a7c4a, height: 0.1,   move: 1.55, hunter: 1.45, scent: 0.55, scenery: 'thorn',    density: 1.4 },
    fever_trees:      { cat: 'dense',   color: 0x9aa257, height: 0.05,  move: 1.2,  hunter: 1.1,  scent: 0.7,  scenery: 'fever',    density: 1.1 },

    // ---- rocky ----
    rocky_outcrop:    { cat: 'rocky',   color: 0x7d7166, height: 0.5,   move: 1.35, hunter: 1.2,  scent: 0.35, scenery: 'rocks',    density: 1.1 },
    granite_plateau:  { cat: 'rocky',   color: 0x8d8378, height: 0.7,   move: 1.25, hunter: 1.1,  scent: 0.25, scenery: 'rocks',    density: 0.7 },
    volcanic_rock:    { cat: 'rocky',   color: 0x5e564e, height: 0.55,  move: 1.5,  hunter: 1.3,  scent: 0.3,  scenery: 'rocks',    density: 1.3 },
    sandstone_arches: { cat: 'rocky',   color: 0xb07a52, height: 0.6,   move: 1.3,  hunter: 1.15, scent: 0.35, scenery: 'arches',   density: 0.8 },
    whistling_caves:  { cat: 'rocky',   color: 0x6a5f57, height: 0.65,  move: 1.35, hunter: 1.2,  scent: 0.2,  scenery: 'caves',    density: 0.9 },
    ridge_line:       { cat: 'rocky',   color: 0x91826d, height: 0.95,  move: 1.45, hunter: 1.25, scent: 0.4,  scenery: 'rocks',    density: 0.8 },
    dry_ravine:       { cat: 'rocky',   color: 0x8a7355, height: -0.6,  move: 1.4,  hunter: 1.25, scent: 0.45, scenery: 'stones',   density: 1.0 },

    // ---- shelter ----
    kopje:            { cat: 'shelter', color: 0x877a6b, height: 0.8,   move: 1.35, hunter: 1.2,  scent: 0.3,  scenery: 'boulders', density: 1.2 },
    baobab:           { cat: 'shelter', color: 0x9a8455, height: 0.15,  move: 1.05, hunter: 0.95, scent: 0.8,  scenery: 'baobab',   density: 0.5 },
    overhang_cave:    { cat: 'shelter', color: 0x6f645a, height: 0.45,  move: 1.2,  hunter: 1.1,  scent: 0.25, scenery: 'caves',    density: 0.9 },
    termite_cathedral:{ cat: 'shelter', color: 0xa87c52, height: 0.2,   move: 1.15, hunter: 1.0,  scent: 0.85, scenery: 'termite',  density: 1.2 }
  },

  /**
   * Biome regions. Low-frequency noise picks a region; the region's weighted pool
   * picks the terrain. Travelling far enough always changes the character of the land.
   */
  regions: [
    { id: 'plains',    name: 'the open plains',   heightBias: 0.0,  pool: [
      ['open_plain', 34], ['tall_grass', 22], ['termite_cathedral', 9], ['elephant_path', 9],
      ['acacia_grove', 12], ['clay_pan', 8], ['baobab', 3], ['rocky_outcrop', 3] ] },
    { id: 'riverlands',name: 'the river country', heightBias: -0.3, pool: [
      ['mopane_woodland', 18], ['fever_trees', 16], ['reed_bed', 13], ['dried_marsh', 12],
      ['dry_riverbed', 14], ['tall_grass', 12], ['acacia_grove', 10], ['sandy_wash', 5] ] },
    { id: 'badlands',  name: 'the burning flats', heightBias: 0.05, pool: [
      ['salt_flat', 20], ['red_dunes', 18], ['dry_lake_bed', 16], ['sandy_wash', 16],
      ['clay_pan', 15], ['open_plain', 10], ['dry_ravine', 5] ] },
    { id: 'highlands', name: 'the high stone',    heightBias: 0.55, pool: [
      ['rocky_outcrop', 20], ['granite_plateau', 16], ['ridge_line', 14], ['kopje', 13],
      ['sandstone_arches', 11], ['whistling_caves', 8], ['dry_ravine', 10], ['overhang_cave', 8] ] },
    { id: 'woodland',  name: 'the thornlands',    heightBias: 0.1,  pool: [
      ['acacia_grove', 20], ['mopane_woodland', 17], ['thorn_thicket', 16], ['bamboo_grove', 11],
      ['fallen_tree_grove', 12], ['fever_trees', 10], ['baobab', 7], ['tall_grass', 7] ] },
    { id: 'scorched',  name: 'the scorched land', heightBias: 0.15, pool: [
      ['burned_ground', 26], ['ash_field', 22], ['volcanic_rock', 18], ['dry_lake_bed', 12],
      ['open_plain', 12], ['rocky_outcrop', 10] ] }
  ],

  /** Terrains forced onto hexes the river field runs through. */
  riverTerrains: {
    wet: ['watering_hole', 'seasonal_stream', 'reed_bed'],
    dry: ['dry_riverbed', 'sandy_wash', 'dried_marsh']
  },

  /** Achievements unique to the spatial game, appended to Score's list. */
  spatialAchievements: {
    highGround: 'Sky Walker — Crossed the high stone',
    everyRegion: 'Land Eater — Set paw in every country',
    landmarks: 'Wanderer — Sought out 3 landmarks',
    riverRunner: 'River Runner — Followed water for 3 days'
  }
};

// Category fallback for anything the table misses.
CONFIG3D.terrainOf = function (id) {
  return CONFIG3D.terrain[id] || { cat: 'open', color: 0xb59a53, height: 0, move: 1, hunter: 1, scent: 1, scenery: 'grass', density: 0.6 };
};

if (typeof window !== 'undefined') window.CONFIG3D = CONFIG3D;

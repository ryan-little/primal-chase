// The rules of the chase. Pure simulation: no drawing here.
// You are faster; they never tire. Heat is the leash: every burst of speed has to be paid
// back in shade, and every minute you spend paying it, they walk your trail.

import { clamp, dist, rng, TAU, wrapAngle, lerp } from './util.js';
import { World, G, GROUND_INFO } from './world.js';
import { PERKS, PERK_BY_ID } from './perks.js';
import { SECRETS } from './secrets.js';
import { SPECIES, pickSpecies } from './fauna.js';
import { B } from './terrain.js';

export const DAY_LEN = 170; // seconds per full day/night cycle
export const T = {
  trot: 66, sprint: 132, pounceSpeed: 340, pounceTime: 0.22,
  hunterWalk: 50, hunterWalkPerDay: 6, hunterRun: 76, hunterRunPerDay: 5,
  dogRun: 136, spearSpeed: 310,
};

export const BITS = [
  'The wind turns. They are still coming.',
  'Heat rises off the pan like breath.',
  'Somewhere behind, a song you do not understand.',
  'Their feet do not stop. Yours must.',
  'Water tastes of iron and far rain.',
  'The land remembers every step you give it.',
  'Rock keeps no secrets. Mud keeps them all.',
  'Old bones in the grass. Someone ran here before you.',
  'They run the way water runs. Without hurry. Without end.',
  'The sun is theirs. The dark is yours.',
];

let UID = 1;

export class Game {
  constructor(seed, art, audio, opts = {}) {
    this.seed = seed;
    this.r = rng(seed * 31 + 7);
    this.art = art;
    this.audio = audio;
    this.world = new World(seed, art, { worker: !opts.headless });
    this.events = []; // {type, ...} consumed by main for fx + hints
    this.time = 0;
    this.clock = opts.startClock ?? 0.07; // 0..1 through the day, starts at dawn
    this.day = 1;
    this.score = 0;
    this.mult = 1;
    this.multHold = 0;
    this.distF = 0;
    this.stats = { dist: 0, prey: 0, dodges: 0, breaks: 0, knockdowns: 0, dogs: 0, spearsHit: 0, bestClose: 9999 };
    this.meters = 0;
    this.slowmo = 0;
    this.over = false;
    this.deathTime = 0;
    this.weather = { rain: 0, target: 0, until: 0, next: this.r.range(40, 80), flash: 0 };

    const [sx, sy] = this.world.findStart();
    this.world.prepare(sx, sy, 700, 9999);
    const p = (this.player = {
      x: sx, y: sy, vx: 0, vy: 0, face: 1, dir: 0,
      health: 100, heat: 18, stamina: 100, water: 82, food: 70,
      state: 'idle', anim: 0, still: 0, overheated: false, exhausted: false,
      pounce: 0, pounceCd: 0, pdx: 0, pdy: 0, iframes: 0, hurt: 0,
      drinking: false, eating: null, lying: false, inShade: false, ground: G.GRASS,
      odom: 0, lastPrint: 0, sprinting: false, stepT: 0,
    });

    // The band starts well behind, with a trail already laid from where you came.
    const a = this.r() * TAU;
    const startD = 520;
    this.trail = [];
    for (let i = 0; i <= 52; i++) {
      const t = i / 52;
      const x = sx + Math.cos(a) * startD * (1 - t) + Math.sin(t * 7) * 18;
      const y = sy + Math.sin(a) * startD * (1 - t) + Math.cos(t * 5) * 18;
      this.trail.push({ x, y, s: 1, water: false, id: UID++ });
    }
    this.hunters = [];
    this.dogs = [];
    this.band = {
      mode: 'track', // track | search | chase
      idx: 0, seen: 0, lostT: 0, searchR: 0, searchX: 0, searchY: 0, searchT: 0,
      x: sx + Math.cos(a) * startD, y: sy + Math.sin(a) * startD,
      sightedOnce: false, lastSeenX: sx, lastSeenY: sy,
    };
    this.addHunters(3);
    this.prey = [];
    this.carcasses = [];
    this.spears = [];
    this.stuck = [];
    this.warnings = [];
    this.vultures = [];
    this.spawnT = 0;
    this.bit = null;
    this.runners = [];
    this.lions = [];
    this.perks = {};
    this.found = new Set();
    this.intelDay = 0;
    this.reveals = [];
    this.perkChoices = 0;
    this.windUsedDay = 0;
    this.scoutT = 95;
    this.hist = [];
    this.lineP = 0;
    this.intercepts = 0;
    this.straightness = 0;
    this.croc = null;
    this.deepT = 0;
    this.hyenas = [];
    this.gnus = [];
    this.stampedeT = this.r.range(40, 80);
    this.stampedeWarn = 0;
  }

  addHunters(n) {
    for (let i = 0; i < n; i++) {
      const k = this.hunters.length;
      const ang = this.r() * TAU;
      this.hunters.push({
        id: UID++, x: this.band.x + Math.cos(ang) * 20, y: this.band.y + Math.sin(ang) * 20,
        vx: 0, vy: 0, face: 1, anim: this.r(), variant: k % 2,
        slot: k, state: 'walk', throwCd: this.r.range(2, 4), windup: 0, down: 0, stab: 0,
        tx: 0, ty: 0, mark: 0, markType: '', speedJit: this.r.range(0.95, 1.05),
      });
    }
  }

  addDog() {
    const b = this.band;
    this.dogs.push({
      id: UID++, x: b.x + this.r.range(-20, 20), y: b.y + this.r.range(-20, 20), vx: 0, vy: 0, face: 1, anim: 0,
      idx: b.idx, state: 'track', bite: 0, dead: false, stun: 0, searchT: 0, barkT: 0,
    });
  }

  // n stacks of a perk: base * mult^n
  perk(id, mult, base = 1) { return base * Math.pow(mult, this.perks[id] || 0); }
  has(id) { return (this.perks[id] || 0) > 0; }

  offerPerks(n = 3) {
    const pool = PERKS.filter((k) => (this.perks[k.id] || 0) < k.max);
    const out = [];
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(this.r() * pool.length), 1)[0]);
    return out;
  }
  takePerk(id) {
    this.perks[id] = (this.perks[id] || 0) + 1;
    this.perkChoices = Math.max(0, this.perkChoices - 1);
    this.emit('perk', { id, name: PERK_BY_ID[id].name });
  }
  grantPerkChoice(source = null) {
    this.lastPerkSource = source;
    this.perkChoices++;
    this.emit('perkchoice');
  }

  emit(type, data = {}) {
    this.events.push({ type, ...data });
  }

  addScore(n, label, x, y, color, boost = 0) {
    n = Math.round(n * this.mult);
    this.score += n;
    if (label) this.emit('pop', { text: `+${n} ${label}`, x, y, color });
    if (boost) this.bump(boost);
  }

  // The wild multiplier: danger engaged and survived makes every point worth more.
  bump(v) {
    const before = Math.floor(this.mult * 2);
    this.mult = Math.min(4, this.mult + v);
    this.multHold = 12;
    if (Math.floor(this.mult * 2) > before) this.emit('mult', { v: this.mult });
  }

  // ---------------- time & weather ----------------
  get sun() {
    // 0 at night, 1 at noon
    const c = this.clock;
    if (c < 0.03 || c > 0.68) return 0;
    return Math.max(0, Math.sin(((c - 0.03) / 0.65) * Math.PI));
  }
  get isNight() { return this.clock > 0.68 || this.clock < 0.02; }
  get phaseName() {
    const c = this.clock;
    if (c < 0.07) return 'Dawn';
    if (c < 0.25) return 'Morning';
    if (c < 0.45) return 'Midday';
    if (c < 0.62) return 'Afternoon';
    if (c < 0.7) return 'Dusk';
    return 'Night';
  }

  updateClock(dt) {
    const before = this.clock;
    this.clock += dt / DAY_LEN;
    if (before < 0.64 && this.clock >= 0.64) this.emit('dusk');
    if (this.clock >= 1) {
      this.clock -= 1;
      this.day++;
      this.addScore(400 + this.day * 100, `DAY ${this.day}`, this.player.x, this.player.y - 30, '#ffe08a');
      this.emit('dawn', { day: this.day });
      this.grantPerkChoice();
      // escalation
      if ([3, 5, 7, 9].includes(this.day)) this.addHunters(1);
      const dogsWanted = this.day >= 2 ? Math.min(4, Math.floor(this.day / 2)) : 0;
      while (this.dogs.filter((d) => !d.dead).length < dogsWanted) this.addDog();
      this.weather.next = this.r.range(15, 60);
    }
    // weather
    const w = this.weather;
    w.next -= dt;
    if (w.next <= 0 && w.target === 0 && !this.isNight && this.r() < 0.5) {
      w.target = 1;
      w.until = this.r.range(22, 38);
      this.emit('rain');
    }
    if (w.next <= 0 && w.target === 0) w.next = this.r.range(30, 70);
    if (w.target === 1) {
      w.until -= dt;
      if (w.until <= 0) { w.target = 0; w.next = this.r.range(60, 130); }
      if (this.r() < dt * 0.08) { w.flash = 1; this.emit('thunder'); }
    }
    w.rain = lerp(w.rain, w.target, dt * 0.35);
    w.flash = Math.max(0, w.flash - dt * 3);
  }

  // ---------------- player ----------------
  updatePlayer(dt, inp) {
    const p = this.player;
    const W = this.world;
    const g = (p.ground = W.typeAt(p.x, p.y));
    const gi = GROUND_INFO[g];
    const water = g === G.SHALLOW || g === G.DEEP;
    p.inShade = !!W.shadeAt(p.x, p.y);
    const sun = this.sun;
    const rain = this.weather.rain;

    // input
    let ix = inp.x, iy = inp.y;
    const mag = Math.min(1, Math.hypot(ix, iy));
    if (mag > 0.01) { const l = Math.hypot(ix, iy); ix /= l; iy /= l; }
    const moving = mag > 0.15 && p.pounce <= 0;
    const wantSprint = inp.sprint && moving && !p.overheated && !p.exhausted && p.stamina > 1;

    // pounce
    p.pounceCd -= dt;
    const pounceCost = 22 * this.perk('pounce', 0.8);
    if (inp.pounce && p.pounce <= 0 && p.pounceCd <= 0 && p.stamina >= pounceCost * 0.8 && !p.overheated) {
      let dx = moving ? ix : p.face, dy = moving ? iy : 0;
      const l = Math.hypot(dx, dy) || 1;
      p.pdx = dx / l; p.pdy = dy / l;
      p.pounce = T.pounceTime * this.perk('pounce', 1.25);
      p.pounceCd = 0.55;
      p.stamina -= pounceCost;
      p.heat += 2.5;
      p.iframes = Math.max(p.iframes, T.pounceTime + 0.08);
      this.emit('pounce', { x: p.x, y: p.y });
    }

    let speed = 0;
    if (p.pounce > 0) {
      p.pounce -= dt;
      p.vx = p.pdx * T.pounceSpeed;
      p.vy = p.pdy * T.pounceSpeed;
      p.state = 'pounce';
      if (p.pdx) p.face = Math.sign(p.pdx);
      this.pounceHits();
    } else {
      speed = wantSprint ? T.sprint : T.trot * this.perk('stride', 1.07) * Math.max(0.35, mag);
      if (this.isNight && this.has('night')) speed *= 1.12;
      if (p.overheated) speed = T.trot * 0.5;
      speed *= water && this.has('river') ? Math.min(1, gi.speed * 1.4) : gi.speed;
      if (p.health < 30) speed *= 0.88;
      const tx = moving ? ix * speed : 0, ty = moving ? iy * speed : 0;
      const acc = moving ? 9 : 12;
      p.vx = lerp(p.vx, tx, Math.min(1, dt * acc));
      p.vy = lerp(p.vy, ty, Math.min(1, dt * acc));
      if (Math.abs(p.vx) > 4) p.face = Math.sign(p.vx);
    }
    const sp = Math.hypot(p.vx, p.vy);
    const ox = p.x, oy = p.y;
    const res = W.move(p, p.vx * dt, p.vy * dt);
    if (res === 'drop' && !(p.hop > 0)) {
      p.hop = 0.34;
      p.dropMark = true;
      this.emit('drop', { x: p.x, y: p.y });
    }
    if (p.hop > 0) p.hop -= dt;
    W.collide(p, 4);
    const moved = Math.hypot(p.x - ox, p.y - oy);
    p.odom += moved;
    this.meters += moved / 10;
    p.sprinting = wantSprint && sp > T.trot * 1.2;

    // tracks
    if (p.odom - p.lastPrint > 9) {
      p.lastPrint = p.odom;
      let s = gi.prints * this.perk('softpaws', 0.75);
      if (rain > 0.3) s *= 1 - rain * 0.75;
      if (p.dropMark) { s = 0; p.dropMark = false; }
      if (p.landmark && p.landmark.type === 'arch') s = 0;
      this.trail.push({ x: p.x, y: p.y, s, water, id: UID++, face: p.face, t: this.time, g });
      if (this.trail.length > 4000) this.trail.splice(0, 1000), this.band.idx = Math.max(0, this.band.idx - 1000), this.dogs.forEach((d) => (d.idx = Math.max(0, d.idx - 1000)));
    }

    // footsteps
    p.stepT -= dt * sp / 26;
    if (p.stepT <= 0 && sp > 20) {
      p.stepT = 1;
      this.emit('step', { x: p.x, y: p.y, water, sprint: p.sprinting, g });
    }

    // stillness → drink / eat / lie down
    if (sp < 6 && p.pounce <= 0 && !moving) p.still += dt; else p.still = 0;
    p.drinking = false;
    p.eating = null;
    let nearWater = water;
    for (let k = 0; k < 8 && !nearWater; k++) nearWater = W.isWater(W.typeAt(p.x + Math.cos(k * 0.785) * 12, p.y + Math.sin(k * 0.785) * 9));
    const lm = W.landmarkNear(p.x, p.y, 90);
    p.landmark = lm && dist(lm.x, lm.y, p.x, p.y) < 60 ? lm : null;
    if (lm && lm.def.pool && Math.hypot((p.x - lm.x) / (lm.def.pool.rx + 10), (p.y - lm.y - lm.def.pool.dy) / (lm.def.pool.ry + 8)) < 1) nearWater = true;
    if (p.still > 0.25) {
      if (nearWater && p.water < 99.5) p.drinking = true;
      else {
        const c = this.carcasses.find((c) => c.meat > 0 && dist(c.x, c.y, p.x, p.y) < 16);
        if (c && p.food < 99.5) p.eating = c;
      }
    }
    p.lying = p.still > 1.1 && !p.drinking && !p.eating && !water;

    // ---- vitals ----
    // heat: movement makes it, sun feeds it, shade/water/night bleed it
    let dh = 0;
    if (p.pounce > 0) dh += 8;
    else if (p.sprinting) dh += 7.0 + sun * 2.2;
    else if (sp > 10) dh += (1.1 + sun * 1.5) * this.perk('marathon', 0.75);
    else dh -= 2.2 - sun * 1.1;
    dh += gi.heat * (water ? 1 : sun);
    if (p.inShade) dh -= sp > 10 ? 1.5 : 5.5;
    if (p.lying) dh -= 2.5;
    if (p.lying && p.landmark && p.landmark.type === 'whistle') dh -= 8;
    if (this.isNight) dh -= 2.5;
    dh -= rain * 3.2;
    dh += this.weatherHeat ? this.weatherHeat(p, sun) : 0;
    if (dh > 0) dh *= this.perk('coat', 0.85);
    p.heat = clamp(p.heat + dh * dt, 0, 100);
    if (!p.overheated && p.heat >= 100) {
      p.overheated = true;
      this.emit('overheat', { x: p.x, y: p.y });
    }
    if (p.overheated && p.heat < 55) p.overheated = false;

    // stamina
    const maxSt = p.food < 20 ? 55 : 100;
    if (p.sprinting) p.stamina -= 21 * this.perk('lungs', 0.85) * dt;
    else p.stamina += (p.lying ? 26 : sp < 6 ? 20 : 13) * (1 + 0.2 * (this.perks.lungs || 0)) * (this.isNight && this.has('night') ? 1.5 : 1) * dt;
    p.stamina = clamp(p.stamina, 0, maxSt);
    if (p.stamina <= 1 && this.has('wind') && this.windUsedDay !== this.day) {
      this.windUsedDay = this.day;
      p.stamina = maxSt;
      p.heat = Math.max(0, p.heat - 30);
      this.emit('secondwind', { x: p.x, y: p.y });
    }
    if (p.stamina <= 1) p.exhausted = true;
    if (p.exhausted && p.stamina > 30) p.exhausted = false;

    // water & food
    p.water -= (0.62 + p.heat * 0.0085 + (p.sprinting ? 0.5 : 0)) * this.perk('camel', 0.82) * (this.weatherThirst || 1) * dt;
    if (p.drinking) {
      p.water += 24 * dt;
      p.heat -= 4 * dt;
      p.drinkSfx = (p.drinkSfx || 0) - dt;
      if (p.drinkSfx <= 0) { p.drinkSfx = 0.55; this.emit('drink', { x: p.x, y: p.y }); }
    }
    p.food -= 0.36 * dt;
    if (p.eating) {
      const take = Math.min(p.eating.meat, 18 * this.perk('scavenger', 1.4) * dt);
      p.eating.meat -= take;
      p.food += take;
      p.eatSfx = (p.eatSfx || 0) - dt;
      if (p.eatSfx <= 0) { p.eatSfx = 0.5; this.emit('eat', { x: p.x, y: p.y }); }
    }
    p.water = clamp(p.water, 0, 100);
    p.food = clamp(p.food, 0, 100);

    // health
    let dhp = 0;
    if (p.water <= 0) dhp -= 2.2;
    if (p.food <= 0) dhp -= 1.3;
    if (p.overheated) dhp -= 1.2;
    if (dhp === 0) {
      if (p.lying && p.landmark && p.landmark.type === 'baobab') dhp += 7;
      else if (p.lying && p.water > 15 && p.food > 15) dhp += 2.2;
      else if (p.still > 0.5 && p.water > 15 && p.food > 15) dhp += 0.8;
      else if (p.water > 30 && p.food > 30) dhp += 0.15;
    }
    p.health = clamp(p.health + dhp * dt, 0, 100);

    p.iframes -= dt;
    p.hurt = Math.max(0, p.hurt - dt);

    // animation state
    if (p.pounce > 0) p.state = 'pounce';
    else if (p.drinking) p.state = 'drink';
    else if (p.eating) p.state = 'drink';
    else if (p.lying) p.state = 'lie';
    else if (sp > T.trot * 1.15) p.state = 'run';
    else if (sp > 8) p.state = 'walk';
    else p.state = 'idle';
    const animRate = p.state === 'run' ? sp / 95 : p.state === 'walk' ? sp / 40 : p.state === 'lie' ? 0.25 : 0.6;
    p.anim = (p.anim + dt * animRate) % 1;

    if (p.landmark && !this.found.has(p.landmark.key) && !this.over) this.discover(p.landmark);
    if (p.health <= 0 && !this.over) this.die();
  }

  discover(lm) {
    const p = this.player;
    const S = SECRETS[lm.type];
    this.found.add(lm.key);
    this.stats.secrets = (this.stats.secrets || 0) + 1;
    this.addScore(300, 'SECRET', lm.x, lm.y - 50, '#ffe08a', 0.3);
    switch (S.reward) {
      case 'perk': this.grantPerkChoice({ title: 'A secret instinct', kicker: S.name }); break;
      case 'map': this.reveals.push({ x: lm.x, y: lm.y, r: 1600 }); this.addScore(200, 'THE LAND REVEALED', lm.x, lm.y - 60, '#7fd6e0'); break;
      case 'water': p.water = 100; p.heat = 0; break;
      case 'heal': p.health = 100; break;
      case 'intel': this.intelDay = this.day; break;
      case 'cool': p.heat = 0; break;
      case 'hide':
        if ((this.perks.hide || 0) < 3) { this.perks.hide = (this.perks.hide || 0) + 1; this.emit('perk', { id: 'hide', name: PERK_BY_ID.hide.name }); }
        else this.grantPerkChoice({ title: 'A secret instinct', kicker: S.name });
        break;
    }
    this.emit('secret', { secret: lm.type, key: lm.key, x: lm.x, y: lm.y });
  }

  pounceHits() {
    const p = this.player;
    for (const q of this.prey) {
      if (q.dead) continue;
      const S = SPECIES[q.kind];
      if ((q.z || 0) < 6 && dist(q.x, q.y, p.x, p.y) < S.hit + 3 * (this.perks.pounce || 0)) {
        q.dead = true;
        this.stats.prey++;
        if (q.kind === 'gazelle') this.stats.gazelles = (this.stats.gazelles || 0) + 1;
        const meat = S.meat * this.perk('scavenger', 1.4);
        this.carcasses.push({ id: UID++, x: q.x, y: q.y, meat, max: meat, kind: q.kind, small: !!S.small, face: q.face, t: 0 });
        this.addScore(S.score, S.label, q.x, q.y - 16, q.kind === 'golden' ? '#fff09a' : '#ffe08a', S.boost);
        if (q.kind === 'golden') this.stats.golden = (this.stats.golden || 0) + 1;
        this.stats.kinds = this.stats.kinds || {};
        this.stats.kinds[q.kind] = (this.stats.kinds[q.kind] || 0) + 1;
        this.emit('kill', { x: q.x, y: q.y });
        p.pounce = Math.min(p.pounce, 0.04);
        p.vx *= 0.2; p.vy *= 0.2;
      }
    }
    for (const h of [...this.hunters, ...this.runners]) {
      if (h.down > 0) continue;
      if (dist(h.x, h.y - 4, p.x, p.y) < 14) {
        h.down = 4.5 * this.perk('apex', 2);
        h.windup = 0;
        if (this.has('apex')) p.health = Math.min(100, p.health + 8 * this.perks.apex);
        h.vx = p.pdx * 120; h.vy = p.pdy * 120;
        this.stats.knockdowns++;
        this.addScore(200, 'TAKEDOWN', h.x, h.y - 40, '#ff9a6a', 0.5);
        this.emit('knockdown', { x: h.x, y: h.y });
        p.pounce = 0;
        p.vx = -p.pdx * 60; p.vy = -p.pdy * 60;
      }
    }
    for (const h of this.hyenas) {
      if (h.state === 'flee') continue;
      if (dist(h.x, h.y, p.x, p.y) < 15) {
        for (const o of this.hyenas) if (o.target === h.target) o.state = 'flee';
        this.addScore(80, 'HYENAS SCATTER', h.x, h.y - 20, '#ff9a6a', 0.2);
        this.emit('dogdown', { x: h.x, y: h.y });
      }
    }
    for (const d of this.dogs) {
      if (d.dead) continue;
      if (dist(d.x, d.y, p.x, p.y) < 14) {
        d.dead = true;
        d.deadT = 0;
        this.stats.dogs++;
        this.addScore(150, 'DOG DRIVEN OFF', d.x, d.y - 20, '#ff9a6a', 0.35);
        this.emit('dogdown', { x: d.x, y: d.y });
      }
    }
  }

  hurtPlayer(dmg, fromX, fromY, kind) {
    const p = this.player;
    if (p.iframes > 0 || this.over) return false;
    dmg *= this.perk('hide', 0.85);
    p.health -= dmg;
    p.hurt = 0.4;
    if (this.mult > 1) { this.mult = 1 + (this.mult - 1) * 0.5; this.emit('multloss'); }
    p.iframes = 0.7;
    const a = Math.atan2(p.y - fromY, p.x - fromX);
    p.vx += Math.cos(a) * 140;
    p.vy += Math.sin(a) * 140;
    p.still = 0;
    this.emit('hurt', { x: p.x, y: p.y, dmg, kind });
    if (p.health <= 0) this.die(kind);
    return true;
  }

  die(kind = 'exhaustion') {
    if (this.over) return;
    const p = this.player;
    p.health = 0;
    this.over = true;
    this.deathTime = this.time;
    this.cause = kind === 'spear' ? 'A spear found you.' : kind === 'stab' ? 'They closed the distance.' :
      kind === 'dog' ? 'The dogs pulled you down.' : kind === 'croc' ? 'The river had teeth.' :
      kind === 'hyena' ? 'The hyenas would not share.' : kind === 'stampede' ? 'Lost beneath the herd.' :
      kind === 'lion' ? 'The pride would not share the plain.' : kind === 'warthog' ? 'The warthog had tusks.' : kind === 'zebra' ? 'A zebra kicked like thunder.' : p.water <= 0 ? 'Thirst took you.' :
      p.food <= 0 ? 'Hunger took you.' : p.overheated ? 'Your heart gave out in the heat.' : 'The chase ended.';
    this.emit('death', { x: p.x, y: p.y });
  }

  // ---------------- hunters ----------------
  sightRange() {
    const p = this.player;
    let r = (this.isNight ? 125 : 240) * this.perk('ghost', 0.88) * (this.weatherSight || 1);
    r *= 1 - this.weather.rain * 0.4;
    if (p.ground === G.TALL) r *= p.lying || p.still > 0.3 ? 0.35 : 0.62;
    else if (p.lying && p.inShade) r *= 0.75;
    if (p.lying && p.landmark && p.landmark.type === 'whistle') r = 0;
    return r;
  }

  updateBand(dt) {
    const b = this.band, p = this.player;
    const day = this.day;
    const night = this.isNight;
    let walk = Math.min(92, T.hunterWalk + T.hunterWalkPerDay * (day - 1)) * (night ? 0.85 : 1);
    const run = Math.min(118, T.hunterRun + T.hunterRunPerDay * (day - 1)) * (night ? 0.88 : 1);
    const lead = this.hunters.filter((h) => h.down <= 0);
    const d = dist(b.x, b.y, p.x, p.y);
    // they read the land faster when far behind: persistence
    if (d > 420) walk *= 1 + Math.min(0.85, (d - 420) / 800);
    if (b.rush > 0) { b.rush -= dt; walk *= 1.35; }
    if (this.lineP > 14) walk *= 1.25; // a straight trail reads itself

    // ---- sighting ----
    let closest = 1e9;
    for (const h of lead) closest = Math.min(closest, dist(h.x, h.y, p.x, p.y));
    const sight = this.sightRange();
    const seen = closest < sight && !this.over;
    if (seen) {
      b.seen += dt;
      b.lostT = 0;
      b.lastSeenX = p.x; b.lastSeenY = p.y;
      if (b.mode !== 'chase' && b.seen > (b.mode === 'search' ? 0.1 : 0.35)) {
        if (b.mode === 'search') this.endSearch();
        b.mode = 'chase';
        this.emit('sighted', { x: p.x, y: p.y, first: !b.sightedOnce });
        b.sightedOnce = true;
        for (const h of lead) { h.mark = 1.6; h.markType = '!'; }
      }
    } else {
      b.seen = 0;
    }

    if (b.mode === 'chase') {
      if (!seen) b.lostT += dt;
      // move band anchor with the pack
      if (lead.length) {
        b.x = lead.reduce((s, h) => s + h.x, 0) / lead.length;
        b.y = lead.reduce((s, h) => s + h.y, 0) / lead.length;
      }
      if (b.lostT > 2.6) {
        // lost you: pick up the freshest trail point near where they are
        b.mode = 'track';
        let best = this.trail.length - 1, bd = 1e9;
        for (let i = Math.max(0, this.trail.length - 500); i < this.trail.length; i++) {
          const tp = this.trail[i];
          const dd = dist(tp.x, tp.y, b.x, b.y);
          if (dd < bd && tp.s > 0.15) { bd = dd; best = i; }
        }
        b.idx = best;
        for (const h of lead) { h.mark = 1.4; h.markType = '?'; }
        this.stats.escapes = (this.stats.escapes || 0) + 1;
        this.addScore(100, 'ESCAPED', p.x, p.y - 30, '#ffe08a', 0.3);
        this.emit('lost', { x: b.x, y: b.y });
      }
    }

    if (b.mode === 'track') {
      const tr = this.trail;
      // advance along trail
      let steps = 0;
      while (b.idx < tr.length - 1 && steps < 20) {
        const tp = tr[b.idx];
        if (dist(tp.x, tp.y, b.x, b.y) < 10) { b.idx++; steps++; } else break;
      }
      const tp = tr[Math.min(b.idx, tr.length - 1)];
      if (tp.s < 0.15 && b.idx < tr.length - 1) {
        // trail goes cold here (rock/water/rain)
        b.mode = 'search';
        b.searchX = b.x; b.searchY = b.y;
        b.searchR = 12;
        b.searchT = 0;
        for (const h of lead) { h.mark = 1.6; h.markType = '?'; }
        this.emit('trailcold', { x: b.x, y: b.y });
      } else {
        if (b.climb > 0) {
          b.climb -= dt; // finding a way down the ledge you leapt from
        } else {
          const a = Math.atan2(tp.y - b.y, tp.x - b.x);
          const gi = GROUND_INFO[this.world.typeAt(b.x, b.y)];
          const sp = walk * Math.max(0.6, gi.speed);
          const dd = dist(tp.x, tp.y, b.x, b.y);
          const mv = Math.min(dd, sp * dt);
          const L0 = this.world.levelAt(b.x, b.y);
          const nx = b.x + Math.cos(a) * mv, ny = b.y + Math.sin(a) * mv;
          const L1 = this.world.levelAt(nx, ny);
          if (L1 < L0 && !this.world.rampAt(nx, ny) && !this.world.rampAt(b.x, b.y)) {
            b.climb = Math.max(2, 4.5 - this.day * 0.3);
            this.emit('bandclimb', { x: b.x, y: b.y });
          }
          b.x = nx; b.y = ny;
        }
      }
    } else if (b.mode === 'search') {
      b.searchT += dt;
      b.searchR += dt * (28 + this.day * 4);
      // find the next readable print ahead
      const tr = this.trail;
      let found = -1;
      for (let i = b.idx; i < tr.length && i < b.idx + 900; i++) {
        const tp = tr[i];
        if (tp.s >= 0.15 && dist(tp.x, tp.y, b.searchX, b.searchY) < b.searchR) { found = i; }
      }
      if (found >= 0 && b.searchT > 1.2) {
        this.endSearch();
        b.mode = 'track';
        b.idx = found;
        for (const h of lead) { h.mark = 1.2; h.markType = '!'; }
        this.emit('found', { x: b.x, y: b.y });
      }
      // fail-safe: after a long search they cut toward the last place they knew you were
      if (b.searchT > 16) {
        this.endSearch();
        b.mode = 'track';
        b.idx = Math.max(b.idx, tr.length - 60);
      }
      // wander the search anchor slowly toward the trail direction (they guess well)
      const ahead = tr[Math.min(tr.length - 1, b.idx + 8)];
      const a = Math.atan2(ahead.y - b.y, ahead.x - b.x);
      b.x += Math.cos(a) * walk * 0.35 * dt;
      b.y += Math.sin(a) * walk * 0.35 * dt;
    }

    // ---- individual hunters ----
    const n = this.hunters.length;
    for (const h of this.hunters) {
      h.mark = Math.max(0, h.mark - dt);
      if (h.down > 0) {
        h.down -= dt;
        this.world.move(h, h.vx * dt, h.vy * dt, { drop: false });
        h.vx *= 0.9; h.vy *= 0.9;
        h.state = 'down';
        continue;
      }
      let tx, ty, sp;
      if (b.mode === 'chase') {
        // flank: spread around the player, not a conga line
        const flank = ((h.slot / Math.max(1, n - 1)) - 0.5) * 1.3;
        const base = Math.atan2(p.y - h.y, p.x - h.x);
        const dd = dist(h.x, h.y, p.x, p.y);
        const off = dd > 70 ? flank * 36 : 0;
        tx = p.x + Math.cos(base + Math.PI / 2) * off + p.vx * 0.25;
        ty = p.y + Math.sin(base + Math.PI / 2) * off + p.vy * 0.25;
        sp = run * h.speedJit;
        h.state = 'run';
      } else {
        const ang = (h.slot / n) * TAU + this.time * 0.1;
        const spread = b.mode === 'search' ? Math.min(b.searchR, 90) * 0.8 : 14 + h.slot * 5;
        tx = b.x + Math.cos(ang) * spread - (b.mode === 'track' ? 0 : 0);
        ty = b.y + Math.sin(ang) * spread * 0.7;
        const dd = dist(h.x, h.y, tx, ty);
        sp = Math.max(walk * 0.6, Math.min(run * 1.1, dd * 1.6)) * h.speedJit;
        h.state = b.mode === 'search' && dd < 10 ? 'search' : dd > 30 ? 'run' : 'walk';
        if (b.mode === 'track' && dd < 30) h.state = 'walk';
      }
      if (h.windup > 0) {
        sp *= 0.1;
        h.state = 'windup';
      }
      const gi = GROUND_INFO[this.world.typeAt(h.x, h.y)];
      sp *= Math.max(0.6, gi.speed);
      const a = Math.atan2(ty - h.y, tx - h.x);
      const dd = dist(h.x, h.y, tx, ty);
      const mv = Math.min(dd, sp * dt);
      h.vx = lerp(h.vx, (Math.cos(a) * mv) / dt, Math.min(1, dt * 8));
      h.vy = lerp(h.vy, (Math.sin(a) * mv) / dt, Math.min(1, dt * 8));
      const bx0 = h.x, by0 = h.y;
      this.world.move(h, h.vx * dt, h.vy * dt);
      this.world.collide(h, 4);
      const want = Math.hypot(h.vx, h.vy) * dt;
      if (want > 0.4 && Math.hypot(h.x - bx0, h.y - by0) < want * 0.3) h.stuck = (h.stuck || 0) + dt;
      else h.stuck = Math.max(0, (h.stuck || 0) - dt);
      // stranded behind a cliff while out of sight: take the long way round (skip ahead)
      if (h.stuck > 2.5 && dist(h.x, h.y, p.x, p.y) > 300) {
        h.x = b.x + (Math.random() - 0.5) * 20; h.y = b.y + (Math.random() - 0.5) * 20; h.stuck = 0;
      }
      if (Math.abs(h.vx) > 3) h.face = Math.sign(h.vx);
      h.anim = (h.anim + dt * (h.state === 'run' ? 1.9 : 1.1)) % 1;

      this.combat(h, dt, b.mode === 'chase');
    }
  }

  // Spear throwing and close-quarters stabs; shared by the band and the scout.
  combat(h, dt, engaged) {
    const p = this.player;
    h.throwCd -= dt;
    if (h.stab > 0) h.stab -= dt;
    const pd = dist(h.x, h.y, p.x, p.y);
    const gateOk = h.scout || (this.throwGate || 0) <= 0;
    if (engaged && gateOk && h.windup <= 0 && h.throwCd <= 0 && pd < 185 && pd > 45 && !this.over) {
      // one spear in the air at a time from the band: readable, dodgeable
      if (!h.scout) this.throwGate = Math.max(0.9, 1.6 - this.day * 0.1);
      h.windup = Math.max(0.5, 0.8 - this.day * 0.03) + (this.has('sense') ? 0.18 : 0);
      h.face = Math.sign(p.x - h.x) || 1;
      this.emit('windup', { x: h.x, y: h.y });
    }
    if (h.windup > 0) {
      h.windup -= dt;
      // aim tracks the player (with lead) during windup, then locks
      const flight = pd / T.spearSpeed;
      const lead = 0.55 + Math.min(0.3, this.day * 0.04);
      h.tx = p.x + p.vx * flight * lead;
      h.ty = p.y + p.vy * flight * lead;
      h.face = Math.sign(p.x - h.x) || h.face;
      if (h.windup <= 0) {
        this.throwSpear(h);
        h.throwCd = this.r.range(2.8, 4.6) - Math.min(1.2, this.day * 0.12);
        h.state = 'throw';
        h.throwT = 0.35;
      }
    }
    if (h.throwT > 0) { h.throwT -= dt; h.state = 'throw'; }
    if (pd < 13 && h.stab <= 0 && h.windup <= 0 && !this.over) {
      h.stab = 1.3;
      if (this.hurtPlayer(22, h.x, h.y, 'stab')) this.emit('stab', { x: p.x, y: p.y });
    }
  }

  // ---------------- the land's other dangers ----------------
  updateHazards(dt) {
    const p = this.player, W = this.world;
    // --- crocodiles lurk in deep water: cooling off there is a gamble
    if (p.ground === G.DEEP) this.deepT += dt; else this.deepT = Math.max(0, this.deepT - dt * 2);
    if (!this.croc && this.deepT > 1.6 && this.r() < dt * (this.day === 1 ? 0.3 : 0.5) * (this.has('river') ? 0.5 : 1) && !this.over) {
      for (let k = 0; k < 16; k++) {
        const a = this.r() * TAU, r = this.r.range(60, 90);
        const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
        if (W.typeAt(x, y) === G.DEEP) { this.croc = { x, y, state: 'stalk', t: 0, face: 1, id: UID++ }; this.emit('croc', { x, y }); break; }
      }
    }
    const c = this.croc;
    if (c) {
      c.t += dt;
      const pd = dist(c.x, c.y, p.x, p.y);
      if (c.state === 'stalk') {
        const a = Math.atan2(p.y - c.y, p.x - c.x);
        const nx = c.x + Math.cos(a) * 62 * dt, ny = c.y + Math.sin(a) * 62 * dt;
        if (W.isWater(W.typeAt(nx, ny))) { c.x = nx; c.y = ny; }
        c.face = Math.sign(Math.cos(a)) || 1;
        if (pd < 22) { c.state = 'snap'; c.t = 0; this.emit('crocsnap', { x: c.x, y: c.y }); }
        if (c.t > 6 || (pd > 140)) { c.state = 'sink'; c.t = 0; }
      } else if (c.state === 'snap') {
        if (c.t > 0.32 && !c.bit) {
          c.bit = true;
          if (dist(c.x + c.face * 8, c.y, p.x, p.y) < 18) this.hurtPlayer(20, c.x, c.y, 'croc');
          else { this.stats.dodges++; this.addScore(60, 'JAWS MISSED', p.x, p.y - 28, '#ffffff', 0.3); this.emit('dodge', { x: p.x, y: p.y, close: true }); }
        }
        if (c.t > 0.8) { c.state = 'sink'; c.t = 0; }
      } else if (c.t > 1) this.croc = null;
    }

    // --- hyenas smell a kill left too long
    for (const k of this.carcasses) {
      if (k.meat > 0 && k.t > 14 && !k.hyenas && !this.over) {
        k.hyenas = true;
        for (let i = 0; i < 2; i++) {
          const a = this.r() * TAU;
          this.hyenas.push({ id: UID++, x: k.x + Math.cos(a) * 230, y: k.y + Math.sin(a) * 230, vx: 0, vy: 0, face: 1, anim: this.r(), state: 'come', target: k, bite: 0, flee: 0 });
        }
        this.emit('hyenas', { x: k.x, y: k.y });
      }
    }
    for (const h of this.hyenas) {
      h.bite -= dt;
      const k = h.target;
      const pd = dist(h.x, h.y, p.x, p.y);
      let tx = k.x + (h.id & 1 ? 12 : -12), ty = k.y + 2, sp = 95;
      if (h.state === 'flee' || k.meat <= 0) {
        h.state = 'flee';
        h.flee += dt;
        const a = Math.atan2(h.y - p.y, h.x - p.x);
        tx = h.x + Math.cos(a) * 60; ty = h.y + Math.sin(a) * 60; sp = 120;
        if (h.flee > 5) h.gone = true;
      } else if (dist(h.x, h.y, k.x, k.y) < 18) {
        h.state = 'eat';
        k.meat = Math.max(0, k.meat - 5 * dt);
        sp = 0;
        // guard the kill: bite if you crowd them
        if (pd < 34 && !this.over) {
          tx = p.x; ty = p.y; sp = 110; h.state = 'fight';
          if (pd < 13 && h.bite <= 0) { h.bite = 1.3; if (this.hurtPlayer(7, h.x, h.y, 'hyena')) this.emit('snarl', { x: h.x, y: h.y }); }
        }
      }
      const a = Math.atan2(ty - h.y, tx - h.x);
      const mv = Math.min(dist(h.x, h.y, tx, ty), sp * dt);
      h.vx = (Math.cos(a) * mv) / dt; h.vy = (Math.sin(a) * mv) / dt;
      W.move(h, h.vx * dt, h.vy * dt);
      W.collide(h, 3);
      if (Math.abs(h.vx) > 3) h.face = Math.sign(h.vx);
      else h.face = Math.sign(k.x - h.x) || h.face;
      h.anim = (h.anim + dt * (Math.hypot(h.vx, h.vy) > 60 ? 2.4 : 1.2)) % 1;
    }
    this.hyenas = this.hyenas.filter((h) => !h.gone);

    // --- stampedes: a river of hooves that tramples your trail flat
    this.stampedeT -= dt;
    if (this.stampedeT <= 0 && this.day >= 2 && !this.gnus.length && !this.over) {
      this.stampedeT = this.r.range(110, 170);
      const a = this.r() * TAU; // travel direction
      const perp = a + Math.PI / 2;
      const off = this.r.range(-30, 30);
      const sx = p.x - Math.cos(a) * 360 + Math.cos(perp) * off, sy = p.y - Math.sin(a) * 360 + Math.sin(perp) * off;
      const n = this.r.int(11, 16);
      for (let i = 0; i < n; i++) {
        const lat = this.r.range(-38, 38), back = this.r.range(0, 150);
        this.gnus.push({ id: UID++, x: sx + Math.cos(perp) * lat - Math.cos(a) * back, y: sy + Math.sin(perp) * lat - Math.sin(a) * back,
          a, sp: this.r.range(150, 175), anim: this.r(), face: Math.sign(Math.cos(a)) || 1, life: 0, hitCd: 0 });
      }
      this.stampedeWarn = 2.5;
      this.emit('stampede', { x: sx, y: sy, a });
    }
    if (this.stampedeWarn > 0) this.stampedeWarn -= dt;
    for (const g of this.gnus) {
      g.life += dt;
      if (this.stampedeWarn > 1.2) continue; // the rumble comes before the herd
      if (W.move(g, Math.cos(g.a) * g.sp * dt, Math.sin(g.a) * g.sp * dt) === 'blocked') g.a += 0.8 * dt * 3;
      g.anim = (g.anim + dt * 2.3) % 1;
      g.hitCd -= dt;
      // trample the trail
      for (let i = Math.max(0, this.trail.length - 700); i < this.trail.length; i++) {
        const tp = this.trail[i];
        if (tp.s > 0 && Math.abs(tp.x - g.x) < 14 && Math.abs(tp.y - g.y) < 12) tp.s = 0;
      }
      if (g.hitCd <= 0 && dist(g.x, g.y, p.x, p.y) < 13 && p.pounce <= 0) {
        g.hitCd = 1;
        this.hurtPlayer(12, g.x - Math.cos(g.a) * 10, g.y - Math.sin(g.a) * 10, 'stampede');
      }
      for (const h of this.hunters) {
        if (h.down <= 0 && dist(g.x, g.y, h.x, h.y) < 12) {
          h.down = 5; h.vx = Math.cos(g.a) * 90; h.vy = Math.sin(g.a) * 90;
          this.stats.trampled = (this.stats.trampled || 0) + 1;
          this.addScore(150, 'TRAMPLED', h.x, h.y - 40, '#ff9a6a', 0.4);
          this.emit('knockdown', { x: h.x, y: h.y });
        }
      }
      if (g.life > 9) g.gone = true;
    }
    this.gnus = this.gnus.filter((g) => !g.gone);
  }

  // ---------------- the scout ----------------
  // Every minute or so one young hunter is sent running wide to cut you off.
  // He's alone: dodge him, outrun him, or knock him flat.
  makeRunner(x, y, life = 26, maxThrows = 3) {
    return {
      id: UID++, x, y, vx: 0, vy: 0, face: 1, anim: 0, variant: (UID + this.day) % 2,
      slot: 0, state: 'run', throwCd: 1.2 + this.r() * 0.8, windup: 0, down: 0, stab: 0, tx: 0, ty: 0, mark: 0, markType: '',
      life, seen: false, leaving: false, scout: true, maxThrows,
    };
  }

  // A spot on open ground around the player, in a fan around `heading`.
  groundPoint(heading, spread, r0, r1) {
    const p = this.player;
    for (let k = 0; k < 16; k++) {
      const a = heading + this.r.range(-spread, spread);
      const r = this.r.range(r0, r1);
      const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
      const g = this.world.ground(x, y);
      if (!this.world.isWater(g) && g !== G.CLIFF) return [x, y];
    }
    return null;
  }

  heading() {
    const p = this.player;
    if (this.hist && this.hist.length > 6) {
      const a = this.hist[this.hist.length - 6];
      if (dist(a[0], a[1], p.x, p.y) > 30) return Math.atan2(p.y - a[1], p.x - a[0]);
    }
    return Math.hypot(p.vx, p.vy) > 10 ? Math.atan2(p.vy, p.vx) : this.r() * TAU;
  }

  // The periodic lone runner, plus any interceptors the band sends ahead of you.
  updateScout(dt) {
    const p = this.player;
    this.scoutT = (this.scoutT ?? 75) - dt;
    if (!this.runners.length && this.scoutT <= 0 && !this.over && this.band.mode !== 'chase' && this.hunterDist() > 280) {
      const h = this.heading();
      const side = this.r() < 0.5 ? 1 : -1;
      const pos = this.groundPoint(h + side * 1.05, 0.45, 250, 300);
      if (pos) {
        this.runners.push(this.makeRunner(pos[0], pos[1], 26, this.day === 1 ? 2 : 3));
        this.emit('scout', { x: pos[0], y: pos[1] });
      }
      this.scoutT = Math.max(38, this.r.range(60, 85) - this.day * 4);
    }
    this.runners = this.runners.filter((sc) => this.updateRunner(sc, dt));
  }

  updateRunner(sc, dt) {
    const p = this.player;
    sc.mark = Math.max(0, sc.mark - dt);
    sc.life -= dt;
    const pd = dist(sc.x, sc.y, p.x, p.y);
    if (sc.down > 0) {
      sc.down -= dt;
      this.world.move(sc, sc.vx * dt, sc.vy * dt, { drop: false }); sc.vx *= 0.9; sc.vy *= 0.9;
      sc.state = 'down';
      if (sc.down <= 0) sc.leaving = true;
      return true;
    }
    if (sc.life <= 0 || pd > 520) sc.leaving = true;
    let tx, ty, sp;
    const run = Math.min(120, T.hunterRun + 4 + T.hunterRunPerDay * (this.day - 1));
    if (sc.leaving) {
      const a = Math.atan2(sc.y - p.y, sc.x - p.x);
      tx = sc.x + Math.cos(a) * 50; ty = sc.y + Math.sin(a) * 50; sp = run * 0.8;
      if (pd > 420) return false;
    } else {
      const sees = pd < this.sightRange() * 1.1;
      if (sees && !sc.seen) {
        sc.seen = true; sc.mark = 1.5; sc.markType = '!';
        this.emit('scoutsee', { x: sc.x, y: sc.y });
        this.band.rush = 10; // his call carries: the band hurries
      }
      if (sc.seen && pd < 170) {
        const a0 = Math.atan2(sc.y - p.y, sc.x - p.x) + 0.5 * (sc.id & 1 ? 1 : -1);
        tx = p.x + Math.cos(a0) * 125; ty = p.y + Math.sin(a0) * 125;
        sp = run * 0.8;
      } else {
        const lead = sc.seen ? 0.5 : 1.2;
        tx = p.x + p.vx * lead; ty = p.y + p.vy * lead;
        sp = run;
      }
      if ((sc.throws || 0) >= sc.maxThrows && sc.throwCd < 0.5) sc.leaving = true;
    }
    const a = Math.atan2(ty - sc.y, tx - sc.x);
    const gi = GROUND_INFO[this.world.typeAt(sc.x, sc.y)];
    const mv = Math.min(dist(sc.x, sc.y, tx, ty), sp * Math.max(0.6, gi.speed) * (sc.windup > 0 ? 0.1 : 1) * dt);
    sc.vx = (Math.cos(a) * mv) / dt; sc.vy = (Math.sin(a) * mv) / dt;
    this.world.move(sc, sc.vx * dt, sc.vy * dt);
    this.world.collide(sc, 4);
    if (Math.abs(sc.vx) > 3) sc.face = Math.sign(sc.vx);
    sc.state = sc.windup > 0 ? 'windup' : Math.hypot(sc.vx, sc.vy) > 60 ? 'run' : 'walk';
    sc.anim = (sc.anim + dt * (sc.state === 'run' ? 1.9 : 1.1)) % 1;
    this.combat(sc, dt, sc.seen && !sc.leaving);
    return true;
  }

  // ---------------- predictability ----------------
  // Persistence hunters read a straight line like a map. Run one for too long and they
  // stop following your trail and start meeting you at the far end of it.
  updatePressure(dt) {
    const p = this.player;
    this.histT = (this.histT || 0) - dt;
    if (this.histT <= 0) {
      this.histT = 1;
      this.hist.push([p.x, p.y]);
      if (this.hist.length > 40) this.hist.shift();
    }
    const H = this.hist, N = 30;
    let straight = 0, net = 0;
    if (H.length >= N) {
      let path = 0;
      for (let i = H.length - N + 1; i < H.length; i++) path += dist(H[i][0], H[i][1], H[i - 1][0], H[i - 1][1]);
      const a = H[H.length - N];
      const disp = dist(a[0], a[1], p.x, p.y);
      straight = path > 1 ? disp / path : 0;
      net = disp / N;
    }
    this.straightness = straight;
    const before = this.lineP;
    if (straight > 0.8 && net > 36) this.lineP += dt * (1 + (straight - 0.8) * 6);
    else this.lineP = Math.max(0, this.lineP - dt * (straight < 0.6 ? 2.5 : 1));
    this.interceptCd = Math.max(0, (this.interceptCd || 0) - dt);
    if (before < 14 && this.lineP >= 14) this.emit('linewarn', { x: p.x, y: p.y });
    if (this.lineP >= 30 && this.interceptCd <= 0 && !this.over) {
      this.lineP = 0;
      this.interceptCd = 35;
      this.intercepts++;
      const h = this.heading();
      const kind = this.intercepts >= 3 && this.day >= 2 && this.r() < 0.5 ? 'ambush' : 'intercept';
      const n = kind === 'ambush' ? 3 + Math.min(2, Math.floor(this.day / 3)) : 2;
      for (let i = 0; i < n; i++) {
        const pos = this.groundPoint(h + (i - (n - 1) / 2) * 0.4, 0.15, 230, 290);
        if (pos) this.runners.push(this.makeRunner(pos[0], pos[1], 24, 2));
      }
      // the dogs are slipped and sent straight at you
      for (const d of this.dogs) if (!d.dead && d.state !== 'chase') { d.state = 'chase'; d.chaseT = 0; d.x = p.x - Math.cos(h) * 320; d.y = p.y - Math.sin(h) * 320; }
      this.emit(kind, { x: p.x, y: p.y });
    }
  }

  // Reward the time a broken trail cost them, once they pick it back up.
  endSearch() {
    const b = this.band, p = this.player;
    if (b.searchT < 2.5 || this.over) return;
    const pts = Math.round(40 + b.searchT * 14);
    this.stats.breaks++;
    this.stats.searchTime = (this.stats.searchTime || 0) + b.searchT;
    this.addScore(pts, 'TRAIL BROKEN', p.x, p.y - 26, '#7fd6e0', 0.2);
    this.emit('trailbreak', { x: b.x, y: b.y, secs: b.searchT });
  }

  throwSpear(h) {
    if (h.scout) h.throws = (h.throws || 0) + 1;
    const sx = h.x + h.face * 4, sy = h.y - 20;
    const d = dist(sx, sy + 20, h.tx, h.ty);
    const t = d / T.spearSpeed;
    this.spears.push({ x: sx, y: sy, x0: sx, y0: sy + 20, tx: h.tx, ty: h.ty, t: 0, dur: Math.max(0.2, t), hitDone: false, from: h.id, dmg: h.scout ? 18 : 26 });
    this.emit('throw', { x: sx, y: sy });
  }

  updateSpears(dt) {
    const p = this.player;
    for (const s of this.spears) {
      s.t += dt;
      const u = Math.min(1, s.t / s.dur);
      const gx = lerp(s.x0, s.tx, u), gy = lerp(s.y0, s.ty, u);
      s.gx = gx; s.gy = gy;
      s.h = Math.sin(u * Math.PI) * Math.min(40, s.dur * 60) + (1 - u) * 20;
      s.ang = Math.atan2(s.ty - s.y0 + (u < 0.5 ? -s.h : s.h * 0.5), s.tx - s.x0);
      if (!s.hitDone && u > 0.55) {
        const pd = dist(gx, gy, p.x, p.y - 2);
        if (pd < 10) {
          s.hitDone = true;
          s.hit = true;
          if (this.hurtPlayer(s.dmg || 26, s.x0, s.y0, 'spear')) { this.stats.spearsHit++; }
          else s.hit = false;
        }
      }
      if (u >= 1 && !s.done) {
        s.done = true;
        const pd = dist(s.tx, s.ty, p.x, p.y);
        if (!s.hit) {
          this.stuck.push({ x: s.tx, y: s.ty, t: 0, face: Math.sign(s.tx - s.x0) || 1 });
          this.emit('thunk', { x: s.tx, y: s.ty });
          if (pd < 34 && !this.over) {
            this.stats.dodges++;
            const close = pd < 18;
            this.addScore(close ? 80 : 40, close ? 'WHISKER' : 'DODGE', p.x, p.y - 28, '#ffffff', close ? 0.35 : 0.2);
            this.emit('dodge', { x: p.x, y: p.y, close });
          }
        }
      }
    }
    this.spears = this.spears.filter((s) => !s.done);
    for (const s of this.stuck) s.t += dt;
    this.stuck = this.stuck.filter((s) => s.t < 25);
  }

  // ---------------- dogs ----------------
  updateDogs(dt) {
    const p = this.player, tr = this.trail;
    const speed = T.dogRun + this.day * 2.5;
    for (const d of this.dogs) {
      if (d.dead) {
        d.deadT += dt;
        // a driven-off dog runs back to the band and rejoins much later
        const a = Math.atan2(this.band.y - d.y, this.band.x - d.x);
        this.world.move(d, Math.cos(a) * 120 * dt, Math.sin(a) * 120 * dt);
        d.face = Math.sign(Math.cos(a)) || 1;
        d.anim = (d.anim + dt * 2.4) % 1;
        if (d.deadT > 40) { d.dead = false; d.idx = this.band.idx; d.state = 'track'; }
        continue;
      }
      d.bite -= dt;
      d.barkT -= dt;
      const pd = dist(d.x, d.y, p.x, p.y);
      const sees = pd < (this.isNight ? 150 : 210) && !this.over;
      if (sees && d.state === 'track') {
        d.state = 'chase';
        this.emit('bark', { x: d.x, y: d.y });
        d.barkT = 1.5;
      }
      let tx, ty, sp;
      if (d.state === 'chase') {
        d.chaseT = (d.chaseT || 0) + dt;
        // dogs give up a long chase and trot back to their masters
        if (pd > 300 || d.chaseT > 14) { d.state = 'return'; d.chaseT = 0; d.idx = this.band.idx; }
        tx = p.x; ty = p.y; sp = speed;
        if (d.bite > 0) { // circle off after a bite
          const a = Math.atan2(d.y - p.y, d.x - p.x) + 0.8;
          tx = p.x + Math.cos(a) * 60; ty = p.y + Math.sin(a) * 60;
        }
        if (d.barkT <= 0) { d.barkT = 2 + Math.random() * 2; this.emit('bark', { x: d.x, y: d.y, quiet: true }); }
        if (pd < 11 && d.bite <= 0) {
          d.bite = 1.4;
          if (this.hurtPlayer(9, d.x, d.y, 'dog')) this.emit('bite', { x: p.x, y: p.y });
        }
      } else if (d.state === 'return') {
        tx = this.band.x; ty = this.band.y; sp = speed * 0.7;
        if (dist(d.x, d.y, tx, ty) < 40) { d.state = 'track'; d.idx = this.band.idx; }
      } else {
        // dogs follow scent: rock doesn't stop them, water does
        let steps = 0;
        while (d.idx < tr.length - 1 && steps < 30 && dist(tr[d.idx].x, tr[d.idx].y, d.x, d.y) < 10) { d.idx++; steps++; }
        const tp = tr[Math.min(d.idx, tr.length - 1)];
        if (tp.water && d.idx < tr.length - 1) {
          d.searchT += dt;
          if (d.searchT > 5) {
            for (let i = d.idx; i < tr.length; i++) if (!tr[i].water) { d.idx = i; break; }
            d.searchT = 0;
          }
          tx = d.x + Math.cos(this.time * 3 + d.id) * 20; ty = d.y + Math.sin(this.time * 3 + d.id) * 20;
          sp = 40;
        } else {
          tx = tp.x; ty = tp.y;
          sp = speed * 0.62;
          // don't run too far ahead of the band
          if (dist(d.x, d.y, this.band.x, this.band.y) > 260 && d.idx > this.band.idx) sp *= 0.3;
        }
      }
      const a = Math.atan2(ty - d.y, tx - d.x);
      const gi = GROUND_INFO[this.world.typeAt(d.x, d.y)];
      const mv = Math.min(dist(d.x, d.y, tx, ty), sp * Math.max(0.55, gi.speed) * dt);
      d.vx = Math.cos(a) * mv / dt; d.vy = Math.sin(a) * mv / dt;
      this.world.move(d, d.vx * dt, d.vy * dt);
      this.world.collide(d, 3);
      if (Math.abs(d.vx) > 3) d.face = Math.sign(d.vx);
      d.anim = (d.anim + dt * (mv / dt > 80 ? 2.6 : 1.6)) % 1;
    }
  }

  // ---------------- prey ----------------
  updatePrey(dt) {
    const p = this.player;
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 1.5;
      const alive = this.prey.filter((q) => !q.dead);
      const herds = new Set(alive.filter((q) => q.kind !== 'hare').map((q) => q.herd));
      const hares = alive.filter((q) => q.kind === 'hare').length;
      if (herds.size < 3) this.spawnHerd();
      if (hares < 2) this.spawnHare();
    }
    const alertBase = p.sprinting ? 150 : p.state === 'walk' ? 92 : 56;
    for (const q of this.prey) {
      if (q.dead) continue;
      const S = SPECIES[q.kind];
      const pd = dist(q.x, q.y, p.x, p.y);
      let alertR = alertBase * (p.ground === G.TALL ? 0.6 : 1) * S.alert;
      if (this.isNight) alertR *= 0.75;
      alertR *= this.weatherSight || 1;
      let threatX = p.x, threatY = p.y, threat = pd < alertR;
      for (const h of this.hunters) {
        if (dist(q.x, q.y, h.x, h.y) < 90) { threat = true; threatX = h.x; threatY = h.y; }
      }
      if (threat && q.state !== 'flee' && q.state !== 'charge') {
        // warthogs sometimes stand their ground
        if (S.charge && pd < 70 && this.r() < 0.4 && threatX === p.x) {
          q.state = 'charge'; q.chargeT = 1.1; q.hitDone = false;
          this.emit('snarl', { x: q.x, y: q.y });
        } else {
          q.state = 'flee';
          q.fleeT = 0;
          if (S.fly) q.air = 2.2 + this.r() * 0.8;
          if (q.herd) for (const o of this.prey) if (o.herd === q.herd && o.state !== 'flee') {
            o.state = 'flee'; o.fleeT = 0; o.tx = threatX; o.ty = threatY;
            if (SPECIES[o.kind].fly) o.air = 2 + this.r();
          }
        }
      }
      if (threat) { q.tx = threatX; q.ty = threatY; }
      q.z = Math.max(0, (q.z || 0) + ((q.air > 0 ? 18 : 0) - (q.z || 0)) * Math.min(1, dt * 4));
      if (q.air > 0) q.air -= dt;
      if (q.state === 'charge') {
        q.chargeT -= dt;
        const a = Math.atan2(p.y - q.y, p.x - q.x);
        q.vx = Math.cos(a) * 140; q.vy = Math.sin(a) * 140;
        if (!q.hitDone && pd < 13) { q.hitDone = true; this.hurtPlayer(12, q.x, q.y, 'warthog'); }
        if (q.chargeT <= 0 || q.hitDone) { q.state = 'flee'; q.fleeT = 0.5; q.tx = p.x; q.ty = p.y; }
      } else if (q.state === 'flee') {
        q.fleeT += dt;
        const sp = q.fleeT < S.burstT ? S.burst : S.cruise;
        let a = Math.atan2(q.y - q.ty, q.x - q.tx);
        q.zig = (q.zig || 0) - dt;
        if (q.zig <= 0) { q.zig = S.zigT; q.zo = (Math.random() - 0.5) * S.zig; }
        a += q.zo;
        if (!(q.air > 0)) {
          const nx = q.x + Math.cos(a) * 20, ny = q.y + Math.sin(a) * 20;
          if (this.world.isWater(this.world.typeAt(nx, ny)) && !S.wader) a += 1.6;
        }
        const gi = GROUND_INFO[this.world.typeAt(q.x, q.y)];
        const gs = q.air > 0 ? 1 : S.wader ? Math.max(0.8, gi.speed) : gi.speed;
        q.vx = Math.cos(a) * sp * gs; q.vy = Math.sin(a) * sp * gs;
        // a zebra's parting gift to anything right behind it
        if (S.kick && q.fleeT < 0.7 && !q.kicked && pd < 16) {
          const bx = q.x - Math.cos(a) * 10, by = q.y - Math.sin(a) * 10;
          if (dist(bx, by, p.x, p.y) < 12) { q.kicked = true; this.hurtPlayer(10, q.x, q.y, 'zebra'); }
        }
        if (pd > 260 && q.fleeT > 3.5) { q.state = 'graze'; q.fleeT = 0; }
        if (q.fleeT > 6 && pd > alertR * 1.3) q.state = 'graze';
      } else {
        q.wt = (q.wt || 0) - dt;
        if (q.wt <= 0) {
          q.wt = this.r.range(1.5, 4);
          const a = this.r() * TAU;
          const s = this.r() < 0.5 ? 0 : 14;
          q.vx = Math.cos(a) * s; q.vy = Math.sin(a) * s * 0.6;
          if (S.wader && !this.world.isWater(this.world.typeAt(q.x + q.vx, q.y + q.vy))) { q.vx = -q.vx; q.vy = -q.vy; }
        }
      }
      if (q.air > 0) { q.x += q.vx * dt; q.y += q.vy * dt; }
      else if (this.world.move(q, q.vx * dt, q.vy * dt) === 'blocked') q.zig = 0;
      if (!(q.air > 0)) this.world.collide(q, 3);
      if (Math.abs(q.vx) > 2) q.face = Math.sign(q.vx);
      const spd = Math.hypot(q.vx, q.vy);
      q.anim = (q.anim + dt * (q.air > 0 ? 3 : spd > 60 ? spd / 70 : 0.9)) % 1;
      if (pd > 1300) q.gone = true;
    }
    this.prey = this.prey.filter((q) => !q.gone && !(q.dead));
    for (const c of this.carcasses) c.t += dt;
    this.carcasses = this.carcasses.filter((c) => c.t < 70 && dist(c.x, c.y, p.x, p.y) < 1400);
  }

  spawnPoint(minR, maxR, ok) {
    const p = this.player;
    for (let tries = 0; tries < 30; tries++) {
      let a = this.r() * TAU;
      if (Math.hypot(p.vx, p.vy) > 10 && this.r() < 0.7) a = Math.atan2(p.vy, p.vx) + this.r.range(-1, 1);
      const r = this.r.range(minR, maxR);
      const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
      const g = this.world.ground(x, y);
      if (ok(g, x, y)) return [x, y];
    }
    return null;
  }

  spawnHerd() {
    const land = (g) => g !== G.SHALLOW && g !== G.DEEP && g !== G.SEA && g !== G.CLIFF;
    const pt = this.spawnPoint(380, 700, land);
    if (!pt) return;
    let kind = pickSpecies(this.world.biomeAt(pt[0], pt[1]), this.r);
    if (this.day >= 2 && kind === 'gazelle' && this.r() < 0.08) kind = 'golden';
    let at = pt;
    if (SPECIES[kind].wader) {
      // flamingos stand in the shallows
      const w = this.world.nearestWater(pt[0], pt[1], 400);
      if (!w) kind = 'fowl'; else at = w;
    }
    const S = SPECIES[kind];
    const herd = UID++;
    const n = this.r.int(S.herd[0], S.herd[1]);
    for (let i = 0; i < n; i++) {
      this.prey.push({
        id: UID++, kind, herd, x: at[0] + this.r.range(-30, 30), y: at[1] + this.r.range(-20, 20),
        vx: 0, vy: 0, face: this.r() < 0.5 ? -1 : 1, anim: this.r(), state: 'graze', fleeT: 0, z: 0,
      });
    }
    if (kind === 'golden') this.emit('golden', { x: at[0], y: at[1] });
  }

  spawnHare() {
    const pt = this.spawnPoint(250, 600, (g) => g === G.GRASS || g === G.TALL || g === G.LUSH || g === G.SAND || g === G.LEAF || g === G.CLAY);
    if (!pt) return;
    this.prey.push({ id: UID++, kind: 'hare', herd: 0, x: pt[0], y: pt[1], vx: 0, vy: 0, face: 1, anim: 0, state: 'graze', fleeT: 0, z: 0 });
  }

  // ---------------- lions ----------------
  // A pride on a kill. Walk past and they'll chase you off. Lead the band past, and they'll
  // do the same to them.
  updateLions(dt) {
    const p = this.player;
    this.prideT = (this.prideT ?? this.r.range(120, 200)) - dt;
    if (this.prideT <= 0 && !this.lions.length && this.day >= 2 && !this.over) {
      this.prideT = this.r.range(150, 240);
      const h = this.heading();
      const pos = this.groundPoint(h + this.r.range(-0.6, 0.6), 0.2, 300, 380);
      const bio = pos ? this.world.biomeAt(pos[0], pos[1]) : -1;
      if (pos && (bio === B.SAVANNA || bio === B.WOODLAND || bio === B.HIGHLAND)) {
        const n = this.r.int(2, 3);
        this.carcasses.push({ id: UID++, x: pos[0], y: pos[1], meat: 60, max: 90, kind: 'zebra', face: 1, t: 0, lions: true, hyenas: true });
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU;
          this.lions.push({ id: UID++, x: pos[0] + Math.cos(a) * 22, y: pos[1] + Math.sin(a) * 12, hx: pos[0] + Math.cos(a) * 22, hy: pos[1] + Math.sin(a) * 12,
            vx: 0, vy: 0, face: Math.cos(a) > 0 ? -1 : 1, anim: this.r(), state: 'rest', t: 0, target: null, bite: 0, life: 110 });
        }
        this.emit('pride', { x: pos[0], y: pos[1] });
      }
    }
    for (const L of this.lions) {
      L.life -= dt;
      L.bite -= dt;
      L.t += dt;
      if (L.state === 'rest') {
        const pd = dist(L.x, L.y, p.x, p.y);
        const wake = (p.ground === G.TALL ? 70 : 115) * (p.sprinting ? 1.3 : 1);
        if (pd < wake && !this.over) { L.state = 'charge'; L.target = 'player'; L.t = 0; this.emit('roar', { x: L.x, y: L.y }); }
        for (const h of this.hunters) {
          if (h.down <= 0 && dist(L.x, L.y, h.x, h.y) < 100) { L.state = 'charge'; L.target = h; L.t = 0; this.emit('roar', { x: L.x, y: L.y }); break; }
        }
        if (L.life <= 0) L.gone = true;
      }
      let tx = L.hx, ty = L.hy, sp = 60;
      if (L.state === 'charge') {
        const tgt = L.target === 'player' ? p : L.target;
        tx = tgt.x; ty = tgt.y; sp = 150;
        const d = dist(L.x, L.y, tx, ty);
        if (d < 14 && L.bite <= 0) {
          L.bite = 1.6;
          if (L.target === 'player') this.hurtPlayer(18, L.x, L.y, 'lion');
          else if (tgt.down <= 0) {
            tgt.down = 7; tgt.vx = (tgt.x - L.x) * 3; tgt.vy = (tgt.y - L.y) * 3;
            const near = dist(p.x, p.y, L.x, L.y) < 600;
            if (near) this.addScore(250, 'LIONS TOOK HIM', tgt.x, tgt.y - 40, '#ff9a6a', 0.5);
            this.stats.lionTakedowns = (this.stats.lionTakedowns || 0) + 1;
            this.emit('knockdown', { x: tgt.x, y: tgt.y });
            L.state = 'return';
          }
        }
        if (L.t > 3.8 || (L.target === 'player' && this.over)) L.state = 'return';
      } else if (L.state === 'return') {
        if (dist(L.x, L.y, L.hx, L.hy) < 8) { L.state = 'rest'; L.t = 0; }
      }
      if (L.state === 'rest') { L.vx = 0; L.vy = 0; }
      else {
        const a = Math.atan2(ty - L.y, tx - L.x);
        const mv = Math.min(dist(L.x, L.y, tx, ty), sp * dt);
        L.vx = (Math.cos(a) * mv) / dt; L.vy = (Math.sin(a) * mv) / dt;
        this.world.move(L, L.vx * dt, L.vy * dt);
      }
      if (Math.abs(L.vx) > 3) L.face = Math.sign(L.vx);
      L.anim = (L.anim + dt * (L.state === 'charge' ? 2.4 : L.state === 'rest' ? 0.3 : 1.3)) % 1;
    }
    this.lions = this.lions.filter((L) => !L.gone);
  }

  // ---------------- main ----------------
  update(dt, inp) {
    if (dt <= 0) return;
    if (this.over) {
      this.time += dt;
      this.updateSpears(dt);
      return;
    }
    this.time += dt;
    this.updateClock(dt);
    // rain washes old prints
    if (this.weather.rain > 0.2) {
      const k = this.weather.rain * 0.22 * dt;
      for (let i = Math.max(0, this.band.idx); i < this.trail.length; i++) this.trail[i].s = Math.max(0, this.trail[i].s - k);
    }
    this.updatePlayer(dt, inp);
    this.throwGate = (this.throwGate || 0) - dt;
    this.updateBand(dt);
    this.updateDogs(dt);
    this.updateScout(dt);
    this.updatePressure(dt);
    this.updateHazards(dt);
    this.updateLions(dt);
    this.updateSpears(dt);
    this.updatePrey(dt);
    this.world.prepare(this.player.x, this.player.y, 900, 3);
    this.world.evict(this.player.x, this.player.y, 1600);

    // score: distance
    const m = Math.floor(this.meters);
    if (m > this.stats.dist) {
      this.distF += (m - this.stats.dist) * this.mult;
      const whole = Math.floor(this.distF);
      this.score += whole;
      this.distF -= whole;
      this.stats.dist = m;
    }
    this.multHold -= dt;
    if (this.mult > 1) this.mult = Math.max(1, this.mult - dt * (this.multHold > 0 ? 0.015 : 0.1));
    this.stats.bestMult = Math.max(this.stats.bestMult || 1, this.mult);
    this.stats.bestClose = Math.min(this.stats.bestClose, this.hunterDist());
  }

  hunterDist() {
    const p = this.player;
    let best = 1e9;
    for (const h of this.hunters) best = Math.min(best, dist(h.x, h.y, p.x, p.y));
    return best;
  }

  // "felt" distance along the trail — what the tracker bar shows
  threat() {
    const d = this.hunterDist();
    let dogD = 1e9;
    for (const dg of this.dogs) if (!dg.dead) dogD = Math.min(dogD, dist(dg.x, dg.y, this.player.x, this.player.y));
    return { d, dogD, mode: this.band.mode };
  }
}

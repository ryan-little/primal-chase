// The rules of the chase. Pure simulation: no drawing here.
// You are faster; they never tire. Heat is the leash: every burst of speed has to be paid
// back in shade, and every minute you spend paying it, they walk your trail.

import { clamp, dist, rng, TAU, wrapAngle, lerp } from './util.js';
import { World, G, GROUND_INFO } from './world.js';

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
    this.world = new World(seed, art);
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
    this.world.ensure(sx, sy, 400, 300, 999);
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
    this.scout = null;
    this.scoutT = 95;
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
    if (inp.pounce && p.pounce <= 0 && p.pounceCd <= 0 && p.stamina >= 18 && !p.overheated) {
      let dx = moving ? ix : p.face, dy = moving ? iy : 0;
      const l = Math.hypot(dx, dy) || 1;
      p.pdx = dx / l; p.pdy = dy / l;
      p.pounce = T.pounceTime;
      p.pounceCd = 0.55;
      p.stamina -= 22;
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
      speed = wantSprint ? T.sprint : T.trot * Math.max(0.35, mag);
      if (p.overheated) speed = T.trot * 0.5;
      speed *= gi.speed;
      if (p.health < 30) speed *= 0.88;
      const tx = moving ? ix * speed : 0, ty = moving ? iy * speed : 0;
      const acc = moving ? 9 : 12;
      p.vx = lerp(p.vx, tx, Math.min(1, dt * acc));
      p.vy = lerp(p.vy, ty, Math.min(1, dt * acc));
      if (Math.abs(p.vx) > 4) p.face = Math.sign(p.vx);
    }
    const sp = Math.hypot(p.vx, p.vy);
    const ox = p.x, oy = p.y;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    W.collide(p, 4);
    const moved = Math.hypot(p.x - ox, p.y - oy);
    p.odom += moved;
    this.meters += moved / 10;
    p.sprinting = wantSprint && sp > T.trot * 1.2;

    // tracks
    if (p.odom - p.lastPrint > 9) {
      p.lastPrint = p.odom;
      let s = gi.prints;
      if (rain > 0.3) s *= 1 - rain * 0.75;
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
    else if (sp > 10) dh += 1.1 + sun * 1.5;
    else dh -= 2.2 - sun * 1.1;
    dh += gi.heat * (g >= G.SHALLOW ? 1 : sun);
    if (p.inShade) dh -= sp > 10 ? 1.5 : 5.5;
    if (p.lying) dh -= 2.5;
    if (this.isNight) dh -= 2.5;
    dh -= rain * 3.2;
    p.heat = clamp(p.heat + dh * dt, 0, 100);
    if (!p.overheated && p.heat >= 100) {
      p.overheated = true;
      this.emit('overheat', { x: p.x, y: p.y });
    }
    if (p.overheated && p.heat < 55) p.overheated = false;

    // stamina
    const maxSt = p.food < 20 ? 55 : 100;
    if (p.sprinting) p.stamina -= 21 * dt;
    else p.stamina += (p.lying ? 26 : sp < 6 ? 20 : 13) * dt;
    p.stamina = clamp(p.stamina, 0, maxSt);
    if (p.stamina <= 1) p.exhausted = true;
    if (p.exhausted && p.stamina > 30) p.exhausted = false;

    // water & food
    p.water -= (0.62 + p.heat * 0.0085 + (p.sprinting ? 0.5 : 0)) * dt;
    if (p.drinking) {
      p.water += 24 * dt;
      p.heat -= 4 * dt;
      p.drinkSfx = (p.drinkSfx || 0) - dt;
      if (p.drinkSfx <= 0) { p.drinkSfx = 0.55; this.emit('drink', { x: p.x, y: p.y }); }
    }
    p.food -= 0.36 * dt;
    if (p.eating) {
      const take = Math.min(p.eating.meat, 18 * dt);
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
      if (p.lying && p.water > 15 && p.food > 15) dhp += 2.2;
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

    if (p.health <= 0 && !this.over) this.die();
  }

  pounceHits() {
    const p = this.player;
    for (const q of this.prey) {
      if (q.dead) continue;
      if (dist(q.x, q.y, p.x, p.y) < (q.kind === 'hare' ? 12 : 15)) {
        q.dead = true;
        this.stats.prey++;
        const meat = q.kind === 'hare' ? 24 : 70;
        this.carcasses.push({ id: UID++, x: q.x, y: q.y, meat, max: meat, kind: q.kind, face: q.face, t: 0 });
        this.addScore(q.kind === 'hare' ? 60 : 150, q.kind === 'hare' ? 'HARE' : 'GAZELLE', q.x, q.y - 16, '#ffe08a', q.kind === 'hare' ? 0.15 : 0.3);
        this.emit('kill', { x: q.x, y: q.y });
        p.pounce = Math.min(p.pounce, 0.04);
        p.vx *= 0.2; p.vy *= 0.2;
      }
    }
    for (const h of this.scout ? [...this.hunters, this.scout] : this.hunters) {
      if (h.down > 0) continue;
      if (dist(h.x, h.y - 4, p.x, p.y) < 14) {
        h.down = 4.5;
        h.windup = 0;
        h.vx = p.pdx * 120; h.vy = p.pdy * 120;
        this.stats.knockdowns++;
        this.addScore(200, 'TAKEDOWN', h.x, h.y - 40, '#ff9a6a', 0.5);
        this.emit('knockdown', { x: h.x, y: h.y });
        p.pounce = 0;
        p.vx = -p.pdx * 60; p.vy = -p.pdy * 60;
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
      kind === 'dog' ? 'The dogs pulled you down.' : p.water <= 0 ? 'Thirst took you.' :
      p.food <= 0 ? 'Hunger took you.' : p.overheated ? 'Your heart gave out in the heat.' : 'The chase ended.';
    this.emit('death', { x: p.x, y: p.y });
  }

  // ---------------- hunters ----------------
  sightRange() {
    const p = this.player;
    let r = this.isNight ? 125 : 240;
    r *= 1 - this.weather.rain * 0.4;
    if (p.ground === G.TALL) r *= p.lying || p.still > 0.3 ? 0.35 : 0.62;
    else if (p.lying && p.inShade) r *= 0.75;
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
        const a = Math.atan2(tp.y - b.y, tp.x - b.x);
        const gi = GROUND_INFO[this.world.typeAt(b.x, b.y)];
        const sp = walk * Math.max(0.6, gi.speed);
        const dd = dist(tp.x, tp.y, b.x, b.y);
        const mv = Math.min(dd, sp * dt);
        b.x += Math.cos(a) * mv;
        b.y += Math.sin(a) * mv;
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
        h.x += h.vx * dt; h.y += h.vy * dt;
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
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      this.world.collide(h, 4);
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
      h.windup = Math.max(0.5, 0.8 - this.day * 0.03);
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

  // ---------------- the scout ----------------
  // Every minute or so one young hunter is sent running wide to cut you off.
  // He's alone: dodge him, outrun him, or knock him flat.
  updateScout(dt) {
    const p = this.player;
    this.scoutT = (this.scoutT ?? 75) - dt;
    let sc = this.scout;
    if (!sc && this.scoutT <= 0 && !this.over && this.band.mode !== 'chase' && this.hunterDist() > 280) {
      const heading = Math.hypot(p.vx, p.vy) > 10 ? Math.atan2(p.vy, p.vx) : this.r() * TAU;
      let pos = null;
      for (let k = 0; k < 12 && !pos; k++) {
        const a = heading + (this.r() < 0.5 ? 1 : -1) * this.r.range(0.6, 1.5);
        const r = this.r.range(250, 300);
        const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
        if (!this.world.isWater(this.world.ground(x, y))) pos = [x, y];
      }
      if (pos) {
        sc = this.scout = {
          id: UID++, x: pos[0], y: pos[1], vx: 0, vy: 0, face: 1, anim: 0, variant: (this.day + 1) % 2,
          slot: 0, state: 'run', throwCd: 1.2, windup: 0, down: 0, stab: 0, tx: 0, ty: 0, mark: 0, markType: '',
          life: 26, seen: false, leaving: false, scout: true,
        };
        this.emit('scout', { x: sc.x, y: sc.y });
      }
      this.scoutT = Math.max(38, this.r.range(60, 85) - this.day * 4);
    }
    if (!sc) return;
    sc.mark = Math.max(0, sc.mark - dt);
    sc.life -= dt;
    const pd = dist(sc.x, sc.y, p.x, p.y);
    if (sc.down > 0) {
      sc.down -= dt;
      sc.x += sc.vx * dt; sc.y += sc.vy * dt; sc.vx *= 0.9; sc.vy *= 0.9;
      sc.state = 'down';
      if (sc.down <= 0) sc.leaving = true;
      return;
    }
    if (sc.life <= 0 || pd > 520) sc.leaving = true;
    let tx, ty, sp;
    const run = Math.min(120, T.hunterRun + 4 + T.hunterRunPerDay * (this.day - 1));
    if (sc.leaving) {
      const a = Math.atan2(sc.y - p.y, sc.x - p.x);
      tx = sc.x + Math.cos(a) * 50; ty = sc.y + Math.sin(a) * 50; sp = run * 0.8;
      if (pd > 420) { this.scout = null; return; }
    } else {
      const sees = pd < this.sightRange() * 1.1;
      if (sees && !sc.seen) {
        sc.seen = true; sc.mark = 1.5; sc.markType = '!';
        this.emit('scoutsee', { x: sc.x, y: sc.y });
        this.band.rush = 10; // his call carries: the band hurries
      }
      // run to cut you off, then circle at throwing distance
      if (sc.seen && pd < 170) {
        const a0 = Math.atan2(sc.y - p.y, sc.x - p.x) + 0.5 * (sc.id & 1 ? 1 : -1);
        tx = p.x + Math.cos(a0) * 125; ty = p.y + Math.sin(a0) * 125;
        sp = run * 0.8;
      } else {
        const lead = sc.seen ? 0.5 : 1.2;
        tx = p.x + p.vx * lead; ty = p.y + p.vy * lead;
        sp = run;
      }
      if ((sc.throws || 0) >= (this.day === 1 ? 2 : 3) && sc.throwCd < 0.5) sc.leaving = true;
    }
    const a = Math.atan2(ty - sc.y, tx - sc.x);
    const gi = GROUND_INFO[this.world.typeAt(sc.x, sc.y)];
    const mv = Math.min(dist(sc.x, sc.y, tx, ty), sp * Math.max(0.6, gi.speed) * (sc.windup > 0 ? 0.1 : 1) * dt);
    sc.vx = (Math.cos(a) * mv) / dt; sc.vy = (Math.sin(a) * mv) / dt;
    sc.x += sc.vx * dt; sc.y += sc.vy * dt;
    this.world.collide(sc, 4);
    if (Math.abs(sc.vx) > 3) sc.face = Math.sign(sc.vx);
    sc.state = sc.windup > 0 ? 'windup' : Math.hypot(sc.vx, sc.vy) > 60 ? 'run' : 'walk';
    sc.anim = (sc.anim + dt * (sc.state === 'run' ? 1.9 : 1.1)) % 1;
    this.combat(sc, dt, sc.seen && !sc.leaving);
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
        d.x += Math.cos(a) * 120 * dt; d.y += Math.sin(a) * 120 * dt;
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
      d.x += d.vx * dt; d.y += d.vy * dt;
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
      const herds = new Set(alive.filter((q) => q.kind === 'gazelle').map((q) => q.herd));
      const hares = alive.filter((q) => q.kind === 'hare').length;
      if (herds.size < 2) this.spawnHerd();
      if (hares < 3) this.spawnHare();
    }
    const alertBase = p.sprinting ? 150 : p.state === 'walk' ? 92 : 56;
    for (const q of this.prey) {
      if (q.dead) continue;
      const pd = dist(q.x, q.y, p.x, p.y);
      let alertR = alertBase * (p.ground === G.TALL ? 0.6 : 1) * (q.kind === 'hare' ? 0.7 : 1);
      if (this.isNight) alertR *= 0.75;
      // hunters spook prey too
      let threatX = p.x, threatY = p.y, threat = pd < alertR;
      for (const h of this.hunters) {
        if (dist(q.x, q.y, h.x, h.y) < 90) { threat = true; threatX = h.x; threatY = h.y; }
      }
      if (threat && q.state !== 'flee') {
        q.state = 'flee';
        q.fleeT = 0;
        if (q.herd) for (const o of this.prey) if (o.herd === q.herd && o.state !== 'flee') { o.state = 'flee'; o.fleeT = 0; o.tx = threatX; o.ty = threatY; }
      }
      if (threat) { q.tx = threatX; q.ty = threatY; }
      if (q.state === 'flee') {
        q.fleeT += dt;
        const burst = q.kind === 'hare' ? 1.6 : 2.2;
        let sp = q.kind === 'hare' ? (q.fleeT < burst ? 150 : 88) : q.fleeT < burst ? 158 : 96;
        let a = Math.atan2(q.y - q.ty, q.x - q.tx);
        q.zig = (q.zig || 0) - dt;
        if (q.zig <= 0) { q.zig = q.kind === 'hare' ? 0.35 : 0.8; q.zo = (Math.random() - 0.5) * (q.kind === 'hare' ? 2.4 : 1.1); }
        a += q.zo;
        // steer around water
        const nx = q.x + Math.cos(a) * 20, ny = q.y + Math.sin(a) * 20;
        if (this.world.isWater(this.world.typeAt(nx, ny))) a += 1.6;
        const gi = GROUND_INFO[this.world.typeAt(q.x, q.y)];
        q.vx = Math.cos(a) * sp * gi.speed; q.vy = Math.sin(a) * sp * gi.speed;
        if (pd > 260 && q.fleeT > 3.5) { q.state = 'graze'; q.fleeT = 0; }
        if (q.fleeT > 6 && pd > alertR * 1.3) q.state = 'graze';
      } else {
        q.wt = (q.wt || 0) - dt;
        if (q.wt <= 0) {
          q.wt = this.r.range(1.5, 4);
          const a = this.r() * TAU;
          const s = this.r() < 0.5 ? 0 : 14;
          q.vx = Math.cos(a) * s; q.vy = Math.sin(a) * s * 0.6;
        }
      }
      q.x += q.vx * dt; q.y += q.vy * dt;
      this.world.collide(q, 3);
      if (Math.abs(q.vx) > 2) q.face = Math.sign(q.vx);
      const spd = Math.hypot(q.vx, q.vy);
      q.anim = (q.anim + dt * (spd > 60 ? spd / 70 : 0.9)) % 1;
      if (pd > 1300) q.gone = true;
    }
    this.prey = this.prey.filter((q) => !q.gone && !(q.dead));
    for (const c of this.carcasses) c.t += dt;
    this.carcasses = this.carcasses.filter((c) => c.t < 70 && dist(c.x, c.y, p.x, p.y) < 1400);
  }

  spawnPoint(minR, maxR, ok) {
    const p = this.player;
    for (let tries = 0; tries < 30; tries++) {
      // bias spawns toward the direction you're heading
      let a = this.r() * TAU;
      if (Math.hypot(p.vx, p.vy) > 10 && this.r() < 0.7) a = Math.atan2(p.vy, p.vx) + this.r.range(-1, 1);
      const r = this.r.range(minR, maxR);
      const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
      const g = this.world.ground(x, y);
      if (ok(g)) return [x, y];
    }
    return null;
  }

  spawnHerd() {
    const pt = this.spawnPoint(380, 700, (g) => g === G.GRASS || g === G.LUSH || g === G.TALL);
    if (!pt) return;
    const herd = UID++;
    const n = this.r.int(3, 6);
    for (let i = 0; i < n; i++) {
      this.prey.push({
        id: UID++, kind: 'gazelle', herd, x: pt[0] + this.r.range(-30, 30), y: pt[1] + this.r.range(-20, 20),
        vx: 0, vy: 0, face: this.r() < 0.5 ? -1 : 1, anim: this.r(), state: 'graze', fleeT: 0,
      });
    }
  }

  spawnHare() {
    const pt = this.spawnPoint(250, 600, (g) => g !== G.SHALLOW && g !== G.DEEP && g !== G.ROCK);
    if (!pt) return;
    this.prey.push({ id: UID++, kind: 'hare', x: pt[0], y: pt[1], vx: 0, vy: 0, face: 1, anim: 0, state: 'graze', fleeT: 0 });
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
    this.updateSpears(dt);
    this.updatePrey(dt);
    this.world.ensure(this.player.x, this.player.y, 420, 300, 2);
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

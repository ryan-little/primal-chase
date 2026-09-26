// The sky as an opponent and an ally: rain washes your trail, fog hides you, dust blinds
// everyone, heatwaves cook you, storms throw lightning, and lightning starts fires.
// Installed onto Game.prototype so the rules stay in one place.

import { lerp, clamp, dist, TAU } from './util.js';
import { G } from './terrain.js';

const FCELL = 8;
const FLAMMABLE = new Set([G.GRASS, G.TALL, G.LUSH, G.LEAF]);
export const WEATHER_NAMES = { clear: 'Clear', rain: 'Rain', storm: 'Thunderstorm', heat: 'Heatwave', dust: 'Dust storm', fog: 'Fog' };

export function installWeather(Game) {
  const P = Game.prototype;

  P.initWeather = function () {
    this.weather = {
      kind: 'clear', rain: 0, target: 0, fog: 0, fogT: 0, dust: 0, dustT: 0, heat: 0, heatT: 0,
      until: 0, next: this.r.range(40, 80), flash: 0, windA: this.r() * TAU, strikes: [], strikeT: 0,
    };
    this.fire = new Map();
    this.burnt = new Map();
    this.fireTick = 0;
    this.planDay();
  };

  // Roll the day's weather at dawn.
  P.planDay = function () {
    const w = this.weather;
    const d = this.day;
    w.windA += this.r.range(-1, 1);
    w.fogDawn = this.r() < (d === 1 ? 0.35 : 0.45);
    w.heatDay = d >= 2 && this.r() < 0.3;
  };

  P.startWeather = function (kind, dur) {
    const w = this.weather;
    w.kind = kind;
    w.until = dur;
    if (kind === 'rain' || kind === 'storm') w.target = 1;
    this.emit('weather', { kind });
    if (kind === 'rain' || kind === 'storm') this.emit('rain');
  };

  P.updateWeather = function (dt) {
    const w = this.weather, c = this.clock, p = this.player;
    // dawn fog, midday heat
    w.fogT = w.fogDawn && (c > 0.985 || c < 0.13) ? 1 : 0;
    w.heatT = w.heatDay && c > 0.18 && c < 0.56 ? 1 : 0;
    if (w.heatT && w.heat < 0.05) this.emit('weather', { kind: 'heat' });
    // afternoon/evening events
    w.next -= dt;
    if (w.kind === 'clear' && w.next <= 0) {
      w.next = this.r.range(55, 120);
      const bio = this.world.biomeAt(p.x, p.y);
      const dry = bio === 3 || bio === 0; // desert, savanna
      const roll = this.r();
      if (!this.isNight || roll < 0.3) {
        if (dry && this.day >= 2 && roll < 0.28) this.startWeather('dust', this.r.range(24, 36));
        else if (this.day >= 2 && roll < 0.5) this.startWeather('storm', this.r.range(28, 40));
        else if (roll < 0.75) this.startWeather('rain', this.r.range(22, 36));
      }
      // a dry-season grass fire, set by who knows what
      if (this.day >= 3 && this.r() < 0.12 && !this.isNight) {
        const a = w.windA + Math.PI + this.r.range(-0.6, 0.6);
        const fx = p.x + Math.cos(a) * 300, fy = p.y + Math.sin(a) * 300;
        if (this.ignite(fx, fy)) this.emit('wildfire', { x: fx, y: fy });
      }
    }
    if (w.kind !== 'clear') {
      w.until -= dt;
      if (w.until <= 0) { w.kind = 'clear'; w.target = 0; }
    }
    w.dustT = w.kind === 'dust' ? 1 : 0;
    w.rain = lerp(w.rain, w.target, dt * 0.35);
    w.fog = lerp(w.fog, w.fogT, dt * 0.3);
    w.dust = lerp(w.dust, w.dustT, dt * 0.4);
    w.heat = lerp(w.heat, w.heatT, dt * 0.25);
    w.flash = Math.max(0, w.flash - dt * 3);

    // lightning: telegraphed strikes, some of them close
    if (w.kind === 'storm') {
      w.strikeT -= dt;
      if (w.strikeT <= 0) {
        w.strikeT = this.r.range(3, 7);
        const near = this.r() < 0.35;
        const a = this.r() * TAU, r = near ? this.r.range(10, 70) : this.r.range(120, 380);
        w.strikes.push({ x: p.x + Math.cos(a) * r + p.vx * 0.6, y: p.y + Math.sin(a) * r + p.vy * 0.6, t: 0.9 });
      }
    } else if (w.rain > 0.3 && this.r() < dt * 0.05) { w.flash = 0.6; this.emit('thunder'); }
    for (const s of w.strikes) {
      s.t -= dt;
      if (s.t <= 0 && !s.done) {
        s.done = true;
        w.flash = 1;
        this.emit('strike', { x: s.x, y: s.y });
        if (dist(s.x, s.y, p.x, p.y) < 20) this.hurtPlayer(28, s.x, s.y, 'lightning');
        for (const h of this.hunters) if (h.down <= 0 && dist(s.x, s.y, h.x, h.y) < 20) { h.down = 5; this.addScore(200, 'STRUCK', h.x, h.y - 40, '#ffffff', 0.3); }
        if (this.r() < 0.7) this.ignite(s.x, s.y);
      }
    }
    w.strikes = w.strikes.filter((s) => s.t > -0.4);

    // what the weather does to the trail
    const wash = w.rain * 0.22 + w.dust * 0.12;
    if (wash > 0.04) {
      const k = wash * dt;
      for (let i = Math.max(0, this.band.idx); i < this.trail.length; i++) this.trail[i].s = Math.max(0, this.trail[i].s - k);
    }
    this.weatherSight = (1 - w.fog * 0.45) * (1 - w.dust * 0.5);
    this.weatherThirst = 1 + w.heat * 0.35;
    this.updateFire(dt);
  };

  // Extra heat per second from the sky (added to the player's heat balance).
  P.weatherHeat = function (p, sun) {
    const w = this.weather;
    let h = w.heat * 2.4 * sun + w.dust * 0.8 - w.fog * 1.5;
    const f = this.fire.get(this.fkey(p.x, p.y));
    if (f) h += 45;
    else if (this.fireNear(p.x, p.y, 20)) h += 10;
    return h;
  };

  // ---------------- fire ----------------
  P.fkey = function (x, y) { return Math.floor(x / FCELL) * 100003 + Math.floor(y / FCELL); };

  P.ignite = function (x, y) {
    const k = this.fkey(x, y);
    if (this.fire.has(k) || this.burnt.has(k)) return false;
    if (!FLAMMABLE.has(this.world.typeAt(x, y))) return false;
    const cx = (Math.floor(x / FCELL) + 0.5) * FCELL, cy = (Math.floor(y / FCELL) + 0.5) * FCELL;
    const life = this.r.range(2.4, 3.6);
    this.fire.set(k, { x: cx, y: cy, t: life, max: life });
    this.world.fire.set(k, 1);
    return true;
  };

  P.fireNear = function (x, y, r) {
    for (let dx = -r; dx <= r; dx += FCELL) for (let dy = -r; dy <= r; dy += FCELL) if (this.fire.has(this.fkey(x + dx, y + dy))) return true;
    return false;
  };

  P.updateFire = function (dt) {
    if (!this.fire.size) return;
    const w = this.weather, p = this.player;
    const douse = w.rain > 0.3 ? 3 : 1;
    this.fireTick -= dt;
    const tick = this.fireTick <= 0;
    if (tick) this.fireTick = 0.3;
    const add = [];
    for (const [k, f] of this.fire) {
      f.t -= dt * douse;
      if (tick && this.fire.size < 1600 && w.rain < 0.3) {
        for (let n = 0; n < 8; n++) {
          const a = (n / 8) * TAU;
          const align = Math.cos(a - w.windA); // spreads downwind
          const pr = 0.025 + Math.max(0, align) ** 2 * 0.28 + (w.heat > 0.5 ? 0.04 : 0);
          if (this.r() < pr) add.push([f.x + Math.cos(a) * FCELL, f.y + Math.sin(a) * FCELL]);
        }
      }
      if (f.t <= 0) {
        this.fire.delete(k);
        this.world.fire.delete(k);
        this.burnt.set(k, { x: f.x, y: f.y });
        this.world.burnt.set(k, 1);
      }
    }
    for (const [x, y] of add) this.ignite(x, y);
    // fire eats the trail and spooks everything
    if (tick) {
      for (let i = Math.max(0, this.trail.length - 900); i < this.trail.length; i++) {
        const tp = this.trail[i];
        if (tp.s > 0 && this.fire.has(this.fkey(tp.x, tp.y))) tp.s = 0;
      }
      for (const q of this.prey) if (q.state !== 'flee' && this.fireNear(q.x, q.y, 60)) { q.state = 'flee'; q.fleeT = 0; q.tx = q.x - Math.cos(w.windA) * 50; q.ty = q.y - Math.sin(w.windA) * 50; }
      for (const h of this.hunters) {
        if (h.down <= 0 && this.fire.has(this.fkey(h.x, h.y))) { h.down = 3; h.burnt = true; }
      }
      const pf = this.fire.has(this.fkey(p.x, p.y));
      if (pf) this.hurtPlayer(6, p.x - p.vx, p.y - p.vy, 'fire');
    }
    this.fireAlarm = this.fireNear(p.x, p.y, 140);
  };
}

export { FCELL };

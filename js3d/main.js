// ============================================================
// MAIN.JS — boot, the frame loop, and the bridge between the
// turn model (Game3D) and everything the player sees.
// ============================================================

import * as THREE from '../js/vendor/three.module.min.js';
import { Renderer } from './render/renderer.js';
import { CameraRig } from './render/camera.js';
import { World } from './world/worldgen.js';
import { TerrainMesh, HighlightLayer } from './world/terrainmesh.js';
import { Scenery } from './world/scenery.js';
import { Sky } from './world/sky.js';
import { Weather } from './world/weather.js';
import { Jaguar } from './entities/jaguar.js';
import { HunterBand } from './entities/hunters3d.js';
import { Markers } from './entities/markers.js';
import { Game3D } from './core/game3d.js';
import { HUD } from './ui/hud.js';
import { Screens } from './ui/screens.js';
import * as Hex from './world/hex.js';

const App = {
  running: false,
  playing: false,
  busy: false,          // a turn animation is in flight
  paused: false,
  elapsed: 0,
  _last: 0,
  _selected: null,      // pending move option key
  _moveOptions: null,
  _hovered: null,

  // ------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------

  async boot() {
    Options.load();
    Screens.init();
    HUD.init();

    if (!this.hasWebGL()) {
      Screens.show('screen-unsupported');
      return;
    }

    Screens.setLoading(0.1, 'Waking the savannah…');
    await frame();

    try {
      this.renderer = new Renderer(document.getElementById('scene'));
    } catch (e) {
      console.error('WebGL init failed', e);
      Screens.show('screen-unsupported');
      return;
    }

    const q = this.renderer.quality;
    this.rig = new CameraRig(this.renderer.camera, this.renderer.canvas);
    this.raycaster = new THREE.Raycaster();

    Screens.setLoading(0.3, 'Raising the ground…');
    await frame();

    // A placeholder world exists until the first run seeds a real one.
    this.world = new World(1);
    this.terrain = new TerrainMesh(this.renderer.scene, this.world);
    this.highlight = new HighlightLayer(this.renderer.scene, this.world);
    this.markers = new Markers(this.renderer.scene, this.world);

    Screens.setLoading(0.5, 'Planting the thornwood…');
    await frame();
    this.scenery = new Scenery(this.renderer.scene, this.world, q);
    this.sky = new Sky(this.renderer.scene, q);
    this.weather = new Weather(this.renderer.scene, q);
    this.weather.onLightning = (strength) => {
      HUD.flash(Math.min(0.5, strength * 0.28), 220);
      if (!Options.get('reduceMotion') && strength > 1) this.rig.shake(0.35);
    };

    Screens.setLoading(0.75, 'Waking the cat…');
    await frame();
    this.jaguar = new Jaguar(this.renderer.scene, q);
    this.band = new HunterBand(this.renderer.scene, q);
    this.band.setVisible(false);

    Screens.setLoading(0.92, 'Setting them on your trail…');
    await frame();

    this.wire();
    this.startLoop();

    // A slow drift over untouched land makes a living title screen.
    this.showTitleVista();
    Screens.setLoading(1, 'Ready.');
    await frame();
    Screens.show('screen-title');
  },

  hasWebGL() {
    try {
      const canvas = document.createElement('canvas');
      return !!(window.WebGL2RenderingContext && canvas.getContext('webgl2'));
    } catch (e) {
      return false;
    }
  },

  wire() {
    Screens.onStart = () => this.newRun();
    Screens.onResume = () => { this.paused = false; };
    Screens.onAbandon = () => { this.playing = false; HUD.hide(); this.showTitleVista(); };
    Screens.onQualityChange = (name) => this.applyQuality(name);
    Screens.onOptionChange = (key) => {
      if (key === 'showTrail') this.markers.updateTrail(Game3D.state ? Game3D.state.trail : [], Options.get('showTrail'));
    };

    HUD.onAction = (key) => this.takeAction(key);
    HUD.onMoveConfirm = () => this.confirmMove();
    HUD.onMoveCancel = () => this.clearSelection();

    this.rig.onTap = (x, y) => this.handleTap(x, y);
    this.rig.onHover = (x, y) => this.handleHover(x, y);

    Game3D.onDeath = (state, result) => this.handleDeath(state, result);

    document.getElementById('btn-recenter').addEventListener('click', () => this.recenter());
    document.getElementById('btn-look-back').addEventListener('click', () => this.lookBack());
    document.getElementById('btn-pause').addEventListener('click', () => this.openPause());

    window.addEventListener('keydown', (e) => this.onKey(e));
    document.addEventListener('visibilitychange', () => { this._last = performance.now(); });
  },

  applyQuality(name) {
    const resolved = name === 'auto' ? null : name;
    if (resolved) this.renderer.setQuality(resolved);
    else {
      try { localStorage.removeItem('primalchase3d_quality'); } catch (e) { /* private mode */ }
      location.reload();
      return;
    }
    const q = this.renderer.quality;
    this.scenery.setQuality(q);
    this.sky.setQuality(q);
    this.band.setQuality(q);
    this.weather.setQuality(q);
    this.jaguar.setShadows(q.shadows);
    this.streamWorld(true);
  },

  // ------------------------------------------------------------
  // Title vista — the world keeps living behind the menu
  // ------------------------------------------------------------

  showTitleVista() {
    const seed = Math.floor(Math.random() * 1e9);
    this.swapWorld(new World(seed));
    const start = { q: 0, r: 0 };
    const cell = this.world.get(start.q, start.r);
    this.sky.setPhaseImmediate(Math.random() < 0.5 ? 'day' : 'night');
    this.terrain.update(start.q, start.r, this.renderer.quality.drawHexes);
    this.scenery.update(start.q, start.r, this.renderer.quality.drawHexes);
    this.markers.updateLandmarks(start.q, start.r, this.renderer.quality.drawHexes);
    this.markers.updateTrail([], false);
    this.highlight.clear();
    this.jaguar.root.visible = false;
    this.band.setVisible(false);
    this.weather.setCondition(null, this.sky.nightAmount > 0.5 ? 'night' : 'day', 'open');

    this.rig.azimuth = Math.random() * Math.PI * 2;
    this.rig.polar = 1.02;
    this.rig._targetDistance = 120;
    this.rig.snapTo(cell.worldX, cell.height + 6, cell.worldZ);
    this.sky.follow(cell.worldX, cell.worldZ);
    this._vista = true;
  },

  swapWorld(world) {
    this.world = world;
    this.terrain.world = world;
    this.highlight.world = world;
    this.scenery.world = world;
    this.markers.world = world;
    this.terrain._centerKey = null;
    this.scenery._centerKey = null;
    this.markers.reset();
  },

  // ------------------------------------------------------------
  // Runs
  // ------------------------------------------------------------

  newRun() {
    this._vista = false;
    const state = Game3D.newGame();
    this.swapWorld(Game3D.world);

    this.jaguar.root.visible = true;
    this.jaguar.setCollapse(0);
    this.jaguar.setDrinking(0);
    this.jaguar.setGait('idle');
    this.band.setVisible(true);

    this.sky.setPhaseImmediate(state.phase);
    this.streamWorld(true);

    const cell = Game3D.currentCell();
    this.jaguar.setPosition(cell.worldX, this.terrain.surfaceY(cell.q, cell.r), cell.worldZ);
    this.jaguar.setFacing(Math.PI);           // facing away from the hunters, who start south
    this.placeHunters(true);

    this.rig.azimuth = Math.PI;
    this.rig.polar = window.CONFIG3D.camera.defaultPolar;
    this.rig._targetDistance = window.CONFIG3D.camera.defaultDistance;
    this.aimAt(cell.worldX, cell.height, cell.worldZ);
    this.rig.snapTo(this.rig.target.x, this.rig.target.y, this.rig.target.z);

    this.playing = true;
    this.paused = false;
    this.busy = false;
    HUD.show();
    HUD._hintDismissed = false;
    HUD.el.hint.classList.remove('gone');
    this.refreshTurn({ instant: true });
  },

  /** Rebuild everything the HUD and board show at the start of a turn. */
  refreshTurn(opts = {}) {
    const state = Game3D.state;
    HUD.renderPhase(state);
    HUD.renderVitals(state);
    HUD.renderTracker(state);
    HUD.updateEscalation(state);
    HUD.renderSituation(state, opts);
    HUD.renderActions(Game3D.inPlaceActions(), state);
    HUD.setActionsEnabled(true);
    HUD.setFlavor(Hunters.getHunterFlavorText(state.hunterDistance, state.hunterState, state.phase));

    this._moveOptions = Game3D.moveOptions();
    this.clearSelection();
    this.weather.setCondition(state.currentEncounter, state.phase, Game3D.currentCell().cat);
  },

  /** Terrain, scenery and markers follow the player across the endless map. */
  streamWorld(force) {
    const pos = Game3D.state ? Game3D.state.pos : { q: 0, r: 0 };
    const radius = this.renderer.quality.drawHexes;
    if (force) { this.terrain._centerKey = null; this.scenery._centerKey = null; this.markers._beaconKey = null; }
    this.terrain.update(pos.q, pos.r, radius);
    this.scenery.update(pos.q, pos.r, radius);
    this.markers.updateLandmarks(pos.q, pos.r, radius);
    this.markers.updateTrail(Game3D.state ? Game3D.state.trail : [], Options.get('showTrail'));
  },

  placeHunters(snap) {
    const h = Game3D.hunterWorldPosition();
    const state = Game3D.state;
    const camping = state.phase === 'night' && state.hunterState !== 'tracking';
    this.band.setMode(state.hunterState === 'tracking' ? 'tracking' : (camping ? 'camp' : 'pursuit'));
    this.band.setFacing(h.yaw);
    if (snap) this.band.placeAt(h.x, h.y, h.z);
    else this.band.moveTo(h.x, h.y, h.z);
    // Only show them when they are close enough to actually be seen.
    this.band.setVisible(state.hunterDistance <= window.CONFIG3D.hunters.visibleRange);
  },

  // ------------------------------------------------------------
  // Selection & input
  // ------------------------------------------------------------

  handleTap(clientX, clientY) {
    if (!this.playing || this.busy || this.paused) return;
    if (HUD.skipTypewriter()) return;
    const hit = this.pick(clientX, clientY);
    if (!hit) return;
    const key = Hex.key(hit.q, hit.r);

    if (key === Hex.key(Game3D.state.pos.q, Game3D.state.pos.r)) {
      // Tapping yourself dismisses a pending plan.
      this.clearSelection();
      return;
    }
    const option = this._moveOptions.get(key);
    if (!option) return;

    if (this._selected === key) {
      this.confirmMove();
      return;
    }
    this._selected = key;
    const preview = Game3D.previewMove(option);
    HUD.showMovePreview(preview, this.terrainLabel(preview.dest));
    this.drawHighlights();
  },

  handleHover(clientX, clientY) {
    if (!this.playing || this.busy || this.paused) return;
    const hit = this.pick(clientX, clientY);
    const key = hit ? Hex.key(hit.q, hit.r) : null;
    if (key === this._hovered) return;
    this._hovered = key && this._moveOptions && this._moveOptions.has(key) ? key : null;
    this.drawHighlights();
  },

  pick(clientX, clientY) {
    const rect = this.renderer.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.renderer.camera);
    return this.terrain.pick(this.raycaster);
  },

  clearSelection() {
    this._selected = null;
    HUD.hideMovePreview();
    this.drawHighlights();
  },

  drawHighlights() {
    if (!this.playing || !this._moveOptions) { this.highlight.clear(); return; }
    this.highlight.begin();
    const pos = Game3D.state.pos;
    for (const [key, option] of this._moveOptions) {
      let kind = option.steps === 1 ? 'reach' : 'path';
      const cell = this.world.get(option.q, option.r);
      if (cell.water) kind = 'water';
      if (key === this._hovered) kind = 'hover';
      if (key === this._selected) kind = 'target';
      this.highlight.add(option.q, option.r, kind);
    }
    // The chosen route, so a two-hex push reads as an actual path.
    if (this._selected) {
      const option = this._moveOptions.get(this._selected);
      if (option) for (const step of option.path.slice(1, -1)) this.highlight.add(step.q, step.r, 'path');
    }
    this.highlight.end();
    void pos;
  },

  terrainLabel(cell) {
    const terrain = Encounters.terrainById(cell.terrain);
    const name = terrain ? terrain.name : cell.terrain.replace(/_/g, ' ');
    return name.charAt(0).toUpperCase() + name.slice(1);
  },

  // ------------------------------------------------------------
  // Turns
  // ------------------------------------------------------------

  confirmMove() {
    if (!this._selected || this.busy) return;
    const option = this._moveOptions.get(this._selected);
    if (!option) return;
    HUD.hideMovePreview();
    this.highlight.clear();
    const result = Game3D.commitMove(option);
    if (result) this.playTurn(result);
  },

  takeAction(actionKey) {
    if (this.busy || !this.playing) return;
    this.clearSelection();
    this.highlight.clear();
    const result = Game3D.commitAction(actionKey);
    if (result) this.playTurn(result);
  },

  /** Animate a resolved turn, then hand control back. */
  playTurn(result) {
    this.busy = true;
    HUD.setActionsEnabled(false);
    const reduce = Options.get('reduceMotion');
    const T = window.CONFIG3D.timing;

    // The sky always advances a phase — unless the run just ended.
    if (!result.died) this.sky.advanceTo(Game3D.state.phase);

    const isDrink = ['drink', 'dig', 'search', 'wallow'].includes(result.actionKey);
    this.jaguar.setDrinking(isDrink ? 1 : 0);
    this.jaguar.setGait(result.kind === 'move' ? (result.gait === 'push' ? 'run' : 'walk') : 'idle');

    const state = Game3D.state;
    this.jaguar.setExhaustion(Math.max(0, Math.min(1, (100 - state.stamina) / 100 * 0.7 + state.heat / 100 * 0.3)));

    const anim = {
      path: result.path,
      index: 0,
      t: 0,
      stepDuration: reduce ? 0.18 : T.stepDuration,
      holdDuration: reduce ? 0.2 : (result.kind === 'move' ? 0.35 : T.restDuration),
      result,
      phase: result.kind === 'move' && result.path.length > 1 ? 'walk' : 'hold'
    };
    this._anim = anim;

    if (result.brokeTrail) HUD.flash(0.18, 420);
    this.placeHunters(false);
  },

  /** Drive the in-flight turn animation. Called from the frame loop. */
  stepAnimation(dt) {
    const anim = this._anim;
    if (!anim) return;

    if (anim.phase === 'walk') {
      anim.t += dt / anim.stepDuration;
      while (anim.t >= 1 && anim.index < anim.path.length - 2) {
        anim.t -= 1;
        anim.index++;
      }
      const i = anim.index;
      const from = this.world.get(anim.path[i].q, anim.path[i].r);
      const to = this.world.get(anim.path[i + 1].q, anim.path[i + 1].r);
      const t = Math.min(1, anim.t);
      const ease = t * t * (3 - 2 * t);
      const x = from.worldX + (to.worldX - from.worldX) * ease;
      const z = from.worldZ + (to.worldZ - from.worldZ) * ease;
      const y = from.height + (to.height - from.height) * ease;
      this.jaguar.setPosition(x, y, z);
      this.jaguar.faceTowards(Math.atan2(to.worldX - from.worldX, to.worldZ - from.worldZ), dt, 9);
      this.aimAt(x, y, z);
      this.sky.follow(x, z);
      this.streamWorld(false);

      if (t >= 1 && anim.index >= anim.path.length - 2) {
        anim.phase = 'hold';
        anim.t = 0;
        this.jaguar.setGait('idle');
      }
    } else {
      anim.t += dt;
      const skyBusy = this.sky.update(dt, window.CONFIG3D.timing.phaseSweep / 1.0);
      if (anim.t >= anim.holdDuration && !skyBusy) {
        this._anim = null;
        this.finishTurn(anim.result);
      }
    }
  },

  finishTurn(result) {
    this.busy = false;
    this.jaguar.setDrinking(0);

    if (result.died) return;   // handleDeath already ran

    // Last line of defence for the lighting clock: whatever the animation did,
    // the sky must agree with the phase before the player is handed control.
    // A DAY that looks like night is worse than a snap.
    if (this.sky.driftFrom(Game3D.state.phase) > 0.3) {
      this.sky.setPhaseImmediate(Game3D.state.phase);
    }

    this.placeHunters(false);
    this.streamWorld(false);
    this.refreshTurn({ spatialNote: Game3D.spatialNote(result) });

    if (result.landmark) HUD.dismissHint();
    if (result.cornerCut > 0.4 && !Options.get('reduceMotion')) this.rig.shake(0.5);
  },

  handleDeath(state, result) {
    this.playing = false;
    this._anim = null;
    this.busy = false;
    HUD.setActionsEnabled(false);
    this.highlight.clear();

    // Let the collapse play before the words arrive.
    this._collapse = 0;
    const reduce = Options.get('reduceMotion');
    if (state.deathCause === 'caught') {
      this.band.setMode('pursuit');
      this.band.placeAt(this.jaguar.position.x, this.jaguar.position.y, this.jaguar.position.z + 9);
      this.band.setVisible(true);
      if (!reduce) this.rig.shake(1.1);
    }
    this._dying = true;
    setTimeout(() => {
      this._dying = false;
      HUD.hide();
      Screens.renderDeath(state, Game3D.spatialAchievements());
    }, reduce ? 500 : 2200);
    void result;
  },

  // ------------------------------------------------------------
  // Camera helpers & keys
  // ------------------------------------------------------------

  recenter() {
    if (!Game3D.state) return;
    const cell = Game3D.currentCell();
    const h = Game3D.hunterWorldPosition();
    // Put the band directly behind the lens, so "forward" is up the screen.
    this.rig.azimuth = Math.atan2(h.x - cell.worldX, h.z - cell.worldZ);
    this.rig.polar = window.CONFIG3D.camera.defaultPolar;
    this.rig._targetDistance = window.CONFIG3D.camera.defaultDistance;
    this.aimAt(cell.worldX, cell.height, cell.worldZ);
  },

  lookBack() {
    if (!Game3D.state) return;
    const h = Game3D.hunterWorldPosition();
    const cell = Game3D.currentCell();
    // Swing the camera round so the band is between you and the lens.
    this.rig.azimuth = Math.atan2(cell.worldX - h.x, cell.worldZ - h.z);
    this.rig.polar = 1.06;
    this.rig._targetDistance = Math.min(window.CONFIG3D.camera.maxDistance, 118);
    this.jaguar.lookAtWorld(h.x, h.z);
    setTimeout(() => this.jaguar.clearLook(), 2600);
  },

  openPause() {
    if (!this.playing) return;
    this.paused = true;
    Screens.show('screen-pause');
  },

  onKey(e) {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;

    if (e.code === 'Escape') {
      if (Screens.current === 'screen-pause') { Screens.hideAll(); this.paused = false; }
      else if (Screens.current === 'screen-howto' || Screens.current === 'screen-options') {
        Screens.show(Screens._returnTo);
        if (Screens._returnTo === 'screen-pause') return;
        this.paused = Screens.current === 'screen-pause';
      } else if (this.playing) this.openPause();
      return;
    }

    if (!this.playing || this.paused || Screens.current) return;

    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      if (HUD.skipTypewriter()) return;
      if (HUD.isMovePreviewOpen()) this.confirmMove();
      return;
    }
    if (e.code === 'KeyQ') { this.rig.rotateBy(-0.28); return; }
    if (e.code === 'KeyE') { this.rig.rotateBy(0.28); return; }
    if (e.code === 'KeyC') { this.recenter(); return; }
    if (e.code === 'KeyL') { this.lookBack(); return; }
    if (e.code === 'Equal' || e.code === 'NumpadAdd') { this.rig.zoomBy(0.88); return; }
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') { this.rig.zoomBy(1.12); return; }

    const digit = e.code.match(/^Digit([1-9])$/);
    if (digit && !this.busy) {
      const key = HUD.actionKeyAt(parseInt(digit[1], 10) - 1);
      if (key) { e.preventDefault(); this.takeAction(key); }
    }
  },

  // ------------------------------------------------------------
  // Frame loop
  // ------------------------------------------------------------

  startLoop() {
    this.running = true;
    this._last = performance.now();
    this._frames = 0;

    const step = (now) => {
      if (!this.running) return;
      const raw = Math.max(0, now - this._last);
      this._last = now;
      const dt = Math.min(0.05, raw / 1000);
      this.elapsed += dt;
      this._frames++;
      this.renderer.governFrame(raw);
      try {
        this.tick(dt);
      } catch (err) {
        // One bad frame must not kill the loop and freeze the game mid-turn.
        console.error('frame error', err);
        this._anim = null;
        this.busy = false;
        HUD.setActionsEnabled(true);
      }
      this.renderer.render();
    };

    this._useFallback = false;
    const raf = (now) => {
      if (!this.running) return;
      if (!this._useFallback) step(now);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);

    // Some environments (headless runners, backgrounded webviews, a few embedded
    // browsers) service requestAnimationFrame briefly and then stop. A one-shot
    // check would miss that, so watch continuously and switch to a timer the
    // moment frames stop arriving — otherwise the game freezes mid-turn.
    let seen = -1;
    this._watchdog = setInterval(() => {
      if (!this.running || this._useFallback) return;
      if (this._frames === seen) {
        this._useFallback = true;
        clearInterval(this._watchdog);
        this._last = performance.now();
        this._fallbackLoop = setInterval(() => step(performance.now()), 16);
        return;
      }
      seen = this._frames;
    }, 400);
  },

  stopLoop() {
    this.running = false;
    clearInterval(this._watchdog);
    clearInterval(this._fallbackLoop);
  },

  tick(dt) {
    if (this._anim) this.stepAnimation(dt);
    else if (this.playing) this.sky.update(dt, window.CONFIG3D.timing.phaseSweep);

    if (this._vista) {
      // Slow orbit over an untouched world while the title screen is up.
      this.rig.azimuth += dt * 0.028;
      this.sky.cycle = (this.sky.cycle + dt * 0.012) % 2;
      this.sky.apply();
    }

    if (this._dying) {
      this._collapse = Math.min(1, this._collapse + dt * 1.3);
      this.jaguar.setCollapse(this._collapse);
    }

    this.rig.update(dt);
    this.jaguar.update(dt, this.elapsed);
    this.band.update(dt, this.elapsed);
    this.markers.update(dt);
    this.highlight.update(dt);
    this.weather.update(dt, this.elapsed, this.rig.camera.position, this.sky);

    if (Game3D.state && this.playing) {
      const cell = Game3D.currentCell();
      this.sky.follow(this.jaguar.position.x, this.jaguar.position.z);
      if (!this._anim) this.aimAt(cell.worldX, cell.height, cell.worldZ);
    }
  },

  /**
   * Look slightly past the player, along the direction of flight. This lifts
   * the cat above the centre of the frame — out from behind the situation
   * panel — and shows more of the ground still to be chosen from.
   */
  aimAt(x, y, z) {
    const lead = window.CONFIG3D.camera.leadDistance;
    // "Ahead" is whichever way is directly away from the band.
    const h = Game3D.hunterWorldPosition();
    let dx = x - h.x;
    let dz = z - h.z;
    const len = Math.hypot(dx, dz);
    if (len > 0.001) { dx /= len; dz /= len; } else { dx = 0; dz = -1; }
    this.rig.setTarget(x + dx * lead, y + 3, z + dz * lead);
  }
};

/**
 * Yield to the browser so the loading bar can actually paint.
 * Deliberately timer-based rather than requestAnimationFrame: boot must
 * complete even where rAF is throttled or never serviced at all.
 */
function frame() {
  return new Promise(resolve => setTimeout(resolve, 24));
}

window.PrimalChase3D = App;
window.__HUD = HUD;
window.__Screens = Screens;

// Automated playtest harness, only ever loaded on demand.
if (new URLSearchParams(location.search).has('playtest')) {
  const s = document.createElement('script');
  s.src = 'test/playtest.js';
  document.head.appendChild(s);
}

App.boot().catch(err => {
  console.error('Boot failed', err);
  const el = document.getElementById('screen-unsupported');
  if (el) {
    const p = el.querySelector('p');
    if (p) p.textContent = 'Something went wrong starting the 3D chase: ' + (err && err.message || err);
    for (const s of document.querySelectorAll('.screen')) s.classList.remove('active');
    el.classList.add('active');
  }
});

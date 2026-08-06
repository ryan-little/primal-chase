// The game, assembled: sim + world + renderer + fog of war + HUD.
// One phase per decision; the camera lives behind the cat; you click the
// land inside your reach and the run plays out.

import {
  ACESFilmicToneMapping, PCFSoftShadowMap, PerspectiveCamera, Raycaster,
  Scene, SRGBColorSpace, Vector2, Vector3, WebGLRenderer
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import '../ui/style.css';
import { Game, type MovePreview, type TurnResult } from '../sim/game';
import type { NavNode } from '../world/nav';
import { TerrainChunks } from '../render/terrain';
import { Sky } from '../render/sky';
import { FogOfWar, attachFog } from '../render/fogwar';
import { Cat, HunterBand } from '../render/entities';
import { ReachOverlay } from '../render/overlay';
import { ReachField, REACH_DECLS, REACH_GLSL } from '../render/reachfield';
import { landmarkMaterials, vegetationMaterials } from '../render/vegetation';
import { Hud } from '../ui/hud';
import { Screens } from '../ui/screens';
import { Rain } from '../ui/rain';
import { scoreRun, submitScore } from '../sim/score';

const DAY_SUN = 0.55;
const NIGHT_SUN = -0.45;
const MOVE_SECONDS = 2.6;

declare global {
  interface Window {
    __READY?: boolean;
    __pc?: { game: Game; doFarthestMove: () => void; doAction: (k: string) => void };
  }
}

export function startGame(): void {
  const q = new URLSearchParams(location.search);
  const seed = Number(q.get('seed') ?? Math.floor(Math.random() * 1e9));

  // ---- renderer/scene ----
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('app')!.appendChild(renderer.domElement);
  document.getElementById('boot')?.remove();

  const scene = new Scene();
  const screens = new Screens();
  const game = new Game(seed, screens.options.difficulty);
  game.tutorial = screens.options.tutorial;
  const S = () => game.state;
  let mode: 'title' | 'intro' | 'playing' = q.get('test') === '1' ? 'playing' : 'title';

  const terrain = new TerrainChunks(game.biomes, 5);
  scene.add(terrain.group);
  const sky = new Sky(scene);
  const fog = new FogOfWar(game.biomes.field);
  const reachField = new ReachField();
  const reachInj = {
    uniforms: reachField.uniforms as unknown as Record<string, { value: unknown }>,
    decls: REACH_DECLS,
    glsl: REACH_GLSL
  };
  const waterTime = { value: 0 };
  const glintInj = {
    uniforms: { uWaterTime: waterTime },
    decls: 'uniform float uWaterTime;',
    glsl: /* glsl */`
      {
        float g1 = sin(vFowWorldPos.x * 0.115 + uWaterTime * 1.6)
                 * sin(vFowWorldPos.z * 0.131 - uWaterTime * 1.15);
        float g2 = sin(vFowWorldPos.x * 0.041 - uWaterTime * 0.7)
                 * sin(vFowWorldPos.z * 0.057 + uWaterTime * 0.9);
        float glint = pow(max(0.0, g1), 6.0) * 0.16 + pow(max(0.0, g2), 4.0) * 0.08;
        gl_FragColor.rgb += vec3(0.85, 0.93, 1.0) * glint;
      }`
  };
  attachFog(terrain.groundMaterial, fog, [reachInj]);
  attachFog(terrain.waterMaterial, fog, [reachInj, glintInj]);
  for (const m of vegetationMaterials) attachFog(m, fog);
  for (const m of landmarkMaterials) attachFog(m, fog);

  const cat = new Cat();
  const hunters = new HunterBand();
  const overlay = new ReachOverlay();
  scene.add(cat.group, hunters.group, overlay.mesh, overlay.pathLine);

  const hud = new Hud(() => game.rng.next());
  const rain = new Rain();

  // Quality tier: DPR, shadows, vegetation density, draw radius.
  {
    const opt = screens.options.quality;
    const isSmall = Math.min(window.innerWidth, window.innerHeight) < 760;
    const tier = opt === 'auto' ? (isSmall ? 'medium' : 'high') : opt;
    if (tier === 'low') {
      renderer.setPixelRatio(1);
      renderer.shadowMap.enabled = false;
      terrain.vegetationDensity = 0.45;
    } else if (tier === 'medium') {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      sky.sun.shadow.mapSize.set(1024, 1024);
      terrain.vegetationDensity = 0.75;
    }
  }

  const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 2, 60000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.maxPolarAngle = 1.38;
  controls.minDistance = 160;
  controls.maxDistance = 5200;
  controls.enableDamping = true;
  controls.enablePan = false;

  // ---- state ----
  let reachMap: Map<string, NavNode> | null = null;
  let pendingNode: NavNode | null = null;
  let pendingPreview: MovePreview | null = null;
  let busy = false;
  let sunTarget = DAY_SUN;
  let lastNote: string | null = null;
  let fogAnchor = { x: 0, z: 0 };
  let moveAnim: { pts: Vector3[]; t: number; node: NavNode } | null = null;

  const groundY = (x: number, z: number) => {
    const s = game.biomes.sample(x, z);
    return Math.max(s.height, s.waterSurface);
  };

  const placeCat = (x: number, z: number) => {
    cat.group.position.set(x, groundY(x, z), z);
  };

  const placeHunters = () => {
    const hp = game.hunterPosition();
    hunters.group.position.set(hp.x, groundY(hp.x, hp.z), hp.z);
    const toCat = Math.atan2(S().x - hp.x, S().z - hp.z);
    hunters.group.rotation.y = toCat;
    hunters.group.visible = fog.visibleAt(hp.x, hp.z);
  };

  const refreshFog = () => {
    const s = S();
    if (Math.hypot(s.x - fogAnchor.x, s.z - fogAnchor.z) > 7000) {
      fog.recenter(s.x, s.z);
      fogAnchor = { x: s.x, z: s.z };
    }
    fog.computeFrom(s.x, s.z, sunTarget);
  };

  const refreshHud = () => {
    const s = S();
    hud.setClock(s.day, s.phase);
    hud.setVitals(s);
    hud.setHunters(s);
    hud.setEscalation(s.hunters.state === 'pursuit' ? s.hunters.distance : 30, renderer.domElement);
    rain.target = s.encounter?.pressure?.special === 'storm' ? 1 : 0;
    hud.setProse(s.encounter?.text ?? '', s.monologue, lastNote);
    // Standard push/trot choices are V1-isms — on the map, movement IS the
    // push/trot decision, so only in-place verbs become buttons.
    hud.setActions((s.encounter?.actions ?? []).filter(
      (a) => !(a.isStandard && (a.key === 'push' || a.key === 'trot'))));
  };

  const showReach = () => {
    reachMap = game.reach();
    reachField.show(
      reachMap, S().x, S().z,
      game.config.movement.pushMiles, game.config.movement.trotMiles);
  };

  const spatialNote = (r: TurnResult): string | null => {
    if (r.riskText) return r.riskText;
    if (r.brokeTrail && r.trailBreakKind === 'ground') {
      const t = S().encounter?.terrain?.id ?? '';
      if (game.config.monologue.terrainCategories['water']!.includes(t)) {
        return 'The water takes your scent and gives nothing back. Behind you, the pursuit falters.';
      }
      return 'The ground here keeps your secret. Their certainty breaks.';
    }
    if (r.brokeTrail) return 'Behind you, the land closes like a door. They have lost the thread.';
    if (r.cornerCut > 0.4) return `They read the shape of your flight and cut across it. ${r.cornerCut} miles, gone for nothing.`;
    if (!r.chanceSucceeded) return 'The effort yields nothing. The land does not always provide.';
    return null;
  };

  const afterTurn = (r: TurnResult) => {
    lastNote = spatialNote(r);
    sunTarget = S().phase === 'day' ? DAY_SUN : NIGHT_SUN;
    terrain.focus(S().x, S().z);
    refreshFog();
    placeHunters();
    refreshHud();
    if (r.died && r.deathCause) {
      overlay.hide();
      reachField.hide();
      const run = scoreRun(S(), game.difficulty);
      const rank = submitScore(run);
      hud.showDeath(r.deathCause, S(), run.score, rank);
      busy = true;
      return;
    }
    showReach();
    hud.setBusy(false);
    busy = false;
  };

  // ---- input ----
  const ray = new Raycaster();
  const clickAt = (nx: number, ny: number) => {
    if (busy || !reachMap || mode !== 'playing') return;
    ray.setFromCamera(new Vector2(nx, ny), camera);
    const hits = ray.intersectObject(terrain.group, true);
    if (!hits.length) return;
    const p = hits[0]!.point;
    // Nearest reach node to the clicked point.
    let best: NavNode | null = null, bestD = 340;
    for (const n of reachMap.values()) {
      const d = Math.hypot(n.x - p.x, n.z - p.z);
      if (d < bestD) { bestD = d; best = n; }
    }
    if (!best || best.meters === 0) return;
    pendingNode = best;
    pendingPreview = game.previewMove(best, reachMap);
    overlay.showPath(game.nav.path(reachMap, best.ix + ',' + best.iz));
    hud.showPreview(pendingPreview);
  };

  renderer.domElement.addEventListener('click', (ev) => {
    clickAt((ev.clientX / window.innerWidth) * 2 - 1, -(ev.clientY / window.innerHeight) * 2 + 1);
  });

  const commitPending = () => {
    if (!pendingNode || !reachMap || busy) return;
    busy = true;
    hud.setBusy(true);
    hud.hidePreview();
    overlay.hide();
    reachField.hide();
    const path = game.nav.path(reachMap, pendingNode.ix + ',' + pendingNode.iz);
    moveAnim = {
      pts: path.map((n) => new Vector3(n.x, 0, n.z)),
      t: screens.options.reducedMotion ? MOVE_SECONDS : 0,
      node: pendingNode
    };
    pendingNode = null;
    pendingPreview = null;
  };

  hud.onConfirmMove = commitPending;
  hud.onCancelMove = () => {
    pendingNode = null; pendingPreview = null;
    overlay.hidePath();
    hud.hidePreview();
  };
  hud.onAction = (key) => {
    if (busy) return;
    busy = true;
    hud.setBusy(true);
    overlay.hide();
    reachField.hide();
    hud.hidePreview();
    const r = game.commitAction(key);
    if (r) afterTurn(r); else { busy = false; hud.setBusy(false); showReach(); }
  };
  const resetRun = (newSeed: number) => {
    hud.hideDeath();
    game.setDifficulty(screens.options.difficulty);
    game.tutorial = screens.options.tutorial;
    game.newGame(newSeed);
    lastNote = null;
    sunTarget = DAY_SUN;
    sky.elevation = DAY_SUN;
    placeCat(S().x, S().z);
    terrain.focus(S().x, S().z);
    fog.recenter(S().x, S().z);
    fogAnchor = { x: S().x, z: S().z };
    refreshFog();
    placeHunters();
    refreshHud();
    showReach();
    busy = false;
    hud.setBusy(false);
  };

  hud.onRestart = () => resetRun(seed + S().day * 7 + 1);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---- boot ----
  sky.elevation = DAY_SUN;
  placeCat(S().x, S().z);
  terrain.focus(S().x, S().z);
  fog.recenter(S().x, S().z);
  fogAnchor = { x: S().x, z: S().z };
  refreshFog();
  placeHunters();
  refreshHud();
  if (mode === 'playing') showReach();
  else {
    hud.setVisible(false);
    screens.show('title');
  }

  screens.onStart = () => {
    // Difficulty/tutorial may have changed on the options screen.
    if (screens.options.difficulty !== game.difficulty ||
        screens.options.tutorial !== game.tutorial) {
      resetRun(seed);
      hud.setVisible(false);
    }
    mode = 'intro';
    if (screens.options.reducedMotion || !screens.options.typewriter) {
      // Still show the intro, just without the slow burn.
    }
    screens.playIntro(seed);
  };
  screens.onIntroDone = () => {
    mode = 'playing';
    hud.setVisible(true);
    showReach();
    // Settle the camera behind the cat for play.
    camera.position.set(S().x + 430, groundY(S().x, S().z) + 640, S().z + 430);
  };

  // Keyboard: Enter confirms a pending move, Escape cancels, R rests.
  window.addEventListener('keydown', (ev) => {
    if (mode !== 'playing' || busy) return;
    if (ev.key === 'Enter' && pendingNode) commitPending();
    else if (ev.key === 'Escape') hud.onCancelMove && hud.onCancelMove();
    else if (ev.key === 'r' || ev.key === 'R') hud.onAction && hud.onAction('rest');
  });

  // Boot framing: stand the camera on the side with the LEAST visible ground
  // so the frame looks across the cat into the open sight pool.
  {
    let bestAz = 0.785, bestScore = Infinity;
    for (let a = 0; a < 12; a++) {
      const az = (a / 12) * Math.PI * 2;
      let score = 0;
      for (const r of [900, 1800, 2700]) {
        if (fog.visibleAt(S().x + Math.cos(az) * r, S().z + Math.sin(az) * r)) score++;
      }
      if (score < bestScore) { bestScore = score; bestAz = az; }
    }
    camera.position.set(
      S().x + Math.cos(bestAz) * 560,
      groundY(S().x, S().z) + 620,
      S().z + Math.sin(bestAz) * 560
    );
  }
  controls.target.copy(cat.group.position);

  // Test hooks for automated verification.
  if (q.get('test') === '1') {
    window.__pc = {
      game,
      doFarthestMove: () => {
        if (!reachMap) return;
        let far: NavNode | null = null, m = -1;
        for (const n of reachMap.values()) if (n.meters > m) { m = n.meters; far = n; }
        if (far) {
          pendingNode = far;
          commitPending();
          // Skip the animation for tests.
          if (moveAnim) { moveAnim.t = MOVE_SECONDS; }
        }
      },
      doAction: (k: string) => hud.onAction?.(k)
    };
  }

  // ---- frame loop ----
  let last = performance.now();
  let readyFrames = 0;
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    const chunksBusy = terrain.tick(2);

    // Sun eases toward the phase's elevation.
    if (Math.abs(sky.elevation - sunTarget) > 0.002) {
      sky.elevation += (sunTarget - sky.elevation) * Math.min(1, dt * 2.2);
    }

    // Move animation.
    let moving = false;
    if (moveAnim) {
      moving = true;
      moveAnim.t += dt;
      const k = Math.min(1, moveAnim.t / MOVE_SECONDS);
      const eased = k * k * (3 - 2 * k);
      const pts = moveAnim.pts;
      const fi = eased * (pts.length - 1);
      const i0 = Math.min(pts.length - 2, Math.floor(fi));
      const ft = fi - i0;
      const x = pts[i0]!.x + (pts[i0 + 1]!.x - pts[i0]!.x) * ft;
      const z = pts[i0]!.z + (pts[i0 + 1]!.z - pts[i0]!.z) * ft;
      placeCat(x, z);
      cat.group.rotation.y = Math.atan2(pts[i0 + 1]!.x - pts[i0]!.x, pts[i0 + 1]!.z - pts[i0]!.z);
      if (k >= 1) {
        const node = moveAnim.node;
        moveAnim = null;
        const r = game.commitMove(node, reachMap!);
        placeCat(S().x, S().z);
        afterTurn(r);
      }
    }

    waterTime.value = now * 0.001;
    rain.update(dt);
    cat.update(dt, moving);
    hunters.update(dt, S().phase === 'night');

    // Camera rides with the cat; on the title it drifts in a slow orbit.
    const catPos = cat.group.position;
    if (mode === 'title') {
      const t = now * 0.000045;
      camera.position.set(
        catPos.x + Math.cos(t) * 1500,
        catPos.y + 820,
        catPos.z + Math.sin(t) * 1500
      );
    }
    controls.target.lerp(new Vector3(catPos.x, catPos.y + 30, catPos.z), Math.min(1, dt * 4));
    controls.update();
    sky.apply(catPos);

    renderer.render(scene, camera);

    if (!chunksBusy && !moving) {
      if (++readyFrames === 6) window.__READY = true;
    } else readyFrames = 0;
  });
}

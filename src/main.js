import * as THREE from 'three';
import { LANES, SPAWN_Z, DESPAWN_Z, GATE_MIN_DIFF, GATE_CHANCE, GATE_CHANCE_RAMP, GATE_COOLDOWN, COMBO_WINDOW, comboMult, NEARMISS_MARGIN, NEARMISS_BONUS, SKIM_MARGIN, SKIM_BONUS, SKIM_WINDOW, SAFE_HAZARD_MIN_DIFF, SAFE_HAZARD_CHANCE, TALL_CLEAR_H, TALL_CLEAR_PER_JUMP, TALL_MIN_DIFF, TALL_CHANCE, ROLL_GRAB_H, AIR_ARC_MIN_DIFF, AIR_ARC_CHANCE, AIR_ARC_TALL_CHANCE, AIR_ARC_TALL_PEAK, AIR_MIN_H, AIR_BASE, AIR_POINTS, AIR_PEAK_CAP, JUMP_BUFFER, HITSTOP_SHIELD, HITSTOP_DEATH, SLOWMO_FACTOR, SLOWMO_TIME, SLOWMO_MIN_MULT, SLOWMO_TIGHT_MARGIN, SLOWMO_TIGHT_TIME, DIFF_RAMP, ROW_MIN_GAP, COMBO_DECAY_STEP, COMBO_STEP, SCORE_FLOW_RATE, HEAT_PER_LEVEL, HEAT_LEVEL_CAP, HEAT_MAX, PHOENIX_COMBO, PHOENIX_INVULN, GREED_CAP, RING_TIME, POWERUP_DURATION, POWERUP_CHANCE, POWERUP_MIN_DIFF, POWERUP_COOLDOWN, POWERUPS, POWERUP_KINDS, DASH_SPEED_MULT, DRAFT_EVERY, DRAFT_CHOICES, DRAFT_ARM, DRAFT_GRACE, mulberry32, dailyKey, dailySeed, $, buzz, shuffle } from './config.js';
import { makeGradient, toon, glow, glowTexture, shadowTexture, rampShadow, heroShadow } from './materials.js';
import { makeObstacle, makeHurdle, makeGate, makeRoll, makePowerup, makeScenery, makeCloud, makeFinishLine, makeCheerCrowd, tickCheerCrowd, OBSTACLE_KINDS } from './props.js';
import { createParticles } from './particles.js';
import { buildPlayer, applyGear, tickGear } from './player.js';
import { STAGE_BASE, STAGE_LEAD, stageLength, biomeOf, obstacleSet, scenerySet, biomePlay, biomeAir } from './levels.js';
import { trackOffset, deformRoad } from './track.js';
import { UPGRADES, effects, tierOf, nextCost, nextGate, buy, getWallet, addRolls, DEFAULT_POOL, unlockedPerkIds, META, buyMeta, foldUpgradeMods, setTier } from './upgrades.js';
import { PERKS, freshMods, applyPerks, perkById, draftChoices } from './perks.js';
import { save, getRerolls, useReroll, getBanishes, useBanish, banishPerk } from './save.js';
import { getBest, setBest, getStats, bumpStats, getHistory, pushHistory, resetSave, reload, requestPersistence, onExternalChange } from './save.js';
import { hasAch, unlock } from './save.js';
import { checkAchievements, rewardFor } from './achievements.js';
import { selectedSkin, selectSkin, getDailyBest, setDailyBest, getDailyStreak } from './save.js';
import { skinById, skinUnlocked, applySkin } from './cosmetics.js';
import { installDebug } from './debug.js';
import { configureHud, renderShop, renderStats, renderDaily, renderAchievements, renderCosmetics, renderHighlights, showAchUnlock, dismissAchUnlock, bindResetSave } from './hud.js';
import { bindControls } from './controls.js';
import {
  initAudio, ensureAudio, toggleSound, setIntensity, getIntensity,
  sfxLane, sfxJump, sfxDuck, sfxCoin, sfxCrash, sfxStart, sfxOver, sfxLevel, sfxShield, sfxComboBreak, sfxWhoosh, sfxFanfare, sfxFart, sfxPowerEnd,
} from './audio.js';

let scene, camera, renderer, clock;
let player, ears = [], feet = [], tail, particles, playerMats, gear, aura;
// World-dressing handles recolored per biome: hemisphere bounce light, the shared
// cloud material, the two parallax ridge silhouettes, the night-sky star field,
// the horizon glow band, the sun corona, and the hero's blob shadow.
let hemiLight, cloudMat, ridgeMats = [], starMat, horizonGlowMat, discCoronaMat, playerShadow;
let starCur = 0, starTgt = 0;   // star-field opacity tween (fades in on dark skies)
let gearTiers = {}, fartCount = 0;   // worn upgrade tiers (for visuals/tests) + fart-puff counter
let obstacles = [], rolls = [], pickups = [], scenery = [], stripes = [], clouds = [];
let groundMat, pathMat, discMat, discHaloMat, hillMats = [], roadGround, roadPath;
let fxRing, ringT = 0, camKick = 0;    // level-up shockwave ring + a one-shot camera FOV punch
let state = 'menu';
let speed, distance, rollCount, rollPoints, rowTimer, sceneAcc, dustAcc, elapsed, difficulty, safeLane, forcedGap;
// Stage window: where the current stage began + how long it runs (sized to speed
// when it starts). `finishLine` is the banner dropped at the tail; crossing it
// ends the stage. `finishArmed` gates the one-shot level-up on that crossing.
let stageStart = 0, stageLen = 0, finishLine = null, finishArmed = false;
let laneIdx, targetX, vy, grounded, jumpsLeft, banked, groundY, duckTimer, duckAmt, shakeT;
let jumpBufferT, laneChangeT;          // buffered-jump timer + time of the last lane change (for skims)
let airTimer, airPeak, usedDouble;     // time aloft + peak height + whether a double-jump was spent this hop (air-bonus)
let hitStopT, slowmoT, worldScale;     // hit-stop freeze / near-miss slow-mo timers + the live sim time-scale
let combo, comboTimer, comboMax, flowAcc, safeHazardCount;   // flowAcc: fractional combo-flow score; safeHazardCount: compound rows spawned
let peakSpeed, tightestGap;   // run maxima for the game-over highlight strip: top speed reached, closest clean dodge (margin beyond half-width)
let squash;   // signed squash-&-stretch impulse: + on landing, - on launch, decays to 0
let scoreHeat = 0;   // 0..1 — how "on fire" the score HUD is, eased from live pace + combo
let emoteT, spin;   // emoteT: brief happy-squish timer (rolls/near-miss). spin: remaining radians of a level-up cheer twirl.
// `simTime` is the animation clock (sum of per-frame dt). Driving it ourselves
// — rather than reading clock.elapsedTime — lets the debug bridge advance the
// sim with a fixed dt, so tests are deterministic instead of wall-clock bound.
// `paused` freezes the rAF loop for deterministic stepping. Declared up here so
// they're initialised before the top-level animate() call (avoids a TDZ throw).
let simTime = 0, paused = false;
// When stepping the sim deterministically (debug bridge), skip the per-frame
// WebGL render: feature tests only read state JSON, and software-WebGL renders
// cost ~70ms each — they were the whole bottleneck. step() renders once at the
// end instead, so a screenshot after stepping still shows the final frame.
let skipRender = false;
// Respect the OS "reduce motion" preference for the in-canvas juice (slow-mo,
// hit-stop) the way the CSS already does for DOM animations.
let reduceMotion = false;
let power, powerT, powerCD, gotPower;   // active power-up kind, remaining time, spawn cooldown (rows), grabbed-any flag
let auraSparkT = 0;                      // throttle for the active-power-up sparkle drift
let rng = Math.random, daily = false, dailyDay = '';   // daily challenge: seeded RNG + today's key
const speedLines = $('speedlines');
// Level + upgrade run state (set from the save at each run start).
let level, shields, invuln, magnetR, rollValue, extraJumps;
// Phoenix comeback: `phoenix` is an armed save (earned at a hot combo); once spent
// `phoenixUsed` blocks re-arming, so it's strictly once per run.
let phoenix = false, phoenixUsed = false;
let lastRowGap = 0;   // the most recent computed seconds-between-rows (surfaced for tests)
// The last run's game-over framing (best / so-close / wipe), surfaced to the debug
// bridge so the "one more run" messaging is deterministically testable.
let lastRun = null;
// Roguelite draft: perks[] picked this run ({id,stacks}); mods derives the run
// modifiers from them; levelUps counts level-up events to time the every-2nd draft.
let perks = [], mods = freshMods(), levelUps = 0, draftCards = [], draftArm = 0;

// Biome colour tween state — current values lerp toward the target each frame.
// `sky` is the top stop of the CSS sky gradient, parsed so the hemisphere light
// and cloud tint can agree with the biome's actual sky instead of a fixed hue.
const bCur = { fog: new THREE.Color(), ground: new THREE.Color(), path: new THREE.Color(), disc: new THREE.Color(), sky: new THREE.Color(), hills: [new THREE.Color(), new THREE.Color(), new THREE.Color()] };
const bTgt = { fog: new THREE.Color(), ground: new THREE.Color(), path: new THREE.Color(), disc: new THREE.Color(), sky: new THREE.Color(), hills: [new THREE.Color(), new THREE.Color(), new THREE.Color()] };
// Scratch colours for the per-frame derived recolours (no per-frame allocation).
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
// Fog band (sight distance) tweens too, so a biome's "air" eases in like its colours.
const fogCur = { near: 40, far: 72 }, fogTgt = { near: 40, far: 72 };

// Let the audio scheduler read the live game state.
initAudio(() => state);

safeInit();
animate();

// Start up against the stored save, but never let a corrupt save — or a transient
// init hiccup — leave a dead page. A throw in init() does NOT mean the save is
// bad: load() (save.js) has already coerced types and clamped values, so most
// failures are unrelated (a WebGL/context blip, an audio init throw). So retry
// once on the SAME save first; only if it *still* throws do we treat the save as
// the culprit and reset. This keeps a one-off crash from nuking good progress —
// the old "wipe on any throw" was a silent save-killer.
function safeInit() {
  try {
    init();
  } catch (e) {
    console.warn('Cheeky Run: init failed — retrying once without touching the save', e);
    try { $('game').replaceChildren(); } catch { /* ignore */ }   // drop a half-built canvas before re-init
    try {
      init();
    } catch (e2) {
      console.warn('Cheeky Run: init failed again — resetting save to defaults as a last resort', e2);
      try { resetSave(); } catch { /* ignore */ }
      try { $('game').replaceChildren(); } catch { /* ignore */ }
      init();
    }
  }
}

// Bake a per-vertex "lane" ambient occlusion into a plane geometry: the outer
// (shoulder) columns are darkened so the running lane reads as a worn central
// strip instead of one flat gradient. Multiplies the biome path colour via
// vertexColors, so it's biome-independent. Half-width is the plane's x extent.
function bakeLaneAO(geo) {
  const pos = geo.attributes.position, n = pos.count, col = new Float32Array(n * 3);
  let halfW = 0.001; for (let i = 0; i < n; i++) halfW = Math.max(halfW, Math.abs(pos.getX(i)));
  for (let i = 0; i < n; i++) {
    const t = Math.abs(pos.getX(i)) / halfW;            // 0 centre -> 1 shoulder
    const f = 1.0 - 0.34 * Math.pow(t, 1.4);            // no centre blow-out, firmly worn edges
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = f;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

// Bake soft per-vertex mottling into the wide ground plane so it reads as
// organic terrain instead of a flat vinyl sheet. Deterministic layered sines
// (no RNG) multiply the biome ground colour via vertexColors — free at render.
function bakeGroundMottle(geo) {
  const pos = geo.attributes.position, n = pos.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const f = 1 + 0.05 * Math.sin(x * 0.31 + y * 0.11) * Math.sin(y * 0.23 - x * 0.07)
                + 0.03 * Math.sin(x * 0.83 + y * 0.41);
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = f;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

// A low-poly ridge silhouette for the far horizon: a jagged skyline strip built
// from layered sines (deterministic per seed). Fog-exempt so it reads as a crisp
// paper-cut backdrop above the fog band — the depth layer the flat horizon lacked.
function makeRidge(width, peak, seed) {
  const steps = 26, shape = new THREE.Shape();
  shape.moveTo(-width / 2, -3);
  for (let i = 0; i <= steps; i++) {
    const x = -width / 2 + (i / steps) * width;
    const h = peak * (0.42 + 0.30 * Math.sin(i * 1.7 + seed) + 0.18 * Math.sin(i * 0.62 + seed * 2.3) + 0.10 * Math.sin(i * 3.1 + seed * 0.7));
    shape.lineTo(x, Math.max(0.4, h));
  }
  shape.lineTo(width / 2, -3);
  const m = new THREE.MeshBasicMaterial({ fog: false });
  return new THREE.Mesh(new THREE.ShapeGeometry(shape), m);
}

/* ---------------- setup ---------------- */
function init() {
  const mm = matchMedia('(prefers-reduced-motion: reduce)');
  reduceMotion = mm.matches; mm.addEventListener?.('change', e => { reduceMotion = e.matches; });
  // Ask for durable (non-evictable) storage on the first real interaction — that's
  // when a browser is most willing to grant it. Guards itself, so firing on both is fine.
  const askPersist = () => requestPersistence();
  addEventListener('pointerdown', askPersist, { once: true });
  addEventListener('keydown', askPersist, { once: true });
  // Reconcile when another tab saves, so two tabs don't clobber each other's progress.
  onExternalChange(() => { refreshHud(); renderShop(); });
  makeGradient();
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffe1d6, 40, 72);

  camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 220);
  camera.position.set(0, 5.4, 9.4); camera.lookAt(0, 1.2, -8);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  // No shadow maps: every prop grounds itself with a stylised contact-shadow
  // decal instead (props.js) — cleaner toon read than PCF smudges, and a big
  // mobile win (no depth pass over ~40 casters). The hero gets its own blob below.
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.NoToneMapping;     // flat colors -> crisper bands
  $('game').appendChild(renderer.domElement);

  // A real key-to-fill ratio so the cel bands actually land on the hero: less
  // hemisphere wash, a stronger lower-slung key so a shadow side exists. The
  // hemisphere tints per biome (writeBiome) so lighting agrees with the sky.
  // Total irradiance on an upward face is held near 1.0 — any higher and every
  // pale albedo clips to white (the old wash-out), killing saturation and bands.
  hemiLight = new THREE.HemisphereLight(0xdff0ff, 0xffd6b0, 0.32);
  scene.add(hemiLight);
  const sun = new THREE.DirectionalLight(0xfff0dc, 0.85);
  sun.position.set(6, 10, 7); scene.add(sun);

  // Warm back/rim light from behind the play area — no shadow map. It kisses the
  // top/far edge of the hero and forward-facing hazards so their silhouettes lift
  // off similarly-valued biomes (peachy hero on pale twilight road, props on snow).
  // Warm, not cool: a cool rim vanishes on a cool biome. Angled ~20° off dead
  // centre so it catches one ear edge and the tail rather than flattening evenly.
  const rim = new THREE.DirectionalLight(0xfff2e6, 0.45);
  rim.position.set(-7, 9, -15); scene.add(rim);

  discMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, fog: false });   // fog:false so the sun/moon stays a bright disc at the foggy horizon, not a dark bruise
  const disc = new THREE.Mesh(new THREE.SphereGeometry(3.4, 24, 24), discMat);
  disc.position.set(-15, 17, -46); scene.add(disc);
  // A two-layer halo behind the sun/moon disc so it reads as a light source with
  // gradual falloff: a small hot core plus a much wider, fainter corona — instead
  // of one giant additive sprite that used to blow out the whole spawn horizon.
  // Both recoloured per biome alongside discMat (see writeBiome) and fog-exempt.
  const discHalo = glow(0xfff2b0, 6.5, 0.8);
  discHalo.material.fog = false;
  discHalo.position.copy(disc.position); discHalo.position.z -= 1; scene.add(discHalo);
  discHaloMat = discHalo.material;
  const corona = glow(0xfff2b0, 15, 0.16);
  corona.material.fog = false;
  corona.position.copy(disc.position); corona.position.z -= 1.5; scene.add(corona);
  discCoronaMat = corona.material;

  // Parallax ridge silhouettes: a darker far skyline and a lighter near one, both
  // fog-exempt paper-cut layers that give the horizon actual depth. Recoloured
  // per biome from the live hill/fog palette (writeBiome).
  const ridgeFar = makeRidge(170, 8.5, 3.7); ridgeFar.position.set(0, -0.5, -76); scene.add(ridgeFar);
  const ridgeNear = makeRidge(150, 5, 9.2); ridgeNear.position.set(-6, -0.6, -68); scene.add(ridgeNear);
  ridgeMats = [ridgeFar.material, ridgeNear.material];

  // A soft additive glow band lying on the horizon line, blending the fogged
  // ground into the CSS sky instead of meeting it at a hard seam.
  const hg = new THREE.Mesh(new THREE.PlaneGeometry(200, 10),
    new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xfff2b0, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  hg.position.set(0, 1.2, -66); scene.add(hg);
  horizonGlowMat = hg.material;

  // Night-sky stars: a fog-exempt point cloud high above the horizon that fades
  // in when a biome's sky goes dark (Twilight, Ember) and out again by day.
  {
    const rand = mulberry32(42), n = 90, posArr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      posArr[i * 3] = (rand() - 0.5) * 150;
      posArr[i * 3 + 1] = 9 + rand() * 34;
      posArr[i * 3 + 2] = -82;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    starMat = new THREE.PointsMaterial({ map: glowTexture(), color: 0xfff8e0, size: 1.1, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    scene.add(new THREE.Points(geo, starMat));
  }

  [[-9, 0x8fd16f], [3, 0x79c283], [12, 0x9bd778]].forEach(([x, c], i) => {
    const hm = toon(c); hillMats.push(hm);
    const hill = new THREE.Mesh(new THREE.SphereGeometry(10 + i * 2, 20, 16), hm);
    hill.position.set(x, -6, -52 - i * 3); hill.scale.set(1.6, 0.7, 1); scene.add(hill);
  });

  // Lengthwise segments give the ground/path enough vertices to bend and roll
  // along the track (deformRoad rewrites them each frame). base = pristine verts.
  groundMat = toon(0x95df7d); groundMat.vertexColors = true;   // mottled terrain, not a vinyl sheet
  const groundGeo = new THREE.PlaneGeometry(60, 220, 12, 64);
  bakeGroundMottle(groundGeo);
  roadGround = new THREE.Mesh(groundGeo, groundMat);
  roadGround.rotation.x = -Math.PI / 2; roadGround.position.z = -50;
  roadGround.userData.base = groundGeo.attributes.position.array.slice(); scene.add(roadGround);
  pathMat = toon(0xe7c49c); pathMat.vertexColors = true;   // shoulders darken -> a defined running lane, not a flat ramp
  const pathGeo = new THREE.PlaneGeometry(7.4, 220, 4, 120);
  bakeLaneAO(pathGeo);
  roadPath = new THREE.Mesh(pathGeo, pathMat);
  roadPath.rotation.x = -Math.PI / 2; roadPath.position.set(0, 0.01, -50);
  roadPath.userData.base = pathGeo.attributes.position.array.slice(); scene.add(roadPath);

  const dashGeo = new THREE.PlaneGeometry(0.2, 1.7);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xfff4e6, transparent: true, opacity: .65 });
  for (let i = 0; i < 26; i++) [-1.15, 1.15].forEach(x => {
    const d = new THREE.Mesh(dashGeo, dashMat); d.rotation.x = -Math.PI / 2; d.position.set(x, 0.02, -i * 3); d.userData.bx = x; scene.add(d); stripes.push(d);
  });

  cloudMat = toon(0xffffff);   // shared so every puff tints with the biome sky
  for (let i = 0; i < 8; i++) { const c = makeCloud(cloudMat); scene.add(c); clouds.push(c); }

  particles = createParticles(scene);
  ({ player, ears, feet, tail, gear, aura, mats: playerMats } = buildPlayer(scene));
  applySkin(playerMats, selectedSkin());

  // The hero's blob shadow: a crisp height-reactive decal that shrinks and fades
  // as the character rises — the grounding cue a PCF smudge never gave the star.
  playerShadow = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.3),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), color: 0x3a2a38, transparent: true, opacity: 0.2, depthWrite: false }));
  playerShadow.rotation.x = -Math.PI / 2; playerShadow.position.y = 0.035; playerShadow.renderOrder = -1;
  scene.add(playerShadow);

  // Level-up shockwave: a flat ring that bursts outward from the player and fades.
  // Additive so it reads as a flash of light, not a solid disc. Hidden until fired.
  fxRing = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.72, 40),
    new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  fxRing.rotation.x = -Math.PI / 2; fxRing.position.y = 0.04; fxRing.visible = false; scene.add(fxRing);

  clock = new THREE.Clock(); resetGame();
  addEventListener('resize', onResize);
  bindControls({
    canvas: renderer.domElement, getState: () => state, ensureAudio,
    moveLane, jump, duck, startGame, togglePause, pickDraft, rerollDraft,
  });
  $('startBtn').onclick = () => startGame(false);
  $('againBtn').onclick = () => startGame(daily);     // "Again!" replays the same mode
  $('unlockBtn').onclick = dismissAchUnlock;          // tap-to-continue past the unlock fanfare
  $('dailyBtn').onclick = () => startGame(true);
  $('muteBtn').onclick = toggleSound;
  $('pauseBtn').onclick = () => { ensureAudio(); togglePause(); };
  $('pauseResume').onclick = resumeGame;
  $('pause').onclick = (e) => { if (e.target === $('pause')) resumeGame(); };   // tap the scrim to resume
  // Upgrades + skins live behind one flashy shop button (menu and game-over both
  // open the same modal) instead of cluttering the cards with two more panels.
  document.querySelectorAll('.shopOpenBtn').forEach(b => {
    b.onclick = () => { ensureAudio(); sfxLane(); buzz(12); $('shopModal').classList.remove('hide'); };
  });
  $('shopClose').onclick = () => { buzz(8); $('shopModal').classList.add('hide'); };
  $('shopModal').onclick = (e) => { if (e.target === $('shopModal')) $('shopModal').classList.add('hide'); };
  // Auto-pause when the tab is hidden or the window loses focus, so a run never
  // keeps ticking (or dumps you back mid-hazard) while you're looking elsewhere.
  addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
  addEventListener('blur', pauseGame);
  configureHud({ playerMats, getReduceMotion: () => reduceMotion });
  bindResetSave();
  renderShop(); renderStats(); renderAchievements(); renderCosmetics(); renderDaily();
  installDebug(buildDebugApi);
}

/* ---------------- spawning ---------------- */
function spawnRow() {
  const d = difficulty;
  // `heat` is difficulty that keeps creeping past the 70s cap with the level, so a
  // deep run grows *denser and trickier*, not just faster. At level 1 in the Meadow
  // heat === difficulty and the biome biases are all 1, so the warm-up is unchanged.
  const heat = Math.min(HEAT_MAX, d + Math.min(HEAT_LEVEL_CAP, (level - 1) * HEAT_PER_LEVEL));
  const bp = biomePlay(level);   // per-biome spawn character (more gates here, denser rolls there)
  // FULL-WIDTH GATE: every lane is blocked, so the only way through is the right
  // action — jump a low hurdle or slide under a high bar. Side-stepping can't
  // dodge it. Phases in after the warm-up, ramps with heat, and is spaced
  // out by forcedGap so two gates never stack into something unfair.
  if (forcedGap > 0) {
    forcedGap--;
  } else if (heat > GATE_MIN_DIFF && rng() < (GATE_CHANCE + GATE_CHANCE_RAMP * heat) * bp.gateBias) {
    spawnGate(); forcedGap = GATE_COOLDOWN; return;
  }

  // CORRIDOR: one lane is always guaranteed open, and it only shifts by <=1
  // lane per row, so a single lane-change always keeps you safe. Calmer early.
  let nextSafe;
  if (rng() < (0.6 - 0.35 * Math.min(1, heat))) { nextSafe = safeLane; }
  else { const nb = [safeLane - 1, safeLane + 1].filter(l => l >= 0 && l <= 2); nextSafe = nb[(rng() * nb.length) | 0]; }

  // block 1 lane (easy) or sometimes 2 (later) — never the safe lane, never all 3
  const p2 = Math.max(0, (heat - 0.2)) * 0.7 * mods.obstacleMult;   // heat + perks crank the danger
  const blockCount = (rng() < p2) ? 2 : 1;
  const others = [0, 1, 2].filter(l => l !== nextSafe); shuffle(others, rng);
  const blocked = others.slice(0, blockCount);

  // each biome draws from its own roster; the duck bar phases in after warm-up
  const theme = obstacleSet(level);
  const kinds = heat < 0.28 ? theme.jump : [...theme.jump, theme.duck];
  let tallUsed = false, tallLane = -1;   // at most one tall obstacle per row, so a row never reads as a wall of pillars
  blocked.forEach(li => {
    // Once warmed up, a blocked jump obstacle can be TALL — clearable only by a
    // well-timed double-jump. makeObstacle ignores `tall` on duck kinds, so this
    // never turns a slide-under bar into something unfair.
    const tall = !tallUsed && heat > TALL_MIN_DIFF && rng() < Math.min(0.5, TALL_CHANCE * heat);
    const o = makeObstacle(kinds[(rng() * kinds.length) | 0], tall);
    if (o.userData.tall) { o.userData.clearH += extraJumps * TALL_CLEAR_PER_JUMP; tallUsed = true; tallLane = li; }
    o.position.set(LANES[li], 0, SPAWN_Z); o.userData.lane = li; o.userData.lx = LANES[li]; scene.add(o); obstacles.push(o);
  });

  // COMPOUND ROW: once there's heat, the open lane sometimes also holds a
  // jumpable/duckable hazard — so reaching safety needs a lane-change AND a clear
  // in the same beat. Still fair (one move + one action); telegraphed like any row.
  // ...but never on a row still inside a gate's cooldown (forcedGap counting
  // down), so a full-width gate's jump/duck recovery is never immediately stacked
  // onto a same-beat lane-change-and-clear — that back-to-back demand reads unfair.
  let safeHazard = false;
  if (forcedGap === 0 && heat > SAFE_HAZARD_MIN_DIFF && rng() < SAFE_HAZARD_CHANCE * heat * bp.hazardBias) {
    const h = makeObstacle(kinds[(rng() * kinds.length) | 0]);
    h.position.set(LANES[nextSafe], 0, SPAWN_Z); h.userData.lane = nextSafe; h.userData.lx = LANES[nextSafe]; scene.add(h); obstacles.push(h);
    safeHazard = true; safeHazardCount++;
  }

  // rolls only ever sit in open lanes (perks/biome can make them denser); skip the
  // safe lane when it's carrying a compound hazard so a roll never overlaps it.
  const open = [nextSafe, ...others.slice(blockCount)];
  open.forEach(li => {
    if (li === nextSafe && safeHazard) return;
    const chance = (li === nextSafe ? 0.4 : 0.5) * mods.rollSpawnMult * bp.rollBias;
    if (rng() < chance) { const r = makeRoll(); r.position.set(LANES[li], 0.95, SPAWN_Z); r.userData.lx = LANES[li]; scene.add(r); rolls.push(r); }
  });

  // Risky ribbon: a tall wall can carry an air arc peaking right over it, so the
  // reward is scooped on the same double-jump that clears the wall — the treasure
  // rides the risk instead of sitting safely in the open lane next door.
  if (tallLane >= 0 && rng() < AIR_ARC_TALL_CHANCE) {
    spawnAirArc(tallLane, AIR_ARC_TALL_PEAK);
  }
  // ...and, less often, a low ribbon arcing over an open lane — a gentle treat you
  // earn with a single hop.
  else if (heat > AIR_ARC_MIN_DIFF && rng() < AIR_ARC_CHANCE) {
    const lanes = open.filter(li => !(li === nextSafe && safeHazard));
    if (lanes.length) spawnAirArc(lanes[(rng() * lanes.length) | 0]);
  }

  // a rare power-up gem, spaced out by a cooldown so it feels like a treat
  if (powerCD > 0) powerCD--;
  else if (difficulty > POWERUP_MIN_DIFF && rng() < POWERUP_CHANCE) {
    const li = open[(rng() * open.length) | 0];
    const kind = POWERUP_KINDS[(rng() * POWERUP_KINDS.length) | 0];
    const p = makePowerup(POWERUPS[kind].color); p.position.set(LANES[li], 1.0, SPAWN_Z); p.userData.kind = kind; p.userData.lx = LANES[li];
    scene.add(p); pickups.push(p); powerCD = POWERUP_COOLDOWN;
  }

  safeLane = nextSafe;
}
function spawnGate() {
  // 50/50 slide-under vs jump-over; spans all lanes (halfW covers every lane).
  const slide = rng() < 0.5;
  const o = slide ? makeGate() : makeHurdle();
  o.position.set(0, 0, SPAWN_Z); o.userData.halfW = 3.3; o.userData.lx = 0; scene.add(o); obstacles.push(o);
  // A reward roll in a random lane for clearing it cleanly.
  if (rng() < 0.7) { const li = (rng() * 3) | 0; const r = makeRoll(); r.position.set(LANES[li], 0.95, SPAWN_Z); r.userData.lx = LANES[li]; scene.add(r); rolls.push(r); }
}
// An air ribbon: a short arch of elevated rolls tracing a jump trajectory down
// one lane. Pure bonus — you scoop it by being airborne at each one's height, so
// it's a reason to jump. `peak` sets the top float height: a low arc rides a
// single hop, a high one (over a tall wall) demands the same risky double-jump.
function spawnAirArc(lane, peak = 1.7) {
  const arc = [0.47, 0.82, 1, 0.82, 0.47];   // normalized arch, scaled to `peak`
  arc.forEach((s, i) => {
    const r = makeRoll();
    r.userData.h = +(peak * s).toFixed(2); r.userData.lx = LANES[lane];
    r.position.set(LANES[lane], 0.95 + r.userData.h, SPAWN_Z - (i - 2) * 1.6);   // centre the arch on the spawn horizon
    scene.add(r); rolls.push(r);
  });
}
// Dress the shoulders in small clusters — 1–2 props with jittered depth, spread
// and scale, occasionally on both verges at once — so the roadside reads as a
// continuously dressed place instead of one lonely prop every few seconds.
function spawnScenery() {
  const roster = scenerySet(level);                       // this stage's own flora
  const sides = Math.random() < 0.3 ? [-1, 1] : [Math.random() < 0.5 ? -1 : 1];
  sides.forEach(side => {
    const n = 1 + (Math.random() * 2 | 0);
    for (let i = 0; i < n; i++) {
      const x = side * (4.4 + Math.random() * 4.2);
      const o = makeScenery(roster[(Math.random() * roster.length) | 0]);
      o.position.set(x, 0, SPAWN_Z - Math.random() * 6); o.rotation.y = Math.random() * Math.PI;
      o.scale.setScalar(0.75 + Math.random() * 0.5);
      o.userData.lx = x; scene.add(o); scenery.push(o);
    }
  });
}

/* ---------------- perks (roguelite draft) ---------------- */
// Re-derive the run modifiers from the perks picked so far. perks[] is the source
// of truth; mods is a pure fold of it, so stacking is just stacks++ then recompute.
// Run mods = drafted perks, then permanent upgrade contributions folded on top
// (skipped in a daily, which runs meta-free so everyone competes evenly).
function recomputeRunMods() { mods = applyPerks(perks); if (!daily) foldUpgradeMods(mods); }
// Which drafted perk wears which cosmetic prop. The magnet/spring/clover used to
// be permanent upgrades; they're perks now, so the gear follows the live draft.
const PERK_GEAR = { vacuum: 'magnet', hops: 'spring', lucky: 'fortune' };
// Worn props = the permanent upgrades you own (Cushion, Head Start; none in a
// daily — it's gear-free) plus the per-run perks that map onto a prop, sized by
// stacks. Rebuilt whenever ownership or the draft changes.
function wornGear() {
  const t = {};
  // Owned shop upgrades wear a prop keyed by their own id (its file in
  // src/upgrades/<id>.js), sized by owned tier — including the core Cushion and
  // Head Start. Skipped in a daily (meta-free). The Cushion is a liveGear prop,
  // so applyGear ignores this entry and the live shield count drives it instead.
  if (!daily) for (const u of UPGRADES) { const l = tierOf(u.id); if (l) t[u.id] = l; }
  // Drafted perks each wear a prop: the legacy three map onto magnet/spring/
  // clover (PERK_GEAR); every other perk keys onto its own id (its file in
  // src/perkgear/<id>.js). Sized by stack count.
  for (const p of perks) { const g = PERK_GEAR[p.id] || p.id; t[g] = p.stacks; }
  return t;
}
function refreshGear() { gearTiers = wornGear(); applyGear(gear, gearTiers); }
// Combo multiplier for the live run, including any Hot Streak ceiling bump.
const cmult = (c) => comboMult(c, mods.comboCeil);
// Add one stack of a perk to this run. Shield grants are a one-shot (applied here,
// not in recompute) so a shield spent mid-run isn't refunded by the next pick.
function applyPerk(id) {
  const def = perkById(id); if (!def) return false;
  const cur = perks.find(p => p.id === id);
  if (cur) { if (cur.stacks >= def.stack) return false; cur.stacks++; }
  else perks.push({ id, stacks: 1 });
  if (def.shieldGrant) { shields += def.shieldGrant; updateShieldHud(); }
  recomputeRunMods(); renderPerkTray(); refreshGear();
  return true;
}
// The run's drafted perks as a little icon strip on the HUD (stacks show a count).
function renderPerkTray() {
  const box = $('perktray');
  if (!perks.length) { box.classList.add('hide'); box.innerHTML = ''; return; }
  box.classList.remove('hide');
  box.innerHTML = perks.map(p => { const d = perkById(p.id);
    return `<span class="ptk ${d.rarity}" title="${d.name}">${d.icon}${p.stacks > 1 ? `<b>${p.stacks}</b>` : ''}</span>`; }).join('');
}
// Which perks a draft can offer. A daily run uses the fixed DEFAULT_POOL (so
// everyone sees the same seeded choices); a normal run uses the meta-unlocked
// pool. unlockedPerkIds() already drops permanently-banished perks.
function eligiblePool() { return daily ? DEFAULT_POOL : unlockedPerkIds(); }
// Freeze the world and offer a choice of perks. Uses the run's seeded `rng` so a
// draft is deterministic in tests. Skips itself if there's nothing left to offer.
function openDraft() {
  draftCards = draftChoices(eligiblePool(), perks, [], rng, DRAFT_CHOICES);
  if (!draftCards.length) return;
  // Lock the cards briefly so the input the player was mid-pressing (a jump or
  // lane swap) can't land as an accidental pick the instant the draft appears.
  draftArm = DRAFT_ARM;
  state = 'draft'; renderDraft(); $('draft').classList.remove('hide'); $('draft').classList.add('arming'); sfxLevel();
}
function pickDraft(i) {
  if (draftArm > 0) { buzz(8); return; }   // cards still locked — ignore the stray input
  const card = draftCards[i]; if (!card) return;
  applyPerk(card.id); showBanner(`${card.icon} ${card.name}!`); sfxCoin(); buzz(18);
  draftCards = []; $('draft').classList.add('hide'); $('draft').classList.remove('arming');
  // A grace window on resume: the road was frozen, so give the player a moment to
  // read it and dodge before collisions re-arm (reuses the shield-style invuln).
  invuln = Math.max(invuln, DRAFT_GRACE);
  state = 'playing'; clock.getDelta();   // drop the wall-clock gap so dt doesn't spike on resume
}
// Reroll the offered cards (spends a banked reroll charge).
function rerollDraft() {
  if (state !== 'draft' || draftArm > 0 || !useReroll()) { buzz(25); return; }
  draftCards = draftChoices(eligiblePool(), perks, [], rng, DRAFT_CHOICES);
  renderDraft(); sfxLane(); buzz(12);
}
// Banish a card's perk from the pool for good (spends a banish token), then refill.
function banishCard(i) {
  const card = draftCards[i]; if (!card || state !== 'draft' || draftArm > 0) return;
  if (!useBanish()) { buzz(25); return; }
  banishPerk(card.id); sfxComboBreak();
  draftCards = draftChoices(eligiblePool(), perks, [], rng, DRAFT_CHOICES);
  renderDraft();
}
// A curse's blurb reads "<upside>, but <downside>" / "<upside> — <downside>";
// split it so the draft can paint the promise green and the price red.
function splitCurse(desc) {
  const m = desc.match(/^(.*?)(?:, but | — )(.*)$/);
  return m ? { up: m[1], down: m[2] } : null;
}
function renderDraft() {
  const canBanish = getBanishes() > 0;
  $('draftgrid').innerHTML = draftCards.map((p, i) => {
    const sc = p.rarity === 'curse' ? splitCurse(p.desc) : null;
    const desc = sc ? `<span class="pk-up">${sc.up}</span><span class="pk-down">${sc.down}</span>`
                    : `<span class="pk-desc">${p.desc}</span>`;
    const warn = p.rarity === 'curse' ? '<span class="pk-warn">💀</span>' : '';
    const ban = canBanish ? `<span class="pk-banish" data-ban="${i}" title="Banish from pool">🚫</span>` : '';
    return `
    <button class="perkcard ${p.rarity}" data-i="${i}">
      <span class="pk-key">${i + 1}</span>${warn}${ban}
      <span class="pk-disc"><span class="pk-icon">${p.icon}</span></span>
      <span class="pk-name">${p.name}</span>${desc}
      <span class="pk-rar">${p.rarity}</span>
    </button>`;
  }).join('');
  document.querySelectorAll('#draft .perkcard').forEach(b => {
    b.onclick = (e) => { e.stopPropagation(); ensureAudio(); pickDraft(+b.dataset.i); };
  });
  document.querySelectorAll('#draft .pk-banish').forEach(b => {
    b.onclick = (e) => { e.stopPropagation(); ensureAudio(); banishCard(+b.dataset.ban); };
  });
  const rr = getRerolls();
  $('draftfoot').innerHTML = (rr > 0 ? `<button class="rerollbtn" id="rerollBtn">🎲 Reroll (${rr})</button>` : '')
    + `<span class="drafthint">Tap a card · 1 / 2 / 3</span>`;
  if (rr > 0) $('rerollBtn').onclick = (e) => { e.stopPropagation(); ensureAudio(); rerollDraft(); };
}

/* ---------------- flow ---------------- */
function resetGame() {
  [...obstacles, ...rolls, ...pickups, ...scenery].forEach(o => scene.remove(o));
  obstacles = []; rolls = []; pickups = []; scenery = [];
  if (finishLine) { scene.remove(finishLine); finishLine = null; } finishArmed = false;
  // Daily runs a seeded course with no meta-upgrades so everyone competes evenly.
  rng = daily ? mulberry32(dailySeed(dailyDay)) : Math.random;
  const eff = daily ? { shields: 0, magnet: 0, rollValue: 15, extraJumps: 0, headstart: 0 } : effects();
  shields = eff.shields; invuln = 0; magnetR = eff.magnet; rollValue = eff.rollValue; extraJumps = eff.extraJumps;
  level = 1 + eff.headstart;
  perks = []; levelUps = 0; draftArm = 0; recomputeRunMods();   // fresh run: no perks drafted yet
  speed = 12.5; distance = (level - 1) * STAGE_BASE; rollCount = 0; rollPoints = 0; rowTimer = 1.8; sceneAcc = 0; dustAcc = 0;
  stageStart = distance; stageLen = stageLength(speed);   // first stage is base-length; later ones grow with speed
  elapsed = Math.min(70, (level - 1) * 9); difficulty = 0; safeLane = 1; forcedGap = 0;
  laneIdx = 1; targetX = 0; vy = 0; grounded = true; jumpsLeft = 2 + extraJumps + mods.extraJumpsBonus; banked = 0; groundY = 0; duckTimer = 0; duckAmt = 0; shakeT = 0;
  jumpBufferT = 0; laneChangeT = -99; airTimer = 0; airPeak = 0; usedDouble = false; hitStopT = 0; slowmoT = 0; worldScale = 1;
  combo = 0; comboTimer = 0; comboMax = 0; flowAcc = 0; safeHazardCount = 0; squash = 0; emoteT = 0; spin = 0; power = null; powerT = 0; powerCD = 6; gotPower = false;
  peakSpeed = speed; tightestGap = Infinity;
  scoreHeat = 0;
  phoenix = false; phoenixUsed = false; ringT = 0; camKick = 0;
  player.position.set(0, 0, 0); player.rotation.set(0, 0, 0); player.scale.set(1, 1, 1);
  applySkin(playerMats, selectedSkin());
  refreshGear(); fartCount = 0; updatePowerVisual(); renderPerkTray();
  applyBiome(level, true);
}
function startGame(isDaily = false) {
  daily = !!isDaily; dailyDay = dailyKey();
  ensureAudio(); sfxStart();
  resetGame(); state = 'playing';
  $('overlay').classList.add('hide'); $('gameover').classList.add('hide'); $('hud').classList.remove('hide');
  $('pause').classList.add('hide'); $('pauseBtn').classList.remove('hide'); $('pauseBtn').textContent = '⏸️';
  updateHud(); updateLevelHud(); updateShieldHud(); updateComboHud(false); updatePowerHud(); updatePhoenixHud();
  const streak = daily ? getDailyStreak(dailyDay) : 0;
  showBanner(daily ? (streak > 1 ? `📅 Daily · 🔥 ${streak}-day streak` : '📅 Daily Challenge') : `Lvl ${level} · ${biomeOf(level).name}`);
}
function gameOver() {
  $('pause').classList.add('hide'); $('pauseBtn').classList.add('hide');
  state = 'over'; shakeT = 0.45; hitStopT = reduceMotion ? 0 : HITSTOP_DEATH; flash('#ff5a6a'); buzz([40, 40, 80]); sfxCrash();
  camKick = reduceMotion ? 0 : -8;   // a crash ZOOM-IN (negative FOV kick) so the wipe-out fills the frame
  // Sell the spill: the character pops up, tumbles (reusing the level-up twirl
  // spend) and lands in a big flat splat instead of freezing mid-run-pose.
  if (!reduceMotion) { squash = 0.6; spin = Math.PI * 3; grounded = false; vy = Math.max(vy, 4.5); }
  particles.emit(player.position.clone().add(new THREE.Vector3(0, 0.6, 0)), { count: 16, color: 0xff8a6a, speed: 4, up: 4, life: .7, grav: 12, dir: new THREE.Vector3(0, 0, 1) });
  // Capture the bar to beat BEFORE banking this score, so we can celebrate a new
  // personal best — the single strongest "one more run" hook in a runner.
  const sc = score(), prevBest = getBest(), isBest = sc > prevBest && sc > 0;
  // A run that fell just short of your best gets its own "so close" beat — the gap
  // is the hook that reloads you into another attempt, not a flat "Best: N".
  const soClose = !isBest && prevBest > 0 && sc > prevBest * 0.9;
  const highlights = runHighlights();
  lastRun = { score: sc, prevBest, isBest, soClose, level, comboMax, peakSpeed: +peakSpeed.toFixed(1), tightestGap: tightestGap === Infinity ? null : +tightestGap.toFixed(3), highlights };
  setBest(sc);
  setTimeout(isBest ? sfxFanfare : sfxOver, 260);
  if (daily) { setDailyBest(dailyDay, sc); renderDaily(); }
  bumpStats({ runs: 1, dist: Math.floor(distance), rolls: rollCount, maxCombo: comboMax, maxLevel: level });
  const unlocked = checkAchievements({ level, score: sc, comboMax, rollCount, gotPower });
  const achBonus = rewardFor(unlocked);                            // one-time roll payout for badges earned this run
  addRolls(rollCount + achBonus);  // bank this run's rolls (+ any achievement bonus) into the shop wallet
  pushHistory({ day: dailyKey(), score: sc, level, dist: Math.floor(distance) });
  $('finalScore').textContent = sc;
  $('goFace').textContent = isBest ? '🏆🍑' : '😵🍑';
  $('goTitle').textContent = isBest ? 'New Best!' : 'Wiped out!';
  $('gameover').classList.toggle('newbest', isBest);
  $('bestLine').textContent = isBest
    ? (prevBest > 0 ? `🏆 +${sc - prevBest} over your old best!` : '🏆 Your first record!')
    : soClose ? `😤 So close — just ${prevBest - sc} from your best!`
              : 'Best: ' + getBest();
  if (isBest) {                    // a gold pop + confetti so the record is felt, not just read
    setTimeout(() => flash('#ffd23f'), 180);
    particles.emit(player.position.clone().add(new THREE.Vector3(0, 1.0, 0)), { count: 20, color: 0xffd23f, speed: 5, up: 6, life: 1.1, grav: 9 });
  } else if (soClose) {            // a soft amber pulse — present, but not the gold fanfare
    setTimeout(() => flash('#ffe08a'), 180);
  }
  $('bankedLine').innerHTML = `🧻 +${rollCount} banked` + (achBonus ? ` <span class="achbonus">+${achBonus} 🏅</span>` : '');
  renderHighlights(highlights);
  renderShop(); renderStats(); renderCosmetics();
  renderAchievements(unlocked.map(a => a.id));   // glow any earned this run, right on the card
  if (unlocked.length) { sfxLevel(); buzz([10, 30, 10]); }
  $('perktray').classList.add('hide');
  setTimeout(() => { $('hud').classList.add('hide'); $('gameover').classList.remove('hide'); }, 420);
  // A flashy unlock fanfare over the card when new badges land — it names each
  // badge + its roll reward and the rolls banked this run, then taps away.
  if (unlocked.length) showAchUnlock(unlocked, rollCount, achBonus);
}
const score = () => Math.floor(distance) + rollPoints;
function updateHud() { $('score').textContent = score(); $('rolls').textContent = rollCount; applyScoreHeat(); }
// Paint the score's "on fire" state: a continuous --heat (glow/flame/scale) plus
// a discrete tier class (gold → orange → red-hot) so a fast, chained run visibly
// burns where a cautious one stays cool.
function applyScoreHeat() {
  const p = $('scorepill'); if (!p) return;
  p.style.setProperty('--heat', scoreHeat.toFixed(3));
  p.classList.toggle('warm', scoreHeat >= 0.25 && scoreHeat < 0.55);
  p.classList.toggle('hot', scoreHeat >= 0.55 && scoreHeat < 0.8);
  p.classList.toggle('blaze', scoreHeat >= 0.8);
  p.classList.toggle('quake', scoreHeat >= 0.9);   // a tremble only at the very top of the curve
}
// Fraction (0..1) of the way through the current stage; pins at 1 through the
// run-up/finish-line breather until crossing starts the next stage.
const stageProgress = () => stageLen > 0 ? Math.min(1, Math.max(0, (distance - stageStart) / stageLen)) : 0;
function updateLevelHud() { $('level').textContent = level; $('lvlfill').style.width = (stageProgress() * 100).toFixed(1) + '%'; }
function updateShieldHud() {
  const box = $('shieldHud');
  if (shields > 0) { box.classList.remove('hide'); $('shields').textContent = shields; }
  else box.classList.add('hide');
  updateShieldGear();
}
// The worn Cushion bubble mirrors the live shield count, not just ownership: it
// wraps the character while protected and pops the instant the last cushion is
// spent, with one orbiting pip per remaining shield.
function updateShieldGear() {
  if (!gear) return;
  gear.shield.visible = shields > 0;
  gear.shield.userData.pips.forEach((pip, i) => { pip.visible = i < shields; });
}
// The armed-Phoenix badge: a pulsing flame that shows you've banked a save.
function updatePhoenixHud() { $('phoenixHud').classList.toggle('hide', !phoenix); }
// Earn the once-per-run save when a streak gets hot enough; celebrate the arm.
function armPhoenix() {
  phoenix = true; updatePhoenixHud();
  showBanner('🔥 Phoenix ready!'); sfxFanfare(); buzz([10, 20, 10]); flash('#ffd23f');
  particles.emit(player.position.clone().add(new THREE.Vector3(0, 0.9, 0)), { count: 14, color: 0xff9a3a, speed: 3, up: 4, life: .6, grav: 6 });
}
// Spend the Phoenix to cheat a fatal hit: an invuln dash out of danger instead of
// game over. Breaks the combo (you earned the save *with* it) and can't re-arm.
function usePhoenix() {
  phoenix = false; phoenixUsed = true; updatePhoenixHud();
  invuln = PHOENIX_INVULN; breakCombo();
  flash('#ff7a3a'); buzz([20, 50, 20]); shakeT = 0.3; sfxFanfare();
  hitStopT = reduceMotion ? 0 : HITSTOP_SHIELD; camKick = Math.max(camKick, 6);
  particles.emit(player.position.clone().add(new THREE.Vector3(0, 0.7, 0)), { count: 22, color: 0xff9a3a, speed: 5, up: 5, life: .8, grav: 7 });
  showBanner('🔥 Phoenix Save!');
}
// `nm` tints near-misses cyan so the two reward channels read apart from the
// gold roll pops.
function popScore(v, mult, nm) { const e = $('scorePop'); e.textContent = '+' + v + (mult > 1 ? ' x' + mult : ''); e.classList.toggle('nm', !!nm); e.style.opacity = 1; clearTimeout(popScore._t); popScore._t = setTimeout(() => e.style.opacity = 0, 260); kickScore(); }
// A quick scale-punch on the live score number whenever it visibly jumps (a roll
// or near-miss) — restarts the CSS animation by forcing a reflow between toggles.
function kickScore() { const s = $('score'); if (!s) return; s.classList.remove('kick'); void s.offsetWidth; s.classList.add('kick'); }
// The combo chip's drain bar — reflects how much of the window is left, so the
// player feels the clock ticking on their streak and chases the next pickup.
function updateComboBar() { if (combo >= 2) { const w = COMBO_WINDOW * mods.comboWindowMult; $('comboBar').style.width = Math.max(0, Math.min(1, comboTimer / w)) * 100 + '%'; } }

// Combo: bump on a roll/near-miss, refresh the window, and pulse the HUD chip.
let comboHideT;
function bumpCombo() { clearTimeout(comboHideT); $('comboHud').classList.remove('lose'); combo++; comboTimer = COMBO_WINDOW * mods.comboWindowMult; comboMax = Math.max(comboMax, combo); updateComboHud(true); }
function breakCombo() {
  if (!combo) return;
  const had = combo >= 2; combo = 0;
  if (!had) { updateComboHud(false); return; }
  // Losing a visible streak stings: play a shrink-and-fade on the chip + a soft
  // descending blip so the chip doesn't just blink out unnoticed.
  const box = $('comboHud'); sfxComboBreak();
  box.classList.remove('lose'); void box.offsetWidth; box.classList.add('lose');
  clearTimeout(comboHideT); comboHideT = setTimeout(() => { box.classList.add('hide'); box.classList.remove('lose'); }, 300);
}
// Window expiry doesn't nuke a streak — it steps the multiplier down one tier and
// refreshes the window, so a single missed pickup bleeds momentum instead of
// ending the chain. A hit (crash/shield) still calls breakCombo() for a full reset;
// only running dry decays. Once the streak drops below a tier, it breaks for real.
function decayCombo() {
  combo = Math.max(0, combo - COMBO_DECAY_STEP);
  if (combo >= 2) { comboTimer = COMBO_WINDOW * mods.comboWindowMult; updateComboHud(true); }  // taper at the lower tier
  else { combo = 0; updateComboHud(false); }                                                   // dropped under a tier — quietly done
}
function updateComboHud(pulse) {
  const box = $('comboHud');
  if (combo >= 2) {
    box.classList.remove('hide'); $('comboMult').textContent = cmult(combo); $('comboCount').textContent = combo;
    if (pulse) { box.classList.remove('pulse'); void box.offsetWidth; box.classList.add('pulse'); }
  } else box.classList.add('hide');
}

/* ---------------- controls ---------------- */
function moveLane(dir) { const n = Math.max(0, Math.min(2, laneIdx + dir)); if (n !== laneIdx) { laneIdx = n; targetX = LANES[laneIdx]; laneChangeT = simTime; buzz(12); sfxLane(); } }
function jump() {
  // A press with no jumps left (e.g. just before touchdown) is buffered, not
  // dropped — updatePlayer fires it the instant you land, so chained hops feel
  // responsive instead of eaten.
  if (jumpsLeft > 0) doJump();
  else jumpBufferT = JUMP_BUFFER;
}
function doJump() {
  const dbl = !grounded; if (dbl) usedDouble = true; vy = (grounded ? 9.4 : 8.4) + extraJumps * 0.5; grounded = false; jumpsLeft--; jumpBufferT = 0; squash = -0.32; buzz(15); sfxJump(dbl);
  particles.emit(player.position.clone().add(new THREE.Vector3(0, 0.05, 0.2)), { count: 5, color: 0xeaddc6, speed: 1.6, up: 1.2, life: .4, grav: 6, size: 0.5 });
  fart();
}
function duck() { duckTimer = 0.5; buzz(12); sfxDuck(); if (!grounded) vy = Math.min(vy, -3) - 6; fart(); }
// A cheeky little parp — a soft green puff that lingers behind the character on
// every jump and slide. `fartCount` is a deterministic hook for the tests.
function fart() {
  fartCount++;
  sfxFart();
  particles.emit(new THREE.Vector3(player.position.x, player.position.y + 0.35, player.position.z + 0.55),
    { count: 7, color: 0xc6e26a, speed: 1.3, up: 0.5, life: .75, grav: 1.4, size: 0.7 });
}
// A quick happy squish — bouncy stretch + perked ears for a beat. Fired on rolls
// and clean near-misses so good play visibly delights the character.
function emote() { emoteT = 0.45; squash = Math.max(squash, 0.28); }
// Air bonus: pay out for a big hop on landing — flat once you clear AIR_MIN_H,
// plus more the higher you reached, scaled by the live combo. Tinted cyan like a
// near-miss (both reward aerial skill). It rides the combo but doesn't *feed* it,
// so you can't farm the multiplier by rhythm-hopping in empty space.
function awardAir(peak) {
  const mult = cmult(combo);
  const bonus = Math.round((AIR_BASE + AIR_POINTS * Math.min(peak - AIR_MIN_H, AIR_PEAK_CAP)) * mult);
  if (bonus <= 0) return;
  rollPoints += bonus; popScore(bonus, mult, true); emote(); buzz(8); sfxWhoosh();
  particles.emit(player.position.clone().add(new THREE.Vector3(0, 0.2, 0)),
    { count: 8, color: 0xbfe0ff, speed: 2.5, up: 1.5, life: .45, grav: 5, size: 0.4 });
}
// bindControls (keyboard + touch/swipe wiring) lives in src/controls.js; init()
// hands it the live state getter and the action callbacks it dispatches to.

/* ---------------- pause ---------------- */
// A real in-run pause — a game STATE, distinct from the debug `paused` flag
// (which freezes the whole rAF loop for deterministic stepping). Here the loop
// keeps rendering the frozen scene, but tick() advances no sim: every sim branch
// is gated on state === 'playing', so 'paused' naturally halts distance, spawns
// and collision while the character idles in place. Resuming drops the
// accumulated wall-clock gap so dt doesn't spike on the first frame back — the
// same trick the draft uses (pickDraft). Auto-fires when the tab is hidden or
// loses focus, so tabbing away never dumps you back mid-air already dead.
function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  $('pause').classList.remove('hide');
  $('pauseBtn').textContent = '▶️';
}
function resumeGame() {
  if (state !== 'paused') return;
  $('pause').classList.add('hide');
  $('pauseBtn').textContent = '⏸️';
  state = 'playing';
  clock.getDelta();   // drop the wall-clock gap so the resumed frame doesn't jump
}
function togglePause() {
  if (state === 'playing') { ensureAudio(); pauseGame(); }
  else if (state === 'paused') resumeGame();
}

/* ---------------- loop ---------------- */
function animate() {
  requestAnimationFrame(animate);
  if (paused) return;                 // frozen for deterministic stepping (see debug API)
  tick(Math.min(clock.getDelta(), 0.05));
}
// One simulation + render step for a given dt. Pure of real time: feed it a
// fixed dt N times and the run advances identically every time.
function tick(dt) {
  simTime += dt; const t = simTime;
  // Tick down the draft's input lock even while frozen, then unlock the cards.
  if (state === 'draft' && draftArm > 0) { draftArm = Math.max(0, draftArm - dt); if (!draftArm) $('draft').classList.remove('arming'); }
  // Time-scale for juice: hit-stop fully freezes the world for a beat on impact;
  // a near-miss can briefly dilate it. Visual systems (camera shake, particles,
  // the player rig) keep running on real dt so the freeze reads as a snap, not a
  // stall. `worldScale` lets the scenery/stripes/clouds share the same scaling.
  worldScale = 1;
  if (hitStopT > 0) { hitStopT = Math.max(0, hitStopT - dt); worldScale = 0; }
  else if (slowmoT > 0) { slowmoT = Math.max(0, slowmoT - dt); worldScale = SLOWMO_FACTOR; }
  const sdt = dt * worldScale;
  if (state === 'playing') {
    elapsed += sdt;
    invuln = Math.max(0, invuln - sdt);
    difficulty = Math.min(1, elapsed / DIFF_RAMP);    // warm up over ~90s — a gentler early curve
    // Lean a touch more on the level term and less on raw difficulty, so the
    // first seconds aren't a compound spike and the pace keeps climbing past the
    // difficulty plateau instead of flatlining.
    speed = (12.5 + 11 * difficulty) * (1 + 0.055 * (level - 1)) * mods.speedMult;  // levels + perks nudge the pace
    if (power === 'dash') speed *= DASH_SPEED_MULT;                  // Boost: a brief speed surge (you're invuln while it lasts)
    if (speed > peakSpeed) peakSpeed = speed;                        // remember the run's top speed for the highlight strip
    distance += speed * sdt;
    // Stage flow: once past the stage body, drop the finish line at the horizon;
    // crossing it (in moveFinishLine) bumps the level. Spawning is suppressed
    // from the run-up onward so the line lands on clear road.
    const into = distance - stageStart;
    if (into >= stageLen && !finishLine) placeFinishLine(SPAWN_Z);
    if (comboTimer > 0) { comboTimer -= sdt; if (comboTimer <= 0) decayCombo(); }
    // Earn the once-per-run Phoenix save when the streak gets hot enough.
    if (!phoenix && !phoenixUsed && combo >= PHOENIX_COMBO) armPhoenix();
    // Flow scoring: a hot combo drips bonus score as you run, so a greedy chained
    // run visibly out-scores a cautious one (kept fractional for clean integers).
    if (combo >= 2) { flowAcc += speed * sdt * (cmult(combo) - 1) * SCORE_FLOW_RATE; const w = Math.floor(flowAcc); if (w) { rollPoints += w; flowAcc -= w; } }
    const T = lastRowGap = Math.max(ROW_MIN_GAP, (1.35 - 0.6 * difficulty) / (1 + 0.04 * (level - 1)) * biomePlay(level).rowMult);  // seconds between rows, floored fair
    // Keep the row cadence ticking, but hold spawns through the stage's run-up so
    // the finish line and the upgrade screen land on empty road.
    rowTimer -= sdt; if (rowTimer <= 0) { if (into < stageLen - STAGE_LEAD) spawnRow(); rowTimer = T; }
    sceneAcc += speed * sdt; if (sceneAcc >= 3.5) { sceneAcc = 0; spawnScenery(); }
    if (power) { powerT -= sdt; if (powerT <= 0) { power = null; updatePowerVisual(); sfxPowerEnd(); } updatePowerHud(); }
    moveObstacles(sdt); moveRolls(sdt); movePickups(sdt); moveFinishLine(sdt);
    if (grounded) {
      dustAcc += sdt; if (dustAcc > 0.11) {
        dustAcc = 0;
        particles.emit(new THREE.Vector3(player.position.x, 0.06, player.position.z + 0.3), { count: 2, color: 0xe7d8be, speed: 1.2, up: 0.8, life: .45, grav: 5, size: 0.4 });
        // Sliding kicks up a skid wake behind the feet, so the duck has weight.
        if (duckTimer > 0) particles.emit(new THREE.Vector3(player.position.x, 0.08, player.position.z + 0.5),
          { count: 3, color: 0xdcc9a8, speed: 2.2, up: 0.4, life: .35, grav: 6, size: 0.5, dir: new THREE.Vector3(0, 0, 1) });
      }
    }
    // Score heat: how fast the score is climbing — raw pace plus how hot the
    // combo multiplier is — eased so the fire breathes in and out instead of
    // snapping. The HUD reads it to glow, flame and shake the score number.
    const heatTgt = Math.min(1, Math.max(0, (speed - 13) / 14) * 0.6 + Math.max(0, cmult(combo) - 1) / 4 * 0.7);
    scoreHeat += (heatTgt - scoreHeat) * Math.min(1, dt * 3);
    updateHud(); updateLevelHud(); updateComboBar();
    // Drive the soundtrack's intensity from raw pace + how hot the combo is.
    setIntensity((speed - 12.5) / 14 + Math.max(0, cmult(combo) - 1) * 0.12);
    // speed lines ramp in with combo and raw pace, as a high-intensity reward.
    // They keep climbing at very high speed (no early cap) so a deep, fast run
    // *feels* faster instead of flatlining once past the warm-up.
    speedLines.style.opacity = Math.min(0.85, Math.max(0, cmult(combo) - 1) * 0.15 + Math.max(0, speed - 20) * 0.016);
  } else if (speedLines.style.opacity !== '0') speedLines.style.opacity = 0;
  moveScenery(dt); scrollStripes(dt); driftClouds(dt); tweenBiome(dt);
  deformRoad(roadPath, distance); deformRoad(roadGround, distance);
  updatePlayer(dt, t); particles.update(dt); updateFx(dt); updateCamera(dt, t);
  if (!skipRender) renderer.render(scene, camera);
}
const hitColor = (o) => o.userData.color || 0xff8a6a;
function moveObstacles(dt) {
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i]; const prevZ = o.position.z; o.position.z += speed * dt;
    const lx = o.userData.lx, halfW = o.userData.halfW || 0.95;
    const sz = o.position.z - player.position.z, dx = Math.abs(lx - player.position.x);
    // Forgiving, forward-biased hitbox: collide while the hazard is approaching or
    // right at the player, but stop counting hits well before the old symmetric
    // window let its back face clip you — so a tight dodge you *felt* you cleared
    // never registers a late hit. A sliver of lateral grace keeps the verdict
    // matching the visual. (sz > 0 means the hazard centre is already past you.)
    if (sz > -0.8 && sz < 0.5 && dx < halfW - 0.06) {
      const safe = o.userData.duck ? (duckTimer > 0) : (groundY > (o.userData.clearH || 1.0));
      if (!safe && invuln <= 0) {
        if (shields > 0 && !mods.noShields) {
          shields--; invuln = 1.1; updateShieldHud(); breakCombo(); flash('#8fd3ff'); buzz(30); sfxShield(shields === 0); shakeT = 0.25;
          hitStopT = reduceMotion ? 0 : HITSTOP_SHIELD;   // freeze the beat so the save reads as a real impact
          particles.emit(player.position.clone().add(new THREE.Vector3(0, 0.6, 0)), { count: 14, color: hitColor(o), speed: 4, up: 3, life: .5, grav: 8 });
          scene.remove(o); obstacles.splice(i, 1); continue;
        }
        // A banked Phoenix cheats the fatal hit: invuln-dash clear instead of dying.
        if (phoenix) { usePhoenix(); scene.remove(o); obstacles.splice(i, 1); continue; }
        particles.emit(player.position.clone().add(new THREE.Vector3(0, 0.6, 0)), { count: 14, color: hitColor(o), speed: 4.5, up: 3, life: .6, grav: 10 });
        gameOver(); return;
      }
    }
    // Near-miss / skim: cleared an obstacle the instant it passes without a hit.
    // A "near-miss" is a clean jump/duck *through* its lane (dx ~ 0); a "skim" is
    // a tight lateral dodge — lane-changing past an adjacent-lane hazard right as
    // it goes by. The skim only counts if you actually changed lanes for it
    // (within SKIM_WINDOW), so parking one lane over earns nothing.
    if (!o.userData.scored && prevZ < player.position.z && o.position.z >= player.position.z && dx < halfW + SKIM_MARGIN) {
      const through = dx < halfW + NEARMISS_MARGIN;
      const skim = !through && (simTime - laneChangeT) < SKIM_WINDOW;
      if (through || skim) {
        o.userData.scored = true;
        const gap = dx - halfW; if (gap < tightestGap) tightestGap = gap;   // closest clean thread this run (highlight strip)
        bumpCombo(); emote();
        const m = cmult(combo);                                       // both pay more the hotter your combo
        // A tall obstacle is a harder read (needs a double-jump), so threading over
        // one pays a richer near-miss than clearing a low hop.
        const tallBonus = (o.userData.tall && through) ? 1.6 : 1;
        const nm = Math.round((through ? NEARMISS_BONUS : SKIM_BONUS) * m * mods.nearMissMult * tallBonus);
        rollPoints += nm; popScore(nm, m, true); buzz(8); sfxWhoosh();
        // A streak trailing behind (toward the camera) sells the "whoosh past it".
        particles.emit(player.position.clone().add(new THREE.Vector3(0, 0.9, 0)),
          { count: 7, color: through ? 0xeaffff : 0xbfffe0, speed: 3, up: 1, life: .4, grav: 3, size: 0.4, dir: new THREE.Vector3(0, 0, 1) });
        // Slow-mo on the close call: the full beat on a hot streak, plus a brief
        // one for any genuinely *tight* clean thread even at combo 1 — so the most
        // skilful moment always lands a micro-reward, not just the optimised chain.
        if (!reduceMotion && hitStopT <= 0) {
          if (m >= SLOWMO_MIN_MULT) slowmoT = Math.max(slowmoT, SLOWMO_TIME);
          else if (through && dx < halfW + SLOWMO_TIGHT_MARGIN) slowmoT = Math.max(slowmoT, SLOWMO_TIGHT_TIME);
        }
      }
    }
    const off = trackOffset(o.position.z, distance); o.position.x = lx + off.x; o.position.y = off.y;
    if (o.position.z > DESPAWN_Z) { scene.remove(o); obstacles.splice(i, 1); }
  }
}
function moveRolls(dt) {
  for (let i = rolls.length - 1; i >= 0; i--) {
    const o = rolls[i]; const prevZ = o.position.z; o.position.z += speed * dt; o.rotation.y += dt * 1.05;   // a lazy ~60°/s twirl
    const h = o.userData.h || 0;   // elevated rolls float at a height; grabbing needs matching air
    // Magnet: tug nearby rolls toward the player so they're easier to grab. Acts
    // on the logical lane X (lx), not the curved render X, so it pulls true. Skips
    // elevated rolls — an air ribbon is earned by jumping to it, not vacuumed up.
    const baseMr = magnetR + mods.magnetBonus, mr = power === 'magnet' ? Math.max(baseMr, 9) : baseMr;
    if (mr > 0 && !h) {
      const mdx = player.position.x - o.userData.lx, mdz = player.position.z - o.position.z, md = Math.hypot(mdx, mdz);
      if (md < mr && md > 0.001) {
        const pull = Math.min(1, dt * (5 + 9 * (1 - md / mr)));
        o.userData.lx += mdx * pull; o.position.z += mdz * pull;
      }
    }
    const lx = o.userData.lx;
    const dx = Math.abs(lx - player.position.x);
    // Swept z-grab: a fast roll can skip the whole ±0.9 grab window in one step, so
    // instead of sampling a single instant, grab if the roll's z path this frame
    // [prevZ, position.z] overlapped that window at all. Fixes rolls you visibly
    // pass through — especially airborne ones — going uncollected.
    const zOk = o.position.z >= player.position.z - 0.9 && prevZ <= player.position.z + 0.9;
    // Height gate: a ground roll (h === 0) grabs as it always has (from anywhere,
    // including mid-hop); an elevated roll only pops when you're airborne at its level.
    const yOk = !h || Math.abs(groundY - h) < ROLL_GRAB_H;
    if (zOk && dx < 0.95 && yOk) {
      if (!mods.rollsNoCombo) bumpCombo();   // Perfectionist: rolls no longer feed the streak
      emote();
      // Magpie: each roll already banked this run makes this one worth more (capped).
      const greed = mods.greedScale ? (1 + Math.min(GREED_CAP, rollCount * mods.greedScale)) : 1;
      const mult = cmult(combo) * (power === 'x2' ? 2 : 1) * mods.rollX, gained = Math.round(rollValue * mult * mods.rollMult * greed);
      rollCount++; rollPoints += gained; popScore(gained, mult); buzz(18); sfxCoin(combo);   // pitch climbs with the streak
      if (mods.jumpOnRoll && !grounded) jumpsLeft = Math.min(jumpsLeft + 1, 2 + extraJumps + mods.extraJumpsBonus);
      particles.emit(o.position.clone(), { count: 12, color: 0xffd56b, speed: 3, up: 3, life: .5, grav: 9, size: 0.5 }); scene.remove(o); rolls.splice(i, 1); continue;
    }
    const off = trackOffset(o.position.z, distance);
    // Time-based bob so rolls visibly hover like pickups (the old z-driven wobble
    // was invisible at speed): ±0.15u at ~1.6 Hz.
    const bob = Math.sin(simTime * 10 + o.position.z * 0.25) * 0.15;
    o.position.x = lx + off.x; o.position.y = 0.95 + h + bob + off.y;
    // Project the grounding decal down to the road: an elevated air-ribbon roll
    // keeps a (smaller, fainter) shadow on the ground telling you where the arc
    // lives, instead of the decal floating up with it.
    const sh = o.userData.shadow;
    if (sh) {
      sh.position.y = 0.03 - (0.95 + h + bob);
      if (h && !sh.userData.dropped) { sh.userData.dropped = true; sh.material.opacity = 0.18 / (1 + h); sh.scale.setScalar(1 / (1 + h * 0.35)); }
    }
    if (o.position.z > DESPAWN_Z) { scene.remove(o); rolls.splice(i, 1); }
  }
}
function movePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const o = pickups[i]; o.position.z += speed * dt; o.rotation.y += dt * 2.5;
    o.rotation.z = Math.sin(simTime * 6.3) * 0.26;   // a ~15° rocking sway so the gem beckons
    if (o.userData.gem) o.userData.gem.rotation.y += dt * 4;
    if (o.userData.sparkle) { o.userData.sparkle.rotation.y -= dt * 2.5; o.userData.sparkle.rotation.z += dt * 1.2; }   // hold facing the camera, twinkle slowly
    const lx = o.userData.lx;
    const dz = Math.abs(o.position.z - player.position.z), dx = Math.abs(lx - player.position.x);
    if (dz < 0.95 && dx < 1.0) { activatePower(o.userData.kind, o.position.clone()); scene.remove(o); pickups.splice(i, 1); continue; }
    const off = trackOffset(o.position.z, distance);
    o.position.x = lx + off.x; o.position.y = 1.0 + Math.sin(o.position.z * 0.5) * 0.12 + off.y;
    if (o.position.z > DESPAWN_Z) { scene.remove(o); pickups.splice(i, 1); }
  }
}
function activatePower(kind, pos) {
  power = kind; powerT = POWERUP_DURATION; gotPower = true;
  if (kind === 'ghost' || kind === 'dash') invuln = POWERUP_DURATION;   // ghost & boost both phase through everything
  const p = POWERUPS[kind];
  flash('#fff7c0'); buzz([12, 20, 12]); sfxLevel(); showBanner(`${p.icon} ${p.label}!`);
  particles.emit(pos.add(new THREE.Vector3(0, 0.3, 0)), { count: 18, color: p.color, speed: 4, up: 4, life: .6, grav: 6 });
  updatePowerHud(); updatePowerVisual();
}
// Mirror the active power-up onto the character: a glowing ground ring in the
// power's colour, plus a translucent body while Ghost is up.
function updatePowerVisual() {
  if (aura) { aura.visible = !!power; if (power) { aura.material.color.setHex(POWERUPS[power].color); aura.userData.edge.material.color.setHex(POWERUPS[power].color); } }
  const ghost = power === 'ghost';
  [playerMats.skin, playerMats.inner, playerMats.blush, playerMats.tail].forEach(m => {
    m.transparent = ghost; m.opacity = ghost ? 0.45 : 1; m.depthWrite = !ghost;
  });
}
function updatePowerHud() {
  const box = $('powerHud');
  if (power) {
    box.classList.remove('hide'); $('powerIcon').textContent = POWERUPS[power].icon;
    $('powerFill').style.width = Math.max(0, powerT / POWERUP_DURATION * 100) + '%';
  } else box.classList.add('hide');
}
function moveScenery(dt) {
  const v = (state === 'playing' ? speed * worldScale : 5) * dt;
  for (let i = scenery.length - 1; i >= 0; i--) {
    const o = scenery[i]; o.position.z += v;
    const off = trackOffset(o.position.z, distance); o.position.x = o.userData.lx + off.x; o.position.y = off.y;
    // A slow breathing pulse on the tagged ember glows — sells "alive volcano".
    if (o.userData.pulseMat) o.userData.pulseMat.opacity = o.userData.pulseBase * (0.8 + 0.2 * Math.sin(simTime * 3.1 + o.userData.pulsePh));
    if (o.position.z > DESPAWN_Z) { scene.remove(o); scenery.splice(i, 1); }
  }
}
// Drop the finish-line banner at the spawn horizon (a near z for tests). One at a
// time — the live banner blocks a new one until it's despawned.
function placeFinishLine(z) {
  finishLine = makeFinishLine();
  // A fresh roadside crowd rides along on the banner, freshly rearranged each
  // stage — they cheer the runner across and despawn with the line.
  const crowd = makeCheerCrowd(); finishLine.add(crowd); finishLine.userData.crowd = crowd;
  finishLine.position.set(0, 0, z); finishLine.userData.lx = 0;
  scene.add(finishLine); finishArmed = true;
}
// The banner rides the track toward the player like any prop. When it crosses the
// player it ends the stage: bump the level/biome and size the next stage to the
// current speed (faster now → a longer next stage).
function moveFinishLine(dt) {
  if (!finishLine) return;
  const prevZ = finishLine.position.z;
  finishLine.position.z += speed * dt;
  const off = trackOffset(finishLine.position.z, distance);
  finishLine.position.x = finishLine.userData.lx + off.x; finishLine.position.y = off.y;
  if (finishLine.userData.crowd) tickCheerCrowd(finishLine.userData.crowd, simTime);
  if (finishArmed && prevZ < player.position.z && finishLine.position.z >= player.position.z) {
    finishArmed = false;
    level++; stageStart = distance; stageLen = stageLength(speed);
    onLevelUp();
  }
  if (finishLine.position.z > DESPAWN_Z) { scene.remove(finishLine); finishLine = null; }
}

function updatePlayer(dt, t) {
  // Lane snap is speed-aware: at a fast pace an obstacle closes the Z gap quickly,
  // so the dodge must settle quickly too or a clean lane-change feels like a clip.
  // Hard-snap the last sliver to kill the asymptotic residual (collision reads
  // this X, so a lazy settle directly shrinks the real dodge window).
  const snapRate = state === 'playing' ? 14 + speed * 0.18 : 13;
  player.position.x += (targetX - player.position.x) * Math.min(1, dt * snapRate);
  if (Math.abs(targetX - player.position.x) < 0.04) player.position.x = targetX;
  banked += (((targetX - player.position.x) * 0.5) - banked) * Math.min(1, dt * 11); player.rotation.z = banked;
  jumpBufferT = Math.max(0, jumpBufferT - dt);
  if (!grounded) {
    // Asymmetric gravity: float up gently, fall back snappily — hops feel weighty
    // and responsive without changing how high you reach.
    vy -= (vy > 0 ? 23 * mods.floatMult : 34) * dt; groundY += vy * dt;
    airTimer += dt; if (groundY > airPeak) airPeak = groundY;   // remember the height reached this hop
    if (groundY <= 0) {
      const peak = airPeak, dbl = usedDouble;
      groundY = 0; vy = 0; grounded = true; jumpsLeft = 2 + extraJumps + mods.extraJumpsBonus; squash = 0.42;
      airTimer = 0; airPeak = 0; usedDouble = false;
      // A flat outward dust RING that scales with the fall — low lift + high
      // spread splashes sideways, selling the contact the squash sets up.
      const dn = 6 + Math.min(8, Math.round(peak * 3));
      particles.emit(new THREE.Vector3(player.position.x, 0.06, player.position.z + 0.2), { count: dn, color: 0xe7d8be, speed: 2.8, up: 0.35, life: .4, grav: 7, size: 0.5 });
      // Air bonus: a *spent* double-jump that reached real height pays out on a live
      // run — intent-gated (not a height number), so extra-jump perks can't turn an
      // ordinary single hop into free points. Scaled by peak height and the combo.
      if (dbl && peak >= AIR_MIN_H && state === 'playing') awardAir(peak);
      if (jumpBufferT > 0) doJump();   // a jump pressed just before touchdown fires now
    }
  }
  duckTimer = Math.max(0, duckTimer - dt); duckAmt += ((duckTimer > 0 ? 1 : 0) - duckAmt) * Math.min(1, dt * 16);
  const running = state === 'playing', freq = running ? 14 : 5;
  const bob = (grounded && duckTimer <= 0) ? Math.abs(Math.sin(t * freq)) * 0.12 : 0;
  player.position.y = groundY + bob * (1 - duckAmt);
  // Emote: a happy squish decays over ~0.45s; an "alarm" ramps up the closer an
  // un-dodged obstacle looms in the player's lane — together they let the ears
  // react to good and bad moments.
  emoteT = Math.max(0, emoteT - dt);
  const happy = emoteT > 0 ? emoteT / 0.45 : 0;
  let alarm = 0;
  if (running) for (const o of obstacles) {
    const adz = player.position.z - o.position.z;                 // >0 means it's still ahead
    if (adz > 0.5 && adz < 6 && Math.abs(o.position.x - player.position.x) < (o.userData.halfW || 0.95) + 0.2) {
      alarm = Math.max(alarm, 1 - adz / 6);
    }
  }
  // Level-up twirl: spend the remaining spin radians around Y, snap clean at 0.
  if (spin > 0) { const ds = Math.min(spin, dt * 12); player.rotation.y += ds; spin -= ds; if (spin <= 0) player.rotation.y = 0; }
  ears.forEach((ear, i) => {
    const s = i ? -1 : 1;
    ear.rotation.z = s * (0.22 - alarm * 0.18) + Math.sin(t * 9 + i) * (0.16 + happy * 0.12);
    ear.rotation.x = Math.sin(t * 7) * 0.08 + (grounded ? 0 : -0.25) + duckAmt * 0.5 - happy * 0.5 + alarm * 0.7;
  });
  feet.forEach((f, i) => { const ph = i ? Math.PI : 0; f.position.y = 0.1 + ((running && grounded && duckTimer <= 0) ? Math.max(0, Math.sin(t * freq + ph)) * 0.16 : 0); });
  if (tail) tail.position.x = Math.sin(t * 10) * 0.05;
  if (aura && aura.visible) {
    const pulse = 1 + Math.sin(t * 5) * 0.06; aura.scale.set(pulse, pulse, 1);
    aura.material.opacity = 0.32 + Math.sin(t * 5) * 0.1; aura.rotation.z += dt * 0.8;   // sits under the feet, doesn't compete with the hero's ink line
    auraSparkT -= dt;
    if (auraSparkT <= 0 && state === 'playing') {                    // drift cosy sparkles up around the body
      auraSparkT = 0.22;
      const a = Math.random() * Math.PI * 2, r = 0.7 + Math.random() * 0.4;
      particles.emit(new THREE.Vector3(player.position.x + Math.cos(a) * r, 0.1, player.position.z + Math.sin(a) * r), { count: 1, color: POWERUPS[power].color, speed: 0.3, up: 2.4, life: .7, grav: -1.5, size: 0.4 });
    }
  }
  if (gear) tickGear(gear, t, dt);   // animate the worn props that opt into tick() (incl. Cushion pips + rocket flame)
  squash -= squash * Math.min(1, dt * 12);   // ease the squash/stretch impulse back to 0
  const baseSq = (grounded && duckTimer <= 0) ? 1 - bob * 0.4 : 1;
  const sy = baseSq * (1 - duckAmt * 0.55) * (1 - squash), sxz = (1 / Math.sqrt(baseSq)) * (1 + duckAmt * 0.32) * (1 + squash * 0.5);
  player.scale.set(sxz, sy, sxz);
  // Blob shadow: track the hero on the ground, shrinking and fading with height
  // so the jump arc reads from the road, widening slightly into a duck.
  if (playerShadow) {
    const hk = 1 / (1 + Math.max(0, groundY) * 0.4);
    playerShadow.position.x = player.position.x; playerShadow.position.z = player.position.z;
    playerShadow.scale.setScalar((1 + duckAmt * 0.15 + Math.max(0, squash) * 0.25) * (0.6 + 0.4 * hk));
    playerShadow.material.opacity = 0.08 + 0.12 * hk;   // 0.20 grounded -> ~0.08 at apex
  }
}
function updateCamera(dt, t) {
  // Lean into the curve and ride the hill: aim a little down-track so the camera
  // turns to follow the bend and pitches with the rise/fall ahead.
  const look = trackOffset(-14, distance);
  camera.position.x += ((player.position.x * 0.32 + look.x * 0.28) - camera.position.x) * Math.min(1, dt * 5);
  // A one-shot FOV "punch" on big beats (level-up, a Phoenix save, the crash) eases
  // back to 0; suppressed under reduce-motion since it's vestibular.
  // camKick can be negative (the crash zoom-in) — decay either sign toward 0.
  const kick = reduceMotion ? 0 : camKick;
  camKick = camKick > 0 ? Math.max(0, camKick - dt * 22) : Math.min(0, camKick + dt * 22);
  const fov = 62 + Math.min(Math.max(speed - 12.5, 0), 24) * 0.5 + kick;   // widens further at top speed so the world stretches
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
  if (shakeT > 0) { shakeT -= dt; const s = shakeT * 1.2; camera.position.x += (Math.random() - 0.5) * s; camera.position.y = 5.4 + (Math.random() - 0.5) * s; }
  else camera.position.y += (5.4 - camera.position.y) * Math.min(1, dt * 8);
  camera.lookAt(player.position.x * 0.25 + look.x * 0.7, 1.2 + look.y * 0.6, -8);
}
function scrollStripes(dt) {
  const v = (state === 'playing' ? speed * worldScale : 6) * dt;
  stripes.forEach(d => {
    d.position.z += v; if (d.position.z > DESPAWN_Z) d.position.z -= 78;
    const off = trackOffset(d.position.z, distance); d.position.x = d.userData.bx + off.x; d.position.y = 0.02 + off.y;
  });
}
// Clouds recycle well before the camera (-6, not +16) so one can never balloon
// into a frame-filling corner blob as it sails past the lens.
function driftClouds(dt) { clouds.forEach(c => { c.position.z += (state === 'playing' ? speed * 0.25 * worldScale : 1.5) * dt; if (c.position.z > -6) { c.position.z = -60; c.position.x = (Math.random() - 0.5) * 30; } }); }
// The level-up shockwave: expand the flat ring out from the player and fade it.
function updateFx(dt) {
  if (ringT <= 0) return;
  ringT = Math.max(0, ringT - dt);
  const k = 1 - ringT / RING_TIME;                       // 0 → 1 over its life
  fxRing.position.x = player.position.x; fxRing.position.z = player.position.z;
  fxRing.scale.setScalar(1 + k * 9);
  fxRing.material.opacity = (1 - k) * 0.7;
  fxRing.visible = ringT > 0;
}
function onResize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); }

/* ---------------- levels / biomes ---------------- */
function onLevelUp() {
  const b = biomeOf(level);
  // Front-load the first pick (so a build comes online early), then draft every
  // DRAFT_EVERY-th level-up: with DRAFT_EVERY=2 that's level-ups 1,3,5 (levels 2,4,6).
  levelUps++;
  const willDraft = (levelUps === 1 || levelUps % DRAFT_EVERY === 1);
  if (!willDraft) showBanner(`Lvl ${level} · ${b.name}`);   // the draft card owns this moment instead
  sfxLevel(); buzz([15, 30, 15]);
  spin = Math.PI * 2; squash = -0.25;     // a celebratory twirl + little stretch-up
  applyBiome(level, false);
  // Big-moment pass: a ground shockwave ring, a fatter two-colour burst, a brief
  // camera punch + shake — the headline beat of a run should *feel* like an event.
  const disc = biomeOf(level).disc;
  ringT = RING_TIME; fxRing.material.color.setHex(disc); fxRing.scale.setScalar(1); fxRing.material.opacity = 0.7;
  fxRing.position.set(player.position.x, 0.04, player.position.z); fxRing.visible = true;
  if (!reduceMotion) { shakeT = Math.max(shakeT, 0.12); camKick = Math.max(camKick, 4); }
  particles.emit(player.position.clone().add(new THREE.Vector3(0, 0.8, 0)), { count: 26, color: 0xfff0a0, speed: 4.5, up: 5, life: .8, grav: 8 });
  particles.emit(player.position.clone().add(new THREE.Vector3(0, 0.5, 0)), { count: 16, color: disc, speed: 3, up: 3, life: .7, grav: 6 });
  if (willDraft) openDraft();
}
function applyBiome(lv, instant) {
  const b = biomeOf(lv);
  bTgt.fog.setHex(b.fog); bTgt.ground.setHex(b.ground); bTgt.path.setHex(b.path); bTgt.disc.setHex(b.disc);
  bTgt.sky.set(b.bg[0]);   // the sky gradient's top stop, for lighting/cloud agreement
  b.hills.forEach((h, i) => bTgt.hills[i].setHex(h));
  const air = biomeAir(lv); fogTgt.near = air.near; fogTgt.far = air.far;   // the stage's sight distance / mood
  // Stars fade in as the sky's top stop darkens (Twilight, Ember) and out by day.
  const lum = (bTgt.sky.r + bTgt.sky.g + bTgt.sky.b) / 3;
  starTgt = Math.max(0, Math.min(0.85, (0.42 - lum) * 3));
  document.body.style.background = `linear-gradient(${b.bg[0]} 0%, ${b.bg[1]} 28%, ${b.bg[2]} 66%, ${b.bg[3]} 100%)`;
  if (instant) { copyBiome(); writeBiome(); }
}
function copyBiome() {
  bCur.fog.copy(bTgt.fog); bCur.ground.copy(bTgt.ground); bCur.path.copy(bTgt.path); bCur.disc.copy(bTgt.disc); bCur.sky.copy(bTgt.sky);
  bCur.hills.forEach((c, i) => c.copy(bTgt.hills[i]));
  fogCur.near = fogTgt.near; fogCur.far = fogTgt.far;
  starCur = starTgt;
}
function writeBiome() {
  if (!groundMat) return;
  scene.fog.color.copy(bCur.fog); groundMat.color.copy(bCur.ground); pathMat.color.copy(bCur.path); discMat.color.copy(bCur.disc);
  if (discHaloMat) discHaloMat.color.copy(bCur.disc);   // the sun-disc halo tracks the biome disc colour
  if (discCoronaMat) discCoronaMat.color.copy(bCur.disc);
  scene.fog.near = fogCur.near; scene.fog.far = fogCur.far;
  hillMats.forEach((m, i) => bCur.hills[i] && m.color.copy(bCur.hills[i]));
  // Derived world-dressing recolours, all from the live palette (no new authoring):
  // the hemisphere bounce leans toward the biome's actual sky/ground, clouds tint
  // with the air, ridges sit between the hills and the fog, the horizon glow and
  // stars ride the disc/fog hues.
  if (hemiLight) {
    hemiLight.color.setHex(0xdff0ff).lerp(bCur.sky, 0.55);
    hemiLight.groundColor.setHex(0xffd6b0).lerp(bCur.ground, 0.5);
  }
  // Clouds tint deeper the darker the sky, so night biomes never fly paper-white
  // puffs; day biomes keep a faint airy wash.
  if (cloudMat) {
    const lum = (bCur.sky.r + bCur.sky.g + bCur.sky.b) / 3;
    const night = Math.max(0, Math.min(1, (0.55 - lum) * 2));
    cloudMat.color.setHex(0xffffff).lerp(bCur.fog, 0.25 + 0.45 * night);
  }
  if (ridgeMats.length) {
    ridgeMats[0].color.copy(_c1.copy(bCur.hills[1]).lerp(bCur.fog, 0.5));
    ridgeMats[1].color.copy(_c2.copy(bCur.hills[0]).lerp(bCur.fog, 0.3));
  }
  // The horizon band leans toward the biome GROUND (lifted toward white) so it
  // blends the seam it sits on instead of stamping a fixed lavender stripe.
  if (horizonGlowMat) horizonGlowMat.color.copy(_c1.copy(bCur.ground).lerp(bCur.fog, 0.5).lerp(_c2.setHex(0xffffff), 0.3));
  if (starMat) starMat.opacity = starCur;
}
function tweenBiome(dt) {
  const k = Math.min(1, dt * 2.2);
  bCur.fog.lerp(bTgt.fog, k); bCur.ground.lerp(bTgt.ground, k); bCur.path.lerp(bTgt.path, k); bCur.disc.lerp(bTgt.disc, k); bCur.sky.lerp(bTgt.sky, k);
  bCur.hills.forEach((c, i) => c.lerp(bTgt.hills[i], k));
  fogCur.near += (fogTgt.near - fogCur.near) * k; fogCur.far += (fogTgt.far - fogCur.far) * k;
  starCur += (starTgt - starCur) * k;
  writeBiome();
}
// A brief full-screen colour wash for big moments. CSS does the fade.
function flash(color) {
  const e = $('flash'); e.style.background = color;
  e.classList.remove('go'); void e.offsetWidth; e.classList.add('go');
}
function showBanner(text) {
  const b = $('banner'); b.textContent = text;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  clearTimeout(showBanner._t); showBanner._t = setTimeout(() => b.classList.remove('show'), 1600);
}

/* ---------------- run highlights ---------------- */
// The persistent-screen painters (shop, stats, daily, achievements, cosmetics,
// reset-save, the unlock fanfare and the highlight strip) live in src/hud.js —
// imported above. What stays here is the run-derived logic that feeds them:
// runHighlights reads live run maxima, then gameOver hands the result to
// renderHighlights (hud.js) to paint.
//
// Tunables for the game-over highlight strip: what counts as a brag-worthy beat.
const HL_HAIR_GAP = 0.25;   // dodge margin (beyond half-width) at/under this = "by a hair"
const HL_FAST_SPEED = 22;   // top speed at/above this = "warp speed"
const HL_BIG_COMBO = 5;     // combo streak worth calling out
const HL_BIG_ROLLS = 20;    // roll haul worth calling out

// Up to three concrete "you did this" beats for the just-ended run — the
// strongest "one more run" hook is a specific thing to beat, not just a number.
function runHighlights() {
  const hl = [];
  if (comboMax >= HL_BIG_COMBO) hl.push(`🔥 ${comboMax}× combo streak`);
  if (tightestGap <= HL_HAIR_GAP) hl.push('🪶 dodged by a hair');
  if (peakSpeed >= HL_FAST_SPEED) hl.push('🚀 hit warp speed');
  if (level >= 2) hl.push(`🗺️ reached ${biomeOf(level).name}`);
  if (rollCount >= HL_BIG_ROLLS) hl.push(`🧻 ${rollCount} rolls grabbed`);
  return hl.slice(0, 3);
}

/* ---------------- debug / test bridge ---------------- */
// Built only when debug mode is on (see debug.js) and hung off window.cheeky.
// Everything here drives the SAME functions and state the real game uses, so a
// passing scenario exercises real behaviour — it just removes the timing: set
// state directly, step the sim with a fixed dt, read it back as JSON.
function buildDebugApi() {
  const refreshHud = () => { updateHud(); updateLevelHud(); updateShieldHud(); updateComboHud(false); updatePowerHud(); updatePhoenixHud(); };

  // Curve/hill warp readout: near (at the player) is always 0 so collisions stay
  // fair; far (at the spawn line) shows how the road bends/rolls into the distance.
  function trackSnapshot() {
    const n = trackOffset(0, distance), f = trackOffset(SPAWN_Z, distance);
    return { nearX: +n.x.toFixed(3), nearY: +n.y.toFixed(3), farX: +f.x.toFixed(3), farY: +f.y.toFixed(3) };
  }

  // Full game state as a plain (JSON-serialisable) object.
  function snapshot() {
    return {
      state, score: score(), paused,
      distance: +distance.toFixed(2), speed: +speed.toFixed(2), difficulty: +difficulty.toFixed(3), elapsed: +elapsed.toFixed(2),
      level, biome: biomeOf(level).name, levelProgress: +stageProgress().toFixed(3),
      stageStart: +stageStart.toFixed(2), stageLen: +stageLen.toFixed(2),
      finishLine: finishLine ? +finishLine.position.z.toFixed(2) : null, finishArmed,
      biomeObstacles: [...obstacleSet(level).jump, obstacleSet(level).duck],
      biomeScenery: [...new Set(scenerySet(level))],
      biomePlay: biomePlay(level), fog: { near: +scene.fog.near.toFixed(1), far: +scene.fog.far.toFixed(1) },
      rollCount, rollPoints, combo, comboMult: cmult(combo), comboMax, comboTimer: +comboTimer.toFixed(2),
      shields, invuln: +invuln.toFixed(2), magnetR, rollValue, extraJumps, jumpsLeft,
      phoenix, phoenixUsed, ringT: +ringT.toFixed(3), camKick: +camKick.toFixed(2),
      dailyStreak: getDailyStreak(dailyKey()),
      jumpBufferT: +jumpBufferT.toFixed(3), hitStopT: +hitStopT.toFixed(3), slowmoT: +slowmoT.toFixed(3),
      safeHazards: safeHazardCount, musicIntensity: +getIntensity().toFixed(3), scoreHeat: +scoreHeat.toFixed(3),
      perks: perks.map(p => ({ id: p.id, stacks: p.stacks })), mods, levelUps,
      draft: draftCards.map(p => p.id), draftArm: +draftArm.toFixed(2),
      meta: { rerolls: getRerolls(), banishes: getBanishes(), eligible: eligiblePool() },
      power, powerT: +powerT.toFixed(2), lastRun, rowGap: +lastRowGap.toFixed(3),
      emote: +emoteT.toFixed(2), spin: +spin.toFixed(2),
      laneIdx, targetX,
      track: trackSnapshot(),
      player: { x: +player.position.x.toFixed(3), groundY: +groundY.toFixed(3), vy: +vy.toFixed(2), grounded, ducking: duckTimer > 0 },
      airTimer: +airTimer.toFixed(2), airPeak: +airPeak.toFixed(2),
      gearTiers, auraVisible: !!(aura && aura.visible), fartCount,
      // shield/headstart (and the late-game props) come from the _defs spread;
      // spring/magnet/fortune are the inline perk gear. shieldPips reports the
      // live pip count on the Cushion bubble.
      gearVisible: gear ? { spring: gear.spring.visible, magnet: gear.magnet.visible, fortune: gear.fortune.visible, shieldPips: gear.shield.userData.pips.filter(p => p.visible).length,
        ...Object.fromEntries((gear._defs || []).map(d => [d.id, gear[d.id].visible])) } : {},
      counts: { obstacles: obstacles.length, rolls: rolls.length, airRolls: rolls.filter(r => r.userData.h).length, airRollMaxH: +rolls.reduce((m, r) => Math.max(m, r.userData.h || 0), 0).toFixed(2), tallObstacles: obstacles.filter(o => o.userData.tall).length, pickups: pickups.length, scenery: scenery.length, finish: finishLine ? 1 : 0,
        cheerers: finishLine && finishLine.userData.crowd ? finishLine.userData.crowd.userData.fans.length : 0 },
      wallet: getWallet(), daily,
      stats: getStats(), history: getHistory(),
    };
  }

  // Force a specific obstacle/roll/power-up into the world at a lane and Z.
  // Defaults to the player's lane, just ahead — a few steps and it reaches them.
  // `arg4` is polymorphic per kind: a roll's float height (number, 0 = ground) or
  // an obstacle's tall flag (truthy = needs a double-jump to clear).
  function spawn(kind = 'cactus', lane = laneIdx, z = -8, arg4) {
    let o, arr;
    if (kind === 'roll') { const h = +arg4 || 0; o = makeRoll(); o.userData.h = h; o.position.set(LANES[lane], 0.95 + h, z); o.userData.lx = LANES[lane]; arr = rolls; }
    else if (kind === 'gate' || kind === 'hurdle') {
      o = kind === 'gate' ? makeGate() : makeHurdle();
      o.position.set(0, 0, z); o.userData.halfW = 3.3; o.userData.lx = 0; arr = obstacles;
    } else if (kind.startsWith('powerup')) {
      const pk = kind.split(':')[1] || POWERUP_KINDS[0];
      o = makePowerup(POWERUPS[pk].color); o.position.set(LANES[lane], 1.0, z); o.userData.kind = pk; o.userData.lx = LANES[lane]; arr = pickups;
    } else {                                       // cactus | rock | bar (arg4 = tall)
      o = makeObstacle(kind, !!arg4); if (o.userData.tall) o.userData.clearH += extraJumps * TALL_CLEAR_PER_JUMP;
      o.position.set(LANES[lane], 0, z); o.userData.lane = lane; o.userData.lx = LANES[lane]; arr = obstacles;
    }
    scene.add(o); arr.push(o); return kind;
  }

  // Apply a bag of state overrides (teleport the run), then refresh the HUD.
  const SETTERS = {
    level: v => { level = v; stageStart = distance; stageLen = stageLength(speed); applyBiome(level, true); },
    distance: v => { distance = v; },
    stageStart: v => { stageStart = v; }, stageLen: v => { stageLen = v; },
    speed: v => { speed = v; }, difficulty: v => { difficulty = v; }, elapsed: v => { elapsed = v; },
    shields: v => { shields = v; }, invuln: v => { invuln = v; }, magnetR: v => { magnetR = v; },
    rollValue: v => { rollValue = v; }, extraJumps: v => { extraJumps = v; }, jumpsLeft: v => { jumpsLeft = v; },
    combo: v => { combo = v; }, comboMax: v => { comboMax = v; }, comboTimer: v => { comboTimer = v; }, rollCount: v => { rollCount = v; }, rollPoints: v => { rollPoints = v; },
    phoenix: v => { phoenix = !!v; if (phoenix) phoenixUsed = false; }, phoenixUsed: v => { phoenixUsed = !!v; },
    power: v => { power = v; if (v && powerT <= 0) powerT = POWERUP_DURATION; if (v === 'ghost' || v === 'dash') invuln = Math.max(invuln, POWERUP_DURATION); },
    powerT: v => { powerT = v; }, safeLane: v => { safeLane = v; }, forcedGap: v => { forcedGap = v; },
    perks: v => { perks = (v || []).map(x => typeof x === 'string' ? { id: x, stacks: 1 } : { id: x.id, stacks: x.stacks || 1 }); recomputeRunMods(); refreshGear(); },
    levelUps: v => { levelUps = v; },
    draftArm: v => { draftArm = v; if (!draftArm) $('draft').classList.remove('arming'); },
  };
  function set(o = {}) {
    for (const k in o) { if (SETTERS[k]) SETTERS[k](o[k]); }
    refreshHud(); updatePowerVisual(); return snapshot();
  }

  // Deterministic readout of the cel-shading polish so the visual pass has a
  // scenario, not just a screenshot: light setup, the cool-shadow ramp, and a
  // probe of a fresh emissive prop's glow + a grounded prop's contact shadow.
  function gfx() {
    const lights = scene.children.filter(o => o.isLight);
    const countGlow = (g) => { let n = 0; g.traverse(o => o.userData && o.userData.glow && n++); return n; };
    const hasContact = (g) => { let f = false; g.traverse(o => { if (o.userData && o.userData.contact) f = true; }); return f; };
    return {
      directionalLights: lights.filter(o => o.isDirectionalLight).length,
      hemiLights: lights.filter(o => o.isHemisphereLight).length,
      rampShadow: rampShadow(),
      heroRamp: heroShadow(),
      heroRampUsed: playerMats.skin.gradientMap !== null && playerMats.skin.gradientMap.image.width > 4,
      pathVertexColors: !!pathMat.vertexColors,
      discHalo: !!discHaloMat,
      crystalGlows: countGlow(makeObstacle('crystal')),
      powerupGlows: countGlow(makePowerup(0x66ccff)),
      obstacleContact: hasContact(makeObstacle('cactus')),
      sceneryContact: hasContact(makeScenery('tree')),
      // fidelity pass: layered horizon, night stars, grounded hero + readable rolls
      ridges: ridgeMats.length,
      groundVertexColors: !!groundMat.vertexColors,
      shadowMapOff: !renderer.shadowMap.enabled,
      playerShadow: !!playerShadow,
      playerShadowOpacity: playerShadow ? +playerShadow.material.opacity.toFixed(3) : 0,
      starOpacity: starMat ? +starMat.opacity.toFixed(3) : 0,
      sunCorona: !!discCoronaMat,
      horizonGlow: !!horizonGlowMat,
      cloudTinted: cloudMat ? cloudMat.color.getHex() !== 0xffffff : false,
      hemiSkyTint: hemiLight ? hemiLight.color.getHex() : 0,
      rollGlows: countGlow(makeRoll()),
    };
  }

  const api = {
    // ---- inspect ----
    state: snapshot,
    gfx,
    help: () => ({
      inspect: ['state()'],
      lifecycle: ['start(overrides?)', 'reset()', 'fresh()', 'over()'],
      time: ['pauseGame()', 'resumeGame()', 'togglePause()', 'pause()', 'resume()', 'step(frames=1, dt=1/60)', 'seed(n)'],
      teleport: ['set({level,speed,shields,power,...})', `keys: ${Object.keys(SETTERS).join(', ')}`],
      world: ['spawn(kind, lane?, z?, arg4?)', 'arg4: roll→height, obstacle→tall', 'clearField()', 'forceFinish(z?)', `kinds: ${OBSTACLE_KINDS.join('|')}|gate|hurdle|roll|powerup[:magnet|x2|ghost]`],
      input: ['left()', 'right()', 'lane(i)', 'jump()', 'duck()'],
      shop: ['wallet()', 'fund(n)', 'buy(id)', 'own(id, tier)', 'effects()', 'migrate(legacyOwned?)'],
      perks: ['perk(id)', 'draft()', 'openDraft()', 'pick(i)', 'reroll()', 'banish(i)', `ids: ${PERKS.map(p => p.id).join('|')}`],
      meta: ['buyMeta(id)', 'startDaily()', `items: ${META.map(m => m.id).join('|')}`],
      cosmetics: ['skin()', 'pickSkin(id)', 'unlockAch(id)'],
    }),
    // ---- lifecycle ----
    start: (overrides) => { startGame(false); if (overrides) set(overrides); return snapshot(); },
    reset: () => { resetGame(); refreshHud(); return snapshot(); },
    // Wipe save + return to a clean menu — isolates a feature scenario without
    // a full page reload (which would re-init Three.js/WebGL every time). Stays
    // paused: the harness drives time via step(), so the rAF loop never renders
    // (continuous software-WebGL rendering otherwise pegs the CPU and starves
    // the test driver, making every CLI round-trip crawl).
    fresh: () => { resetSave(); resetGame(); state = 'menu'; paused = true; refreshHud(); renderShop(); return snapshot(); },
    over: () => { if (state === 'playing') gameOver(); return snapshot(); },
    // ---- in-run pause (game state, not the rAF freeze below) ----
    pauseGame: () => { pauseGame(); return snapshot(); },
    resumeGame: () => { resumeGame(); return snapshot(); },
    togglePause: () => { togglePause(); return snapshot(); },
    // ---- deterministic time ----
    pause: () => { paused = true; return snapshot(); },
    resume: () => { paused = false; clock.getDelta(); return snapshot(); },   // drop the accumulated gap
    step: (frames = 1, dt = 1 / 60) => { paused = true; skipRender = true; for (let i = 0; i < frames; i++) tick(dt); skipRender = false; renderer.render(scene, camera); return snapshot(); },
    seed: (n) => { rng = mulberry32(n >>> 0); return n >>> 0; },              // deterministic spawns (apply after start)
    // ---- teleport ----
    set,
    // ---- world ----
    spawn,
    clearField: () => {
      [...obstacles, ...rolls, ...pickups].forEach(o => scene.remove(o));
      obstacles = []; rolls = []; pickups = [];
      if (finishLine) { scene.remove(finishLine); finishLine = null; finishArmed = false; }
      return snapshot();
    },
    // Force the current stage to its end: drop the finish line just ahead so a few
    // steps cross it (the full flow without waiting out a whole stage).
    forceFinish: (z = -8) => {
      if (finishLine) { scene.remove(finishLine); finishLine = null; }
      stageStart = distance - stageLen; placeFinishLine(z); return snapshot();
    },
    // ---- input ----
    left: () => { moveLane(-1); return laneIdx; }, right: () => { moveLane(1); return laneIdx; },
    lane: (i) => { moveLane(i - laneIdx); return laneIdx; },
    jump: () => { jump(); return snapshot(); }, duck: () => { duck(); return snapshot(); },
    // ---- shop / meta ----
    // Re-run startup against whatever bytes a test wrote to localStorage: the
    // save loader (save.js) self-heals any blob on reload() — coercing types,
    // clamping bad values, migrating old versions — so a malformed, value-corrupt
    // or future-version save boots to a clean, playable menu instead of a dead
    // page. resetGame is still guarded (mirrors safeInit) as a last-resort
    // backstop; `recovered` reports whether that full reset was needed.
    reloadSave: () => {
      reload();
      let recovered = false;
      try { resetGame(); }
      catch { recovered = true; resetSave(); resetGame(); }
      state = 'menu'; paused = true; refreshHud(); renderShop(); renderStats(); renderAchievements(); renderCosmetics();
      return { ...snapshot(), recovered };
    },
    wallet: getWallet, fund: (n) => { addRolls(n); renderShop(); return getWallet(); },
    buy: (id) => { const ok = buy(id); renderShop(); return ok; }, effects,
    // Force an owned upgrade tier (bypass cost + gate) so a scenario can exercise
    // a late-game unlock's effect/gear deterministically, then refresh gear/shop.
    own: (id, tier = 1) => { setTier(id, tier); refreshGear(); renderShop(); return snapshot(); },
    // ---- perks (roguelite draft) ----
    perk: (id) => { applyPerk(id); return snapshot(); },
    draft: () => ({ state, choices: draftCards.map(p => p.id) }),
    openDraft: () => { openDraft(); return snapshot(); },
    pick: (i) => { pickDraft(i); return snapshot(); },
    reroll: () => { rerollDraft(); return snapshot(); },
    banish: (i) => { banishCard(i); return snapshot(); },
    spawnRow: () => { spawnRow(); return snapshot(); },   // force one obstacle/roll row (no render — cheap for tests)
    // ---- meta (roguelite lab) ----
    buyMeta: (id) => { const ok = buyMeta(id); renderShop(); return ok; },
    startDaily: () => { startGame(true); return snapshot(); },
    // Record a daily result for an explicit day key, so the return-streak logic is
    // testable without waiting for real calendar days to pass.
    dailyResult: (day, sc) => { setDailyBest(day, sc | 0); renderDaily(); return { best: getDailyBest(day), streak: getDailyStreak(day) }; },
    // ---- cosmetics (skins) ----
    // skin() reads the saved selection + the colours actually on the live mats.
    // pickSkin() mirrors the menu click (gate on unlock, persist, recolour);
    // unlockAch() grants an achievement so achievement-only skins can be tested.
    skin: () => ({ selected: selectedSkin(), applied: {
      skin: playerMats.skin.color.getHex(), inner: playerMats.inner.color.getHex(), tail: playerMats.tail.color.getHex(),
    } }),
    pickSkin: (id) => { const s = skinById(id); if (skinUnlocked(s)) { selectSkin(id); applySkin(playerMats, id); } renderCosmetics(); return selectedSkin(); },
    unlockAch: (id) => { unlock(id); renderCosmetics(); return hasAch(id); },
  };
  return api;
}

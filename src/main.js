import * as THREE from 'three';
import { LANES, SPAWN_Z, DESPAWN_Z, INK, GATE_MIN_DIFF, GATE_CHANCE, GATE_CHANCE_RAMP, GATE_COOLDOWN, COMBO_WINDOW, comboMult, NEARMISS_MARGIN, NEARMISS_BONUS, POWERUP_DURATION, POWERUP_CHANCE, POWERUP_MIN_DIFF, POWERUP_COOLDOWN, POWERUPS, POWERUP_KINDS, mulberry32, dailyKey, dailySeed, $, buzz, shuffle } from './config.js';
import { makeGradient, toon } from './materials.js';
import { makeObstacle, makeHurdle, makeGate, makeRoll, makePowerup, makeTree, makeBush, makeFlower, makeCloud, OBSTACLE_KINDS } from './props.js';
import { createParticles } from './particles.js';
import { buildPlayer, applyGear } from './player.js';
import { LEVEL_DIST, biomeOf, obstacleSet, levelFromDistance, levelProgress } from './levels.js';
import { UPGRADES, effects, tierOf, nextCost, buy, getWallet, addRolls } from './upgrades.js';
import { getBest, setBest, getStats, bumpStats, resetSave } from './save.js';
import { hasAch } from './save.js';
import { ACHIEVEMENTS, checkAchievements } from './achievements.js';
import { selectedSkin, selectSkin, getDailyBest, setDailyBest } from './save.js';
import { SKINS, skinById, skinUnlocked, buySkin, applySkin } from './cosmetics.js';
import { installDebug } from './debug.js';
import {
  initAudio, ensureAudio, toggleSound,
  sfxLane, sfxJump, sfxDuck, sfxCoin, sfxCrash, sfxStart, sfxOver, sfxLevel, sfxShield,
} from './audio.js';

let scene, camera, renderer, clock;
let player, shadowBlob, ears = [], feet = [], tail, particles, playerMats, gear, aura;
let gearTiers = {}, fartCount = 0;   // worn upgrade tiers (for visuals/tests) + fart-puff counter
let obstacles = [], rolls = [], pickups = [], scenery = [], stripes = [], clouds = [];
let groundMat, pathMat, discMat, hillMats = [];
let state = 'menu';
let speed, distance, rollCount, rollPoints, rowTimer, sceneAcc, dustAcc, elapsed, difficulty, safeLane, forcedGap;
let laneIdx, targetX, vy, grounded, jumpsLeft, banked, groundY, duckTimer, duckAmt, shakeT;
let combo, comboTimer, comboMax;
let squash;   // signed squash-&-stretch impulse: + on landing, - on launch, decays to 0
// `simTime` is the animation clock (sum of per-frame dt). Driving it ourselves
// — rather than reading clock.elapsedTime — lets the debug bridge advance the
// sim with a fixed dt, so tests are deterministic instead of wall-clock bound.
// `paused` freezes the rAF loop for deterministic stepping. Declared up here so
// they're initialised before the top-level animate() call (avoids a TDZ throw).
let simTime = 0, paused = false;
let power, powerT, powerCD, gotPower;   // active power-up kind, remaining time, spawn cooldown (rows), grabbed-any flag
let rng = Math.random, daily = false, dailyDay = '';   // daily challenge: seeded RNG + today's key
const speedLines = $('speedlines');
// Level + upgrade run state (set from the save at each run start).
let level, shields, invuln, magnetR, rollValue, extraJumps;

// Biome colour tween state — current values lerp toward the target each frame.
const bCur = { fog: new THREE.Color(), ground: new THREE.Color(), path: new THREE.Color(), disc: new THREE.Color(), hills: [new THREE.Color(), new THREE.Color(), new THREE.Color()] };
const bTgt = { fog: new THREE.Color(), ground: new THREE.Color(), path: new THREE.Color(), disc: new THREE.Color(), hills: [new THREE.Color(), new THREE.Color(), new THREE.Color()] };

// Let the audio scheduler read the live game state.
initAudio(() => state);

init();
animate();

/* ---------------- setup ---------------- */
function init() {
  makeGradient();
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffe1d6, 32, 64);

  camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 220);
  camera.position.set(0, 5.4, 9.4); camera.lookAt(0, 1.2, -8);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.NoToneMapping;     // flat colors -> crisper bands
  $('game').appendChild(renderer.domElement);

  // flatter light so toon bands read; one strong key for direction
  scene.add(new THREE.HemisphereLight(0xdff0ff, 0xffd6b0, 0.55));
  const sun = new THREE.DirectionalLight(0xfff0dc, 1.15);
  sun.position.set(7, 15, 9); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera; sc.near = 1; sc.far = 60; sc.left = -11; sc.right = 11; sc.top = 18; sc.bottom = -18;
  sun.shadow.bias = -0.0006; scene.add(sun);

  discMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const disc = new THREE.Mesh(new THREE.SphereGeometry(3.4, 24, 24), discMat);
  disc.position.set(-15, 17, -46); scene.add(disc);

  [[-9, 0x8fd16f], [3, 0x79c283], [12, 0x9bd778]].forEach(([x, c], i) => {
    const hm = toon(c); hillMats.push(hm);
    const hill = new THREE.Mesh(new THREE.SphereGeometry(10 + i * 2, 20, 16), hm);
    hill.position.set(x, -6, -52 - i * 3); hill.scale.set(1.6, 0.7, 1); scene.add(hill);
  });

  groundMat = toon(0x95df7d);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 220), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.z = -50; ground.receiveShadow = true; scene.add(ground);
  pathMat = toon(0xe7c49c);
  const path = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 220), pathMat);
  path.rotation.x = -Math.PI / 2; path.position.set(0, 0.01, -50); path.receiveShadow = true; scene.add(path);

  const dashGeo = new THREE.PlaneGeometry(0.2, 1.7);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xfff4e6, transparent: true, opacity: .65 });
  for (let i = 0; i < 26; i++) [-1.15, 1.15].forEach(x => {
    const d = new THREE.Mesh(dashGeo, dashMat); d.rotation.x = -Math.PI / 2; d.position.set(x, 0.02, -i * 3); scene.add(d); stripes.push(d);
  });

  for (let i = 0; i < 8; i++) { const c = makeCloud(); scene.add(c); clouds.push(c); }

  particles = createParticles(scene);
  ({ player, ears, feet, tail, gear, aura, mats: playerMats } = buildPlayer(scene));
  applySkin(playerMats, selectedSkin());

  shadowBlob = new THREE.Mesh(new THREE.CircleGeometry(0.72, 28),
    new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: .26 }));
  shadowBlob.rotation.x = -Math.PI / 2; shadowBlob.position.y = 0.03; scene.add(shadowBlob);

  clock = new THREE.Clock(); resetGame();
  addEventListener('resize', onResize); bindControls();
  $('startBtn').onclick = () => startGame(false);
  $('againBtn').onclick = () => startGame(daily);     // "Again!" replays the same mode
  $('dailyBtn').onclick = () => startGame(true);
  $('muteBtn').onclick = toggleSound;
  renderShop(); renderStats(); renderAchievements(); renderCosmetics(); renderDaily();
  installDebug(buildDebugApi);
}

/* ---------------- spawning ---------------- */
function spawnRow() {
  const d = difficulty;
  // FULL-WIDTH GATE: every lane is blocked, so the only way through is the right
  // action — jump a low hurdle or slide under a high bar. Side-stepping can't
  // dodge it. Phases in after the warm-up, ramps with difficulty, and is spaced
  // out by forcedGap so two gates never stack into something unfair.
  if (forcedGap > 0) {
    forcedGap--;
  } else if (d > GATE_MIN_DIFF && rng() < GATE_CHANCE + GATE_CHANCE_RAMP * d) {
    spawnGate(); forcedGap = GATE_COOLDOWN; return;
  }

  // CORRIDOR: one lane is always guaranteed open, and it only shifts by <=1
  // lane per row, so a single lane-change always keeps you safe. Calmer early.
  let nextSafe;
  if (rng() < (0.6 - 0.35 * d)) { nextSafe = safeLane; }
  else { const nb = [safeLane - 1, safeLane + 1].filter(l => l >= 0 && l <= 2); nextSafe = nb[(rng() * nb.length) | 0]; }

  // block 1 lane (easy) or sometimes 2 (later) — never the safe lane, never all 3
  const p2 = Math.max(0, (d - 0.2)) * 0.7;
  const blockCount = (rng() < p2) ? 2 : 1;
  const others = [0, 1, 2].filter(l => l !== nextSafe); shuffle(others, rng);
  const blocked = others.slice(0, blockCount);

  // each biome draws from its own roster; the duck bar phases in after warm-up
  const theme = obstacleSet(level);
  const kinds = d < 0.28 ? theme.jump : [...theme.jump, theme.duck];
  blocked.forEach(li => {
    const o = makeObstacle(kinds[(rng() * kinds.length) | 0]);
    o.position.set(LANES[li], 0, SPAWN_Z); o.userData.lane = li; scene.add(o); obstacles.push(o);
  });

  // rolls only ever sit in open lanes
  const open = [nextSafe, ...others.slice(blockCount)];
  open.forEach(li => {
    const chance = li === nextSafe ? 0.4 : 0.5;
    if (rng() < chance) { const r = makeRoll(); r.position.set(LANES[li], 0.95, SPAWN_Z); scene.add(r); rolls.push(r); }
  });

  // a rare power-up gem, spaced out by a cooldown so it feels like a treat
  if (powerCD > 0) powerCD--;
  else if (difficulty > POWERUP_MIN_DIFF && rng() < POWERUP_CHANCE) {
    const li = open[(rng() * open.length) | 0];
    const kind = POWERUP_KINDS[(rng() * POWERUP_KINDS.length) | 0];
    const p = makePowerup(POWERUPS[kind].color); p.position.set(LANES[li], 1.0, SPAWN_Z); p.userData.kind = kind;
    scene.add(p); pickups.push(p); powerCD = POWERUP_COOLDOWN;
  }

  safeLane = nextSafe;
}
function spawnGate() {
  // 50/50 slide-under vs jump-over; spans all lanes (halfW covers every lane).
  const slide = rng() < 0.5;
  const o = slide ? makeGate() : makeHurdle();
  o.position.set(0, 0, SPAWN_Z); o.userData.halfW = 3.3; scene.add(o); obstacles.push(o);
  // A reward roll in a random lane for clearing it cleanly.
  if (rng() < 0.7) { const r = makeRoll(); r.position.set(LANES[(rng() * 3) | 0], 0.95, SPAWN_Z); scene.add(r); rolls.push(r); }
}
function spawnScenery() {
  const x = (Math.random() < 0.5 ? -1 : 1) * (4.4 + Math.random() * 3.5), roll = Math.random();
  const o = roll < 0.4 ? makeTree() : roll < 0.7 ? makeBush() : makeFlower();
  o.position.set(x, 0, SPAWN_Z - Math.random() * 6); o.rotation.y = Math.random() * Math.PI; scene.add(o); scenery.push(o);
}

/* ---------------- flow ---------------- */
function resetGame() {
  [...obstacles, ...rolls, ...pickups, ...scenery].forEach(o => scene.remove(o));
  obstacles = []; rolls = []; pickups = []; scenery = [];
  // Daily runs a seeded course with no meta-upgrades so everyone competes evenly.
  rng = daily ? mulberry32(dailySeed(dailyDay)) : Math.random;
  const eff = daily ? { shields: 0, magnet: 0, rollValue: 15, extraJumps: 0, headstart: 0 } : effects();
  shields = eff.shields; invuln = 0; magnetR = eff.magnet; rollValue = eff.rollValue; extraJumps = eff.extraJumps;
  level = 1 + eff.headstart;
  speed = 12.5; distance = (level - 1) * LEVEL_DIST; rollCount = 0; rollPoints = 0; rowTimer = 1.8; sceneAcc = 0; dustAcc = 0;
  elapsed = Math.min(70, (level - 1) * 9); difficulty = 0; safeLane = 1; forcedGap = 0;
  laneIdx = 1; targetX = 0; vy = 0; grounded = true; jumpsLeft = 2 + extraJumps; banked = 0; groundY = 0; duckTimer = 0; duckAmt = 0; shakeT = 0;
  combo = 0; comboTimer = 0; comboMax = 0; squash = 0; power = null; powerT = 0; powerCD = 6; gotPower = false;
  player.position.set(0, 0, 0); player.rotation.set(0, 0, 0); player.scale.set(1, 1, 1);
  applySkin(playerMats, selectedSkin());
  // Show the upgrades you own on the character (none in a daily — it's gear-free).
  gearTiers = daily ? {} : { magnet: tierOf('magnet'), shield: tierOf('shield'), fortune: tierOf('fortune'), spring: tierOf('spring'), headstart: tierOf('headstart') };
  applyGear(gear, gearTiers); fartCount = 0; updatePowerVisual();
  applyBiome(level, true);
}
function startGame(isDaily = false) {
  daily = !!isDaily; dailyDay = dailyKey();
  ensureAudio(); sfxStart();
  resetGame(); state = 'playing';
  $('overlay').classList.add('hide'); $('gameover').classList.add('hide'); $('hud').classList.remove('hide');
  updateHud(); updateLevelHud(); updateShieldHud(); updateComboHud(false); updatePowerHud();
  showBanner(daily ? '📅 Daily Challenge' : `Lvl ${level} · ${biomeOf(level).name}`);
}
function gameOver() {
  state = 'over'; shakeT = 0.45; flash('#ff5a6a'); buzz([40, 40, 80]); sfxCrash(); setTimeout(sfxOver, 260);
  particles.emit(player.position.clone().add(new THREE.Vector3(0, 0.6, 0)), { count: 16, color: 0xff8a6a, speed: 4, up: 4, life: .7, grav: 12 });
  setBest(score());
  if (daily) { setDailyBest(dailyDay, score()); renderDaily(); }
  bumpStats({ runs: 1, dist: Math.floor(distance), rolls: rollCount, maxCombo: comboMax, maxLevel: level });
  const unlocked = checkAchievements({ run: { level, score: score(), comboMax, rollCount, gotPower }, stats: getStats() });
  addRolls(rollCount);             // bank this run's rolls into the shop wallet
  $('finalScore').textContent = score(); $('bestLine').textContent = 'Best: ' + getBest();
  $('earned').textContent = rollCount; renderShop(); renderStats(); renderAchievements(); renderCosmetics();
  if (unlocked.length) queueAchToasts(unlocked);
  setTimeout(() => { $('hud').classList.add('hide'); $('gameover').classList.remove('hide'); }, 420);
}
const score = () => Math.floor(distance) + rollPoints;
function updateHud() { $('score').textContent = score(); $('rolls').textContent = rollCount; }
function updateLevelHud() { $('level').textContent = level; $('lvlfill').style.width = (levelProgress(distance) * 100).toFixed(1) + '%'; }
function updateShieldHud() {
  const box = $('shieldHud');
  if (shields > 0) { box.classList.remove('hide'); $('shields').textContent = shields; }
  else box.classList.add('hide');
}
function popScore(v, mult) { const e = $('scorePop'); e.textContent = '+' + v + (mult > 1 ? ' x' + mult : ''); e.style.opacity = 1; clearTimeout(popScore._t); popScore._t = setTimeout(() => e.style.opacity = 0, 260); }

// Combo: bump on a roll/near-miss, refresh the window, and pulse the HUD chip.
function bumpCombo() { combo++; comboTimer = COMBO_WINDOW; comboMax = Math.max(comboMax, combo); updateComboHud(true); }
function breakCombo() { if (combo) { combo = 0; updateComboHud(false); } }
function updateComboHud(pulse) {
  const box = $('comboHud');
  if (combo >= 2) {
    box.classList.remove('hide'); $('comboMult').textContent = comboMult(combo); $('comboCount').textContent = combo;
    if (pulse) { box.classList.remove('pulse'); void box.offsetWidth; box.classList.add('pulse'); }
  } else box.classList.add('hide');
}

/* ---------------- controls ---------------- */
function moveLane(dir) { const n = Math.max(0, Math.min(2, laneIdx + dir)); if (n !== laneIdx) { laneIdx = n; targetX = LANES[laneIdx]; buzz(12); sfxLane(); } }
function jump() {
  if (jumpsLeft > 0) {
    const dbl = !grounded; vy = (grounded ? 9.4 : 8.4) + extraJumps * 0.5; grounded = false; jumpsLeft--; squash = -0.32; buzz(15); sfxJump(dbl);
    particles.emit(player.position.clone().add(new THREE.Vector3(0, 0.05, 0.2)), { count: 5, color: 0xeaddc6, speed: 1.6, up: 1.2, life: .4, grav: 6, size: 0.5 });
    fart();
  }
}
function duck() { duckTimer = 0.5; buzz(12); sfxDuck(); if (!grounded) vy = Math.min(vy, -3) - 6; fart(); }
// A cheeky little parp — a soft green puff that lingers behind the character on
// every jump and slide. `fartCount` is a deterministic hook for the tests.
function fart() {
  fartCount++;
  particles.emit(new THREE.Vector3(player.position.x, player.position.y + 0.35, player.position.z + 0.55),
    { count: 7, color: 0xc6e26a, speed: 1.3, up: 0.5, life: .75, grav: 1.4, size: 0.7 });
}
function bindControls() {
  addEventListener('keydown', e => {
    if (state !== 'playing') { if (e.code === 'Space' || e.code === 'Enter') startGame(); return; }
    if (e.code === 'ArrowLeft') moveLane(-1); else if (e.code === 'ArrowRight') moveLane(1);
    else if (e.code === 'ArrowUp' || e.code === 'Space') jump(); else if (e.code === 'ArrowDown') duck();
  });
  let sx = 0, sy = 0, fired = false; const TH = 24, el = renderer.domElement;
  const act = (dx, dy) => { if (Math.abs(dx) > Math.abs(dy)) moveLane(dx > 0 ? 1 : -1); else if (dy < 0) jump(); else duck(); };
  el.addEventListener('touchstart', e => { ensureAudio(); const t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; fired = false; }, { passive: true });
  el.addEventListener('touchmove', e => {
    if (state !== 'playing' || fired) return; const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > TH || Math.abs(dy) > TH) { act(dx, dy); fired = true; }
  }, { passive: true });
  el.addEventListener('touchend', () => { if (state === 'playing' && !fired) jump(); }, { passive: true });
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
  if (state === 'playing') {
    elapsed += dt;
    invuln = Math.max(0, invuln - dt);
    difficulty = Math.min(1, elapsed / 70);           // warm up over ~70s
    speed = (12.5 + 13.5 * difficulty) * (1 + 0.045 * (level - 1));  // levels keep nudging the pace up
    distance += speed * dt;
    const lv = levelFromDistance(distance);
    if (lv > level) { level = lv; onLevelUp(); }
    if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) breakCombo(); }
    const T = (1.35 - 0.6 * difficulty) / (1 + 0.04 * (level - 1));  // seconds between rows
    rowTimer -= dt; if (rowTimer <= 0) { spawnRow(); rowTimer = T; }
    sceneAcc += speed * dt; if (sceneAcc >= 5) { sceneAcc = 0; spawnScenery(); }
    if (power) { powerT -= dt; if (powerT <= 0) { power = null; updatePowerVisual(); } updatePowerHud(); }
    moveObstacles(dt); moveRolls(dt); movePickups(dt);
    if (grounded) {
      dustAcc += dt; if (dustAcc > 0.11) {
        dustAcc = 0;
        particles.emit(new THREE.Vector3(player.position.x, 0.06, player.position.z + 0.3), { count: 2, color: 0xe7d8be, speed: 1.2, up: 0.8, life: .45, grav: 5, size: 0.4 });
      }
    }
    updateHud(); updateLevelHud();
    // speed lines ramp in with combo and raw pace, as a high-intensity reward
    speedLines.style.opacity = Math.min(0.6, Math.max(0, comboMult(combo) - 1) * 0.15 + Math.max(0, speed - 22) * 0.012);
  } else if (speedLines.style.opacity !== '0') speedLines.style.opacity = 0;
  moveScenery(dt); scrollStripes(dt); driftClouds(dt); tweenBiome(dt);
  updatePlayer(dt, t); particles.update(dt); updateCamera(dt, t);
  renderer.render(scene, camera);
}
const hitColor = (o) => o.userData.color || 0xff8a6a;
function moveObstacles(dt) {
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i]; const prevZ = o.position.z; o.position.z += speed * dt;
    const halfW = o.userData.halfW || 0.95;
    const dz = Math.abs(o.position.z - player.position.z), dx = Math.abs(o.position.x - player.position.x);
    if (dz < 0.8 && dx < halfW) {
      const safe = o.userData.duck ? (duckTimer > 0) : (groundY > 1.0);
      if (!safe && invuln <= 0) {
        if (shields > 0) {
          shields--; invuln = 1.1; updateShieldHud(); breakCombo(); flash('#8fd3ff'); buzz(30); sfxShield(); shakeT = 0.25;
          particles.emit(player.position.clone().add(new THREE.Vector3(0, 0.6, 0)), { count: 14, color: hitColor(o), speed: 4, up: 3, life: .5, grav: 8 });
          scene.remove(o); obstacles.splice(i, 1); continue;
        }
        particles.emit(player.position.clone().add(new THREE.Vector3(0, 0.6, 0)), { count: 14, color: hitColor(o), speed: 4.5, up: 3, life: .6, grav: 10 });
        gameOver(); return;
      }
    }
    // Near-miss: cleared an obstacle that was right on top of you (jumped/ducked
    // through it, not side-stepped) the instant it passes — pays out and chains.
    if (!o.userData.scored && prevZ < player.position.z && o.position.z >= player.position.z && dx < halfW + NEARMISS_MARGIN) {
      o.userData.scored = true;
      bumpCombo(); rollPoints += NEARMISS_BONUS; popScore(NEARMISS_BONUS, comboMult(combo)); buzz(8);
      particles.emit(player.position.clone().add(new THREE.Vector3(0, 0.9, 0)), { count: 7, color: 0xeaffff, speed: 2.4, up: 2, life: .4, grav: 4, size: 0.4 });
    }
    if (o.position.z > DESPAWN_Z) { scene.remove(o); obstacles.splice(i, 1); }
  }
}
function moveRolls(dt) {
  for (let i = rolls.length - 1; i >= 0; i--) {
    const o = rolls[i]; o.position.z += speed * dt; o.rotation.y += dt * 4; o.position.y = 0.95 + Math.sin(o.position.z * 0.6) * 0.06;
    // Magnet: tug nearby rolls toward the player so they're easier to grab.
    // The Magnet power-up temporarily widens the reach far past the upgrade.
    const mr = power === 'magnet' ? Math.max(magnetR, 9) : magnetR;
    if (mr > 0) {
      const mdx = player.position.x - o.position.x, mdz = player.position.z - o.position.z, md = Math.hypot(mdx, mdz);
      if (md < mr && md > 0.001) {
        const pull = Math.min(1, dt * (5 + 9 * (1 - md / mr)));
        o.position.x += mdx * pull; o.position.z += mdz * pull;
      }
    }
    const dz = Math.abs(o.position.z - player.position.z), dx = Math.abs(o.position.x - player.position.x);
    if (dz < 0.9 && dx < 0.95) {
      bumpCombo();
      const mult = comboMult(combo) * (power === 'x2' ? 2 : 1), gained = rollValue * mult;
      rollCount++; rollPoints += gained; popScore(gained, mult); buzz(18); sfxCoin();
      particles.emit(o.position.clone(), { count: 12, color: 0xffd56b, speed: 3, up: 3, life: .5, grav: 9, size: 0.5 }); scene.remove(o); rolls.splice(i, 1); continue;
    }
    if (o.position.z > DESPAWN_Z) { scene.remove(o); rolls.splice(i, 1); }
  }
}
function movePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const o = pickups[i]; o.position.z += speed * dt; o.rotation.y += dt * 2.5;
    o.position.y = 1.0 + Math.sin(o.position.z * 0.5) * 0.12; if (o.userData.gem) o.userData.gem.rotation.y += dt * 4;
    const dz = Math.abs(o.position.z - player.position.z), dx = Math.abs(o.position.x - player.position.x);
    if (dz < 0.95 && dx < 1.0) { activatePower(o.userData.kind, o.position.clone()); scene.remove(o); pickups.splice(i, 1); continue; }
    if (o.position.z > DESPAWN_Z) { scene.remove(o); pickups.splice(i, 1); }
  }
}
function activatePower(kind, pos) {
  power = kind; powerT = POWERUP_DURATION; gotPower = true;
  if (kind === 'ghost') invuln = POWERUP_DURATION;      // phase through everything
  const p = POWERUPS[kind];
  flash('#fff7c0'); buzz([12, 20, 12]); sfxLevel(); showBanner(`${p.icon} ${p.label}!`);
  particles.emit(pos.add(new THREE.Vector3(0, 0.3, 0)), { count: 18, color: p.color, speed: 4, up: 4, life: .6, grav: 6 });
  updatePowerHud(); updatePowerVisual();
}
// Mirror the active power-up onto the character: a halo ring in the power's
// colour, plus a translucent body while Ghost is up.
function updatePowerVisual() {
  if (aura) { aura.visible = !!power; if (power) aura.material.color.setHex(POWERUPS[power].color); }
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
  const v = (state === 'playing' ? speed : 5) * dt;
  for (let i = scenery.length - 1; i >= 0; i--) { const o = scenery[i]; o.position.z += v; if (o.position.z > DESPAWN_Z) { scene.remove(o); scenery.splice(i, 1); } }
}

function updatePlayer(dt, t) {
  player.position.x += (targetX - player.position.x) * Math.min(1, dt * 13);
  banked += (((targetX - player.position.x) * 0.5) - banked) * Math.min(1, dt * 11); player.rotation.z = banked;
  if (!grounded) {
    vy -= 27 * dt; groundY += vy * dt; if (groundY <= 0) {
      groundY = 0; vy = 0; grounded = true; jumpsLeft = 2 + extraJumps; squash = 0.42;
      particles.emit(new THREE.Vector3(player.position.x, 0.05, player.position.z + 0.2), { count: 4, color: 0xe7d8be, speed: 1.6, up: 0.8, life: .35, grav: 6, size: 0.45 });
    }
  }
  duckTimer = Math.max(0, duckTimer - dt); duckAmt += ((duckTimer > 0 ? 1 : 0) - duckAmt) * Math.min(1, dt * 16);
  const running = state === 'playing', freq = running ? 14 : 5;
  const bob = (grounded && duckTimer <= 0) ? Math.abs(Math.sin(t * freq)) * 0.12 : 0;
  player.position.y = groundY + bob * (1 - duckAmt);
  ears.forEach((ear, i) => { const s = i ? -1 : 1; ear.rotation.z = s * 0.22 + Math.sin(t * 9 + i) * 0.16; ear.rotation.x = Math.sin(t * 7) * 0.08 + (grounded ? 0 : -0.25) + duckAmt * 0.5; });
  feet.forEach((f, i) => { const ph = i ? Math.PI : 0; f.position.y = 0.1 + ((running && grounded && duckTimer <= 0) ? Math.max(0, Math.sin(t * freq + ph)) * 0.16 : 0); });
  if (tail) tail.position.x = Math.sin(t * 10) * 0.05;
  if (aura && aura.visible) { aura.rotation.z += dt * 3.2; aura.position.y = 0.6 + Math.sin(t * 6) * 0.05; }
  if (gear && gear.headstart.visible) gear.flame.scale.y = 0.8 + Math.abs(Math.sin(t * 22)) * 0.5;
  squash -= squash * Math.min(1, dt * 12);   // ease the squash/stretch impulse back to 0
  const baseSq = (grounded && duckTimer <= 0) ? 1 - bob * 0.4 : 1;
  const sy = baseSq * (1 - duckAmt * 0.55) * (1 - squash), sxz = (1 / Math.sqrt(baseSq)) * (1 + duckAmt * 0.32) * (1 + squash * 0.5);
  player.scale.set(sxz, sy, sxz);
  shadowBlob.position.x = player.position.x;
  shadowBlob.scale.setScalar(Math.max(0.4, (1 - groundY * 0.25)) * (1 + duckAmt * 0.3));
  shadowBlob.material.opacity = Math.max(0.06, 0.26 - groundY * 0.05);
}
function updateCamera(dt, t) {
  camera.position.x += (player.position.x * 0.32 - camera.position.x) * Math.min(1, dt * 5);
  const fov = 62 + Math.min(Math.max(speed - 12.5, 0), 16) * 0.5;
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
  if (shakeT > 0) { shakeT -= dt; const s = shakeT * 1.2; camera.position.x += (Math.random() - 0.5) * s; camera.position.y = 5.4 + (Math.random() - 0.5) * s; }
  else camera.position.y += (5.4 - camera.position.y) * Math.min(1, dt * 8);
  camera.lookAt(player.position.x * 0.25, 1.2, -8);
}
function scrollStripes(dt) { const v = (state === 'playing' ? speed : 6) * dt; stripes.forEach(d => { d.position.z += v; if (d.position.z > DESPAWN_Z) d.position.z -= 78; }); }
function driftClouds(dt) { clouds.forEach(c => { c.position.z += (state === 'playing' ? speed * 0.25 : 1.5) * dt; if (c.position.z > 16) { c.position.z = -60; c.position.x = (Math.random() - 0.5) * 30; } }); }
function onResize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); }

/* ---------------- levels / biomes ---------------- */
function onLevelUp() {
  const b = biomeOf(level);
  showBanner(`Lvl ${level} · ${b.name}`); sfxLevel(); buzz([15, 30, 15]);
  applyBiome(level, false);
  particles.emit(player.position.clone().add(new THREE.Vector3(0, 0.8, 0)), { count: 18, color: 0xfff0a0, speed: 4, up: 4, life: .7, grav: 8 });
}
function applyBiome(lv, instant) {
  const b = biomeOf(lv);
  bTgt.fog.setHex(b.fog); bTgt.ground.setHex(b.ground); bTgt.path.setHex(b.path); bTgt.disc.setHex(b.disc);
  b.hills.forEach((h, i) => bTgt.hills[i].setHex(h));
  document.body.style.background = `linear-gradient(${b.bg[0]} 0%, ${b.bg[1]} 28%, ${b.bg[2]} 66%, ${b.bg[3]} 100%)`;
  if (instant) { copyBiome(); writeBiome(); }
}
function copyBiome() {
  bCur.fog.copy(bTgt.fog); bCur.ground.copy(bTgt.ground); bCur.path.copy(bTgt.path); bCur.disc.copy(bTgt.disc);
  bCur.hills.forEach((c, i) => c.copy(bTgt.hills[i]));
}
function writeBiome() {
  if (!groundMat) return;
  scene.fog.color.copy(bCur.fog); groundMat.color.copy(bCur.ground); pathMat.color.copy(bCur.path); discMat.color.copy(bCur.disc);
  hillMats.forEach((m, i) => bCur.hills[i] && m.color.copy(bCur.hills[i]));
}
function tweenBiome(dt) {
  const k = Math.min(1, dt * 2.2);
  bCur.fog.lerp(bTgt.fog, k); bCur.ground.lerp(bTgt.ground, k); bCur.path.lerp(bTgt.path, k); bCur.disc.lerp(bTgt.disc, k);
  bCur.hills.forEach((c, i) => c.lerp(bTgt.hills[i], k));
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

/* ---------------- upgrade shop ---------------- */
function renderShop() {
  const wallet = getWallet();
  const grid = UPGRADES.map(u => {
    const l = tierOf(u.id), c = nextCost(u.id), maxed = c === null, afford = !maxed && wallet >= c;
    const dots = Array.from({ length: u.max }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('');
    const cls = `up${maxed ? ' maxed' : (afford ? '' : ' poor')}`;
    return `<button class="${cls}" data-id="${u.id}"${maxed ? ' disabled' : ''}>
      <span class="upi">${u.icon}</span>
      <span class="upn">${u.name}</span>
      <span class="upd">${u.desc}</span>
      <span class="upmeta"><span class="updots">${dots}</span><span class="upc">${maxed ? 'MAX' : c + ' 🧻'}</span></span>
    </button>`;
  }).join('');
  document.querySelectorAll('.shop').forEach(root => {
    root.innerHTML = `<div class="shophead"><span>🛒 Upgrades</span><span class="wallet">🧻 ${wallet}</span></div><div class="shopgrid">${grid}</div>`;
  });
  document.querySelectorAll('.shop .up').forEach(b => {
    b.onclick = (e) => { e.stopPropagation(); ensureAudio(); if (buy(b.dataset.id)) { sfxCoin(); buzz(18); renderShop(); renderCosmetics(); } else buzz(25); };
  });
}

// Lifetime stats + persistent best, shown on the menu and game-over cards.
function renderStats() {
  const s = getStats(), km = (s.dist / 1000).toFixed(1);
  const html = `<span>🏆 Best ${getBest()}</span><span>🏃 ${s.runs} run${s.runs === 1 ? '' : 's'}</span><span>🧻 ${s.rolls}</span><span>🔥 x${comboMult(s.maxCombo)}</span><span>📏 ${km}km</span>`;
  document.querySelectorAll('.stats').forEach(el => { el.innerHTML = html; });
}

// The daily-challenge button label carries today's best for this seeded course.
function renderDaily() {
  const b = getDailyBest(dailyKey());
  $('dailyBtn').textContent = b > 0 ? `📅 Daily · best ${b}` : '📅 Daily Challenge';
}

// Achievement badge grid (locked badges show a padlock), shown on both cards.
function renderAchievements() {
  const got = ACHIEVEMENTS.filter(a => hasAch(a.id)).length;
  const grid = ACHIEVEMENTS.map(a => {
    const on = hasAch(a.id);
    return `<div class="ach${on ? ' on' : ''}" title="${a.desc}"><span class="achi">${on ? a.icon : '🔒'}</span><span class="achn">${a.name}</span></div>`;
  }).join('');
  document.querySelectorAll('.achievements').forEach(root => {
    root.innerHTML = `<div class="shophead"><span>🏅 Achievements</span><span class="wallet">${got}/${ACHIEVEMENTS.length}</span></div><div class="achgrid">${grid}</div>`;
  });
}

// Skin swatch picker. Each swatch shows the skin's colour; click to select an
// owned skin (applies live) or buy a roll-priced one. Achievement skins unlock
// free once earned, and show a lock until then.
function renderCosmetics() {
  const sel = selectedSkin();
  const cells = SKINS.map(s => {
    const owned = skinUnlocked(s), active = s.id === sel;
    const tag = active ? 'ON' : owned ? 'wear' : s.ach ? '🔒' : s.cost + ' 🧻';
    const swatch = `#${s.skin.toString(16).padStart(6, '0')}`;
    return `<button class="skin${active ? ' active' : ''}${owned ? '' : ' locked'}" data-id="${s.id}">
      <span class="sw" style="background:${swatch}"></span><span class="skn">${s.name}</span><span class="skc">${tag}</span>
    </button>`;
  }).join('');
  document.querySelectorAll('.cosmetics').forEach(root => {
    root.innerHTML = `<div class="shophead"><span>🎨 Skins</span></div><div class="skingrid">${cells}</div>`;
  });
  document.querySelectorAll('.cosmetics .skin').forEach(b => {
    b.onclick = (e) => {
      e.stopPropagation(); ensureAudio();
      const s = skinById(b.dataset.id);
      if (skinUnlocked(s)) { selectSkin(s.id); applySkin(playerMats, s.id); sfxLane(); buzz(12); }
      else if (buySkin(s.id)) { selectSkin(s.id); applySkin(playerMats, s.id); sfxCoin(); buzz(18); renderShop(); }
      else buzz(25);
      renderCosmetics();
    };
  });
}

// Pop newly-earned achievements one at a time as a top toast.
let achQueue = [];
function queueAchToasts(list) { const empty = achQueue.length === 0; achQueue.push(...list); if (empty) nextAchToast(); }
function nextAchToast() {
  const a = achQueue.shift(), t = $('achToast');
  if (!a) { t.classList.remove('show'); return; }
  t.innerHTML = `<span class="achi">${a.icon}</span><span class="acht"><b>Achievement!</b><br>${a.name}</span>`;
  t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); sfxLevel(); buzz([10, 30, 10]);
  clearTimeout(nextAchToast._t); nextAchToast._t = setTimeout(nextAchToast, 2200);
}

/* ---------------- debug / test bridge ---------------- */
// Built only when debug mode is on (see debug.js) and hung off window.cheeky.
// Everything here drives the SAME functions and state the real game uses, so a
// passing scenario exercises real behaviour — it just removes the timing: set
// state directly, step the sim with a fixed dt, read it back as JSON.
function buildDebugApi() {
  const refreshHud = () => { updateHud(); updateLevelHud(); updateShieldHud(); updateComboHud(false); updatePowerHud(); };

  // Full game state as a plain (JSON-serialisable) object.
  function snapshot() {
    return {
      state, score: score(), paused,
      distance: +distance.toFixed(2), speed: +speed.toFixed(2), difficulty: +difficulty.toFixed(3), elapsed: +elapsed.toFixed(2),
      level, biome: biomeOf(level).name, levelProgress: +levelProgress(distance).toFixed(3),
      biomeObstacles: [...obstacleSet(level).jump, obstacleSet(level).duck],
      rollCount, rollPoints, combo, comboMult: comboMult(combo), comboMax,
      shields, invuln: +invuln.toFixed(2), magnetR, rollValue, extraJumps, jumpsLeft,
      power, powerT: +powerT.toFixed(2),
      laneIdx, targetX,
      player: { x: +player.position.x.toFixed(3), groundY: +groundY.toFixed(3), grounded, ducking: duckTimer > 0 },
      gearTiers, auraVisible: !!(aura && aura.visible), fartCount,
      counts: { obstacles: obstacles.length, rolls: rolls.length, pickups: pickups.length, scenery: scenery.length },
      wallet: getWallet(), daily,
    };
  }

  // Force a specific obstacle/roll/power-up into the world at a lane and Z.
  // Defaults to the player's lane, just ahead — a few steps and it reaches them.
  function spawn(kind = 'cactus', lane = laneIdx, z = -8) {
    let o, arr;
    if (kind === 'roll') { o = makeRoll(); o.position.set(LANES[lane], 0.95, z); arr = rolls; }
    else if (kind === 'gate' || kind === 'hurdle') {
      o = kind === 'gate' ? makeGate() : makeHurdle();
      o.position.set(0, 0, z); o.userData.halfW = 3.3; arr = obstacles;
    } else if (kind.startsWith('powerup')) {
      const pk = kind.split(':')[1] || POWERUP_KINDS[0];
      o = makePowerup(POWERUPS[pk].color); o.position.set(LANES[lane], 1.0, z); o.userData.kind = pk; arr = pickups;
    } else {                                       // cactus | rock | bar
      o = makeObstacle(kind); o.position.set(LANES[lane], 0, z); o.userData.lane = lane; arr = obstacles;
    }
    scene.add(o); arr.push(o); return kind;
  }

  // Apply a bag of state overrides (teleport the run), then refresh the HUD.
  const SETTERS = {
    level: v => { level = v; distance = Math.max(distance, (v - 1) * LEVEL_DIST); applyBiome(level, true); },
    distance: v => { distance = v; level = levelFromDistance(v); },
    speed: v => { speed = v; }, difficulty: v => { difficulty = v; }, elapsed: v => { elapsed = v; },
    shields: v => { shields = v; }, invuln: v => { invuln = v; }, magnetR: v => { magnetR = v; },
    rollValue: v => { rollValue = v; }, extraJumps: v => { extraJumps = v; }, jumpsLeft: v => { jumpsLeft = v; },
    combo: v => { combo = v; }, rollCount: v => { rollCount = v; }, rollPoints: v => { rollPoints = v; },
    power: v => { power = v; if (v && powerT <= 0) powerT = POWERUP_DURATION; if (v === 'ghost') invuln = Math.max(invuln, POWERUP_DURATION); },
    powerT: v => { powerT = v; }, safeLane: v => { safeLane = v; }, forcedGap: v => { forcedGap = v; },
  };
  function set(o = {}) {
    for (const k in o) { if (SETTERS[k]) SETTERS[k](o[k]); }
    refreshHud(); updatePowerVisual(); return snapshot();
  }

  const api = {
    // ---- inspect ----
    state: snapshot,
    help: () => ({
      inspect: ['state()'],
      lifecycle: ['start(overrides?)', 'reset()', 'fresh()', 'over()'],
      time: ['pause()', 'resume()', 'step(frames=1, dt=1/60)', 'seed(n)'],
      teleport: ['set({level,speed,shields,power,...})', `keys: ${Object.keys(SETTERS).join(', ')}`],
      world: ['spawn(kind, lane?, z?)', 'clearField()', `kinds: ${OBSTACLE_KINDS.join('|')}|gate|hurdle|roll|powerup[:magnet|x2|ghost]`],
      input: ['left()', 'right()', 'lane(i)', 'jump()', 'duck()'],
      shop: ['wallet()', 'fund(n)', 'buy(id)', 'effects()'],
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
    // ---- deterministic time ----
    pause: () => { paused = true; return snapshot(); },
    resume: () => { paused = false; clock.getDelta(); return snapshot(); },   // drop the accumulated gap
    step: (frames = 1, dt = 1 / 60) => { paused = true; for (let i = 0; i < frames; i++) tick(dt); return snapshot(); },
    seed: (n) => { rng = mulberry32(n >>> 0); return n >>> 0; },              // deterministic spawns (apply after start)
    // ---- teleport ----
    set,
    // ---- world ----
    spawn,
    clearField: () => {
      [...obstacles, ...rolls, ...pickups].forEach(o => scene.remove(o));
      obstacles = []; rolls = []; pickups = []; return snapshot();
    },
    // ---- input ----
    left: () => { moveLane(-1); return laneIdx; }, right: () => { moveLane(1); return laneIdx; },
    lane: (i) => { moveLane(i - laneIdx); return laneIdx; },
    jump: () => { jump(); return snapshot(); }, duck: () => { duck(); return snapshot(); },
    // ---- shop / meta ----
    wallet: getWallet, fund: (n) => { addRolls(n); renderShop(); return getWallet(); },
    buy: (id) => { const ok = buy(id); renderShop(); return ok; }, effects,
  };
  return api;
}

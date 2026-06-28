import * as THREE from 'three';
import { LANES, SPAWN_Z, DESPAWN_Z, INK, GATE_MIN_DIFF, GATE_CHANCE, GATE_CHANCE_RAMP, GATE_COOLDOWN, COMBO_WINDOW, comboMult, NEARMISS_MARGIN, NEARMISS_BONUS, POWERUP_DURATION, POWERUP_CHANCE, POWERUP_MIN_DIFF, POWERUP_COOLDOWN, POWERUPS, POWERUP_KINDS, $, buzz, shuffle } from './config.js';
import { makeGradient, toon } from './materials.js';
import { makeObstacle, makeHurdle, makeGate, makeRoll, makePowerup, makeTree, makeBush, makeFlower, makeCloud } from './props.js';
import { createParticles } from './particles.js';
import { buildPlayer } from './player.js';
import { LEVEL_DIST, biomeOf, levelFromDistance, levelProgress } from './levels.js';
import { UPGRADES, effects, tierOf, nextCost, buy, getWallet, addRolls } from './upgrades.js';
import { getBest, setBest, getStats, bumpStats } from './save.js';
import {
  initAudio, ensureAudio, toggleSound,
  sfxLane, sfxJump, sfxDuck, sfxCoin, sfxCrash, sfxStart, sfxOver, sfxLevel, sfxShield,
} from './audio.js';

let scene, camera, renderer, clock;
let player, shadowBlob, ears = [], feet = [], tail, particles;
let obstacles = [], rolls = [], pickups = [], scenery = [], stripes = [], clouds = [];
let groundMat, pathMat, discMat, hillMats = [];
let state = 'menu';
let speed, distance, rollCount, rollPoints, rowTimer, sceneAcc, dustAcc, elapsed, difficulty, safeLane, forcedGap;
let laneIdx, targetX, vy, grounded, jumpsLeft, banked, groundY, duckTimer, duckAmt, shakeT;
let combo, comboTimer, comboMax;
let squash;   // signed squash-&-stretch impulse: + on landing, - on launch, decays to 0
let power, powerT, powerCD;   // active power-up kind, its remaining time, spawn cooldown (rows)
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
  ({ player, ears, feet, tail } = buildPlayer(scene));

  shadowBlob = new THREE.Mesh(new THREE.CircleGeometry(0.72, 28),
    new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: .26 }));
  shadowBlob.rotation.x = -Math.PI / 2; shadowBlob.position.y = 0.03; scene.add(shadowBlob);

  clock = new THREE.Clock(); resetGame();
  addEventListener('resize', onResize); bindControls();
  $('startBtn').onclick = startGame; $('againBtn').onclick = startGame; $('muteBtn').onclick = toggleSound;
  renderShop(); renderStats();
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
  } else if (d > GATE_MIN_DIFF && Math.random() < GATE_CHANCE + GATE_CHANCE_RAMP * d) {
    spawnGate(); forcedGap = GATE_COOLDOWN; return;
  }

  // CORRIDOR: one lane is always guaranteed open, and it only shifts by <=1
  // lane per row, so a single lane-change always keeps you safe. Calmer early.
  let nextSafe;
  if (Math.random() < (0.6 - 0.35 * d)) { nextSafe = safeLane; }
  else { const nb = [safeLane - 1, safeLane + 1].filter(l => l >= 0 && l <= 2); nextSafe = nb[(Math.random() * nb.length) | 0]; }

  // block 1 lane (easy) or sometimes 2 (later) — never the safe lane, never all 3
  const p2 = Math.max(0, (d - 0.2)) * 0.7;
  const blockCount = (Math.random() < p2) ? 2 : 1;
  const others = [0, 1, 2].filter(l => l !== nextSafe); shuffle(others);
  const blocked = others.slice(0, blockCount);

  // bars phase in only after the warm-up
  const kinds = d < 0.28 ? ['cactus', 'rock'] : ['cactus', 'rock', 'bar'];
  blocked.forEach(li => {
    const o = makeObstacle(kinds[(Math.random() * kinds.length) | 0]);
    o.position.set(LANES[li], 0, SPAWN_Z); o.userData.lane = li; scene.add(o); obstacles.push(o);
  });

  // rolls only ever sit in open lanes
  const open = [nextSafe, ...others.slice(blockCount)];
  open.forEach(li => {
    const chance = li === nextSafe ? 0.4 : 0.5;
    if (Math.random() < chance) { const r = makeRoll(); r.position.set(LANES[li], 0.95, SPAWN_Z); scene.add(r); rolls.push(r); }
  });

  // a rare power-up gem, spaced out by a cooldown so it feels like a treat
  if (powerCD > 0) powerCD--;
  else if (difficulty > POWERUP_MIN_DIFF && Math.random() < POWERUP_CHANCE) {
    const li = open[(Math.random() * open.length) | 0];
    const kind = POWERUP_KINDS[(Math.random() * POWERUP_KINDS.length) | 0];
    const p = makePowerup(POWERUPS[kind].color); p.position.set(LANES[li], 1.0, SPAWN_Z); p.userData.kind = kind;
    scene.add(p); pickups.push(p); powerCD = POWERUP_COOLDOWN;
  }

  safeLane = nextSafe;
}
function spawnGate() {
  // 50/50 slide-under vs jump-over; spans all lanes (halfW covers every lane).
  const slide = Math.random() < 0.5;
  const o = slide ? makeGate() : makeHurdle();
  o.position.set(0, 0, SPAWN_Z); o.userData.halfW = 3.3; scene.add(o); obstacles.push(o);
  // A reward roll in a random lane for clearing it cleanly.
  if (Math.random() < 0.7) { const r = makeRoll(); r.position.set(LANES[(Math.random() * 3) | 0], 0.95, SPAWN_Z); scene.add(r); rolls.push(r); }
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
  const eff = effects();
  shields = eff.shields; invuln = 0; magnetR = eff.magnet; rollValue = eff.rollValue; extraJumps = eff.extraJumps;
  level = 1 + eff.headstart;
  speed = 12.5; distance = (level - 1) * LEVEL_DIST; rollCount = 0; rollPoints = 0; rowTimer = 1.8; sceneAcc = 0; dustAcc = 0;
  elapsed = Math.min(70, (level - 1) * 9); difficulty = 0; safeLane = 1; forcedGap = 0;
  laneIdx = 1; targetX = 0; vy = 0; grounded = true; jumpsLeft = 2 + extraJumps; banked = 0; groundY = 0; duckTimer = 0; duckAmt = 0; shakeT = 0;
  combo = 0; comboTimer = 0; comboMax = 0; squash = 0; power = null; powerT = 0; powerCD = 6;
  player.position.set(0, 0, 0); player.rotation.set(0, 0, 0); player.scale.set(1, 1, 1);
  applyBiome(level, true);
}
function startGame() {
  ensureAudio(); sfxStart();
  resetGame(); state = 'playing';
  $('overlay').classList.add('hide'); $('gameover').classList.add('hide'); $('hud').classList.remove('hide');
  updateHud(); updateLevelHud(); updateShieldHud(); updateComboHud(false); updatePowerHud();
  showBanner(`Lvl ${level} · ${biomeOf(level).name}`);
}
function gameOver() {
  state = 'over'; shakeT = 0.45; flash('#ff5a6a'); buzz([40, 40, 80]); sfxCrash(); setTimeout(sfxOver, 260);
  particles.emit(player.position.clone().add(new THREE.Vector3(0, 0.6, 0)), { count: 16, color: 0xff8a6a, speed: 4, up: 4, life: .7, grav: 12 });
  setBest(score());
  bumpStats({ runs: 1, dist: Math.floor(distance), rolls: rollCount, maxCombo: comboMax, maxLevel: level });
  addRolls(rollCount);             // bank this run's rolls into the shop wallet
  $('finalScore').textContent = score(); $('bestLine').textContent = 'Best: ' + getBest();
  $('earned').textContent = rollCount; renderShop(); renderStats();
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
  }
}
function duck() { duckTimer = 0.5; buzz(12); sfxDuck(); if (!grounded) vy = Math.min(vy, -3) - 6; }
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
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
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
    if (power) { powerT -= dt; if (powerT <= 0) { power = null; } updatePowerHud(); }
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
      const k = o.userData.kind;
      const safe = (k === 'bar' || k === 'gate') ? (duckTimer > 0) : (groundY > 1.0);
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
  power = kind; powerT = POWERUP_DURATION;
  if (kind === 'ghost') invuln = POWERUP_DURATION;      // phase through everything
  const p = POWERUPS[kind];
  flash('#fff7c0'); buzz([12, 20, 12]); sfxLevel(); showBanner(`${p.icon} ${p.label}!`);
  particles.emit(pos.add(new THREE.Vector3(0, 0.3, 0)), { count: 18, color: p.color, speed: 4, up: 4, life: .6, grav: 6 });
  updatePowerHud();
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
    b.onclick = (e) => { e.stopPropagation(); ensureAudio(); if (buy(b.dataset.id)) { sfxCoin(); buzz(18); renderShop(); } else buzz(25); };
  });
}

// Lifetime stats + persistent best, shown on the menu and game-over cards.
function renderStats() {
  const s = getStats(), km = (s.dist / 1000).toFixed(1);
  const html = `<span>🏆 Best ${getBest()}</span><span>🏃 ${s.runs} run${s.runs === 1 ? '' : 's'}</span><span>🧻 ${s.rolls}</span><span>🔥 x${comboMult(s.maxCombo)}</span><span>📏 ${km}km</span>`;
  document.querySelectorAll('.stats').forEach(el => { el.innerHTML = html; });
}

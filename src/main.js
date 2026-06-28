import * as THREE from 'three';
import { LANES, SPAWN_Z, DESPAWN_Z, INK, $, buzz, shuffle } from './config.js';
import { makeGradient, toon } from './materials.js';
import { makeObstacle, makeRoll, makeTree, makeBush, makeFlower, makeCloud } from './props.js';
import { createParticles } from './particles.js';
import { buildPlayer } from './player.js';
import {
  initAudio, ensureAudio, toggleSound,
  sfxLane, sfxJump, sfxDuck, sfxCoin, sfxCrash, sfxStart, sfxOver,
} from './audio.js';

let scene, camera, renderer, clock;
let player, shadowBlob, ears = [], feet = [], tail, particles;
let obstacles = [], rolls = [], scenery = [], stripes = [], clouds = [];
let state = 'menu', best = 0;
let speed, distance, rollCount, rowTimer, sceneAcc, dustAcc, elapsed, difficulty, safeLane;
let laneIdx, targetX, vy, grounded, jumpsLeft, banked, groundY, duckTimer, duckAmt, shakeT;

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

  const disc = new THREE.Mesh(new THREE.SphereGeometry(3.4, 24, 24), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  disc.position.set(-15, 17, -46); scene.add(disc);

  [[-9, 0x8fd16f], [3, 0x79c283], [12, 0x9bd778]].forEach(([x, c], i) => {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(10 + i * 2, 20, 16), toon(c));
    hill.position.set(x, -6, -52 - i * 3); hill.scale.set(1.6, 0.7, 1); scene.add(hill);
  });

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 220), toon(0x95df7d));
  ground.rotation.x = -Math.PI / 2; ground.position.z = -50; ground.receiveShadow = true; scene.add(ground);
  const path = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 220), toon(0xe7c49c));
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
}

/* ---------------- spawning ---------------- */
function spawnRow() {
  const d = difficulty;
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
  [nextSafe, ...others.slice(blockCount)].forEach(li => {
    const chance = li === nextSafe ? 0.4 : 0.5;
    if (Math.random() < chance) { const r = makeRoll(); r.position.set(LANES[li], 0.95, SPAWN_Z); scene.add(r); rolls.push(r); }
  });

  safeLane = nextSafe;
}
function spawnScenery() {
  const x = (Math.random() < 0.5 ? -1 : 1) * (4.4 + Math.random() * 3.5), roll = Math.random();
  const o = roll < 0.4 ? makeTree() : roll < 0.7 ? makeBush() : makeFlower();
  o.position.set(x, 0, SPAWN_Z - Math.random() * 6); o.rotation.y = Math.random() * Math.PI; scene.add(o); scenery.push(o);
}

/* ---------------- flow ---------------- */
function resetGame() {
  [...obstacles, ...rolls, ...scenery].forEach(o => scene.remove(o));
  obstacles = []; rolls = []; scenery = [];
  speed = 12.5; distance = 0; rollCount = 0; rowTimer = 1.8; sceneAcc = 0; dustAcc = 0; elapsed = 0; difficulty = 0; safeLane = 1;
  laneIdx = 1; targetX = 0; vy = 0; grounded = true; jumpsLeft = 2; banked = 0; groundY = 0; duckTimer = 0; duckAmt = 0; shakeT = 0;
  player.position.set(0, 0, 0); player.rotation.set(0, 0, 0); player.scale.set(1, 1, 1);
}
function startGame() {
  ensureAudio(); sfxStart();
  resetGame(); state = 'playing';
  $('overlay').classList.add('hide'); $('gameover').classList.add('hide'); $('hud').classList.remove('hide'); updateHud();
}
function gameOver() {
  state = 'over'; shakeT = 0.45; buzz([40, 40, 80]); sfxCrash(); setTimeout(sfxOver, 260);
  particles.emit(player.position.clone().add(new THREE.Vector3(0, 0.6, 0)), { count: 16, color: 0xff8a6a, speed: 4, up: 4, life: .7, grav: 12 });
  best = Math.max(best, score());
  $('finalScore').textContent = score(); $('bestLine').textContent = 'Best: ' + best;
  setTimeout(() => { $('hud').classList.add('hide'); $('gameover').classList.remove('hide'); }, 420);
}
const score = () => Math.floor(distance) + rollCount * 15;
function updateHud() { $('score').textContent = score(); $('rolls').textContent = rollCount; }
function popScore(v) { const e = $('scorePop'); e.textContent = '+' + v; e.style.opacity = 1; clearTimeout(popScore._t); popScore._t = setTimeout(() => e.style.opacity = 0, 260); }

/* ---------------- controls ---------------- */
function moveLane(dir) { const n = Math.max(0, Math.min(2, laneIdx + dir)); if (n !== laneIdx) { laneIdx = n; targetX = LANES[laneIdx]; buzz(12); sfxLane(); } }
function jump() {
  if (jumpsLeft > 0) {
    const dbl = !grounded; vy = grounded ? 9.4 : 8.4; grounded = false; jumpsLeft--; buzz(15); sfxJump(dbl);
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
    difficulty = Math.min(1, elapsed / 80);          // warm up over ~80s
    speed = 12.5 + 13.5 * difficulty;                 // capped: 12.5 -> 26
    distance += speed * dt;
    const T = 1.35 - 0.6 * difficulty;                // seconds between rows: 1.35 -> 0.75
    rowTimer -= dt; if (rowTimer <= 0) { spawnRow(); rowTimer = T; }
    sceneAcc += speed * dt; if (sceneAcc >= 5) { sceneAcc = 0; spawnScenery(); }
    moveObstacles(dt); moveRolls(dt);
    if (grounded) {
      dustAcc += dt; if (dustAcc > 0.11) {
        dustAcc = 0;
        particles.emit(new THREE.Vector3(player.position.x, 0.06, player.position.z + 0.3), { count: 2, color: 0xe7d8be, speed: 1.2, up: 0.8, life: .45, grav: 5, size: 0.4 });
      }
    }
    updateHud();
  }
  moveScenery(dt); scrollStripes(dt); driftClouds(dt);
  updatePlayer(dt, t); particles.update(dt); updateCamera(dt, t);
  renderer.render(scene, camera);
}
function moveObstacles(dt) {
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i]; o.position.z += speed * dt;
    const dz = Math.abs(o.position.z - player.position.z), dx = Math.abs(o.position.x - player.position.x);
    if (dz < 0.8 && dx < 0.95) { const safe = o.userData.kind === 'bar' ? (duckTimer > 0) : (groundY > 1.0); if (!safe) { gameOver(); return; } }
    if (o.position.z > DESPAWN_Z) { scene.remove(o); obstacles.splice(i, 1); }
  }
}
function moveRolls(dt) {
  for (let i = rolls.length - 1; i >= 0; i--) {
    const o = rolls[i]; o.position.z += speed * dt; o.rotation.y += dt * 4; o.position.y = 0.95 + Math.sin(o.position.z * 0.6) * 0.06;
    const dz = Math.abs(o.position.z - player.position.z), dx = Math.abs(o.position.x - player.position.x);
    if (dz < 0.9 && dx < 0.95) {
      rollCount++; popScore(15); buzz(18); sfxCoin();
      particles.emit(o.position.clone(), { count: 12, color: 0xffd56b, speed: 3, up: 3, life: .5, grav: 9, size: 0.5 }); scene.remove(o); rolls.splice(i, 1); continue;
    }
    if (o.position.z > DESPAWN_Z) { scene.remove(o); rolls.splice(i, 1); }
  }
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
      groundY = 0; vy = 0; grounded = true; jumpsLeft = 2;
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
  const baseSq = (grounded && duckTimer <= 0) ? 1 - bob * 0.4 : 1, sy = baseSq * (1 - duckAmt * 0.55), sxz = (1 / Math.sqrt(baseSq)) * (1 + duckAmt * 0.32);
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

import * as THREE from 'three';
import { toon, ink } from './materials.js';

// Pure mesh factories. Each returns a positioned/unpositioned THREE.Group;
// the caller is responsible for adding it to the scene.

// ---- per-biome obstacle roster ----
// Every lane obstacle is one of these kinds. `action` decides how you clear it:
// 'jump' obstacles are grounded (jump over), 'duck' obstacles are a raised bar
// (slide under). Each biome (see levels.js) draws from its own subset so stages
// look distinct, not just recoloured. `build()` returns the inner meshes.

// A raised cross-bar on two posts — the shared shape behind every 'duck' kind.
function duckBar(barM, postM, barGeo = [1.7, 0.3, 0.3]) {
  const g = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.BoxGeometry(...barGeo), barM); bar.position.y = 1.55; bar.castShadow = true; ink(bar, 1.08);
  [-0.8, 0.8].forEach(x => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 8), postM); p.position.set(x, 0.8, 0); p.castShadow = true; ink(p, 1.1); g.add(p); });
  g.add(bar); return g;
}

const OBSTACLES = {
  // Meadow — green & woodsy.
  cactus: { action: 'jump', color: 0x44b566, build: () => {
    const g = new THREE.Group(), m = toon(0x44b566);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 1.5, 14), m); body.position.y = 0.75; body.castShadow = true; ink(body, 1.07);
    const aL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.6, 10), m); aL.position.set(-0.36, 0.95, 0); aL.rotation.z = 0.5; aL.castShadow = true; ink(aL, 1.12);
    const aR = aL.clone(); aR.position.x = 0.36; aR.rotation.z = -0.5;
    g.add(body, aL, aR); return g;
  } },
  rock: { action: 'jump', color: 0x99a3ad, build: () => {
    const g = new THREE.Group();
    const r = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), toon(0x99a3ad, { flat: true })); r.position.y = 0.5; r.scale.set(1.3, 0.9, 1.1); r.castShadow = true; ink(r, 1.08); g.add(r); return g;
  } },
  branch: { action: 'duck', color: 0x8a5a33, build: () => {
    const g = duckBar(toon(0x8a5a33), toon(0x9c6b43));
    const leafM = toon(0x57bf64);
    [-0.5, 0.1, 0.6].forEach(x => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10), leafM); l.position.set(x, 1.75, 0); l.castShadow = true; ink(l, 1.08); g.add(l); });
    return g;
  } },

  // Sunset — warm desert.
  barrel: { action: 'jump', color: 0xc8743a, build: () => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 16), toon(0xc8743a)); body.position.y = 0.6; body.castShadow = true; ink(body, 1.06);
    const bandM = toon(0x6a4a2a);
    [0.25, 0.95].forEach(y => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 0.12, 16), bandM); b.position.y = y; g.add(b); });
    g.add(body); return g;
  } },
  boulder: { action: 'jump', color: 0xb89a6a, build: () => {
    const g = new THREE.Group();
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 0), toon(0xb89a6a, { flat: true })); r.position.y = 0.6; r.scale.set(1.2, 1.0, 1.0); r.castShadow = true; ink(r, 1.06); g.add(r); return g;
  } },
  bar: { action: 'duck', color: 0xff5151, build: () => duckBar(toon(0xff5151), toon(0xe0d3c0), [1.7, 0.34, 0.34]) },

  // Twilight — spooky night.
  crystal: { action: 'jump', color: 0x9a7bff, build: () => {
    const g = new THREE.Group(), m = toon(0x9a7bff, { emissive: 0x2a1a55, flat: true });
    const main = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.5, 5), m); main.position.y = 0.75; main.castShadow = true; ink(main, 1.07); g.add(main);
    [[-0.42, 0.5, 0.45], [0.42, 0.42, -0.4]].forEach(([x, h, z]) => { const c = new THREE.Mesh(new THREE.ConeGeometry(0.18, h * 2, 5), m); c.position.set(x, h, z); c.castShadow = true; ink(c, 1.1); g.add(c); });
    return g;
  } },
  tombstone: { action: 'jump', color: 0x8a93a6, build: () => {
    const g = new THREE.Group(), m = toon(0x8a93a6, { flat: true });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.25), m); slab.position.y = 0.75; slab.castShadow = true; ink(slab, 1.05);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), m); top.position.y = 1.4; top.scale.z = 0.56; top.castShadow = true; ink(top, 1.06);
    g.add(slab, top); return g;
  } },
  beam: { action: 'duck', color: 0xc9a7ff, build: () => duckBar(toon(0xc9a7ff, { emissive: 0x5a3a8a }), toon(0x6a5a8a)) },

  // Candyland — bright sweets.
  candycane: { action: 'jump', color: 0xff5fa6, build: () => {
    const g = new THREE.Group(), m = toon(0xff5fa6);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.3, 12), m); pole.position.y = 0.65; pole.castShadow = true; ink(pole, 1.08);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.16, 8, 12, Math.PI), toon(0xffffff)); hook.position.set(0.28, 1.3, 0); hook.castShadow = true; ink(hook, 1.1);
    g.add(pole, hook); return g;
  } },
  gumdrop: { action: 'jump', color: 0xff8ad0, build: () => {
    const g = new THREE.Group();
    const d = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.2, 18), toon(0xff8ad0, { emissive: 0x3a0022 })); d.position.y = 0.6; d.castShadow = true; ink(d, 1.06); g.add(d); return g;
  } },
  licorice: { action: 'duck', color: 0x3a2a4a, build: () => duckBar(toon(0x3a2a4a), toon(0xffd23f)) },
};

export function makeObstacle(kind) {
  const def = OBSTACLES[kind] || OBSTACLES.cactus;
  const g = def.build();
  g.userData.kind = kind;
  g.userData.color = def.color;
  g.userData.duck = def.action === 'duck';   // generic flag the loop reads for collision
  return g;
}

// Kinds available to the debug bridge / sanity checks.
export const OBSTACLE_KINDS = Object.keys(OBSTACLES);

// Full-width low hurdle spanning every lane — the only way past is to JUMP.
export function makeHurdle() {
  const g = new THREE.Group();
  const m = toon(0xffb13b);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.55, 0.4), m); bar.position.y = 0.5; bar.castShadow = true; ink(bar, 1.04); g.add(bar);
  const legM = toon(0xe0d3c0);
  [-3.1, 0, 3.1].forEach(x => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 8), legM); p.position.set(x, 0.25, 0); p.castShadow = true; ink(p, 1.1); g.add(p); });
  g.userData.kind = 'hurdle'; g.userData.color = 0xffb13b;
  return g;
}

// Full-width high bar spanning every lane — the only way past is to SLIDE.
export function makeGate() {
  const g = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.45, 0.4), toon(0xff5151)); bar.position.y = 1.55; bar.castShadow = true; ink(bar, 1.04); g.add(bar);
  const postM = toon(0xe0d3c0);
  [-3.2, 3.2].forEach(x => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.7, 8), postM); p.position.set(x, 0.85, 0); p.castShadow = true; ink(p, 1.08); g.add(p); });
  g.userData.kind = 'gate'; g.userData.color = 0xff5151; g.userData.duck = true;
  return g;
}

// A finish line marking a stage boundary: a checkered ground strip + a banner on
// two posts, spanning the whole track. It's decoration, not a hazard — you run
// straight through it, and crossing it ends the stage (level-up + biome change).
export function makeFinishLine() {
  const g = new THREE.Group();
  const dark = toon(0x2a2030), light = toon(0xf6f1ea);
  const W = 7.2, cols = 9, cw = W / cols;
  // Ground checker: two rows of alternating squares painted flat on the road.
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < cols; i++) {
      const sq = new THREE.Mesh(new THREE.BoxGeometry(cw, 0.06, cw), (i + r) % 2 ? light : dark);
      sq.position.set(-W / 2 + cw * (i + 0.5), 0.04, -cw / 2 + r * cw);
      g.add(sq);
    }
  }
  // Two posts holding up the banner.
  const postM = toon(0xe0d3c0);
  [-W / 2 - 0.1, W / 2 + 0.1].forEach(x => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.8, 10), postM); p.position.set(x, 1.4, 0); p.castShadow = true; ink(p, 1.06); g.add(p);
  });
  // Checkered banner strung between the posts (a dark backing gives it an ink frame).
  const bw = W + 0.4;
  const back = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.62, 0.1), toon(0x2a2030)); back.position.set(0, 2.65, -0.04); ink(back, 1.04); g.add(back);
  const bcols = 12, bcw = bw / bcols;
  for (let i = 0; i < bcols; i++) {
    const sq = new THREE.Mesh(new THREE.BoxGeometry(bcw, 0.5, 0.12), i % 2 ? light : dark);
    sq.position.set(-bw / 2 + bcw * (i + 0.5), 2.65, 0); g.add(sq);
  }
  g.userData.kind = 'finish';
  return g;
}

export function makeRoll() {
  const g = new THREE.Group();
  const paper = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.5, 22), toon(0xffffff, { emissive: 0x222222 }));
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.55, 16), toon(0xd9b48a));
  paper.rotation.x = Math.PI / 2; hole.rotation.x = Math.PI / 2; paper.castShadow = true; ink(paper, 1.07);
  g.add(paper, hole); g.position.y = 0.95;
  return g;
}

// A rare floating bonus — a glowing gem that grants a brief power-up. The colour
// is set by the caller per kind; strong emissive makes it pop against any biome.
export function makePowerup(color) {
  const g = new THREE.Group();
  const gem = new THREE.Mesh(new THREE.IcosahedronGeometry(0.46, 0), toon(color, { emissive: color, flat: true }));
  gem.castShadow = true; ink(gem, 1.1);
  // Ring tinted a lighter shade of the gem colour (not white) so every kind —
  // even the pale ghost lavender — reads as one solid coloured pickup.
  const ringCol = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.45);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.075, 8, 22), toon(ringCol.getHex(), { emissive: ringCol.getHex() }));
  ring.rotation.x = Math.PI / 2;
  // A tight 4-point sparkle behind the gem so it catches the eye at distance.
  const sparkle = new THREE.Mesh(new THREE.CircleGeometry(0.66, 4), new THREE.MeshBasicMaterial({ color: ringCol.getHex(), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  sparkle.position.z = -0.15; sparkle.rotation.z = Math.PI / 4;
  g.add(sparkle, ring, gem);
  g.position.y = 1.0; g.userData.gem = gem; g.userData.sparkle = sparkle;
  return g;
}

export function makeTree() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.1, 8), toon(0x9c6b43)); trunk.position.y = 0.55; trunk.castShadow = true; ink(trunk, 1.08);
  const leafM = toon(0x57bf64);
  [[0, 1.5, 0, 0.85], [0.4, 1.9, 0.1, 0.6], [-0.35, 1.85, -0.1, 0.55]].forEach(([x, y, z, r]) => {
    const l = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 12), leafM); l.position.set(x, y, z); l.castShadow = true; ink(l, 1.07); g.add(l);
  });
  g.add(trunk);
  return g;
}

export function makeBush() {
  const g = new THREE.Group(), m = toon(0x63c773);
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.4 + Math.random() * 0.25, 12, 12), m);
    s.position.set((Math.random() - 0.5) * 0.7, 0.35, (Math.random() - 0.5) * 0.5); s.castShadow = true; ink(s, 1.08); g.add(s);
  }
  return g;
}

export function makeFlower() {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), toon(0x4f9d57)); stem.position.y = 0.25;
  const cols = [0xff5fa6, 0xffcf3a, 0x9a7bff, 0xff8a4a];
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), toon(cols[(Math.random() * cols.length) | 0], { emissive: 0x110011 }));
  top.position.y = 0.52; top.scale.y = 0.7; ink(top, 1.12); g.add(stem, top);
  return g;
}

// Clouds are positioned on creation; caller adds the returned group to the scene.
export function makeCloud() {
  const g = new THREE.Group(), m = toon(0xffffff);
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.9 + Math.random() * 0.6, 12, 12), m);
    p.position.set(i * 0.9 - 0.9, Math.random() * 0.3, 0); g.add(p);
  }
  g.scale.y = 0.7;
  g.position.set((Math.random() - 0.5) * 30, 6 + Math.random() * 4, -Math.random() * 60);
  return g;
}

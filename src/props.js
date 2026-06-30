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

  // Frostpeak — icy tundra. Pale sky + snow ground, so props lean saturated and
  // keep the dark ink edge — white-on-white would vanish.
  icespike: { action: 'jump', color: 0x7fb8e6, build: () => {
    const m = toon(0x7fb8e6, { emissive: 0x1f3a5a, flat: true }), g = new THREE.Group();
    const main = new THREE.Mesh(new THREE.ConeGeometry(0.46, 1.9, 6), m); main.position.y = 0.95; main.castShadow = true; ink(main, 1.08, 0x3a4a5a); g.add(main);
    [[-0.46, 0.55, 0.34], [0.44, 0.48, -0.36]].forEach(([x, h, z]) => { const c = new THREE.Mesh(new THREE.ConeGeometry(0.22, h * 2, 6), m); c.position.set(x, h, z); c.castShadow = true; ink(c, 1.12, 0x3a4a5a); g.add(c); });
    return g;
  } },
  snowman: { action: 'jump', color: 0xd6e6f2, build: () => {
    // Pale-blue body (not white) so it separates from the snow; dark coal eyes,
    // buttons and twig arms are what make it read at distance.
    const g = new THREE.Group(), m = toon(0xd6e6f2);
    const base = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 14), m); base.position.y = 0.55; base.castShadow = true; ink(base, 1.1);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 14), m); head.position.y = 1.32; head.castShadow = true; ink(head, 1.12);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.32, 8), toon(0xff8a3d)); nose.position.set(0, 1.32, 0.4); nose.rotation.x = Math.PI / 2; g.add(nose);
    const coal = toon(0x3a4a5a);
    [[-0.13, 1.4, 0.32, 0.05], [0.13, 1.4, 0.32, 0.05], [0, 0.72, 0.5, 0.06], [0, 0.46, 0.52, 0.06]].forEach(([x, y, z, r]) => { const c = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), coal); c.position.set(x, y, z); g.add(c); });
    const twig = toon(0x5a4632);
    [-1, 1].forEach(s => { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.62, 6), twig); a.position.set(s * 0.5, 0.72, 0); a.rotation.z = s * 0.9; a.castShadow = true; g.add(a); });
    g.add(base, head); return g;
  } },
  frostbar: { action: 'duck', color: 0xafd4f0, build: () => {
    const g = duckBar(toon(0xafd4f0, { emissive: 0x24465e }), toon(0xcfe6f2));
    const iceM = toon(0xcfeaff);
    [-0.5, 0.1, 0.6].forEach(x => { const ic = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 7), iceM); ic.position.set(x, 1.26, 0); ic.rotation.x = Math.PI; ic.castShadow = true; ink(ic, 1.1, 0x3a4a5a); g.add(ic); });
    return g;
  } },

  // Ember — volcanic ashlands. Dark ground, so the cooled-lava boulder lightens
  // to warm basalt and takes a *light* ink edge (a dark outline would vanish);
  // glowing cracks are the icon that reads "lava" instantly.
  lavarock: { action: 'jump', color: 0x6e5a52, build: () => {
    const g = new THREE.Group();
    const r = new THREE.Mesh(new THREE.IcosahedronGeometry(0.66, 0), toon(0x6e5a52, { flat: true })); r.position.y = 0.55; r.scale.set(1.3, 0.9, 1.1); r.castShadow = true; ink(r, 1.08, 0x9a8478); g.add(r);
    const lava = toon(0xff6a2a, { emissive: 0xff5a10, flat: true });
    const crackM = toon(0xff6a2a, { emissive: 0xff6a2a, flat: true });
    const glow = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), lava); glow.position.set(0.05, 0.78, 0.18); g.add(glow);
    [[-0.22, 0.55, 0.52, 0.5], [0.27, 0.6, 0.46, -0.4]].forEach(([x, y, z, rz]) => { const c = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.11, 0.07), crackM); c.position.set(x, y, z); c.rotation.z = rz; g.add(c); });
    return g;
  } },
  emberspire: { action: 'jump', color: 0xc23a1a, build: () => {
    const g = new THREE.Group(), m = toon(0xc23a1a, { emissive: 0x7a2008, flat: true });
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.46, 1.9, 7), m); spire.position.y = 0.95; spire.castShadow = true; ink(spire, 1.06); g.add(spire);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 7), toon(0xff8a2d, { emissive: 0xff8a2d })); tip.position.y = 1.75; ink(tip, 1.1); g.add(tip);
    return g;
  } },
  emberbar: { action: 'duck', color: 0xc24a1e, build: () => {
    const g = duckBar(toon(0xc24a1e, { emissive: 0x8a3a10 }), toon(0x4a2620), [1.7, 0.34, 0.34]);
    const dripM = toon(0xff7a2a, { emissive: 0xff7a2a });
    [-0.5, 0.1, 0.6].forEach(x => { const d = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 7), dripM); d.position.set(x, 1.3, 0); d.rotation.x = Math.PI; d.castShadow = true; ink(d, 1.1); g.add(d); });
    return g;
  } },

  // Reef — sunlit coral seabed. Strong palette already; props just need bulk and
  // a deeper pink so they don't wash out on the pale sand.
  coral: { action: 'jump', color: 0xff7aa8, build: () => {
    const g = new THREE.Group(), m = toon(0xff7aa8, { emissive: 0x3a0a18 }), tipM = toon(0xffc2da);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.85, 8), m); trunk.position.y = 0.42; trunk.castShadow = true; ink(trunk, 1.07); g.add(trunk);
    [[-0.32, 1.0, 0.55], [0.34, 1.1, -0.45], [0, 1.4, 0]].forEach(([x, y, rz]) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.21, 0.8, 8), m); b.position.set(x, y, 0); b.rotation.z = rz; b.castShadow = true; ink(b, 1.1); g.add(b);
      const nub = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), tipM); nub.position.set(x - Math.sin(rz) * 0.4, y + Math.cos(rz) * 0.4, 0); ink(nub, 1.1); g.add(nub);
    });
    return g;
  } },
  clam: { action: 'jump', color: 0xff8fb0, build: () => {
    const g = new THREE.Group(), m = toon(0xff8fb0);
    const lower = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), m); lower.position.y = 0.6; lower.castShadow = true; ink(lower, 1.06);
    const upper = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), m); upper.position.y = 0.68; upper.rotation.x = -0.55; upper.castShadow = true; ink(upper, 1.06);
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), toon(0xfff4ff, { emissive: 0xddc8dd })); pearl.position.y = 0.6;
    g.add(lower, upper, pearl); return g;
  } },
  kelp: { action: 'duck', color: 0x2f9f6a, build: () => {
    const g = duckBar(toon(0x2f9f6a, { emissive: 0x0a3a22 }), toon(0x3a6a4a));
    const bladeM = toon(0x3fb58a);
    [-0.6, -0.1, 0.4, 0.7].forEach((x, i) => { const k = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.62, 0.06), bladeM); k.position.set(x, 1.25, 0); k.rotation.z = (i % 2 ? 0.2 : -0.2); k.castShadow = true; ink(k, 1.1); g.add(k); });
    return g;
  } },
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

// Pastel skin tones for the roadside fans — variations on the player's own
// peachy hue so the crowd reads as a gaggle of look-alike pals, not clones.
const CHEER_SKINS = [0xffbfa8, 0xffd0b0, 0xffb0c2, 0xf7c8a0, 0xffc6d8, 0xe9bfff];

// One pint-sized fan: a butt-with-ears like the hero, arms thrown up mid-cheer.
// userData.arms are handed back so the crowd can wave them each frame.
function makeCheerer() {
  const g = new THREE.Group();
  const skin = toon(CHEER_SKINS[(Math.random() * CHEER_SKINS.length) | 0]);
  const inner = toon(0xff7ea6), blushM = toon(0xff8fa0, { emissive: 0xff5577 });
  [-0.24, 0.24].forEach(x => {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.4, 18, 18), skin);
    cheek.position.set(x, 0.42, 0); cheek.scale.set(1, 1.06, 1.02); cheek.castShadow = true; ink(cheek, 1.07); g.add(cheek);
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.1, 14), blushM);
    blush.position.set(x * 1.1, 0.36, 0.38); g.add(blush);
  });
  [-0.22, 0.22].forEach((x, i) => {
    const ear = new THREE.Group();
    const o = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 14), skin); o.scale.set(1, 2.3, 0.7); o.castShadow = true; ink(o, 1.1);
    const n = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 12), inner); n.scale.set(1, 2.1, 0.6); n.position.z = 0.05;
    ear.add(o, n); ear.position.set(x, 0.82, -0.04); ear.rotation.z = i ? -0.22 : 0.22; g.add(ear);
  });
  // Two arms thrown up to cheer, each with a little round hand. They're stored so
  // the crowd waves them; the resting pose already reads as a celebration.
  const arms = [];
  [-1, 1].forEach(s => {
    const arm = new THREE.Group();
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.42, 8), skin); limb.position.y = 0.21; ink(limb, 1.1);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), skin); hand.position.y = 0.45; ink(hand, 1.1);
    arm.add(limb, hand); arm.position.set(s * 0.34, 0.5, 0.08); arm.rotation.z = s * 0.7;
    g.add(arm); arms.push(arm);
  });
  [-0.18, 0.18].forEach(x => {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), skin);
    f.scale.set(1, 0.55, 1.4); f.position.set(x, 0.06, 0.18); f.castShadow = true; ink(f, 1.12); g.add(f);
  });
  g.userData.arms = arms;
  return g;
}

// A roadside crowd of fans cheering the runner across a finish line. Returns a
// group of mini look-alikes lined up on both verges, beyond the banner posts.
// Every call lays them out a little differently — count, spots, scale, lean and
// their hop phase are all randomised — so no two stage-ends look the same.
export function makeCheerCrowd() {
  const g = new THREE.Group();
  const fans = [];
  [-1, 1].forEach(side => {
    const n = 2 + (Math.random() * 3 | 0);                  // 2–4 fans per verge
    for (let i = 0; i < n; i++) {
      const f = makeCheerer();
      f.position.set(side * (4.3 + Math.random() * 2.0), 0, -1.6 + Math.random() * 3.4);
      f.rotation.y = -side * (0.4 + Math.random() * 0.5);   // angle in toward the track
      const sc = 0.82 + Math.random() * 0.42;
      f.scale.setScalar(sc);
      f.userData.base = sc;
      f.userData.phase = Math.random() * Math.PI * 2;
      f.userData.hop = 0.14 + Math.random() * 0.14;
      f.userData.rate = 7 + Math.random() * 4;
      g.add(f); fans.push(f);
    }
  });
  g.userData.fans = fans;
  return g;
}

// Per-frame bounce + arm-wave for a crowd from makeCheerCrowd(). `t` is the
// running sim time; each fan hops on its own phase so the crowd looks lively.
export function tickCheerCrowd(crowd, t) {
  for (const f of crowd.userData.fans) {
    const u = f.userData, ph = t * u.rate + u.phase;
    f.position.y = Math.max(0, Math.sin(ph)) * u.hop;       // little excited hops
    const sq = 1 - Math.max(0, Math.sin(ph)) * 0.12;        // squash on the way up
    f.scale.set(u.base / Math.sqrt(sq), u.base * sq, u.base / Math.sqrt(sq));
    u.arms.forEach((arm, i) => { arm.rotation.z = (i ? -1 : 1) * (0.7 + Math.sin(ph * 1.6 + i) * 0.4); });
  }
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

// 🔥 Comet Trail — a blazing wake streaming off the tail. Run hotter.
// Body zone: behind the tail on the camera-facing side (+z). Solid toon flame
// tongues (NOT additive — additive warm light vanishes on the pale path) with a
// hot-pink inner tongue for contrast on every biome. See src/upgrades/_example.js.
import * as THREE from 'three';
import { toon } from '../materials.js';

// hot core -> cool tip, graded so it reads as a tapering flame. Anchored low
// and deep behind the tail so it streams backward like a wake, not a lump on
// the back; the two outer tongues stay faint so it doesn't read as solid orange.
const TONGUES = [
  { color: 0xff6b35, r: 0.18, h: 0.5, z: 0.9, y: 0.72, op: 0.85 },
  { color: 0xff9e40, r: 0.13, h: 0.35, z: 1.15, y: 0.66, op: 0.6 },
  { color: 0xffd23f, r: 0.09, h: 0.22, z: 1.38, y: 0.6, op: 0.45 },
];
const PINK = 0xff477e;   // contrast tongue — pops against warm peach ground
const RAKE = Math.PI / 2 + 0.22;   // apex points +z and rakes down toward the ground

export default {
  id: 'comettrail',
  icon: '🔥',
  name: 'Comet Trail',
  desc: 'Run hotter. A blazing wake off your tail.',
  max: 3,
  order: 50,

  cost: (l) => [350, 700, 1300][l],

  gate: (l) => [
    { test: (s) => s.maxLevel >= 16, label: 'Reach Lv 16' },
    { test: (s) => s.maxLevel >= 20, label: 'Reach Lv 20' },
    { test: (s) => s.maxLevel >= 24, label: 'Reach Lv 24' },
  ][l] || null,

  mods: (tier, m) => { m.speedMult *= 1 + 0.03 * tier; },

  // ---- worn 3D prop: solid toon flame tongues trailing off the tail ----
  build() {
    const g = new THREE.Group();
    const segs = [];

    // a hot-pink inner tongue sits at the base for cross-biome contrast.
    const inner = new THREE.Mesh(
      new THREE.ConeGeometry(0.11, 0.4, 10),
      toon(PINK, { transparent: true, opacity: 0.6 }));
    inner.rotation.x = RAKE;   // rakes backward + down like the wake
    inner.position.set(0, 0.72, 0.82);
    g.add(inner);
    segs.push({ mesh: inner, baseH: 0.4 });

    TONGUES.forEach(({ color, r, h, z, y, op }) => {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(r, h, 10),
        toon(color, { transparent: true, opacity: op }));
      cone.rotation.x = RAKE;   // rakes backward + down like the wake
      cone.position.set(0, y, z);
      g.add(cone);
      segs.push({ mesh: cone, baseH: h });
    });

    g.userData.segs = segs;
    return g;
  },
  scale: (tier) => 0.85 + 0.12 * tier,
  tick(g, t) {
    const segs = g.userData.segs;
    if (!segs) return;
    segs.forEach((s, i) => {
      // licking flicker: stretch length + a small side wobble per tongue.
      s.mesh.scale.y = 1 + 0.25 * Math.sin(t * 8 + i);
      s.mesh.rotation.z = Math.sin(t * 6 + i * 1.3) * 0.09;
    });
  },
};

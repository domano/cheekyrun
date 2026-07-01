// 🃏 Gambler's Cape — a flowing crimson cape clasped at the neck: more rolls,
// but it thins the shields. High risk, high reward for a late-game min-maxer.
// Contract: shop entry + mods(tier,m) + worn-prop build/scale/tick — see
// src/lategame/_example.js. Body zone: camera-facing upper/lower back (+z);
// a squashed open cone reads as the drape, a torus arc as the collar.
import * as THREE from 'three';
import { toon, ink } from '../materials.js';

const CRIMSON = 0xc0392b; // cape body
const DEEP = 0x8e2f26;    // collar band — dark rolled-fabric, not pool-ring red
const LINING = 0xe8b4c8;  // peachy-pink lining sliver
const GOLD = 0xf39c12;    // clasp

export default {
  id: 'gamblerscape',
  icon: '🃏',
  name: "Gambler's Cape",
  desc: 'More rolls, fewer nets. High stakes.',
  max: 3,
  order: 10,

  cost: (l) => [300, 600, 1200][l],

  gate: (l) => [
    { test: (s) => s.maxLevel >= 20, label: 'Reach Lv 20' },
    { test: (s) => s.maxLevel >= 22, label: 'Reach Lv 22' },
    { test: (s) => s.maxLevel >= 25, label: 'Reach Lv 25' },
  ][l] || null,

  mods: (tier, m) => {
    m.rollX *= 1 + 0.15 * tier;
    m.obstacleMult *= 1 + 0.06 * tier;
    if (tier >= 3) m.noShields = true;
  },

  // ---- worn 3D prop: a real draping cape on the camera-facing back ----
  build() {
    const g = new THREE.Group();

    // collar band the cape hangs from — a ~200° torus arc laid across the
    // shoulders so the drape has an anchor instead of floating.
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.06, 8, 20, Math.PI * 1.2), toon(DEEP));
    collar.rotation.z = -0.31;      // centre the arc over the top
    collar.rotation.x = 0.45;       // tilt to lie on the back-facing shoulders
    collar.position.set(0, 1.0, 0.28);
    ink(collar, 1.08);
    g.add(collar);

    // cape body: a wide shallow open cone — the flat hem reads instantly as
    // fabric. Squashed in z so it wraps the round back rather than ballooning.
    const cape = new THREE.Mesh(
      new THREE.ConeGeometry(0.62, 0.95, 10, 1, true), toon(CRIMSON));
    cape.scale.set(1.15, 1, 0.55);
    cape.position.set(0, 0.55, 0.2);
    cape.rotation.x = 0.21;         // flare the hem outward/back
    ink(cape, 1.05);
    g.add(cape);

    // a sliver of peachy lining just inside the hem — the "luxury" pop.
    const lining = new THREE.Mesh(
      new THREE.ConeGeometry(0.62, 0.95, 10, 1, true),
      toon(LINING, { transparent: true, opacity: 0.95 }));
    lining.scale.set(1.15 * 0.92, 0.92, 0.55 * 0.92);
    lining.position.copy(cape.position);
    lining.rotation.x = cape.rotation.x;
    g.add(lining);

    // gold clasp — a little sphere dead-centre on the collar, camera-facing.
    const clasp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), toon(GOLD));
    clasp.position.set(0, 1.05, 0.42);
    ink(clasp, 1.12);
    g.add(clasp);

    g.userData.cape = cape;
    g.userData.lining = lining;
    return g;
  },
  scale: (tier) => 0.96 + 0.07 * tier,
  tick(g, t) {
    // gentle hem sway so the cloth reads as cloth, not cardboard.
    const sway = Math.sin(t * 1.5) * 0.052;
    if (g.userData.cape) g.userData.cape.rotation.x = 0.21 + sway;
    if (g.userData.lining) g.userData.lining.rotation.x = 0.21 + sway;
  },
};

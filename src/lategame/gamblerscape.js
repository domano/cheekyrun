// 🃏 Gambler's Cape — a flowing crimson cape clasped at the neck: more rolls,
// but it thins the shields. High risk, high reward for a late-game min-maxer.
// Contract: shop entry + mods(tier,m) + worn-prop build/scale/tick — see
// src/lategame/_example.js. Body zone: NECK/BACK (free — nothing else there).
import * as THREE from 'three';
import { toon, ink } from '../materials.js';

const CRIMSON = 0xc0392b;
const GOLD = 0xe6b800;

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

  // ---- worn 3D prop: neck/back-of-neck, draping down behind the cheeks ----
  build() {
    const g = new THREE.Group();
    const capeM = toon(CRIMSON);
    const goldM = toon(GOLD);

    // three tapered flat panels, wide at the shoulders narrowing toward the
    // hem, slightly overlapped and angled so the cape reads as one draping
    // sheet rather than three flat cards.
    const panelDefs = [
      { w: 0.34, h: 0.62, x: -0.22, rz: 0.12 },
      { w: 0.4, h: 0.68, x: 0, rz: 0 },
      { w: 0.34, h: 0.62, x: 0.22, rz: -0.12 },
    ];
    const panels = panelDefs.map((d) => {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(d.w, d.h, 0.02), capeM);
      panel.position.set(d.x, -d.h / 2 + 0.06, 0);
      panel.rotation.z = d.rz;
      panel.rotation.x = 0.3; // drape down over the camera-facing back
      ink(panel, 1.08);
      g.add(panel);
      return panel;
    });

    // gold clasp at the neck, small torus sitting above the panels
    const clasp = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 8, 18), goldM);
    clasp.position.set(0, 0.24, 0.06);
    clasp.rotation.x = Math.PI / 2;
    ink(clasp, 1.1);
    g.add(clasp);

    g.userData.panels = panels;

    // anchor high on the camera-facing back (+z), draping down the visible side
    g.position.set(0, 1.06, 0.32);
    return g;
  },
  scale: (tier) => 0.96 + 0.07 * tier,
  tick(g, t) {
    const panels = g.userData.panels;
    if (!panels) return;
    panels.forEach((p, i) => {
      p.rotation.x = 0.3 + Math.sin(t * 1.8 + i * 0.7) * 0.1;
      p.rotation.z = [0.12, 0, -0.12][i] + Math.sin(t * 1.3 + i) * 0.05;
    });
  },
};

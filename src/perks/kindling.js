// 🔥 Kindling — a struck match leaned against the right-outer cheek, its
// two-tone flame flickering away.
// Mechanic (main.js): consecutive near-misses/skims inside KINDLING_WINDOW
// build a spark chain; every KINDLING_LINKS-th link flings a bonus roll onto
// the road ahead. Stacking: each stack past the first shortens the chain by
// one link (mods.kindling is the stack count) — the flame burns taller for it.
import * as THREE from 'three';
import { toon, ink } from '../materials.js';

const WOOD = 0xe8c79a;
const HEAD = 0xc43a2e;
const CORE = 0xff6a2b;   // bright inner flame
const OUTER = 0xffb03a;  // outer flame colour

export default {
  id: 'kindling',
  icon: '🔥', name: 'Kindling', desc: 'Chain near-misses to spark bonus rolls ahead.',
  rarity: 'rare', weight: 35, stack: 2, order: 230,
  apply: (m) => { m.kindling += 1; },
  build() {
    const g = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.24, 8), toon(WOOD));
    ink(stick, 1.14); g.add(stick);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), toon(HEAD, { flat: true }));
    tip.scale.y = 1.2; tip.position.y = 0.13; ink(tip, 1.12); g.add(tip);
    // two-tone glow flame riding the tip — translucent, no outline
    const flame = new THREE.Group(); flame.position.y = 0.18;
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 8),
      new THREE.MeshBasicMaterial({ color: OUTER, transparent: true, opacity: 0.9, depthWrite: false }));
    outer.position.y = 0.07; flame.add(outer);
    const core = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.09, 8),
      new THREE.MeshBasicMaterial({ color: CORE, transparent: true, opacity: 0.9, depthWrite: false }));
    core.position.y = 0.05; flame.add(core);
    g.add(flame); g.userData.flame = flame; g.userData.core = core;
    // leaned against the right-outer cheek's silhouette edge, tipped ~31° out
    // so stick, head and flame all read against the sky
    g.position.set(0.8, 0.72, 0.4);
    g.rotation.z = -0.55;
    g.scale.setScalar(1.2);
    return g;
  },
  // a 2nd stack burns taller, not bulkier — tick reads the group scale as its cue
  scale: (stacks) => 1.2 * (stacks >= 2 ? 1.02 : 1),
  tick(g, t) {
    const tall = g.scale.x > 1.21 ? 1.35 : 1;
    g.userData.flame.scale.y = tall * (1 + Math.sin(t * 12) * 0.1);
    g.userData.core.material.opacity = 0.85 + Math.sin(t * 31) * 0.07;
  },
};

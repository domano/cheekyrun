// 🔥 Kindling — a struck match leaned against the right-outer cheek, its
// two-tone flame flickering away.
// Mechanic (main.js): consecutive near-misses/skims inside KINDLING_WINDOW
// build a spark chain; every KINDLING_LINKS-th link flings a bonus roll onto
// the road ahead. Stacking: each stack past the first shortens the chain by
// one link (mods.kindling is the stack count) — the flame burns taller for it.
import * as THREE from 'three';
import { toon, ink } from '../materials.js';

const WOOD = 0xf3e0b8;
const HEAD = 0xe8554e;
const CORE = 0xffd24a;   // bright inner flame
const OUTER = 0xff7a2e;  // outer flame colour

export default {
  id: 'kindling',
  icon: '🔥', name: 'Kindling', desc: 'Chain near-misses to spark bonus rolls ahead.',
  rarity: 'rare', weight: 35, stack: 2, order: 230,
  apply: (m) => { m.kindling += 1; },
  build() {
    const g = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.26, 8), toon(WOOD));
    ink(stick, 1.14); g.add(stick);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 10), toon(HEAD, { flat: true }));
    tip.scale.y = 1.25; tip.position.y = 0.14; ink(tip, 1.12); g.add(tip);
    // two-tone glow flame riding the tip — translucent, no outline
    const flame = new THREE.Group(); flame.position.y = 0.17;
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 8),
      new THREE.MeshBasicMaterial({ color: OUTER, transparent: true, opacity: 0.9, depthWrite: false }));
    outer.position.y = 0.07; flame.add(outer);
    const core = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.085, 8),
      new THREE.MeshBasicMaterial({ color: CORE, transparent: true, opacity: 0.9, depthWrite: false }));
    core.position.y = 0.05; flame.add(core);
    g.add(flame); g.userData.flame = flame; g.userData.core = core;
    // leaned against the right-outer cheek, tipped out so the flame reads
    g.position.set(0.68, 0.78, 0.3);
    g.rotation.z = -0.35;
    return g;
  },
  // a 2nd stack burns taller, not bulkier — tick reads the group scale as its cue
  scale: (stacks) => (stacks >= 2 ? 1.02 : 1),
  tick(g, t) {
    const tall = g.scale.x > 1.01 ? 1.35 : 1;
    g.userData.flame.scale.y = tall * (1 + Math.sin(t * 12) * 0.1);
    g.userData.core.material.opacity = 0.85 + Math.sin(t * 31) * 0.07;
  },
};

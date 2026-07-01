// 🎯 Perfectionist — a bullseye target badge pinned on the left cheek, pulsing
// gently as if proud of every clean near-miss.
// Worn-gear members (the full perk-file template is ./_example.js):
//   id     — the perk id; also the key for its worn prop (see player.js).
//   build()        → a THREE.Object3D, already positioned/oriented on the body.
//                    Built once, hidden; the game shows it when the perk is drafted.
//   scale(stacks)  → optional scalar so more stacks read a touch bigger. Keep it
//                    modest — tier shows through detail, not bulk (see applyGear).
//   tick(g, t, dt) → optional per-frame animation (t = elapsed secs, dt = frame).
// Keep the house style: every solid mesh gets toon() + an ink() outline; glows
// stay translucent with no outline; cheap primitives only; stay readable small.
import * as THREE from 'three';
import { toon, ink } from '../materials.js';

const RED = 0xe8554e;
const WHITE = 0xffffff;
const DART = 0x6b6f76; // dull metal dart body

export default {
  id: 'perfectionist',
  icon: '🎯', name: 'Perfectionist', desc: 'Near-misses pay 3×, but rolls give no combo.',
  rarity: 'epic', weight: 20, stack: 1, order: 160,
  // A keystone dodge build: rolls no longer feed the combo, so the only way to
  // keep a streak alive is to thread obstacles — and those near-misses pay triple.
  apply: (m) => { m.nearMissMult *= 3; m.rollsNoCombo = true; },
  build() {
    const g = new THREE.Group();
    const redM = toon(RED, { flat: true });
    const whiteM = toon(WHITE);
    const dartM = toon(DART, { flat: true });

    // concentric rings, stacked along +z so they face the camera
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 16), redM);
    outer.rotation.x = Math.PI / 2; outer.position.z = 0; ink(outer, 1.1); g.add(outer);

    const mid = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.02, 16), whiteM);
    mid.rotation.x = Math.PI / 2; mid.position.z = 0.014; ink(mid, 1.08); g.add(mid);

    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 16), redM);
    inner.rotation.x = Math.PI / 2; inner.position.z = 0.028; ink(inner, 1.08); g.add(inner);

    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), whiteM);
    dot.position.z = 0.045; ink(dot, 1.15); g.add(dot);

    // a tiny dart stuck near centre at a jaunty angle
    const dart = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.13, 8), dartM);
    dart.position.set(0.025, 0.02, 0.06);
    dart.rotation.set(Math.PI / 2 + 0.3, 0, 0.5);
    ink(dart, 1.15);
    g.add(dart);

    g.userData.rings = [outer, mid, inner, dot, dart];
    // pinned on the camera-facing left cheek
    g.position.set(-0.3, 0.56, 0.6);
    return g;
  },
  scale: () => 1,
  tick(g, t) {
    const s = 1 + Math.sin(t * 3) * 0.04;
    g.scale.setScalar(s);
  },
};

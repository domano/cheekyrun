// 🌟 Hot Streak — warm flame tufts licking up the base of the fluffy tail.
// Reference template for a perk-gear prop: default-export an object with
//   id     — the perk id (must match perks.js); also its key in PERK_GEAR.
//   build()        → a THREE.Object3D, already positioned/oriented on the body.
//                    Built once, hidden; the game shows it when the perk is drafted.
//   scale(stacks)  → optional scalar so more stacks read a touch bigger. Keep it
//                    modest — tier shows through detail, not bulk (see applyGear).
//   tick(g, t, dt) → optional per-frame animation (t = elapsed secs, dt = frame).
// Keep the house style: every solid mesh gets toon() + an ink() outline; glows
// stay translucent with no outline; cheap primitives only; stay readable small.
import * as THREE from 'three';
import { toon, ink } from '../materials.js';

const BASE = 0xffa12e; // orange flame base
const TIP = 0xffe26a;  // translucent yellow flame tip

export default {
  id: 'hotstreak',
  build() {
    const g = new THREE.Group();
    const baseM = toon(BASE, { flat: true });
    g.userData.flames = [];
    // a small fan of flame tufts hugging the lower tail, licking upward
    const spots = [
      { x: -0.1, z: 0.02, h: 0.16 },
      { x: 0.07, z: 0.04, h: 0.13 },
      { x: -0.02, z: -0.06, h: 0.19 },
      { x: 0.14, z: -0.02, h: 0.12 },
    ];
    spots.forEach(({ x, z, h }, i) => {
      const flame = new THREE.Group();
      const base = new THREE.Mesh(new THREE.ConeGeometry(0.055, h, 8), baseM);
      base.position.y = h / 2;
      ink(base, 1.1);
      flame.add(base);
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.032, h * 0.55, 8),
        new THREE.MeshBasicMaterial({ color: TIP, transparent: true, opacity: 0.75, depthWrite: false }),
      );
      tip.position.y = h * 0.85;
      flame.add(tip);
      flame.position.set(x, 0, z);
      g.add(flame);
      g.userData.flames.push({ group: flame, tip, baseH: h, phase: i * 1.3 });
    });
    // wrapping the base of the fluffy tail, low and centred
    g.position.set(0, 0.9, 0.5);
    return g;
  },
  scale: () => 1,
  tick(g, t) {
    g.userData.flames.forEach(({ group, tip, phase }) => {
      const ph = t * 13 + phase;
      const flick = Math.abs(Math.sin(ph));
      group.scale.y = 0.75 + flick * 0.4;
      tip.material.opacity = 0.45 + flick * 0.45;
    });
  },
};

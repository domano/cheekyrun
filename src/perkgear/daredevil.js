// 😎 Daredevil — chunky toon sunglasses worn across the cheeks, glint pulsing.
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

const LENS = 0x1a1a22;   // glossy black
const GLINT = 0xffffff;  // sparkle

export default {
  id: 'daredevil',
  build() {
    const g = new THREE.Group();
    const lensM = toon(LENS, { flat: true });
    [-1, 1].forEach((side) => {
      // rounded lens — flattened sphere, glossy black, inked
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), lensM);
      lens.position.set(0.16 * side, 0, 0);
      lens.scale.set(1, 0.85, 0.45);
      ink(lens, 1.1);
      g.add(lens);
    });
    // small bridge joining the lenses
    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.1, 8), lensM);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.01, 0.04);
    ink(bridge, 1.15);
    g.add(bridge);
    // tiny glint on the left lens (camera's right), no ink — pure highlight
    const glint = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 8, 8),
      new THREE.MeshBasicMaterial({ color: GLINT, transparent: true, opacity: 0.9, depthWrite: false }),
    );
    glint.position.set(-0.12, 0.04, 0.05);
    g.add(glint);
    g.userData.glint = glint;
    // across the cheeks, facing the camera
    g.position.set(0, 0.86, 0.6);
    return g;
  },
  scale: (stacks) => 0.95 + 0.08 * stacks,
  tick(g, t) {
    const pulse = Math.abs(Math.sin(t * 2.2));
    g.userData.glint.scale.setScalar(0.6 + pulse * 0.7);
  },
};

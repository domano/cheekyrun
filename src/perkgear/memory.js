// 🧠 Long Memory — a lavender brain-bun haloed by a soft glowing ring,
// hovering just above the head. Reference template: overdrive.js.
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

const BRAIN = 0xc6a8ff;   // lavender brain-bun
const HALO = 0xe6d8ff;    // pale glow ring

export default {
  id: 'memory',
  build() {
    const g = new THREE.Group();
    const brainM = toon(BRAIN);

    // main brain-bun lobe
    const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), brainM);
    ink(lobe, 1.08); g.add(lobe);

    // two shallow grooves — squashed spheres tucked into the lobe for a folded look
    [-0.07, 0.07].forEach((x) => {
      const groove = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), brainM);
      groove.position.set(x, 0.02, 0.05);
      groove.scale.set(0.8, 0.6, 0.9);
      ink(groove, 1.08); g.add(groove);
    });

    // thin translucent halo ring, laid roughly flat above the lobe
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.17, 0.018, 8, 20),
      new THREE.MeshBasicMaterial({ color: HALO, transparent: true, opacity: 0.5, depthWrite: false }),
    );
    halo.rotation.x = Math.PI / 2 - 0.15;
    halo.position.y = 0.07;
    g.add(halo);
    g.userData.halo = halo;

    // floats just above the head
    g.position.set(0, 1.82, 0.05);
    return g;
  },
  scale: (stacks) => 0.92 + 0.12 * stacks,
  tick(g, t) {
    g.position.y = 1.82 + Math.sin(t * 2.4) * 0.025;
    g.userData.halo.rotation.z = t * 1.2;
  },
};

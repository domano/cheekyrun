// 🧠 Long Memory — a lavender brain-bun haloed by a soft glowing ring,
// hovering just above the head. Reference template: overdrive.js.
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

const BRAIN = 0xc7b4e8;     // lavender brain-bun
const GROOVE = 0xa98fd6;    // darker squiggle grooves
const HALO = 0xf4d873;      // gold glow ring

export default {
  id: 'memory',
  icon: '🧠', name: 'Long Memory', desc: 'Combo lasts 40% longer.',
  rarity: 'rare', weight: 50, stack: 2, order: 50,
  apply: (m) => { m.comboWindowMult *= 1.4; },
  build() {
    const g = new THREE.Group();
    const brainM = toon(BRAIN);
    const grooveM = toon(GROOVE);

    // main brain-bun lobe (×0.9 of the old 0.13 radius)
    const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.117, 12, 10), brainM);
    ink(lobe, 1.08); g.add(lobe);

    // a couple of darker squiggle grooves — thin tube curves hugging the lobe, reads "brain"
    [-0.04, 0.05].forEach((x, i) => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x - 0.05, 0.02, 0.07),
        new THREE.Vector3(x, 0.05, 0.08),
        new THREE.Vector3(x + 0.03, -0.01, 0.075),
        new THREE.Vector3(x + 0.06, 0.03, 0.06),
      ]);
      const groove = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.012, 6, false), grooveM);
      if (i === 1) groove.rotation.y = Math.PI * 0.5;
      ink(groove, 1.08); g.add(groove);
    });

    // flat gold halo ring, tilted toward camera so it reads as a ring not a line
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.04, 8, 20),
      new THREE.MeshBasicMaterial({ color: HALO, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    halo.rotation.x = THREE.MathUtils.degToRad(70);
    halo.position.set(0, 0.2, 0);
    g.add(halo);
    g.userData.halo = halo;

    // hover just above the ears, below the HUD
    g.position.set(0, 1.85, 0);
    return g;
  },
  scale: (stacks) => 0.92 + 0.12 * stacks,
  tick(g, t) {
    g.position.y = 1.85 + Math.sin(t * 2.4) * 0.05;
    g.userData.halo.rotation.z = t * 1.2;
  },
};

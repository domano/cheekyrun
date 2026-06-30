// 🏎️ Overdrive — twin chrome exhaust pipes low on the back, puffing as you rip.
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

const PIPE = 0xd6dde4;   // chrome
const TIP = 0xe8554e;    // cherry-red mouth (warm family, shared with the rocket)

export default {
  id: 'overdrive',
  build() {
    const g = new THREE.Group();
    const pipeM = toon(PIPE), tipM = toon(TIP, { flat: true });
    g.userData.puffs = [];
    [-0.2, 0.2].forEach((x) => {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.34, 10), pipeM);
      pipe.position.set(x, 0, 0); pipe.rotation.x = -0.5; ink(pipe, 1.1); g.add(pipe);
      const mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.07, 10), tipM);
      mouth.position.set(x, -0.16, -0.09); mouth.rotation.x = -0.5; ink(mouth, 1.12); g.add(mouth);
      // a soft exhaust puff that pulses out the back of each pipe
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xeef2f6, transparent: true, opacity: 0.5, depthWrite: false }),
      );
      puff.position.set(x, -0.24, -0.16); g.add(puff); g.userData.puffs.push(puff);
    });
    // low and centred on the back, mouths kicking out behind the hips
    g.position.set(0, 0.32, 0.5);
    return g;
  },
  scale: (stacks) => 0.92 + 0.12 * stacks,
  tick(g, t) {
    g.userData.puffs.forEach((p, i) => {
      const ph = t * 9 + i * Math.PI;
      const s = 0.7 + Math.abs(Math.sin(ph)) * 0.8;
      p.scale.setScalar(s);
      p.material.opacity = 0.18 + Math.abs(Math.sin(ph)) * 0.34;
    });
  },
};

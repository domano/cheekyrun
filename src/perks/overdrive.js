// 🏎️ Overdrive — twin chrome exhaust pipes low on the back, puffing as you rip.
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

const PIPE = 0xd6dde4;   // chrome
const TIP = 0xe8554e;    // cherry-red mouth (warm family, shared with the rocket)
const CAP = 0x3a3a42;    // dark exhaust opening so each pipe's mouth reads

export default {
  id: 'overdrive',
  icon: '🏎️', name: 'Overdrive', desc: '+18% speed — pure distance.',
  rarity: 'rare', weight: 45, stack: 2, order: 130,
  apply: (m) => { m.speedMult *= 1.18; },
  build() {
    const g = new THREE.Group();
    const pipeM = toon(PIPE), tipM = toon(TIP, { flat: true }), capM = toon(CAP, { flat: true });
    g.userData.puffs = [];
    // wider stance (±0.26) so the twin pipes read as two, not one grey lump
    [-0.26, 0.26].forEach((x) => {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.34, 10), pipeM);
      pipe.position.set(x, 0, 0); pipe.rotation.x = -0.5; ink(pipe, 1.1); g.add(pipe);
      const mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.07, 10), tipM);
      mouth.position.set(x, -0.16, -0.09); mouth.rotation.x = -0.5; ink(mouth, 1.12); g.add(mouth);
      // a dark cap inset in the mouth so the exhaust opening reads
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 10), capM);
      cap.position.set(x, -0.185, -0.12); cap.rotation.x = -0.5; g.add(cap);
      // a soft exhaust puff that pulses out the back of each pipe
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xeef2f6, transparent: true, opacity: 0.5, depthWrite: false }),
      );
      puff.position.set(x, -0.24, -0.16); g.add(puff); g.userData.puffs.push(puff);
    });
    // low and centred on the back, mouths kicking out behind the hips
    g.position.set(0, 0.3, 0.5);
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

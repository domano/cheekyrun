// ⚡ Tailwind — twin swept speed-wings on the upper back, fluttering as you fly.
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

const WING = 0x9fe8ff;   // pale cyan
const TIP = 0xffffff;    // white leading tip

export default {
  id: 'tailwind',
  icon: '⚡', name: 'Tailwind', desc: 'Faster pace, richer rolls.',
  rarity: 'common', weight: 100, stack: 3, order: 10,
  apply: (m) => { m.speedMult *= 1.08; m.rollMult *= 1.10; },
  build() {
    const g = new THREE.Group();
    const wingM = toon(WING), tipM = toon(TIP, { flat: true });
    g.userData.wings = [];
    [-1, 1].forEach((side) => {
      const wing = new THREE.Group();
      // small angular wing — a flattened cone swept back, leading edge tipped white
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 4), wingM);
      blade.rotation.z = Math.PI / 2 * side;
      blade.rotation.y = -0.3 * side;
      blade.scale.set(1, 1, 0.35);
      ink(blade, 1.1);
      wing.add(blade);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.1, 4), tipM);
      tip.position.set(0.18 * side, 0, 0);
      tip.rotation.z = Math.PI / 2 * side;
      tip.rotation.y = -0.3 * side;
      tip.scale.set(1, 1, 0.35);
      ink(tip, 1.12);
      wing.add(tip);
      // swept outward and back off the spine
      wing.position.set(0.4 * side, 0, 0);
      wing.rotation.z = 0.44 * side; // ~25 deg out
      wing.rotation.x = -0.2;        // angled back
      g.add(wing);
      g.userData.wings.push({ wing, side });
    });
    // upper back, between the shoulder gear and the tail
    g.position.set(0, 0.9, 0.46);
    return g;
  },
  scale: (stacks) => 0.9 + 0.12 * stacks,
  tick(g, t) {
    g.userData.wings.forEach(({ wing, side }) => {
      wing.rotation.z = 0.44 * side + Math.sin(t * 8 + (side > 0 ? Math.PI : 0)) * 0.12;
    });
  },
};

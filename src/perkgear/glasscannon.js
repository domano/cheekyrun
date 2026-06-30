// 🥃 Glass Cannon — a little amber shot glass balanced at the left hip, trembling.
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

const GLASS = 0xffb24a;  // translucent amber
const LIQUID = 0xcc6a1a; // darker amber liquid
const CRACK = 0x3a2412;  // hairline crack, dark

export default {
  id: 'glasscannon',
  build() {
    const g = new THREE.Group();
    // truncated cone of translucent amber glass — open shot glass, no ink (it's glass)
    const glassM = toon(GLASS, { transparent: true, opacity: 0.55 });
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.07, 0.16, 12, 1, true), glassM);
    g.add(glass);
    // thin liquid line inside, sitting low in the glass
    const liquid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.085, 0.02, 12),
      new THREE.MeshBasicMaterial({ color: LIQUID, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    liquid.position.y = -0.04;
    g.add(liquid);
    // a solid foot disc under the glass — only solid part, gets toon + ink
    const footM = toon(GLASS, { flat: true });
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.015, 12), footM);
    foot.position.y = -0.085;
    ink(foot, 1.1);
    g.add(foot);
    // faint hairline cracks — thin dark slivers across the glass wall, no ink
    const crackM = new THREE.MeshBasicMaterial({ color: CRACK, transparent: true, opacity: 0.5, depthWrite: false });
    const crack1 = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.1, 0.006), crackM);
    crack1.position.set(0.085, 0.02, 0.03);
    crack1.rotation.z = 0.3;
    g.add(crack1);
    const crack2 = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.06, 0.005), crackM);
    crack2.position.set(0.07, -0.02, 0.06);
    crack2.rotation.z = -0.5;
    g.add(crack2);
    g.userData.base = new THREE.Euler(0, 0, 0);
    // balanced at the left hip
    g.position.set(-0.55, 0.52, 0.45);
    return g;
  },
  scale: () => 1,
  tick(g, t) {
    // nervous tremble — fast, tiny-amplitude jitter, it's fragile and cursed
    g.rotation.z = Math.sin(t * 26) * 0.05 + Math.sin(t * 41 + 1.3) * 0.02;
    g.rotation.x = Math.sin(t * 33 + 0.7) * 0.03;
  },
};

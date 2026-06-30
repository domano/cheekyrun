// 🪶 Featherfall — a fluffy plume tucked beside the left ear, swaying as you float.
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

const PLUME = 0xfdfdff;  // white feather
const QUILL = 0xbfe3ff;  // pale-blue quill spine

export default {
  id: 'featherfall',
  build() {
    const g = new THREE.Group();
    const plumeM = toon(PLUME), quillM = toon(QUILL, { flat: true });

    // flattened, elongated cone = the feather's fluffy vane
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.42, 8), plumeM);
    plume.scale.set(0.55, 1, 1);
    plume.position.set(0, 0.21, 0);
    ink(plume, 1.08);
    g.add(plume);

    // thin quill spine running through the vane, poking past the base
    const quill = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.5, 6), quillM);
    quill.position.set(0, 0.16, 0);
    ink(quill, 1.15);
    g.add(quill);

    // tucked beside the left ear, angled outward and up (nudged down so it
    // clears the level banner at the gameplay camera — Pixie's note)
    g.position.set(-0.4, 1.25, 0.05);
    g.rotation.z = 0.7; // ~40deg outward
    g.rotation.x = -0.2;
    g.userData.baseRotZ = g.rotation.z;
    return g;
  },
  scale: () => 1,
  tick(g, t) {
    // light as a feather — a gentle drifting sway
    g.rotation.z = g.userData.baseRotZ + Math.sin(t * 1.6) * 0.12;
  },
};

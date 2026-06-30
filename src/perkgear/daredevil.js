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

const FRAME = 0x2a2433;  // very-dark-charcoal, matches the ink — not pure black
const LENS = 0x1a1622;   // translucent smoke fill
const GLINT = 0xffffff;  // sparkle

export default {
  id: 'daredevil',
  build() {
    const g = new THREE.Group();
    const frameM = toon(FRAME, { flat: true });
    const lensM = new THREE.MeshBasicMaterial({
      color: LENS, transparent: true, opacity: 0.55, depthWrite: false,
    });
    const glintM = new THREE.MeshBasicMaterial({
      color: GLINT, transparent: true, opacity: 0.7, depthWrite: false,
    });
    const glints = [];
    [-1, 1].forEach((side) => {
      // rounded lens — flattened box, translucent smoke glass, no ink
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.26, 0.02), lensM);
      lens.position.set(0.26 * side, 0, 0.01);
      g.add(lens);
      // thin frame rim around the lens, inked
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 6, 16), frameM);
      rim.scale.set(1, 0.82, 1);
      rim.position.set(0.26 * side, 0, 0);
      ink(rim, 1.1);
      g.add(rim);
      // stubby arm hooking back toward the ear
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.03), frameM);
      arm.position.set(0.26 * side + 0.16 * side, 0, -0.06);
      arm.rotation.y = side * 0.5;
      ink(arm, 1.15);
      g.add(arm);
      // tiny white specular glint, top-left of each lens, no ink — pure highlight
      const glint = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.05), glintM);
      glint.position.set(0.26 * side - 0.07, 0.07, 0.025);
      g.add(glint);
      glints.push(glint);
    });
    // visible bridge bar connecting the lenses, inked
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.03), frameM);
    bridge.position.set(0, 0, 0.005);
    ink(bridge, 1.15);
    g.add(bridge);
    g.userData.glints = glints;
    // raised to straddle the cheek-tops, facing the camera, tilted to hug the curve
    g.position.set(0, 0.78, 0.78);
    g.rotation.x = THREE.MathUtils.degToRad(-8);
    return g;
  },
  scale: (stacks) => 0.95 + 0.08 * stacks,
  tick(g, t) {
    const pulse = Math.abs(Math.sin(t * 2.2));
    const s = 0.6 + pulse * 0.7;
    g.userData.glints.forEach((glint) => glint.scale.setScalar(s));
  },
};

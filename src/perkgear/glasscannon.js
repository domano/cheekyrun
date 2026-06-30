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
// (This prop is all translucent glass, so it's MeshBasicMaterial throughout — no ink.)
import * as THREE from 'three';

const GLASS = 0xe8a23d;   // translucent amber
const LIQUID = 0xc9781e;  // darker amber liquid, full shot
const HILITE = 0xfff3d6;  // bright rim highlight, near-white amber

export default {
  id: 'glasscannon',
  build() {
    const g = new THREE.Group();
    // short tapered shot glass, translucent amber — no ink, it's glass
    const glassM = new THREE.MeshBasicMaterial({ color: GLASS, transparent: true, opacity: 0.5, depthWrite: false });
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.26, 14, 1, true), glassM);
    g.add(glass);
    // liquid disc filling the bottom third — this amber fill is what reads as "full shot"
    const liquid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.12, 0.09, 14),
      new THREE.MeshBasicMaterial({ color: LIQUID, transparent: true, opacity: 0.7, depthWrite: false }),
    );
    liquid.position.y = -0.08;
    g.add(liquid);
    // single bright rim highlight quad to catch the eye
    const hilite = new THREE.Mesh(
      new THREE.PlaneGeometry(0.03, 0.22),
      new THREE.MeshBasicMaterial({ color: HILITE, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }),
    );
    hilite.position.set(0.1, 0.02, 0.1);
    hilite.rotation.y = 0.5;
    g.add(hilite);
    g.userData.base = new THREE.Euler(0, 0, 0);
    // worn at the left hip, pushed out + forward so the cheek edge doesn't
    // occlude it from the chase camera, scaled up to read at distance
    g.position.set(-0.78, 0.52, 0.85);
    g.scale.setScalar(1.8);
    return g;
  },
  scale: () => 1,
  tick(g, t) {
    // nervous tremble — fast, tiny-amplitude jitter, it's fragile and cursed
    g.rotation.z = Math.sin(t * 26) * 0.05 + Math.sin(t * 41 + 1.3) * 0.02;
    g.rotation.x = Math.sin(t * 33 + 0.7) * 0.03;
  },
};

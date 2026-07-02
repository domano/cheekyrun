// 💰 Double Down — a shiny gold coin medallion worn on a strap, rolls pay 2×.
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

const GOLD = 0xf2c14e;    // coin face
const RIM = 0xc9962e;     // darker raised rim
const STRAP = 0x7a4b2b;   // saddle-brown strap

const WOBBLE = THREE.MathUtils.degToRad(3); // ±3° coin-catching-light wobble

export default {
  id: 'doubledown',
  icon: '💰', name: 'Double Down', desc: 'Rolls are worth 2× always.',
  rarity: 'epic', weight: 30, stack: 1, order: 80,
  apply: (m) => { m.rollX *= 2; },
  build() {
    const g = new THREE.Group();
    const goldM = toon(GOLD), rimM = toon(RIM), strapM = toon(STRAP);

    // strap: two thin flat segments bent into a shallow chevron so it reads as a
    // band looped OVER the cheek (convex against the body), not a stick handle.
    // Lower segment rises from the coin; upper segment crests over the cheek-top.
    const strapLo = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.26, 0.015), strapM);
    strapLo.position.set(-0.05, 0.16, 0.0);
    strapLo.rotation.z = 0.7; strapLo.rotation.x = -0.2;
    ink(strapLo, 1.12); g.add(strapLo);
    const strapHi = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.015), strapM);
    strapHi.position.set(-0.15, 0.34, -0.12);
    strapHi.rotation.z = 1.35; strapHi.rotation.x = -0.45;
    ink(strapHi, 1.12); g.add(strapHi);

    // the coin itself: flat gold cylinder, face toward the camera (+z) —
    // rotate so the circular face points down +z
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 20), goldM);
    coin.rotation.x = Math.PI / 2;
    ink(coin, 1.08); g.add(coin);

    // raised rim ring sitting just proud of the coin face
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 8, 24), rimM);
    rim.position.z = 0.032;
    ink(rim, 1.1); g.add(rim);

    // embossed mark in the center: an inset ring (×0.10 of coin radius)
    // standing in for a '$' so the face isn't blank
    const mark = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.01, 6, 14), rimM);
    mark.position.z = 0.033;
    ink(mark, 1.1); g.add(mark);

    g.userData.coin = coin;
    g.userData.rim = rim;
    g.userData.mark = mark;

    // right cheek, flat-facing the camera (anchored tight to the body)
    g.position.set(0.5, 0.5, 0.82);
    return g;
  },
  scale: () => 1, // caps at 1 stack
  tick(g, t) {
    // slow ±3° wobble so the coin catches light
    g.rotation.y = Math.sin(t * 1.6) * WOBBLE;
    g.rotation.z = Math.sin(t * 1.1) * WOBBLE;
  },
};

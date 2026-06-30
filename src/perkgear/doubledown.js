// 💰 Double Down — a shiny gold coin medallion worn on a strap, rolls pay 2×.
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

const GOLD = 0xffcf45;   // coin face
const RIM = 0xf2b51e;    // raised rim, a shade deeper
const STRAP = 0x4a3624;  // dark leather strap

export default {
  id: 'doubledown',
  build() {
    const g = new THREE.Group();
    const goldM = toon(GOLD), rimM = toon(RIM), strapM = toon(STRAP);

    // strap leading up toward the shoulder, anchored at the coin
    const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.26, 8), strapM);
    strap.position.set(-0.06, 0.16, -0.04);
    strap.rotation.z = 0.5; strap.rotation.x = -0.2;
    ink(strap, 1.15); g.add(strap);

    // the coin itself: flat gold cylinder, face toward the camera (+z)
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 16), goldM);
    coin.rotation.x = Math.PI / 2;
    ink(coin, 1.08); g.add(coin);

    // raised rim ring sitting just proud of the coin face
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 8, 20), rimM);
    rim.position.z = 0.021;
    ink(rim, 1.1); g.add(rim);

    // tiny embossed mark in the center (a small star-ish cone, point-on)
    const mark = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.03, 5), rimM);
    mark.position.z = 0.025;
    mark.rotation.x = -Math.PI / 2;
    ink(mark, 1.1); g.add(mark);

    g.userData.coin = coin;
    g.userData.rim = rim;
    g.userData.mark = mark;

    // right side, riding just below the shoulder gear, clear of the magnet
    g.position.set(0.6, 0.72, 0.4);
    return g;
  },
  scale: () => 1, // caps at 1 stack
  tick(g, t) {
    // slow coin-flip wobble around its vertical-ish axis
    const wob = Math.sin(t * 1.6) * 0.5;
    g.rotation.y = wob;
    g.rotation.z = Math.sin(t * 1.1) * 0.06;
  },
};

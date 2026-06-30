// 🐦 Magpie — a tiny perched magpie on the right ear tip, head-bobbing as it rides.
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

const BODY = 0x2a2d3a;   // glossy black
const BELLY = 0xf4f4f8;  // white chest
const TEAL = 0x3aa0b0;   // iridescent wing/tail sheen
const BEAK = 0xffa12e;   // tiny orange beak

export default {
  id: 'magpie',
  build() {
    const g = new THREE.Group();
    const bodyM = toon(BODY), bellyM = toon(BELLY), tealM = toon(TEAL, { flat: true }), beakM = toon(BEAK, { flat: true });

    // round body, the bird's main mass
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), bodyM);
    body.position.set(0, 0.1, 0);
    ink(body, 1.08);
    g.add(body);

    // small white belly/chest sphere nestled into the front-lower body
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), bellyM);
    belly.position.set(0, 0.06, 0.07);
    ink(belly, 1.1);
    g.add(belly);

    // round head, perched forward and slightly up
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 10), bodyM);
    head.position.set(0, 0.18, 0.08);
    ink(head, 1.1);
    g.add(head);
    g.userData.head = head;
    g.userData.headBaseY = head.position.y;

    // tiny orange beak, a stubby cone poking out the front of the head
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.055, 6), beakM);
    beak.position.set(0, 0.175, 0.14);
    beak.rotation.x = Math.PI / 2;
    ink(beak, 1.12);
    g.add(beak);
    g.userData.beak = beak;
    g.userData.beakBaseY = beak.position.y;

    // teal wing hint, flattened sphere hugging the body's side
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), tealM);
    wing.scale.set(0.7, 1, 1.3);
    wing.position.set(0.07, 0.1, -0.01);
    ink(wing, 1.1);
    g.add(wing);

    // long tapered tail, a stretched cone trailing off the back
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.26, 8), tealM);
    tail.position.set(0, 0.06, -0.16);
    tail.rotation.x = Math.PI / 2 + 0.15;
    ink(tail, 1.1);
    g.add(tail);

    // perched on the right ear tip, facing forward (+z, toward camera)
    g.position.set(0.34, 1.62, 0.0);
    return g;
  },
  scale: () => 1,
  tick(g, t) {
    // little head-bob: head and beak nod together, body stays put on the perch
    const bob = Math.sin(t * 5) * 0.012;
    g.userData.head.position.y = g.userData.headBaseY + bob;
    g.userData.beak.position.y = g.userData.beakBaseY + bob;
    // gentle whole-body sway, like a bird settling on its feet
    g.rotation.y = Math.sin(t * 1.3) * 0.08;
  },
};

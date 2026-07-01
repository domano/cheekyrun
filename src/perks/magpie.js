// 🐦 Magpie — a tiny perched magpie on the right ear tip, head-bobbing as it rides.
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

const BODY = 0x2d2a3a;   // glossy blue-black
const BELLY = 0xffffff;  // pied white belly — the recognition cue
const BEAK = 0xffa12e;   // tiny orange beak
const EYE = 0xffffff;    // single white dot eye

export default {
  id: 'magpie',
  icon: '🐦', name: 'Magpie', desc: 'Each roll grabbed: +1% value, up to +150%.',
  rarity: 'epic', weight: 20, stack: 1, order: 170,
  // A keystone greed build: every roll you bank makes the next ones worth more
  // (up to +150%), so a long, clean harvest snowballs.
  apply: (m) => { m.greedScale += 0.01; },
  build() {
    const g = new THREE.Group();
    const bodyM = toon(BODY), bellyM = toon(BELLY), beakM = toon(BEAK, { flat: true }), eyeM = toon(EYE, { flat: true });

    // body, a small glossy ellipsoid — the bird's main mass
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), bodyM);
    body.scale.set(1, 0.78, 1.22);
    ink(body, 1.08);
    g.add(body);

    // white belly patch, flattened and pressed onto the front-lower body
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), bellyM);
    belly.scale.set(0.85, 0.7, 0.5);
    belly.position.set(0, -0.03, 0.13);
    ink(belly, 1.1);
    g.add(belly);

    // tiny white dot eye, just above the beak, facing the camera
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), eyeM);
    eye.position.set(0.05, 0.05, 0.16);
    g.add(eye);

    // tiny orange beak, a stubby cone poking out the front
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 6), beakM);
    beak.position.set(0, 0.0, 0.2);
    beak.rotation.x = Math.PI / 2;
    ink(beak, 1.12);
    g.add(beak);

    // head group: eye + beak nod together on a tiny tilt
    const head = new THREE.Group();
    head.add(eye, beak);
    g.add(head);
    g.userData.head = head;
    g.userData.headBaseRot = 0;

    // long tapered tail, angled up and back off the body
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.28, 8), bodyM);
    tail.position.set(0, 0.05, -0.22);
    tail.rotation.x = -Math.PI / 2 - 0.25;
    ink(tail, 1.1);
    g.add(tail);

    // perched lower and forward on the right ear tip, clear of the banner, facing +z
    g.position.set(0.55, 1.35, 0.2);
    return g;
  },
  scale: () => 1,
  tick(g, t) {
    // tiny idle head-tilt every ~2s, body stays put on the perch
    g.userData.head.rotation.z = Math.sin(t * Math.PI) * 0.18;
    g.userData.head.rotation.x = Math.sin(t * Math.PI + 0.6) * 0.08;
  },
};

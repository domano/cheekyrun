// 🤑 Greedy Gut — a bulging burlap coin sack cinched at the hip, heavy with loot.
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

const SACK = 0xb07a3c;   // burlap brown
const TIE = 0x7a5430;    // darker cinch tie
const COIN = 0xffcf45;   // gold

export default {
  id: 'greedygut',
  build() {
    const g = new THREE.Group();
    const sackM = toon(SACK), tieM = toon(TIE), coinM = toon(COIN, { flat: true });

    // bulging body — a sphere squashed wide and pulled heavier at the bottom
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), sackM);
    body.scale.set(1, 1.1, 1);
    body.position.set(0, -0.04, 0);
    ink(body, 1.08);
    g.add(body);

    // cinched neck — a pinched little cylinder closing the sack's top
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 0.1, 10), sackM);
    neck.position.set(0, 0.16, 0);
    ink(neck, 1.1);
    g.add(neck);

    // the tie knotted around the neck
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 8, 12), tieM);
    tie.rotation.x = Math.PI / 2;
    tie.position.set(0, 0.18, 0);
    ink(tie, 1.12);
    g.add(tie);

    // a gold coin peeking out the top of the sack
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 12), coinM);
    coin.rotation.set(0.3, 0, 0.5);
    coin.position.set(0.02, 0.23, 0.03);
    ink(coin, 1.15);
    g.add(coin);

    // hip anchor, right side
    g.position.set(0.55, 0.46, 0.45);
    g.userData.body = body;
    return g;
  },
  scale: (stacks) => 0.92 + 0.12 * stacks,
  tick(g, t) {
    // heavy jiggle — the loot sloshes with a slow, weighty squash on the
    // sack body only, so it layers on top of the group's stack scale
    // (set by applyGear) instead of fighting it.
    const ph = Math.sin(t * 3.2);
    const body = g.userData.body;
    body.scale.set(1 + ph * 0.05, 1.1 - ph * 0.06, 1 + ph * 0.05);
    g.rotation.z = ph * 0.05;
  },
};

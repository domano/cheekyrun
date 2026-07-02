// 🎈 Featherweight — a pastel helium balloon tied to the upper body, lazily
// bobbing as if it's the thing keeping the character aloft.
// Reference template: src/perks/overdrive.js
import * as THREE from 'three';
import { toon, ink } from '../materials.js';

const BALLOON = 0xb8f2c9; // mint
const HIGHLIGHT = 0xf3fff7; // pale glossy sheen
const STRING = 0xfff4ef;   // warm off-white

export default {
  id: 'featherweight',
  icon: '🎈', name: 'Featherweight', desc: 'Hang way longer, but one fewer jump.',
  rarity: 'curse', weight: 26, stack: 1, order: 150,
  apply: (m) => { m.floatMult *= 0.45; m.extraJumpsBonus -= 1; },
  build() {
    const g = new THREE.Group();

    // thin string from the body up to the balloon's knot
    const stringM = toon(STRING);
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.95, 6), stringM);
    string.position.set(-0.1, -0.475, 0.05);
    g.add(string);

    // teardrop balloon: a sphere stretched tall + a small cone knot underneath
    const balloonM = toon(BALLOON);
    const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), balloonM);
    balloon.scale.set(0.92, 1.22, 0.92);
    balloon.position.set(0, 0.18, 0);
    ink(balloon, 1.07);
    g.add(balloon);

    const knot = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.06, 8), balloonM);
    knot.position.set(0, 0.18 - 0.16 * 1.22 - 0.02, 0);
    knot.rotation.x = Math.PI;
    ink(knot, 1.1);
    g.add(knot);

    // small glossy highlight, no ink — translucent so it stays soft
    const sheen = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 8, 8),
      new THREE.MeshBasicMaterial({ color: HIGHLIGHT, transparent: true, opacity: 0.75, depthWrite: false }),
    );
    sheen.position.set(-0.06, 0.27, 0.1);
    g.add(sheen);

    // anchor near the upper body; string runs down toward the shoulder
    g.position.set(0.5, 2.05, 0.15);
    g.userData.baseY = g.position.y;
    return g;
  },
  scale: () => 1, // caps at 1 stack
  tick(g, t) {
    // lazy bob + slight pendulum sway, like it's tugging gently at the string
    g.position.y = g.userData.baseY + Math.sin(t * 1.3) * 0.05;
    g.rotation.z = Math.sin(t * 0.9) * 0.06;
    g.rotation.x = Math.sin(t * 1.1 + 1) * 0.03;
  },
};

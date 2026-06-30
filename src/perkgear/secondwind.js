// 🌬️ Second Wind — a small pinwheel on a stick, mounted over the right back,
// spinning to catch the wind. Caps at 1 stack.
import * as THREE from 'three';
import { toon, ink } from '../materials.js';

const STICK = 0xfff4ef;  // pale cream
const PINK = 0xffc2d6;
const CYAN = 0xaee6ff;

export default {
  id: 'secondwind',
  build() {
    const g = new THREE.Group();

    // thin stick, standing upright
    const stickM = toon(STICK);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.32, 8), stickM);
    stick.position.set(0, -0.05, 0);
    ink(stick, 1.15);
    g.add(stick);

    // pinwheel head: four alternating pastel petals, flattened cones fanned
    // around the spin axis, plus a tiny hub bead pinning them together
    const petals = new THREE.Group();
    petals.position.set(0, 0.13, 0);
    const colors = [PINK, CYAN, PINK, CYAN];
    for (let i = 0; i < 4; i++) {
      const petalM = toon(colors[i], { flat: true });
      const petal = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.05, 4), petalM);
      petal.scale.set(1, 1, 0.35); // flatten into a blade
      petal.position.set(0.08, 0.08, 0);
      petal.rotation.z = -Math.PI / 2.4;
      ink(petal, 1.12);
      const arm = new THREE.Group();
      arm.rotation.z = (Math.PI / 2) * i;
      arm.add(petal);
      petals.add(arm);
    }
    const hubM = toon(0xffe9a8, { flat: true });
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), hubM);
    ink(hub, 1.15);
    petals.add(hub);

    g.add(petals);
    g.userData.petals = petals;

    // mounted over the right back, angled out so the face reads from behind
    g.position.set(0.55, 1.18, 0.25);
    g.rotation.x = -0.3;
    g.rotation.y = 0.4;
    return g;
  },
  scale: () => 1,
  tick(g, t, dt) {
    g.userData.petals.rotation.z += dt * 4;
  },
};

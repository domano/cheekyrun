// 🪀 Coil Spring — a brass wind-up key socketed into the back of the white
// tail, slowly turning as if winding the next mega-hop.
// Mechanic (main.js): a grounded duck compresses the coil (COIL_WINDOW); a
// grounded jump inside the window launches at COIL_VY — over tall walls.
import * as THREE from 'three';
import { toon, ink } from '../materials.js';

const BRASS = 0xe6c26e;
const DARK = 0xc9a24e;

export default {
  id: 'coilspring',
  icon: '🪀', name: 'Coil Spring', desc: 'Duck, then jump: a mega-hop that clears tall walls.',
  rarity: 'rare', weight: 40, stack: 1, order: 200,
  apply: (m) => { m.coil = true; },
  build() {
    const g = new THREE.Group();
    const brassM = toon(BRASS, { flat: true }), darkM = toon(DARK, { flat: true });
    // shaft plugged into the tail, pointing back toward the camera
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 10), darkM);
    shaft.rotation.x = Math.PI / 2; shaft.position.z = -0.08; ink(shaft, 1.14); g.add(shaft);
    // the classic two-loop key head: a pair of torus rings side by side
    const head = new THREE.Group(); head.position.z = 0.02;
    [-0.065, 0.065].forEach(x => {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.02, 8, 14), brassM);
      loop.position.x = x; ink(loop, 1.12); head.add(loop);
    });
    g.add(head); g.userData.head = head;
    // socketed into the back of the tail (the tail sits at 0, 0.95, 0.55)
    g.position.set(0, 0.98, 0.82);
    return g;
  },
  scale: () => 1,
  // winds itself, slow and smug
  tick(g, t, dt) { g.userData.head.rotation.z += dt * 1.6; },
};

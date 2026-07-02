// 🦿 Hops (Springy Cheeks) — two chunky coral coils under each foot, like
// spring shoes.
import * as THREE from 'three';
import { toon, ink } from '../materials.js';

export default {
  id: 'hops',
  icon: '🦿', name: 'Hops', desc: 'One more mid-air jump.',
  rarity: 'common', weight: 80, stack: 2, order: 40,
  apply: (m) => { m.extraJumpsBonus += 1; },
  build() {
    const springs = new THREE.Group();
    const coilM = toon(0xff7a6e, { flat: true });
    [-0.26, 0.26].forEach(x => {
      const coil = new THREE.Group();
      for (let i = 0; i < 2; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.05, 8, 16), coilM);
        ring.rotation.x = Math.PI / 2; ring.position.y = i * 0.1; ink(ring, 1.12); coil.add(ring);
      }
      coil.position.set(x, -0.04, 0.28); springs.add(coil);
    });
    return springs;
  },
  scale: (stacks) => 0.9 + 0.14 * stacks,
};

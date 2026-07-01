// 🍀 Lucky Streak (Lucky Rolls) — a four-leaf clover worn over the left
// shoulder, leaves splayed with clear gaps so it reads clover, not cabbage.
// The left-shoulder twin of the magnet's right-shoulder zone (see vacuum.js).
import * as THREE from 'three';
import { toon, ink } from '../materials.js';

export default {
  id: 'lucky',
  icon: '🍀', name: 'Lucky Streak', desc: '+18% points per roll.',
  rarity: 'common', weight: 100, stack: 3, order: 30,
  apply: (m) => { m.rollMult *= 1.18; },
  build() {
    const clover = new THREE.Group();
    const leafTop = toon(0x7be08c, { emissive: 0x123d1f }), leafM = toon(0x4fb86a, { emissive: 0x0d2e15 });
    [[0.13, 0.13], [-0.13, 0.13], [0.13, -0.13], [-0.13, -0.13]].forEach(([x, z], i) => {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), i < 2 ? leafTop : leafM);
      leaf.position.set(x, 0, z); leaf.scale.set(1.1, 0.5, 1.1); ink(leaf, 1.12); clover.add(leaf);
    });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.22, 6), toon(0x4f9d57)); stem.position.y = -0.15; clover.add(stem);
    clover.position.set(-0.52, 1.22, 0.2); clover.rotation.x = -1.0;
    return clover;
  },
  scale: (stacks) => 0.98 + 0.12 * stacks,
};

// 🧲 Vacuum (Roll Magnet) — a rounded fridge-magnet horseshoe worn over the
// right shoulder. Cherry red (shared with the rocket) to sit in the warm family.
// One of two accessory zones up top so worn props never pile on the centreline:
// the magnet takes the right shoulder, the clover (lucky.js) the left.
import * as THREE from 'three';
import { toon, ink } from '../materials.js';

export default {
  id: 'vacuum',
  icon: '🧲', name: 'Vacuum', desc: '+4 roll-magnet range.',
  rarity: 'common', weight: 80, stack: 3, order: 20,
  apply: (m) => { m.magnetBonus += 4; },
  build() {
    const magnet = new THREE.Group();
    const red = toon(0xe8554e), tipM = toon(0xd6dde4);
    [-0.16, 0.16].forEach(x => { const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.34, 12), red); arm.position.set(x, 0.0, 0); ink(arm, 1.08); magnet.add(arm); });
    const yoke = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.085, 10, 16, Math.PI), red); yoke.position.y = 0.17; ink(yoke, 1.06); magnet.add(yoke);
    [-0.16, 0.16].forEach(x => { const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.12, 12), tipM); tip.position.set(x, -0.22, 0); ink(tip, 1.1); magnet.add(tip); });
    magnet.position.set(0.4, 0.98, 0.34); magnet.rotation.set(0.35, 0, -0.18);
    return magnet;
  },
  scale: (stacks) => 0.56 + 0.06 * stacks,
};

// 🐷 Piggy Bank — a tiny porcelain piggy perched on the crown between the
// ears, coin slot up, a gold coin forever half-dropped in.
// Mechanic (main.js): BANK_SHARE of every grabbed roll is diverted into a run
// vault that cashes (× a growing multiplier) at the finish line; ANY hit —
// even a cushioned one — forfeits the lot.
import * as THREE from 'three';
import { toon, ink } from '../materials.js';
import { BANK_SHARE } from '../config.js';

// saturated past Pixie's swatches a notch — the toon ramp + noon sun wash
// pale pinks to white at gameplay distance
const PIG = 0xff9fc0;
const SNOUT = 0xef7f9f;
const SLOT = 0x5a3a42;
const COIN = 0xffd23f;

export default {
  id: 'piggybank',
  icon: '🐷', name: 'Piggy Bank', desc: "Rolls feed a vault that cashes at the finish line — lose it if you're hit.",
  rarity: 'epic', weight: 20, stack: 1, order: 210,
  apply: (m) => { m.bankShare = BANK_SHARE; },
  build() {
    const g = new THREE.Group();
    const pigM = toon(PIG), snoutM = toon(SNOUT, { flat: true });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), pigM);
    body.scale.set(1.15, 0.95, 1); body.castShadow = true; ink(body, 1.08); g.add(body);
    // snout faces the chase camera so the pig reads as a pig from behind
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.035, 10), snoutM);
    snout.rotation.x = Math.PI / 2; snout.position.set(0, -0.01, 0.17); ink(snout, 1.12); g.add(snout);
    [-0.02, 0.02].forEach(x => {
      const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), toon(SLOT, { flat: true }));
      nostril.position.set(x, -0.01, 0.19); g.add(nostril);
    });
    [-0.07, 0.07].forEach(x => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.055, 6), snoutM);
      ear.position.set(x, 0.13, 0.05); ink(ear, 1.15); g.add(ear);
    });
    // coin slot (thin inset, flush — no outline) + a coin about to drop
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.014, 0.08), toon(SLOT, { flat: true }));
    slot.position.set(0, 0.14, -0.02); g.add(slot);
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.014, 12), toon(COIN, { flat: true }));
    coin.rotation.z = Math.PI / 2; coin.position.set(0, 0.18, -0.02); ink(coin, 1.1); g.add(coin);
    g.userData.coin = coin;
    // nestled onto the crown between the ear roots — touching, no sky gap
    g.position.set(0.02, 1.32, 0.1);
    g.scale.setScalar(1.15);
    return g;
  },
  scale: () => 1.15,
  // a contented bob (out of phase with the run bounce); the coin jiggles,
  // forever on the brink of dropping
  tick(g, t) {
    g.position.y = 1.32 + Math.sin(t * 2.2) * 0.02;
    g.userData.coin.position.y = 0.18 + Math.sin(t * 3.4) * 0.008;
  },
};

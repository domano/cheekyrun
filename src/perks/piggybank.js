// 🐷 Piggy Bank — a tiny porcelain piggy perched on the crown between the
// ears, coin slot up, a gold coin forever half-dropped in.
// Mechanic (main.js): BANK_SHARE of every grabbed roll is diverted into a run
// vault that cashes (× a growing multiplier) at the finish line; ANY hit —
// even a cushioned one — forfeits the lot.
import * as THREE from 'three';
import { toon, ink } from '../materials.js';
import { BANK_SHARE } from '../config.js';

const PIG = 0xffa8c4;
const SNOUT = 0xff8fb2;
const SLOT = 0x4a3340;
const COIN = 0xffd23f;

export default {
  id: 'piggybank',
  icon: '🐷', name: 'Piggy Bank', desc: "Rolls feed a vault that cashes at the finish line — lose it if you're hit.",
  rarity: 'epic', weight: 20, stack: 1, order: 210,
  apply: (m) => { m.bankShare = BANK_SHARE; },
  build() {
    const g = new THREE.Group();
    const pigM = toon(PIG), snoutM = toon(SNOUT, { flat: true });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 12), pigM);
    body.scale.set(1.15, 0.95, 1); body.castShadow = true; ink(body, 1.08); g.add(body);
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.035, 10), snoutM);
    snout.rotation.x = Math.PI / 2; snout.position.set(0, -0.01, 0.14); ink(snout, 1.12); g.add(snout);
    [-0.06, 0.06].forEach(x => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.05, 6), pigM);
      ear.position.set(x, 0.11, 0.03); ink(ear, 1.15); g.add(ear);
    });
    // coin slot (thin inset, flush — no outline) + a coin about to drop
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.012, 0.07), toon(SLOT, { flat: true }));
    slot.position.set(0, 0.12, -0.02); g.add(slot);
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.014, 12), toon(COIN, { flat: true }));
    coin.rotation.z = Math.PI / 2; coin.position.set(0, 0.16, -0.02); ink(coin, 1.1); g.add(coin);
    g.userData.coin = coin;
    // perched on the crown, between the ear roots
    g.position.set(0, 1.42, 0.05);
    return g;
  },
  scale: () => 1,
  // a contented bob; the coin jiggles, forever on the brink of dropping
  tick(g, t) {
    g.position.y = 1.42 + Math.sin(t * 2.2) * 0.02;
    g.userData.coin.position.y = 0.16 + Math.sin(t * 3.4) * 0.008;
  },
};

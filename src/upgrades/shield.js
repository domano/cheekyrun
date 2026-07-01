// 🛡️ Cushion — soaks up a crash, refills each run. A permanent shop upgrade
// (self-contained, same folder contract as the rest — see _example.js), but its
// worn prop is SPECIAL: the bubble tracks the LIVE shield count, not the owned
// tier, so it pops the instant the last cushion is spent. `liveGear: true` tells
// player.js's applyGear to leave its reveal to the game loop (updateShieldGear
// in main.js); tickGear still runs tick() to orbit the pips while it's up.
import * as THREE from 'three';

export default {
  id: 'shield', icon: '🛡️', name: 'Cushion',
  desc: 'Soaks up a crash. Refills each run.',
  max: 5, order: 0,
  cost: (l) => [60, 140, 280, 520, 900][l],
  gate: (l) => [null, null, null,
    { test: (s) => s.maxLevel >= 12, label: 'Reach Lv 12' },
    { test: (s) => s.maxLevel >= 18, label: 'Reach Lv 18' }][l],
  // Base run effect: crashes survived per run = owned tier.
  effect: (tier, eff) => { eff.shields = tier; },

  // Worn prop is driven by the live shield count, not the owned tier.
  liveGear: true,

  // 🛡️ a soft glassy bubble hugging the body, with orbiting tier pips.
  build() {
    const g = new THREE.Group();
    const bubble = new THREE.Mesh(
      new THREE.SphereGeometry(1.02, 22, 16),
      new THREE.MeshBasicMaterial({ color: 0xbcd4ff, transparent: true, opacity: 0.22, depthWrite: false }),
    );
    bubble.position.y = 0.6; g.add(bubble);
    // a brighter rim shell (back faces) gives it a glassy edge highlight
    const rim = new THREE.Mesh(
      new THREE.SphereGeometry(1.08, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0xf2f8ff, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.BackSide }),
    );
    rim.position.y = 0.6; g.add(rim);
    // one orbiting pip per remaining cushion (main.js toggles their count)
    const pips = [];
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2;
      const pip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: 0x8fb6ff }));
      pip.position.set(Math.cos(a) * 1.04, 0.6, Math.sin(a) * 1.04); pip.visible = false; g.add(pip); pips.push(pip);
    }
    g.userData.pips = pips;
    return g;
  },
  tick(g, t, dt) { g.rotation.y += dt * 0.7; },   // slowly orbit the tier pips
};

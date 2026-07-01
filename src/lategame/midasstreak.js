// 💎 Midas Streak — a gold coin bandolier; the longer the run, the richer each
// roll (echoes the Magpie perk's greedScale). Worn as a shallow front ARC of
// coins across the camera-facing left cheek (not a torso wrap — a wrap hides
// 80% of the coins behind the body). See src/lategame/_example.js.
import * as THREE from 'three';
import { toon, ink } from '../materials.js';

const GOLD = 0xf4c542;   // coin face
const EDGE = 0xd4a017;    // coin rim / center pip
const STRAP = 0x8d5524;   // leather bandolier strap

// 5 coins along a diagonal across the +z face of the left cheek, upper-left to
// lower-right, each nudged out to the visible surface so the whole belt reads.
const COINS = [
  [-0.63, 0.95, 0.55],
  [-0.53, 0.81, 0.57],
  [-0.43, 0.68, 0.59],
  [-0.33, 0.55, 0.60],
  [-0.23, 0.41, 0.62],
];

export default {
  id: 'midasstreak',
  icon: '💎',
  name: 'Midas Streak',
  desc: 'The longer you run, the richer each roll.',
  max: 4,
  order: 40,

  cost: (l) => [300, 550, 950, 1600][l],

  gate: (l) => [
    { test: (s) => s.maxLevel >= 18, label: 'Reach Lv 18' },
    { test: (s) => s.runs >= 35, label: '35 runs' },
    { test: (s) => s.maxLevel >= 22, label: 'Reach Lv 22' },
    { test: (s) => s.runs >= 60, label: '60 runs' },
  ][l] || null,

  mods: (tier, m) => { m.greedScale += 0.0025 * tier; },

  // ---- worn 3D prop: a visible arc of coins on a leather strap ----
  build() {
    const g = new THREE.Group();
    const goldM = toon(GOLD), edgeM = toon(EDGE), strapM = toon(STRAP);

    // leather strap running behind the coin line (the band they're mounted on).
    // A→B diagonal: dx 0.4, dy -0.6 → angle atan2(-0.6,0.4); length ~0.72 + margin.
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.82, 0.04), strapM);
    strap.position.set(-0.43, 0.68, 0.52);
    strap.rotation.z = Math.atan2(-0.54, 0.4) + Math.PI / 2; // align band to the diagonal
    ink(strap, 1.08);
    g.add(strap);

    // the coins — flat cylinders facing the camera (+z), overlapping into a belt.
    const coins = [];
    COINS.forEach(([x, y, z]) => {
      const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 16), goldM);
      coin.position.set(x, y, z);
      coin.rotation.x = Math.PI / 2;   // face out toward the camera
      ink(coin, 1.08);
      // a little minted center pip so the face isn't blank
      const pip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.055, 10), edgeM);
      coin.add(pip);
      g.add(coin);
      coins.push(coin);
    });

    g.userData.coins = coins;
    return g;
  },
  scale: (tier) => 0.9 + 0.08 * tier,
  tick(g, t) {
    // staggered glint — a couple of coins catch light at a time.
    const coins = g.userData.coins;
    if (!coins) return;
    coins.forEach((c, i) => {
      c.rotation.y = Math.sin(t * 2 + i * 1.1) * 0.18;   // ±10° twist
    });
  },
};

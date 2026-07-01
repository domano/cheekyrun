// 💎 Midas Streak — a gold hip sash of coin pips; the longer the run, the
// richer each roll (echoes the Magpie perk's greedScale). Worn on the LEFT
// cheek/hip as a diagonal bandolier so it doesn't clash with Double Down's
// coin on the right cheek front. See src/lategame/_example.js for the full
// contract and src/perkgear/doubledown.js for the gold palette/wobble feel.
import * as THREE from 'three';
import { toon, ink } from '../materials.js';

const GOLD = 0xe6b800;   // sash coin pips
const RIM = 0xc9962e;    // darker raised rim / pip shading
const STRAP = 0x9c7a1f;  // dull gold bandolier strap

const WOBBLE = THREE.MathUtils.degToRad(3); // ±3° shimmer, like doubledown

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

  // ---- worn 3D prop: gold bandolier sash across the left cheek/hip ----
  build() {
    const g = new THREE.Group();
    const strapM = toon(STRAP), goldM = toon(GOLD), rimM = toon(RIM);

    // bent strip strap: two segments so it reads as a sash wrapping the
    // cheek-hip curve rather than a flat stick.
    const strapLo = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.32, 0.014), strapM);
    strapLo.position.set(0.02, -0.1, 0.02);
    strapLo.rotation.z = -0.55; strapLo.rotation.x = 0.15;
    ink(strapLo, 1.12); g.add(strapLo);
    const strapHi = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.3, 0.014), strapM);
    strapHi.position.set(-0.14, 0.18, -0.06);
    strapHi.rotation.z = -1.05; strapHi.rotation.x = 0.35;
    ink(strapHi, 1.12); g.add(strapHi);

    // coin pips studding the sash — small flat cylinders, face out (+z-ish)
    const pipSpots = [
      [0.06, -0.16, 0.04],
      [0.0, -0.02, 0.03],
      [-0.06, 0.1, -0.01],
      [-0.12, 0.22, -0.05],
      [-0.17, 0.32, -0.08],
    ];
    const pips = [];
    pipSpots.forEach(([x, y, z]) => {
      const pip = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 12), goldM);
      pip.position.set(x, y, z);
      pip.rotation.x = Math.PI / 2 - 0.2;
      ink(pip, 1.1); g.add(pip);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.009, 6, 14), rimM);
      rim.position.set(x, y, z + 0.011);
      rim.rotation.x = Math.PI / 2 - 0.2;
      g.add(rim);
      pips.push(pip);
    });
    g.userData.pips = pips;

    // left cheek / hip, diagonal, biased low so it clears doubledown's coin
    g.position.set(-0.45, 0.55, 0.45);
    g.rotation.z = 0.5;
    return g;
  },
  scale: (tier) => 0.9 + 0.08 * tier,
  tick(g, t) {
    // slow shimmer wobble, plus a gentle twinkle on the pips catching light
    g.rotation.y = Math.sin(t * 1.6) * WOBBLE;
    g.rotation.z = 0.5 + Math.sin(t * 1.1) * WOBBLE;
    const pips = g.userData.pips;
    if (pips) pips.forEach((p, i) => {
      const s = 1 + 0.06 * Math.sin(t * 2.2 + i * 1.3); // twinkle: pips gently pulse
      p.scale.setScalar(s);
    });
  },
};

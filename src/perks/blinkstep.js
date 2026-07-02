// 💨 Blink Step — a little comet-wisp familiar hovering off the left flank,
// tail beads streaming behind, bobbing while it waits for the next blink.
// Mechanic (main.js): an airborne lane-swipe teleports (no eased slide) with a
// BLINK_INVULN flash; grounded swipes are unchanged.
import * as THREE from 'three';
import { toon, ink } from '../materials.js';

// deepened past the icy swatches — the toon ramp + noon sun wash pale blues
// to plain white at gameplay distance (Pixie tweak)
const WISP = 0x8fcfff;
const TAIL = 0x5fb8ff;

export default {
  id: 'blinkstep',
  icon: '💨', name: 'Blink Step', desc: 'Airborne swipes teleport you — with a flash of invulnerability.',
  rarity: 'rare', weight: 40, stack: 1, order: 220,
  apply: (m) => { m.airDash = true; },
  build() {
    const g = new THREE.Group();
    // a glowing comet head with ink, a 4-point sparkle tell, and a trail of
    // outline-less fading beads angling back-and-down — directional, not smoke
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), toon(WISP, { emissive: 0x2e6a8f }));
    ink(head, 1.1); g.add(head);
    const sparkle = new THREE.Mesh(new THREE.CircleGeometry(0.07, 4),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
    sparkle.position.z = 0.09; sparkle.rotation.z = Math.PI / 4; g.add(sparkle);
    g.userData.beads = [];
    [[0.06, 1.0], [0.045, 0.7], [0.03, 0.45]].forEach(([r, op], i) => {
      const bead = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 10),
        new THREE.MeshBasicMaterial({ color: TAIL, transparent: true, opacity: op, depthWrite: false }));
      bead.position.set(-0.08 * (i + 1), -0.06 * (i + 1), -0.07 * (i + 1));
      g.add(bead); g.userData.beads.push(bead);
    });
    // hovering clear of the left flank, trail sweeping behind the runner
    g.position.set(-0.98, 0.8, 0.3);
    return g;
  },
  scale: () => 1,
  // hovers with a lazy bob; the tail beads shimmer a beat behind
  tick(g, t) {
    g.position.y = 0.8 + Math.sin(t * 3.1) * 0.05;
    g.userData.beads.forEach((b, i) => { b.position.y = -0.06 * (i + 1) + Math.sin(t * 3.1 - (i + 1) * 0.9) * 0.02; });
  },
};

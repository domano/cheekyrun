// 💨 Blink Step — a little comet-wisp familiar hovering off the left flank,
// tail beads streaming behind, bobbing while it waits for the next blink.
// Mechanic (main.js): an airborne lane-swipe teleports (no eased slide) with a
// BLINK_INVULN flash; grounded swipes are unchanged.
import * as THREE from 'three';
import { toon, ink } from '../materials.js';

const WISP = 0xcfe8ff;
const TAIL = 0xa8d4ff;

export default {
  id: 'blinkstep',
  icon: '💨', name: 'Blink Step', desc: 'Airborne swipes teleport you — with a flash of invulnerability.',
  rarity: 'rare', weight: 40, stack: 1, order: 220,
  apply: (m) => { m.airDash = true; },
  build() {
    const g = new THREE.Group();
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 12), toon(WISP));
    ink(head, 1.1); g.add(head);
    // three shrinking tail beads trailing outward, away from the body
    g.userData.beads = [];
    [0.09, 0.16, 0.215].forEach((d, i) => {
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.05 - i * 0.014, 10, 10), toon(TAIL));
      bead.position.set(-d, -0.02 - i * 0.01, 0); ink(bead, 1.12); g.add(bead); g.userData.beads.push(bead);
    });
    // a soft translucent halo around the head — glows get no outline
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10),
      new THREE.MeshBasicMaterial({ color: WISP, transparent: true, opacity: 0.25, depthWrite: false }));
    g.add(halo);
    // hovering off the left flank, clear of the clover and feather above
    g.position.set(-0.78, 1.0, 0.35);
    return g;
  },
  scale: () => 1,
  // hovers with a lazy bob; the tail beads ripple a beat behind
  tick(g, t) {
    g.position.y = 1.0 + Math.sin(t * 3.1) * 0.05;
    g.userData.beads.forEach((b, i) => { b.position.y = -0.02 - i * 0.01 + Math.sin(t * 3.1 - (i + 1) * 0.9) * 0.02; });
  },
};

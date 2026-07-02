// Sky Dance (relic): every touchdown auto-relaunches at the bounce vy with air
// jumps refunded — the ground becomes a trampoline and the run turns aerial.
// Ground hazards still kill a low pass, and the air-time bonus stays gated on a
// SPENT double-jump (main.js updatePlayer), so auto-bounces never farm it.
import { relicDress } from './_relic.js';

const SPRING = 0x35e07c;   // spring green

export default {
  id: 'pogo',
  icon: '🦘',
  color: SPRING,
  label: 'Sky Dance',
  order: 70,
  minLevel: 5,
  weight: 0.7,
  bounce: 8.4,   // landings relaunch at this vy (a hair under a fresh hop's 9.4)

  dress(g, THREE, helpers) {
    relicDress(g, THREE, helpers);
    // Topper: a coil spring under the gem — three flat rings narrowing upward.
    const m = helpers.toon(SPRING, { emissive: 0x0a5a2e });
    [[-0.5, 0.34], [-0.58, 0.38], [-0.66, 0.42]].forEach(([y, r]) => {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(r, 0.045, 6, 18), m);
      coil.position.y = y; coil.rotation.x = Math.PI / 2;
      helpers.ink(coil, 1.14);
      g.add(coil);
    });
  },
};

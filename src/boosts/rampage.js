// Rampage (relic): while it runs, charging into a single-lane jump-hazard
// DEMOLISHES it for a combo-scaled bonus (RAMPAGE_BONUS, config.js) instead of
// killing — no combo break, just debris. Duck bars and full-width gates still
// behave normally, so a mis-played slide is as lethal as ever.
import { relicDress } from './_relic.js';

const FIRE = 0xe0341f;   // deep fiery red — clearly apart from dash's orange 0xff7a3a

export default {
  id: 'rampage',
  icon: '🐗',
  color: FIRE,
  label: 'Rampage',
  order: 60,
  minLevel: 8,
  weight: 0.6,
  smash: true,   // contact with a single-lane, non-duck hazard destroys it instead of you

  dress(g, THREE, helpers) {
    relicDress(g, THREE, helpers);
    // Deepen the gem's self-glow: the standard full-strength emissive washes
    // this red toward dash's orange — a darker ember keeps it reading RED.
    g.userData.gem.material.emissive.setHex(0x8a1408);
    // Topper: two stubby ram-horn arcs curling off the gem's shoulders.
    const m = helpers.toon(0xf2e2c8, { emissive: 0x4a2a10 });
    [-1, 1].forEach(s => {
      const horn = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.06, 6, 10, Math.PI * 1.25), m);
      horn.position.set(s * 0.42, 0.3, 0);
      horn.rotation.set(0.2, s * 0.5, s * -1.9);
      helpers.ink(horn, 1.14);
      g.add(horn);
    });
  },
};

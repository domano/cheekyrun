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
    // Topper: two curled ram-horn half-tori off the gem's shoulders, darker
    // than the gem so they read as horn, not gem-arm (Pixie pass).
    const m = helpers.toon(0xb0250f, { emissive: 0x3a0c04 });
    [-1, 1].forEach(s => {
      const horn = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.035, 6, 12, Math.PI * 1.22), m);
      horn.position.set(s * 0.5, 0.34, 0.05);
      // arc opens forward — the tip curls toward the camera like a ram's horn
      horn.rotation.set(-0.35, s * 1.25, s * -0.4);
      helpers.ink(horn, 1.14);
      g.add(horn);
    });
  },
};

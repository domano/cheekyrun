// Bullet Time (relic): the WORLD runs at timeScale while the player's own
// physics and inputs stay full-speed — thread impossible gaps in slow motion.
// It dominates (never stacks with) the near-miss slow-mo. NOT invulnerable:
// a mis-read still kills, just slower.
import { relicDress } from './_relic.js';

const VIOLET = 0x5a1ec8;   // deep violet — dark enough to stay purple (not pink) after the ramp lift

export default {
  id: 'chrono',
  icon: '⏳',
  color: VIOLET,
  label: 'Bullet Time',
  order: 50,
  minLevel: 6,
  weight: 0.6,
  timeScale: 0.55,   // the world advances at this fraction of real time while active

  dress(g, THREE, helpers) {
    relicDress(g, THREE, helpers);
    // Deepen the gem's self-glow so the violet holds instead of lifting pink.
    g.userData.gem.material.emissive.setHex(0x3a1080);
    // Topper: a tiny hourglass — two cones meeting at the waist above the crown.
    const m = helpers.toon(VIOLET, { emissive: 0x3a1080 });
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.2, 8), m);
    top.rotation.x = Math.PI; top.position.y = 0.96;
    const bot = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.2, 8), m);
    bot.position.y = 0.76;
    helpers.ink(top, 1.14); helpers.ink(bot, 1.14);
    g.add(top, bot);
  },
};

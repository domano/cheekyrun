// 💥 Butt Slam — a comic impact-starburst badge slapped on the upper-left
// cheek: gold spikes, hot orange core, throbbing like it just landed.
// Mechanic (main.js): an air-duck arms a slam; touching down armed smashes the
// nearest ground jump-hazard in your lane (duck bars / full-width gates resist).
import * as THREE from 'three';
import { toon, ink } from '../materials.js';

const GOLD = 0xffd23f;
const HOT = 0xff8a3a;

export default {
  id: 'buttslam',
  icon: '💥', name: 'Butt Slam', desc: 'Air-duck to slam — smash the hazard you land by.',
  rarity: 'epic', weight: 20, stack: 1, order: 190,
  apply: (m) => { m.slam = true; },
  build() {
    const g = new THREE.Group();
    const goldM = toon(GOLD, { flat: true }), hotM = toon(HOT, { flat: true });
    // eight starburst spikes fanned in the badge plane, long/short alternating
    for (let i = 0; i < 8; i++) {
      const long = i % 2 === 0;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.035, long ? 0.16 : 0.1, 6), long ? goldM : hotM);
      const a = (i / 8) * Math.PI * 2, r = long ? 0.11 : 0.08;
      spike.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
      spike.rotation.z = a - Math.PI / 2;
      ink(spike, 1.14); g.add(spike);
    }
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 12), hotM);
    core.scale.z = 0.5; core.position.z = 0.02; ink(core, 1.1); g.add(core);
    // slapped on the upper-left cheek, facing the chase camera
    g.position.set(-0.48, 0.92, 0.45);
    g.rotation.x = -0.15;
    return g;
  },
  scale: () => 1,
  // throbs like a fresh hit
  tick(g, t) { g.scale.setScalar(1 + Math.max(0, Math.sin(t * 4)) * 0.08); },
};

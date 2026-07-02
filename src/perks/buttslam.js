// 💥 Butt Slam — a comic impact-starburst badge slapped on the upper-left
// cheek: gold spikes, hot orange core, throbbing like it just landed.
// Mechanic (main.js): an air-duck arms a slam; touching down armed smashes the
// nearest ground jump-hazard in your lane (duck bars / full-width gates resist).
import * as THREE from 'three';
import { toon, ink } from '../materials.js';

const GOLD = 0xffc13b;
const HOT = 0xff6a2b;

export default {
  id: 'buttslam',
  icon: '💥', name: 'Butt Slam', desc: 'Air-duck to slam — smash the hazard you land by.',
  rarity: 'epic', weight: 20, stack: 1, order: 190,
  apply: (m) => { m.slam = true; },
  build() {
    const g = new THREE.Group();
    const goldM = toon(GOLD, { flat: true }), hotM = toon(HOT, { flat: true });
    // a coin-with-rays impact badge: fat gold disc core, eight short spikes,
    // hot orange hub proud of the rays — reads "impact", not "sea urchin"
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 8), goldM);
    disc.rotation.x = Math.PI / 2; ink(disc, 1.1); g.add(disc);
    for (let i = 0; i < 8; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.09, 6), goldM);
      const a = (i / 8) * Math.PI * 2;
      spike.position.set(Math.cos(a) * 0.155, Math.sin(a) * 0.155, 0);
      spike.rotation.z = a - Math.PI / 2;
      ink(spike, 1.14); g.add(spike);
    }
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), hotM);
    hub.scale.z = 0.7; hub.position.z = 0.035; ink(hub, 1.1); g.add(hub);
    // pressed flat onto the upper-left cheek, tilted to lie on the surface
    g.position.set(-0.42, 0.8, 0.52);
    g.rotation.set(-0.2, -0.35, 0);
    g.scale.setScalar(1.1);
    return g;
  },
  scale: () => 1.1,
};

// 🪀 Coil Spring — a brass wind-up key socketed into the back of the white
// tail, slowly turning as if winding the next mega-hop.
// Mechanic (main.js): a grounded duck compresses the coil (COIL_WINDOW); a
// grounded jump inside the window launches at COIL_VY — over tall walls.
import * as THREE from 'three';
import { toon, ink } from '../materials.js';

// darker than true brass — the toon ramp lifts it toward coin-gold, and the
// bow must not compete with the Slam badge's gold (Pixie tweak)
const BRASS = 0xa87b1e;
const DARK = 0x8a6410;

export default {
  id: 'coilspring',
  icon: '🪀', name: 'Coil Spring', desc: 'Duck, then jump: a mega-hop that clears tall walls.',
  rarity: 'rare', weight: 40, stack: 1, order: 200,
  apply: (m) => { m.coil = true; },
  build() {
    const g = new THREE.Group();
    const brassM = toon(BRASS, { flat: true }), darkM = toon(DARK, { flat: true });
    // a proper key silhouette (never "goggles"): one bow loop up top, a shaft
    // driven down into the tail, a little tooth at the bottom. The whole key
    // leans back off the camera axis so it reads as *inserted*, and it slowly
    // turns about its own shaft like it's winding the next hop.
    const key = new THREE.Group();
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.045, 10, 16), brassM);
    bow.position.y = 0.2; ink(bow, 1.1); key.add(bow);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 10), darkM);
    shaft.position.y = -0.02; ink(shaft, 1.14); key.add(shaft);
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.07), darkM);
    tooth.position.set(0, -0.1, 0.045); ink(tooth, 1.15); key.add(tooth);
    g.add(key); g.userData.key = key;
    // socketed into the top of the tail (tail at 0, 0.95, 0.55): bow just above
    // the fluff, leaning back a touch and angled off-axis so it reads as a key
    // from dead behind — never a donut concentric with the tail
    g.position.set(0.06, 1.06, 0.6);
    g.rotation.set(-0.25, 0.5, 0);
    g.scale.setScalar(0.8);
    return g;
  },
  scale: () => 0.8,
  // winds itself, slow and smug (~15°/s about the shaft)
  tick(g, t, dt) { g.userData.key.rotation.y += dt * 0.26; },
};

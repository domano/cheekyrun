// 🚀 Head Start — begin a few levels in. A permanent shop upgrade; self-contained
// in the same folder contract as the rest (see _example.js). Its worn prop is a
// stubby back rocket, revealed/scaled by owned tier (the normal path) with a
// flickering flame animated in tick().
import * as THREE from 'three';
import { toon, ink } from '../materials.js';

export default {
  id: 'headstart', icon: '🚀', name: 'Head Start',
  desc: 'Begin a few levels in.',
  max: 5, order: 1,
  cost: (l) => [60, 130, 240, 440, 760][l],
  gate: (l) => [null, null, null,
    { test: (s) => s.maxLevel >= 10, label: 'Reach Lv 10' },
    { test: (s) => s.runs >= 25, label: '25 runs' }][l],
  // Base run effect: levels skipped at the start = owned tier.
  effect: (tier, eff) => { eff.headstart = tier; },

  // 🚀 a stubby rocket saddled low on the back, nose up, three splayed fins and
  // a flickering flame.
  build() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.46, 12), toon(0xf2f2f4)); ink(body, 1.08); g.add(body);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.151, 0.151, 0.08, 12), toon(0xc9ccd2)); band.position.y = 0.02; g.add(band);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.2, 12), toon(0xe8554e)); nose.position.y = 0.33; ink(nose, 1.08); g.add(nose);
    [0, 1, 2].forEach(i => { const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.15, 0.13), toon(0xe8554e)); const a = i / 3 * Math.PI * 2; fin.position.set(Math.cos(a) * 0.175, -0.2, Math.sin(a) * 0.175); fin.rotation.y = -a; ink(fin, 1.12); g.add(fin); });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.26, 10), new THREE.MeshBasicMaterial({ color: 0xffb02e, transparent: true, opacity: 0.95 }));
    flame.position.y = -0.36; flame.rotation.x = Math.PI; g.add(flame);
    g.position.set(0, 0.5, 0.66); g.rotation.x = 0.45;
    g.userData.flame = flame;
    return g;
  },
  scale: (tier) => 0.62 + 0.1 * tier,
  tick(g, t) { g.userData.flame.scale.y = 0.8 + Math.abs(Math.sin(t * 22)) * 0.5; },
};

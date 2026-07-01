// 🦋 Flutterbutt Wings — a pair of small translucent wing-fans worn on the
// upper back. More tiers = floatier falls (lower floatMult). Body zone: upper
// back / wings (shoulder blades) — free, nothing else uses it.
import * as THREE from 'three';
import { toon, ink } from '../materials.js';

const WING = 0xc3b0f0; // soft lilac feather
const TIP = 0xffe4ef;  // pink-white leading tip (echoes the ears' pink inners)

function makeWing(mirror) {
  const g = new THREE.Group();
  // a 3-feather fan, decreasing size, so the outer edge reads scalloped like
  // plush feathers. Solid toon()+ink() so it holds the silhouette on the body.
  const feathers = [
    { r: 0.17, h: 0.44, a: 0.34, color: TIP },   // leading feather: pink-white
    { r: 0.14, h: 0.36, a: 0.0, color: WING },
    { r: 0.11, h: 0.28, a: -0.32, color: WING },
  ];
  feathers.forEach(({ r, h, a, color }, i) => {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 10), toon(color));
    cone.scale.set(1, 1, 0.2);         // flatten into a feather blade
    cone.rotation.z = Math.PI / 2 + a; // lay back, fanning by angle
    cone.position.set(0.08 * i * mirror, 0.03 * i, 0);
    ink(cone, 1.1);
    g.add(cone);
  });
  g.rotation.x = THREE.MathUtils.degToRad(33) * -1; // angle back ~33°
  return g;
}

export default {
  id: 'flutterwings',
  icon: '🦋',
  name: 'Flutterbutt Wings',
  desc: 'Hang time. Float like a leaf.',
  max: 4,
  order: 30,

  cost: (l) => [250, 450, 800, 1400][l],

  gate: (l) => [
    null,
    { test: (s) => s.maxLevel >= 15, label: 'Reach Lv 15' },
    { test: (s) => s.runs >= 30, label: '30 runs' },
    { test: (s) => s.maxLevel >= 20, label: 'Reach Lv 20' },
  ][l] || null,

  mods: (tier, m) => { m.floatMult *= 1 - 0.05 * tier; },

  // ---- worn 3D prop ----
  build() {
    const g = new THREE.Group();

    const left = makeWing(1);
    left.position.set(-0.52, 0.95, 0.18);
    left.rotation.y = THREE.MathUtils.degToRad(46);
    g.add(left);

    const right = makeWing(-1);
    right.position.set(0.52, 0.95, 0.18);
    right.rotation.y = THREE.MathUtils.degToRad(-46);
    right.scale.x = -1; // mirror the fan
    g.add(right);

    g.userData.left = left;
    g.userData.right = right;

    g.position.set(0, 0, 0); // wings already positioned in body space
    return g;
  },
  scale: (tier) => 0.9 + 0.1 * tier,
  tick(g, t) {
    const flap = Math.sin(t * 3) * 0.18;
    g.userData.left.rotation.y = THREE.MathUtils.degToRad(46) + flap;
    g.userData.right.rotation.y = THREE.MathUtils.degToRad(-46) - flap;
  },
};

import * as THREE from 'three';
import { toon, ink } from './materials.js';

// Builds the star of the show — a butt with ears — and returns the group plus
// the animated sub-parts the game loop needs to wiggle each frame.
export function buildPlayer(scene) {
  const player = new THREE.Group();
  const ears = [], feet = [];
  const skin = toon(0xffbfa8), inner = toon(0xff7ea6), blushM = toon(0xff8fa0, { emissive: 0xff5577 });

  [-0.34, 0.34].forEach(x => {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.58, 28, 28), skin);
    cheek.position.set(x, 0.6, 0); cheek.scale.set(1, 1.06, 1.02); cheek.castShadow = true; ink(cheek, 1.06); player.add(cheek);
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.16, 18), blushM);
    blush.position.set(x * 1.1, 0.5, 0.55); player.add(blush);
  });
  [-0.32, 0.32].forEach((x, i) => {
    const ear = new THREE.Group();
    const o = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 18), skin); o.scale.set(1, 2.3, 0.7); o.castShadow = true; ink(o, 1.1);
    const n = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 16), inner); n.scale.set(1, 2.1, 0.6); n.position.z = 0.06;
    ear.add(o, n); ear.position.set(x, 1.18, -0.05); ear.rotation.z = i ? -0.22 : 0.22; player.add(ear); ears.push(ear);
  });
  [-0.26, 0.26].forEach(x => {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), skin);
    f.scale.set(1, 0.55, 1.4); f.position.set(x, 0.1, 0.28); f.castShadow = true; ink(f, 1.12); player.add(f); feet.push(f);
  });
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), toon(0xfff4ef));
  tail.position.set(0, 0.95, 0.55); tail.castShadow = true; ink(tail, 1.12); player.add(tail);

  scene.add(player);
  return { player, ears, feet, tail };
}

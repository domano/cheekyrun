// 🦋 Flutterbutt Wings — a pair of small translucent wing-fans worn on the
// upper back. More tiers = floatier falls (lower floatMult). Body zone: upper
// back / wings (shoulder blades) — free, nothing else uses it.
import * as THREE from 'three';

const WING = 0xb39ddb; // soft lilac glow

function makeWing(mirror) {
  const g = new THREE.Group();
  // 3 overlapping flattened cones fanned out, on a short spar — cheap + airy.
  const fanAngles = [-0.3, 0, 0.3];
  fanAngles.forEach((a, i) => {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.34, 10),
      new THREE.MeshBasicMaterial({
        color: WING, transparent: true, opacity: 0.55,
        depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    cone.scale.set(1, 1, 0.15);        // flatten into a fan blade
    cone.rotation.z = Math.PI / 2 + a; // lay it back, fanning by angle
    cone.position.set(0.1 * i * mirror, 0.02 * i, 0);
    g.add(cone);
  });
  g.rotation.x = THREE.MathUtils.degToRad(25) * -1; // angle back ~25°
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
    left.position.set(-0.5, 0.75, -0.15);
    left.rotation.y = THREE.MathUtils.degToRad(20);
    g.add(left);

    const right = makeWing(-1);
    right.position.set(0.5, 0.75, -0.15);
    right.rotation.y = THREE.MathUtils.degToRad(-20);
    right.scale.x = -1; // mirror the fan
    g.add(right);

    g.userData.left = left;
    g.userData.right = right;

    g.position.set(0, 0, 0); // wings already positioned in body space
    return g;
  },
  scale: (tier) => 0.9 + 0.1 * tier,
  tick(g, t) {
    const flap = Math.sin(t * 3) * 0.22;
    g.userData.left.rotation.y = THREE.MathUtils.degToRad(20) + flap;
    g.userData.right.rotation.y = THREE.MathUtils.degToRad(-20) - flap;
  },
};

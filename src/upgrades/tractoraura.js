// 🧲 Tractor Aura — a wide pull-field ring on the ground at the character's
// feet, dragging stray rolls in from further away. Glow-only ground ring,
// same construction as buildAura() in player.js: additive outer ring + a
// brighter thin inner edge so it still reads on pale biomes. No ink outline
// (it's a glow, not a solid mesh) per house style.
import * as THREE from 'three';

const FIELD = 0x4fc3f7;

export default {
  id: 'tractoraura',
  icon: '🧲',
  name: 'Tractor Aura',
  desc: 'A pull-field drags stray rolls in.',
  max: 4,
  order: 20,

  cost: (l) => [200, 400, 700, 1100][l],

  gate: (l) => [
    null,
    { test: (s) => s.maxLevel >= 14, label: 'Reach Lv 14' },
    { test: (s) => s.runs >= 40, label: '40 runs' },
    { test: (s) => s.maxLevel >= 18, label: 'Reach Lv 18' },
  ][l] || null,

  mods: (tier, m) => { m.magnetBonus += 1.5 * tier; },

  // ---- worn 3D prop: ground ring at the feet ----
  build() {
    const g = new THREE.Group();

    const outer = new THREE.Mesh(
      new THREE.RingGeometry(1.0, 1.4, 40),
      new THREE.MeshBasicMaterial({
        color: FIELD, transparent: true, opacity: 0.4, depthWrite: false,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      }),
    );
    outer.rotation.x = -Math.PI / 2;
    g.add(outer);
    g.userData.outer = outer;

    // a fainter concentric inner ring gives the field depth (not a single hoop)
    const innerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.66, 32),
      new THREE.MeshBasicMaterial({
        color: FIELD, transparent: true, opacity: 0.2, depthWrite: false,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      }),
    );
    innerRing.rotation.x = -Math.PI / 2;
    g.add(innerRing);
    g.userData.innerRing = innerRing;

    // thin bright inner edge — NORMAL-blended (not additive) so it still reads
    // on pale biomes where an additive glow alone washes out (mirrors buildAura).
    const edge = new THREE.Mesh(
      new THREE.RingGeometry(1.0, 1.08, 40),
      new THREE.MeshBasicMaterial({
        color: FIELD, transparent: true, opacity: 0.85, depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    edge.rotation.x = -Math.PI / 2;
    g.add(edge);
    g.userData.edge = edge;

    g.position.set(0, 0.03, 0);
    return g;
  },
  scale: (tier) => 0.85 + 0.12 * tier,
  tick(g, t) {
    g.rotation.z = t * 0.5;
    const pulse = 0.35 + 0.12 * Math.sin(t * 2);
    g.userData.outer.material.opacity = pulse;
    g.userData.edge.material.opacity = pulse + 0.35;
    if (g.userData.innerRing) g.userData.innerRing.material.opacity = 0.15 + 0.08 * Math.sin(t * 2 + 1);
    // gentle radius breathing on the rings (not the group — that carries the tier scale)
    const breathe = 1 + 0.05 * Math.sin(t * 1.5);
    g.userData.outer.scale.setScalar(breathe);
    g.userData.edge.scale.setScalar(breathe);
  },
};

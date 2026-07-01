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

    // thin bright inner edge so the field still reads on pale biomes
    const edge = new THREE.Mesh(
      new THREE.RingGeometry(1.0, 1.08, 40),
      new THREE.MeshBasicMaterial({
        color: FIELD, transparent: true, opacity: 0.65, depthWrite: false,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      }),
    );
    edge.rotation.x = -Math.PI / 2;
    g.add(edge);
    g.userData.edge = edge;

    g.position.set(0, 0.05, 0);
    return g;
  },
  scale: (tier) => 0.85 + 0.12 * tier,
  tick(g, t) {
    g.rotation.z = t * 0.5;
    const pulse = 0.35 + 0.12 * Math.sin(t * 2);
    g.userData.outer.material.opacity = pulse;
    g.userData.edge.material.opacity = pulse + 0.25;
  },
};

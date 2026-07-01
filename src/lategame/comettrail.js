// 🔥 Comet Trail — a blazing wake streaming off the tail. Run hotter.
// Body zone: TAIL WAKE (nothing else uses this). See src/lategame/_example.js
// for the full contract and src/perkgear/doubledown.js for a reference prop.
import * as THREE from 'three';
import { toon } from '../materials.js';

const HOT = 0xff7043;    // tail-side, hottest
const MID = 0xffa542;    // mid taper
const BRIGHT = 0xffd54f; // bright tip

export default {
  id: 'comettrail',
  icon: '🔥',
  name: 'Comet Trail',
  desc: 'Run hotter. A blazing wake off your tail.',
  max: 3,
  order: 50,

  cost: (l) => [350, 700, 1300][l],

  gate: (l) => [
    { test: (s) => s.maxLevel >= 16, label: 'Reach Lv 16' },
    { test: (s) => s.maxLevel >= 20, label: 'Reach Lv 20' },
    { test: (s) => s.maxLevel >= 24, label: 'Reach Lv 24' },
  ][l] || null,

  mods: (tier, m) => { m.speedMult *= 1 + 0.03 * tier; },

  // ---- worn 3D prop: a tapering flame wake off the tail ----
  build() {
    const g = new THREE.Group();

    // 4 segments tapering from hot (near tail) to bright (tip), each a
    // translucent additive cone stretched into a flame lick, streaming
    // rearward (+z, behind the runner).
    const colors = [HOT, HOT, MID, BRIGHT];
    const segs = [];
    colors.forEach((color, i) => {
      const t = i / (colors.length - 1); // 0 near tail -> 1 at tip
      const radius = 0.16 * (1 - t * 0.6);
      const height = 0.34 + t * 0.22;
      const geo = new THREE.ConeGeometry(radius, height, 8, 1, true);
      const mat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.75 - t * 0.25,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const cone = new THREE.Mesh(geo, mat);
      // cones point +y by default; lay flat and aim rearward (+z), stacked
      // further back and slightly up per segment so it licks upward.
      cone.rotation.x = Math.PI / 2;
      cone.position.set(0, t * 0.08, 0.18 + t * 0.42);
      g.add(cone);
      segs.push({ mesh: cone, baseH: height, baseOpacity: mat.opacity, mat });
    });

    g.userData.segs = segs;

    // near the tail base (~0, 0.95, 0.55), streaming backward
    g.position.set(0, 0.9, 0.7);
    return g;
  },
  scale: (tier) => 0.85 + 0.12 * tier,
  tick(g, t) {
    const segs = g.userData.segs;
    if (!segs) return;
    segs.forEach((s, i) => {
      const flick = Math.abs(Math.sin(t * 18 + i));
      s.mesh.scale.y = 0.7 + 0.5 * flick;
      s.mat.opacity = s.baseOpacity * (0.6 + 0.4 * flick);
    });
  },
};

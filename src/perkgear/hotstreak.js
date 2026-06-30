// 🌟 Hot Streak — glowy flame tufts fanned around the base of the white tail.
// Reference template for a perk-gear prop: default-export an object with
//   id     — the perk id (must match perks.js); also its key in PERK_GEAR.
//   build()        → a THREE.Object3D, already positioned/oriented on the body.
//                    Built once, hidden; the game shows it when the perk is drafted.
//   scale(stacks)  → optional scalar so more stacks read a touch bigger. Keep it
//                    modest — tier shows through detail, not bulk (see applyGear).
//   tick(g, t, dt) → optional per-frame animation (t = elapsed secs, dt = frame).
// Keep the house style: every solid mesh gets toon() + an ink() outline; glows
// stay translucent with no outline; cheap primitives only; stay readable small.
// Per Pixie: flames were illegible (too dark/low/few, lost in the tail shadow).
// Fix landed here — moved up to the white tail base, 2-tone glow, no ink.
import * as THREE from 'three';

const CORE = 0xffd24a; // bright inner core
const OUTER = 0xff7a2e; // outer flame colour

export default {
  id: 'hotstreak',
  build() {
    const g = new THREE.Group();
    g.userData.flames = [];
    // 3-4 cone-ish tufts clustered at the base of the white tail, fanning up and back
    const spots = [
      { x: -0.09, z: -0.04, h: 0.3 },
      { x: 0, z: 0.04, h: 0.4 },
      { x: 0.09, z: -0.04, h: 0.3 },
    ];
    spots.forEach(({ x, z, h }, i) => {
      const flame = new THREE.Group();
      const outer = new THREE.Mesh(
        new THREE.ConeGeometry(0.07, h, 8),
        new THREE.MeshBasicMaterial({ color: OUTER, transparent: true, opacity: 0.9, depthWrite: false }),
      );
      outer.position.y = h / 2;
      flame.add(outer);
      const core = new THREE.Mesh(
        new THREE.ConeGeometry(0.04, h * 0.6, 8),
        new THREE.MeshBasicMaterial({ color: CORE, transparent: true, opacity: 0.9, depthWrite: false }),
      );
      core.position.y = h * 0.6;
      flame.add(core);
      flame.position.set(x, 0, z);
      g.add(flame);
      g.userData.flames.push({ group: flame, core, baseH: h, phase: i * 1.3 });
    });
    // clustered at the base of the white tail, popping against it
    g.position.set(0, 0.55, 0.6);
    return g;
  },
  scale: () => 1,
  tick(g, t) {
    g.userData.flames.forEach(({ group, core, phase }) => {
      const flick = Math.sin(t * 13 + phase); // ~6Hz-ish dual-lobed flicker per cycle
      group.scale.y = 1 + flick * 0.08;
      const shimmer = Math.sin(t * 37.7 + phase * 2);
      core.material.opacity = 0.85 + shimmer * 0.05;
    });
  },
};

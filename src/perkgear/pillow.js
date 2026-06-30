// 🛡️ Pillow Stack — a plush pillow worn high on the upper back like a clear
// backpack, cresting the top silhouette so it peeks up between/above the ears
// from the gameplay camera. A second, smaller pillow stacks just behind/above
// once 2 stacks are owned, so the tier reads through count, not bulk.
// Reference template: overdrive.js.
//   id     — the perk id (must match perks.js); also its key in PERK_GEAR.
//   build()        → a THREE.Object3D, already positioned/oriented on the body.
//                    Built once, hidden; the game shows it when the perk is drafted.
//   scale(stacks)  → optional scalar so more stacks read a touch bigger. Keep it
//                    modest — tier shows through detail, not bulk (see applyGear).
//   tick(g, t, dt) → optional per-frame animation (t = elapsed secs, dt = frame).
// Keep the house style: every solid mesh gets toon() + an ink() outline; glows
// stay translucent with no outline; cheap primitives only; stay readable small.
import * as THREE from 'three';
import { toon, ink } from '../materials.js';

const PILLOW = 0xa9b6e8;  // periwinkle — separates clearly from the off-white body
const BUTTON = 0x8c9ad8;  // a shade darker, tufted center dimple
const SEAM = 0x8c9ad8;    // thin quilting seam band, same dark tone as the dimple

// One plush pillow: a rounded box, a tufted center dimple, and a darker inset
// seam band standing in for two quilting lines (no extra outline meshes).
function makePillow(pillowM, buttonM, seamM, w, h, d) {
  const p = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d, 3, 3, 2), pillowM);
  body.castShadow = true; ink(body, 1.07); p.add(body);

  const button = new THREE.Mesh(new THREE.SphereGeometry(d * 0.34, 10, 10), buttonM);
  button.position.z = d / 2 - 0.02; ink(button, 1.1); p.add(button);

  // darker inset seam band pressed just into the face, flush — no outline so
  // it can't read as a separate floating mesh
  const seam = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, h * 0.1, 0.01), seamM);
  seam.position.z = d / 2 - 0.005;
  p.add(seam);

  return p;
}

export default {
  id: 'pillow',
  build() {
    const g = new THREE.Group();
    const pillowM = toon(PILLOW), buttonM = toon(BUTTON), seamM = toon(SEAM, { flat: true });

    // main pillow: rounded box 1.0 x 0.55 x 0.35, scaled down to body proportions
    const lower = makePillow(pillowM, buttonM, seamM, 0.4, 0.22, 0.14);
    g.add(lower);

    // second, smaller pillow tucked behind/above — revealed via tick() once
    // stacks >= 2, peeking just above the first to read as a taller stack
    const upper = makePillow(pillowM, buttonM, seamM, 0.32, 0.16, 0.1);
    upper.position.set(0, 0.16, -0.05);
    upper.visible = false;
    g.add(upper);
    g.userData.upper = upper;

    // mounted high on the upper back, tilted back so it crests the top
    // silhouette and peeks up between/above the ears from the chase camera
    g.position.set(0, 1.15, 0.15);
    g.rotation.x = -0.55;
    return g;
  },
  // stays modest in size; the stack reads through the second pillow, not bulk
  scale: (stacks) => (stacks >= 2 ? 1.02 : 1),
  tick(g, t) {
    // a 1.02 group scale (set by scale()) is the cue that 2 stacks are worn
    g.userData.upper.visible = g.scale.x > 1.01;
    // subtle squish breathing, offset between the two so it feels plush
    const s0 = 1 + Math.sin(t * 1.8) * 0.025;
    g.children[0].scale.set(1, s0, 1);
    if (g.userData.upper.visible) {
      const s1 = 1 + Math.sin(t * 1.8 + Math.PI * 0.6) * 0.025;
      g.userData.upper.scale.set(1, s1, 1);
    }
  },
};

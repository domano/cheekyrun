// 🛡️ Pillow Stack — a plush quilted pillow worn like a tiny backpack on the
// back; a second pillow appears stacked above it once 2 stacks are owned, so
// the tier reads through count rather than size. Reference template: overdrive.js.
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

const PILLOW = 0xbcd4ff;  // periwinkle quilted cotton
const BUTTON = 0x8fb3f0;  // a shade darker, tufted center button
const SEAM = 0x9cc0f5;    // thin quilting indent lines

// One plush pillow: a softened box (slightly rounded via low segment count +
// scale), a tufted center button, and two thin quilting seams.
function makePillow(pillowM, buttonM, seamM) {
  const p = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.1, 3, 3, 2), pillowM);
  body.castShadow = true; ink(body, 1.08); p.add(body);

  const button = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 10), buttonM);
  button.position.z = 0.06; ink(button, 1.1); p.add(button);

  // thin quilting seams — flattened boxes pressed just into the face, no outline
  [[-0.09, 0], [0.09, 0]].forEach(([x]) => {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.22, 0.004), seamM);
    seam.position.set(x, 0, 0.052);
    p.add(seam);
  });

  return p;
}

export default {
  id: 'pillow',
  build() {
    const g = new THREE.Group();
    const pillowM = toon(PILLOW), buttonM = toon(BUTTON), seamM = toon(SEAM, { flat: true });

    const lower = makePillow(pillowM, buttonM, seamM);
    g.add(lower);

    // second pillow, stacked just above — revealed via tick() once stacks >= 2
    const upper = makePillow(pillowM, buttonM, seamM);
    upper.position.y = 0.2;
    upper.visible = false;
    g.add(upper);
    g.userData.upper = upper;

    // worn like a tiny backpack on the back, tilted to lie flush against it
    g.position.set(0, 0.8, 0.55);
    g.rotation.x = -0.3;
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

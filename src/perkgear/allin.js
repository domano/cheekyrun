// 🎰 All In — a precarious stack of poker chips topped with a die, low on the
// left hip. The curse: triple rolls, no cushions, much more danger — so the
// whole stack rides a nervous wobble, like it could topple any second.
// Keep the house style: every solid mesh gets toon() + an ink() outline; glows
// stay translucent with no outline; cheap primitives only; stay readable small.
import * as THREE from 'three';
import { toon, ink } from '../materials.js';

const CHIP_COLORS = [0xe8554e, 0xffffff, 0x3a4a8a]; // red, white, navy bands, bottom to top
const DIE = 0xf4f4f8;
const PIP = 0x2a2a33;

export default {
  id: 'allin',
  build() {
    const g = new THREE.Group();

    // three stacked poker chips, each a short wide cylinder
    const chipR = 0.16, chipH = 0.05;
    CHIP_COLORS.forEach((color, i) => {
      const chip = new THREE.Mesh(
        new THREE.CylinderGeometry(chipR, chipR, chipH, 16),
        toon(color),
      );
      chip.position.y = i * chipH;
      ink(chip, 1.08);
      g.add(chip);
    });

    // small rounded-cube die balanced on top of the stack
    const die = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), toon(DIE));
    die.position.y = CHIP_COLORS.length * chipH + 0.075;
    die.rotation.y = 0.5;
    ink(die, 1.1);
    g.add(die);

    // pips on the die's top face (a "3")
    const pipM = toon(PIP, { flat: true });
    const pipY = die.position.y + 0.076;
    [[-0.045, -0.045], [0, 0], [0.045, 0.045]].forEach(([px, pz]) => {
      const pip = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 6), pipM);
      pip.position.set(px, pipY, pz);
      g.add(pip);
    });

    // low on the left hip, behind the body — a gambler's stash riding along
    g.position.set(-0.5, 0.55, 0.5);
    g.userData.base = g.rotation.z;
    return g;
  },
  scale: () => 1,
  tick(g, t) {
    // a nervous wobble — the stack always looks one bump from toppling
    g.rotation.z = g.userData.base + Math.sin(t * 5.5) * 0.07;
    g.rotation.x = Math.sin(t * 3.7 + 1) * 0.03;
  },
};

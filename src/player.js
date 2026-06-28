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
  const tailM = toon(0xfff4ef);
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), tailM);
  tail.position.set(0, 0.95, 0.55); tail.castShadow = true; ink(tail, 1.12); player.add(tail);

  const gear = buildGear(player);
  const aura = buildAura(player);

  scene.add(player);
  // `mats` are handed back so cosmetics can recolour the character in place;
  // `gear`/`aura` are the worn upgrade props and the power-up halo.
  return { player, ears, feet, tail, gear, aura, mats: { skin, inner, blush: blushM, tail: tailM } };
}

// Worn upgrade cosmetics — one prop per shop upgrade. All start hidden; the game
// reveals and scales them per owned tier via applyGear(), so the more you own
// the more pronounced the character looks.
function buildGear(player) {
  const gear = {};

  // 🛡️ Cushion — a soft bubble that thickens with each tier.
  const bubble = new THREE.Mesh(
    new THREE.SphereGeometry(1.15, 22, 16),
    new THREE.MeshBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0, depthWrite: false }),
  );
  bubble.position.set(0, 0.62, 0); bubble.visible = false; player.add(bubble); gear.shield = bubble;

  // 🦿 Springy Cheeks — stacked coil springs under each foot.
  const springs = new THREE.Group();
  [-0.26, 0.26].forEach(x => {
    const coil = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 6, 14), toon(0xb9c2cc, { flat: true }));
      ring.rotation.x = Math.PI / 2; ring.position.y = i * 0.07; coil.add(ring);
    }
    coil.position.set(x, -0.02, 0.28); springs.add(coil);
  });
  springs.visible = false; player.add(springs); gear.spring = springs;

  // 🧲 Roll Magnet — a horseshoe magnet hovering behind, bigger each tier.
  const magnet = new THREE.Group();
  const red = toon(0xff5151), tipM = toon(0xd6dde4);
  [-0.18, 0.18].forEach(x => { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.16), red); arm.position.set(x, 0.1, 0); ink(arm, 1.08); magnet.add(arm); });
  const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.16), red); yoke.position.y = 0.36; ink(yoke, 1.08); magnet.add(yoke);
  [-0.18, 0.18].forEach(x => { const tip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.16), tipM); tip.position.set(x, -0.2, 0); ink(tip, 1.1); magnet.add(tip); });
  magnet.position.set(0, 1.5, 0.62); magnet.rotation.x = -0.2; magnet.visible = false; player.add(magnet); gear.magnet = magnet;

  // 🍀 Lucky Rolls — a four-leaf clover bobbing over the head.
  const clover = new THREE.Group();
  const leafM = toon(0x5fd07a, { emissive: 0x114d22 });
  [[0.12, 0.12], [-0.12, 0.12], [0.12, -0.12], [-0.12, -0.12]].forEach(([x, z]) => {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), leafM);
    leaf.position.set(x, 0, z); leaf.scale.set(1, 0.5, 1); ink(leaf, 1.1); clover.add(leaf);
  });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 6), toon(0x4f9d57)); stem.position.y = -0.14; clover.add(stem);
  clover.position.set(0.5, 1.82, 0.05); clover.rotation.x = -0.6; clover.visible = false; player.add(clover); gear.fortune = clover;

  // 🚀 Head Start — a little rocket strapped to the back, flame and all.
  const rocket = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.5, 12), toon(0xf2f2f4)); ink(body, 1.08); rocket.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.22, 12), toon(0xff5151)); nose.position.y = 0.36; ink(nose, 1.08); rocket.add(nose);
  [-0.14, 0.14].forEach(x => { const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.14), toon(0xff5151)); fin.position.set(x, -0.22, 0); ink(fin, 1.12); rocket.add(fin); });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 10), new THREE.MeshBasicMaterial({ color: 0xffc14a, transparent: true, opacity: 0.9 }));
  flame.position.y = -0.34; flame.rotation.x = Math.PI; rocket.add(flame);
  rocket.position.set(0, 0.55, 0.66); rocket.rotation.x = 0.5; rocket.visible = false; player.add(rocket);
  gear.headstart = rocket; gear.flame = flame;

  return gear;
}

// The power-up halo — a glowing ring that appears around the player while a
// power-up is active. Recoloured per kind and spun by the game loop.
function buildAura(player) {
  const aura = new THREE.Mesh(
    new THREE.TorusGeometry(0.98, 0.07, 10, 28),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
  );
  aura.rotation.x = Math.PI / 2.3; aura.position.y = 0.6; aura.visible = false; player.add(aura);
  return aura;
}

// Reveal/scale each worn upgrade prop for the owned tiers, e.g.
// { shield: 2, spring: 1, magnet: 4, fortune: 3, headstart: 1 }. Anything at
// tier 0 (or absent) is hidden — so a daily run with no upgrades shows nothing.
export function applyGear(gear, t = {}) {
  const k = (id) => t[id] | 0;

  gear.shield.visible = k('shield') > 0;
  if (gear.shield.visible) { gear.shield.material.opacity = 0.08 + 0.06 * k('shield'); gear.shield.scale.setScalar(0.96 + 0.06 * k('shield')); }

  gear.spring.visible = k('spring') > 0;
  if (gear.spring.visible) gear.spring.scale.set(1, 0.8 + 0.55 * k('spring'), 1);

  gear.magnet.visible = k('magnet') > 0;
  if (gear.magnet.visible) gear.magnet.scale.setScalar(0.55 + 0.13 * k('magnet'));

  gear.fortune.visible = k('fortune') > 0;
  if (gear.fortune.visible) gear.fortune.scale.setScalar(0.7 + 0.22 * k('fortune'));

  gear.headstart.visible = k('headstart') > 0;
  if (gear.headstart.visible) gear.headstart.scale.setScalar(0.7 + 0.16 * k('headstart'));
}

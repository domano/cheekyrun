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

// Worn cosmetics — one prop per loadout slot. Cushion/Head Start track the
// permanent upgrades you own; magnet/springs/clover track the drafted perks
// (vacuum/hops/lucky) since those reframed into the roguelite layer. All start
// hidden; the game reveals and scales them via applyGear(), so the more you've
// banked or drafted the more pronounced the character looks.
function buildGear(player) {
  const gear = {};

  // Two accessory zones up top so worn props never pile on the centreline:
  // the magnet sits over the right shoulder, the clover over the left.
  // ----------------------------------------------------------------------

  // 🛡️ Cushion — a soft glassy bubble that hugs the body. Stays the same size
  // across tiers (it already wraps the whole character); owned tiers are read
  // off as little sparkle pips orbiting the equator instead of growing it.
  const shield = new THREE.Group();
  const bubble = new THREE.Mesh(
    new THREE.SphereGeometry(1.02, 22, 16),
    new THREE.MeshBasicMaterial({ color: 0xbcd4ff, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  bubble.position.y = 0.6; shield.add(bubble);
  // a brighter rim shell (back faces) gives it a glassy edge highlight
  const rim = new THREE.Mesh(
    new THREE.SphereGeometry(1.08, 20, 14),
    new THREE.MeshBasicMaterial({ color: 0xf2f8ff, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.BackSide }),
  );
  rim.position.y = 0.6; shield.add(rim);
  const pips = [];
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2;
    const pip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), new THREE.MeshBasicMaterial({ color: 0x8fb6ff }));
    pip.position.set(Math.cos(a) * 1.04, 0.6, Math.sin(a) * 1.04); pip.visible = false; shield.add(pip); pips.push(pip);
  }
  shield.visible = false; player.add(shield); gear.shield = shield; gear.shieldPips = pips;

  // 🦿 Springy Cheeks — two chunky coral coils under each foot, like spring shoes.
  const springs = new THREE.Group();
  const coilM = toon(0xff7a6e, { flat: true });
  [-0.26, 0.26].forEach(x => {
    const coil = new THREE.Group();
    for (let i = 0; i < 2; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.05, 8, 16), coilM);
      ring.rotation.x = Math.PI / 2; ring.position.y = i * 0.1; ink(ring, 1.12); coil.add(ring);
    }
    coil.position.set(x, -0.04, 0.28); springs.add(coil);
  });
  springs.visible = false; player.add(springs); gear.spring = springs;

  // 🧲 Roll Magnet — a rounded fridge-magnet horseshoe worn over the right
  // shoulder. Cherry red (shared with the rocket) to sit in the warm family.
  const magnet = new THREE.Group();
  const red = toon(0xe8554e), tipM = toon(0xd6dde4);
  [-0.16, 0.16].forEach(x => { const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.34, 12), red); arm.position.set(x, 0.0, 0); ink(arm, 1.08); magnet.add(arm); });
  const yoke = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.085, 10, 16, Math.PI), red); yoke.position.y = 0.17; ink(yoke, 1.06); magnet.add(yoke);
  [-0.16, 0.16].forEach(x => { const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.12, 12), tipM); tip.position.set(x, -0.22, 0); ink(tip, 1.1); magnet.add(tip); });
  magnet.position.set(0.4, 0.98, 0.34); magnet.rotation.set(0.35, 0, -0.18); magnet.visible = false; player.add(magnet); gear.magnet = magnet;

  // 🍀 Lucky Rolls — a four-leaf clover worn over the left shoulder, leaves
  // splayed with clear gaps so it reads clover, not cabbage.
  const clover = new THREE.Group();
  const leafTop = toon(0x7be08c, { emissive: 0x123d1f }), leafM = toon(0x4fb86a, { emissive: 0x0d2e15 });
  [[0.13, 0.13], [-0.13, 0.13], [0.13, -0.13], [-0.13, -0.13]].forEach(([x, z], i) => {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), i < 2 ? leafTop : leafM);
    leaf.position.set(x, 0, z); leaf.scale.set(1.1, 0.5, 1.1); ink(leaf, 1.12); clover.add(leaf);
  });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.22, 6), toon(0x4f9d57)); stem.position.y = -0.15; clover.add(stem);
  clover.position.set(-0.52, 1.22, 0.2); clover.rotation.x = -1.0; clover.visible = false; player.add(clover); gear.fortune = clover;

  // 🚀 Head Start — a stubby rocket saddled low and centred on the back, nose
  // up, with three fins splayed so they read from behind and a flickering flame.
  const rocket = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.46, 12), toon(0xf2f2f4)); ink(body, 1.08); rocket.add(body);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.151, 0.151, 0.08, 12), toon(0xc9ccd2)); band.position.y = 0.02; rocket.add(band);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.2, 12), toon(0xe8554e)); nose.position.y = 0.33; ink(nose, 1.08); rocket.add(nose);
  [0, 1, 2].forEach(i => { const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.15, 0.13), toon(0xe8554e)); const a = i / 3 * Math.PI * 2; fin.position.set(Math.cos(a) * 0.175, -0.2, Math.sin(a) * 0.175); fin.rotation.y = -a; ink(fin, 1.12); rocket.add(fin); });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.26, 10), new THREE.MeshBasicMaterial({ color: 0xffb02e, transparent: true, opacity: 0.95 }));
  flame.position.y = -0.36; flame.rotation.x = Math.PI; rocket.add(flame);
  rocket.position.set(0, 0.5, 0.66); rocket.rotation.x = 0.45; rocket.visible = false; player.add(rocket);
  gear.headstart = rocket; gear.flame = flame;

  return gear;
}

// The power-up "aura" — a soft glowing ring on the ground under the character
// (a powered-up footprint) rather than a hard belt slicing through the body.
// Recoloured per kind and pulsed by the game loop.
function buildAura(player) {
  const aura = new THREE.Mesh(
    new THREE.RingGeometry(0.95, 1.32, 36),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
  );
  aura.rotation.x = -Math.PI / 2; aura.position.y = 0.05; aura.visible = false;
  // A thin bright inner edge (normal-blended, so it still shows on pale biomes
  // where the additive glow alone would wash out against a light path).
  const edge = new THREE.Mesh(
    new THREE.RingGeometry(0.95, 1.04, 36),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.65, depthWrite: false, side: THREE.DoubleSide }),
  );
  aura.add(edge); aura.userData.edge = edge;
  player.add(aura);
  return aura;
}

// Reveal each worn prop for its tier/stack count, e.g.
// { spring: 1, magnet: 4, fortune: 3, headstart: 1 } — headstart from the owned
// upgrade, magnet/spring/fortune from drafted perk stacks. Anything at 0 (or
// absent) is hidden — so a fresh run with no upgrades or perks shows nothing.
// The Cushion bubble is *not* driven here: it tracks the live shield count
// (see updateShieldGear in main.js) so it pops the moment the last one is spent.
// Props stay a fixed, modest size; tier shows through small details, not bulk,
// so the silhouette stays clean even with everything equipped.
export function applyGear(gear, t = {}) {
  const k = (id) => t[id] | 0;

  gear.spring.visible = k('spring') > 0;
  if (gear.spring.visible) gear.spring.scale.setScalar(0.9 + 0.14 * k('spring'));

  gear.magnet.visible = k('magnet') > 0;
  if (gear.magnet.visible) gear.magnet.scale.setScalar(0.56 + 0.06 * k('magnet'));

  gear.fortune.visible = k('fortune') > 0;
  if (gear.fortune.visible) gear.fortune.scale.setScalar(0.98 + 0.12 * k('fortune'));

  gear.headstart.visible = k('headstart') > 0;
  if (gear.headstart.visible) gear.headstart.scale.setScalar(0.62 + 0.1 * k('headstart'));
}

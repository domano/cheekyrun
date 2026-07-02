import * as THREE from 'three';
import { toon, ink, heroGradient } from './materials.js';

// Auto-loaded worn-gear definitions. Two folders feed the same pipeline:
//   ./perkgear/*.js  — one file per drafted perk (keyed by perk id)
//   ./upgrades/*.js  — one file per shop upgrade (keyed by upgrade id; the same
//                      file also declares the shop entry + effect, read by
//                      upgrades.js — see src/upgrades/_example.js). This includes
//                      the core Cushion + Head Start.
// Each default-exports { id, build(), scale?(n), tick?(group, t, dt) } (an
// upgrade file carries extra shop fields too, ignored here). Dropping a new
// file in either folder is all it takes to give it a worn prop — buildGear()
// builds it hidden, applyGear() reveals/scales it by tier/stack count, and
// tickGear() runs its animation. Files prefixed `_` are templates, skipped.
// A def can set `liveGear: true` to keep its own reveal (e.g. the Cushion bubble,
// driven by the live shield count in main.js) — applyGear leaves those alone.
// No other edits, so the props are collision-free to author in parallel.
const loadDefs = (glob) => Object.entries(glob)
  .filter(([path]) => !path.split('/').pop().startsWith('_'))
  .map(([, m]) => m.default).filter(Boolean);
const GEAR_DEFS = [
  ...loadDefs(import.meta.glob('./perkgear/*.js', { eager: true })),
  // upgrade files that actually declare a worn prop (build()); effect-only
  // upgrades without a model are simply skipped here.
  ...loadDefs(import.meta.glob('./upgrades/*.js', { eager: true })).filter((d) => typeof d.build === 'function'),
];

// Builds the star of the show — a butt with ears — and returns the group plus
// the animated sub-parts the game loop needs to wiggle each frame.
export function buildPlayer(scene) {
  const player = new THREE.Group();
  const ears = [], feet = [];
  // Hero materials sample the WARM hero ramp (materials.js) so the shade band
  // reads plush peach, not grey. Base colours come from the selected skin
  // (cosmetics.js — Classic is a warm ivory-peach).
  const ramp = heroGradient();
  const skin = toon(0xffdcc6, { ramp }), inner = toon(0xff92ac, { ramp }), blushM = toon(0xffb3c0, { emissive: 0xff5577, transparent: true, opacity: 0.9 });

  [-0.34, 0.34].forEach(x => {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.58, 28, 28), skin);
    cheek.position.set(x, 0.6, 0); cheek.scale.set(1, 1.06, 1.02); cheek.castShadow = true; ink(cheek, 1.06); player.add(cheek);
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.24, 18), blushM);
    blush.position.set(x * 1.1, 0.5, 0.55); player.add(blush);
  });
  [-0.32, 0.32].forEach((x, i) => {
    const ear = new THREE.Group();
    const o = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 18), skin); o.scale.set(1, 2.3, 0.7); o.castShadow = true; ink(o, 1.1);
    // Inner plane widened so a pink sliver peeks past the outer ear from behind.
    const n = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 16), inner); n.scale.set(1.3, 2.1, 0.6); n.position.z = 0.06;
    ear.add(o, n); ear.position.set(x, 1.18, -0.05); ear.rotation.z = i ? -0.22 : 0.22; player.add(ear); ears.push(ear);
  });
  [-0.26, 0.26].forEach(x => {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), skin);
    f.scale.set(1, 0.55, 1.4); f.position.set(x, 0.1, 0.28); f.castShadow = true; ink(f, 1.12); player.add(f); feet.push(f);
  });
  const tailM = toon(0xffffff, { ramp });   // pure white so the tail pops against the peach body
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), tailM);
  tail.position.set(0, 0.95, 0.55); tail.castShadow = true; ink(tail, 1.12); player.add(tail);

  const gear = buildGear(player);
  const aura = buildAura(player);

  scene.add(player);
  // `mats` are handed back so cosmetics can recolour the character in place;
  // `gear`/`aura` are the worn upgrade props and the power-up halo.
  return { player, ears, feet, tail, gear, aura, mats: { skin, inner, blush: blushM, tail: tailM } };
}

// Worn cosmetics — one prop per loadout slot. The shop upgrades (Cushion, Head
// Start, and the late-game unlocks) each live in ./upgrades/<id>.js and are
// built by the GEAR_DEFS loop below; magnet/springs/clover are the drafted perks
// (vacuum/hops/lucky) still kept inline here. All start hidden; the game reveals
// and scales them via applyGear(), so the more you've banked or drafted the more
// pronounced the character looks.
function buildGear(player) {
  const gear = {};

  // Two accessory zones up top so worn props never pile on the centreline:
  // the magnet sits over the right shoulder, the clover over the left.
  // ----------------------------------------------------------------------

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

  // Folder-driven props: perks (./perkgear/) + shop upgrades (./upgrades/,
  // including the Cushion bubble and Head Start rocket). Built hidden and keyed
  // by id; applyGear() reveals/scales them, tickGear() animates them.
  gear._defs = GEAR_DEFS;
  for (const def of GEAR_DEFS) {
    const g = def.build();
    g.visible = false;
    player.add(g);
    gear[def.id] = g;
  }

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
// A `liveGear` def (the Cushion bubble) is skipped here: it tracks the live
// shield count (see updateShieldGear in main.js) so it pops the moment the last
// one is spent. Props stay a fixed, modest size; tier shows through small
// details, not bulk, so the silhouette stays clean even with everything equipped.
export function applyGear(gear, t = {}) {
  const k = (id) => t[id] | 0;

  gear.spring.visible = k('spring') > 0;
  if (gear.spring.visible) gear.spring.scale.setScalar(0.9 + 0.14 * k('spring'));

  gear.magnet.visible = k('magnet') > 0;
  if (gear.magnet.visible) gear.magnet.scale.setScalar(0.56 + 0.06 * k('magnet'));

  gear.fortune.visible = k('fortune') > 0;
  if (gear.fortune.visible) gear.fortune.scale.setScalar(0.98 + 0.12 * k('fortune'));

  // Folder-driven props (perks + shop upgrades): shown when owned/drafted,
  // scaled by tier/stacks. liveGear props keep their own reveal (see above).
  for (const def of gear._defs || []) {
    if (def.liveGear) continue;
    const g = gear[def.id]; if (!g) continue;
    const n = k(def.id);
    g.visible = n > 0;
    if (g.visible) g.scale.setScalar(def.scale ? def.scale(n) : 1);
  }
}

// Per-frame animation for the dynamic perk props that opt in via def.tick.
// Called from the main loop with the elapsed time and frame dt.
export function tickGear(gear, t, dt) {
  for (const def of (gear && gear._defs) || []) {
    if (!def.tick) continue;
    const g = gear[def.id];
    if (g && g.visible) def.tick(g, t, dt);
  }
}

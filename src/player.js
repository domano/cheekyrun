import * as THREE from 'three';
import { toon, ink } from './materials.js';

// Auto-loaded worn-gear definitions. Two folders feed the same pipeline:
//   ./perks/*.js     — one file per drafted perk (keyed by perk id; the same
//                      file also declares the draft catalog entry, read by
//                      perks.js — see src/perks/_example.js)
//   ./upgrades/*.js  — one file per shop upgrade (keyed by upgrade id; the same
//                      file also declares the shop entry + effect, read by
//                      upgrades.js — see src/upgrades/_example.js). This includes
//                      the core Cushion + Head Start.
// Each default-exports { id, build(), scale?(n), tick?(group, t, dt) } among
// its catalog/shop fields (ignored here). Dropping a new file in either folder
// is all it takes to give it a worn prop — buildGear() builds it hidden,
// applyGear() reveals/scales it by tier/stack count, and tickGear() runs its
// animation. Files prefixed `_` are templates, skipped. A def can set
// `liveGear: true` to keep its own reveal (e.g. the Cushion bubble, driven by
// the live shield count in main.js) — applyGear leaves those alone.
// No other edits, so the props are collision-free to author in parallel.
const loadDefs = (glob) => Object.entries(glob)
  .filter(([path]) => !path.split('/').pop().startsWith('_'))
  // only defs that actually declare a worn prop (build()); effect-only
  // entries without a model are simply skipped here.
  .map(([, m]) => m.default).filter((d) => d && typeof d.build === 'function');
const GEAR_DEFS = [
  ...loadDefs(import.meta.glob('./perks/*.js', { eager: true })),
  ...loadDefs(import.meta.glob('./upgrades/*.js', { eager: true })),
];

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

// Worn cosmetics — one prop per loadout slot, all folder-driven: the shop
// upgrades (Cushion, Head Start, ...) each live in ./upgrades/<id>.js and the
// drafted perks in ./perks/<id>.js. All start hidden; the game reveals and
// scales them via applyGear(), so the more you've banked or drafted the more
// pronounced the character looks.
function buildGear(player) {
  const gear = {};

  // Folder-driven props: perks (./perks/) + shop upgrades (./upgrades/,
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
// { hops: 1, vacuum: 4, lucky: 3, headstart: 1 } — headstart from the owned
// upgrade, vacuum/hops/lucky from drafted perk stacks. Anything at 0 (or
// absent) is hidden — so a fresh run with no upgrades or perks shows nothing.
// A `liveGear` def (the Cushion bubble) is skipped here: it tracks the live
// shield count (see updateShieldGear in main.js) so it pops the moment the last
// one is spent. Props stay a fixed, modest size; tier shows through small
// details, not bulk, so the silhouette stays clean even with everything equipped.
export function applyGear(gear, t = {}) {
  const k = (id) => t[id] | 0;

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

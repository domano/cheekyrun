// TEMPLATE — copy this to src/upgrades/<yourid>.js for a new shop upgrade.
// Files whose name starts with `_` are skipped by the loaders, so this one
// never ships. One self-contained file declares EVERYTHING for an upgrade:
//
//   • the shop entry  — read by upgrades.js (appears in the shop automatically)
//   • the run effect  — TWO ways, use whichever fits (or both):
//       - mods(tier, m):    fold into the run's `mods` accumulator (perks.js
//         freshMods shape). A permanent, milder echo of a perk — those knobs are
//         all already consumed in main.js, so zero new wiring. Best for unlocks.
//       - effect(tier, eff): set a BASE run value on the effects object
//         { magnet, shields, rollValue, extraJumps, headstart }, read once at run
//         start. This is how the core floor upgrades work (see ./shield.js,
//         ./headstart.js).
//   • the worn 3D prop — build()/scale()/tick(): read by player.js, shown on the
//                       butt-with-ears character while any tier is owned, sized
//                       by owned tier. Same contract as src/perkgear/*.js. Set
//                       `liveGear: true` if the game loop drives its reveal itself
//                       (like the Cushion bubble tracking the live shield count).
//
// House style: every solid mesh gets toon() + an ink() outline; glows stay
// translucent with NO outline; cheap primitives only; stay readable when small.
// Keep it cute and on-model. Prop slots already in use so you don't collide:
//   right shoulder = magnet · left shoulder = clover · back-centre = rocket ·
//   whole-body bubble = shield · feet = springs. Pick a free zone.
import * as THREE from 'three';
import { toon, ink } from '../materials.js';

export default {
  id: 'example',                 // unique; also the key for its worn prop + owned tier
  icon: '✨',
  name: 'Example Boost',
  desc: 'What it does, in one short line.',
  max: 3,                        // number of tiers
  order: 100,                    // shop sort order (lower = earlier); optional

  // Cost to reach the NEXT tier from current tier l (valid for l < max).
  cost: (l) => [200, 400, 800][l],

  // A short human label for the current tier (optional; renderShop uses dots).
  label: (l) => `tier ${l}`,

  // Late-game skill gate fencing each tier: gate(l) -> {test, label} | null.
  // null tiers are free to buy once affordable. Gate deep so it rewards play.
  gate: (l) => [
    { test: (s) => s.maxLevel >= 15, label: 'Reach Lv 15' },
    { test: (s) => s.maxLevel >= 20, label: 'Reach Lv 20' },
    { test: (s) => s.runs >= 40, label: '40 runs' },
  ][l] || null,

  // Fold this upgrade's effect into the run mods `m` for the owned `tier`
  // (>= 1). Multiply/accumulate onto existing knobs — see perks.js freshMods().
  mods: (tier, m) => { m.rollMult *= 1 + 0.04 * tier; },

  // ---- worn 3D prop (identical contract to src/perkgear/*.js) ----
  build() {
    const g = new THREE.Group();
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 14), toon(0xffd23f));
    ink(bead, 1.1); g.add(bead);
    g.position.set(-0.5, 1.3, 0.2);   // pick a free body zone
    return g;
  },
  scale: (tier) => 0.9 + 0.12 * tier,  // subtle growth with tier (optional)
  tick(g, t) { g.rotation.y = Math.sin(t * 1.6) * 0.2; },  // idle animation (optional)
};

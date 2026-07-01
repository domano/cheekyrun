// TEMPLATE — copy this to src/perks/<yourid>.js for a new in-run draft perk.
// Files whose name starts with `_` are skipped by the loaders, so this one
// never ships. One self-contained file declares EVERYTHING for a perk:
//
//   • the catalog entry — read by perks.js (joins the draft pool automatically):
//       - id/icon/name/desc: what the draft card shows.
//       - rarity: 'common' | 'rare' | 'epic' | 'curse' (card styling).
//       - weight: draft draw weight — commons ~80-100, rares ~45-60,
//         epics ~20-30, curses ~22-30. Higher = offered more often.
//       - stack:  how many times it can be drafted in one run.
//       - order:  catalog sort position (current files use 10, 20, 30, ...).
//         PERKS order feeds the seeded daily draft, so append new perks at the
//         END (a bigger order) — reordering shifts everyone's daily offers.
//   • the run effect — apply(m): fold into the run's `mods` accumulator (see
//     freshMods() in perks.js for every knob). Called once per owned stack, so
//     use *= / += ops that compound. Optional shieldGrant: n is a one-shot +n
//     cushions applied at draft time in main.js (not in apply — a recompute
//     must not refund a shield already spent), so pair it with a no-op apply.
//   • the worn 3D prop — build()/scale()/tick(): read by player.js, shown on
//     the butt-with-ears character while the perk is drafted (perks are
//     per-run, so it's stripped off on a fresh run), sized by stack count.
//     Same contract as the shop upgrades' props (src/upgrades/_example.js).
//
// House style: every solid mesh gets toon() + an ink() outline; glows stay
// translucent with NO outline; cheap primitives only; stay readable when small.
// Keep it cute and on-model. Prop slots already in use so you don't collide:
//   right shoulder = magnet · left shoulder = clover · back-centre = rocket ·
//   whole-body bubble = shield · feet = springs · head = brain · face = shades ·
//   tail-base = flames · hips = sack/chips/glass · ears = feather/magpie.
import * as THREE from 'three';
import { toon, ink } from '../materials.js';

export default {
  id: 'example',                 // unique; also the key for its worn prop
  icon: '✨',
  name: 'Example Perk',
  desc: 'What it does, in one short line.',
  rarity: 'rare',
  weight: 50,
  stack: 2,                      // draftable this many times per run
  order: 999,                    // catalog position — append after existing perks

  // Fold one stack into the run mods `m` — see perks.js freshMods().
  apply: (m) => { m.rollMult *= 1.1; },

  // shieldGrant: 1,             // optional one-shot cushions on draft (see above)

  // ---- worn 3D prop (same contract as src/upgrades/_example.js) ----
  build() {
    const g = new THREE.Group();
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 14), toon(0xffd23f));
    ink(bead, 1.1); g.add(bead);
    g.position.set(-0.5, 1.3, 0.2);   // pick a free body zone
    return g;
  },
  scale: (stacks) => 0.9 + 0.12 * stacks,  // subtle growth per stack (optional)
  tick(g, t) { g.rotation.y = Math.sin(t * 1.6) * 0.2; },  // idle animation (optional)
};

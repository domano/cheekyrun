// TEMPLATE — copy this to src/boosts/<yourid>.js for a new in-run boost (the
// rare floating power-up gems). Files whose name starts with `_` are skipped by
// the loader, so this one never ships. One self-contained file declares
// EVERYTHING for a boost:
//
//   • identity — read by boosts.js + the HUD chip / aura / pickup banner:
//       - id:    unique; also the debug spawn key ('powerup:<id>').
//       - icon/label: what the banner and the active-power HUD chip show.
//       - color: gem / aura / particle tint (hex number).
//       - order: catalog sort position (the core four use 10/20/30/40 —
//         append after them; a stable order keeps seeded spawn draws
//         reproducible between builds).
//   • availability — read by the spawner (spawnRow in main.js):
//       - minLevel (default 1): only drawn once the run reaches this level.
//       - weight   (default 1): spawn draw weight among eligible boosts.
//   • declarative effects — consumed generically in main.js while the boost is
//     active; set only the fields you need:
//       - speedMult:   multiply the live run speed (dash uses 1.5).
//       - magnetFloor: raise the magnet radius to at least this (magnet: 9).
//       - scoreMult:   multiply roll payouts (x2 uses 2).
//       - invuln: true    — invulnerable for the boost's duration (ghost, dash).
//       - ghostBody: true — the character renders translucent (ghost).
//       - timeScale: <k>  — the WORLD runs at this fraction of real time while
//         active (chrono: 0.55); the player's own physics/inputs stay
//         full-speed. Dominates the near-miss slow-mo (never stacks with it);
//         hit-stop still freezes outright. Not invulnerability.
//       - smash: true — contacting a single-lane, non-duck hazard demolishes
//         it for RAMPAGE_BONUS × combo mult instead of killing (rampage).
//         Duck bars and full-width gates keep their normal lethal rules.
//       - bounce: <vy>— landings auto-relaunch at this vy with air jumps
//         refunded (pogo). Ground hazards still kill a low pass, and the
//         air-time bonus stays gated on a spent double-jump.
//       - allLanes: true  — rolls in ANY lane auto-collect (twin); elevated
//         rolls still demand matching air.
//       - sideSmash: true — single-lane, non-duck hazards in the two
//         NON-player lanes are demolished for TWIN_BONUS × combo mult as they
//         reach the player's z (twin); the player's own lane keeps normal rules.
//   • pickup look — optional dress(group, THREE, helpers): the default pickup
//     is the standard gem (makePowerup(color) in props.js); dress() may add to
//     or restyle that group after construction. helpers = { toon, ink, glow }
//     from materials.js. The core four don't use it — zero visual change.
//     Late-game RELICS share a fancier base treatment: call
//     relicDress(group, THREE, helpers) from ./_relic.js first (×1.25 gem, a
//     spinning gold halo crown, orbiting stars), then add the boost's own
//     identifying topper. dress() may register extra idle spinners via
//     group.userData.spins = [{ m: mesh, a: 'x'|'y'|'z', r: rad/s }] —
//     movePickups steps them every frame.
//   • lifecycle hooks — optional, for genuinely NEW mechanics the declarative
//     fields can't express. Each receives a ctx (below); onTick also gets the
//     scaled sim dt:
//       - onActivate(ctx)  — the moment the gem is grabbed.
//       - onTick(ctx, dt)  — every active sim frame while the timer runs.
//       - onEnd(ctx)       — when the timer expires — and ALSO when the boost
//         is swapped for another, on game over and on reset, so a hook that
//         adds scene objects can never leak them. Keep onEnd idempotent.
//     ctx (built fresh per call by boostCtx() in main.js — lean but useful):
//       { player, scene, particles,             // live three.js objects
//         level, speed, distance,               // run readouts (numbers)
//         lanes,                                // LANES x positions
//         laneIdx: () => n,                     // current lane index getter
//         obstacles, rolls, pickups,            // live prop arrays (inspect)
//         addPoints(n),                         // award bonus score
//         grantInvuln(t),                       // extend invulnerability (s)
//         addShield(n = 1),                     // grant cushions
//         emit(pos, opts),                      // particle burst (particles.emit)
//         banner(text), flash(color), buzz(ms) }  // juice
//
// House style: the gem must stay readable as one solid coloured pickup; solid
// meshes get toon() + an ink() outline, glows stay translucent with NO outline.
export default {
  id: 'example',
  icon: '✨',
  color: 0xffd23f,
  label: 'Example',
  order: 999,          // append after the core four (10/20/30/40)
  minLevel: 1,         // the spawner only draws this at/after this level
  weight: 1,           // spawn draw weight among eligible boosts

  // ---- declarative effects (set only what you need) ----
  // speedMult: 1.5,
  // magnetFloor: 9,
  // scoreMult: 2,
  // invuln: true,
  // ghostBody: true,

  // ---- optional pickup dressing (default = the standard gem) ----
  // dress(group, THREE, { toon, ink, glow }) {
  //   const stud = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), toon(0xffffff));
  //   ink(stud, 1.1); stud.position.y = 0.55; group.add(stud);
  // },

  // ---- optional lifecycle hooks (for brand-new mechanics) ----
  // onActivate(ctx) { ctx.banner('✨ Example!'); },
  // onTick(ctx, dt) { /* runs each active sim frame */ },
  // onEnd(ctx) { /* cleanup */ },
};

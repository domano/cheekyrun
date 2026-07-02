// Echo Twins (relic): two ghost clones ride the side lanes at the player's z.
// While active, rolls in ANY lane auto-collect (allLanes relaxes the lateral
// grab gate in moveRolls) and single-lane jump-hazards in the two NON-player
// lanes are smashed for a small bonus as they draw level (sideSmash, paying
// TWIN_BONUS × combo mult). The player's own lane keeps normal rules — dodge
// or die. The clones are pure lifecycle-hook visuals: spawned onActivate,
// bobbed/repositioned onTick, removed onEnd (which main.js also fires on boost
// swap, game over and reset, so they can never leak between runs).
import * as THREE from 'three';
import { toon } from '../materials.js';
import { relicDress } from './_relic.js';

const PINK = 0xf25fb0;   // deep candy pink — the toon ramp lifts it pastel; paler washes to white

// Module state is safe here: only one boost is ever active at a time.
let clones = null, bobT = 0;

// A translucent ghost-double: three toon spheres suggesting the cheeks + ears.
// Translucent glow-adjacent, so per house style it takes NO ink outline.
function makeClone() {
  const g = new THREE.Group();
  const m = toon(PINK, { transparent: true, opacity: 0.4, emissive: 0x5a1a44 });
  m.depthWrite = false;
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.44, 12, 12), m);
  body.position.y = 0.55; body.scale.set(1.15, 0.92, 1);
  const earL = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), m);
  earL.position.set(-0.3, 1.02, 0); earL.scale.y = 1.5;
  const earR = earL.clone(); earR.position.x = 0.3;
  g.add(body, earL, earR);
  return g;
}
function removeClones(ctx) {
  if (!clones) return;
  clones.forEach(c => ctx.scene.remove(c));
  clones = null;
}

export default {
  id: 'twin',
  icon: '👯',
  color: PINK,
  label: 'Echo Twins',
  order: 80,
  minLevel: 10,
  weight: 0.5,
  allLanes: true,    // rolls in ANY lane auto-collect
  sideSmash: true,   // the twins demolish single-lane hazards in the two side lanes

  dress(g, THREE_, helpers) {
    relicDress(g, THREE_, helpers);
    // Topper is the gem itself, split into a two-gem read: shrink the base gem
    // aside and overlap a paler echo of it.
    const gem = g.userData.gem;
    gem.scale.setScalar(0.74); gem.position.x = -0.16;
    // Deepen both gems' self-glow — full-strength emissive pink washes to
    // white on the palest biome.
    gem.material.emissive.setHex(0x7a2058);
    const echo = new THREE_.Mesh(new THREE_.IcosahedronGeometry(0.46, 0),
      helpers.toon(0xf28ac8, { emissive: 0x8a3a68, flat: true }));
    echo.scale.setScalar(0.58); echo.position.set(0.22, 0.1, 0.08);
    helpers.ink(echo, 1.1);
    g.add(echo);
    g.userData.spins.push({ m: echo, a: 'y', r: 4 });
  },

  onActivate(ctx) {
    removeClones(ctx);   // idempotent — a re-grab never strands a stale pair
    bobT = 0; clones = [makeClone(), makeClone()];
    clones.forEach(c => ctx.scene.add(c));
    ctx.emit(ctx.player.position.clone().add(new THREE.Vector3(0, 0.8, 0)),
      { count: 12, color: PINK, speed: 3.5, up: 3, life: .6, grav: 5, size: 0.45 });
  },
  onTick(ctx, dt) {
    if (!clones) return;
    bobT += dt;
    const side = [0, 1, 2].filter(i => i !== ctx.laneIdx());   // the two non-player lanes
    clones.forEach((c, i) => {
      c.position.set(ctx.lanes[side[i]], Math.sin(bobT * 6 + i * Math.PI) * 0.12 + 0.06, ctx.player.position.z);
    });
  },
  onEnd(ctx) { removeClones(ctx); },
};

// Shared "relic" pickup treatment for the late-game boosts. Relics are rarer
// and mechanically wilder than the core four gems, so their pickups must read
// as clearly MORE special at gameplay distance: the whole gem scales up ×1.25,
// a gold halo ring spins tilted over it like a crown, and a few tiny 4-point
// stars orbit it (additive, no outline — house glow rule). Each relic file
// calls relicDress(g, THREE, helpers) from its dress(), then adds its own
// identifying topper. The `_` prefix keeps this out of the boost loader.
//
// Idle animation: movePickups (main.js) steps every entry a dress() registers
// in group.userData.spins ({ m: mesh, a: 'x'|'y'|'z' axis, r: rad/s }).
const GOLD = 0xffd23f;

export function relicDress(g, THREE, { toon, ink }) {
  g.scale.setScalar(1.25);   // the whole pickup — gem + toppers added after — reads bigger

  // Crown: a gold halo ring floating tilted over the gem; the pivot precesses
  // slowly so the tilt sweeps around like a spinning coronet.
  const crown = new THREE.Group(); crown.position.y = 0.6;
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.06, 8, 22), toon(GOLD, { emissive: 0x8a6a10 }));
  ink(halo, 1.16);
  halo.rotation.x = Math.PI / 2 - 0.32;
  crown.add(halo); g.add(crown);

  // Three tiny orbiting stars — cheap flat quads that twinkle as the pivot turns.
  const orbit = new THREE.Group(); orbit.position.y = 0.12;
  const starMat = new THREE.MeshBasicMaterial({
    color: GOLD, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3;
    const star = new THREE.Mesh(new THREE.CircleGeometry(0.13, 4), starMat);
    star.position.set(Math.cos(a) * 0.82, Math.sin(a * 2) * 0.16, Math.sin(a) * 0.82);
    star.rotation.z = Math.PI / 4;   // square → 4-point sparkle read
    orbit.add(star);
  }
  g.add(orbit);

  g.userData.spins = [...(g.userData.spins || []), { m: crown, a: 'y', r: 0.9 }, { m: orbit, a: 'y', r: 1.7 }];
  return g;
}

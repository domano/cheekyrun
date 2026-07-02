// Boost (dash): a brief speed surge — invulnerable while it lasts, so ripping
// through the field reads as a thrill, not a death sentence.
export default {
  id: 'dash',
  icon: '🚀',
  color: 0xff7a3a,
  label: 'Boost',
  order: 40,
  invuln: true,
  speedMult: 1.5,   // how much faster the run rips while active

  dress(g, THREE, { toon, ink }) {
    // Deepen the gem's own glow so the pale toon ramp doesn't lift the orange
    // toward yellow/white (same trick as rampage/pogo, tuned for orange).
    g.userData.gem.material.emissive.setHex(0x7a2c08);

    // Trim the shared halo sprite so its soft glow doesn't wash out the
    // rocket's ink lines at gameplay distance (Pixie pass).
    const halo = g.children.find(c => c.isSprite);
    if (halo) { halo.material.opacity *= 0.6; halo.scale.multiplyScalar(0.82); }

    // Topper: a chunky toon rocket riding the gem, nose tilted forward (away
    // from the camera, into the run direction) so the silhouette reads SPEED
    // even from directly behind the player. A dark -> light value ladder
    // (body -> nose -> flame) keeps every part separating from its neighbours
    // and from the glow at gameplay distance, instead of melting into one
    // orange-yellow smear (Pixie pass).
    const rocket = new THREE.Group();
    rocket.position.set(0, 0.4, 0);
    rocket.rotation.x = -0.4;   // nose leans forward into the direction of travel

    const bodyM = toon(0xd85a1a, { emissive: 0x3a1404 });
    const noseM = toon(0xff5a2e, { emissive: 0x6a1a08 });
    const finM = toon(0xfff2d9, { emissive: 0x8a6a48 });
    const flameOutM = toon(0xff9142, { emissive: 0x7a3208, flat: true });
    const flameInM = toon(0xffe066, { emissive: 0xa87a10, flat: true });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.175, 0.28, 10), bodyM);
    body.position.y = 0.14; ink(body, 1.12);

    // Slim, tall nose (height ~2.2x its base) so it reads as a rocket tip,
    // not a stubby party hat.
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.5, 10), noseM);
    nose.position.y = 0.53; ink(nose, 1.12);

    // Two cream delta-fins, swept back off the body in their own accent
    // colour so they separate from the body regardless of biome lighting.
    [-1, 1].forEach(s => {
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.3, 4), finM);
      fin.position.set(s * 0.2, -0.02, 0.05);
      fin.scale.set(1, 1, 0.32);
      fin.rotation.z = s * 1.15;   // swept out from the body
      fin.rotation.x = 0.55;       // swept back — a motion cue, not a straight cross
      fin.rotation.y = Math.PI / 4;
      ink(fin, 1.12);
      rocket.add(fin);
    });

    // Flame tail: two nested cones (dim outer + bright inner) off the base,
    // opposite the nose, so the "this is fast" cue survives at a glance.
    // Dropped low so the exhaust pokes clear below the fin ring instead of
    // being swallowed by it (Pixie pass).
    const flameOuter = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.36, 8), flameOutM);
    flameOuter.position.y = -0.23; flameOuter.rotation.x = Math.PI;
    ink(flameOuter, 1.1);
    const flameInner = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.24, 8), flameInM);
    flameInner.position.y = -0.21; flameInner.rotation.x = Math.PI;
    ink(flameInner, 1.1);

    rocket.add(body, nose, flameOuter, flameInner);
    g.add(rocket);

    // Idle spin on the whole rocket; a faster counter-spin on just the flame
    // reads as a cheap flicker/shimmer against its faceted cone geometry.
    g.userData.spins = [
      ...(g.userData.spins || []),
      { m: rocket, a: 'y', r: 1.1 },
      { m: flameInner, a: 'y', r: -9 },
    ];
  },
};

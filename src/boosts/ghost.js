// Ghost: phase straight through hazards; a kawaii ghost topper (domed head,
// dot eyes, wavy hem) sells the spook straight through the toon gem.
const LAVENDER = 0xb488ff;
const GHOST_BODY = 0x9a6fe0;   // richer/more saturated than the base gem lavender so the hue survives the shared glow

export default {
  id: 'ghost',
  icon: '👻',
  color: LAVENDER,
  label: 'Ghost',
  order: 30,
  invuln: true,      // invulnerable for the boost's duration
  ghostBody: true,   // the character renders translucent while active

  dress(g, THREE, helpers) {
    // Deepen the gem's self-glow — full-strength emissive on this pale
    // lavender washes toward white on the brighter biomes.
    g.userData.gem.material.emissive.setHex(0x4a2a8a);

    // The shared gem glow + sparkle (makePowerup) are sized/bright enough to
    // bleach the ghost's own hue to near-white at close range (Pixie pass):
    // rein them in and pale them so they frame the ghost instead of drowning
    // it. halo is the pickup's first child; sparkle is already on userData.
    const halo = g.children[0], sparkle = g.userData.sparkle;
    halo.scale.multiplyScalar(0.6);
    halo.material.opacity *= 0.6;
    halo.material.color.setHex(0xf3ecff);
    // The stock sparkle is a hard-edged 4-point additive quad; seen through the
    // translucent ghost it reads as a stray lilac rectangle, not a twinkle
    // (Pixie pass) — drop it and let the softened radial halo carry the glow.
    sparkle.visible = false;

    // Spectral topper: a short domed head (capped short of a full sphere so
    // it tapers like a hood, not a marshmallow ball) over a wavy scalloped
    // hem — the classic Boo/Pac-Man ghost silhouette, nested just into the
    // gem's crown so it reads as a small hat, not a second gem. Translucent
    // to sell the spook; per house style translucent meshes take NO ink
    // outline.
    const spookM = helpers.toon(GHOST_BODY, { transparent: true, opacity: 0.6, emissive: 0x3a1a70 });
    spookM.depthWrite = false;
    const ghostGrp = new THREE.Group();

    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.68), spookM);
    dome.scale.set(1.15, 0.85, 0.95);   // wider than tall — a hood, not a ball
    dome.position.set(0, 0.58, -0.1);
    ghostGrp.add(dome);

    // Wavy scalloped hem: an alternating-height row of small rounded bumps,
    // dipping low enough to nest into the gem's top facets.
    [-0.24, -0.12, 0, 0.12, 0.24].forEach((x, i) => {
      const bump = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), spookM);
      bump.position.set(x, i % 2 === 0 ? 0.34 : 0.4, -0.1);
      ghostGrp.add(bump);
    });

    // Two big, close-set dark dot eyes — sized to survive the downscale to
    // gameplay distance, where a face has to read as two dark pixels or not
    // at all.
    const eyeM = helpers.toon(0x2b1f3d);
    [-0.075, 0.075].forEach(x => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), eyeM);
      eye.position.set(x, 0.62, -0.34);
      helpers.ink(eye, 1.2);
      ghostGrp.add(eye);
    });

    g.add(ghostGrp);
    // A slow extra spin on top of the pickup's base rotation reads as a
    // gentle spectral drift.
    g.userData.spins = [...(g.userData.spins || []), { m: ghostGrp, a: 'y', r: 1.1 }];
  },
};

// 2× Score: every roll grabbed while active pays double.
const GEM_AMBER = 0xffa726;   // warmer amber gem body — separates from the brighter coin gold below
const COIN_GOLD = 0xffe066;   // bright coin-face gold, a notch lighter than the gem
const DEEP_GOLD = 0x8a6a10;   // rim / mint-mark / emissive accent
const RING_GOLD = 0xffd97a;   // ring + halo tint — lerped only lightly toward white so the glow itself still reads gold, not a white landing-pad light

export default {
  id: 'x2',
  icon: '🪙',
  color: GEM_AMBER,
  label: '2× Score',
  order: 20,
  scoreMult: 2,   // roll payouts multiply by this while active

  dress(g, THREE, helpers) {
    const { toon, ink } = helpers;
    // Deepen the gem's own glow — the pale toon ramp lifts flat gold toward
    // ivory, and this amber needs to stay visibly darker than the coins.
    g.userData.gem.material.emissive.setHex(0x7a3d06);

    // The stock ring + additive glow default toward near-white; retint both
    // gold so the pickup reads as treasure light, not a generic beacon.
    const ring = g.children.find(c => c.geometry && c.geometry.type === 'TorusGeometry');
    if (ring) { ring.material.color.setHex(RING_GOLD); ring.material.emissive.setHex(RING_GOLD); }
    const halo = g.children.find(c => c.isSprite);
    if (halo) halo.material.color.setHex(RING_GOLD);

    // Topper: two stacked gold coins standing edge-up so their round faces
    // front the camera (a torus's face is Z-facing by default; the cylinder
    // disc gets rotated to match) — the doubled-coin silhouette is the whole
    // "score ×2" read. A darker inner medallion stamps each face so it reads
    // as currency rather than a plain lozenge, and a tiny white glint sells
    // the shine. Each coin spins on its own vertical axis like a classic
    // arcade coin flip; the pair is toed a few degrees apart at rest so they
    // read as two coins, not mirrored twins.
    const faceM = toon(COIN_GOLD, { emissive: DEEP_GOLD });
    const mintM = toon(DEEP_GOLD, { emissive: 0x3a2a04 });
    const rimM = toon(0xc9971f, { emissive: 0x5a3f08 });
    const glintM = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.85,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const coinPlacements = [
      { x: -0.12, y: 0.62, z: -0.22, yaw: 0.35, spin: 1.1 },
      { x: 0.13, y: 0.85, z: -0.34, yaw: -0.4, spin: -1.4 },
    ];
    coinPlacements.forEach(({ x, y, z, yaw, spin: rate }) => {
      const spin = new THREE.Group();
      spin.position.set(x, y, z);
      spin.rotation.y = yaw;

      const face = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 16), faceM);
      face.rotation.x = Math.PI / 2;   // stand the coin up, disc facing the camera
      ink(face, 1.2);

      const mint = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.075, 12), mintM);
      mint.rotation.x = Math.PI / 2; mint.position.z = 0.01;
      ink(mint, 1.15);

      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.032, 6, 16), rimM);
      ink(rim, 1.25);

      const glint = new THREE.Mesh(new THREE.CircleGeometry(0.05, 8), glintM);
      glint.position.set(-0.09, 0.1, 0.045);

      spin.add(face, mint, rim, glint);
      g.add(spin);
      g.userData.spins = [...(g.userData.spins || []), { m: spin, a: 'y', r: rate }];
    });
  },
};

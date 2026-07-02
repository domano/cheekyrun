// Magnet: while active the pickup pull jumps to a big radius floor, vacuuming
// nearby ground rolls onto your line (air ribbons are still earned by jumping).
const BODY = 0x3fd4ea;   // saturated cyan — the magnet's own material, apart from the gem's paler ring
const TIP = 0xf4faff;    // near-white silver — the classic magnet pole-tip cue

// Horseshoe proportions (Pixie pass): fat arms + a narrower gap read as a
// magnet at a glance instead of a pair of thin tubes/legs.
const R = 0.2;       // bend radius (the "hole" of the U)
const TUBE = 0.089;  // arm/pole thickness — ~0.3x the outer diameter
const POLE_H = 0.38;
const TIP_H = 0.085; // ~18% of the pole+tip arm length

export default {
  id: 'magnet',
  icon: '🧲',
  color: 0x4fd0ff,
  label: 'Magnet',
  order: 10,
  magnetFloor: 9,   // magnet radius is raised to at least this while active

  dress(g, THREE, { toon, ink }) {
    // Deepen the gem's own glow: full-strength emissive washes this cyan pale
    // on the lit toon ramp — a darker teal keeps it reading saturated CYAN.
    g.userData.gem.material.emissive.setHex(0x125a72);

    // Topper: a horseshoe magnet mounted low on the gem (the bend dips into
    // its crown) so the two read as one pickup, not a stack of two shapes.
    const topper = new THREE.Group(); topper.position.y = 0.5;
    const bodyMat = toon(BODY, { emissive: 0x0d4a5c });
    const tipMat = toon(TIP, { emissive: 0x9fc7d6 });

    // U-bend: half-torus rotated so the arc dips down and its open ends point
    // up — the classic horseshoe silhouette, camera-facing since a torus's
    // ring already lies in the XY plane. A heavier ink factor keeps it
    // popping against bright sky at gameplay distance.
    const bend = new THREE.Mesh(new THREE.TorusGeometry(R, TUBE, 8, 16, Math.PI), bodyMat);
    bend.rotation.z = Math.PI;
    ink(bend, 1.16);
    topper.add(bend);

    // Two straight poles rising from the bend's ends, each capped with a
    // flat-fronted silver tip band butted right against the pole so the
    // ink outlines meet and read as a seam line, not a blended gradient.
    [-1, 1].forEach(s => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(TUBE, TUBE, POLE_H, 8), bodyMat);
      pole.position.set(s * R, POLE_H / 2, 0);
      ink(pole, 1.16);
      topper.add(pole);

      const tip = new THREE.Mesh(new THREE.CylinderGeometry(TUBE, TUBE, TIP_H, 8), tipMat);
      tip.position.set(s * R, POLE_H + TIP_H / 2, 0);
      ink(tip, 1.16);
      topper.add(tip);
    });

    g.add(topper);
    g.userData.spins = [...(g.userData.spins || []), { m: topper, a: 'y', r: 0.8 }];
  },
};

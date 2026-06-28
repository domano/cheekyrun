// Curves & hills — the warp that makes a dead-straight course feel dynamic.
//
// The sim is lane-based and perfectly straight: obstacles march down +Z toward
// the camera at z≈0. Rather than complicate collision with real curved geometry,
// we WARP only the render — every point is pushed sideways (curves) and up/down
// (hills) by how far it sits along the course, while the lane math is untouched,
// so dodging stays exactly as fair as before.
//
// A point's position ALONG the course is invariant as it scrolls toward you:
// s = distance - z (an obstacle keeps the same s as both `distance` and its `z`
// grow together). We sample two smooth fields of s — a lateral bend and a
// vertical rise — and render every point RELATIVE to the player, who sits at
// z=0, i.e. s=distance. That subtraction pins the player to screen-centre at
// zero height, so the warp is exactly 0 at the collision point and grows with
// depth: the world bends and rolls away into the distance.

// Feel knobs. Amplitudes are world units; wavelengths are course units. Two
// layered sines per axis give long, non-repeating snaking and rolling instead
// of an obvious single wave.
export const CURVE_AMP = 7.5;   // peak lateral wander of the road
const CURVE_W1 = 96, CURVE_W2 = 41;
export const HILL_AMP = 2.4;    // peak rise/fall of the road
const HILL_W1 = 72, HILL_W2 = 31;

const bendField = (s) => CURVE_AMP * (0.72 * Math.sin(s / CURVE_W1 + 0.6) + 0.28 * Math.sin(s / CURVE_W2 + 2.3));
const riseField = (s) => HILL_AMP * (0.70 * Math.sin(s / HILL_W1) + 0.30 * Math.sin(s / HILL_W2 + 1.7));

// Render offset for a point at depth `z`, given how far the run has travelled.
// Always {0,0} at z=0, so collisions (which happen at z≈0) are never affected.
export function trackOffset(z, distance) {
  const s = distance - z;
  return { x: bendField(s) - bendField(distance), y: riseField(s) - riseField(distance) };
}

// Deform a ground/path plane in place so the road itself bends and rolls with
// the course. The plane is built in XY then rotated -90° about X, so local
// (x,y,z) maps to world (x, z, -y): local x is world X, local y is world -Z,
// local z is world Y. We read the pristine local positions from userData.base
// (captured once at build time) and rewrite the lateral (x) and height (z) of
// every vertex. Normals are recomputed so the toon bands shift over the hills.
export function deformRoad(mesh, distance) {
  const pos = mesh.geometry.attributes.position, base = mesh.userData.base, pz = mesh.position.z;
  for (let i = 0; i < pos.count; i++) {
    const lx = base[i * 3], worldZ = -base[i * 3 + 1] + pz;
    const off = trackOffset(worldZ, distance);
    pos.setX(i, lx + off.x);
    pos.setZ(i, off.y);
  }
  pos.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
}

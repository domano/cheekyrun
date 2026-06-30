import * as THREE from 'three';
import { INK } from './config.js';

// Cel-shading gradient ramp + ink material shared by every toon mesh.
let gradMap, inkMat;

export function makeGradient() {
  const data = new Uint8Array([90, 145, 200, 238]); // 4 hard bands -> cel look (top band held below pure white so lit surfaces keep their hue)
  gradMap = new THREE.DataTexture(data, data.length, 1, THREE.LuminanceFormat);
  gradMap.minFilter = gradMap.magFilter = THREE.NearestFilter;
  gradMap.generateMipmaps = false;
  gradMap.needsUpdate = true;
  inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
}

export function toon(color, opts = {}) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: gradMap, fog: true });
  if (opts.emissive !== undefined) m.emissive = new THREE.Color(opts.emissive);
  if (opts.flat) m.flatShading = true;
  if (opts.transparent) { m.transparent = true; m.opacity = opts.opacity ?? 1; }
  return m;
}

// Inverted-hull ink outline added as a child (auto-follows animation).
// `color` overrides the shared dark ink — needed when the default would vanish
// against the ground (e.g. a dark prop on a dark Ember floor wants a light edge).
const inkMats = new Map();
export function ink(mesh, factor = 1.07, color) {
  let mat = inkMat;
  if (color !== undefined) {
    mat = inkMats.get(color);
    if (!mat) { mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide }); inkMats.set(color, mat); }
  }
  const o = new THREE.Mesh(mesh.geometry, mat);
  o.scale.setScalar(factor);
  o.castShadow = false;
  o.receiveShadow = false;
  mesh.add(o);
  return mesh;
}

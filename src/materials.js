import * as THREE from 'three';
import { INK } from './config.js';

// Cel-shading gradient ramp + ink material shared by every toon mesh.
let gradMap, inkMat;

export function makeGradient() {
  const data = new Uint8Array([55, 120, 200, 255]); // 4 hard bands -> cel look
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
export function ink(mesh, factor = 1.07) {
  const o = new THREE.Mesh(mesh.geometry, inkMat);
  o.scale.setScalar(factor);
  o.castShadow = false;
  o.receiveShadow = false;
  mesh.add(o);
  return mesh;
}

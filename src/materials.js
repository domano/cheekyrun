import * as THREE from 'three';
import { INK } from './config.js';

// Cel-shading gradient ramp + ink material shared by every toon mesh.
let gradMap, inkMat;

// 4 hard bands -> the cel look. RGB (not a plain luminance ramp) so the shadow
// bands can carry a gentle COOL tint: a lit face keeps its hue while its shadow
// leans slightly cool — the hallmark of art-directed toon shading (a flat grey
// ramp reads "student toon"). Deliberately subtle and lifted so it grades every
// biome without turning the peachy hero grey-violet. The top band is held below
// pure white so lit surfaces keep their colour. MeshToonMaterial samples this
// RGB and multiplies the albedo.
const RAMP_BANDS = [
  [100, 100, 116],  // deep shadow — a gentle cool lean, lifted so the peachy hero stays warm (not blue-violet)
  [150, 152, 166],  // mid shadow — barely cool
  [205, 202, 194],  // lit — near-neutral, a hair warm
  [242, 238, 228],  // highlight — warm white, held off pure white
];

export function makeGradient() {
  const data = new Uint8Array(RAMP_BANDS.length * 4);
  RAMP_BANDS.forEach(([r, g, b], i) => data.set([r, g, b, 255], i * 4));
  gradMap = new THREE.DataTexture(data, RAMP_BANDS.length, 1, THREE.RGBAFormat);
  gradMap.minFilter = gradMap.magFilter = THREE.NearestFilter;
  gradMap.generateMipmaps = false;
  gradMap.needsUpdate = true;
  inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
}

// The darkest ramp band, so tests can assert the shadow is cool-tinted (b > r).
export function rampShadow() { return RAMP_BANDS[0].slice(); }

export function toon(color, opts = {}) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: gradMap, fog: true });
  if (opts.emissive !== undefined) m.emissive = new THREE.Color(opts.emissive);
  if (opts.flat) m.flatShading = true;
  if (opts.transparent) { m.transparent = true; m.opacity = opts.opacity ?? 1; }
  return m;
}

// A soft radial glow texture (white centre → transparent edge), generated once
// and shared by every additive glow sprite + the sun-disc halo.
let glowTex;
export function glowTexture() {
  if (glowTex) return glowTex;
  const size = 128, c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.4)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

// A soft radial contact-shadow texture (dark centre → transparent edge), shared
// by every prop's grounding decal so the shadow has a soft falloff, not a hard rim.
let shadowTex;
export function shadowTexture() {
  if (shadowTex) return shadowTex;
  const size = 64, c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}

// A soft additive glow halo for self-lit props (gems, crystals, lava, the sun).
// It's a camera-facing sprite — translucent + additive, so per house style it
// takes NO ink outline. Makes emissive props read as light sources, not just
// bright plastic, without a full-frame bloom pass (mobile- + transparency-safe).
export function glow(color, scale = 1, opacity = 0.6) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  s.scale.setScalar(scale);
  s.userData.glow = true;
  return s;
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

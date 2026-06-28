import * as THREE from 'three';
import { toon, ink } from './materials.js';

// Pure mesh factories. Each returns a positioned/unpositioned THREE.Group;
// the caller is responsible for adding it to the scene.

export function makeObstacle(kind) {
  const g = new THREE.Group();
  if (kind === 'bar') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.34, 0.34), toon(0xff5151)); bar.position.y = 1.55; bar.castShadow = true; ink(bar, 1.08);
    [-0.8, 0.8].forEach(x => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 8), toon(0xe0d3c0)); p.position.set(x, 0.8, 0); p.castShadow = true; ink(p, 1.1); g.add(p); });
    g.add(bar);
  } else if (kind === 'rock') {
    const r = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), toon(0x99a3ad, { flat: true })); r.position.y = 0.5; r.scale.set(1.3, 0.9, 1.1); r.castShadow = true; ink(r, 1.08); g.add(r);
  } else {
    const m = toon(0x44b566);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 1.5, 14), m); body.position.y = 0.75; body.castShadow = true; ink(body, 1.07);
    const aL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.6, 10), m); aL.position.set(-0.36, 0.95, 0); aL.rotation.z = 0.5; aL.castShadow = true; ink(aL, 1.12);
    const aR = aL.clone(); aR.position.x = 0.36; aR.rotation.z = -0.5;
    g.add(body, aL, aR);
  }
  g.userData.kind = kind;
  g.userData.color = kind === 'bar' ? 0xff5151 : kind === 'rock' ? 0x99a3ad : 0x44b566;
  return g;
}

// Full-width low hurdle spanning every lane — the only way past is to JUMP.
export function makeHurdle() {
  const g = new THREE.Group();
  const m = toon(0xffb13b);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.55, 0.4), m); bar.position.y = 0.5; bar.castShadow = true; ink(bar, 1.04); g.add(bar);
  const legM = toon(0xe0d3c0);
  [-3.1, 0, 3.1].forEach(x => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 8), legM); p.position.set(x, 0.25, 0); p.castShadow = true; ink(p, 1.1); g.add(p); });
  g.userData.kind = 'hurdle'; g.userData.color = 0xffb13b;
  return g;
}

// Full-width high bar spanning every lane — the only way past is to SLIDE.
export function makeGate() {
  const g = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.45, 0.4), toon(0xff5151)); bar.position.y = 1.55; bar.castShadow = true; ink(bar, 1.04); g.add(bar);
  const postM = toon(0xe0d3c0);
  [-3.2, 3.2].forEach(x => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.7, 8), postM); p.position.set(x, 0.85, 0); p.castShadow = true; ink(p, 1.08); g.add(p); });
  g.userData.kind = 'gate'; g.userData.color = 0xff5151;
  return g;
}

export function makeRoll() {
  const g = new THREE.Group();
  const paper = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.5, 22), toon(0xffffff, { emissive: 0x222222 }));
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.55, 16), toon(0xd9b48a));
  paper.rotation.x = Math.PI / 2; hole.rotation.x = Math.PI / 2; paper.castShadow = true; ink(paper, 1.07);
  g.add(paper, hole); g.position.y = 0.95;
  return g;
}

// A rare floating bonus — a glowing gem that grants a brief power-up. The colour
// is set by the caller per kind; strong emissive makes it pop against any biome.
export function makePowerup(color) {
  const g = new THREE.Group();
  const gem = new THREE.Mesh(new THREE.IcosahedronGeometry(0.46, 0), toon(color, { emissive: color, flat: true }));
  gem.castShadow = true; ink(gem, 1.1);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.06, 8, 20), toon(0xffffff, { emissive: 0xbbbbbb }));
  ring.rotation.x = Math.PI / 2; g.add(gem, ring);
  g.position.y = 1.0; g.userData.gem = gem;
  return g;
}

export function makeTree() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.1, 8), toon(0x9c6b43)); trunk.position.y = 0.55; trunk.castShadow = true; ink(trunk, 1.08);
  const leafM = toon(0x57bf64);
  [[0, 1.5, 0, 0.85], [0.4, 1.9, 0.1, 0.6], [-0.35, 1.85, -0.1, 0.55]].forEach(([x, y, z, r]) => {
    const l = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 12), leafM); l.position.set(x, y, z); l.castShadow = true; ink(l, 1.07); g.add(l);
  });
  g.add(trunk);
  return g;
}

export function makeBush() {
  const g = new THREE.Group(), m = toon(0x63c773);
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.4 + Math.random() * 0.25, 12, 12), m);
    s.position.set((Math.random() - 0.5) * 0.7, 0.35, (Math.random() - 0.5) * 0.5); s.castShadow = true; ink(s, 1.08); g.add(s);
  }
  return g;
}

export function makeFlower() {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), toon(0x4f9d57)); stem.position.y = 0.25;
  const cols = [0xff5fa6, 0xffcf3a, 0x9a7bff, 0xff8a4a];
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), toon(cols[(Math.random() * cols.length) | 0], { emissive: 0x110011 }));
  top.position.y = 0.52; top.scale.y = 0.7; ink(top, 1.12); g.add(stem, top);
  return g;
}

// Clouds are positioned on creation; caller adds the returned group to the scene.
export function makeCloud() {
  const g = new THREE.Group(), m = toon(0xffffff);
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.9 + Math.random() * 0.6, 12, 12), m);
    p.position.set(i * 0.9 - 0.9, Math.random() * 0.3, 0); g.add(p);
  }
  g.scale.y = 0.7;
  g.position.set((Math.random() - 0.5) * 30, 6 + Math.random() * 4, -Math.random() * 60);
  return g;
}

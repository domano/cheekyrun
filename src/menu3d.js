import * as THREE from 'three';
import { HUD } from './config.js';
import { toon, ink } from './materials.js';
import { makeCanvas, texturedPlane, inkText } from './textTexture.js';
import { biomeOf } from './levels.js';

// The 3D menu hero: the character posed on a little cake-stand podium under a
// chunky ink-stroked "Cheeky Run" wordmark, flanked by balloons, with drifting
// confetti — a vinyl-figure-in-its-box presentation instead of the old faded
// gameplay scene behind a dark scrim. Reuses the existing player mesh; builds
// menu-only dressing into one group that toggles with the state.

let rig, title, balloons = [], podium, ringMat, topMat, baseMat;
let particles, player;
let entT = 0, conf = 0;
const TITLE_S = 0.0036;   // max world-scale of the 1040px wordmark canvas
const TITLE_Y = 2.45;     // sits low enough that the mascot crown clears the top edge
const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Menu camera framing (vs the behind-the-runner gameplay camera).
export const MENU_CAM = { pos: new THREE.Vector3(0, 2.35, 8.6), look: new THREE.Vector3(0, 0.08, 0), fov: 40 };

export function initMenu(opts) {
  player = opts.player; particles = opts.particles;
  rig = new THREE.Group();

  // Two-tier cake-stand dais directly under the hero.
  podium = new THREE.Group();
  topMat = toon(0xfff2b0); baseMat = toon(0xc29a63);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.55, 0.32, 32), topMat);
  top.position.y = -0.04; top.receiveShadow = true; ink(top, 1.04); podium.add(top);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.85, 0.22, 32), baseMat);
  base.position.y = -0.34; ink(base, 1.04); podium.add(base);
  ringMat = new THREE.MeshBasicMaterial({ color: 0xff5f93 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.05, 8, 44), ringMat);
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.1; podium.add(rim);
  podium.position.y = 0.0; rig.add(podium);

  // Flanking balloons — pure charm, ~no cost. Pink + butter sit in the candy palette.
  [[-2.05, 0xff5f93], [2.05, 0xffe08a]].forEach(([x, c], i) => {
    const b = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 18), toon(c));
    ball.scale.set(1, 1.18, 1); ball.castShadow = true; ink(ball, 1.05); b.add(ball);
    const shine = new THREE.Mesh(new THREE.CircleGeometry(0.07, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 }));
    shine.position.set(-0.11, 0.12, 0.3); b.add(shine);
    const knot = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.1, 8), toon(c)); knot.position.y = -0.42; b.add(knot);
    const str = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.0, 5), new THREE.MeshBasicMaterial({ color: HUD.ink }));
    str.position.y = -0.95; b.add(str);
    b.position.set(x, 2.05, -0.3); b.userData.phase = i * 1.6; b.userData.x = x; rig.add(b); balloons.push(b);
  });

  // Canvas-texture wordmark: the peach+ears mascot crowning a peachy-fill,
  // thick-ink-stroke "Cheeky Run" with a hard baked shadow. Generous canvas
  // padding so the stroke + shadow never clip the outer letters.
  const tex = makeCanvas(1040, 430);
  const c = tex.ctx;
  c.font = '92px "Segoe UI Emoji","Noto Color Emoji",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('🍑👂', 520, 96);
  inkText(c, 'Cheeky Run', 520, 296, {
    font: '900 134px "Trebuchet MS","Segoe UI",system-ui,sans-serif',
    fill: HUD.pink, stroke: HUD.ink, strokeW: 13, shadow: [9, 12], shadowColor: HUD.ink,
  });
  // a little sparkle tucked just above the wordmark (kept clear of the far edge
  // so it never collides with the top-right mute button)
  inkText(c, '✦', 868, 196, { font: '900 52px sans-serif', fill: '#fff', stroke: HUD.ink, strokeW: 4 });
  tex.flush();
  title = texturedPlane(tex);
  title.scale.setScalar(TITLE_S); title.material.depthTest = true;
  title.position.set(0, TITLE_Y, -0.2); title.rotation.x = -0.06;
  rig.add(title);

  rig.visible = false;
  opts.scene.add(rig);
  setMenuBiome(biomeOf(1));
}

// Tint the podium to a biome's palette so the stand sits in the diorama.
export function setMenuBiome(b) {
  if (!topMat) return;
  topMat.color.setHex(b.disc); baseMat.color.setHex(b.path);
}

export function enterMenu() { if (!rig) return; rig.visible = true; entT = 0; }
export function exitMenu() { if (rig) rig.visible = false; }
export function menuVisible() { return !!(rig && rig.visible); }

// Drive the hero diorama: title entrance overshoot, lazy bobs, slow turntable,
// balloon float, and a trickle of confetti. Player idle is driven by main's
// updatePlayer; here we only add the podium-relative presentation.
const easeOutBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const TITLE_W = 1040;   // wordmark canvas width in px (plane is this many world units pre-scale)
export function updateMenu(dt, t, camera) {
  if (!rig || !rig.visible) return;
  entT += dt;

  // Hero + podium turn together as a unit (hold a 3/4 pose under reduced-motion).
  const turn = reduce ? -0.35 : -0.35 + t * 0.35;
  player.rotation.y = turn; podium.rotation.y = turn;

  // Fit-to-viewport: on a narrow portrait the horizontal view shrinks, so cap
  // the title scale (and pull the balloons inward) to whatever actually fits.
  // We also reserve a margin for the top-right mute button so the wordmark
  // never runs under it — the wordmark stays clear at any aspect.
  const dist = (camera ? camera.position.z : 8.6) + 0.2;
  const visW = 2 * dist * Math.tan((camera ? camera.fov : 40) * Math.PI / 360) * (camera ? camera.aspect : 2);
  const reserve = (76 * visW / innerWidth);   // ~mute-button safe zone, mirrored both sides to stay centred
  const fitS = Math.min(TITLE_S, Math.max(1, visW - 2 * reserve) / TITLE_W);

  // Title: scale-in overshoot ~120ms after entry, then a lazy bob/tilt.
  if (reduce) { title.scale.setScalar(fitS); title.position.y = TITLE_Y; }
  else {
    const k = Math.min(1, Math.max(0, (entT - 0.12) / 0.42));     // 0→1 over 420ms
    title.scale.setScalar(fitS * (0.6 + easeOutBack(k) * 0.4));   // 0.6→~1.0 w/ overshoot
    title.position.y = TITLE_Y + Math.sin(t * 1.1) * 0.05;
    title.rotation.z = Math.sin(t * 0.7) * 0.02;
  }

  const bx = Math.min(2.05, visW * 0.37);   // keep balloons (and their strings) just inside the frame edges
  balloons.forEach(b => {
    b.position.x = Math.sign(b.userData.x) * bx;
    b.position.y = reduce ? 2.05 : 2.05 + Math.sin(t * 0.9 + b.userData.phase) * 0.12;
    if (!reduce) b.rotation.z = Math.sin(t * 0.8 + b.userData.phase) * 0.08;
  });

  // Confetti: peachy/candy flecks drifting down, clustered around the wordmark.
  if (!reduce && particles) {
    conf -= dt;
    if (conf <= 0) {
      conf = 0.09;
      const cols = [0xff5f93, 0xffe08a, 0xffd23f, 0xffbfa8, 0x9be7c4];
      const x = (Math.random() - 0.5) * 4.6;
      particles.emit(new THREE.Vector3(x, 4.4, -1.2), { count: 2, color: cols[(Math.random() * cols.length) | 0], speed: 0.5, up: 0, life: 2.6, grav: 0.9, size: 0.18 });
    }
  }
}

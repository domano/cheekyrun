import * as THREE from 'three';
import { HUD, POWERUPS } from './config.js';
import { makeCanvas, texturedPlane, inkPlate, inkText, roundRect } from './textTexture.js';

// The diegetic, in-run HUD: an orthographic overlay scene of "ink-stamp" plates
// (the same cream/ink/hard-shadow language as the menu cards) rendered on top of
// the 3D game. Pixel-mapped — 1 world unit = 1 CSS px, top of screen = high y —
// so plate anchors are computed straight from the live viewport on resize.
//
// The DOM HUD (#score/#level/#rolls) stays the source of truth the tests read;
// these plates are the *visual*. main.js calls the setters where it already
// updates the DOM, then renders this scene after the main pass.

const LABEL = 'rgba(36,16,25,0.5)';
const SHADOW = HUD.shadow;
let scene, cam, W = 1, H = 1, ins = { t: 0, r: 0, l: 0 };
let active = false;
const plates = [];

// A single HUD plate: a canvas-textured plane that redraws on value change and
// eases a "squash" pop (scale 1→1.18→1) so any number that changes feels alive.
function Plate({ pw, ph, anchor, ox, oy, draw }) {
  const tex = makeCanvas(pw + SHADOW[0], ph + SHADOW[1]);
  const mesh = texturedPlane(tex);
  const p = {
    tex, mesh, pw, ph, anchor, ox, oy, draw,
    state: {}, scale: 1, vel: 0, shown: true, fade: 1,
    redraw(s) {
      const c = tex.ctx; c.clearRect(0, 0, tex.w, tex.h);
      draw(c, inkPlate(c, 0, 0, pw, ph, {}), s, p); tex.flush();
    },
    set(s, pop) {
      const key = JSON.stringify(s);
      if (key !== p._key) { p._key = key; p.state = s; p.redraw(s); if (pop) p.pop(); }
    },
    pop() { p.scale = 1.18; p.vel = 0; },
    place() {
      // Read the mutable p.ox/p.oy (layoutHud updates these for insets + the
      // narrow/portrait reflow) — not the constructor's closure values.
      const cx = anchor === 'tl' ? p.ox + pw / 2 : anchor === 'tr' ? W - p.ox - pw / 2 : W / 2 + p.ox;
      const cy = H - p.oy - ph / 2;
      mesh.position.set(cx + SHADOW[0] / 2, cy - SHADOW[1] / 2, 0);
    },
  };
  scene.add(mesh); plates.push(p); return p;
}

let score, level, rolls, shields, combo, power;

export function initHud() {
  scene = new THREE.Scene();
  cam = new THREE.OrthographicCamera(0, W, H, 0, -10, 10);
  cam.position.z = 5;

  score = Plate({ pw: 150, ph: 48, anchor: 'tl', ox: 16, oy: 16, draw: (c, box, s) => {
    inkText(c, 'SCORE', box.x + 4, box.y + box.h / 2, { font: '900 11px ' + FONT, fill: LABEL, align: 'left', baseline: 'middle' });
    inkText(c, String(s.v ?? 0), box.x + box.w - 4, box.y + box.h / 2 + 1, { font: '900 28px ' + FONT, fill: HUD.pink, strokeW: 4.5, align: 'right', baseline: 'middle' });
  } });

  level = Plate({ pw: 100, ph: 52, anchor: 'tc', ox: 0, oy: 16, draw: (c, box, s) => {
    // "LVL n" on the top line, a full-width progress track pinned underneath.
    inkText(c, 'LVL', box.x + 4, box.y + 14, { font: '900 11px ' + FONT, fill: LABEL, align: 'left', baseline: 'middle' });
    inkText(c, String(s.lvl ?? 1), box.x + box.w - 4, box.y + 15, { font: '900 22px ' + FONT, fill: HUD.plum, strokeW: 4, stroke: HUD.ink, align: 'right', baseline: 'middle' });
    const bx = box.x, by = box.y + box.h - 9, bw = box.w, bh = 7;
    c.fillStyle = '#fff'; roundRect(c, bx, by, bw, bh, 3.5); c.fill();
    if (s.prog > 0) { c.fillStyle = HUD.pink; roundRect(c, bx, by, Math.max(bh, bw * s.prog), bh, 3.5); c.fill(); }
    c.lineWidth = 2.5; c.strokeStyle = HUD.ink; roundRect(c, bx + 1.25, by + 1.25, bw - 2.5, bh - 2.5, 3); c.stroke();
  } });

  rolls = Plate({ pw: 84, ph: 50, anchor: 'tr', ox: 16, oy: 16, draw: (c, box, s) => {
    c.font = '22px ' + FONT; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillStyle = '#000'; c.fillText('🧻', box.x + 2, box.y + box.h / 2);
    inkText(c, String(s.v ?? 0), box.x + box.w - 6, box.y + box.h / 2 + 1, { font: '900 24px ' + FONT, fill: HUD.plum, strokeW: 4, align: 'right', baseline: 'middle' });
  } });

  shields = Plate({ pw: 64, ph: 50, anchor: 'tr', ox: 108, oy: 16, draw: (c, box, s) => {
    c.font = '20px ' + FONT; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillStyle = '#000'; c.fillText('🛡️', box.x, box.y + box.h / 2);
    inkText(c, String(s.v ?? 0), box.x + box.w - 6, box.y + box.h / 2 + 1, { font: '900 24px ' + FONT, fill: '#2f6ad0', strokeW: 4, stroke: HUD.ink, align: 'right', baseline: 'middle' });
  } });

  combo = Plate({ pw: 160, ph: 42, anchor: 'tc', ox: 0, oy: 76, draw: (c, box, s) => {
    c.font = '22px ' + FONT; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillStyle = '#000'; c.fillText('🔥', box.x + 2, box.y + box.h / 2);
    inkText(c, 'x' + (s.mult ?? 1), box.x + 36, box.y + box.h / 2 + 1, { font: '900 22px ' + FONT, fill: HUD.pink, strokeW: 4, align: 'left', baseline: 'middle' });
    inkText(c, (s.combo ?? 0) + ' COMBO', box.x + box.w - 4, box.y + box.h / 2 + 1, { font: '900 11px ' + FONT, fill: '#7a5140', align: 'right', baseline: 'middle' });
  } });

  power = Plate({ pw: 116, ph: 38, anchor: 'tc', ox: 0, oy: 124, draw: (c, box, s) => {
    c.font = '20px ' + FONT; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillStyle = '#000'; c.fillText(s.icon || '✨', box.x + 2, box.y + box.h / 2);
    const bx = box.x + 32, bw = box.w - 32, by = box.y + box.h / 2 - 6, bh = 11;
    c.fillStyle = '#fff'; roundRect(c, bx, by, bw, bh, 5); c.fill();
    const col = s.frac < 0.25 && s.blink ? 'rgba(255,95,147,0.35)' : (s.color || HUD.pink);
    if (s.frac > 0) { c.fillStyle = col; roundRect(c, bx, by, Math.max(bh, bw * s.frac), bh, 5); c.fill(); }
    c.lineWidth = 2.5; c.strokeStyle = HUD.ink; roundRect(c, bx + 1.25, by + 1.25, bw - 2.5, bh - 2.5, 4); c.stroke();
  } });

  combo.shown = false; power.shown = false; shields.shown = false;
  layoutHud(innerWidth, innerHeight);
}

const FONT = '"Trebuchet MS","Segoe UI",system-ui,sans-serif';

// Reposition every plate from the live viewport + safe-area insets.
export function layoutHud(w, h, insets) {
  W = Math.max(1, w); H = Math.max(1, h);
  if (insets) ins = insets;
  if (!cam) return;
  cam.left = 0; cam.right = W; cam.top = H; cam.bottom = 0; cam.updateProjectionMatrix();
  // Narrow (portrait) screens can't fit Score | Lvl | Vitals on one top row, so
  // the centre column (Lvl/Combo/Power) drops below the corner plates there.
  const narrow = W < 540;
  score.oy = rolls.oy = shields.oy = 16 + ins.t;
  score.ox = 16 + ins.l; rolls.ox = 16 + ins.r; shields.ox = 108 + ins.r;
  level.oy = (narrow ? 96 : 16) + ins.t;
  combo.oy = (narrow ? 148 : 76) + ins.t;
  power.oy = (narrow ? 196 : 124) + ins.t;
  plates.forEach(p => p.place());
}

export function setActive(on) { active = on; }
export function hudActive() { return active; }
export function hudLayout() { return { W, H, narrow: W < 540, levelOy: level && level.oy, comboOy: combo && combo.oy }; }

export function setScore(v) { score.set({ v }, true); }
export function setLevel(lvl, prog) { level.set({ lvl, prog: +prog.toFixed(3) }); }
export function setRolls(v, pop) { rolls.set({ v }, pop); }
export function setShields(v) {
  if (v > 0) { shields.shown = true; shields.set({ v }, true); }
  else shields.shown = false;
}
let lastCombo = 0;
export function setCombo(c, mult, show) {
  if (show && c >= 2) {
    const inc = c > lastCombo;
    combo.shown = true; combo.set({ combo: c, mult }, inc);
  } else combo.shown = false;
  lastCombo = c;
}
export function setPower(kind, frac) {
  if (kind) { power.shown = true; const pu = POWERUPS[kind]; power.set({ icon: pu.icon, frac: +frac.toFixed(3), color: '#' + pu.color.toString(16).padStart(6, '0'), blink: blinkOn }); }
  else power.shown = false;
}

let blinkOn = true, blinkT = 0;
// Ease squashes back to 1, drive the low-power blink, and draw the overlay.
export function renderHud(renderer, dt) {
  if (!active) return;
  blinkT += dt; if (blinkT > 0.125) { blinkT = 0; blinkOn = !blinkOn; if (power.shown && power.state.frac < 0.25) power.redraw(power.state); }
  for (const p of plates) {
    p.mesh.visible = active && p.shown;
    if (!p.mesh.visible) continue;
    // critically-damped-ish ease of the pop scale back to 1
    p.vel += (1 - p.scale) * dt * 60; p.vel *= 0.6; p.scale += p.vel * dt * 4;
    if (Math.abs(p.scale - 1) < 0.002 && Math.abs(p.vel) < 0.002) { p.scale = 1; p.vel = 0; }
    p.mesh.scale.set(p.scale, p.scale, 1);
  }
  const prevAuto = renderer.autoClear; renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(scene, cam);
  renderer.autoClear = prevAuto;
}

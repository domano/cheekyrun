import * as THREE from 'three';
import { HUD } from './config.js';

// Crisp text/UI in WebGL via high-DPI <canvas> textures mapped on planes — the
// one technique used for both the menu wordmark and every HUD plate. TextGeometry
// is avoided: a canvas reproduces the exact toon look (peachy fill + thick ink
// stroke + hard offset shadow) and stays sharp on any display.

// Cap the backing-store scale so huge textures don't blow memory on retina.
export const DPR = Math.min(typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1, 3);

// A logical-pixel canvas + 2D context pre-scaled by DPR, plus a linked texture.
// Draw in logical units; the backing store is sharp. Call `texture.needsUpdate`
// after redrawing (helpers below do it for you via the returned `flush`).
export function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * DPR); canvas.height = Math.ceil(h * DPR);
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.encoding = THREE.sRGBEncoding;   // matches renderer.outputEncoding (three 0.128)
  return { canvas, ctx, texture, w, h, flush: () => { texture.needsUpdate = true; } };
}

// Rounded-rect path (no fill/stroke — caller decides).
export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// The unified "ink stamp": hard offset shadow + cream fill + thick ink border.
// This is the menu card / HUD pill language, drawn into a canvas. Returns the
// inner content box (inset by the border) so callers can lay text out inside.
export function inkPlate(ctx, x, y, w, h, opts = {}) {
  const {
    fill = HUD.cream, border = HUD.ink, borderW = HUD.borderW,
    radius = HUD.radius, shadow = HUD.shadow, shadowColor = HUD.ink,
  } = opts;
  if (shadow && (shadow[0] || shadow[1])) {
    ctx.fillStyle = shadowColor;
    roundRect(ctx, x + shadow[0], y + shadow[1], w, h, radius); ctx.fill();
  }
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, w, h, radius); ctx.fill();
  if (borderW > 0) {
    ctx.lineJoin = 'round'; ctx.lineWidth = borderW; ctx.strokeStyle = border;
    roundRect(ctx, x + borderW / 2, y + borderW / 2, w - borderW, h - borderW, radius - borderW / 2); ctx.stroke();
  }
  const p = borderW + 2;
  return { x: x + p, y: y + p, w: w - p * 2, h: h - p * 2 };
}

// Stroked + filled text (ink outline behind a colour fill) — the toon wordmark
// look. Centred on (cx, cy) by default. Set `align`/`baseline` to override.
export function inkText(ctx, text, cx, cy, opts = {}) {
  const {
    font, fill = HUD.pink, stroke = HUD.ink, strokeW = 0,
    align = 'center', baseline = 'middle', shadow = null, shadowColor = HUD.ink,
  } = opts;
  ctx.font = font; ctx.textAlign = align; ctx.textBaseline = baseline;
  ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  if (shadow && (shadow[0] || shadow[1])) {
    ctx.fillStyle = shadowColor;
    if (strokeW > 0) { ctx.lineWidth = strokeW; ctx.strokeStyle = shadowColor; ctx.strokeText(text, cx + shadow[0], cy + shadow[1]); }
    ctx.fillText(text, cx + shadow[0], cy + shadow[1]);
  }
  if (strokeW > 0) { ctx.lineWidth = strokeW; ctx.strokeStyle = stroke; ctx.strokeText(text, cx, cy); }
  ctx.fillStyle = fill; ctx.fillText(text, cx, cy);
}

// A textured plane (MeshBasicMaterial, transparent, unlit) the size of the
// canvas in world/px units, with its texture exposed for live redraws.
export function texturedPlane(tex) {
  const mat = new THREE.MeshBasicMaterial({ map: tex.texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(tex.w, tex.h), mat);
  mesh.userData.tex = tex;
  return mesh;
}

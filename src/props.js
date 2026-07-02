import * as THREE from 'three';
import { toon, ink, glow, shadowTexture } from './materials.js';
import { TALL_CLEAR_H, TALL_SCALE } from './config.js';

// Pure mesh factories. Each returns a positioned/unpositioned THREE.Group;
// the caller is responsible for adding it to the scene.

// A soft contact shadow decal: a flat dark disc with a soft radial falloff that
// grounds a prop crisply where the PCF map goes muddy at distance. Unlit +
// translucent (no ink), laid flat on the road at the group's base. `y` lets a
// floating prop (a roll) drop its shadow to the ground. `userData.contact` tags
// it for tests.
function contactShadow(r = 0.62, opacity = 0.2, y = 0.02) {
  const s = new THREE.Mesh(
    new THREE.PlaneGeometry(r * 2, r * 2),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), color: 0x2a2338, transparent: true, opacity, depthWrite: false }),
  );
  s.rotation.x = -Math.PI / 2; s.position.y = y;
  s.renderOrder = -1; s.userData.contact = true;
  return s;
}

// ---- per-biome obstacle roster ----
// Every lane obstacle is one of these kinds. `action` decides how you clear it:
// 'jump' obstacles are grounded (jump over), 'duck' obstacles are a raised bar
// (slide under). Each biome (see levels.js) draws from its own subset so stages
// look distinct, not just recoloured. `build()` returns the inner meshes.

// A raised cross-bar on two posts — the shared shape behind every 'duck' kind.
function duckBar(barM, postM, barGeo = [1.7, 0.3, 0.3]) {
  const g = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.BoxGeometry(...barGeo), barM); bar.position.y = 1.55; bar.castShadow = true; ink(bar, 1.08);
  [-0.8, 0.8].forEach(x => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 8), postM); p.position.set(x, 0.8, 0); p.castShadow = true; ink(p, 1.1); g.add(p); });
  g.add(bar); return g;
}

// Each jump kind also carries a bespoke `tall` build — a DISTINCT double-height
// model (top ~2.3–2.7, above the single-hop apex), not a stretched base. Same
// footprint as the base kind so lane collision (halfW 0.95) is unchanged; the
// loop's clearH stamp is what actually gates the jump.
const OBSTACLES = {
  // Meadow — green & woodsy.
  cactus: { action: 'jump', color: 0x44b566, build: () => {
    const g = new THREE.Group(), m = toon(0x44b566);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 1.5, 14), m); body.position.y = 0.75; body.castShadow = true; ink(body, 1.07);
    const aL = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.6, 10), m); aL.position.set(-0.36, 0.95, 0); aL.rotation.z = 0.5; aL.castShadow = true; ink(aL, 1.12);
    const aR = aL.clone(); aR.position.x = 0.36; aR.rotation.z = -0.5;
    g.add(body, aL, aR); return g;
  }, tall: () => {
    // Saguaro tower: one tall trunk, two chunky elbowed arms reaching up, a pink
    // desert bloom (petal ring, not an anonymous blip) crowning it.
    const g = new THREE.Group(), m = toon(0x44b566);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.45, 2.5, 14), m); body.position.y = 1.25; body.castShadow = true; ink(body, 1.06); g.add(body);
    [-1, 1].forEach(s => {
      const y0 = s > 0 ? 1.5 : 1.15;
      const out = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.5, 10), m); out.position.set(s * 0.48, y0, 0); out.rotation.z = Math.PI / 2; out.castShadow = true; ink(out, 1.12); g.add(out);
      const up = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.8, 10), m); up.position.set(s * 0.68, y0 + 0.38, 0); up.castShadow = true; ink(up, 1.1); g.add(up);
    });
    const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), toon(0xff7fb0, { emissive: 0x2a141e })); bloom.position.y = 2.55; bloom.scale.set(2, 1.27, 2); ink(bloom, 1.12); g.add(bloom);   // authored hot — fog eats ~30% saturation
    const petalM = toon(0xffd7e8);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), petalM);
      p.position.set(Math.cos(a) * 0.2, 2.56, Math.sin(a) * 0.2); g.add(p);
    }
    return g;
  } },
  rock: { action: 'jump', color: 0x99a3ad, build: () => {
    const g = new THREE.Group();
    const r = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), toon(0x99a3ad, { flat: true })); r.position.y = 0.5; r.scale.set(1.3, 0.9, 1.1); r.castShadow = true; ink(r, 1.08); g.add(r); return g;
  }, tall: () => {
    // Cairn: stacked stones, big to small, warm-tinted in alternating bands so
    // the stack reads at distance, crowned by a tilted round pebble + tiny nose.
    const g = new THREE.Group(), mA = toon(0xc9bfb4, { flat: true }), mB = toon(0xded5cc, { flat: true });
    [[0.62, 0.5, 1.3, 0.85, 0], [0.5, 1.25, 1.15, 0.8, 0.7], [0.4, 1.85, 1.05, 0.8, 1.6]].forEach(([r, y, sx, sy, ry], i) => {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), i % 2 ? mB : mA); s.position.y = y; s.scale.set(sx, sy, 1.05); s.rotation.y = ry; s.castShadow = true; ink(s, 1.07); g.add(s);
    });
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), mB); crown.position.y = 2.3; crown.rotation.z = 0.21; crown.castShadow = true; ink(crown, 1.08); g.add(crown);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), toon(0xf5ede4, { flat: true })); nose.position.y = 2.62; ink(nose, 1.14); g.add(nose);
    return g;
  } },
  branch: { action: 'duck', color: 0x8a5a33, build: () => {
    const g = duckBar(toon(0x8a5a33), toon(0x9c6b43));
    const leafM = toon(0x57bf64);
    [-0.5, 0.1, 0.6].forEach(x => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10), leafM); l.position.set(x, 1.75, 0); l.castShadow = true; ink(l, 1.08); g.add(l); });
    return g;
  } },

  // Sunset — warm desert.
  barrel: { action: 'jump', color: 0xc8743a, build: () => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 16), toon(0xc8743a)); body.position.y = 0.6; body.castShadow = true; ink(body, 1.06);
    const bandM = toon(0x6a4a2a);
    [0.25, 0.95].forEach(y => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 0.12, 16), bandM); b.position.y = y; g.add(b); });
    g.add(body); return g;
  }, tall: () => {
    // Barrel stack: a second, slimmer keg casually perched off-centre on the
    // first; proud torus hoops are what make each cylinder read "keg".
    const g = new THREE.Group(), bandM = toon(0x8a5a33);
    const lo = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 1.2, 16), toon(0xc8743a)); lo.position.y = 0.6; lo.castShadow = true; ink(lo, 1.06); g.add(lo);
    const hi = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 1.05, 16), toon(0xd8854a)); hi.position.set(0.12, 1.72, 0); hi.rotation.y = 0.35; hi.castShadow = true; ink(hi, 1.07); g.add(hi);
    [[0.52, 0.3, 0], [0.52, 0.9, 0], [0.44, 1.46, 0.12], [0.44, 1.98, 0.12]].forEach(([r, y, x]) => {
      const b = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 6, 18), bandM); b.position.set(x, y, 0); b.rotation.x = Math.PI / 2; g.add(b);
    });
    return g;
  } },
  boulder: { action: 'jump', color: 0xb89a6a, build: () => {
    const g = new THREE.Group();
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 0), toon(0xb89a6a, { flat: true })); r.position.y = 0.6; r.scale.set(1.2, 1.0, 1.0); r.castShadow = true; ink(r, 1.06); g.add(r); return g;
  }, tall: () => {
    // Hoodoo: a CHUNKY wind-carved column (near-pole tapers read as a lamppost)
    // under a rounded overhanging boulder cap, with one stratum groove.
    const g = new THREE.Group();
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 1.8, 9), toon(0xe8b98f, { flat: true })); col.position.y = 0.9; col.castShadow = true; ink(col, 1.06); g.add(col);
    const groove = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.03, 6, 14), toon(0xd99f72)); groove.position.y = 1.0; groove.rotation.x = Math.PI / 2; g.add(groove);
    const cap = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), toon(0xd99f72, { flat: true })); cap.position.y = 2.1; cap.scale.set(1.0, 0.65, 1.0); cap.castShadow = true; ink(cap, 1.06); g.add(cap);
    return g;
  } },
  bar: { action: 'duck', color: 0xff5151, build: () => duckBar(toon(0xff5151), toon(0xe0d3c0), [1.7, 0.34, 0.34]) },

  // Twilight — spooky night.
  crystal: { action: 'jump', color: 0x9a7bff, build: () => {
    const g = new THREE.Group(), m = toon(0x9a7bff, { emissive: 0x2a1a55, flat: true });
    const main = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.5, 5), m); main.position.y = 0.75; main.castShadow = true; ink(main, 1.07); g.add(main);
    [[-0.42, 0.5, 0.45], [0.42, 0.42, -0.4]].forEach(([x, h, z]) => { const c = new THREE.Mesh(new THREE.ConeGeometry(0.18, h * 2, 5), m); c.position.set(x, h, z); c.castShadow = true; ink(c, 1.1); g.add(c); });
    const halo = glow(0xb59bff, 1.9, 0.5); halo.position.set(0, 0.85, 0); g.add(halo);   // self-lit violet bloom
    return g;
  }, tall: () => {
    // Grand spire: one towering shard flanked by two leaning splinters. The main
    // spire burns brighter than the splinters so the beacon has hierarchy.
    const g = new THREE.Group(), m = toon(0x9a7bff, { emissive: 0x2a1a55, flat: true });
    const main = new THREE.Mesh(new THREE.ConeGeometry(0.44, 2.6, 5), toon(0x9a7bff, { emissive: 0x352070, flat: true })); main.position.y = 1.3; main.castShadow = true; ink(main, 1.06); g.add(main);
    [[-0.44, 0.75, 0.16], [0.46, 0.6, -0.18]].forEach(([x, h, rz]) => {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.2, h * 2, 5), m); c.position.set(x, h, 0); c.rotation.z = rz; c.castShadow = true; ink(c, 1.1); g.add(c);
    });
    const halo = glow(0xb59bff, 2.2, 0.5); halo.position.set(0, 2.2, 0); g.add(halo);   // beacon glow rides near the tip
    return g;
  } },
  tombstone: { action: 'jump', color: 0x8a93a6, build: () => {
    const g = new THREE.Group(), m = toon(0x8a93a6, { flat: true });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.25), m); slab.position.y = 0.75; slab.castShadow = true; ink(slab, 1.05);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), m); top.position.y = 1.4; top.scale.z = 0.56; top.castShadow = true; ink(top, 1.06);
    g.add(slab, top); return g;
  }, tall: () => {
    // Leaning obelisk: stepped plinth, tapering pillar with a recessed epitaph
    // plate, domed cap draped in moss — tilted 7° because an old grave leans.
    const g = new THREE.Group(), m = toon(0x8a93a6, { flat: true });
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.3, 0.7), m); plinth.position.y = 0.15; plinth.castShadow = true; ink(plinth, 1.05); g.add(plinth);
    const lean = new THREE.Group(); lean.position.y = 0.3; lean.rotation.z = 0.12; g.add(lean);   // everything above the plinth leans together
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.25, 0.55), m); step.position.y = 0.12; step.castShadow = true; ink(step, 1.06); lean.add(step);
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.56, 1.75, 0.4), m); col.position.y = 1.1; col.castShadow = true; ink(col, 1.05); lean.add(col);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.04), toon(0x767e90, { flat: true })); plate.position.set(0, 1.35, 0.21); lean.add(plate);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), m); cap.position.y = 1.97; cap.scale.z = 0.7; cap.castShadow = true; ink(cap, 1.08); lean.add(cap);
    const moss = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), toon(0x7fbf6b)); moss.position.set(-0.2, 2.15, 0.1); moss.scale.y = 0.4; moss.rotation.z = 0.7; ink(moss, 1.1); lean.add(moss);
    return g;
  } },
  beam: { action: 'duck', color: 0xc9a7ff, build: () => duckBar(toon(0xc9a7ff, { emissive: 0x5a3a8a }), toon(0x6a5a8a)) },

  // Candyland — bright sweets.
  candycane: { action: 'jump', color: 0xff5fa6, build: () => {
    const g = new THREE.Group(), m = toon(0xff5fa6);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.3, 12), m); pole.position.y = 0.65; pole.castShadow = true; ink(pole, 1.08);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.16, 8, 12, Math.PI), toon(0xffffff)); hook.position.set(0.28, 1.3, 0); hook.castShadow = true; ink(hook, 1.1);
    g.add(pole, hook); return g;
  }, tall: () => {
    // Giant candy cane: a lamppost-sized white pole wound with fat saturated
    // pink stripes (1:1 with the white — author it hot, the fog softens it) and
    // a thick hook. Stripes at ~0.35 spacing read as a barber-pole at distance.
    const g = new THREE.Group(), stripeM = toon(0xff5f8f);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 2.1, 12), toon(0xffffff)); pole.position.y = 1.05; pole.castShadow = true; ink(pole, 1.07); g.add(pole);
    [0.3, 1.0, 1.7].forEach(y => { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.35, 12), stripeM); s.position.y = y; g.add(s); });
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.25, 8, 14, Math.PI), stripeM); hook.position.set(0.4, 2.1, 0); hook.castShadow = true; ink(hook, 1.08); g.add(hook);
    return g;
  } },
  gumdrop: { action: 'jump', color: 0xff8ad0, build: () => {
    const g = new THREE.Group();
    const d = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.2, 18), toon(0xff8ad0, { emissive: 0x3a0022 })); d.position.y = 0.6; d.castShadow = true; ink(d, 1.06); g.add(d);
    const halo = glow(0xffb0e0, 1.5, 0.4); halo.position.set(0, 0.6, 0); g.add(halo);   // candy sheen
    return g;
  }, tall: () => {
    // Gumdrop tower: four squashed DOMES sunk into each other, big→small (cones
    // read as a Christmas tree), in over-saturated pink/mint/lilac that survive
    // the fog. The glowing sugar pearl on top is the only lit thing on it.
    const g = new THREE.Group();
    let y = 0;
    [[0.62, 0xff7fb0], [0.50, 0x63dbb0], [0.38, 0xc79bf2], [0.29, 0xff7fb0]].forEach(([r, col], i) => {
      const h = r * 0.72;
      y += i === 0 ? h : h * 0.6;
      const d = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), toon(col)); d.position.y = y; d.scale.y = 0.72; d.castShadow = true; ink(d, 1.06); g.add(d);
      y += h;
    });
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), toon(0xffffff, { emissive: 0x4c4649 })); pearl.position.y = y + 0.02; ink(pearl, 1.12); g.add(pearl);
    const sugarM = toon(0xffffff);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), sugarM);
      s.position.set(Math.cos(a) * 0.46, 0.73 + Math.sin(i * 2.1) * 0.06, Math.sin(a) * 0.46); g.add(s);
    }
    return g;
  } },
  licorice: { action: 'duck', color: 0x3a2a4a, build: () => duckBar(toon(0x3a2a4a), toon(0xffd23f)) },

  // Frostpeak — icy tundra. Pale sky + snow ground, so props lean saturated and
  // keep the dark ink edge — white-on-white would vanish.
  icespike: { action: 'jump', color: 0x7fb8e6, build: () => {
    const m = toon(0x7fb8e6, { emissive: 0x1f3a5a, flat: true }), g = new THREE.Group();
    const main = new THREE.Mesh(new THREE.ConeGeometry(0.46, 1.9, 6), m); main.position.y = 0.95; main.castShadow = true; ink(main, 1.08, 0x3a4a5a); g.add(main);
    [[-0.46, 0.55, 0.34], [0.44, 0.48, -0.36]].forEach(([x, h, z]) => { const c = new THREE.Mesh(new THREE.ConeGeometry(0.22, h * 2, 6), m); c.position.set(x, h, z); c.castShadow = true; ink(c, 1.12, 0x3a4a5a); g.add(c); });
    return g;
  }, tall: () => {
    // Glacier pillar: a faceted ice column wearing a splayed jester-crown of
    // uneven spikes (one proud) and a glowing frost waistband — the double-jump
    // beacon in an all-white biome.
    const m = toon(0x7fb8e6, { emissive: 0x1f3a5a, flat: true }), g = new THREE.Group();
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.48, 1.9, 6), m); col.position.y = 0.95; col.castShadow = true; ink(col, 1.07, 0x3a4a5a); g.add(col);
    const crownM = toon(0x9fd4ee, { emissive: 0x2a4a6a, flat: true });
    const peak = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.9, 6), crownM); peak.position.y = 2.3; peak.castShadow = true; ink(peak, 1.08, 0x3a4a5a); g.add(peak);
    [[0, 0.5, 0.26], [1, 0.4, 0.26], [2, 0.45, 0.28], [3, 0.35, 0.24]].forEach(([i, h, tilt]) => {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.11, h, 6), crownM);
      c.position.set(Math.cos(a) * 0.24, 1.95 + h / 2, Math.sin(a) * 0.24);
      c.rotation.set(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt);
      c.castShadow = true; ink(c, 1.12, 0x3a4a5a); g.add(c);
    });
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.22, 6), toon(0xdff4ff, { emissive: 0x223842 })); collar.position.y = 1.1; ink(collar, 1.08, 0x3a4a5a); g.add(collar);
    return g;
  } },
  snowman: { action: 'jump', color: 0xd6e6f2, build: () => {
    // Pale-blue body (not white) so it separates from the snow; dark coal eyes,
    // buttons and twig arms are what make it read at distance.
    const g = new THREE.Group(), m = toon(0xd6e6f2);
    const base = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 14), m); base.position.y = 0.55; base.castShadow = true; ink(base, 1.1);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 14), m); head.position.y = 1.32; head.castShadow = true; ink(head, 1.12);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.32, 8), toon(0xff8a3d)); nose.position.set(0, 1.32, 0.4); nose.rotation.x = Math.PI / 2; g.add(nose);
    const coal = toon(0x3a4a5a);
    [[-0.13, 1.4, 0.32, 0.05], [0.13, 1.4, 0.32, 0.05], [0, 0.72, 0.5, 0.06], [0, 0.46, 0.52, 0.06]].forEach(([x, y, z, r]) => { const c = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), coal); c.position.set(x, y, z); g.add(c); });
    const twig = toon(0x5a4632);
    [-1, 1].forEach(s => { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.62, 6), twig); a.position.set(s * 0.5, 0.72, 0); a.rotation.z = s * 0.9; a.castShadow = true; g.add(a); });
    g.add(base, head); return g;
  }, tall: () => {
    // Classic three-ball snowman in a top hat — a full head-and-shoulders taller.
    const g = new THREE.Group(), m = toon(0xd6e6f2);
    const base = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 14), m); base.position.y = 0.62; base.castShadow = true; ink(base, 1.08); g.add(base);
    const mid = new THREE.Mesh(new THREE.SphereGeometry(0.46, 14, 14), m); mid.position.y = 1.5; mid.castShadow = true; ink(mid, 1.1); g.add(mid);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 14, 14), m); head.position.y = 2.15; head.castShadow = true; ink(head, 1.12); g.add(head);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 8), toon(0xff8a3d)); nose.position.set(0, 2.15, 0.35); nose.rotation.x = Math.PI / 2; g.add(nose);
    const coal = toon(0x3a3a3a);
    [[-0.11, 2.23, 0.28, 0.045], [0.11, 2.23, 0.28, 0.045], [0, 1.62, 0.42, 0.05], [0, 1.38, 0.44, 0.05], [0, 0.9, 0.56, 0.05]].forEach(([x, y, z, r]) => { const c = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), coal); c.position.set(x, y, z); g.add(c); });
    const twig = toon(0x5a4632);
    [-1, 1].forEach(s => { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.66, 6), twig); a.position.set(s * 0.56, 1.62, 0); a.rotation.z = s * 0.95; a.castShadow = true; g.add(a); });
    const hatM = toon(0x2a2030);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.06, 14), hatM); brim.position.y = 2.42; ink(brim, 1.08); g.add(brim);   // slightly too-big brim, toy-like on purpose
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.34, 14), hatM); crown.position.y = 2.62; crown.castShadow = true; ink(crown, 1.08); g.add(crown);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.09, 14), toon(0xff5fa6)); band.position.y = 2.5; g.add(band);
    return g;
  } },
  frostbar: { action: 'duck', color: 0xafd4f0, build: () => {
    const g = duckBar(toon(0xafd4f0, { emissive: 0x24465e }), toon(0xcfe6f2));
    const iceM = toon(0xcfeaff);
    [-0.5, 0.1, 0.6].forEach(x => { const ic = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 7), iceM); ic.position.set(x, 1.26, 0); ic.rotation.x = Math.PI; ic.castShadow = true; ink(ic, 1.1, 0x3a4a5a); g.add(ic); });
    return g;
  } },

  // Ember — volcanic ashlands. Dark ground, so the cooled-lava boulder lightens
  // to warm basalt and takes a *light* ink edge (a dark outline would vanish);
  // glowing cracks are the icon that reads "lava" instantly.
  lavarock: { action: 'jump', color: 0x6e5a52, build: () => {
    const g = new THREE.Group();
    const r = new THREE.Mesh(new THREE.IcosahedronGeometry(0.66, 0), toon(0x6e5a52, { flat: true })); r.position.y = 0.55; r.scale.set(1.3, 0.9, 1.1); r.castShadow = true; ink(r, 1.08, 0x9a8478); g.add(r);
    const lava = toon(0xff6a2a, { emissive: 0xff5a10, flat: true });
    const crackM = toon(0xff6a2a, { emissive: 0xff6a2a, flat: true });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), lava); core.position.set(0.05, 0.78, 0.18); g.add(core);
    [[-0.22, 0.55, 0.52, 0.5], [0.27, 0.6, 0.46, -0.4]].forEach(([x, y, z, rz]) => { const c = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.11, 0.07), crackM); c.position.set(x, y, z); c.rotation.z = rz; g.add(c); });
    const halo = glow(0xff7a2e, 1.35, 0.62); halo.position.set(0.05, 0.72, 0.18); g.add(halo);   // molten core glow — reads through the dark ashland palette
    return g;
  }, tall: () => {
    // Basalt columns: three stacked HEX prisms (columnar, so it never twins the
    // Meadow cairn's round pebbles), magma glowing in the joints, molten crown.
    const g = new THREE.Group(), m = toon(0x6e5a52, { flat: true });
    [[0.5, 0.9, 0.45, 0], [0.42, 0.8, 1.3, 0.44], [0.34, 0.7, 2.05, 0.87]].forEach(([r, h, y, ry]) => {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 6), m); s.position.y = y; s.rotation.y = ry; s.castShadow = true; ink(s, 1.06, 0x9a8478); g.add(s);
    });
    const crackM = toon(0xff8a3d, { emissive: 0xff8a3d, flat: true });
    [[0.18, 0.92, 0.38, 0.35], [-0.2, 0.88, 0.34, -0.6], [0.1, 1.72, 0.3, 0.5], [-0.14, 1.68, 0.28, -0.3]].forEach(([x, y, z, rz]) => {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.045, 0.05), crackM); c.position.set(x, y, z); c.rotation.z = rz; g.add(c);
    });
    const lava = toon(0xff6a2a, { emissive: 0xff5a10, flat: true });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), lava); core.position.set(0.04, 2.44, 0.06); g.add(core);
    const halo = glow(0xff7a2e, 1.3, 0.6); halo.position.set(0.04, 2.42, 0.06); g.add(halo);   // molten crown
    return g;
  } },
  emberspire: { action: 'jump', color: 0xc23a1a, build: () => {
    const g = new THREE.Group(), m = toon(0xc23a1a, { emissive: 0x7a2008, flat: true });
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.46, 1.9, 7), m); spire.position.y = 0.95; spire.castShadow = true; ink(spire, 1.06); g.add(spire);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 7), toon(0xff8a2d, { emissive: 0xff8a2d })); tip.position.y = 1.75; ink(tip, 1.1); g.add(tip);
    const halo = glow(0xff9a3a, 1.2, 0.5); halo.position.set(0, 1.7, 0); g.add(halo);   // burning tip
    return g;
  }, tall: () => {
    // Grand vent: a towering spire broken out of "traffic cone" by a bulging
    // skirt at the base and two molten side vents at deliberately uneven
    // heights/sizes; fierce glowing tip crowns it.
    const g = new THREE.Group(), m = toon(0xe07b3a, { emissive: 0x7a2008, flat: true });
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6, 7), m); spire.position.y = 1.3; spire.castShadow = true; ink(spire, 1.05); g.add(spire);
    const skirt = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.15, 8, 14), m); skirt.position.y = 0.12; skirt.rotation.x = Math.PI / 2; skirt.castShadow = true; ink(skirt, 1.06); g.add(skirt);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 7), toon(0xffb347, { emissive: 0xffb347 })); tip.position.y = 2.5; ink(tip, 1.1); g.add(tip);
    [[-0.44, 0.9, 0.5, 0.38], [0.4, 1.4, 0.35, -0.45]].forEach(([x, y, sc, rz]) => {
      const v = new THREE.Mesh(new THREE.ConeGeometry(0.36 * sc, 1.6 * sc, 7), m); v.position.set(x, y, 0); v.rotation.z = rz; v.castShadow = true; ink(v, 1.1); g.add(v);
      const vt = new THREE.Mesh(new THREE.ConeGeometry(0.13 * sc, 0.45 * sc, 7), toon(0xffb347, { emissive: 0xffb347 })); vt.position.set(x - Math.sin(rz) * 0.8 * sc, y + Math.cos(rz) * 0.8 * sc, 0); vt.rotation.z = rz; g.add(vt);
    });
    const halo = glow(0xff9a3a, 1.5, 0.55); halo.position.set(0, 2.5, 0); g.add(halo);   // burning crown
    return g;
  } },
  emberbar: { action: 'duck', color: 0xc24a1e, build: () => {
    const g = duckBar(toon(0xc24a1e, { emissive: 0x8a3a10 }), toon(0x4a2620), [1.7, 0.34, 0.34]);
    const dripM = toon(0xff7a2a, { emissive: 0xff7a2a });
    [-0.5, 0.1, 0.6].forEach(x => { const d = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 7), dripM); d.position.set(x, 1.3, 0); d.rotation.x = Math.PI; d.castShadow = true; ink(d, 1.1); g.add(d); });
    return g;
  } },

  // Reef — sunlit coral seabed. Strong palette already; props just need bulk and
  // a deeper pink so they don't wash out on the pale sand.
  coral: { action: 'jump', color: 0xff7aa8, build: () => {
    const g = new THREE.Group(), m = toon(0xff7aa8, { emissive: 0x3a0a18 }), tipM = toon(0xffc2da);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.85, 8), m); trunk.position.y = 0.42; trunk.castShadow = true; ink(trunk, 1.07); g.add(trunk);
    [[-0.32, 1.0, 0.55], [0.34, 1.1, -0.45], [0, 1.4, 0]].forEach(([x, y, rz]) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.21, 0.8, 8), m); b.position.set(x, y, 0); b.rotation.z = rz; b.castShadow = true; ink(b, 1.1); g.add(b);
      const nub = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), tipM); nub.position.set(x - Math.sin(rz) * 0.4, y + Math.cos(rz) * 0.4, 0); ink(nub, 1.1); g.add(nub);
    });
    return g;
  }, tall: () => {
    // Lollipop coral: THREE wildly-uneven branches tipped with fat gold bulbs
    // (parallel same-length fingers + five of them read as a waving hand), plus
    // two capped stubs low on the trunk so it reads "growing organism, not limb".
    const g = new THREE.Group(), m = toon(0xff8fb8, { emissive: 0x3a0a18 }), bulbM = toon(0xffd166, { emissive: 0x403419 });   // lit gold tips — the Reef row's one warm beacon
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 1.5, 8), m); trunk.position.y = 0.75; trunk.castShadow = true; ink(trunk, 1.06); g.add(trunk);
    [[-0.16, -0.44, 1.0], [0.06, 0.09, 0.65], [0.3, 0.52, 0.45]].forEach(([x, rz, h]) => {
      const y = 1.45 + Math.cos(rz) * h / 2;
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, h, 8), m); b.position.set(x - Math.sin(rz) * h / 2, y, 0); b.rotation.z = rz; b.castShadow = true; ink(b, 1.1); g.add(b);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), bulbM); bulb.position.set(x - Math.sin(rz) * h, 1.45 + Math.cos(rz) * h, 0); bulb.castShadow = true; ink(bulb, 1.1); g.add(bulb);
    });
    [[-0.3, 0.6, 0.9], [0.32, 0.42, -0.9]].forEach(([x, y, rz]) => {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.2, 8), m); s.position.set(x, y, 0); s.rotation.z = rz; ink(s, 1.12); g.add(s);
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), bulbM); c.position.set(x * 1.35, y + 0.06, 0); ink(c, 1.12); g.add(c);
    });
    return g;
  } },
  clam: { action: 'jump', color: 0xff8fb0, build: () => {
    const g = new THREE.Group(), m = toon(0xff8fb0);
    const lower = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), m); lower.position.y = 0.6; lower.castShadow = true; ink(lower, 1.06);
    const upper = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), m); upper.position.y = 0.68; upper.rotation.x = -0.55; upper.castShadow = true; ink(upper, 1.06);
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), toon(0xfff4ff, { emissive: 0xddc8dd })); pearl.position.y = 0.6;
    g.add(lower, upper, pearl); return g;
  }, tall: () => {
    // Pearl pedestal: a WIDE-gaping pink clam on a dark barnacled column, pearl
    // nested visibly in the bottom shell — open + flat shells + a seated pearl
    // is what stops the "giant eyeball on a stick" read.
    const g = new THREE.Group(), rockM = toon(0xb9a68e, { flat: true });
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.5, 1.6, 9), rockM); col.position.y = 0.8; col.castShadow = true; ink(col, 1.06); g.add(col);
    const barnM = toon(0xe8dcc8);
    [[-0.3, 0.35], [0.32, 0.9], [0.05, 1.3]].forEach(([x, y]) => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), barnM); b.position.set(x, y, 0.3); ink(b, 1.14); g.add(b); });
    const lower = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), toon(0xf2b6cc)); lower.position.y = 1.9; lower.scale.set(1, 0.45, 0.85); lower.castShadow = true; ink(lower, 1.06); g.add(lower);
    const lip = new THREE.Mesh(new THREE.SphereGeometry(0.48, 14, 10), toon(0xffe9f2)); lip.position.y = 1.98; lip.scale.set(1, 0.32, 0.78); g.add(lip);
    const upper = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), toon(0xf7c8d8)); upper.position.set(0, 2.16, -0.14); upper.scale.set(1, 0.45, 0.85); upper.rotation.x = -0.96; upper.castShadow = true; ink(upper, 1.06); g.add(upper);
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 14), toon(0xfdfdff, { emissive: 0x55555a })); pearl.position.set(0, 2.06, 0.1); g.add(pearl);
    return g;
  } },
  kelp: { action: 'duck', color: 0x2f9f6a, build: () => {
    const g = duckBar(toon(0x2f9f6a, { emissive: 0x0a3a22 }), toon(0x3a6a4a));
    const bladeM = toon(0x3fb58a);
    [-0.6, -0.1, 0.4, 0.7].forEach((x, i) => { const k = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.62, 0.06), bladeM); k.position.set(x, 1.25, 0); k.rotation.z = (i % 2 ? 0.2 : -0.2); k.castShadow = true; ink(k, 1.1); g.add(k); });
    return g;
  } },
};

export function makeObstacle(kind, tall = false) {
  const def = OBSTACLES[kind] || OBSTACLES.cactus;
  // TALL variant: only jump obstacles grow (a taller duck bar makes no sense).
  // Each kind builds its own bespoke double-height model (stretching the base
  // read as cheap); the higher clear threshold stamped below is what the loop
  // checks — a single hop won't clear it.
  const grow = tall && def.action === 'jump';
  const g = grow && def.tall ? def.tall() : def.build();
  g.add(contactShadow(def.action === 'duck' ? 0.95 : grow ? 0.72 : 0.6));   // ground it under the soft cast shadow
  g.userData.kind = kind;
  g.userData.color = def.color;
  g.userData.duck = def.action === 'duck';   // generic flag the loop reads for collision
  if (grow) {
    if (!def.tall) g.scale.y = TALL_SCALE;   // fallback stretch for any future kind without a bespoke tall build
    g.userData.tall = true;
    g.userData.clearH = TALL_CLEAR_H;
  }
  return g;
}

// Kinds available to the debug bridge / sanity checks.
export const OBSTACLE_KINDS = Object.keys(OBSTACLES);

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
  g.userData.kind = 'gate'; g.userData.color = 0xff5151; g.userData.duck = true;
  return g;
}

// A finish line marking a stage boundary: a checkered ground strip + a banner on
// two posts, spanning the whole track. It's decoration, not a hazard — you run
// straight through it, and crossing it ends the stage (level-up + biome change).
export function makeFinishLine() {
  const g = new THREE.Group();
  const dark = toon(0x2a2030), light = toon(0xf6f1ea);
  const W = 7.2, cols = 9, cw = W / cols;
  // Ground checker: two rows of alternating squares painted flat on the road.
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < cols; i++) {
      const sq = new THREE.Mesh(new THREE.BoxGeometry(cw, 0.06, cw), (i + r) % 2 ? light : dark);
      sq.position.set(-W / 2 + cw * (i + 0.5), 0.04, -cw / 2 + r * cw);
      g.add(sq);
    }
  }
  // Two posts holding up the banner.
  const postM = toon(0xe0d3c0);
  [-W / 2 - 0.1, W / 2 + 0.1].forEach(x => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.8, 10), postM); p.position.set(x, 1.4, 0); p.castShadow = true; ink(p, 1.06); g.add(p);
  });
  // Checkered banner strung between the posts (a dark backing gives it an ink frame).
  const bw = W + 0.4;
  const back = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.62, 0.1), toon(0x2a2030)); back.position.set(0, 2.65, -0.04); ink(back, 1.04); g.add(back);
  const bcols = 12, bcw = bw / bcols;
  for (let i = 0; i < bcols; i++) {
    const sq = new THREE.Mesh(new THREE.BoxGeometry(bcw, 0.5, 0.12), i % 2 ? light : dark);
    sq.position.set(-bw / 2 + bcw * (i + 0.5), 2.65, 0); g.add(sq);
  }
  g.userData.kind = 'finish';
  return g;
}

// Pastel skin tones for the roadside fans — variations on the player's own
// peachy hue so the crowd reads as a gaggle of look-alike pals, not clones.
const CHEER_SKINS = [0xffbfa8, 0xffd0b0, 0xffb0c2, 0xf7c8a0, 0xffc6d8, 0xe9bfff];

// One pint-sized fan: a butt-with-ears like the hero, arms thrown up mid-cheer.
// userData.arms are handed back so the crowd can wave them each frame.
function makeCheerer() {
  const g = new THREE.Group();
  const skin = toon(CHEER_SKINS[(Math.random() * CHEER_SKINS.length) | 0]);
  const inner = toon(0xff7ea6), blushM = toon(0xff8fa0, { emissive: 0xff5577 });
  [-0.24, 0.24].forEach(x => {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.4, 18, 18), skin);
    cheek.position.set(x, 0.42, 0); cheek.scale.set(1, 1.06, 1.02); cheek.castShadow = true; ink(cheek, 1.07); g.add(cheek);
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.1, 14), blushM);
    blush.position.set(x * 1.1, 0.36, 0.38); g.add(blush);
  });
  [-0.22, 0.22].forEach((x, i) => {
    const ear = new THREE.Group();
    const o = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 14), skin); o.scale.set(1, 2.3, 0.7); o.castShadow = true; ink(o, 1.1);
    const n = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 12), inner); n.scale.set(1, 2.1, 0.6); n.position.z = 0.05;
    ear.add(o, n); ear.position.set(x, 0.82, -0.04); ear.rotation.z = i ? -0.22 : 0.22; g.add(ear);
  });
  // Two arms thrown up to cheer, each with a little round hand. They're stored so
  // the crowd waves them; the resting pose already reads as a celebration.
  const arms = [];
  [-1, 1].forEach(s => {
    const arm = new THREE.Group();
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.42, 8), skin); limb.position.y = 0.21; ink(limb, 1.1);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), skin); hand.position.y = 0.45; ink(hand, 1.1);
    arm.add(limb, hand); arm.position.set(s * 0.34, 0.5, 0.08); arm.rotation.z = s * 0.7;
    g.add(arm); arms.push(arm);
  });
  [-0.18, 0.18].forEach(x => {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), skin);
    f.scale.set(1, 0.55, 1.4); f.position.set(x, 0.06, 0.18); f.castShadow = true; ink(f, 1.12); g.add(f);
  });
  g.userData.arms = arms;
  return g;
}

// A roadside crowd of fans cheering the runner across a finish line. Returns a
// group of mini look-alikes lined up on both verges, beyond the banner posts.
// Every call lays them out a little differently — count, spots, scale, lean and
// their hop phase are all randomised — so no two stage-ends look the same.
export function makeCheerCrowd() {
  const g = new THREE.Group();
  const fans = [];
  [-1, 1].forEach(side => {
    const n = 2 + (Math.random() * 3 | 0);                  // 2–4 fans per verge
    for (let i = 0; i < n; i++) {
      const f = makeCheerer();
      f.position.set(side * (4.3 + Math.random() * 2.0), 0, -1.6 + Math.random() * 3.4);
      f.rotation.y = -side * (0.4 + Math.random() * 0.5);   // angle in toward the track
      const sc = 0.82 + Math.random() * 0.42;
      f.scale.setScalar(sc);
      f.userData.base = sc;
      f.userData.phase = Math.random() * Math.PI * 2;
      f.userData.hop = 0.14 + Math.random() * 0.14;
      f.userData.rate = 7 + Math.random() * 4;
      g.add(f); fans.push(f);
    }
  });
  g.userData.fans = fans;
  return g;
}

// Per-frame bounce + arm-wave for a crowd from makeCheerCrowd(). `t` is the
// running sim time; each fan hops on its own phase so the crowd looks lively.
export function tickCheerCrowd(crowd, t) {
  for (const f of crowd.userData.fans) {
    const u = f.userData, ph = t * u.rate + u.phase;
    f.position.y = Math.max(0, Math.sin(ph)) * u.hop;       // little excited hops
    const sq = 1 - Math.max(0, Math.sin(ph)) * 0.12;        // squash on the way up
    f.scale.set(u.base / Math.sqrt(sq), u.base * sq, u.base / Math.sqrt(sq));
    u.arms.forEach((arm, i) => { arm.rotation.z = (i ? -1 : 1) * (0.7 + Math.sin(ph * 1.6 + i) * 0.4); });
  }
}

export function makeRoll() {
  const g = new THREE.Group();
  const paper = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.5, 22), toon(0xffffff, { emissive: 0x222222 }));
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.55, 16), toon(0xd9b48a));
  paper.rotation.x = Math.PI / 2; hole.rotation.x = Math.PI / 2; paper.castShadow = true; ink(paper, 1.07);
  g.add(paper, hole); g.position.y = 0.95;
  g.add(contactShadow(0.34, 0.12, -0.92));   // a faint shadow on the road grounds the roll too (kept light so it never darkens a pale biome floor)
  return g;
}

// A PACK of rolls — the high-speed stand-in for a whole air ribbon: one chunky
// shrink-wrapped 2×2 bundle (worth ROLL_PACK_COUNT rolls) floating at the apex
// the arc would have peaked at. A pastel sleeve + carry handle read "multipack"
// at gameplay distance; a soft warm glow marks it as the bigger prize. `h` is
// the float height, used to drop the contact shadow onto the road below.
export function makeRollPack(h = 0) {
  const g = new THREE.Group();
  const paperM = toon(0xfff6ec, { emissive: 0x222222 }), holeM = toon(0xd9b48a);   // warm paper so it separates from biome whites
  [[-0.36, 0.36], [0.36, 0.36], [-0.36, -0.36], [0.36, -0.36]].forEach(([x, y]) => {
    const paper = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.56, 18), paperM);
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.6, 12), holeM);
    paper.rotation.x = Math.PI / 2; hole.rotation.x = Math.PI / 2;
    paper.position.set(x, y, 0); hole.position.set(x, y, 0);
    paper.castShadow = true; ink(paper, 1.085);   // heavier ink than obstacles — "interactive" in manga language
    g.add(paper, hole);
  });
  // Hot-pink sleeve covering ~45% of the pack's height — the product-band read —
  // with three printed roll dots on the face so it says "multipack" at a glance.
  const band = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.63, 0.6), toon(0xff6fa5)); band.castShadow = true; ink(band, 1.06); g.add(band);
  const dotM = toon(0xffffff);
  [-0.34, 0, 0.34].forEach(x => { const d = new THREE.Mesh(new THREE.CircleGeometry(0.09, 12), dotM); d.position.set(x, 0, 0.305); g.add(d); });
  // Fat carry handle on top, same pink — one colour story per prop.
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.083, 8, 16, Math.PI), toon(0xff6fa5)); handle.position.y = 0.72; ink(handle, 1.14); g.add(handle);
  // The "jump for me" signal: a big warm-gold aura (pulsed by the loop via
  // userData.halo) — unsubtle on purpose, it's the one-shot prize.
  const halo = glow(0xffd98a, 2.3, 0.35); halo.position.z = -0.1; g.add(halo);
  g.userData.halo = halo;
  g.position.y = 0.95 + h;
  g.add(contactShadow(0.5, 0.14, -(0.93 + h)));   // shadow lands on the road, not mid-air
  return g;
}

// A rare floating bonus — a glowing gem that grants a brief power-up. The colour
// is set by the caller per kind; strong emissive makes it pop against any biome.
export function makePowerup(color) {
  const g = new THREE.Group();
  const gem = new THREE.Mesh(new THREE.IcosahedronGeometry(0.46, 0), toon(color, { emissive: color, flat: true }));
  gem.castShadow = true; ink(gem, 1.1);
  // Ring tinted a lighter shade of the gem colour (not white) so every kind —
  // even the pale ghost lavender — reads as one solid coloured pickup.
  const ringCol = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.45);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.075, 8, 22), toon(ringCol.getHex(), { emissive: ringCol.getHex() }));
  ring.rotation.x = Math.PI / 2;
  // A soft glow at the gem's OWN full-chroma hue reads it as a self-lit treasure
  // from the back camera — the brightest, most grab-me thing on the road...
  const halo = glow(color, 2.0, 0.62); halo.position.z = -0.05;
  // ...with a tight 4-point sparkle over it for the hard toon twinkle (shrunk a
  // touch so it accents the glow rather than competing with it).
  const sparkle = new THREE.Mesh(new THREE.CircleGeometry(0.56, 4), new THREE.MeshBasicMaterial({ color: ringCol.getHex(), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  sparkle.position.z = -0.12; sparkle.rotation.z = Math.PI / 4;
  g.add(halo, sparkle, ring, gem);
  g.position.y = 1.0; g.userData.gem = gem; g.userData.sparkle = sparkle;
  return g;
}

// Build a boost's pickup: the standard gem in the boost's colour, optionally
// passed through the def's dress(group, THREE, helpers) so a boost file can
// customize/extend its own mesh (the core four don't — zero visual change).
export function makeBoostPickup(def) {
  const g = makePowerup(def.color);
  if (typeof def.dress === 'function') def.dress(g, THREE, { toon, ink, glow });
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

// ---- per-biome roadside scenery ----
// Decoration that lines the track shoulders, one roster per biome (see the
// `scenery` field in levels.js) so each stage is a distinct *place*: the leafy
// tree stays in the Meadow it belongs to, the desert gets a saguaro, the reef
// gets kelp. Quieter and shorter than lane obstacles — never a hazard. Dark
// props on dark ground (Ember) take a light ink edge so the silhouette reads.
const SCENERY = {
  // Meadow — lush & green (the leafy tree's home).
  tree: makeTree,
  bush: makeBush,
  flower: makeFlower,

  // Sunset — warm desert.
  // Tall enough to hold its saguaro silhouette at distance (thin scratches read
  // as noise), chunky trunk + arms doing the shape; a third sprout a pink blossom.
  saguaro: () => {
    const g = new THREE.Group(), m = toon(0x5fc9a8);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 2.0, 12), m); body.position.y = 1.0; body.castShadow = true; ink(body, 1.06); g.add(body);
    [-1, 1].forEach(s => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.55, 10), m); arm.position.set(s * 0.32, 1.05, 0); arm.rotation.z = -s * 1.1; ink(arm, 1.1); g.add(arm);
      const up = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, s > 0 ? 1.0 : 0.7, 10), m); up.position.set(s * 0.58, s > 0 ? 1.5 : 1.35, 0); ink(up, 1.1); g.add(up);
    });
    if (Math.random() < 0.34) {
      const bl = toon(0xff8fb0);
      [[0, 2.02], [0.58, 2.0]].forEach(([x, y]) => { const f = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), bl); f.position.set(x, y, 0.1); ink(f, 1.12); g.add(f); });
    }
    return g;
  },
  deadbush: () => {
    const g = new THREE.Group(), m = toon(0xb5895c);   // dry tan, not grey
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.03, 0.7, 5), m);
      b.position.set((Math.random() - 0.5) * 0.4, 0.34, (Math.random() - 0.5) * 0.4); b.rotation.set((Math.random() - 0.5) * 1.3, 0, (Math.random() - 0.5) * 1.3); ink(b, 1.12); g.add(b);
    }
    return g;
  },
  desertrock: () => {
    const g = new THREE.Group();
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), toon(0xc88f6e, { flat: true })); r.position.y = 0.38; r.scale.set(1.3, 0.78, 1.1); r.castShadow = true; ink(r, 1.07); g.add(r); return g;   // warm to sit in the sand
  },

  // Twilight — spooky night.
  // Chunky stump + stubby cone branches so it doesn't read as a grey scratch;
  // desaturated purple-grey keeps it in the biome (crystals own the violet pop).
  deadtree: () => {
    const g = new THREE.Group(), m = toon(0x4a4368);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 1.7, 8), m); trunk.position.y = 0.85; trunk.castShadow = true; ink(trunk, 1.07); g.add(trunk);
    [[-0.32, 1.3, 0.9], [0.34, 1.55, -0.9]].forEach(([x, y, rz]) => {
      const b = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 6), m); b.position.set(x, y, 0); b.rotation.z = rz; b.castShadow = true; ink(b, 1.1); g.add(b);
    });
    return g;
  },
  mushroom: () => {   // mint-glow cap on a pale stem pops off the dusky blue ground
    const g = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.5, 8), toon(0xede6ff)); stem.position.y = 0.25; ink(stem, 1.1); g.add(stem);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(0x8fe6d0, { emissive: 0x2a6a5a })); cap.position.y = 0.5; cap.scale.y = 0.8; cap.castShadow = true; ink(cap, 1.08); g.add(cap);
    const spotM = toon(0xf0fbf6, { emissive: 0xbfeee2 });
    [[-0.14, 0.56, 0.2], [0.16, 0.6, 0.16], [0, 0.66, -0.18]].forEach(([x, y, z]) => { const sp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), spotM); sp.position.set(x, y, z); g.add(sp); });
    const halo = glow(0x9ff0dc, 1.2, 0.42); halo.position.set(0, 0.5, 0); g.add(halo);   // bioluminescent cap
    return g;
  },
  crystalcluster: () => {
    const g = new THREE.Group(), m = toon(0x9a7bff, { emissive: 0x2a1a55, flat: true });
    [[0, 0.5, 0.14], [-0.24, 0.34, 0.11], [0.27, 0.3, 0.11]].forEach(([x, h, w]) => {
      const c = new THREE.Mesh(new THREE.ConeGeometry(w, h * 2, 5), m); c.position.set(x, h, 0); c.castShadow = true; ink(c, 1.1); g.add(c);
    });
    const halo = glow(0xb59bff, 1.3, 0.4); halo.position.set(0, 0.5, 0); g.add(halo);
    return g;
  },

  // Candyland — bright sweets.
  // Pink-on-pink washes out here, so every candy prop leans on a saturated
  // (non-pastel) hue or a dark ink edge to separate from the pink road.
  lollipop: () => {
    const g = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 8), toon(0xffffff)); stick.position.y = 0.5; ink(stick, 1.08); g.add(stick);
    const candy = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 20), toon(0xff5ca8, { emissive: 0x3a0022 })); candy.position.y = 1.05; candy.rotation.x = Math.PI / 2; candy.castShadow = true; ink(candy, 1.06); g.add(candy);
    const swirl = new THREE.Mesh(new THREE.CircleGeometry(0.24, 20), toon(0xffffff)); swirl.position.set(0, 1.05, 0.075); g.add(swirl);   // fakes a candy swirl, breaks the flat disc
    return g;
  },
  candybush: () => {
    const g = new THREE.Group(), cols = [0x7fd8c4, 0xb69cff];   // mint + lilac, off the pink ground
    for (let i = 0; i < 3; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2), toon(cols[i % 2], { emissive: 0x1a1030 }));
      d.position.set((i - 1) * 0.34, 0.02, (Math.random() - 0.5) * 0.3); d.castShadow = true; ink(d, 1.08); g.add(d);
    }
    return g;
  },
  peppermint: () => {   // the one prop that already read here — make it the anchor
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.13, 10, 18), toon(0xf0324b)); ring.position.y = 0.3; ring.castShadow = true; ink(ring, 1.07); g.add(ring);
    const mid = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 12), toon(0xffffff)); mid.position.y = 0.3; g.add(mid);
    return g;
  },

  // Frostpeak — icy tundra (the snow-capped pine's home).
  pine: () => {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.5, 8), toon(0x8a6b4a)); trunk.position.y = 0.25; ink(trunk, 1.1); g.add(trunk);
    const green = toon(0x3f8f6a), snow = toon(0xeaf6ff);
    [[0.6, 0.8], [0.46, 1.25], [0.32, 1.65]].forEach(([r, y]) => {
      const c = new THREE.Mesh(new THREE.ConeGeometry(r, 0.7, 9), green); c.position.y = y; c.castShadow = true; ink(c, 1.07, 0x3a4a5a); g.add(c);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.5, 0.32, 9), snow); cap.position.y = y + 0.22; g.add(cap);
    });
    return g;
  },
  snowmound: () => {
    const g = new THREE.Group(), m = toon(0xdceaf5);   // faint blue shadow-side so it isn't a pure-white blob
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.4 + Math.random() * 0.2, 12, 10), m);
      s.position.set((Math.random() - 0.5) * 0.7, 0.2, (Math.random() - 0.5) * 0.4); s.scale.y = 0.6; s.castShadow = true; ink(s, 1.06, 0x9fbcd0); g.add(s);
    }
    return g;
  },
  iceshard: () => {   // cool tint + strong blue ink so it doesn't vanish into the snow
    const g = new THREE.Group(), m = toon(0x9fd4e8, { emissive: 0x2a5a7a, flat: true });
    [[0, 0.7, 0.18], [-0.22, 0.45, 0.12], [0.24, 0.5, 0.13]].forEach(([x, h, w]) => {
      const c = new THREE.Mesh(new THREE.ConeGeometry(w, h * 2, 6), m); c.position.set(x, h, 0); c.castShadow = true; ink(c, 1.12, 0x4a90b8); g.add(c);
    });
    return g;
  },

  // Ember — volcanic ashlands. Dark props on dark ground take a light ink edge.
  // Chunky charred stump (not a wire), warm charcoal with a soft light ink edge
  // so it reads charred rather than inked-black on the dark ashland floor.
  charredtree: () => {
    const g = new THREE.Group(), m = toon(0x3a2e2e);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.18, 1.5, 8), m); trunk.position.y = 0.75; trunk.castShadow = true; ink(trunk, 1.06, 0x5a4a46); g.add(trunk);
    [[-0.32, 1.15, 0.9], [0.36, 1.45, -0.9], [0.05, 1.7, 0.2]].forEach(([x, y, rz]) => {
      const b = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5, 6), m); b.position.set(x, y, 0); b.rotation.z = rz; b.castShadow = true; ink(b, 1.08, 0x5a4a46); g.add(b);
    });
    const ember = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), toon(0xff6a2a, { emissive: 0xff5a10 })); ember.position.set(0.1, 0.14, 0.22); g.add(ember);
    const halo = glow(0xff7a2a, 0.8, 0.5); halo.position.set(0.1, 0.16, 0.22); g.add(halo);   // smouldering root
    return g;
  },
  basaltrock: () => {
    const g = new THREE.Group();
    const r = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), toon(0x3a2e2a, { flat: true })); r.position.y = 0.38; r.scale.set(1.3, 0.85, 1.1); r.castShadow = true; ink(r, 1.07, 0x7a5a4a); g.add(r);
    const crack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.05), toon(0xff6a2a, { emissive: 0xff6a2a, flat: true })); crack.position.set(0, 0.45, 0.42); crack.rotation.z = 0.4; g.add(crack);
    return g;
  },
  cinder: () => {   // the best Ember prop — a glowing core peeks through the dark mound
    const g = new THREE.Group();
    const r = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), toon(0x2e2422, { flat: true })); r.position.y = 0.2; r.scale.y = 0.6; r.castShadow = true; ink(r, 1.08, 0x7a5a4a); g.add(r);
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.19, 0), toon(0xff6a2b, { emissive: 0xff6a2b, flat: true })); core.position.set(0, 0.26, 0.05); g.add(core);
    const halo = glow(0xff8a3a, 0.95, 0.55); halo.position.set(0, 0.28, 0.05); g.add(halo);   // glowing ember core
    return g;
  },

  // Reef — sunlit coral seabed.
  // Two-segment blades with a bent tip read as soft plants, not glass shards.
  seaweed: () => {
    const g = new THREE.Group(), m = toon(0x3dbe8c, { emissive: 0x0a3a22 });
    [[-0.2, 1.2, 0.28], [0, 1.5, -0.22], [0.22, 1.3, 0.3]].forEach(([x, h, bend], i) => {
      const b = new THREE.Group(); b.position.set(x, 0, 0); b.rotation.y = (i - 1) * 0.26;
      const lh = h * 0.6;
      const lower = new THREE.Mesh(new THREE.BoxGeometry(0.13, lh, 0.06), m); lower.position.y = lh / 2; lower.castShadow = true; ink(lower, 1.08); b.add(lower);
      const pivot = new THREE.Group(); pivot.position.y = lh; pivot.rotation.z = bend; b.add(pivot);   // bends the tip at the joint
      const uh = h * 0.5;
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.1, uh, 0.06), m); upper.position.y = uh / 2; upper.castShadow = true; ink(upper, 1.08); pivot.add(upper);
      g.add(b);
    });
    return g;
  },
  coralnub: () => {
    const g = new THREE.Group(), m = toon(0xff7eb6, { emissive: 0x3a0a18 }), tipM = toon(0xffb3d9);
    [[0, 0.7, 0], [-0.3, 0.55, 0.4], [0.32, 0.48, -0.4]].forEach(([x, h, rz]) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, h, 8), m); b.position.set(x, h / 2, 0); b.rotation.z = rz; b.castShadow = true; ink(b, 1.1); g.add(b);
      const nub = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), tipM); nub.position.set(x - Math.sin(rz) * h / 2, h / 2 + Math.cos(rz) * h / 2, 0); ink(nub, 1.1); g.add(nub);   // lighter tip caps each finger
    });
    return g;
  },
  anemone: () => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xff6fa5, { emissive: 0x2a0a22 })); base.scale.y = 0.85; base.castShadow = true; ink(base, 1.07); g.add(base);
    const tip = toon(0xffc2dd);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 0.5, 6), tip);
      t.position.set(Math.cos(a) * 0.18, 0.34, Math.sin(a) * 0.18); t.rotation.z = Math.cos(a) * 0.5; t.rotation.x = -Math.sin(a) * 0.5; ink(t, 1.12); g.add(t);
    }
    return g;
  },
};

// Build a roadside scenery prop by kind, falling back to a meadow tree.
export function makeScenery(kind) {
  const g = (SCENERY[kind] || makeTree)();
  g.add(contactShadow(0.55));   // a small contact shadow grounds the shoulder flora
  return g;
}

// Kinds available to the debug bridge / sanity checks.
export const SCENERY_KINDS = Object.keys(SCENERY);

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

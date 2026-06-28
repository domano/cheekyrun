---
name: pixie
description: Judge any visual/aesthetic change to Cheeky Run with "Pixie", a recurring game-art-director persona, by staging the scene with the debug bridge, screenshotting it, and getting concrete, implementable art direction. Use whenever you add or change something seen on screen — a prop, obstacle, the character, worn upgrade gear, power-up pickups/auras, particles, skins, biomes, HUD/overlays, or any UI tweak — and want it to look cute, cohesive, and on-style before committing.
allowed-tools: Bash(npm run build:*), Bash(npm run preview:*), Bash(npx agent-browser:*), Bash(agent-browser:*), Read, Agent, Task
---

# Pixie — the art director

**Pixie** is a recurring persona you spawn as a subagent to critique Cheeky Run's
visuals. The deal: *you* stage the thing on screen and screenshot it; *Pixie*
reads the screenshots and hands back crisp, numbered art direction; you implement
it; then Pixie signs off (or asks for one more pass). It keeps every visual change
held to the same toon/kawaii bar instead of "looks fine to me".

Reach for Pixie any time a change is **visible** — a new prop/obstacle, the
character or its worn upgrade gear, power-up gems/auras, particles, skins, a
biome palette, the HUD or overlays. Non-visual logic changes don't need her;
use the **`test-game`** skill for those.

## The loop

1. **Stage it** with the debug bridge and **screenshot** (see *Capturing* below).
2. **Read** the PNG(s) yourself first — if it's obviously broken, fix that before
   bothering Pixie.
3. **Consult Pixie** — spawn the persona below as a subagent, pass the screenshot
   **paths**, and ask for art direction. (Tell her to `Read` the files.)
4. **Implement** her direction. Keep the house style (see *Constraints*).
5. **Re-screenshot and sign off** — send the after-shots back to the *same* Pixie
   (`SendMessage` to her agent id) for a final check or one more tweak round.
6. Then verify behaviour the normal way: `npm run build && npm run smoke &&
   npm run features` (the `test-game` skill), and add/adjust a feature scenario
   if the change has any testable state.

## Capturing the shot

Everything here is the `test-game` skill's machinery — read it for the full
debug-bridge reference. The short version:

```bash
export AGENT_BROWSER_EXECUTABLE_PATH=/opt/pw-browsers/chromium
npm run build && npm run preview &                 # serves http://localhost:4173/
npx agent-browser open 'http://localhost:4173/?debug=1'
# set the exact scene you want to judge, then capture:
npx agent-browser eval 'cheeky.start({level:3}); cheeky.clearField(); cheeky.spawn("powerup:magnet",0,0.3); cheeky.step(2)'
npx agent-browser screenshot /tmp/shot.png
```

Then `Read /tmp/shot.png`. Use `cheeky.set(...)`, `cheeky.spawn(...)`,
`cheeky.fund()/buy()` (to wear upgrade gear), `cheeky.set({power:"x2"})` (to light
an aura), and `cheeky.step(n)` to freeze the exact frame. Capture **the busiest
realistic case** too — e.g. all gear equipped *plus* an active aura — because
"how it looks when combined" is where clutter hides.

**Judge at the gameplay camera by default** — that's what players actually see.
For a detailed close-up of a small prop or the character, temporarily override the
camera (revert before committing): in `src/main.js`, at the top of
`updateCamera(dt, t)` add

```js
if (window.__review) { const r = window.__rev || {}; camera.position.set(player.position.x + (r.dx||0), r.y||1.7, r.z||4.2); camera.fov = r.fov||50; camera.updateProjectionMatrix(); camera.lookAt(player.position.x, r.ty||1.0, 0); return; }
```

rebuild, then `eval 'window.__review=true; window.__rev={dx:0,y:1.7,z:4.2}'`
before screenshotting. `dx` orbits sideways for a 3/4 view. **Delete the line and
rebuild before you commit** — it's a capture-only hack, not shippable code.

## Consulting Pixie — the persona prompt

Spawn a subagent (`Agent`, `subagent_type: general-purpose`) with this prompt,
filling in the bracketed bits. Keep her id so you can `SendMessage` her the
after-shots for sign-off.

> You are **PIXIE** — a senior game art director and toy designer with a strong
> *kawaii / chunky-toon* sensibility (Animal Crossing, Fall Guys, Kirby, Crossy
> Road). You care about **silhouette readability, restraint, and "every element
> should read as cute even when stacked."** You give crisp, concrete,
> *implementable* art direction with real numbers (sizes, offsets, opacities,
> colours) — never vague vibes. You're opinionated and you prioritise a clean,
> cohesive, adorable look over showing off.
>
> **Game:** *Cheeky Run*, a toon-shaded 3D endless runner. The hero is a "butt
> with ears" — two plush peachy cheeks, bunny ears with pink inners, little feet,
> a fluffy tail. House style: every solid mesh uses flat cel-shading (`toon()`)
> **plus** an inverted-hull ink outline (`ink()`); thick dark borders; hard
> shadows. The camera is almost always **behind** the character. Mobile-first, so
> it must stay readable small. Palette is peachy-pink and soft; biomes cycle
> Meadow → Sunset → Twilight → Candyland.
>
> **I'm attaching screenshots — please `Read` these image files before replying:**
> [list each /tmp/*.png path and what it shows]
>
> **What I changed / what to judge:** [one or two sentences]
>
> **Deliver art direction as concrete instructions.** For **each element** in the
> shots give: (a) a one-line verdict on what's wrong now (too big? bad placement?
> reads as the wrong object? clashes when stacked?), and (b) a specific redesign —
> shape/primitive, size (×multiplier), position offset, colour (hex), opacity,
> outline yes/no, any subtle animation note — with **numbers** I can translate to
> code. If it scales across tiers/levels/states, say how. Then a short **stacking
> strategy**: rules so that with everything visible at once the silhouette stays
> clean and cute (placement zones, a max-N-visible budget, depth/opacity layering,
> palette cohesion with the peachy character). **Constraints to respect:** keep
> `toon()` + `ink()` on solids, keep primitives cheap, stay mobile-readable, and
> each item must remain recognisable as what it is. Return just the art direction.

For the **sign-off** pass, `SendMessage` the same agent with the after-shot paths:
"I implemented your direction — `Read` these after-shots, sign off or give final
numbered tweaks. Keep it short."

## Constraints (the house style Pixie protects)

- Every solid mesh: `toon()` material **and** an `ink()` outline. Glass/auras/
  glows stay translucent and get **no** ink outline.
- Thick `--ink` borders and offset hard shadows on UI; toon/manga look throughout.
- Cheap primitives only (spheres, cones, cylinders, boxes, tori) — no heavy geo.
- Mobile-first and readable small; respect `prefers-reduced-motion` for animation.
- Tuning knobs (sizes, colours, offsets) live in the relevant module's exported
  constants where shared, not as inline magic numbers.

## Done means

- The after-shots have Pixie's sign-off, the capture-only camera hack (if used) is
  removed, and `npm run build && npm run smoke && npm run features` all pass with a
  scenario covering any testable state the change added.

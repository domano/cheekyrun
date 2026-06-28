# CLAUDE.md

Guidance for working in this repository.

## What this is

**Cheeky Run** — a toon-shaded 3D endless runner (a butt with ears, on the
run). Pure client-side: [Three.js](https://threejs.org/) for rendering, the Web
Audio API for sound, bundled with [Vite](https://vitejs.dev/). No backend, no
framework, no test runner — just ES modules in `src/`.

## Commands

Requires Node.js 20+.

```bash
npm install      # install dependencies
npm run dev      # dev server with hot reload (http://localhost:5173)
npm run build    # production build into dist/
npm run preview  # serve the production build (http://localhost:4173)
```

There is no lint or unit-test setup. To sanity-check a change, run
`npm run build` (it must succeed) and, when behaviour matters, drive the
preview build with Playwright — Chromium is available at
`/opt/pw-browsers/chromium`. A headless smoke test that loads the page, starts
a run, and asserts no console/page errors catches most regressions.

## Architecture

The game is a single `requestAnimationFrame` loop in `src/main.js`. Everything
else is a focused module it pulls from. State lives in module-scope `let`s in
`main.js` (no state library); the loop branches on a `state` string
(`'menu' | 'playing' | 'over'`).

| File | Responsibility |
| --- | --- |
| `index.html` | Markup: HUD, menu/game-over overlays, shop containers, canvas mount |
| `src/style.css` | All styling (toon/manga look: thick ink borders, hard shadows) |
| `src/main.js` | Entry point — scene setup, spawning, game flow, controls, the loop, biome tween, shop rendering |
| `src/config.js` | Shared constants (lane positions, spawn/despawn Z, ink colour) + tiny utils (`$`, `buzz`, `shuffle`) |
| `src/materials.js` | Cel-shading gradient ramp, `toon()` material factory, inverted-hull `ink()` outline |
| `src/props.js` | Mesh factories: obstacles (cactus/rock/bar), rolls, trees, bushes, flowers, clouds |
| `src/player.js` | Builds the player character; returns animated sub-parts (ears, feet, tail) |
| `src/particles.js` | Reusable pooled particle system (dust, sparkle, debris) |
| `src/levels.js` | Level progression by distance + biome themes |
| `src/upgrades.js` | Persistent upgrade shop: localStorage save, purchase logic, resolved effects |
| `src/audio.js` | Self-contained chiptune music scheduler + SFX (Web Audio) |

### How the core systems fit together

- **Game loop (`animate` in `main.js`):** advances `elapsed`/`distance`,
  derives `difficulty` and `speed`, spawns obstacle rows and scenery on timers,
  moves everything toward the camera, runs collision, and renders. Obstacles
  and rolls are plain arrays iterated back-to-front so in-loop splices are safe.

- **Spawning is a "corridor":** `spawnRow()` guarantees one always-open lane
  that drifts by at most one lane per row, so a single lane-change is always a
  valid dodge. Bars (duck) phase in after a warm-up.

- **Levels (`levels.js`):** `levelFromDistance(distance)` divides a run into
  levels of `LEVEL_DIST` units. Each level maps to a `BIOMES` entry (cycling
  Meadow → Sunset → Twilight → Candyland). The loop detects a level increase,
  fires `onLevelUp()` (banner + SFX + particles), and `applyBiome()` retargets
  the biome colours; `tweenBiome()` lerps the live scene colours toward the
  target each frame. The sky is the CSS `body` gradient behind the transparent
  canvas, so biomes set both `document.body.style.background` and the 3D
  fog/ground/path/hills/disc material colours.

- **Upgrades (`upgrades.js`):** a tiny localStorage save (`cheekyrun.save.v1`)
  holds a roll `wallet` and owned upgrade tiers. Rolls grabbed in a run are
  banked on game over via `addRolls()`. `effects()` resolves the current save
  into gameplay values read once at run start in `resetGame()` (shields,
  magnet radius, points-per-roll, extra jumps, head-start levels). The shop UI
  is rendered by `renderShop()` into every `.shop` container (menu + game-over)
  and re-renders after each purchase.

- **Audio (`audio.js`):** a `setInterval` scheduler queues Web Audio events
  ahead of time. Browsers require a user gesture to start audio, so
  `ensureAudio()` is called from the first interaction (start button, touch,
  shop purchase). SFX are no-ops until audio is ready and unmuted.

## Conventions

- Keep the toon/manga aesthetic: every solid mesh uses `toon()` and usually an
  `ink()` outline; UI uses thick `--ink` borders and offset hard shadows.
- Match the existing terse, comment-light-but-purposeful style. Functions are
  small and single-purpose; constants live in `config.js` or the relevant
  module, not inline magic numbers when they're shared.
- New gameplay knobs that tune feel (speeds, costs, level length, biome
  palettes) belong in their module's exported constants so they're easy to find
  and adjust.
- This is mobile-first: support both keyboard and touch (swipe) controls, and
  respect `prefers-reduced-motion` for animations.

## Deployment

Every push to `main` triggers `.github/workflows/deploy.yml`, which builds with
Vite and publishes `dist/` to GitHub Pages. Vite `base` is `./` (relative) so
the build works from either a Pages root or a project subpath. There are no
preview deploys — `main` is production.

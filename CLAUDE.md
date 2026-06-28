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
npm run smoke    # browser smoke test: build, drive a run, assert no errors
npm run features # deterministic feature tests against the debug bridge
```

## Testing every change

There is no lint or unit-test setup, and the game is real-time and
timing-sensitive — so don't verify by "playing" it. Behaviour is checked by
driving the real preview build with [`agent-browser`](https://www.npmjs.com/package/agent-browser)
(a devDependency). **After every change, before committing:**

1. `npm run build` — it must succeed.
2. `npm run smoke` — it must pass. Builds, serves the preview, starts a run,
   sends inputs, and fails on any console error or if the score never advances.
   Screenshot at `/tmp/cheekyrun-smoke.png`. Script: `scripts/smoke-test.sh`.
3. `npm run features` — it must pass. Deterministic per-feature scenarios that
   set state, step the sim with a fixed dt, and assert on JSON — no screenshots,
   no timing. Script: `scripts/feature-test.mjs`.

**When you add or change a feature, add/adjust a `npm run features` scenario**
so it's covered without anyone having to play the game. Each scenario is one
`{ name, fn }` entry; `fn(c, assert)` runs in the page driving the debug bridge.

The bridge is `window.cheeky`, built only in debug mode (`?debug` in the URL or
`localStorage.cheekydebug`; see `src/debug.js`) so production stays clean. It
exposes the real game state and lets you teleport/step/spawn deterministically:
`cheeky.state()`, `cheeky.start(overrides?)`, `cheeky.step(frames, dt)`,
`cheeky.set({...})`, `cheeky.spawn(kind, lane, z)`, `cheeky.jump()/duck()/left()`,
`cheeky.fund()/buy()/effects()`. Call `cheeky.help()` for the full list.

Screenshots are only needed for **visual** changes (a new biome, prop, skin, or
UI tweak) — set the scene with the bridge, capture, and **Read the PNG**. The
full playbook lives in the **`test-game` skill**
(`.claude/skills/test-game/SKILL.md`); invoke `/test-game` or follow it directly.

`agent-browser` needs a Chromium: in the agent sandbox it's pre-installed at
`/opt/pw-browsers/chromium` (the scripts point to it automatically); on a
dev machine run `npx agent-browser install` once.

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
| `src/debug.js` | Opt-in test/debug bridge — attaches `window.cheeky` when `?debug` is set (the API itself is built in `main.js`) |

### How the core systems fit together

- **Game loop (`animate` → `tick(dt)` in `main.js`):** `animate` is the
  `requestAnimationFrame` driver; the per-frame work lives in `tick(dt)`, which
  advances `elapsed`/`distance`, derives `difficulty` and `speed`, spawns
  obstacle rows and scenery on timers, moves everything toward the camera, runs
  collision, and renders. Splitting it out lets the debug bridge call `tick`
  with a fixed dt for deterministic, timing-free testing. Obstacles and rolls
  are plain arrays iterated back-to-front so in-loop splices are safe.

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

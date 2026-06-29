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

To judge whether a *visual* change actually looks cute and on-style — not just
that it works — use the **`pixie` skill** (`.claude/skills/pixie/SKILL.md`,
invoke `/pixie`): it screenshots the scene and runs it past "Pixie", a recurring
art-director persona, for concrete, numbered art direction and a sign-off.

`agent-browser` needs a Chromium: in the agent sandbox it's pre-installed at
`/opt/pw-browsers/chromium` (the scripts point to it automatically); on a
dev machine run `npx agent-browser install` once.

## Decomposing big changes onto subagents

The deterministic feature tests above exist so a big change can be split into
independent slices and handed to parallel subagents, each of which **verifies
its own work without playing the game or reading screenshots**. Prefer this over
one long serial edit whenever the work spans more than one feature or module.

**How to split.** Carve the change along the module boundaries in the table
below — give each subagent ownership of as few files as possible, ideally one
`src/*` module plus its own new scenario in `scripts/feature-test.mjs`. Slices
that would edit the same lines aren't independent; either sequence them or land
the shared edit yourself first, then fan out. The thinner the file overlap, the
cleaner the merge.

**What each subagent is told to do** (put this in its prompt):
1. Implement only its slice; keep the toon aesthetic and the terse house style.
2. Add or update a `npm run features` scenario that exercises the slice through
   the `window.cheeky` bridge — set state, `step()` the sim, assert on JSON.
3. Verify before returning: `npm run build`, then `npm run features` (and
   `npm run smoke` if it touched the loop/controls) must all pass. Report the
   scenario name and the pass/fail line — that JSON result is the deliverable,
   not a screenshot. Only flag a screenshot when the slice is visual.
4. Return a short summary of what changed and which files, so slices can be
   integrated without re-reading everything.

**Running them in parallel.** Launch the subagents in one batch so they run
concurrently. If two must touch overlapping files, give them isolated git
worktrees so their edits don't collide. Sonnet is a good default for a
well-scoped slice; reserve heavier models for slices that need real design.

**Integrating.** After collecting the slices, run the **full** suite once on the
merged tree — `npm run build && npm run smoke && npm run features` — before
committing. A green `features` run with every slice's scenario present is the
signal the decomposition came back together correctly. If a feature has no
scenario, it wasn't really tested; add one.

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

- **Save (`save.js`):** one versioned localStorage blob (`cheekyrun.save`) is the
  single source of persistent state — wallet, owned upgrade tiers, best, stats,
  achievements, cosmetics, daily, roguelite meta. `load()` self-heals any blob:
  a directed `MIGRATIONS` chain bumps an older `version`, `normalize()` rebuilds
  the canonical shape (coercing types, backfilling new fields, passing unknown
  future keys through), and value clamps stop a corrupt value bricking startup.
  Adding a field = extend `defaults()`/`normalize()`; a breaking change = bump
  `VERSION` and push a `MIGRATIONS` step. The key never changes again.

- **Upgrades (`upgrades.js`):** reads/writes the save for a roll `wallet` and
  owned upgrade tiers. Rolls grabbed in a run are
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

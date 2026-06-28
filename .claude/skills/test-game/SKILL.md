---
name: test-game
description: Test Cheeky Run without playing it in real time. Use after any change to gameplay, rendering, UI, controls, levels, upgrades, or audio. Covers the one-command smoke test, the deterministic feature-test harness (npm run features), the window.cheeky debug bridge for driving the game by hand, and screenshots for visual checks.
allowed-tools: Bash(npm run smoke:*), Bash(npm run features:*), Bash(npm run build:*), Bash(npm run preview:*), Bash(npx agent-browser:*), Bash(agent-browser:*)
---

# Testing Cheeky Run

There is no unit-test runner. Cheeky Run is a real-time, timing-sensitive
runner, so "play it and watch" is a poor way to verify a feature. Prefer, in
order:

1. **`npm run smoke`** — does it boot and run at all? (seconds)
2. **`npm run features`** — does each *feature* behave? Deterministic, no
   screenshots. **Add a scenario here for any new feature.**
3. **`window.cheeky` by hand** — drive a specific case and read JSON back.
4. **A screenshot** — only when the change is *visual* (a biome, a prop, UI).

The first three need no frame-perfect timing and no eyeballing. Reach for
screenshots last, only for look-and-feel.

Everything is driven by [`agent-browser`](https://www.npmjs.com/package/agent-browser)
(a pinned devDependency): it snapshots the accessibility tree into compact
`@eN` refs, sends real input over CDP, and — crucially — can `eval` JavaScript
in the page to call the debug bridge and read state back.

## 1. Smoke test — does it boot?

```bash
npm run smoke
```

Builds, serves the preview, loads the page, starts a run, sends a few inputs
(lane / jump / duck), and **fails** on any console error or if the score never
advanced. Screenshot at `/tmp/cheekyrun-smoke.png`. Script: `scripts/smoke-test.sh`.
Catches broken imports, runtime throws, a loop that won't start.

## 2. Feature tests — does each feature behave?

```bash
npm run features            # all scenarios
npm run features -- shield  # only scenarios whose name matches "shield"
```

This is the main way to verify features without playing the game. It boots the
preview with the **debug bridge** enabled (`?debug`), then for each scenario
reloads with a clean save and runs an in-page function that sets state, steps
the simulation with a *fixed* dt, and asserts on the JSON it reads back. No
real-time inputs, no screenshots — results are stable. Script:
`scripts/feature-test.mjs`.

**When you add a feature, add a scenario.** It's one entry in the `SCENARIOS`
array — a `{ name, fn }` where `fn(c, assert)` runs in the page (`c` is
`window.cheeky`). Example:

```js
{
  name: 'my-feature',
  fn: (c, assert) => {
    c.start({ shields: 2 });          // teleport into a configured run
    c.clearField();                   // remove auto-spawned obstacles
    c.spawn('cactus', 1, -4);         // put one dead ahead
    const s = c.step(60);             // advance 60 frames deterministically
    assert(s.shields === 1, 'a crash spends one shield');
  },
}
```

## The debug bridge: `window.cheeky`

Built only when debug mode is on — `?debug` in the URL or
`localStorage.cheekydebug` set (see `src/debug.js`). Zero overhead and no global
in a normal production build. It drives the *same* functions and state the real
game uses, so a passing check exercises real behaviour; it just removes the
timing. Call `cheeky.help()` in the console for the live list. Key calls:

| Call | What it does |
| --- | --- |
| `cheeky.state()` | Full game state as JSON (state, score, level, biome, shields, power, combo, player pos, object counts, wallet…) |
| `cheeky.start(overrides?)` | Start a run; optional `{level,speed,shields,…}` teleport applied after |
| `cheeky.step(frames=1, dt=1/60)` | **Advance the sim deterministically** and return `state()`. Auto-pauses the real-time loop |
| `cheeky.pause()` / `cheeky.resume()` | Freeze / unfreeze the live loop |
| `cheeky.set({…})` | Teleport state: `level, distance, speed, shields, invuln, magnetR, rollValue, extraJumps, combo, power, …` |
| `cheeky.spawn(kind, lane?, z?)` | Force one object ahead. kinds: `cactus·rock·bar·gate·hurdle·roll·powerup[:magnet\|x2\|ghost]` |
| `cheeky.clearField()` | Remove every obstacle / roll / pickup |
| `cheeky.left() / right() / lane(i) / jump() / duck()` | Drive the controls directly |
| `cheeky.seed(n)` | Make spawns deterministic (apply after `start()`) |
| `cheeky.fund(n) / buy(id) / effects()` | Drive the upgrade shop (`id`: magnet·shield·fortune·spring·headstart) |

One-off check from the shell (the browser persists between commands):

```bash
export AGENT_BROWSER_EXECUTABLE_PATH=/opt/pw-browsers/chromium
npm run build && npm run preview &           # serves http://localhost:4173/
npx agent-browser open 'http://localhost:4173/?debug=1'
npx agent-browser eval 'cheeky.start({level:3}); cheeky.step(120)'   # → state JSON
```

## Browser binary

`agent-browser` needs a Chromium. In the agent sandbox use the pre-installed
one:

```bash
export AGENT_BROWSER_EXECUTABLE_PATH=/opt/pw-browsers/chromium
```

The smoke script sets this automatically when the variable is unset and that
path exists. On a normal dev machine, run `npx agent-browser install` once to
fetch a managed Chrome instead.

## 3. Drive by hand with the debug bridge

When you want to poke at one specific case interactively. The browser persists
between commands, so set up once and `eval` away. Reading JSON back beats
pressing arrow keys at the right millisecond.

```bash
npx agent-browser open 'http://localhost:4173/?debug=1'
npx agent-browser eval 'cheeky.start()'                       # → state JSON
npx agent-browser eval 'cheeky.spawn("gate", 1, -3); cheeky.duck(); cheeky.step(25)'
npx agent-browser eval 'cheeky.set({level:4, power:"ghost"}); cheeky.state()'
```

If you really need raw key input (e.g. to test `bindControls` itself), keys
still map: `ArrowLeft`/`ArrowRight` = lane, `ArrowUp`/`Space` = jump,
`ArrowDown` = duck. Start the run with the button if not using the bridge:
`find role button click --name "Let's go!"`. HUD selectors: `#score`, `#level`,
`#rolls`; overlays `#overlay` / `#gameover`; mute `#muteBtn`.

## 4. Screenshots — visual changes only

The smoke and feature tests never look at pixels, so a new biome, prop, skin, or
UI tweak still needs an eyeball. Set state with the bridge first so you frame
exactly what you want, then capture and **Read the PNG**:

```bash
npx agent-browser eval 'cheeky.start({level:3}); cheeky.step(120)'   # Twilight, mid-run
npx agent-browser screenshot /tmp/shot.png
```

## What to check after a change

- `npm run build` succeeds, `npm run smoke` passes, **and `npm run features`
  passes** (no console errors, every scenario green).
- For any **new feature**, add a `npm run features` scenario that exercises it.
- For **visual** changes (biome/prop/skin/UI), also take a screenshot — set the
  scene with `cheeky.set(...)` / `cheeky.step(...)` — and Read the PNG to confirm
  the toon look survived.

## More agent-browser help

```bash
npx agent-browser skills get core        # full command reference + patterns
npx agent-browser --help
```

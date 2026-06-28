---
name: test-game
description: Test Cheeky Run in a real browser with agent-browser. Use after any change to gameplay, rendering, UI, controls, levels, upgrades, or audio to confirm the page loads, a run actually starts, and nothing throws. Covers the one-command smoke test plus how to drive the game by hand (start a run, change lanes, jump, duck, open the shop, read the HUD, screenshot).
allowed-tools: Bash(npm run smoke:*), Bash(npm run build:*), Bash(npm run preview:*), Bash(npx agent-browser:*), Bash(agent-browser:*)
---

# Testing Cheeky Run with agent-browser

There is no unit-test runner. Behaviour is verified by driving the real
preview build with [`agent-browser`](https://www.npmjs.com/package/agent-browser)
(installed as a devDependency, pinned in `package.json`). It snapshots the
accessibility tree into compact `@eN` refs and sends real input over CDP — so
it can start a run, press arrow keys, click shop buttons, and read the HUD.

## Fast path: the smoke test

After almost any change, run:

```bash
npm run smoke
```

This builds, serves the preview, loads the page, starts a run, sends a few
inputs (lane / jump / duck), and **fails** if the console logged an error or
the score never advanced. It writes a screenshot to `/tmp/cheekyrun-smoke.png`.
The script lives at `scripts/smoke-test.sh`. A green smoke test catches most
regressions (broken imports, runtime throws, a loop that won't start).

## Browser binary

`agent-browser` needs a Chromium. In the agent sandbox use the pre-installed
one:

```bash
export AGENT_BROWSER_EXECUTABLE_PATH=/opt/pw-browsers/chromium
```

The smoke script sets this automatically when the variable is unset and that
path exists. On a normal dev machine, run `npx agent-browser install` once to
fetch a managed Chrome instead.

## Driving the game by hand

Use this when a change needs a closer look than the smoke test gives (a new
biome, a shop item, a control tweak). Start the preview first:

```bash
npm run build && npm run preview   # serves http://localhost:4173/
export AGENT_BROWSER_EXECUTABLE_PATH=/opt/pw-browsers/chromium
```

Then, in another shell, drive it. The browser persists between commands:

```bash
npx agent-browser open http://localhost:4173/
npx agent-browser snapshot -i                       # see menu buttons + their @refs
npx agent-browser find role button click --name "Let's go!"   # start a run
npx agent-browser wait 1500
```

Controls map to keyboard events (mobile uses swipe/tap — see `bindControls`
in `src/main.js`):

| Action | Command |
| --- | --- |
| Move lane left / right | `npx agent-browser press ArrowLeft` / `press ArrowRight` |
| Jump (double-jump-able) | `npx agent-browser press ArrowUp` (or `press Space`) |
| Duck under bars | `npx agent-browser press ArrowDown` |

Read state from the HUD and capture a frame:

```bash
npx agent-browser get text "#score"      # current score
npx agent-browser get text "#level"      # current level
npx agent-browser get text "#rolls"      # rolls collected this run
npx agent-browser console --error        # MUST be empty
npx agent-browser screenshot /tmp/shot.png   # then Read the PNG to eyeball it
npx agent-browser close                  # when done
```

Key selectors / labels (from `index.html`):

- Start a run: button **"Let's go!"** (`#startBtn`); after a crash, **"Again!"** (`#againBtn`).
- Game-over overlay: `#gameover` (has class `hide` while playing); final score `#finalScore`.
- Shop buttons appear in the menu and game-over `.shop` containers — snapshot to
  get their refs, then `click @eN` to buy (rolls permitting).
- Mute toggle: `#muteBtn`.

## What to check after a change

- `npm run build` succeeds **and** `npm run smoke` passes (no console errors,
  score advances).
- For visual/biome/UI changes, take a `screenshot` and Read the PNG to confirm
  the toon look survived.
- For a new mechanic, drive the specific path by hand (e.g. buy the upgrade,
  start a run, verify its effect in the HUD or on screen) before committing.

## More agent-browser help

```bash
npx agent-browser skills get core        # full command reference + patterns
npx agent-browser --help
```

#!/usr/bin/env node
// Deterministic feature tests for Cheeky Run.
//
// The smoke test proves the game *boots and runs*. This proves individual
// FEATURES behave — without playing the game in real time and without reading
// screenshots. It drives the debug bridge (window.cheeky, see src/debug.js):
// each scenario sets state directly, steps the simulation with a fixed dt, and
// asserts on the JSON it reads back. Timing is removed, so results are stable.
//
// How it works: build + serve the preview, open it with `?debug`, then for each
// scenario reload with a clean save and run the scenario's function IN THE PAGE
// via `agent-browser eval`. The function gets (c = window.cheeky, assert); its
// collected assertions come back as JSON and are tallied here.
//
// Usage:  npm run features            (run every scenario)
//         npm run features -- magnet  (only scenarios whose name matches)
//
// Adding a test = add one entry to SCENARIOS below. No new files, no plumbing.

import { spawn, execFileSync } from 'node:child_process';
import { get } from 'node:http';
import { existsSync } from 'node:fs';

const PORT = 4173;
const URL = `http://localhost:${PORT}/?debug=1`;
const filter = process.argv[2];

// Prefer the locally-installed binary (much faster than `npx`, which re-resolves
// the package on every call); fall back to npx if it isn't there.
const LOCAL_BIN = 'node_modules/.bin/agent-browser';
const BIN = existsSync(LOCAL_BIN) ? LOCAL_BIN : 'npx';
const PRE = BIN === 'npx' ? ['agent-browser'] : [];

if (!process.env.AGENT_BROWSER_EXECUTABLE_PATH) {
  // Match the smoke script: prefer the sandbox's pre-installed Chromium.
  try { execFileSync('test', ['-x', '/opt/pw-browsers/chromium']); process.env.AGENT_BROWSER_EXECUTABLE_PATH = '/opt/pw-browsers/chromium'; } catch { /* let agent-browser find its own */ }
}

/* ------------------------------------------------------------------ *
 * SCENARIOS. Each `fn` runs in the page with the debug API as `c` and
 * an `assert(condition, message)` collector. Keep them small and focused:
 * set up → step the sim → assert on c.state().
 * ------------------------------------------------------------------ */
const SCENARIOS = [
  {
    name: 'boot',
    fn: (c, assert) => {
      assert(typeof c === 'object', 'debug API present');
      assert(c.state().state === 'menu', 'starts on the menu');
    },
  },
  {
    name: 'start-run',
    fn: (c, assert) => {
      const s = c.start();
      assert(s.state === 'playing', 'a run starts');
      assert(s.score === 0, 'score begins at 0');
      assert(s.level === 1, 'begins on level 1');
      assert(s.biome === 'Meadow', 'level 1 is the Meadow biome');
    },
  },
  {
    name: 'deterministic-stepping',
    fn: (c, assert) => {
      c.start(); const a = c.step(120);
      c.start(); const b = c.step(120);
      assert(a.distance > 0, 'distance advances when stepped');
      assert(a.score === Math.floor(a.distance) + a.rollPoints, 'score = floor(distance) + roll points');
      assert(a.distance === b.distance, 'same input → same distance (no real-time drift)');
    },
  },
  {
    name: 'level-up',
    fn: (c, assert) => {
      c.start(); c.set({ distance: 248 });       // just shy of the level-2 boundary (250)
      assert(c.state().level === 1, 'still level 1 below the boundary');
      const s = c.step(90);                       // step across it
      assert(s.level === 2, 'crossing the distance boundary bumps the level');
      assert(s.biome === 'Sunset', 'level 2 switches to the Sunset biome');
    },
  },
  {
    name: 'collision-crashes',
    fn: (c, assert) => {
      c.start(); c.clearField();
      c.spawn('cactus', 1, -4);                   // dead ahead in the player's lane
      const s = c.step(60);
      assert(s.state === 'over', 'running into an obstacle ends the run');
    },
  },
  {
    name: 'lane-change-dodges',
    fn: (c, assert) => {
      c.start(); c.clearField();
      c.spawn('cactus', 1, -5);
      c.left();                                   // step out of lane 1
      const s = c.step(60);
      assert(s.state === 'playing', 'a lane change dodges the obstacle');
      assert(s.laneIdx === 0, 'player is now in the left lane');
    },
  },
  {
    name: 'jump-clears-hurdle',
    fn: (c, assert) => {
      c.start(); c.clearField();
      c.spawn('hurdle', 1, -5);                   // full-width: must jump
      c.jump();
      const s = c.step(50);
      assert(s.state === 'playing', 'jumping clears a full-width hurdle');
    },
  },
  {
    name: 'duck-under-gate',
    fn: (c, assert) => {
      c.start(); c.clearField();
      c.spawn('gate', 1, -3);                     // full-width high bar: must slide
      c.duck();
      const s = c.step(25);
      assert(s.state === 'playing', 'ducking slides under a full-width gate');
    },
  },
  {
    name: 'biome-obstacle-variety',
    fn: (c, assert) => {
      c.start();                                  // level 1 = Meadow
      const meadow = c.state().biomeObstacles;
      assert(meadow.includes('cactus'), 'Meadow uses its cactus prop');
      c.set({ level: 3 });                        // Twilight
      const twilight = c.state().biomeObstacles;
      assert(twilight.includes('crystal'), 'Twilight uses its crystal prop');
      assert(JSON.stringify(meadow) !== JSON.stringify(twilight), 'different stages draw from different obstacle sets');

      // A biome jump-obstacle still crashes you if you do nothing...
      c.start(); c.clearField();
      c.spawn('crystal', 1, -4);
      assert(c.step(60).state === 'over', 'a Twilight crystal crashes the run');

      // ...and a biome duck-bar is cleared by sliding under it.
      c.start(); c.clearField();
      c.spawn('branch', 1, -3);                   // Meadow's slide-under prop
      c.duck();
      assert(c.step(25).state === 'playing', 'ducking clears a Meadow branch');
    },
  },
  {
    name: 'shield-absorbs-hit',
    fn: (c, assert) => {
      c.start(); c.set({ shields: 1 }); c.clearField();
      c.spawn('cactus', 1, -4);
      const s = c.step(60);
      assert(s.state === 'playing', 'a shield lets you survive a crash');
      assert(s.shields === 0, 'the shield is consumed');
    },
  },
  {
    name: 'rolls-and-combo',
    fn: (c, assert) => {
      c.start(); c.set({ magnetR: 0 }); c.clearField();
      c.spawn('roll', 1, -4);
      const s = c.step(60);
      assert(s.rollCount === 1, 'a roll in your lane is collected');
      assert(s.combo === 1, 'collecting a roll bumps the combo');
      assert(s.rollPoints >= s.rollValue, 'rolls award points');
    },
  },
  {
    name: 'powerup-activates',
    fn: (c, assert) => {
      c.start(); c.set({ magnetR: 0 }); c.clearField();
      c.spawn('powerup:x2', 1, -4);
      const s = c.step(60);
      assert(s.power === 'x2', 'a power-up gem activates its effect');
      assert(s.powerT > 0, 'the power-up has time remaining');
    },
  },
  {
    name: 'upgrade-shield-effect',
    fn: (c, assert) => {
      c.fund(1000); const ok = c.buy('shield');
      assert(ok === true, 'an affordable upgrade can be bought');
      assert(c.effects().shields === 1, 'buying Cushion resolves to 1 shield');
      const s = c.start();
      assert(s.shields === 1, 'the run starts with the bought shield');
    },
  },
  {
    name: 'upgrade-headstart',
    fn: (c, assert) => {
      c.fund(1000); c.buy('headstart');
      const s = c.start();
      assert(s.level === 2, 'Head Start begins the run a level in');
    },
  },
  {
    name: 'upgrade-visuals',
    fn: (c, assert) => {
      c.fund(2000); c.buy('shield'); c.buy('spring'); c.buy('spring');   // shield t1, spring t2
      const s = c.start();
      assert(s.gearTiers.shield === 1, 'owning Cushion shows its gear at tier 1');
      assert(s.gearTiers.spring === 2, 'a second Springy tier is more pronounced');
      assert(s.gearTiers.magnet === 0, 'un-owned upgrades wear no gear');
    },
  },
  {
    name: 'powerup-visual',
    fn: (c, assert) => {
      c.start();
      assert(c.state().auraVisible === false, 'no halo before any power-up');
      const on = c.set({ power: 'ghost' });
      assert(on.auraVisible === true, 'an active power-up lights the halo aura');
      const off = c.set({ power: null });
      assert(off.auraVisible === false, 'the halo clears when the power-up ends');
    },
  },
  {
    name: 'fart-on-jump-and-slide',
    fn: (c, assert) => {
      c.start(); c.clearField();
      assert(c.state().fartCount === 0, 'no puffs at the start of a run');
      c.jump();
      assert(c.state().fartCount === 1, 'jumping puffs a fart cloud');
      c.duck();
      assert(c.state().fartCount === 2, 'sliding puffs a fart cloud');
    },
  },
  {
    name: 'boost-powerup',
    fn: (c, assert) => {
      c.start({ magnetR: 0 }); c.clearField();
      c.spawn('powerup:dash', 1, -4);
      let s = c.step(60);
      assert(s.power === 'dash', 'grabbing the gem activates Boost');
      assert(s.invuln > 0, 'Boost makes you invulnerable while it lasts');
      c.spawn('cactus', 1, -4);                  // dead ahead — would normally crash
      s = c.step(40);
      assert(s.state === 'playing', 'Boost phases straight through obstacles');
    },
  },
  {
    name: 'emote-and-cheer',
    fn: (c, assert) => {
      c.start({ magnetR: 0 }); c.clearField();
      c.spawn('roll', 1, -4);
      let s = c.step(30);                         // long enough to grab, short enough that the squish hasn't decayed
      assert(s.rollCount === 1, 'roll collected');
      assert(s.emote > 0, 'grabbing a roll triggers a happy squish');
      c.start(); c.set({ distance: 248 });        // just shy of the level-2 boundary
      s = c.step(20);                             // cross it, then check the twirl is underway
      assert(s.level === 2, 'crossed into level 2');
      assert(s.spin > 0, 'leveling up kicks off a celebratory twirl');
    },
  },
];

/* ------------------------------- runner ------------------------------- */

// `timeout` is a safety net: a wedged agent-browser/CDP call throws here instead
// of hanging the whole suite. Per-scenario calls are caught in main()'s loop.
const ab = (...args) => execFileSync(BIN, [...PRE, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });

function waitForServer(timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tryOnce = () => get(URL, res => { res.resume(); resolve(); }).on('error', () => {
      if (Date.now() > deadline) reject(new Error('preview did not start'));
      else setTimeout(tryOnce, 250);
    });
    tryOnce();
  });
}

// Run a scenario's function in the page; returns { checks: [{ok,msg}], error? }.
//
// Each scenario is isolated by `c.fresh()` (wipes the save + returns to a clean
// menu) rather than a full page reload — reloading would re-init Three.js/WebGL
// every time and dominates the run. fresh() runs IN this same eval, so a whole
// scenario costs a single CLI round-trip instead of reload-plus-poll-plus-run.
function runScenario(fn) {
  const expr = `(()=>{const c=window.cheeky;if(!c)return{error:'debug API not ready (is ?debug set?)'};`
    + `c.fresh();`
    + `const checks=[];const assert=(cond,msg)=>checks.push({ok:!!cond,msg});`
    + `try{(${fn.toString()})(c,assert);}catch(e){return{error:String((e&&e.stack)||e),checks};}return{checks};})()`;
  const out = ab('eval', expr);
  const json = out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1);
  return JSON.parse(json);
}

// Poll once, after the initial open, until the debug bridge is attached.
function waitForBridge() {
  for (let i = 0; i < 40; i++) {
    try { if (ab('eval', 'typeof window.cheeky').includes('object')) return; } catch { /* retry */ }
    execFileSync('sleep', ['0.1']);
  }
  throw new Error('window.cheeky never appeared');
}

let preview;
async function main() {
  console.log('→ building');
  execFileSync('npm', ['run', 'build'], { stdio: ['ignore', 'ignore', 'inherit'] });

  console.log(`→ serving preview on :${PORT}`);
  preview = spawn('npm', ['run', 'preview'], { stdio: 'ignore' });
  await waitForServer();

  console.log('→ opening game with debug bridge');
  ab('open', URL);
  waitForBridge();

  const scenarios = SCENARIOS.filter(s => !filter || s.name.includes(filter));
  let passed = 0, failed = 0;

  for (const sc of scenarios) {
    let res;
    try { res = runScenario(sc.fn); } catch (e) { res = { error: String(e.message || e) }; }

    if (res.error) {
      failed++;
      console.log(`\n✗ ${sc.name}\n    threw: ${res.error.split('\n')[0]}`);
      continue;
    }
    const fails = res.checks.filter(c => !c.ok);
    if (fails.length === 0) {
      passed++;
      console.log(`✓ ${sc.name}  (${res.checks.length} checks)`);
    } else {
      failed++;
      console.log(`\n✗ ${sc.name}`);
      for (const c of res.checks) console.log(`    ${c.ok ? '✓' : '✗'} ${c.msg}`);
    }
  }

  console.log(`\n${failed === 0 ? '✓' : '✗'} ${passed}/${passed + failed} feature scenarios passed`);
  // Exit explicitly: the spawned preview child keeps the event loop alive, so
  // without this the process would hang after printing results instead of
  // exiting. process.exit() fires the 'exit' handler below, which runs cleanup.
  process.exit(failed === 0 ? 0 : 1);
}

function cleanup() {
  try { ab('close'); } catch { /* ignore */ }
  if (preview) try { preview.kill(); } catch { /* ignore */ }
}
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });

main().catch(err => { console.error('✗ harness error:', err.message || err); cleanup(); process.exit(1); });

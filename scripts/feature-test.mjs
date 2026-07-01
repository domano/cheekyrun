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
    name: 'stage-finish-line',
    fn: (c, assert) => {
      c.start();
      assert(c.state().level === 1, 'a run begins on stage 1');
      c.forceFinish();                            // drop the finish line just ahead
      assert(c.state().finishLine !== null, 'reaching the stage end drops a finish line');
      let s; for (let i = 0; i < 40; i++) { s = c.step(6); if (s.level === 2) break; }
      assert(s.level === 2, 'crossing the finish line advances the stage');
      assert(s.biome === 'Sunset', 'the next stage switches to the Sunset biome');
    },
  },
  {
    name: 'stage-end-cheer-crowd',
    fn: (c, assert) => {
      c.start();
      assert(c.state().counts.cheerers === 0, 'no roadside crowd mid-stage');
      c.forceFinish();                            // drop the finish line + its crowd
      const n = c.state().counts.cheerers;
      assert(n >= 4 && n <= 8, `the finish line brings a roadside crowd (${n} fans)`);
      c.step(2);                                  // the crowd hops/waves without erroring
      assert(c.state().counts.cheerers === n, 'the crowd persists while the line is up');
      let s; for (let i = 0; i < 40; i++) { s = c.step(6); if (s.level === 2) break; }
      assert(s.level === 2, 'the runner crosses the line');
      if (c.state().state === 'draft') { c.set({ draftArm: 0 }); c.pick(0); }   // crossing drafts a perk; resume the run
      c.set({ stageLen: 1e6 });                   // hold the next stage open so only the old line clears
      for (let i = 0; i < 80 && c.state().finishLine !== null; i++) c.step(6);
      assert(c.state().counts.cheerers === 0, 'the crowd despawns with the finish line');
    },
  },
  {
    name: 'stage-length-scales-with-speed',
    fn: (c, assert) => {
      c.start();
      c.set({ speed: 12.5, level: 2 });           // begin a stage at base speed
      const slow = c.state().stageLen;
      c.set({ speed: 30, level: 3 });             // begin a stage while running fast
      const fast = c.state().stageLen;
      assert(slow > 0, 'a stage has a positive length');
      assert(fast > slow, `a faster run gets a longer stage (slow ${slow}, fast ${fast})`);
    },
  },
  {
    name: 'stage-breather-suppresses-spawns',
    fn: (c, assert) => {
      // The stage body spawns obstacle rows as usual...
      // (a coarse dt keeps the rendered-frame count — and the test — cheap)
      c.start({ magnetR: 0 }); c.seed(5);
      c.set({ stageStart: 0, stageLen: 4000 }); c.clearField();   // sit deep inside the stage body
      const body = c.step(100, 1 / 30).counts.obstacles;
      assert(body > 0, 'obstacles spawn through the stage body');
      // ...but the run-up to the finish line (and the breather past it) stays clear.
      c.start({ magnetR: 0 }); c.seed(5);
      const d = c.state().distance;
      c.set({ stageStart: d - 200, stageLen: 50 }); c.clearField();   // into=200 ≫ stageLen → in the clearing zone
      const breather = c.step(100, 1 / 30).counts.obstacles;
      assert(breather === 0, 'no obstacles spawn in the finish-line breather');
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
    name: 'new-stages-frostpeak-ember-reef',
    fn: (c, assert) => {
      // The biome cycle now runs eight stages deep; levels 5/6/7 are the new trio.
      c.start();
      c.set({ level: 5 }); const frost = c.state();
      assert(frost.biome === 'Frostpeak', 'level 5 is the Frostpeak biome');
      assert(frost.biomeObstacles.includes('icespike') && frost.biomeObstacles.includes('frostbar'), 'Frostpeak draws from its icy props');

      c.set({ level: 6 }); const ember = c.state();
      assert(ember.biome === 'Ember', 'level 6 is the Ember biome');
      assert(ember.biomeObstacles.includes('lavarock') && ember.biomeObstacles.includes('emberbar'), 'Ember draws from its volcanic props');

      c.set({ level: 7 }); const reef = c.state();
      assert(reef.biome === 'Reef', 'level 7 is the Reef biome');
      assert(reef.biomeObstacles.includes('coral') && reef.biomeObstacles.includes('kelp'), 'Reef draws from its coral props');

      // Each set is distinct, so the three new stages look like different places.
      const sets = [frost, ember, reef].map(s => JSON.stringify(s.biomeObstacles));
      assert(new Set(sets).size === 3, 'the three new stages each have their own obstacle set');

      // A new jump-obstacle still crashes you if you do nothing...
      c.start(); c.clearField();
      c.spawn('lavarock', 1, -4);
      assert(c.step(60).state === 'over', 'an Ember lavarock crashes the run');

      // ...and a new duck-bar is cleared by sliding under it.
      c.start(); c.clearField();
      c.spawn('kelp', 1, -3);                      // Reef's slide-under prop
      c.duck();
      assert(c.step(25).state === 'playing', 'ducking clears a Reef kelp bar');
    },
  },
  {
    name: 'biome-scenery-variety',
    fn: (c, assert) => {
      // Each stage lines its road with its own flora; the leafy tree stays in the
      // Meadow it fits — it isn't reused by any other biome.
      c.start();                                   // level 1 = Meadow
      const meadow = c.state().biomeScenery;
      assert(meadow.includes('tree'), 'the Meadow lines its road with the leafy tree');

      const rosters = { 1: meadow.join(',') };
      const treeStages = [];
      for (let lv = 1; lv <= 7; lv++) {
        c.set({ level: lv });
        const s = c.state();
        assert(Array.isArray(s.biomeScenery) && s.biomeScenery.length > 0, `${s.biome} has its own scenery roster`);
        if (s.biomeScenery.includes('tree')) treeStages.push(s.biome);
        rosters[lv] = s.biomeScenery.join(',');
      }
      assert(treeStages.length === 1 && treeStages[0] === 'Meadow', 'the leafy tree stays in the Meadow — no other stage reuses it');

      // Adjacent stages look like different places: their rosters differ.
      assert(rosters[1] !== rosters[2] && rosters[2] !== rosters[3], 'each stage draws roadside props from its own set');

      // The signature prop of a couple of biomes stays put where it fits.
      c.set({ level: 5 }); assert(c.state().biomeScenery.includes('pine'), 'Frostpeak lines its road with snow-capped pines');
      c.set({ level: 2 }); assert(c.state().biomeScenery.includes('saguaro'), 'the desert gets a saguaro instead of a tree');
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
    name: 'reset-save',
    fn: (c, assert) => {
      c.fund(500); c.buy('shield');
      assert(c.wallet() > 0, 'wallet holds leftover rolls');
      assert(c.effects().shields === 1, 'a shield upgrade is owned');
      const dlg = document.getElementById('resetConfirm');
      // Opening the confirm dialog doesn't touch the save.
      document.getElementById('resetBtn').click();
      assert(!dlg.classList.contains('hide'), 'reset button opens the confirm dialog');
      assert(c.effects().shields === 1, 'owned upgrade is intact while the dialog is open');
      // Cancelling leaves everything as it was.
      document.getElementById('resetNo').click();
      assert(dlg.classList.contains('hide'), 'Cancel closes the dialog');
      assert(c.effects().shields === 1, 'Cancel keeps the save');
      // Confirming wipes the save back to defaults and closes the dialog.
      document.getElementById('resetBtn').click();
      document.getElementById('resetYes').click();
      assert(dlg.classList.contains('hide'), 'confirming closes the dialog');
      assert(c.wallet() === 0, 'confirm empties the wallet');
      assert(c.effects().shields === 0, 'confirm clears owned upgrades');
      // The whole menu re-renders after the wipe (proves the refresh chain ran).
      assert(/Best 0\b/.test(document.querySelector('.menu .stats').textContent), 'menu stats re-render to a fresh save');
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
      c.fund(2000); c.buy('shield'); c.buy('shield'); c.buy('headstart');   // shield t2, headstart t1 (the surviving floor)
      const s = c.start();
      assert(s.gearTiers.shield === 2, 'owning Cushion shows its gear at tier 2');
      assert(s.gearTiers.headstart === 1, 'a Head Start tier is owned');
      // the worn props actually toggle with ownership...
      assert(s.gearVisible.shield === true, 'the shield bubble is worn');
      assert(s.gearVisible.headstart === true, 'the rocket is worn');
      // the reframed upgrades are perks now: their props stay off until drafted.
      assert(s.gearVisible.magnet === false && s.gearVisible.spring === false && s.gearVisible.fortune === false, 'undrafted perk gear is hidden');
      // ...and the shield's tier shows as orbiting pips, one per tier, not bulk.
      assert(s.gearVisible.shieldPips === 2, 'a tier-2 Cushion shows two tier pips');
    },
  },
  {
    name: 'shield-gear-tracks-remaining',
    fn: (c, assert) => {
      // The worn Cushion bubble follows the live shield count, not ownership:
      // visible while protected, gone the instant the last cushion is spent.
      c.start(); c.set({ shields: 2 }); c.clearField();
      let s = c.state();
      assert(s.gearVisible.shield === true, 'the cushion bubble shows while shields remain');
      assert(s.gearVisible.shieldPips === 2, 'one orbiting pip per remaining cushion');
      c.set({ shields: 1 });
      assert(c.state().gearVisible.shieldPips === 1, 'spending a cushion drops a pip');
      // Crash through the final shield — the bubble must pop, not linger.
      c.set({ shields: 1, invuln: 0 }); c.spawn('cactus', 1, -4);
      s = c.step(60);
      assert(s.shields === 0, 'the last cushion is spent absorbing the hit');
      assert(s.gearVisible.shield === false, 'the bubble vanishes with no cushion left');
      assert(s.gearVisible.shieldPips === 0, 'and no tier pips remain');
    },
  },
  {
    name: 'perk-gear',
    fn: (c, assert) => {
      c.start();
      assert(c.state().gearVisible.magnet === false, 'no magnet before drafting Vacuum');
      let s = c.perk('vacuum');                    // 🧲 Vacuum → magnet prop
      assert(s.gearVisible.magnet === true, 'drafting Vacuum wears the magnet');
      s = c.perk('hops');                          // 🦿 Hops → springs prop
      assert(s.gearVisible.spring === true, 'drafting Hops wears the springs');
      s = c.perk('lucky');                         // 🍀 Lucky → clover prop
      assert(s.gearVisible.fortune === true, 'drafting Lucky wears the clover');
      // a fresh run drops the worn perk gear (perks are per-run, not banked).
      const f = c.start();
      assert(f.gearVisible.magnet === false && f.gearVisible.spring === false && f.gearVisible.fortune === false, 'perk gear resets each run');
    },
  },
  {
    // Completeness gate: every perk wears a visible 3D prop. The legacy three map
    // onto magnet/spring/clover; every other perk keys onto a prop in its own
    // file (src/perkgear/<id>.js). Goes fully green once each perk has a model.
    name: 'perk-gear-models',
    fn: (c, assert) => {
      const MAP = {
        vacuum: 'magnet', hops: 'spring', lucky: 'fortune',
        tailwind: 'tailwind', memory: 'memory', pillow: 'pillow', daredevil: 'daredevil',
        doubledown: 'doubledown', glasscannon: 'glasscannon', greedygut: 'greedygut',
        featherfall: 'featherfall', secondwind: 'secondwind', overdrive: 'overdrive',
        hotstreak: 'hotstreak', featherweight: 'featherweight', perfectionist: 'perfectionist',
        magpie: 'magpie', allin: 'allin',
      };
      c.start();
      for (const id in MAP) {
        const s = c.perk(id);
        assert(s.gearVisible[MAP[id]] === true, `drafting ${id} wears its ${MAP[id]} prop`);
      }
      const f = c.start();   // perks are per-run: a fresh run strips every prop off
      for (const id in MAP) {
        assert(f.gearVisible[MAP[id]] === false, `${id}'s prop is gone on a fresh run`);
      }
    },
  },
  {
    name: 'save-resilience',
    fn: (c, assert) => {
      // The versioned save loader self-heals on load. A blob written by a FUTURE
      // build — higher version, an unknown upgrade id, an unknown top-level key —
      // mixed with a corrupt value must load without losing the data this build
      // understands, and without a full reset.
      localStorage.setItem('cheekyrun.save', JSON.stringify({
        version: 999,                                   // written by a newer build
        wallet: 320, best: 7000,
        owned: { shield: 2, headstart: -4, ghostDash: 9 },   // bad tier + an upgrade this build never heard of
        cosmetics: 'broken',                            // wrong type entirely
        futureField: { keep: 'me' },                    // unknown top-level key
      }));
      let s;
      try { s = c.reloadSave(); } catch (e) { assert(false, 'a future/corrupt save threw: ' + e.message); return; }
      assert(s.recovered === false, 'the save self-heals on load — no full reset needed');
      assert(s.state === 'menu', 'startup lands on a clean, live menu');
      assert(c.wallet() === 320, 'the wallet from a future-version save is preserved');
      assert(c.effects().shields === 2, 'a real upgrade tier survives');
      assert(c.effects().headstart === 0, 'the negative tier self-heals to 0 instead of bricking startup');
      const r = c.start();
      assert(r.state === 'playing' && r.level === 1, 'a normal run starts on the healed save');
    },
  },
  {
    name: 'malformed-save-still-boots',
    fn: (c, assert) => {
      // Regression: a corrupt save whose map fields aren't plain objects (here
      // `owned`/`meta`/`cosmetics` as strings, `achievements` as a number) must
      // not take the module graph down at import. The loader coerces every such
      // field to a clean map; the save loads cleanly to a live, playable menu.
      localStorage.setItem('cheekyrun.save', JSON.stringify({
        owned: 'abc', wallet: 70, meta: 'nope', cosmetics: 'classic', achievements: 5,
      }));
      let s;
      try { s = c.reloadSave(); } catch (e) { assert(false, 'loading a malformed save threw: ' + e.message); return; }
      assert(typeof s === 'object', 'a malformed save loads without throwing');
      assert(c.effects().shields === 0, 'string `owned` is coerced to a clean map — no phantom tiers');
      const r = c.start();
      assert(r.state === 'playing', 'a run still starts after loading the malformed save');
      assert(r.gearVisible.shield === false, 'no phantom gear is worn from the junk save');
    },
  },
  {
    name: 'corrupt-value-self-heals',
    fn: (c, assert) => {
      // A bad *value* (not just a bad type): a negative upgrade tier once made the
      // run start on a negative level, biomeOf() returned undefined → a throw deep
      // in startup, and the only fix was nuking the whole save. The loader now
      // clamps the bad tier away at load, so the field self-heals while the rest
      // of the save (wallet, best) is preserved — no full reset, no data loss.
      localStorage.setItem('cheekyrun.save', JSON.stringify({ owned: { headstart: -3 }, wallet: 200, best: 4000 }));
      let s;
      try { s = c.reloadSave(); } catch (e) { assert(false, 'loading the corrupt-value save threw: ' + e.message); return; }
      assert(s.recovered === false, 'the bad value self-heals — no reset-to-defaults needed');
      assert(s.state === 'menu', 'startup lands on a clean, live menu');
      assert(c.effects().headstart === 0, 'the negative upgrade tier was clamped away');
      assert(c.wallet() === 200, 'the rest of the save (wallet) is preserved, not wiped');
      const r = c.start();
      assert(r.state === 'playing' && r.level === 1, 'a normal run starts from level 1 on the healed save');
    },
  },
  {
    name: 'save-survives-eviction',
    fn: (c, assert) => {
      // "Drops savegames after a while": a browser can evict the primary
      // localStorage slot under storage pressure. persist() now mirrors every
      // write into a shadow slot, and load() falls back to it — so an evicted
      // primary recovers the save instead of resetting to a blank one.
      c.fund(140);                                       // a mutation -> persist() writes both slots
      const prim = JSON.parse(localStorage.getItem('cheekyrun.save'));
      const bak = JSON.parse(localStorage.getItem('cheekyrun.save.bak'));
      assert(prim && prim.wallet === 140, 'the primary slot holds the saved wallet');
      assert(bak && bak.wallet === 140, 'persist() mirrors the save into the shadow backup slot');

      localStorage.removeItem('cheekyrun.save');         // simulate the browser evicting the primary
      const s = c.reloadSave();
      assert(s.recovered === false, 'the evicted save recovers from the backup — no reset to defaults');
      assert(c.wallet() === 140, 'the wallet is restored from the shadow backup, not lost');
      const r = c.start();
      assert(r.state === 'playing', 'a run still starts on the recovered save');
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
    name: 'curves-and-hills',
    fn: (c, assert) => {
      c.start();
      const a = c.set({ distance: 100 }).track;
      assert(a.nearX === 0 && a.nearY === 0, 'no warp at the player, so collisions stay fair');
      assert(a.farX !== 0 || a.farY !== 0, 'the road bends/rolls into the distance');
      const b = c.set({ distance: 100 }).track;
      assert(a.farX === b.farX && a.farY === b.farY, 'the warp is deterministic for a given distance');
      const d = c.set({ distance: 220 }).track;
      assert(d.farX !== a.farX || d.farY !== a.farY, 'the track keeps changing as you travel');
      // Gameplay is unaffected: a roll far down the curving track is still grabbed,
      // and an obstacle dead ahead still crashes you.
      c.clearField(); c.set({ magnetR: 0 });
      c.spawn('roll', 1, -9);
      const s = c.step(90);
      assert(s.rollCount === 1, 'a roll stays collectible despite the curving track');
      c.clearField(); c.spawn('cactus', 1, -4);
      assert(c.step(60).state === 'over', 'an obstacle in your lane still crashes you on a curve');
    },
  },
  {
    name: 'skin-selection-persists',
    fn: (c, assert) => {
      // Classic is the free default and is live on the character at boot.
      assert(c.skin().selected === 'classic', 'a fresh save wears Classic');
      assert(c.skin().applied.skin === 0xffbfa8, 'Classic colours are on the live mats');

      // Achievement skins are locked until earned: selecting one is a no-op.
      c.pickSkin('golden');
      assert(c.skin().selected === 'classic', 'a locked achievement skin can not be selected');

      // Earn the achievement, then select — it locks in and recolours the mats.
      c.unlockAch('level10');
      assert(c.pickSkin('golden') === 'golden', 'an unlocked achievement skin selects');
      assert(c.skin().selected === 'golden', 'the selection is persisted, not just previewed');
      assert(c.skin().applied.skin === 0xffd166, 'Golden colours are applied live');

      // The regression: the skin must survive starting a run (resetGame re-applies).
      c.start();
      assert(c.skin().selected === 'golden', 'the skin stays selected after the run starts');
      assert(c.skin().applied.skin === 0xffd166, 'Golden is re-applied on run start, not reset to Classic');
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
      c.start(); c.forceFinish();                  // drop the finish line just ahead
      for (let i = 0; i < 40; i++) { s = c.step(5); if (s.level === 2) break; }   // cross it, then check the twirl is underway
      assert(s.level === 2, 'crossed into level 2');
      assert(s.spin > 0, 'leveling up kicks off a celebratory twirl');
    },
  },
  {
    name: 'perk-roll-value',
    fn: (c, assert) => {
      c.start({ magnetR: 0 }); c.clearField();
      assert(c.state().mods.rollMult === 1, 'rollMult starts neutral');
      const s1 = c.perk('lucky');
      assert(s1.mods.rollMult === 1.18, 'Lucky Streak raises rollMult to 1.18');
      assert(s1.perks.length === 1 && s1.perks[0].id === 'lucky', 'the perk is recorded on the run');
      c.spawn('roll', 1, -4);
      const s = c.step(60);
      assert(s.rollCount === 1, 'the roll is collected');
      assert(s.rollPoints === Math.round(s.rollValue * 1.18), 'roll points are scaled by the perk');
    },
  },
  {
    name: 'perk-extra-jump',
    fn: (c, assert) => {
      c.start({ magnetR: 0 }); c.clearField();
      c.perk('hops');
      assert(c.state().mods.extraJumpsBonus === 1, 'Hops raises the extra-jump bonus');
      c.jump();                                   // leave the ground, then fall back
      const s = c.step(60);                        // no rows spawn this early (rowTimer 1.8s)
      assert(s.player.grounded, 'back on the ground');
      assert(s.jumpsLeft === 3, 'landing refills to 2 base + 1 perk jump');
    },
  },
  {
    name: 'perk-stacking',
    fn: (c, assert) => {
      c.start();
      c.perk('lucky'); c.perk('lucky'); let s = c.perk('lucky');   // cap is 3
      assert(s.perks[0].stacks === 3, 'Lucky stacks up to its cap of 3');
      assert(Math.abs(s.mods.rollMult - Math.pow(1.18, 3)) < 1e-9, 'each stack compounds rollMult');
      s = c.perk('lucky');                          // beyond the cap
      assert(s.perks[0].stacks === 3, 'a perk cannot exceed its stack cap');
    },
  },
  {
    name: 'curse-glass-cannon',
    fn: (c, assert) => {
      c.start({ magnetR: 0 }); c.set({ shields: 2 }); c.clearField();
      const s1 = c.perk('glasscannon');
      assert(s1.mods.rollX === 2, 'Glass Cannon doubles roll value');
      assert(s1.mods.noShields === true, 'Glass Cannon disables cushions');
      assert(Math.abs(s1.mods.obstacleMult - 1.25) < 1e-9, 'Glass Cannon also raises the hazard rate (a real cost even with no shields)');
      c.spawn('cactus', 1, -4);
      const s = c.step(60);
      assert(s.state === 'over', 'with cushions disabled, a hit ends the run despite owning shields');
    },
  },
  {
    name: 'perk-greed-mods',
    fn: (c, assert) => {
      c.start();
      const s = c.perk('greedygut');
      assert(Math.abs(s.mods.rollSpawnMult - 1.6) < 1e-9, 'Greedy Gut boosts roll spawns');
      assert(Math.abs(s.mods.obstacleMult - 1.25) < 1e-9, 'Greedy Gut also cranks the danger');
    },
  },
  {
    name: 'draft-cadence',
    fn: (c, assert) => {
      const cross = (lvl) => { c.forceFinish(); let s; for (let i = 0; i < 40; i++) { s = c.step(6); if (s.level === lvl) break; } return s; };
      c.start(); c.seed(1);
      let s = cross(2);                                  // 1st finish line → level 2 (1st level-up)
      assert(s.level === 2 && s.levelUps === 1, 'first finish line reaches level 2');
      assert(s.state === 'draft', 'the first level-up front-loads a draft');
      assert(s.draft.length === 3, 'three perks are offered');
      c.set({ draftArm: 0 });                            // skip the input-lock for the test
      c.pick(0);                                         // take one, resume
      s = cross(3);                                      // 2nd finish line → level 3 (2nd level-up)
      assert(s.level === 3 && s.levelUps === 2, 'second finish line reaches level 3');
      assert(s.state === 'playing', 'no draft on the second level-up');
      s = cross(4);                                      // 3rd finish line → level 4 (3rd level-up)
      assert(s.level === 4 && s.state === 'draft', 'the third level-up drafts again');
    },
  },
  {
    name: 'draft-pick-applies-and-resumes',
    fn: (c, assert) => {
      c.start({ magnetR: 0 }); c.seed(2);
      c.openDraft();
      const d = c.draft();
      assert(d.state === 'draft' && d.choices.length === 3, 'a draft of three is open');
      const first = d.choices[0];
      c.set({ draftArm: 0 });                            // skip the input-lock for the test
      let s = c.pick(0);
      assert(s.state === 'playing', 'picking a perk resumes the run');
      assert(s.perks.length === 1 && s.perks[0].id === first, 'the chosen card becomes the run perk');
      const d0 = s.distance; s = c.step(30);
      assert(s.distance > d0, 'the simulation advances again after the pick');
    },
  },
  {
    name: 'draft-input-guard',
    fn: (c, assert) => {
      c.start({ magnetR: 0 }); c.seed(2);
      let s = c.openDraft();
      assert(s.state === 'draft' && s.draftArm > 0, 'a fresh draft opens with its cards locked');
      s = c.pick(0);
      assert(s.state === 'draft' && s.perks.length === 0, 'a pick during the lock is ignored — no stray select');
      s = c.reroll();
      assert(s.state === 'draft', 'a reroll during the lock is ignored too');
      s = c.step(30);                                    // 0.5s — past the 0.45s lock
      assert(s.draftArm === 0, 'the lock clears after a beat');
      s = c.pick(0);
      assert(s.state === 'playing' && s.perks.length === 1, 'a pick after the lock applies and resumes');
      assert(s.invuln > 0, 'resuming grants a grace window to react to the frozen road');
    },
  },
  {
    name: 'draft-deterministic',
    fn: (c, assert) => {
      c.start(); c.seed(7); c.openDraft(); const a = c.draft().choices;
      c.start(); c.seed(7); c.openDraft(); const b = c.draft().choices;
      assert(a.length === 3 && b.length === 3, 'both drafts offer three perks');
      assert(a.join(',') === b.join(','), 'the same seed yields the same draft');
    },
  },
  {
    name: 'meta-unlock-into-pool',
    fn: (c, assert) => {
      c.start();
      assert(!c.state().meta.eligible.includes('doubledown'), 'epics start locked out of the pool');
      c.fund(9999);
      assert(c.buyMeta('unlock:doubledown') === true, 'an affordable unlock is bought');
      assert(c.state().meta.eligible.includes('doubledown'), 'the unlocked perk becomes draftable');
    },
  },
  {
    name: 'meta-reroll-charge',
    fn: (c, assert) => {
      c.fund(9999);
      assert(c.buyMeta('reroll') === true, 'a reroll pack is bought');
      const before = c.state().meta.rerolls;
      assert(before >= 1, 'reroll charges are banked');
      c.start(); c.seed(3); c.openDraft(); c.set({ draftArm: 0 });
      const s = c.reroll();
      assert(s.meta.rerolls === before - 1, 'a reroll spends exactly one charge');
      assert(c.draft().choices.length === 3, 'three cards remain after a reroll');
    },
  },
  {
    name: 'meta-banish',
    fn: (c, assert) => {
      c.fund(9999); c.buyMeta('banish');
      c.start(); c.seed(7); c.openDraft(); c.set({ draftArm: 0 });
      const banned = c.draft().choices[0];
      const s = c.banish(0);
      assert(s.meta.banishes === 0, 'banishing spends the token');
      assert(!c.draft().choices.includes(banned), 'the banished perk is no longer offered');
      assert(!s.meta.eligible.includes(banned), 'the banished perk leaves the pool for good');
    },
  },
  {
    name: 'starting-boon',
    fn: (c, assert) => {
      c.boon('lucky');
      const s = c.start();
      assert(s.perks.length === 1 && s.perks[0].id === 'lucky', 'the run begins with the boon perk');
      assert(s.mods.rollMult === 1.18, 'the boon effect is live from the first frame');
    },
  },
  {
    name: 'perk-overdrive',
    fn: (c, assert) => {
      c.start({ magnetR: 0 });
      assert(c.state().mods.speedMult === 1, 'speed starts unmodified');
      c.perk('overdrive');
      assert(Math.abs(c.state().mods.speedMult - 1.18) < 1e-9, 'Overdrive raises speedMult');
      const a = c.step(1).speed; c.perk('overdrive');
      const b = c.step(1).speed;
      assert(b > a, 'a second Overdrive stack rips even faster');
    },
  },
  {
    name: 'perk-hotstreak',
    fn: (c, assert) => {
      c.start(); c.set({ combo: 40 });
      const base = c.state().comboMult;                 // capped at COMBO_MAX (5)
      c.perk('hotstreak');
      assert(c.state().comboMult === base + 2, 'Hot Streak lifts the combo ceiling by 2');
    },
  },
  {
    name: 'curse-featherweight',
    fn: (c, assert) => {
      c.start();
      c.perk('featherweight');
      const m = c.state().mods;
      assert(Math.abs(m.floatMult - 0.45) < 1e-9, 'Featherweight floats you down softly');
      assert(m.extraJumpsBonus === -1, 'but costs you a mid-air jump');
    },
  },
  {
    name: 'greed-spawn-density',
    fn: (c, assert) => {
      // Force a fixed, seeded sequence of rows (no rendering) and count the rolls
      // that land — Greedy Gut's rollSpawnMult should produce more over the run.
      const rolls = (greed) => {
        c.start({ magnetR: 0 }); c.seed(99); c.set({ difficulty: 0.5 }); c.clearField();
        if (greed) c.perk('greedygut');
        for (let k = 0; k < 40; k++) c.spawnRow();
        return c.state().counts.rolls;
      };
      const base = rolls(false), greedy = rolls(true);
      assert(base > 0, 'rolls spawn in a normal run');
      assert(greedy > base, `Greedy Gut spawns more rolls over the run (base ${base}, greedy ${greedy})`);
    },
  },
  {
    name: 'daily-seeded-draft',
    fn: (c, assert) => {
      c.startDaily(); c.openDraft(); const a = c.draft().choices;
      c.startDaily(); c.openDraft(); const b = c.draft().choices;
      assert(a.length === 3, 'a daily draft offers three');
      assert(a.join(',') === b.join(','), 'a daily run is fully seeded — identical draft each time');
    },
  },
  {
    name: 'perk-tailwind',
    fn: (c, assert) => {
      c.start({ magnetR: 0 }); c.clearField();
      const m = c.perk('tailwind').mods;
      assert(Math.abs(m.speedMult - 1.08) < 1e-9, 'Tailwind raises speedMult to 1.08');
      assert(Math.abs(m.rollMult - 1.10) < 1e-9, 'Tailwind enriches rolls to 1.10');
      const fast = c.step(1).speed; c.start({ magnetR: 0 }); const slow = c.step(1).speed;
      assert(fast > slow, 'Tailwind actually makes the run faster');
      c.start({ magnetR: 0 }); c.clearField(); c.perk('tailwind');
      c.spawn('roll', 1, -4);
      const s = c.step(60);
      assert(s.rollCount === 1, 'the roll is collected');
      assert(s.rollPoints === Math.round(s.rollValue * 1.10), 'roll points are scaled by Tailwind');
    },
  },
  {
    name: 'perk-vacuum',
    fn: (c, assert) => {
      // An adjacent-lane roll is out of reach with no magnet, but Vacuum's +4
      // range tugs it across into the player's lane to be collected.
      const grab = (vac) => {
        c.start({ magnetR: 0 }); c.clearField();
        if (vac) { const m = c.perk('vacuum').mods; if (Math.abs(m.magnetBonus - 4) > 1e-9) throw new Error('magnetBonus'); }
        c.spawn('roll', 0, -6);                 // player in lane 1, roll one lane over
        return c.step(110).rollCount;
      };
      assert(grab(false) === 0, 'an adjacent-lane roll is missed without a magnet');
      assert(grab(true) === 1, 'Vacuum pulls the adjacent roll in to be grabbed');
    },
  },
  {
    name: 'perk-memory',
    fn: (c, assert) => {
      // Long Memory multiplies the combo window (2.6s) by 1.4. Read the live
      // comboTimer right after a fresh roll-bump: it must exceed the base window.
      const win = (mem) => {
        c.start({ magnetR: 0 }); c.clearField();
        if (mem) c.perk('memory');
        c.spawn('roll', 1, -3);
        const s = c.step(28);                   // just past the grab; window barely decayed
        return { rc: s.rollCount, ct: s.comboTimer };
      };
      const base = win(false), mem = win(true);
      assert(base.rc === 1 && mem.rc === 1, 'the roll is collected in both runs');
      assert(base.ct <= 2.6, 'the base combo window is the stock 2.6s');
      assert(mem.ct > 2.6, 'Long Memory stretches the combo window past 2.6s');
    },
  },
  {
    name: 'perk-daredevil',
    fn: (c, assert) => {
      // Jump an in-lane obstacle for a clean near-miss; Daredevil doubles its pay.
      const nm = (dd) => {
        c.start({ magnetR: 0 }); c.clearField();
        if (dd) c.perk('daredevil');
        c.spawn('cactus', 1, -5); c.jump();
        const s = c.step(60);
        return { st: s.state, rp: s.rollPoints };
      };
      const base = nm(false), big = nm(true);
      assert(base.st === 'playing' && big.st === 'playing', 'jumped clean over the obstacle in both');
      assert(base.rp > 0, 'a clean near-miss pays out');
      assert(big.rp === base.rp * 2, 'Daredevil doubles the near-miss payout');
    },
  },
  {
    name: 'perk-doubledown',
    fn: (c, assert) => {
      const pts = (dd) => {
        c.start({ magnetR: 0 }); c.clearField();
        if (dd) { const m = c.perk('doubledown').mods; if (m.rollX !== 2) throw new Error('rollX'); }
        c.spawn('roll', 1, -3);
        return c.step(40).rollPoints;
      };
      const base = pts(false), x2 = pts(true);
      assert(base > 0, 'a roll pays out normally');
      assert(x2 === base * 2, 'Double Down doubles roll points');
    },
  },
  {
    name: 'perk-secondwind',
    fn: (c, assert) => {
      // Spend both jumps, then grab a roll while still airborne. Second Wind
      // hands back a jump; without it you stay grounded-out at zero.
      const test = (sw) => {
        c.start({ magnetR: 0 }); c.clearField();
        if (sw) { const m = c.perk('secondwind').mods; if (!m.jumpOnRoll) throw new Error('jumpOnRoll'); }
        c.jump(); c.jump();                     // 2 base jumps spent, airborne, jumpsLeft 0
        c.spawn('roll', 1, -2);                 // close ahead — grab before landing
        const s = c.step(12);
        return { jl: s.jumpsLeft, air: !s.player.grounded, rc: s.rollCount };
      };
      const base = test(false), sw = test(true);
      assert(base.rc === 1 && sw.rc === 1, 'the roll is grabbed mid-air in both');
      assert(base.air && sw.air, 'still airborne when reading the jump count');
      assert(base.jl === 0, 'without Second Wind, a mid-air roll regains no jump');
      assert(sw.jl === 1, 'Second Wind hands a jump back on a mid-air roll');
    },
  },
  {
    name: 'perk-featherfall',
    fn: (c, assert) => {
      // Featherfall softens the rise gravity, so a jump floats higher/longer.
      const peak = (ff) => {
        c.start({ magnetR: 0 }); c.clearField();
        if (ff) { const m = c.perk('featherfall').mods; if (Math.abs(m.floatMult - 0.5) > 1e-9) throw new Error('floatMult'); }
        c.jump(); let max = 0;
        for (let i = 0; i < 40; i++) max = Math.max(max, c.step(1).player.groundY);
        return max;
      };
      const base = peak(false), floaty = peak(true);
      assert(base > 0, 'a normal jump leaves the ground');
      assert(floaty > base, 'Featherfall gives a floatier, higher hop');
    },
  },
  {
    name: 'perk-pillow-cushion',
    fn: (c, assert) => {
      // Pillow Stack is a one-shot cushion grant — it stacks on a bought Cushion.
      c.boon('pillow');
      let s = c.start();
      assert(s.perks.length === 1 && s.perks[0].id === 'pillow', 'the boon perk is drafted at run start');
      assert(s.shields === 1, 'Pillow Stack begins the run with a cushion');
      c.fund(1000); c.buy('shield');            // +1 permanent cushion
      s = c.start();
      assert(s.shields === 2, 'Pillow adds its cushion on top of the bought Cushion');
    },
  },
  {
    name: 'meta-unlock-every-perk',
    fn: (c, assert) => {
      // Every non-default perk must be purchasable and land in the draft pool.
      c.fund(99999);
      const nonDefault = ['doubledown', 'glasscannon', 'greedygut', 'featherfall', 'secondwind', 'overdrive', 'hotstreak', 'featherweight'];
      for (const id of nonDefault) {
        assert(!c.state().meta.eligible.includes(id), id + ' starts locked out of the pool');
        assert(c.buyMeta('unlock:' + id) === true, 'unlock:' + id + ' is purchasable');
        assert(c.state().meta.eligible.includes(id), id + ' becomes draftable once unlocked');
      }
    },
  },
  {
    name: 'upgrade-tiers-max-out',
    fn: (c, assert) => {
      // Both floor upgrades climb to their cap, then refuse further purchase.
      c.fund(99999);
      assert(c.buy('shield') && c.buy('shield') && c.buy('shield'), 'Cushion buys up through tier 3');
      assert(c.buy('shield') === false, 'a maxed Cushion can not be bought again');
      assert(c.effects().shields === 3, 'a maxed Cushion resolves to 3 shields');
      assert(c.buy('headstart') && c.buy('headstart') && c.buy('headstart'), 'Head Start buys up through tier 3');
      assert(c.buy('headstart') === false, 'a maxed Head Start can not be bought again');
      assert(c.start().level === 4, 'a maxed Head Start starts the run on level 4');
    },
  },
  {
    name: 'daily-ignores-perks-and-boon',
    fn: (c, assert) => {
      c.boon('lucky'); c.fund(9999); c.buyMeta('unlock:doubledown');
      const s = c.startDaily();
      assert(s.daily === true, 'a daily run is flagged');
      assert(s.perks.length === 0, 'daily ignores the starting boon');
      assert(s.mods.rollMult === 1, 'no perk mods at a daily start');
      assert(!s.meta.eligible.includes('doubledown'), 'daily drafts the default pool, not meta unlocks');
      assert(s.meta.eligible.length === 7, 'daily pool is the seven-perk default');
    },
  },
  {
    // UX: achievements earned in a run are celebrated *in place* on the
    // game-over card (a glowing badge + a "new" count) rather than via a
    // floating toast that used to cover the "Wiped out!" title.
    name: 'achievement-celebrated-on-card',
    fn: (c, assert) => {
      c.fresh();                              // clean save, back on the menu
      c.start(); c.step(60); c.over();        // finishing run unlocks "Off and Running"
      assert(c.state().state === 'over', 'lands on the game-over screen');
      assert(!document.getElementById('achToast'), 'the old floating toast element is gone');
      const glow = document.querySelector('#gameover .achievements .ach.justnew');
      assert(!!glow, 'newly-earned badge is highlighted on the card');
      assert(!!document.querySelector('#gameover .achievements .wallet.pop'), 'card flags the new-unlock count');
    },
  },
  {
    // Meta/economy: earning a badge pays a one-time roll reward straight into the
    // shop wallet, on top of the rolls grabbed during the run — and only once.
    name: 'achievement-reward-banked',
    fn: (c, assert) => {
      c.fresh();
      const before = c.wallet();
      c.start({ magnetR: 0 }); c.clearField(); c.step(30);
      const rolls = c.state().rollCount;
      c.over();                                  // finishing run 1 unlocks "Off and Running" (reward 25)
      assert(c.wallet() === before + rolls + 25, 'the First badge banks its 25-roll reward on top of grabbed rolls');
      const after = c.wallet();
      c.start({ magnetR: 0 }); c.clearField(); c.step(30);
      const rolls2 = c.state().rollCount;
      c.over();                                  // run 2 earns no new badge
      assert(c.wallet() === after + rolls2, 'an already-earned badge does not pay out a second time');
    },
  },
  {
    // Difficulty/pacing: the ladder is spaced across many runs, not front-loaded.
    // A single short run earns only the starter badge — the deep/lifetime badges
    // stay locked so there's always somewhere to climb.
    name: 'achievement-spacing',
    fn: (c, assert) => {
      c.fresh();
      c.start(); c.step(45); c.over();
      const on = [...document.querySelectorAll('#gameover .achievements .ach.on .achn')].map(e => e.textContent);
      assert(on.includes('Off and Running'), 'the first run earns the starter badge');
      assert(!on.includes('Getting Warm'), 'the 10-run badge stays locked after a single run');
      assert(!on.includes('Marathon Cheeks'), 'the lifetime-distance badge stays locked after one short run');
      assert(!on.includes('Unstoppable'), 'the level-10 badge stays locked on a shallow run');
      assert(!on.includes('Cheek Legend'), 'the 5,000-score badge stays locked on a short run');
    },
  },
  {
    // Lifetime grinds fill in only over a career: a big banked run pushes total
    // distance/rolls past the low tiers but not the high ones.
    name: 'achievement-lifetime-grind',
    fn: (c, assert) => {
      c.fresh();
      c.start(); c.set({ distance: 12000, rollCount: 3000 }); c.over();  // banks 12 km + 3000 rolls into lifetime stats
      const on = [...document.querySelectorAll('#gameover .achievements .ach.on .achn')].map(e => e.textContent);
      assert(on.includes('Marathon Cheeks'), '10 km lifetime distance unlocks Marathon Cheeks');
      assert(on.includes('Stockpiler'), '2,500 lifetime rolls unlocks Stockpiler');
      assert(!on.includes('Globe Cheeks'), 'the 50 km badge is still locked at 12 km');
      assert(!on.includes('Roll Tycoon'), 'the 10,000-roll badge is still locked at 3,000');
    },
  },
  {
    // Multi-run badge: ten finished runs (regardless of how far each got) unlock
    // the run-count milestone — a goal that can only be reached across sessions.
    name: 'achievement-run-count',
    fn: (c, assert) => {
      c.fresh();
      for (let i = 0; i < 9; i++) { c.start(); c.over(); }
      let on = [...document.querySelectorAll('#gameover .achievements .ach.on .achn')].map(e => e.textContent);
      assert(!on.includes('Getting Warm'), 'nine runs is not yet enough for the 10-run badge');
      c.start(); c.over();                                        // the tenth run
      on = [...document.querySelectorAll('#gameover .achievements .ach.on .achn')].map(e => e.textContent);
      assert(on.includes('Getting Warm'), 'the tenth finished run unlocks the 10-run badge');
    },
  },
  {
    // Clarity: every locked badge spells out its goal and draws a live "cur / goal"
    // progress bar, so it's obvious what to do and how close you are — no hovering.
    name: 'achievement-progress-shown',
    fn: (c, assert) => {
      c.fresh();
      c.start(); c.set({ distance: 3000, rollCount: 500 }); c.over();   // 30% of the way to the 10 km badge
      const cells = [...document.querySelectorAll('#gameover .achievements .ach:not(.on)')];
      const marathon = cells.find(el => el.querySelector('.achn')?.textContent === 'Marathon Cheeks');
      assert(!!marathon, 'the distance badge is present and still locked at 3 km');
      assert(/\/\s*10k/.test(marathon.querySelector('.achp').textContent), 'its label spells out the goal (… / 10k m)');
      const w = parseFloat(marathon.querySelector('.achbar i').style.width);
      assert(w > 0 && w < 100, 'the progress bar is partly filled toward the goal');
    },
  },
  {
    // Feedback: earning a badge fires a flashy post-run unlock fanfare that names
    // the badge and tells you the rolls banked this run, then taps away.
    name: 'achievement-unlock-fanfare',
    fn: (c, assert) => {
      c.fresh();
      c.start(); c.set({ rollCount: 40 }); c.over();     // first run unlocks "Off and Running"
      const pop = document.getElementById('achUnlock');
      assert(!pop.classList.contains('hide'), 'the unlock fanfare pops up after a badge is earned');
      assert(!!pop.querySelector('.ubadge'), 'it lists the earned badge');
      assert(/\b40\b/.test(document.getElementById('unlockRolls').textContent), 'it reports the rolls banked this run');
      document.getElementById('unlockBtn').click();
      assert(pop.classList.contains('hide'), 'tapping through hides the fanfare');
    },
  },
  {
    // Meta/economy: the floor upgrades climb past the old tier-3 cap into
    // "prestige" tiers, each fenced behind a skill milestone so the wallet always
    // has somewhere to go — but only once the milestone is actually reached.
    name: 'prestige-tiers-gated',
    fn: (c, assert) => {
      c.fresh(); c.fund(99999);
      assert(c.buy('shield') && c.buy('shield') && c.buy('shield'), 'Cushion climbs to tier 3');
      assert(c.buy('shield') === false, 'tier 4 is fenced until its skill gate is met');
      assert(c.effects().shields === 3, 'still 3 shields while the prestige tier is locked');
      c.start(); c.set({ level: 13 }); c.over();  // bank a deep run into lifetime maxLevel
      assert(c.state().stats.maxLevel >= 12, 'the deep run is recorded in lifetime stats');
      assert(c.buy('shield') === true, 'tier 4 unlocks once Lv 12 is reached');
      assert(c.effects().shields === 4, 'the prestige tier resolves to 4 shields');
      assert(c.buy('shield') === false, 'tier 5 stays fenced behind its own deeper gate (Lv 18)');
    },
  },
  {
    // Retention: the game-over card surfaces concrete "you did this" beats, and
    // every run is logged to a capped recent-run trend strip.
    name: 'highlight-strip-and-history',
    fn: (c, assert) => {
      c.fresh();
      c.start(); c.set({ level: 3 }); c.over();
      let s = c.state();
      assert(Array.isArray(s.lastRun.highlights), 'the run exposes a highlight strip');
      assert(s.lastRun.highlights.some(h => h.includes('reached')), 'reaching a new biome is a highlight');
      assert(!document.getElementById('goHighlights').classList.contains('hide'), 'the highlight strip is shown on the card');
      assert(s.history.length === 1 && s.history[0].level === 3, 'the run is logged to history with its level');
      for (let i = 0; i < 16; i++) { c.start(); c.over(); }   // overflow the window
      assert(c.state().history.length === 14, 'history caps at the most recent 14 runs');
    },
  },
  {
    // Game feel: a jump pressed with no jumps left (just before touchdown) is
    // buffered and fires the instant you land, so chained hops aren't dropped.
    name: 'jump-buffer',
    fn: (c, assert) => {
      c.start({ magnetR: 0 }); c.clearField();
      c.jump(); c.jump();                              // both jumps spent, airborne
      let s = c.state();
      assert(s.jumpsLeft === 0 && !s.player.grounded, 'both jumps spent and airborne');
      // Let the hop peak, then fall until descending and just above the ground
      // (loop capped so it can't hang).
      let peaked = false;
      for (let i = 0; i < 120; i++) { s = c.step(1); const g = s.player.groundY; if (g > 0.6) peaked = true; if (peaked && !s.player.grounded && g < 0.4) break; }
      assert(!s.player.grounded, 'still airborne just before touchdown');
      c.jump();                                        // pressed within the buffer window
      assert(c.state().jumpBufferT > 0, 'a jump with none left is buffered, not dropped');
      s = c.step(6);                                   // land — the buffered hop should fire
      assert(!s.player.grounded, 'the buffered jump auto-fires on landing (airborne again)');
      assert(s.jumpsLeft === 1, 'touchdown refilled two jumps; the buffered hop spent one');
    },
  },
  {
    // Lateral near-miss ("skim"): dodging an in-lane obstacle by lane-changing
    // past it at the last moment pays a bonus and feeds the combo — rewarding the
    // skill expression that side-stepping used to earn nothing for.
    name: 'near-miss-skim',
    fn: (c, assert) => {
      c.start({ magnetR: 0 }); c.clearField();
      c.spawn('cactus', 1, -6);                        // dead ahead in the player's lane
      c.left();                                        // dodge left — registers the lane change
      const s = c.step(70);
      assert(s.state === 'playing', 'the lateral dodge avoids the crash');
      assert(s.laneIdx === 0, 'now in the left lane');
      assert(s.rollPoints > 0, 'skimming past the obstacle pays a lateral near-miss bonus');
      assert(s.combo >= 1, 'a skim feeds the combo');
      // Parking in a lane with no recent dodge earns nothing.
      c.start({ magnetR: 0 }); c.clearField();
      c.left();                                        // move first...
      c.step(40);                                      // ...let the dodge window lapse
      c.spawn('cactus', 1, -6);                        // obstacle one lane over, no fresh dodge
      const t = c.step(70);
      assert(t.rollPoints === 0, 'idling one lane over (no recent dodge) earns no skim');
    },
  },
  {
    // Flow scoring: a hot combo drips bonus score as you run, so greedy chained
    // play out-scores cautious play — without changing distance/leveling.
    name: 'combo-flow-scoring',
    fn: (c, assert) => {
      c.start({ magnetR: 0 }); c.clearField();
      const cold = c.step(120);
      c.start({ magnetR: 0 }); c.clearField(); c.set({ combo: 20 });
      const hot = c.step(120);
      assert(hot.comboMult > 1, 'the multiplier is above 1 while hot');
      assert(hot.rollPoints > cold.rollPoints, 'a hot combo accrues bonus flow score over the same run');
      assert(Math.abs(hot.distance - cold.distance) < 1, 'distance/leveling is untouched — only score flows faster');
    },
  },
  {
    // Compound rows: once the run heats up, the guaranteed-open lane sometimes
    // also carries a clearable hazard, demanding a lane-change AND a jump/duck.
    name: 'compound-rows',
    fn: (c, assert) => {
      c.start({ magnetR: 0 }); c.seed(5); c.set({ difficulty: 0.1 }); c.clearField();
      for (let k = 0; k < 40; k++) c.spawnRow();
      assert(c.state().safeHazards === 0, 'no compound hazards before the run heats up');
      c.start({ magnetR: 0 }); c.seed(5); c.set({ difficulty: 0.9 }); c.clearField();
      for (let k = 0; k < 40; k++) c.spawnRow();
      assert(c.state().safeHazards > 0, 'compound rows seed a safe-lane hazard at high difficulty');
    },
  },
  {
    // Hit-stop: a shield save briefly freezes the world so the impact reads.
    name: 'hit-stop-on-shield',
    fn: (c, assert) => {
      c.start({ magnetR: 0 }); c.set({ shields: 1 }); c.clearField();
      c.spawn('cactus', 1, -3);
      let s; for (let i = 0; i < 40; i++) { s = c.step(1); if (s.shields === 0) break; }
      assert(s.shields === 0, 'the shield absorbed the hit');
      assert(s.hitStopT > 0, 'the save triggers a hit-stop freeze');
      const d0 = s.distance;
      s = c.step(1);
      assert(Math.abs(s.distance - d0) < 0.01, 'the world holds still during the freeze');
    },
  },
  {
    // New personal best is celebrated, not silent — the strongest "one more run" hook.
    name: 'new-best-celebrated',
    fn: (c, assert) => {
      c.fresh();
      c.start(); c.set({ distance: 600, rollPoints: 0 }); c.over();
      assert(c.state().state === 'over', 'the run ended');
      assert(document.getElementById('goTitle').textContent === 'New Best!', 'beating the record flips the title');
      assert(document.getElementById('gameover').classList.contains('newbest'), 'the card gets the new-best treatment');
      assert(/old best|first record/.test(document.getElementById('bestLine').textContent), 'the best line celebrates the record');
      c.start(); c.set({ distance: 100, rollPoints: 0 }); c.over();
      assert(document.getElementById('goTitle').textContent === 'Wiped out!', 'a sub-best run shows the normal title');
      assert(!document.getElementById('gameover').classList.contains('newbest'), 'no new-best treatment on a sub-best run');
    },
  },
  {
    // Adaptive music: the soundtrack intensity rises with pace and combo heat.
    name: 'music-intensity-adapts',
    fn: (c, assert) => {
      c.start({ magnetR: 0 }); c.clearField();
      const slow = c.step(2).musicIntensity;
      c.set({ combo: 20 }); const hot = c.step(2).musicIntensity;
      assert(hot > slow, 'a hot combo lifts the music intensity');
      c.start({ magnetR: 0 }); c.set({ elapsed: 100 }); const fast = c.step(2).musicIntensity;
      assert(fast > slow, 'a faster run lifts the music intensity');
    },
  },
  {
    // The score HUD catches fire as the score climbs faster: raw pace and a hot
    // combo both lift `scoreHeat` (0..1), which drives the glow/flames/shake.
    name: 'score-heat-on-fire',
    fn: (c, assert) => {
      c.start({ magnetR: 0 }); c.clearField();
      const cold = c.step(4).scoreHeat;
      assert(cold < 0.2, `a fresh, slow run keeps the score cool (${cold})`);
      c.set({ combo: 40, comboTimer: 99 }); const hotCombo = c.step(40).scoreHeat;
      assert(hotCombo > cold + 0.1, `a hot combo sets the score alight (${cold} → ${hotCombo})`);
      c.start({ magnetR: 0 }); c.clearField(); c.set({ elapsed: 200 });
      const fast = c.step(40).scoreHeat;
      assert(fast > cold + 0.1, `a fast run heats the score (${cold} → ${fast})`);
      assert(hotCombo <= 1.0001 && fast <= 1.0001, 'heat stays within 0..1');
    },
  },
  {
    // Un-capped difficulty: warm-up difficulty plateaus at ~70s, so `heat` keeps
    // creeping with the level. A deep run packs denser rows at the SAME difficulty.
    name: 'heat-escalates-density',
    fn: (c, assert) => {
      const dens = (lvl) => {
        c.start({ magnetR: 0 }); c.seed(123); c.set({ level: lvl, difficulty: 0.5 }); c.clearField();
        for (let k = 0; k < 80; k++) c.spawnRow();
        return c.state().counts.obstacles;
      };
      const low = dens(1), high = dens(16);
      assert(low > 0, 'obstacles spawn on the opening level');
      assert(high > low, `a deep level packs more hazards at equal difficulty (lvl1 ${low}, lvl16 ${high})`);
    },
  },
  {
    // The combo multiplier ceiling was raised from 5 to 8 so the streak stays a chase.
    name: 'combo-ceiling-raised',
    fn: (c, assert) => {
      c.start();
      c.set({ combo: 16 }); assert(c.state().comboMult === 5, 'a 16-grab streak is x5 (the old cap)');
      c.set({ combo: 20 }); assert(c.state().comboMult === 6, 'it now keeps climbing past the old ceiling');
      c.set({ combo: 28 }); assert(c.state().comboMult === 8, 'the multiplier reaches the new x8 ceiling');
    },
  },
  {
    // Phoenix: a hot streak banks a once-per-run save that cheats one fatal hit.
    name: 'phoenix-comeback',
    fn: (c, assert) => {
      c.start({ magnetR: 0 }); c.clearField();
      assert(c.state().phoenix === false, 'no phoenix at run start');
      c.set({ combo: 20 });
      let s = c.step(1);
      assert(s.phoenix === true, 'a hot enough streak arms the phoenix save');
      c.spawn('cactus', 1, -4);                         // dead ahead — normally fatal
      s = c.step(60);
      assert(s.state === 'playing', 'the phoenix cheats the fatal hit instead of ending the run');
      assert(s.phoenix === false && s.phoenixUsed === true, 'the save is spent — strictly once per run');
      c.set({ invuln: 0 }); c.spawn('cactus', 1, -4);
      s = c.step(60);
      assert(s.state === 'over', 'with the phoenix spent, the next hit ends the run');
    },
  },
  {
    // Keystone perk Perfectionist: rolls stop feeding the combo (near-misses must),
    // and near-misses pay triple — a dodge-focused build.
    name: 'keystone-perfectionist',
    fn: (c, assert) => {
      c.start({ magnetR: 0 }); c.clearField();
      const s1 = c.perk('perfectionist');
      assert(s1.mods.rollsNoCombo === true, 'Perfectionist stops rolls feeding the combo');
      assert(s1.mods.nearMissMult === 3, 'and triples near-miss pay');
      c.spawn('roll', 1, -4);
      const s = c.step(60);
      assert(s.rollCount === 1, 'the roll is still collected');
      assert(s.combo === 0, 'but it builds no combo (only dodges do)');
    },
  },
  {
    // Keystone perk Magpie: roll value snowballs with rolls already grabbed this run.
    name: 'keystone-magpie',
    fn: (c, assert) => {
      const grab = (n) => {
        c.start({ magnetR: 0 }); c.clearField(); const m = c.perk('magpie').mods;
        if (!(m.greedScale > 0)) throw new Error('greedScale');
        c.set({ rollCount: n }); c.spawn('roll', 1, -4);
        return c.step(60).rollPoints;
      };
      const early = grab(0), late = grab(80);
      assert(early > 0, 'an early roll pays out normally');
      assert(late > early, `Magpie makes later rolls worth more (early ${early}, late ${late})`);
    },
  },
  {
    // Keystone curse All In: triple rolls, but no cushions and a denser hazard field.
    name: 'curse-allin',
    fn: (c, assert) => {
      c.start({ magnetR: 0 }); c.set({ shields: 2 }); c.clearField();
      const s1 = c.perk('allin');
      assert(s1.mods.rollX === 3, 'All In triples roll value');
      assert(s1.mods.noShields === true, 'All In runs you bare — cushions are disabled');
      assert(Math.abs(s1.mods.obstacleMult - 1.4) < 1e-9, 'and packs the hazard field denser');
      c.spawn('cactus', 1, -4);
      assert(c.step(60).state === 'over', 'with cushions off a hit ends the run despite owning shields');
    },
  },
  {
    // Biomes are mechanically distinct now, not just recolored: each tweaks spawn
    // character and its fog band (sight distance / mood).
    name: 'biome-character',
    fn: (c, assert) => {
      c.start();                                        // Meadow
      const meadow = c.state();
      assert(meadow.biomePlay.gateBias === 1 && meadow.biomePlay.rollBias === 1, 'Meadow is the neutral baseline');
      c.set({ level: 2 });                              // Sunset
      assert(c.state().biomePlay.gateBias === 1.5, 'Sunset throws more full-width gates');
      c.set({ level: 3 });                              // Twilight
      const tw = c.state();
      assert(tw.biomePlay.hazardBias === 1.25, 'Twilight packs more compound hazards');
      assert(tw.fog.near < meadow.fog.near, 'Twilight pulls the fog in — hazards loom later');
      c.set({ level: 4 });                              // Candyland
      assert(c.state().biomePlay.rollBias === 1.4, 'Candyland showers rolls');
    },
  },
  {
    // A new personal best fires the level-up shockwave ring... actually, level-ups do:
    // a big-moment beat the player can feel, not just a particle puff.
    name: 'level-up-shockwave',
    fn: (c, assert) => {
      c.start(); c.forceFinish();
      let s; for (let i = 0; i < 40; i++) { s = c.step(5); if (s.level === 2) break; }   // cross into level 2
      assert(s.level === 2, 'crossed into level 2');
      assert(s.ringT > 0, 'a level-up fires the expanding shockwave ring');
    },
  },
  {
    // Slow-mo on a hot near-miss now triggers from x2 (was x3), so it actually fires.
    name: 'slowmo-on-hot-nearmiss',
    fn: (c, assert) => {
      c.start({ magnetR: 0 }); c.clearField(); c.set({ combo: 8 });   // multiplier x3 (>= the x2 gate)
      c.spawn('cactus', 1, -5); c.jump();
      let maxSlow = 0, s;
      for (let i = 0; i < 70; i++) { s = c.step(1); maxSlow = Math.max(maxSlow, s.slowmoT); }
      assert(s.state === 'playing', 'jumped clean over the obstacle');
      assert(maxSlow > 0, 'a hot near-miss dilates time with the lowered threshold');
    },
  },
  {
    // Daily return streak: completing the daily on consecutive days builds a streak;
    // a missed day resets it to 1. (Driven via explicit day keys so it's testable.)
    name: 'daily-streak',
    fn: (c, assert) => {
      c.fresh();
      assert(c.state().dailyStreak === 0, 'no streak before any daily');
      assert(c.dailyResult('2026-03-01', 100).streak === 1, 'the first daily starts a 1-day streak');
      assert(c.dailyResult('2026-03-02', 120).streak === 2, 'a next-day daily extends it');
      assert(c.dailyResult('2026-03-03', 90).streak === 3, 'and again the day after');
      assert(c.dailyResult('2026-03-06', 200).streak === 1, 'a skipped day resets the streak to 1');
    },
  },
  {
    // Speed-aware lane snap: at a fast pace the dodge settles into the target lane
    // within a few frames (and hard-snaps the residual), so a late lane-change
    // keeps pace with the world instead of feeling like it clips.
    name: 'lane-snap-speed-aware',
    fn: (c, assert) => {
      c.start({ magnetR: 0 }); c.clearField();
      c.set({ elapsed: 200, level: 5 });              // a genuinely fast, deep run (speed is recomputed each tick)
      c.left();                                       // dodge to the left lane
      assert(c.state().laneIdx === 0, 'the lane index flips immediately on input');
      const s = c.step(16);                           // settle
      assert(Math.abs(s.player.x - s.targetX) < 0.001, 'the body fully reaches the lane (hard-snapped, no asymptotic residual)');
    },
  },
  {
    // Forgiving forward-biased hitbox: an obstacle whose centre has already passed
    // the player no longer reaches back to clip them — clearing it by a lane change
    // right as it goes by survives, where the old symmetric box could still hit.
    name: 'forgiving-hitbox',
    fn: (c, assert) => {
      c.start({ magnetR: 0 }); c.clearField();
      // Park an obstacle just behind the player (centre already passed): the old
      // ±0.8 box would still register; the forward-biased one must not.
      c.spawn('cactus', 1, 0.62);                     // sz ≈ +0.62, centre already behind the player
      const s = c.step(1);                            // old ±0.8 box would still register here
      assert(s.state === 'playing', 'a hazard already past the player does not clip from behind');
    },
  },
  {
    // Tight near-miss micro-reward: a clean thread right through a hazard's lane
    // dilates time briefly even with NO combo going, so the most skilful moment
    // always lands feedback — not only the optimised chain.
    name: 'slowmo-on-tight-nearmiss',
    fn: (c, assert) => {
      c.start({ magnetR: 0 }); c.clearField();        // combo starts at 0 (multiplier x1)
      c.spawn('cactus', 1, -5); c.jump();             // thread straight over it
      let maxSlow = 0, s;
      for (let i = 0; i < 70; i++) { s = c.step(1); maxSlow = Math.max(maxSlow, s.slowmoT); }
      assert(s.state === 'playing', 'jumped clean over the obstacle');
      assert(s.comboMult === 1, 'no combo multiplier was running');
      assert(maxSlow > 0, 'a tight clean thread still dilates time without a combo');
    },
  },
  {
    // Combo decay grace: when the window lapses the multiplier steps DOWN one tier
    // and refreshes, instead of nuking the whole streak — a missed pickup bleeds
    // momentum rather than ending it. A long streak survives a single lapse.
    name: 'combo-decay-grace',
    fn: (c, assert) => {
      c.start({ magnetR: 0 }); c.clearField();
      // Arm a near-expired window on a healthy streak; lapsing it should step the
      // multiplier DOWN one tier (−COMBO_STEP) and grant a fresh window — not reset.
      const lapse = () => { c.set({ comboTimer: 0.05 }); return c.step(6, 1 / 60); };  // a few frames clears the sliver
      c.set({ combo: 10 });
      let s = lapse();
      assert(s.combo === 6, 'one missed window steps the streak down exactly one tier, not to 0');
      assert(s.comboTimer > 2, 'and a fresh window is granted at the lower tier');
      s = lapse();
      assert(s.combo === 2, 'a second lapse steps down again — momentum bleeds, it does not vanish');
      s = lapse();
      assert(s.combo === 0, 'once it falls below a tier the streak finally clears');
    },
  },
  {
    // Row-spacing floor: deep in a run the gap between obstacle rows never drops
    // below a human-fair threshold, even at max difficulty and a high level.
    name: 'row-gap-floored',
    fn: (c, assert) => {
      // `rowGap` is the live seconds-between-rows the loop computes each tick.
      // Early on it's generous; very deep (maxed difficulty + high level) the raw
      // formula would dip under the human-fair floor, so it clamps to 0.42s.
      c.start({ magnetR: 0 }); c.clearField();
      c.set({ elapsed: 0, level: 1 });                // warm-up (difficulty is recomputed from elapsed)
      const easy = c.step(1).rowGap;
      assert(easy > 0.42, `early rows are spaced out (gap ${easy}s, well above the floor)`);
      c.set({ elapsed: 300, level: 41 });             // maxed pace, very deep — raw gap would dip under the floor
      const deep = c.step(1).rowGap;
      assert(deep === 0.42, `the row gap is floored at 0.42s deep in a run (got ${deep})`);
    },
  },
  {
    // Gate → compound guard: a full-width gate is never immediately followed by a
    // compound (safe-lane) hazard, so a gate's jump/duck recovery never stacks onto
    // a same-beat lane-change-and-clear. Force a gate, then watch the next rows.
    name: 'no-compound-right-after-gate',
    fn: (c, assert) => {
      // Baseline: at this difficulty compound (safe-lane) hazards are common.
      c.start({ magnetR: 0 }); c.seed(5); c.set({ difficulty: 1, level: 6 }); c.clearField();
      for (let k = 0; k < 40; k++) c.spawnRow();
      assert(c.state().safeHazards > 0, 'compounds do spawn at this difficulty with no cooldown');
      // Hold a gate's cooldown open (re-arm forcedGap each row): not a single
      // compound seeds while it's active, so a gate never stacks onto a compound.
      c.start({ magnetR: 0 }); c.seed(5); c.set({ difficulty: 1, level: 6 }); c.clearField();
      for (let k = 0; k < 40; k++) { c.set({ forcedGap: 3 }); c.spawnRow(); }
      assert(c.state().safeHazards === 0, 'no compound hazard spawns while a gate cooldown is active');
    },
  },
  {
    // "So close" framing: a run that falls just short of the best gets its own
    // hook ("just N from your best") instead of a flat "Best: N".
    name: 'so-close-game-over',
    fn: (c, assert) => {
      c.fresh();
      c.start(); c.set({ distance: 1000, rollPoints: 0 }); c.over();   // set a best of ~1000
      c.start(); c.set({ distance: 970, rollPoints: 0 }); c.over();    // within 10% of it
      const lr = c.state().lastRun;
      assert(lr && lr.soClose === true && lr.isBest === false, 'a near-best run is flagged so-close');
      assert(/So close/.test(document.getElementById('bestLine').textContent), 'the best line shows the so-close hook');
      c.start(); c.set({ distance: 200, rollPoints: 0 }); c.over();    // well short
      assert(c.state().lastRun.soClose === false, 'a run far from best is not flagged so-close');
      assert(/Best:/.test(document.getElementById('bestLine').textContent), 'and falls back to the plain best line');
    },
  },
  {
    // Smoother difficulty ramp: difficulty now eases to full over ~90s (was 70),
    // so the early seconds are gentler — at 70s in it is no longer maxed.
    name: 'difficulty-ramp-eased',
    fn: (c, assert) => {
      c.start({ magnetR: 0 }); c.clearField();
      c.set({ elapsed: 70 }); const mid = c.step(1).difficulty;
      assert(mid < 1, 'at 70s the warm-up is no longer maxed (gentler early curve)');
      c.set({ elapsed: 95 }); const late = c.step(1).difficulty;
      assert(late === 1, 'it still reaches full difficulty by ~90s');
    },
  },
  {
    // Verticality — TALL obstacles: a single hop (apex ~1.9) can't clear one, so
    // jumping *over* it demands a well-timed double-jump. A normal obstacle still
    // clears on one hop, so the height is a real graded read, not a blanket nerf.
    name: 'tall-obstacle-needs-double-jump',
    fn: (c, assert) => {
      c.start({ magnetR: 0 }); c.clearField();
      c.spawn('cactus', 1, -5);                        // normal height, dead ahead
      c.jump();
      assert(c.step(60).state === 'playing', 'a single hop still clears a normal obstacle');

      c.start({ magnetR: 0 }); c.clearField();
      c.spawn('cactus', 1, -5, true);                  // TALL, dead ahead
      c.jump();                                        // one hop only
      assert(c.step(60).state === 'over', 'a single hop cannot clear a tall obstacle');

      c.start({ magnetR: 0 }); c.clearField();
      c.spawn('cactus', 1, -5, true);
      c.jump(); c.step(8); c.jump();                   // a timed double-jump reaches higher
      assert(c.step(60).state === 'playing', 'a well-timed double-jump clears the tall obstacle');
    },
  },
  {
    // Verticality — spawner phases tall variants in only once the run heats up,
    // and never as a full-width gate, so side-stepping stays a fair dodge.
    name: 'tall-obstacles-phase-in-with-heat',
    fn: (c, assert) => {
      c.start({ magnetR: 0 }); c.seed(7); c.set({ difficulty: 0.05 }); c.clearField();
      for (let k = 0; k < 40; k++) c.spawnRow();
      assert(c.state().counts.tallObstacles === 0, 'no tall obstacles before the run warms up');
      c.start({ magnetR: 0 }); c.seed(7); c.set({ difficulty: 0.95 }); c.clearField();
      for (let k = 0; k < 40; k++) c.spawnRow();
      assert(c.state().counts.tallObstacles > 0, 'tall obstacles appear once heat is high');
    },
  },
  {
    // Verticality — aerial rolls: a roll floating at a height is only grabbable
    // while airborne at its level. A grounded run passes under it; a jump scoops it.
    name: 'aerial-roll-needs-air',
    fn: (c, assert) => {
      c.start({ magnetR: 0 }); c.clearField();
      c.spawn('roll', 1, -5, 1.6);                     // elevated roll, needs a jump
      const g = c.step(60);
      assert(g.rollCount === 0, 'a grounded run passes under an elevated roll');

      c.start({ magnetR: 0 }); c.clearField();
      c.spawn('roll', 1, -5, 1.6);
      c.jump();                                        // rise up to its height
      const a = c.step(60);
      assert(a.rollCount === 1, 'jumping up to the roll grabs it');

      // A ground roll (h = 0) still grabs exactly as before — including mid-hop.
      c.start({ magnetR: 0 }); c.clearField();
      c.spawn('roll', 1, -5);                          // no height arg → ground roll
      c.jump();
      assert(c.step(60).rollCount === 1, 'a ground roll still grabs (height gate only affects elevated rolls)');
    },
  },
  {
    // Verticality — air ribbons: arcs of elevated rolls appear in an open lane
    // once the run heats up, a pure bonus you scoop by jumping.
    name: 'air-ribbons-spawn',
    fn: (c, assert) => {
      c.start({ magnetR: 0 }); c.seed(3); c.set({ difficulty: 0.05 }); c.clearField();
      for (let k = 0; k < 60; k++) c.spawnRow();
      assert(c.state().counts.airRolls === 0, 'no air ribbons before the run warms up');
      c.start({ magnetR: 0 }); c.seed(3); c.set({ difficulty: 0.9 }); c.clearField();
      let found = false;
      for (let k = 0; k < 60; k++) { c.spawnRow(); if (c.state().counts.airRolls > 0) { found = true; break; } }
      assert(found, 'air ribbons of elevated rolls appear once the run heats up');
    },
  },
  {
    // Verticality — air-time bonus: reaching real height (double-jump territory)
    // pays out on landing, scaled by peak height; a small single hop pays nothing.
    name: 'air-bonus-on-big-hop',
    fn: (c, assert) => {
      c.start({ magnetR: 0 }); c.clearField();
      c.jump();                                        // single hop, apex below the threshold
      let s; for (let i = 0; i < 80; i++) { s = c.step(1); if (s.player.grounded && i > 5) break; }
      assert(s.rollPoints === 0, 'a small single hop is below the air-bonus threshold');

      c.start({ magnetR: 0 }); c.clearField();
      c.jump(); c.step(8); c.jump();                   // a big double-jump
      let max = 0, s2; for (let i = 0; i < 120; i++) { s2 = c.step(1); if (s2.airPeak > max) max = s2.airPeak; if (s2.player.grounded && i > 30) break; }
      assert(max >= 2.0, 'a double-jump reaches real height');
      assert(s2.rollPoints > 0, 'landing a big hop pays an air bonus');
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

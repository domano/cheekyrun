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
      c.start(); c.set({ distance: 248 });        // just shy of the level-2 boundary
      s = c.step(20);                             // cross it, then check the twirl is underway
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
      c.start(); c.seed(1);
      c.set({ distance: 248 }); let s = c.step(30);     // cross into level 2 (1st level-up)
      assert(s.level === 2 && s.levelUps === 1, 'reached level 2 on the first level-up');
      assert(s.state === 'draft', 'the first level-up front-loads a draft');
      assert(s.draft.length === 3, 'three perks are offered');
      c.set({ draftArm: 0 });                            // skip the input-lock for the test
      c.pick(0);                                         // take one, resume
      c.set({ distance: 498 }); s = c.step(30);          // cross into level 3 (2nd level-up)
      assert(s.level === 3 && s.levelUps === 2, 'reached level 3');
      assert(s.state === 'playing', 'no draft on the second level-up');
      c.set({ distance: 748 }); s = c.step(30);          // cross into level 4 (3rd level-up)
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
      c.start(); c.set({ distance: 248 });
      let s = c.step(20);                               // cross into level 2
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

# Cheeky Run — Game Design Expert Review

A panel of six senior reviewers, each from a different discipline, played code-detective
across the codebase and graded the game against one question: **how do we make it more
engaging, exciting, and fun?** Each section below is one expert's verdict. The synthesis
at the top pulls out the themes they independently agreed on and a suggested order of work.

> Scope note: this is a review/ideation document, not an implementation. Every suggestion
> names the real function/constant it would touch, so any slice can be picked up and
> shipped behind a `npm run features` scenario.

---

## TL;DR — what the panel agreed on

The bones are genuinely strong. Reviewers independently praised the **corridor spawner**
(fair-by-construction difficulty), the **near-miss/skim/combo scoring**, the **roguelite
draft + meta shop**, the **squash-and-stretch + hit-stop + slow-mo juice**, the **adaptive
chiptune intensity system**, and the **best-score game-over flow**. This is already a
well-made runner. The opportunities are about **stakes, variety, and the size of the big
moments** — not fixing what's broken.

Five themes surfaced in more than one review:

1. **The run plateaus.** `difficulty = min(1, elapsed/70)` hard-caps after ~70s; past that
   the run only gets *faster*, never denser or trickier, and biomes are recolors that play
   identically. (Systems, Level, Audio all flagged a version of this.)
2. **Greed has no teeth.** The combo is pure upside (caps at x5), there's no comeback
   mechanic, and the optimal line is a little too safe. Excitement lives in *risk*, and the
   risk dial is turned low. (Systems, Level.)
3. **The big moments under-deliver against the craft.** Level-up is an 18-particle puff;
   death is a 0.09s freeze; power-up expiry and the fart gag are *silent*; perks are mostly
   strictly-better stat sticks. The feedback layering is good but the *peaks* are small.
   (Feel, Art, Audio, Systems.)
4. **First-run teaching is thin.** No in-run control hints; the draft and perks appear with
   no explanation under adrenaline. (UX.)
5. **Weak reason to return tomorrow.** Daily challenge exists but has no streak, no modifier
   identity, and no shareable brag. (UX, Systems.)

### Suggested roadmap

**Quick wins (S, low-risk, high-impact — do these first):**
- 🔊 **Add `sfxFart()`** — the comedy mascot's signature gag is currently silent. Highest
  fun-per-byte on the whole board.
- 🏞️ **Un-cap the difficulty curve** — feed a `heat = difficulty + min(0.5, level*0.03)`
  into `spawnRow()` so a long run keeps escalating.
- 🎲 **Raise the combo ceiling** (`COMBO_MAX`/`COMBO_STEP`) so the multiplier stays a chase.
- 📈 **Daily streak counter** + **next-goal nudge** on the game-over card.
- 🎮 **Coyote time** + **gate the slow-mo trigger lower** so the juiciest effect actually fires.
- 🎨 **Per-biome fog/sky + level-up shockwave** so stages feel different and milestones feel big.

**Bigger bets (M/L — the difference between "nicely made" and "one more run"):**
- 🎲 **Build-defining keystone perks** + a **comeback ("phoenix") mechanic** + a rare
  **Golden Stretch frenzy event**.
- 🏞️ **Mechanically distinct biomes** + **intensity waves** (rest beats → gauntlets) +
  a **downhill sprint set-piece** that finally uses the hills.
- 🔊 **Sidechain ducking** + **per-biome key changes** for a real musical arc.
- 📈 **First-run coachmarks** + a **shareable brag card**.

---

## 🎲 Systems & Game Design — Mara Quill

*Strengths:* The scoring loop has real intent — distance + roll points + the flow-drip
(`SCORE_FLOW_RATE`) means a hot combo passively out-scores a timid run, and the near-miss
vs skim split is a smart, readable two-channel reward. The corridor spawner and the
roguelite scaffolding (drafts, rerolls, banishes, boons, curses, meta-unlocks) are more
ambitious than most runners attempt. What's missing is *tension at the top of the skill
curve.*

1. **Make greed actually scary (M).** The combo is pure upside — breaking it costs nothing.
   Add a *bank-vs-ride* tension: while `combo` is hot, accrue the flow-drip into a visible
   *un-banked pool*; a crash forfeits it, grabbing a roll banks it. Touches
   `bumpCombo`/`breakCombo`/`gameOver`. *Risk: needs a clear HUD readout.*
2. **Raise the combo ceiling and make it the mastery chase (S).** `COMBO_MAX=5`,
   `COMBO_STEP=4` flatlines the multiplier after ~16 grabs — the `combo16` achievement asks
   for a streak the multiplier stops caring about. Raise the cap (~10) or add an uncapped
   soft scalar above it. *Risk: audio/speed-lines key off `cmult(combo)` — verify they ramp
   sanely.*
3. **Perks need build-defining keystones (L).** Tailwind/Lucky/Overdrive/Vacuum are all
   number-go-up with no opportunity cost, so a draft is rarely an interesting decision. Add
   3–4 conditional keystones that fork play: *Perfectionist* (near-misses 4×, rolls give no
   combo), *Hoarder* (+200% roll value at combo 0), *Glass Road* (+1 ceiling per gate
   cleared). Each is a `PERKS` entry + a `freshMods()` field. *Risk: balance — each needs a
   `features` scenario.*
4. **Lean into curses (S).** Curses are the most interesting cards but priced cheap, weighted
   rare, and their downside is mild. Crank both sides (Glass Cannon → 3× rolls; add *All In*
   — 5× score, one hit ends the run). Pure `perks.js` + `META` values.
5. **Skim is near-dead — make lateral dodging chase-able (M).** The skim window (0.55s) rarely
   fires because the corridor lets you pre-position. Add a "skim-bait" row (a hazard adjacent
   to the corridor that only pays if you brush it late) and let consecutive skims sub-combo.
   *Risk: skim-bait must never block the real safe lane.*
6. **Add a comeback mechanic (M).** Death is binary. Grant one earned "phoenix" charge at a
   high-combo milestone — the next fatal hit triggers a Boost-style invuln dash instead of
   `gameOver()`. ~10 lines, wildly memorable. *Risk: gate hard so it doesn't remove tension.*
7. **Power-ups need a jackpot spike (M).** The four 6s buffs are interchangeable. Add a rare
   (~1%) **Golden Stretch**: the track briefly floods with rolls in a safe corridor, combo
   pinned hot — your highlight-reel moment. Toggle a `frenzyT` mode in `tick`.
8. **Meta needs long-horizon goals (S).** The wallet runs out of things to want and
   achievements cap in a week. Add escalating milestone tiers and an always-hungry roll-sink.
9. **Daily needs a modifier identity + shareable hook (S).** It's just "the game, seeded."
   Give each day a seeded mutator and a copyable result string.

*If only three: #1 (greed has teeth), #3 (perks become builds), #6 (comeback).*

---

## 🏞️ Level & Content Design — Theo Vance

*Strengths:* A genuinely strong fairness backbone (corridor + compound rows + gates = three
honest, telegraphed primitives), excellent juice, and the track warp is a cheap way to make
a lane course feel alive. The problem is the *shape* of a long run.

1. **The curve hard-caps at 70s — add a second escalation stage (S).** Feed
   `heat = difficulty + min(0.5, level*0.03)` (not raw `difficulty`) into the pattern
   probabilities in `spawnRow()`, leaving `speed` on its current curve. Keeps escalation
   alive for 5+ minutes.
2. **Add an intensity wave (M).** Spawn density is monotonic — no breathing rhythm. Drive
   `T` and block-count from a slow phase machine: ~8–10s calm stretches building into ~4–6s
   gauntlets. *Risk: keep the one-open-lane invariant during surges.*
3. **Make biomes mechanically distinct (M).** Twilight plays exactly like Meadow. Add a
   per-biome modifier to each `BIOMES` entry: Twilight = shorter sight distance, Sunset =
   more gates, Candyland = denser rolls/tighter spacing. *Biggest variety lever.*
4. **Use the hills: a downhill sprint set-piece (L).** The most dramatic visual feature has
   zero mechanical payoff (`trackOffset` returns 0 at the player). Detect a downhill window
   and flip a `sprint` flag — speed surge, sparse rolls to chase, speed-lines up. *Risk:
   collisions stay flat while the world tilts — keep obstacles sparse during sprints.*
5. **Expand the pattern vocabulary (M).** Three primitives get predictable. Add named
   multi-row *formations* — zig-zag weave, double-gate (jump then immediately slide), roll
   trail — chosen as a unit via a `formation` state `spawnRow()` consults.
6. **Add a telegraphed moving hazard (M).** Every obstacle is static. A sweeping roller that
   animates `userData.lx` across lanes adds a distinct timed-dodge verb. *Risk: keep its
   motion deterministic in logical lane-X so `dx < halfW` still holds.*
7. **Front-load a real warm-up (S).** Stretch the first ~15s into a true tutorial ramp —
   hold `blockCount` at 1, widen `T`, and introduce each verb solo before combining.
8. **Cap/smooth max speed for readability (S).** `speed` has no cap and is further multiplied
   by perks and Boost; late runs can outrun reaction time at fixed `SPAWN_Z`. Cap it, or scale
   sight distance with speed so reaction *time* stays roughly constant.
9. **Add course-altering power-ups (S–M).** All four power-ups modify the player, not the
   course. A "rest" pickup that clears upcoming rows, or a "frenzy" that floods rolls, creates
   intensity contrast on demand.

*Top by impact-per-effort: #1 + #7 (fix both ends of pacing), #3 (highest variety ceiling).*

---

## 🎮 Game Feel & Juice — Riku Tanaka

*Strengths:* Punches above its weight. Asymmetric jump gravity (23 up / 34 down), the jump
buffer firing on touchdown, and volume-preserving squash/stretch (`1/sqrt(baseSq)`) are
textbook touches most jam games skip. The layering instinct is good — these notes make the
*peaks* hit harder.

1. **Add coyote time alongside the jump buffer (S).** The buffer covers "too early"; coyote
   time covers "a hair too late" — the most common cause of a jump that feels *stolen*. Add
   `COYOTE_TIME = 0.08`; in `jump()` treat `coyoteT > 0` as grounded for the first jump.
2. **The death moment is under-punched (M).** `HITSTOP_DEATH=0.09` is short. Bump to
   ~0.13–0.16, add a one-shot FOV zoom-punch in `gameOver()`/`updateCamera`, and throw death
   debris toward camera (`dir: +z`).
3. **Lane changes are mushy (M).** An asymptotic lerp never quite arrives and has no snap.
   Drive x by an eased fixed-duration (~0.12s) tween with a slight overshoot; sharpen
   `banked` so the tilt doesn't lag. *Risk: collision/skim use `player.position.x` — verify
   the one-lane-dodge guarantee.*
4. **Layer a "grab" punch onto rolls scaled by combo (S).** The 1st and 20th roll feel
   kinetically identical. Add a `squash` pop scaled by `cmult(combo)` and a combo-gated
   micro-shake so a roll-rush escalates physically.
5. **Duck has no buffer (S).** Jumps get a whole buffer system; `duck()` gets none, and
   slide-under gates are timing-tight. Mirror `JUMP_BUFFER` with a `duckBufferT`; snap
   `duckAmt` faster.
6. **Camera doesn't sell impact on near-miss/level-up (M).** `shakeT` only fires on crashes.
   Add a slow-mo FOV pull-in and a brief `shakeT` on level-up.
7. **Touch drops the chained second input within a gesture (M).** `fired` latches until the
   next `touchstart`, so a swipe-left-then-up drag (the bread-and-butter move) loses the
   second action. Re-arm mid-gesture by resetting `sx/sy` after firing. *Risk: avoid
   double-fire on jitter; manual smoke check.*
8. **Slow-mo may be too rare to ever feel (S).** It needs `m >= 3` (an 8-hit streak). Lower
   `SLOWMO_MIN_MULT` to 2, or trigger on a genuine matrix-dodge of a real threat regardless
   of combo.
9. **`prefers-reduced-motion` is half-wired (S).** It suppresses hit-stop/slow-mo but `shakeT`,
   the FOV kick, the twirl, and particles still fire full-force. Gate the motion sources;
   keep score/SFX/flash intact.

---

## 🎨 Art Direction — Pixie

*Strengths:* The cel ramp + inverted-hull ink outline give every mesh a crisp manga read,
and the discipline is real — everything uses `toon()`+`ink()`. The mascot rig is full of
life-from-behind charm. The issue: the *world* and the *big moments* underdeliver against
how good the character and materials already are.

1. **Give biomes different skies and air, not just recolored hills (M).** All four share
   identical hills, sun disc, fog band, and clouds. Add per-biome `fogNear/fogFar` lerped in
   `tweenBiome()` (pull Twilight in for mood) and tint clouds toward the biome. *Biggest "wow"
   lever.*
2. **Biome-specific ambient particles + scenery swap (M).** `spawnScenery()` grows the same
   green tree everywhere. Tint `makeTree/makeBush` per biome, add 1–2 biome props (glowing
   mushroom, peppermint swirl), and a slow ambient drift (fireflies/petals) behind
   `reduceMotion`.
3. **The mascot needs a face beat (M).** It's a butt-with-ears (the gag) with no way to mug
   at camera. Add a hidden `face` group (eyes + mouth) revealed for ~0.4s during
   `emote()`/`onLevelUp`, plus a wide-eyed "!" on the existing `alarm` ramp. *Risk: keep it a
   quick peek, don't break the rear-view gag.*
4. **Make level-up feel big (S).** It's an 18-particle puff — smaller than grabbing a roll.
   Add a ground shockwave ring, bump particle count to ~40, two-color emit. All additive,
   on-style, no new assets.
5. **Add a rim/back light so silhouettes pop off the fog (S).** One directional + hemisphere
   currently. A dim biome-tinted back light carves a bright edge (critical in Twilight where
   everything sits mid-blue). *Keep it under 0.35 so it doesn't wash the cel bands.*
6. **Power-up state should read on the body, not just a ground ring (S).** Pulse the player's
   skin/blush emissive toward the power color while active.
7. **Trade flat CSS speed-lines for an in-world trail (S).** Emit a backward-streaking
   particle ribbon at high combo/speed; keep the CSS as a faint vignette. Respect
   `reduceMotion`.
8. **Vary clouds + a hero skyline element (S).** Randomize puff counts; add twinkling stars
   that fade in for Twilight only — stars + pulled-in fog make Twilight the standout stage.
9. **Strengthen outline read on small/fast props (S).** Nudge the duck-bar/gate hull factors
   up and extend the "duck = warm bar" color language across biomes so the action reads by
   color, not just shape.

*Staging note: items 1, 3, 4, 5, 8 are visual judgment calls — stage and screenshot through
the `/pixie` skill before sign-off.*

---

## 🔊 Audio & Music — Sol Bergström

*Strengths:* A genuinely well-built procedural soundtrack. The intensity system is real
adaptive scoring (earn the kick/snare at 0.28, the lead/hats at 0.62), the lookahead
scheduler is textbook-correct, the mute fade is clickless, and the combo coin pitch-climb +
near-miss whoosh are the two best feedback touches in the build.

1. **The fart particle has NO sound — fix the biggest missed gag (S).** `fart()` fires a puff
   on every jump/duck and is silent. Add `sfxFart()` (downward pitch-bent triangle + a touch
   of filtered noise, randomized ±15%). *Highest excitement-per-byte fix on the board. Risk:
   keep it quieter than the jump; don't stack two on a double-jump.*
2. **Add detune variety to repeated one-shots (S).** `sfxLane` is the same 520Hz blip you
   hear most. Multiply freq by a few cents of human detune so the ear stops locking on.
3. **Sidechain-duck the music under big SFX (M).** A crash currently fires *over* a full
   arrangement — the death is mush. Add `duckMusic(amount, t, hold)`; call from crash/shield/
   fanfare/level. *Single biggest "feels pro" upgrade.*
4. **Make death actually land (M).** `sfxCrash` is one burst, then `sfxOver`/`sfxFanfare`
   fire 260ms later — two disconnected events. Widen the crash into a 2-layer impact with a
   sub thump, collapse the lead layer on death, and make the best-run fanfare clearly bigger.
5. **Intensity is monotonic — modulate it (M).** It never *drops* tension or reacts to danger.
   Dip intensity on `breakCombo()` so the next climb feels earned; thin the drums during
   slow-mo. *Tension is the gap, not the ceiling.*
6. **Key/biome variation (L).** `PROG` is one Em–C–G–D forever. Add a per-biome transpose
   (`[0, +3, +5, -2]`) applied in `scheduleStep`, quantized to bar boundaries. *Stops a
   5-minute run going stale. Highest-risk item — quantize key changes.*
7. **Power-up pickup + expiry audio (S).** `activatePower()` reuses `sfxLevel()` (confusing),
   and expiry is *silent*. Give each power a motif + a soft 2-note `sfxPowerEnd()`.
8. **Low-shield / last-shield warning (S).** Jeopardy has no sound. Branch `sfxShield()`:
   losing your *last* shield fires a tenser dissonant variant.
9. **A counter-melody at peak intensity (M).** Above 0.62 nothing more unlocks. Add a third
   tier at >0.85 — a high offbeat counter-melody most players rarely hear. Rarity makes it
   exciting.

*Fastest path to "sounds fun": #1 (fart), #3 (ducking), #4 (death/best-run). #5 + #6 give a
long run its emotional arc.*

---

## 📈 UX, Onboarding & Retention — Dana Cole

*Strengths:* The game-over flow is well-crafted — capturing `prevBest` before banking,
the `isBest` fork with confetti and "+N over your old best", earned achievements glowing in
place, the empty-wallet shop note. The HUD is disciplined and the meta is legible. The gaps
are *teaching the first run* and *a reason to return tomorrow.*

1. **First-run in-game control coachmarks (M).** The only teaching is menu chips a new player
   blows past. Add non-blocking ghost prompts in `startGame()` on the first run ("⬆️ Tap to
   hop", "◀▶ Swipe lanes"), fading each as the player performs it. *Biggest first-session
   churn fix.*
2. **Daily streak counter, not just daily best (M).** A fresh day silently resets — no memory
   you played yesterday. Extend `dailyBest` to track `streak`/`lastPlayed`; surface "🔥 3-day
   streak". *Cheapest ethical retention hook there is — no decay penalty.*
3. **"Next goal" nudge on the game-over card (M).** A player who hit nothing sees a dead end.
   Show the closest almost-earned goal ("High Roller — 1,200/1,500, so close!") via a
   `nextGoal()` helper in `achievements.js`. *Highest-leverage after onboarding.*
4. **Surface "what to chase next" in the shop (S).** Highlight the cheapest affordable-but-
   unowned item with a `.next` class + a one-line "enough for {name}!" header.
5. **Trim/sequence the menu (S).** Gate the meta panels behind `stats.runs >= 1` so the first
   screen is a clean hero + CTA + how-to funnel; consider tabs for veterans. *Risk: touches
   layout — cover with a `features` scenario.*
6. **First-draft "what is this?" frame (S).** The draft freezes the world and throws three
   rarity cards at a player never told perks exist. On the first draft, swap the hint to
   "Pick a perk — it powers up this run, free" and lengthen `DRAFT_ARM` so they can read.
7. **Shareable brag card for a new best (M).** A peach-with-ears hitting "New Best!" is
   inherently shareable, and confetti already fires there. Add an opt-in "📸 Brag" button —
   composite canvas + score, `navigator.share`/download fallback. *Only acquisition channel a
   no-monetization web game has.*
8. **HUD readability pass for the stacked center column (S).** Combo + power chips + a
   level-up banner can collide center-screen right when the player needs the road. Verify
   z-index/spacing; auto-hide the banner faster when a draft is about to open.
9. **"Welcome back" beat on return visits (S).** A tiny menu toast ("Welcome back! You've
   banked 240 🧻 — spend them?") rewards the return and routes to the spend loop.

*Ethical guardrails throughout: every hook rewards returning/progressing, never punishes
absence. Quick wins to land first: #2, #3, #1.*

---

## Cross-cutting opportunities (where two+ disciplines reinforce each other)

These compound — shipping the pair is worth more than the sum:

- **The "big moment" pass.** Level-up is simultaneously an art puff (Pixie #4), a flat camera
  beat (Riku #6), and a confusing audio reuse (Sol #7). Doing all three at once turns the
  headline moment of a run into a genuine spectacle.
- **The death pass.** Riku #2 (longer hit-stop + FOV punch), Sol #3/#4 (ducked music + 2-layer
  impact + collapsing arrangement) and the existing flash/shake should be tuned together so
  the crash lands as one authored event, not three.
- **The biome pass.** Theo #3 (mechanical modifiers), Pixie #1/#2 (fog/sky/scenery), and Sol
  #6 (key change) all key off the same `BIOMES` entry — a single coordinated edit makes each
  biome a place you *recognize, play differently, and hear differently.*
- **The greed/combo pass.** Mara #1/#2 (bank-vs-ride + higher ceiling), Riku #4 (combo-scaled
  grab punch), and Sol #5/#9 (intensity modulation + peak counter-melody) all reward the same
  behaviour — a hot streak should escalate in *score, feel, and sound* together.
- **The onboarding pass.** Dana #1/#6 (coachmarks + first-draft frame) and Theo #7 (front-
  loaded warm-up) are the same job from three angles: make the first run teach itself.

// Shared constants and tiny utilities used across the game.

export const LANES = [-2.2, 0, 2.2];
export const SPAWN_Z = -64;
export const DESPAWN_Z = 12;
export const INK = 0x241019;

// Full-width "gate" rows block every lane, so the only way past is the right
// action — jump a low hurdle or slide under a high bar. Side-stepping can't
// save you. These knobs tune how soon/often they appear.
export const GATE_MIN_DIFF = 0.22;    // phase in only after this much warm-up
export const GATE_CHANCE = 0.16;      // base chance on an eligible row
export const GATE_CHANCE_RAMP = 0.2;  // extra chance added at full difficulty
export const GATE_COOLDOWN = 2;       // normal rows guaranteed between gates

// Combo: grabbing rolls (and clean near-misses) in quick succession stacks a
// multiplier. The chain survives COMBO_WINDOW seconds without a pickup, then
// drops. The multiplier steps up one notch every COMBO_STEP hits, capped.
export const COMBO_WINDOW = 2.6;      // seconds a combo survives idle
export const COMBO_STEP = 4;          // hits between each +1 to the multiplier
export const COMBO_MAX = 8;           // multiplier ceiling — high enough to stay a chase
// `extra` raises the multiplier ceiling (the Hot Streak perk feeds it mods.comboCeil).
export const comboMult = (c, extra = 0) => Math.min(COMBO_MAX + extra, 1 + Math.floor(c / COMBO_STEP));

// Near-miss: clearing an obstacle this close (lane units beyond its half-width)
// without touching it pays a small bonus and feeds the combo.
export const NEARMISS_MARGIN = 0.7;
export const NEARMISS_BONUS = 8;
// Lateral "skim": dodging an obstacle in an ADJACENT lane by lane-changing past
// it (rather than jumping/ducking through). Pays a smaller bonus than a clean
// jump/duck near-miss, and only counts when you actually dodged for it — a lane
// change within SKIM_WINDOW seconds — so parking in the next lane earns nothing.
export const SKIM_MARGIN = 1.45;   // lateral reach beyond half-width (covers one lane gap, not two)
export const SKIM_BONUS = 4;
export const SKIM_WINDOW = 0.55;   // seconds after a lane change a skim still counts

// Compound rows: occasionally the guaranteed-open lane also holds a jumpable /
// duckable hazard, so the safe lane stays *reachable* but no longer *free* — you
// must lane-change AND clear it in one beat. Still fair (one move + one action).
export const SAFE_HAZARD_MIN_DIFF = 0.35;   // only once the run has some heat
export const SAFE_HAZARD_CHANCE = 0.4;      // scaled by difficulty, so it ramps in

// Game feel: a jump pressed just before landing is buffered for this long and
// fires the instant you touch down, so chained hops never feel dropped.
export const JUMP_BUFFER = 0.13;
// Hit-stop: a brief world freeze on impact so the hit reads as a physical event.
export const HITSTOP_SHIELD = 0.06;   // shield save — the run keeps going, so the freeze is felt
export const HITSTOP_DEATH = 0.14;    // the crash — a longer freeze so the wipe-out lands hard
// Near-miss slow-mo: a short time-dilation on a hot-combo skim/near-miss. Only
// kicks in once the multiplier is climbing, so it stays an event, not constant.
export const SLOWMO_FACTOR = 0.45;    // world runs at this fraction of real time
export const SLOWMO_TIME = 0.13;      // seconds the dilation lasts
export const SLOWMO_MIN_MULT = 2;     // combo multiplier needed to trigger it (lower = fires more often)
// A *tight* clean dodge (threaded right through a hazard's lane) earns a brief
// dilation even with no combo going — so the most skilful moment always lands a
// micro-reward, not just the optimised chain. Shorter than the combo slow-mo.
export const SLOWMO_TIGHT_MARGIN = 0.22;   // dx under this beyond half-width counts as a true near-miss
export const SLOWMO_TIGHT_TIME = 0.08;     // seconds the no-combo dilation lasts

// Pacing / flow tuning.
// The warm-up difficulty ramps to full over this many seconds. Longer = a gentler
// early curve, so a fast learner isn't slammed by the speed+level compound spike.
export const DIFF_RAMP = 90;
// Floor on the gap between obstacle rows (seconds), independent of speed/level, so
// reaction time never drops below a human-fair threshold deep in a run.
export const ROW_MIN_GAP = 0.42;
// Losing a streak steps the multiplier down one tier instead of nuking it: a
// single missed pickup bleeds momentum rather than ending it, so a long chain is
// worth defending and a stumble is recoverable.
export const COMBO_DECAY_STEP = COMBO_STEP;   // hits dropped per window-expiry tier

// Difficulty "heat": the warm-up difficulty caps at 1.0 after ~70s, so without
// this a long run only gets *faster*, never denser. heat keeps creeping with the
// level and feeds the pattern-selection probabilities in spawnRow(), so a deep
// run keeps escalating in variety/danger (speed stays on its own gentler curve).
export const HEAT_PER_LEVEL = 0.04;   // virtual difficulty added per level past 1
export const HEAT_LEVEL_CAP = 0.6;    // ceiling on the level contribution
export const HEAT_MAX = 1.6;          // overall clamp so spawns stay fair

// Phoenix: a once-per-run earned comeback. Hold a hot enough streak and you bank
// a single save — the next fatal hit becomes an invuln dash instead of game over.
export const PHOENIX_COMBO = 20;      // combo length that arms the save
export const PHOENIX_INVULN = 1.6;    // invuln seconds granted when it fires

// Magpie perk: roll value escalates with rolls already grabbed this run, capped.
export const GREED_CAP = 1.5;         // max bonus multiplier (+150%)

// Level-up shockwave: a flat ring that expands and fades for this long.
export const RING_TIME = 0.5;
// Flow scoring: while a combo is hot the multiplier feeds bonus score as you run,
// so a greedy chained run visibly out-scores a cautious one. Tuned gentle.
export const SCORE_FLOW_RATE = 0.6;

// Verticality — a graded up/down axis on top of the flat sim.
// Some jump obstacles are TALL: a single hop (apex ~1.9) can't clear them, so
// jumping *over* one demands a well-timed double-jump (which reaches ~3+). This
// turns the second jump from a bonus into a real read. Tall variants only phase
// in after a warm-up and only ever land in a blocked lane, so side-stepping is
// always still a fair dodge — the height only matters when you *choose* to jump.
export const TALL_CLEAR_H = 2.1;      // groundY needed to clear a tall obstacle (above single-jump apex)
// Extra jumps raise your grounded launch (doJump: vy += extraJumps*0.5), so a
// buffed player's single hop reaches higher — the tall wall grows with them by
// the same margin, so it always still demands the second jump, never less.
export const TALL_CLEAR_PER_JUMP = 0.25;
export const TALL_SCALE = 1.7;        // vertical stretch that telegraphs the extra height
export const TALL_MIN_DIFF = 0.3;     // tall variants only phase in past this much heat
export const TALL_CHANCE = 0.3;       // base chance a heat-eligible blocked jump obstacle is tall

// Aerial rolls: a roll can float at a height (userData.h) so it's only grabbable
// while airborne at its level — the treasure moves up. Ground rolls (h === 0)
// behave exactly as before. Air arcs trace a jump trajectory as a pure bonus in
// an open lane. Reaching real height (double-jump / pad) also pays an air bonus,
// scaled by peak height and the live combo — so going up is worth points, not
// just survival.
export const ROLL_GRAB_H = 0.7;       // vertical reach: how close in height you must be to grab an elevated roll
export const AIR_ARC_MIN_DIFF = 0.25; // air ribbons only phase in past this much heat
export const AIR_ARC_CHANCE = 0.12;   // chance of a (low, single-hop) air ribbon on an eligible open lane
// A tall wall can carry its own air ribbon arcing right over it, peaking above a
// single hop's apex — so the reward rides the same risky double-jump you'd use to
// clear the wall, instead of always sitting in the safe open lane.
export const AIR_ARC_TALL_CHANCE = 0.6;   // chance a tall obstacle also gets an air ribbon over it
export const AIR_ARC_TALL_PEAK = TALL_CLEAR_H + 0.5;   // peak float height of a tall-wall ribbon (double-jump territory)
// The air bonus only pays when a double-jump was actually spent (see usedDouble),
// so it can't be farmed by rhythm-hopping and doesn't inflate with extra jumps.
// AIR_MIN_H filters a wasted immediate double (too low to count). The height term
// is capped so perks/pads can't scale a single hop into a jackpot.
export const AIR_MIN_H = 2.0;         // a double-jump must clear this height to pay
export const AIR_BASE = 6;            // flat air bonus once you clear AIR_MIN_H
export const AIR_POINTS = 14;         // extra air bonus per unit of peak height above AIR_MIN_H
export const AIR_PEAK_CAP = 0.8;      // height (above AIR_MIN_H) past which the bonus stops climbing

// In-run power-ups: a rare floating gem that grants a brief effect. Spaced out
// by a row cooldown so grabbing one feels like an event, not a given. These are
// the shared pacing knobs only — the boost catalog itself (icons, colours,
// effects, gating) lives one-file-per-boost under src/boosts/ (see boosts.js).
export const POWERUP_DURATION = 6;     // seconds an effect lasts
export const POWERUP_CHANCE = 0.06;    // chance on an eligible (off-cooldown) row
export const POWERUP_MIN_DIFF = 0.12;  // only after a short warm-up
export const POWERUP_COOLDOWN = 14;    // rows guaranteed between power-up spawns

// Roguelite draft: a level-up offers a choice of perks. Drafts fire on every
// DRAFT_EVERY-th level-up (so they feel like an event, not every biome change),
// showing DRAFT_CHOICES cards to pick one from.
export const DRAFT_EVERY = 2;
export const DRAFT_CHOICES = 3;
// A draft interrupts live play, so the player is usually mid-input when it opens.
// DRAFT_ARM locks the cards for a beat to swallow the stray jump/lane tap that was
// meant for the character; DRAFT_GRACE is the invuln window granted on resume so a
// frozen obstacle sitting on top of you doesn't kill before you can react.
export const DRAFT_ARM = 0.45;     // seconds cards ignore input after a draft opens
export const DRAFT_GRACE = 1.3;    // invuln seconds granted when the run resumes

// DOM lookup shorthand.
export const $ = (id) => document.getElementById(id);

// Haptic buzz (no-op on platforms without the Vibration API).
export const buzz = (ms) => { if (navigator.vibrate) navigator.vibrate(ms); };

// In-place Fisher–Yates shuffle. Takes an RNG so the daily challenge can shuffle
// deterministically; defaults to Math.random for normal runs.
export function shuffle(a, rnd = Math.random) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (rnd() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Deterministic RNG (mulberry32) for the daily challenge: one seed reproduces
// the exact obstacle sequence, so everyone races the same course each day.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Today's challenge key (UTC date) and a 32-bit seed hashed from it.
export function dailyKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
export function dailySeed(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
// The day-key for the day before a given key — lets the daily streak tell a
// consecutive return ("yesterday") from a broken one.
export function prevKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dailyKey(dt);
}

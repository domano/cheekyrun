// The single source of persistent state. One localStorage blob, loaded once
// into a module-singleton so every system (upgrades, best score, stats,
// achievements, cosmetics, daily challenge) reads and writes the same object.
//
// Resilience to future versions of the game rests on three layers, applied on
// every load:
//
//   1. SCHEMA — every field is declared once with a type-safe sanitiser that
//      backfills a default and coerces junk. A missing field (older save) or a
//      wrong-typed/out-of-range one (corrupt save) can never reach gameplay, so
//      the page never bricks. Adding a field is one line here and needs nothing
//      else: old saves transparently gain it on next load.
//   2. MIGRATIONS — an explicit, ordered chain of structural upgrades for the
//      changes the schema can't express on its own (rename, remove, reshape).
//      Each step takes a version-N blob to N+1; VERSION names the latest.
//   3. Recovery — if a migration throws on genuinely broken data, the bad blob
//      is stashed under a `.bad` key and we boot clean rather than dead.
//
// Keep load() unable to throw past its catch — a throw here would blank the page
// (and fail the smoke test).

import { prevKey } from './config.js';

const KEY = 'cheekyrun.save';
// The pre-redesign save lived here under an ad-hoc "additive backfill" scheme.
// It is intentionally not carried forward; we drop it on first load so it stops
// lingering in everyone's localStorage.
const LEGACY_KEY = 'cheekyrun.save.v1';

// Bump when a MIGRATIONS step is added. Purely additive fields do NOT need a
// bump — the schema backfills them. Only structural changes (rename/remove/
// reshape) warrant a migration and a version bump.
export const VERSION = 1;

/* ----- field sanitisers ----------------------------------------------------
 * Each is a function (raw) -> clean that never throws and always returns a
 * value of the right shape, substituting a default for missing/garbage input.
 * `shape` composes them into nested objects; the whole SCHEMA is itself a shape,
 * so SCHEMA(undefined) yields a complete default save (see defaults()).        */

const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
// An integer clamped to >= min, defaulting to `d` (or min) when absent/NaN.
const int = (min = 0, d) => (v) => Number.isFinite(v) ? Math.max(min, Math.trunc(v)) : (d ?? min);
const text = (d = '') => (v) => typeof v === 'string' ? v : d;
// A set of truthy keys, optionally seeded with keys that are always present.
const flags = (...seed) => (v) => {
  const o = obj(v), r = {};
  for (const k of seed) r[k] = true;
  for (const k in o) if (o[k]) r[k] = true;
  return r;
};
// A key -> non-negative integer map (e.g. upgrade id -> tier). Drops zero/neg.
const counts = () => (v) => {
  const o = obj(v), r = {};
  for (const k in o) { const n = Math.max(0, Math.trunc(o[k] || 0)); if (n) r[k] = n; }
  return r;
};
// A nullable string field (e.g. the selected boon).
const maybeText = () => (v) => (typeof v === 'string' && v) ? v : null;
// Sanitise a nested object field-by-field against a spec of sanitisers.
const shape = (spec) => (v) => {
  const o = obj(v), r = {};
  for (const k in spec) r[k] = spec[k](o[k]);
  return r;
};

// The whole persistent shape. To add a field, add a line — nothing else.
const SCHEMA = shape({
  version:      int(0, VERSION),
  wallet:       int(0),                          // rolls currency
  owned:        counts(),                        // upgrade id -> tier
  best:         int(0),                          // persistent high score
  stats:        shape({ runs: int(0), dist: int(0), rolls: int(0), maxCombo: int(0), maxLevel: int(1) }),
  achievements: flags(),                         // achievement id -> true
  cosmetics:    shape({ owned: flags('classic'), skin: text('classic') }),
  dailyBest:    shape({ day: text(), score: int(0), streak: int(0), lastDay: text() }),
  meta:         shape({ pool: flags(), banished: flags(), rerolls: int(0), banishes: int(0), boon: maybeText() }),
});

const defaults = () => SCHEMA(undefined);

/* ----- structural migrations -----------------------------------------------
 * MIGRATIONS[v] upgrades a version-`v` blob to version v+1, run in order on
 * load. A step takes a raw blob and returns the next-version blob (mutate and
 * return is fine). Keep them pure — they run before sanitising, must not touch
 * the live `save`, and run on data the schema hasn't cleaned yet, so be
 * defensive. Adding one: append the step, bump VERSION.                        */
const MIGRATIONS = [
  // 0 -> 1: baseline of the redesigned save. Pre-redesign blobs used a separate
  // storage key (LEGACY_KEY) and are not carried over, so there is nothing to
  // transform here yet — this slot documents the contract for the next change.
];

// Walk a raw blob from its stored version up to VERSION. An unversioned or
// junk blob is treated as version 0 (the oldest); a non-object yields {} so the
// schema fills in a clean default.
function migrate(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  let s = raw;
  let v = Number.isFinite(raw.version) ? Math.max(0, raw.version | 0) : 0;
  for (; v < VERSION; v++) {
    const step = MIGRATIONS[v];
    if (step) s = step(s) || s;
  }
  return s;
}

export let save = load();
function load() {
  // Retire the pre-redesign blob once, whatever happens below.
  try { if (localStorage.getItem(LEGACY_KEY) != null) localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY)); } catch { /* unreadable -> defaults */ }
  try {
    const clean = SCHEMA(migrate(raw));
    clean.version = VERSION;                      // stamp: future loads start here
    return clean;
  } catch (e) {
    // A migration threw on genuinely broken data. Stash it for forensics and
    // boot clean rather than leave a dead page.
    try { const bad = localStorage.getItem(KEY); if (bad != null) localStorage.setItem(KEY + '.bad', bad); } catch { /* ignore */ }
    console.warn('Cheeky Run: unreadable save; starting fresh', e);
    return defaults();
  }
}
// Re-read the stored blob into the live singleton (mutated in place so every
// importer's reference stays valid). Mirrors the import-time load + lets tests
// exercise loading a hand-written save without a full page reload.
export function reload() { Object.assign(save, load()); return save; }
export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* ignore */ }
}

// Wipe persistent state back to defaults — both the stored blob and the live
// in-memory singleton (mutated in place so every importer's reference stays
// valid). Lets the feature harness isolate scenarios without reloading the page.
export function resetSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  Object.assign(save, defaults());
}

/* ----- wallet (rolls currency) ----- */
export const getWallet = () => save.wallet | 0;
export const addRolls = (n) => { save.wallet = (save.wallet | 0) + (n | 0); persist(); };
export const spend = (n) => { if ((save.wallet | 0) < n) return false; save.wallet -= n; persist(); return true; };

/* ----- best score ----- */
export const getBest = () => save.best | 0;
export const setBest = (n) => { if ((n | 0) > (save.best | 0)) { save.best = n | 0; persist(); } };

/* ----- lifetime stats: counters add, max-fields take the larger ----- */
export const getStats = () => save.stats;
export function bumpStats({ runs = 0, dist = 0, rolls = 0, maxCombo = 0, maxLevel = 0 } = {}) {
  const s = save.stats;
  s.runs += runs; s.dist += dist | 0; s.rolls += rolls | 0;
  s.maxCombo = Math.max(s.maxCombo, maxCombo);
  s.maxLevel = Math.max(s.maxLevel, maxLevel);
  persist();
}

/* ----- achievements ----- */
export const getAchievements = () => save.achievements;
export const hasAch = (id) => !!save.achievements[id];
export const unlock = (id) => { if (!save.achievements[id]) { save.achievements[id] = true; persist(); return true; } return false; };

/* ----- cosmetics (skins) ----- */
export const skinOwned = (id) => !!save.cosmetics.owned[id];
export const selectedSkin = () => save.cosmetics.skin;
export const ownSkin = (id) => { save.cosmetics.owned[id] = true; persist(); };
// Persist the active skin. Callers gate on cosmetics' skinUnlocked() first —
// which also covers achievement skins (unlocked but never added to `owned`).
export const selectSkin = (id) => { save.cosmetics.skin = id; persist(); };

/* ----- roguelite meta: perk pool, banishes, charges, boon ----- */
export const poolHas = (id) => !!save.meta.pool[id];
export const unlockPerk = (id) => { save.meta.pool[id] = true; persist(); };
export const isBanished = (id) => !!save.meta.banished[id];
export const banishPerk = (id) => { save.meta.banished[id] = true; persist(); };
export const getRerolls = () => save.meta.rerolls | 0;
export const addRerolls = (n) => { save.meta.rerolls = (save.meta.rerolls | 0) + (n | 0); persist(); };
export const useReroll = () => { if ((save.meta.rerolls | 0) > 0) { save.meta.rerolls--; persist(); return true; } return false; };
export const getBanishes = () => save.meta.banishes | 0;
export const addBanishes = (n) => { save.meta.banishes = (save.meta.banishes | 0) + (n | 0); persist(); };
export const useBanish = () => { if ((save.meta.banishes | 0) > 0) { save.meta.banishes--; persist(); return true; } return false; };
export const getBoon = () => save.meta.boon;
export const setBoon = (id) => { save.meta.boon = id; persist(); };

/* ----- daily challenge best (resets when the day changes) + return streak ----- */
export function getDailyBest(day) { return save.dailyBest.day === day ? (save.dailyBest.score | 0) : 0; }
// How many days in a row the player has completed a daily. Reads 0 once a day has
// been skipped (lastDay is neither today nor yesterday), so a stale streak from
// last week never shows as "live".
export function getDailyStreak(today) {
  const db = save.dailyBest;
  const last = db.lastDay || '';
  if (!last) return 0;
  if (today && last !== today && last !== prevKey(today)) return 0;   // a day was missed
  return db.streak | 0;
}
export function setDailyBest(day, score) {
  const db = save.dailyBest;
  if (db.day !== day) {
    // First completion of a new day: extend the streak if yesterday was played,
    // otherwise it starts fresh at 1. Never punishes a gap beyond resetting.
    db.streak = (db.lastDay === prevKey(day)) ? (db.streak | 0) + 1 : 1;
    db.lastDay = day;
    db.day = day;
    db.score = score | 0;
  } else if ((score | 0) > (db.score | 0)) {
    db.score = score | 0;
  }
  persist();
}

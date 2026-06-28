// The single source of persistent state. One localStorage blob, loaded once
// into a module-singleton so every system (upgrades, best score, stats,
// achievements, cosmetics, daily challenge, roguelite meta) reads and writes
// the same object.
//
// ── Resilience model ────────────────────────────────────────────────────────
// The store is built to survive arbitrary future change sessions. Three layers,
// applied on every load (see hydrate()):
//
//   1. VERSIONED MIGRATIONS. The blob carries its own schema version. When the
//      *shape* of a field changes (a rename, a split, a restructure), add one
//      step to MIGRATIONS and bump VERSION — old blobs are walked forward step
//      by step. This is the only thing a structural change needs to touch.
//   2. DEEP-MERGE BACKFILL. Every load deep-merges the stored data over a fresh
//      defaults() tree, so *additive* fields need no migration at all: add the
//      field to defaults() and old saves pick it up with its default. New code
//      reading an old save never sees `undefined`.
//   3. TYPE COERCION. The merge coerces each known field to the type its default
//      declares and leaves open-ended maps (owned, achievements, pools…) intact,
//      so a corrupt or hand-edited blob can't hand a string where a number is
//      expected and brick startup.
//
// A blob written by a *newer* build (version ahead of ours) is left as-is and
// merged over defaults: fields we don't understand are preserved untouched, so
// downgrading then upgrading again loses nothing. load() is wrapped so a throw
// can never blank the page — on any failure it returns clean defaults.

import { prevKey } from './config.js';

// Stable key: the schema version lives *inside* the blob, not in the key, so it
// never has to change again — migrations carry old data forward. (The previous
// system keyed on `cheekyrun.save.v1`; that blob is intentionally abandoned, so
// existing players start fresh on the new, future-proof store.)
const KEY = 'cheekyrun.save';
const VERSION = 1;

function defaults() {
  return {
    wallet: 0,
    owned: {},                                   // upgrade id -> tier
    best: 0,                                      // persistent high score
    stats: { runs: 0, dist: 0, rolls: 0, maxCombo: 0, maxLevel: 1 },
    achievements: {},                            // achievement id -> true
    cosmetics: { owned: { classic: true }, skin: 'classic' },
    dailyBest: { day: '', score: 0, streak: 0, lastDay: '' },
    meta: { pool: {}, banished: {}, rerolls: 0, banishes: 0, boon: null },
  };
}

// Migration steps. MIGRATIONS[i] upgrades a data blob from schema version i to
// i+1; it receives the raw stored data and returns the next-version shape. Only
// STRUCTURAL changes belong here — renames, splits, reshapes. Additive fields
// are handled for free by the defaults() backfill, so most sessions add nothing.
//
// Example, when version 1 → 2 splits `cosmetics.skin` into a trail + body skin:
//   const MIGRATIONS = [
//     (d) => { d.cosmetics = { ...d.cosmetics, body: d.cosmetics.skin, trail: 'classic' }; return d; },
//   ];
const MIGRATIONS = [];

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

// Recursively merge stored `raw` over a `def` tree. The default's type at each
// leaf decides the rule:
//   • object default → recurse; keys present only in `raw` (open-map entries and
//     fields from a newer build) are carried through untouched.
//   • number/boolean/string default → coerce `raw` to that type, else fall back.
//   • null default → pass `raw` through verbatim (a free-form slot, e.g. boon).
// This single pass is layers 2 + 3 above: additive backfill and type coercion.
function merge(def, raw) {
  if (isObj(def)) {
    const out = isObj(raw) ? { ...raw } : {};
    for (const k of Object.keys(def)) out[k] = merge(def[k], isObj(raw) ? raw[k] : undefined);
    return out;
  }
  if (typeof def === 'number') return Number.isFinite(+raw) ? Math.trunc(+raw) : def;
  if (typeof def === 'boolean') return !!raw;
  if (typeof def === 'string') return typeof raw === 'string' ? raw : def;
  return raw === undefined ? def : raw;          // null/any default: keep what's there
}

// Walk a raw data blob from `version` up to VERSION, then merge it over fresh
// defaults. Pure (no I/O) so it's trivially testable and reused by load().
function hydrate(stored, version) {
  let data = isObj(stored) ? stored : {};
  let v = Number.isFinite(+version) ? (version | 0) : 0;   // 0 == pre-versioned / unknown
  // Older blob: walk each migration forward. A newer blob (v > VERSION) is left
  // for the merge to reconcile — we never run migrations backward.
  for (; v < VERSION && MIGRATIONS[v]; v++) data = MIGRATIONS[v](data) || data;
  return merge(defaults(), data);
}

export let save = load();
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    // Canonical shape is { v, data }. Tolerate a bare blob too (a hand-written or
    // pre-envelope save), reading its version field if present, else treating it
    // as pre-versioned so the migration chain runs from the start.
    if (isObj(raw) && 'data' in raw) return hydrate(raw.data, raw.v);
    return hydrate(raw, isObj(raw) ? raw.v : 0);
  } catch {
    return defaults();
  }
}
// Re-read the stored blob into the live singleton (mutated in place so every
// importer's reference stays valid). Mirrors the import-time load + lets tests
// exercise loading a hand-written save without a full page reload.
export function reload() { Object.assign(save, load()); return save; }
export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify({ v: VERSION, data: save })); } catch { /* ignore */ }
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

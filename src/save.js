// The single source of persistent state. One versioned localStorage blob,
// loaded once into a module-singleton so every system (upgrades, best score,
// stats, achievements, cosmetics, daily challenge, roguelite meta) reads and
// writes the same object.
//
// Designed to survive future game versions. load() runs three passes so any
// blob — old, newer, or corrupt — boots a clean, playable save:
//
//   1. migrate()   — a directed chain (MIGRATIONS) bumps an older `version`
//                    up to CURRENT, one step per schema change. Pure additions
//                    need no entry (pass 2 backfills them); add a migration
//                    only when a field is renamed, restructured, or recomputed.
//   2. normalize() — rebuilds the canonical shape from the raw blob: every
//                    known field is coerced to its expected type, unknown
//                    *top-level* keys are passed through untouched (so a save
//                    written by a NEWER build round-trips without data loss),
//                    and brand-new fields backfill from defaults().
//   3. clamp       — value guards baked into normalize (no negative wallet or
//                    upgrade tier, maxLevel >= 1, …) so a corrupt *value* can't
//                    reach the game loop and throw; the field self-heals.
//
// load() is wrapped in try/catch returning full defaults, so even a pathological
// blob can't blank the page (which would also fail the smoke test). Because the
// version lives *inside* the blob, this storage key is permanent — future schema
// changes bump VERSION and add a migration, never a new key.

import { prevKey } from './config.js';

const KEY = 'cheekyrun.save';
const BAK = 'cheekyrun.save.bak';            // shadow copy: a second slot to survive eviction / a torn write
const LEGACY_KEYS = ['cheekyrun.save.v1'];   // pre-versioning saves; cleared on first load
const VERSION = 1;                           // bump + add a MIGRATIONS step per breaking schema change
const HISTORY_MAX = 14;                       // recent-run log depth (the menu trend strip)

function defaults() {
  return {
    version: VERSION,
    wallet: 0,
    owned: {},                                  // upgrade id -> tier
    best: 0,                                     // persistent high score
    stats: { runs: 0, dist: 0, rolls: 0, maxCombo: 0, maxLevel: 1 },
    achievements: {},                            // achievement id -> true
    cosmetics: { owned: { classic: true }, skin: 'classic' },
    dailyBest: { day: '', score: 0, streak: 0, lastDay: '' },
    meta: { pool: {}, banished: {}, rerolls: 0, banishes: 0 },
    history: [],                                 // recent runs: {day, score, level, dist}, newest last
  };
}

/* ----- type coercion helpers (the load-time guards) ----- */
const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const asMap = (v) => isObj(v) ? v : {};                 // anything non-object -> empty map
const int = (v) => v | 0;
const nat = (v) => Math.max(0, v | 0);                  // non-negative int
const str = (v, dflt) => typeof v === 'string' ? v : dflt;
// A key->true flag map (achievements, perk pool, owned cosmetics): keep only
// truthy keys, so a junk value can never masquerade as "owned".
const flagMap = (v) => { const o = {}, m = asMap(v); for (const k in m) if (m[k]) o[k] = true; return o; };
// A key->count map (upgrade tiers): clamp each to a positive int, dropping
// zero/negative/garbage so the game never reads a phantom or negative tier.
const tierMap = (v) => { const o = {}, m = asMap(v); for (const k in m) { const n = nat(m[k]); if (n) o[k] = n; } return o; };
// One run-history row, with every field clamped so a corrupt entry can't reach
// the trend strip's bar maths.
const histRow = (e) => ({ day: str(e?.day, ''), score: nat(e?.score), level: Math.max(1, int(e?.level)), dist: nat(e?.dist) });
// The recent-run log: keep only object rows, cap to the newest HISTORY_MAX.
const histList = (v) => Array.isArray(v) ? v.filter(isObj).slice(-HISTORY_MAX).map(histRow) : [];

// Directed migrations between schema versions. migrate() applies MIGRATIONS[v]
// to a save at version v to bring it to v+1, repeating until it reaches VERSION.
// Each entry mutates the raw blob in place. Example for a future wallet rename:
//   1: (s) => { s.coins = s.wallet; delete s.wallet; },   // v1 -> v2
const MIGRATIONS = {
  // (none yet — VERSION is 1)
};

function migrate(raw) {
  if (!isObj(raw)) return raw;
  let v = nat(raw.version) || 1;                         // legacy/no-version blobs are treated as v1
  while (v < VERSION && MIGRATIONS[v]) { MIGRATIONS[v](raw); v++; }
  return raw;
}

// Rebuild the canonical save from an arbitrary raw blob. Known fields are
// coerced to their expected types; unknown top-level keys are preserved so a
// newer build's data isn't destroyed by an older one.
function normalize(raw) {
  const r = isObj(raw) ? raw : {};
  const rcos = asMap(r.cosmetics), rmeta = asMap(r.meta);
  const rstats = asMap(r.stats), rdb = asMap(r.dailyBest);
  const known = {
    version: VERSION,
    wallet: nat(r.wallet),
    owned: tierMap(r.owned),
    best: nat(r.best),
    stats: {
      runs: nat(rstats.runs), dist: nat(rstats.dist), rolls: nat(rstats.rolls),
      maxCombo: nat(rstats.maxCombo), maxLevel: Math.max(1, int(rstats.maxLevel)),
    },
    achievements: flagMap(r.achievements),
    cosmetics: {
      owned: { classic: true, ...flagMap(rcos.owned) },
      skin: str(rcos.skin, 'classic'),
    },
    dailyBest: {
      day: str(rdb.day, ''), score: nat(rdb.score),
      streak: nat(rdb.streak), lastDay: str(rdb.lastDay, ''),
    },
    meta: {
      pool: flagMap(rmeta.pool), banished: flagMap(rmeta.banished),
      rerolls: nat(rmeta.rerolls), banishes: nat(rmeta.banishes),
    },
    history: histList(r.history),
  };
  const out = {};
  for (const k in r) if (!(k in known)) out[k] = r[k];   // pass unknown future keys through
  return Object.assign(out, known);
}

function dropLegacy() {
  try { for (const k of LEGACY_KEYS) localStorage.removeItem(k); } catch { /* ignore */ }
}

// Parse one storage slot into a raw blob (or null if missing/unparseable).
function readSlot(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}

export let save = load();
function load() {
  // Prefer the primary slot; fall back to the shadow copy when the primary is
  // gone (evicted) or a write was interrupted mid-blob. Only a real object counts
  // — a null/garbage primary shouldn't shadow a good backup.
  let raw = readSlot(KEY);
  if (!isObj(raw)) { const bak = readSlot(BAK); if (isObj(bak)) raw = bak; }
  let result;
  try { result = normalize(migrate(raw)); }
  catch (e) { console.warn('Cheeky Run: save unreadable; starting fresh', e); result = defaults(); }
  dropLegacy();
  return result;
}
// Re-read the stored blob into the live singleton (mutated in place so every
// importer's reference stays valid). Mirrors the import-time load + lets tests
// exercise loading a hand-written save without a full page reload.
export function reload() { Object.assign(save, load()); return save; }

// True after the last persist() succeeded. Flips false on a quota/security
// failure (e.g. a full disk, or Safari private mode where setItem throws) so a
// caller can tell "saved" from "looked saved but didn't" instead of guessing.
export let persistOk = true;
export function persist() {
  let blob;
  try { blob = JSON.stringify(save); } catch { return; }
  try {
    localStorage.setItem(KEY, blob);
    persistOk = true;
    // Mirror to the shadow slot. Best-effort: if only the backup write fails the
    // primary still landed, so don't flip persistOk on it.
    try { localStorage.setItem(BAK, blob); } catch { /* shadow is best-effort */ }
  } catch (e) {
    if (persistOk) console.warn('Cheeky Run: could not save progress (storage full or blocked)', e);
    persistOk = false;
  }
}

// Ask the browser to keep our storage from being evicted under pressure. Without
// this, localStorage on a shared origin (e.g. *.github.io) is best-effort and can
// be cleared "after a while" with no user action. Idempotent + feature-detected,
// so it's a no-op where unsupported; best called from the first user gesture.
let persistenceAsked = false;
export function requestPersistence() {
  if (persistenceAsked) return;
  persistenceAsked = true;
  try { navigator.storage?.persist?.(); } catch { /* ignore */ }
}

// Keep multiple tabs coherent: when another tab rewrites the save, re-read it
// into our singleton (mutated in place, so every importer's reference stays live)
// and let the caller refresh UI. Without this, the last tab to persist silently
// clobbers a sibling's committed progress. Wires once.
let externalWired = false;
export function onExternalChange(cb) {
  if (externalWired) return;
  externalWired = true;
  try {
    addEventListener('storage', (e) => { if (e.key === KEY) { reload(); cb?.(); } });
  } catch { /* no window (non-browser import) */ }
}

// Wipe persistent state back to defaults — both the stored blob and the live
// in-memory singleton (mutated in place so every importer's reference stays
// valid). Lets the feature harness isolate scenarios without reloading the page.
export function resetSave() {
  try { localStorage.removeItem(KEY); localStorage.removeItem(BAK); } catch { /* ignore */ }
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

/* ----- recent-run history (the menu trend strip) ----- */
export const getHistory = () => save.history;
export function pushHistory(entry) {
  save.history.push(histRow(entry));
  if (save.history.length > HISTORY_MAX) save.history = save.history.slice(-HISTORY_MAX);
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

/* ----- roguelite meta: perk pool, banishes, charges ----- */
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

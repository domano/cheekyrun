// The single source of persistent state. One localStorage blob, loaded once
// into a module-singleton so every system (upgrades, best score, stats,
// achievements, cosmetics, daily challenge) reads and writes the same object.
//
// The schema only ever grows: load() backfills every field with a default, so
// an older save is a strict subset and migrates transparently — no version bump
// needed. Keep load() inside a try/catch returning full defaults; a throw here
// would blank the page (and fail the smoke test).

import { prevKey } from './config.js';

const KEY = 'cheekyrun.save.v1';

function defaults() {
  return {
    wallet: 0,
    owned: {},                                  // upgrade id -> tier
    best: 0,                                     // persistent high score
    stats: { runs: 0, dist: 0, rolls: 0, maxCombo: 0, maxLevel: 1 },
    achievements: {},                            // achievement id -> true
    cosmetics: { owned: { classic: true }, skin: 'classic' },
    dailyBest: { day: '', score: 0, streak: 0, lastDay: '' },
    meta: { pool: {}, banished: {}, rerolls: 0, banishes: 0, boon: null },
  };
}

// A stored field that should be a key->value map. Legacy/corrupt saves can hold
// the wrong type here (a string, array or number); indexing — or worse, deleting
// keys (see migrateSave) — on those throws. Since migrateSave runs at import, one
// such field would brick the whole app before anything renders, so coerce every
// map field to a real plain object on the way in.
const asMap = (v) => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};

export let save = load();
function load() {
  const d = defaults();
  try {
    const raw = asMap(JSON.parse(localStorage.getItem(KEY)));
    const rawCos = asMap(raw.cosmetics), rawMeta = asMap(raw.meta);
    return {
      wallet: raw.wallet | 0,
      owned: asMap(raw.owned),
      best: raw.best | 0,
      stats: { ...d.stats, ...asMap(raw.stats) },
      achievements: asMap(raw.achievements),
      cosmetics: {
        owned: { ...d.cosmetics.owned, ...asMap(rawCos.owned) },
        skin: rawCos.skin || d.cosmetics.skin,
      },
      dailyBest: { ...d.dailyBest, ...asMap(raw.dailyBest) },
      meta: {
        ...d.meta, ...rawMeta,
        pool: asMap(rawMeta.pool),
        banished: asMap(rawMeta.banished),
      },
    };
  } catch {
    return d;
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

// The single source of persistent state. One localStorage blob, loaded once
// into a module-singleton so every system (upgrades, best score, stats,
// achievements, cosmetics, daily challenge) reads and writes the same object.
//
// The schema only ever grows: load() backfills every field with a default, so
// an older save is a strict subset and migrates transparently — no version bump
// needed. Keep load() inside a try/catch returning full defaults; a throw here
// would blank the page (and fail the smoke test).

const KEY = 'cheekyrun.save.v1';

function defaults() {
  return {
    wallet: 0,
    owned: {},                                  // upgrade id -> tier
    best: 0,                                     // persistent high score
    stats: { runs: 0, dist: 0, rolls: 0, maxCombo: 0, maxLevel: 1 },
    achievements: {},                            // achievement id -> true
    cosmetics: { owned: { classic: true }, skin: 'classic' },
    dailyBest: { day: '', score: 0 },
  };
}

export let save = load();
function load() {
  const d = defaults();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY)) || {};
    return {
      wallet: raw.wallet | 0,
      owned: raw.owned || d.owned,
      best: raw.best | 0,
      stats: { ...d.stats, ...(raw.stats || {}) },
      achievements: raw.achievements || d.achievements,
      cosmetics: {
        owned: { ...d.cosmetics.owned, ...((raw.cosmetics || {}).owned || {}) },
        skin: (raw.cosmetics || {}).skin || d.cosmetics.skin,
      },
      dailyBest: { ...d.dailyBest, ...(raw.dailyBest || {}) },
    };
  } catch {
    return d;
  }
}
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
export const selectSkin = (id) => { if (save.cosmetics.owned[id]) { save.cosmetics.skin = id; persist(); return true; } return false; };

/* ----- daily challenge best (resets when the day changes) ----- */
export function getDailyBest(day) { return save.dailyBest.day === day ? (save.dailyBest.score | 0) : 0; }
export function setDailyBest(day, score) {
  if (save.dailyBest.day !== day) save.dailyBest = { day, score: score | 0 };
  else if ((score | 0) > (save.dailyBest.score | 0)) save.dailyBest.score = score | 0;
  persist();
}

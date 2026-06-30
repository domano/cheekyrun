// Persistent meta-progression: a shop of upgrades bought with toilet rolls.
//
// Rolls grabbed during a run are banked into a wallet on game over. Between
// runs the wallet is spent on permanent upgrades, each with a few tiers. The
// wallet and owned tiers live in the shared save (see save.js).

import { save, persist, getWallet, addRolls,
  spend, poolHas, unlockPerk, isBanished, addRerolls, addBanishes } from './save.js';
import { PERKS } from './perks.js';
export { getWallet, addRolls };

// Note: there's no per-module save cleanup here anymore. The save loader
// (save.js) normalizes every blob on load — coercing map fields and clamping
// upgrade tiers to positive ints — so reframed/removed upgrade ids and bad
// values can't reach this module. Renames across versions belong in save.js's
// MIGRATIONS chain.

// Each upgrade declares: a max tier, the cost to reach the *next* tier from a
// given current tier (cost(currentTier) is valid for currentTier < max), the
// gameplay value at a tier, and a short human label for the current tier.
export const UPGRADES = [
  {
    id: 'shield', icon: '🛡️', name: 'Cushion',
    desc: 'Soaks up a crash. Refills each run.',
    max: 3,
    cost: (l) => [60, 140, 280][l],
    value: (l) => l,                              // crashes survived per run
    label: (l) => `${l} hit${l === 1 ? '' : 's'}`,
  },
  {
    id: 'headstart', icon: '🚀', name: 'Head Start',
    desc: 'Begin a few levels in.',
    max: 3,
    cost: (l) => [60, 130, 240][l],
    value: (l) => l,                             // levels skipped at the start
    label: (l) => `start Lv ${1 + l}`,
  },
];

const byId = (id) => UPGRADES.find((u) => u.id === id);

export const tierOf = (id) => save.owned[id] | 0;

// Cost to buy the next tier, or null if already maxed.
export function nextCost(id) {
  const u = byId(id), l = tierOf(id);
  return l >= u.max ? null : u.cost(l);
}

// Attempt a purchase; returns true on success.
export function buy(id) {
  const u = byId(id), l = tierOf(id);
  if (l >= u.max) return false;
  const c = u.cost(l);
  if ((save.wallet | 0) < c) return false;
  save.wallet -= c;
  save.owned[id] = l + 1;
  persist();
  return true;
}

// Resolved gameplay effects for the current save, read once at run start. The
// magnet/rollValue/extraJumps floors are now perk territory; perks build on these.
export function effects() {
  return {
    magnet: 0,
    shields: byId('shield').value(tierOf('shield')),
    rollValue: 15,
    extraJumps: 0,
    headstart: byId('headstart').value(tierOf('headstart')),
  };
}

/* ----- roguelite META layer: perk-pool unlocks, charges, boon ----- */

// Perks draftable for free, without buying an unlock.
export const DEFAULT_POOL = ['tailwind', 'vacuum', 'lucky', 'hops', 'pillow', 'daredevil', 'memory'];

// Perk ids currently draftable: in the default pool or unlocked, minus banished.
export function unlockedPerkIds() {
  return PERKS
    .filter((p) => (DEFAULT_POOL.includes(p.id) || poolHas(p.id)) && !isBanished(p.id))
    .map((p) => p.id);
}

// Meta shop: one unlock per non-default perk, plus reroll/banish charge packs.
export const META = [
  ...PERKS.filter((p) => !DEFAULT_POOL.includes(p.id)).map((p) => ({
    id: 'unlock:' + p.id, kind: 'unlock', perk: p.id, icon: p.icon,
    name: 'Unlock ' + p.name, desc: p.desc, cost: p.rarity === 'curse' ? 130 : 150,
  })),
  { id: 'reroll', kind: 'reroll', grant: 2, icon: '🎲', name: 'Reroll pack', desc: '+2 draft rerolls.', cost: 80 },
  { id: 'banish', kind: 'banish', grant: 1, icon: '🚫', name: 'Banish token', desc: '+1 token — remove a perk from your pool.', cost: 90 },
];

const metaById = (id) => META.find((m) => m.id === id);

// Attempt a meta purchase; returns true on success.
export function buyMeta(id) {
  const item = metaById(id);
  if (!item) return false;
  if (item.kind === 'unlock') {
    if (poolHas(item.perk)) return false;
    if (!spend(item.cost)) return false;
    unlockPerk(item.perk);
    return true;
  }
  if (item.kind === 'reroll') return spend(item.cost) && (addRerolls(item.grant), true);
  if (item.kind === 'banish') return spend(item.cost) && (addBanishes(item.grant), true);
  return false;
}

// Cost of a meta item for the UI, or null if it's an already-owned unlock.
export function metaCost(id) {
  const item = metaById(id);
  if (!item) return null;
  if (item.kind === 'unlock' && poolHas(item.perk)) return null;
  return item.cost;
}

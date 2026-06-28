// Persistent meta-progression: a shop of upgrades bought with toilet rolls.
//
// Rolls grabbed during a run are banked into a wallet on game over. Between
// runs the wallet is spent on permanent upgrades, each with a few tiers. The
// wallet and owned tiers persist in localStorage so progress survives reloads.

const KEY = 'cheekyrun.save.v1';

// Each upgrade declares: a max tier, the cost to reach the *next* tier from a
// given current tier (cost(currentTier) is valid for currentTier < max), the
// gameplay value at a tier, and a short human label for the current tier.
export const UPGRADES = [
  {
    id: 'magnet', icon: '🧲', name: 'Roll Magnet',
    desc: 'Pulls nearby rolls toward you.',
    max: 4,
    cost: (l) => [40, 90, 180, 320][l],
    value: (l) => [0, 3.4, 5, 7, 9][l],          // attraction radius (world units)
    label: (l) => (l ? `range ${['', 'S', 'M', 'L', 'XL'][l]}` : 'off'),
  },
  {
    id: 'shield', icon: '🛡️', name: 'Cushion',
    desc: 'Soaks up a crash. Refills each run.',
    max: 3,
    cost: (l) => [60, 140, 280][l],
    value: (l) => l,                              // crashes survived per run
    label: (l) => `${l} hit${l === 1 ? '' : 's'}`,
  },
  {
    id: 'fortune', icon: '🍀', name: 'Lucky Rolls',
    desc: 'Earn more points per roll.',
    max: 3,
    cost: (l) => [50, 110, 220][l],
    value: (l) => 15 + l * 10,                    // score points per roll
    label: (l) => `+${l * 10} pts`,
  },
  {
    id: 'spring', icon: '🦿', name: 'Springy Cheeks',
    desc: 'Jump higher, and one more time.',
    max: 2,
    cost: (l) => [70, 160][l],
    value: (l) => l,                             // extra mid-air jumps
    label: (l) => `${2 + l} jumps`,
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

let save = load();
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY)) || {};
    return { wallet: raw.wallet | 0, owned: raw.owned || {} };
  } catch {
    return { wallet: 0, owned: {} };
  }
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* ignore */ }
}

export const getWallet = () => save.wallet | 0;
export const addRolls = (n) => { save.wallet = (save.wallet | 0) + (n | 0); persist(); };
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

// Resolved gameplay effects for the current save, read once at run start.
export function effects() {
  return {
    magnet: byId('magnet').value(tierOf('magnet')),
    shields: byId('shield').value(tierOf('shield')),
    rollValue: byId('fortune').value(tierOf('fortune')),
    extraJumps: byId('spring').value(tierOf('spring')),
    headstart: byId('headstart').value(tierOf('headstart')),
  };
}

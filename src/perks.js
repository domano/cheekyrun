// In-run roguelite draft: a catalog of perks plus pure helpers.
//
// Perks fold into a "mods" accumulator (freshMods) via apply(m), one call per
// owned stack so compounding ops stack correctly. This module is pure: no DOM,
// no imports, no side effects. Draft picks use a caller-supplied seeded RNG.

// A run-modifier accumulator: neutral defaults that perks fold into.
export function freshMods() {
  return {
    speedMult: 1,
    rollMult: 1,
    rollX: 1,
    magnetBonus: 0,
    extraJumpsBonus: 0,
    comboWindowMult: 1,
    nearMissMult: 1,
    noShields: false,
    rollSpawnMult: 1,
    obstacleMult: 1,
    floatMult: 1,
    jumpOnRoll: false,
    comboCeil: 0,
    rollsNoCombo: false,   // Perfectionist: rolls stop feeding the combo (near-misses must)
    greedScale: 0,         // Magpie: roll value escalates per roll already grabbed this run
  };
}

export const PERKS = [
  { id: 'tailwind', icon: '⚡', name: 'Tailwind', desc: 'Faster pace, richer rolls.',
    rarity: 'common', weight: 100, stack: 3, apply: (m) => { m.speedMult *= 1.08; m.rollMult *= 1.10; } },
  { id: 'vacuum', icon: '🧲', name: 'Vacuum', desc: '+4 roll-magnet range.',
    rarity: 'common', weight: 80, stack: 3, apply: (m) => { m.magnetBonus += 4; } },
  { id: 'lucky', icon: '🍀', name: 'Lucky Streak', desc: '+18% points per roll.',
    rarity: 'common', weight: 100, stack: 3, apply: (m) => { m.rollMult *= 1.18; } },
  { id: 'hops', icon: '🦿', name: 'Hops', desc: 'One more mid-air jump.',
    rarity: 'common', weight: 80, stack: 2, apply: (m) => { m.extraJumpsBonus += 1; } },
  { id: 'memory', icon: '🧠', name: 'Long Memory', desc: 'Combo lasts 40% longer.',
    rarity: 'rare', weight: 50, stack: 2, apply: (m) => { m.comboWindowMult *= 1.4; } },
  // Cushion grants are a one-shot via shieldGrant (applied once in applyPerk, see
  // main.js) so a mid-run spend isn't refunded by a recompute — apply() is a no-op.
  { id: 'pillow', icon: '🛡️', name: 'Pillow Stack', desc: 'Start with +1 cushion.',
    rarity: 'rare', weight: 50, stack: 2, shieldGrant: 1, apply: () => {} },
  { id: 'daredevil', icon: '😎', name: 'Daredevil', desc: 'Near-misses pay 2×.',
    rarity: 'rare', weight: 60, stack: 2, apply: (m) => { m.nearMissMult *= 2; } },
  { id: 'doubledown', icon: '💰', name: 'Double Down', desc: 'Rolls are worth 2× always.',
    rarity: 'epic', weight: 30, stack: 1, apply: (m) => { m.rollX *= 2; } },
  { id: 'glasscannon', icon: '🥃', name: 'Glass Cannon', desc: '2× rolls, but no cushions & more hazards.',
    rarity: 'curse', weight: 30, stack: 1, apply: (m) => { m.rollX *= 2; m.obstacleMult *= 1.25; m.noShields = true; } },
  { id: 'greedygut', icon: '🤑', name: 'Greedy Gut', desc: '+60% rolls, but +25% hazards.',
    rarity: 'curse', weight: 30, stack: 2, apply: (m) => { m.rollSpawnMult *= 1.6; m.obstacleMult *= 1.25; } },
  { id: 'featherfall', icon: '🪶', name: 'Featherfall', desc: 'Hang in the air longer.',
    rarity: 'epic', weight: 22, stack: 1, apply: (m) => { m.floatMult *= 0.5; } },
  { id: 'secondwind', icon: '🌬️', name: 'Second Wind', desc: 'Grab a roll mid-air, regain a jump.',
    rarity: 'epic', weight: 22, stack: 1, apply: (m) => { m.jumpOnRoll = true; } },
  { id: 'overdrive', icon: '🏎️', name: 'Overdrive', desc: '+18% speed — pure distance.',
    rarity: 'rare', weight: 45, stack: 2, apply: (m) => { m.speedMult *= 1.18; } },
  { id: 'hotstreak', icon: '🌟', name: 'Hot Streak', desc: 'Combo cap +2.',
    rarity: 'epic', weight: 22, stack: 1, apply: (m) => { m.comboCeil += 2; } },
  { id: 'featherweight', icon: '🎈', name: 'Featherweight', desc: 'Hang way longer, but one fewer jump.',
    rarity: 'curse', weight: 26, stack: 1, apply: (m) => { m.floatMult *= 0.45; m.extraJumpsBonus -= 1; } },
  // --- Keystones: build-defining picks that change *how* you play, not just stats ---
  // A dodge build: rolls no longer feed the combo, so the only way to keep a streak
  // alive is to thread obstacles — and those near-misses pay triple.
  { id: 'perfectionist', icon: '🎯', name: 'Perfectionist', desc: 'Near-misses pay 3×, but rolls give no combo.',
    rarity: 'epic', weight: 20, stack: 1, apply: (m) => { m.nearMissMult *= 3; m.rollsNoCombo = true; } },
  // A greed build: every roll you bank makes the next ones worth more (up to +150%),
  // so a long, clean harvest snowballs.
  { id: 'magpie', icon: '🐦', name: 'Magpie', desc: 'Each roll grabbed: +1% value, up to +150%.',
    rarity: 'epic', weight: 20, stack: 1, apply: (m) => { m.greedScale += 0.01; } },
  // A high-roller curse: triple roll value, but you run bare (no cushions) through
  // a denser hazard field — pure score, no safety net.
  { id: 'allin', icon: '🎰', name: 'All In', desc: '3× rolls, but no cushions & much more danger.',
    rarity: 'curse', weight: 22, stack: 1, apply: (m) => { m.rollX *= 3; m.noShields = true; m.obstacleMult *= 1.4; } },
];

export const perkById = (id) => PERKS.find((p) => p.id === id);

// Fold a run's picked perks into a fresh mods object. perks is an array of
// { id, stacks }. Calls each perk's apply() once per stack.
export function applyPerks(perks) {
  const m = freshMods();
  for (const { id, stacks } of perks || []) {
    const p = perkById(id);
    if (!p) continue;
    for (let i = 0; i < (stacks | 0); i++) p.apply(m);
  }
  return m;
}

// Weighted draw without replacement from a candidate list, using rng ([0,1)).
function drawWeighted(pool, rng, n) {
  const cands = pool.slice(), out = [];
  while (out.length < n && cands.length) {
    const total = cands.reduce((s, p) => s + p.weight, 0);
    let r = rng() * total;
    let i = 0;
    while (i < cands.length - 1 && (r -= cands[i].weight) >= 0) i++;
    out.push(cands.splice(i, 1)[0]);
  }
  return out;
}

// Pick n distinct perks for a draft, weighted by perk.weight, using the passed
// rng. Excludes perks not in poolIds, perks in banished, and perks already at
// their stack cap in picked. Returns perk objects.
export function draftChoices(poolIds, picked, banished, rng, n = 3) {
  const stacksOf = (id) => (picked || []).find((p) => p.id === id)?.stacks | 0;
  const ban = new Set(banished || []);
  const cands = PERKS.filter((p) =>
    poolIds.includes(p.id) && !ban.has(p.id) && stacksOf(p.id) < p.stack);
  return drawWeighted(cands, rng, n);
}

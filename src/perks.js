// In-run roguelite draft: the perk catalog plus pure helpers.
//
// Perks fold into a "mods" accumulator (freshMods) via apply(m), one call per
// owned stack so compounding ops stack correctly. The helpers are pure: no DOM,
// no side effects. Draft picks use a caller-supplied seeded RNG.

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
    slam: false,           // Butt Slam: an air-duck arms a hazard-smashing landing
    coil: false,           // Coil Spring: a grounded duck arms a mega-hop jump window
    bankShare: 0,          // Piggy Bank: share of each roll diverted into the run vault
    airDash: false,        // Blink Step: airborne lane-swipes teleport (with a flash of invuln)
    kindling: 0,           // Kindling: spark-chain stacks (more = fewer near-miss links per spark)
  };
}

// EVERY perk is one self-contained file under ./perks/ (mirroring how shop
// upgrades live in ./upgrades/ — there's no hardcoded list any more). Each file
// default-exports the catalog entry (id, icon, name, desc, rarity, weight,
// stack, order, apply, optional shieldGrant) PLUS its worn 3D prop
// (build()/scale()/tick(), read by player.js). Files prefixed `_` are templates
// and skipped. See ./perks/_example.js. Dropping a new file into the folder
// puts it in the draft pool automatically.
export const PERKS = Object.entries(
  import.meta.glob('./perks/*.js', { eager: true }),
).filter(([path]) => !path.split('/').pop().startsWith('_'))
  .map(([, m]) => m.default).filter(Boolean)
  // Stable catalog order (each file's `order` field): the seeded daily draft
  // draws from PERKS by position, so a shuffle here would shift everyone's
  // daily offers between builds.
  .sort((a, b) => (a.order || 0) - (b.order || 0) || a.id.localeCompare(b.id));

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

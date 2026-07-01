// In-run power-up "boosts": rare floating gems that grant a brief effect.
//
// EVERY boost is one self-contained file under ./boosts/ (mirroring ./perks/
// and ./upgrades/ — there's no hardcoded list). Each file default-exports its
// identity (id/icon/color/label/order), availability (minLevel/weight),
// declarative effect fields consumed generically in main.js (speedMult,
// magnetFloor, scoreMult, invuln, ghostBody), an optional dress() to customize
// its pickup gem, and optional lifecycle hooks (onActivate/onTick/onEnd) for
// brand-new mechanics. Files prefixed `_` are templates and skipped — see
// ./boosts/_example.js for the full contract. Dropping a new file into the
// folder puts it in the spawn pool automatically. The shared pacing knobs
// (POWERUP_DURATION/CHANCE/MIN_DIFF/COOLDOWN) stay in config.js.
export const BOOSTS = Object.entries(
  import.meta.glob('./boosts/*.js', { eager: true }),
).filter(([path]) => !path.split('/').pop().startsWith('_'))
  .map(([, m]) => m.default).filter(Boolean)
  // Stable catalog order (each file's `order` field), so a seeded rng keeps
  // drawing the same spawn sequence between builds.
  .sort((a, b) => (a.order || 0) - (b.order || 0) || a.id.localeCompare(b.id));

export const boostById = (id) => BOOSTS.find((b) => b.id === id);

// Boosts the spawner may draw at the given level: level-gated boosts phase in
// via their minLevel (default 1 — the core four are always eligible).
export const eligibleBoosts = (level) => BOOSTS.filter((b) => (b.minLevel || 1) <= level);

// Weighted draw of one eligible boost using rng ([0,1)). With every weight at
// its default 1 this reduces to the old uniform pick — one rng() call, same
// value-to-kind mapping — so seeded spawns are unchanged.
export function drawBoost(level, rng) {
  const pool = eligibleBoosts(level);
  if (!pool.length) return null;
  const total = pool.reduce((s, b) => s + (b.weight || 1), 0);
  let r = rng() * total;
  for (const b of pool) { if ((r -= b.weight || 1) < 0) return b; }
  return pool[pool.length - 1];
}

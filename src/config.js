// Shared constants and tiny utilities used across the game.

export const LANES = [-2.2, 0, 2.2];
export const SPAWN_Z = -64;
export const DESPAWN_Z = 12;
export const INK = 0x241019;

// Full-width "gate" rows block every lane, so the only way past is the right
// action — jump a low hurdle or slide under a high bar. Side-stepping can't
// save you. These knobs tune how soon/often they appear.
export const GATE_MIN_DIFF = 0.22;    // phase in only after this much warm-up
export const GATE_CHANCE = 0.16;      // base chance on an eligible row
export const GATE_CHANCE_RAMP = 0.2;  // extra chance added at full difficulty
export const GATE_COOLDOWN = 2;       // normal rows guaranteed between gates

// Combo: grabbing rolls (and clean near-misses) in quick succession stacks a
// multiplier. The chain survives COMBO_WINDOW seconds without a pickup, then
// drops. The multiplier steps up one notch every COMBO_STEP hits, capped.
export const COMBO_WINDOW = 2.6;      // seconds a combo survives idle
export const COMBO_STEP = 4;          // hits between each +1 to the multiplier
export const COMBO_MAX = 5;           // multiplier ceiling
export const comboMult = (c) => Math.min(COMBO_MAX, 1 + Math.floor(c / COMBO_STEP));

// Near-miss: clearing an obstacle this close (lane units beyond its half-width)
// without touching it pays a small bonus and feeds the combo.
export const NEARMISS_MARGIN = 0.7;
export const NEARMISS_BONUS = 6;

// In-run power-ups: a rare floating gem that grants a brief effect. Spaced out
// by a row cooldown so grabbing one feels like an event, not a given.
export const POWERUP_DURATION = 6;     // seconds an effect lasts
export const POWERUP_CHANCE = 0.06;    // chance on an eligible (off-cooldown) row
export const POWERUP_MIN_DIFF = 0.12;  // only after a short warm-up
export const POWERUP_COOLDOWN = 14;    // rows guaranteed between power-up spawns
export const POWERUPS = {
  magnet: { icon: '🧲', color: 0x4fd0ff, label: 'Magnet' },
  x2:     { icon: '✨', color: 0xffd23f, label: '2× Score' },
  ghost:  { icon: '👻', color: 0xc9a7ff, label: 'Ghost' },
};
export const POWERUP_KINDS = Object.keys(POWERUPS);

// DOM lookup shorthand.
export const $ = (id) => document.getElementById(id);

// Haptic buzz (no-op on platforms without the Vibration API).
export const buzz = (ms) => { if (navigator.vibrate) navigator.vibrate(ms); };

// In-place Fisher–Yates shuffle.
export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

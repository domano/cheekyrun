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

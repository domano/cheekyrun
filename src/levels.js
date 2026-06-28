// Level progression + biome themes.
//
// A run is divided into levels by distance travelled. Every level the world
// cycles to the next biome — a fresh palette for the sky, fog, ground, path,
// hills and the sun/moon disc — and the pace nudges up a notch.

// Distance (in world units) covered per level.
export const LEVEL_DIST = 250;

// Visual themes the run rotates through, one per level. Colours are plain hex.
// `bg` is the four-stop CSS gradient painted behind the (transparent) canvas,
// i.e. the sky. `obstacles` names the lane-obstacle kinds this biome draws from
// (factories in props.js) so each stage has its own props, not just a palette:
// `jump` kinds are cleared by jumping, `duck` is the slide-under bar.
// Per-biome fields beyond palette:
// `air` is the fog band (near/far world units) — how far you can see, which sets
//   the stage's mood and how much reaction room a run gives.
// `play` tweaks gameplay so a biome is a different *place to play*, not just a
//   recolor: gateBias/hazardBias/rollBias scale spawn chances, rowMult scales the
//   gap between rows. Defaults are 1 (see biomePlay/biomeAir below).
export const BIOMES = [
  {
    name: 'Meadow',
    bg: ['#8fd3ff', '#bfe4ff', '#ffd2e2', '#ffe2c4'],
    fog: 0xffe1d6,
    ground: 0x7fd167,
    path: 0xc29a63,
    hills: [0x8fd16f, 0x79c283, 0x9bd778],
    disc: 0xfff2b0,
    obstacles: { jump: ['cactus', 'rock'], duck: 'branch' },
    air: { near: 32, far: 64 },                 // open, gentle — the warm-up stage
    play: {},                                   // neutral baseline
  },
  {
    name: 'Sunset',
    bg: ['#ffd194', '#ffae8b', '#ff7a88', '#a85aa3'],
    fog: 0xffc6a0,
    ground: 0xd9b46a,
    path: 0xbb8a58,
    hills: [0xe08a5a, 0xd06a6a, 0xe0a060],
    disc: 0xffd27f,
    obstacles: { jump: ['barrel', 'boulder'], duck: 'bar' },
    air: { near: 30, far: 60 },
    play: { gateBias: 1.5 },                    // golden-hour gauntlet: more full-width gates
  },
  {
    name: 'Twilight',
    bg: ['#2b2d5e', '#46337e', '#6d4b8f', '#caa1c9'],
    fog: 0x4a3a6a,
    ground: 0x5a7a8c,
    path: 0x6a6a8a,
    hills: [0x4a5a8a, 0x3a4a7a, 0x5a6a9a],
    disc: 0xeef0ff,
    obstacles: { jump: ['crystal', 'tombstone'], duck: 'beam' },
    air: { near: 22, far: 48 },                 // close, murky — you see hazards later
    play: { hazardBias: 1.25, rollBias: 0.9 },  // tense: more compound hazards, fewer rolls
  },
  {
    name: 'Candyland',
    bg: ['#ffd1ec', '#ffc2e2', '#ffb3d9', '#ffd6a5'],
    fog: 0xffd6ee,
    ground: 0xf589b5,
    path: 0xb07ad6,
    hills: [0xff9ec9, 0xffb3d9, 0xffc2a8],
    disc: 0xfff0a0,
    obstacles: { jump: ['candycane', 'gumdrop'], duck: 'licorice' },
    air: { near: 34, far: 66 },                 // bright, airy
    play: { rollBias: 1.4, rowMult: 0.92 },     // sugar rush: dense rolls, tighter spacing
  },
];

// Default biome gameplay knobs; each BIOMES entry overrides only what it changes.
const PLAY_DEFAULTS = { gateBias: 1, hazardBias: 1, rollBias: 1, rowMult: 1 };

// Level 1 starts at distance 0; each LEVEL_DIST after that bumps the level.
export const levelFromDistance = (d) => Math.floor(d / LEVEL_DIST) + 1;

// Theme for a given level, cycling through BIOMES.
export const biomeOf = (level) => BIOMES[(level - 1) % BIOMES.length];

// The lane-obstacle roster for a level's biome ({ jump: [...], duck }).
export const obstacleSet = (level) => biomeOf(level).obstacles;

// Resolved gameplay knobs for a level's biome (defaults filled in).
export const biomePlay = (level) => ({ ...PLAY_DEFAULTS, ...(biomeOf(level).play || {}) });
// The fog band for a level's biome.
export const biomeAir = (level) => biomeOf(level).air || { near: 32, far: 64 };

// Fraction (0..1) of the way through the current level.
export const levelProgress = (d) => (d % LEVEL_DIST) / LEVEL_DIST;

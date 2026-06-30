// Level progression + biome themes.
//
// A run is divided into levels by distance travelled. Every level the world
// cycles to the next biome — a fresh palette for the sky, fog, ground, path,
// hills and the sun/moon disc — and the pace nudges up a notch.

// Distance (in world units) covered by the FIRST level. Levels grow longer as
// the run speeds up (see levelLength), so a faster stage isn't a shorter one and
// the level beats stay a comfortable, roughly constant length of time apart.
export const LEVEL_DIST = 380;
// How much longer each successive level is. Matched to the per-level speed-up in
// main.js (speed scales ~+0.045/level): growing length at the same rate as pace
// keeps each level lasting about the same time even as you rip faster.
export const LEVEL_GROWTH = 0.045;

// Each level ends in a calm "finish" stretch: hazard spawns pause and a banner
// crosses the track at the level boundary, so the level change (and any upgrade
// draft) lands in open space rather than on top of an obstacle. FINISH_CLEAR is
// the half-width, in world units, of that obstacle-free corridor centred on the
// line — see spawnRow()'s finish-stretch guard in main.js.
export const FINISH_CLEAR = 34;

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

// Distance a single (1-indexed) level spans. Linear growth keeps the cumulative
// maths closed-form and the pacing predictable.
export const levelLength = (n) => LEVEL_DIST * (1 + LEVEL_GROWTH * (n - 1));

// Distance at which level n begins — the closed form of Σ levelLength(1..n-1).
// levelStart(1) === 0, levelStart(2) === LEVEL_DIST.
export const levelStart = (n) => {
  const m = n - 1;                                 // levels completed before n
  return LEVEL_DIST * (m + (LEVEL_GROWTH * m * (m - 1)) / 2);
};

// Level 1 starts at distance 0; each successive (growing) level bumps it.
export const levelFromDistance = (d) => { let n = 1; while (d >= levelStart(n + 1)) n++; return n; };

// Theme for a given level, cycling through BIOMES.
export const biomeOf = (level) => BIOMES[(level - 1) % BIOMES.length];

// The lane-obstacle roster for a level's biome ({ jump: [...], duck }).
export const obstacleSet = (level) => biomeOf(level).obstacles;

// Resolved gameplay knobs for a level's biome (defaults filled in).
export const biomePlay = (level) => ({ ...PLAY_DEFAULTS, ...(biomeOf(level).play || {}) });
// The fog band for a level's biome.
export const biomeAir = (level) => biomeOf(level).air || { near: 32, far: 64 };

// Fraction (0..1) of the way through the current (growing) level.
export const levelProgress = (d) => {
  const n = levelFromDistance(d);
  return Math.min(1, Math.max(0, (d - levelStart(n)) / levelLength(n)));
};

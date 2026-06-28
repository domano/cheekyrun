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
export const BIOMES = [
  {
    name: 'Meadow',
    bg: ['#8fd3ff', '#bfe4ff', '#ffd2e2', '#ffe2c4'],
    fog: 0xffe1d6,
    ground: 0x95df7d,
    path: 0xe7c49c,
    hills: [0x8fd16f, 0x79c283, 0x9bd778],
    disc: 0xfff2b0,
    obstacles: { jump: ['cactus', 'rock'], duck: 'branch' },
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
  },
  {
    name: 'Candyland',
    bg: ['#ffd1ec', '#ffc2e2', '#ffb3d9', '#ffd6a5'],
    fog: 0xffd6ee,
    ground: 0xffb3d1,
    path: 0xffe0b3,
    hills: [0xff9ec9, 0xffb3d9, 0xffc2a8],
    disc: 0xfff0a0,
    obstacles: { jump: ['candycane', 'gumdrop'], duck: 'licorice' },
  },
];

// Level 1 starts at distance 0; each LEVEL_DIST after that bumps the level.
export const levelFromDistance = (d) => Math.floor(d / LEVEL_DIST) + 1;

// Theme for a given level, cycling through BIOMES.
export const biomeOf = (level) => BIOMES[(level - 1) % BIOMES.length];

// The lane-obstacle roster for a level's biome ({ jump: [...], duck }).
export const obstacleSet = (level) => biomeOf(level).obstacles;

// Fraction (0..1) of the way through the current level.
export const levelProgress = (d) => (d % LEVEL_DIST) / LEVEL_DIST;

// Level progression + biome themes.
//
// A run is divided into levels by distance travelled. Every level the world
// cycles to the next biome — a fresh palette for the sky, fog, ground, path,
// hills and the sun/moon disc — and the pace nudges up a notch.

// Distance (in world units) covered per level. Legacy fixed grid — stages now
// size themselves to your speed (see stageLength below); kept for the headstart
// head-distance and any external reference.
export const LEVEL_DIST = 250;

// --- Stage length ---
// A stage's run of obstacles grows with how fast you're going, so a quick run
// gets longer stages (roughly constant *time* on each) instead of blitzing
// through them. Computed once when a stage begins, from the live speed.
export const STAGE_BASE = 360;        // a stage's length (world units) at base speed
export const STAGE_PER_SPEED = 14;    // extra length per unit of speed over the base
export const STAGE_BASE_SPEED = 12.5; // the run's starting speed — no bonus at/below it
export const stageLength = (speed) =>
  STAGE_BASE + STAGE_PER_SPEED * Math.max(0, speed - STAGE_BASE_SPEED);

// The clear run-up reserved at a stage's tail: obstacle spawning stops this far
// before the finish line, so the line — and the level-up draft it triggers —
// lands on empty road instead of on top of a hazard.
export const STAGE_LEAD = 40;

// Visual themes the run rotates through, one per level. Colours are plain hex.
// `bg` is the four-stop CSS gradient painted behind the (transparent) canvas,
// i.e. the sky. `obstacles` names the lane-obstacle kinds this biome draws from
// (factories in props.js) so each stage has its own props, not just a palette:
// `jump` kinds are cleared by jumping, `duck` is the slide-under bar.
// Per-biome fields beyond palette:
// `scenery` is the roadside-decoration roster (factories in props.js) lining the
//   track shoulders, so each stage's *flora* is its own, not just its palette —
//   the leafy tree lives in the Meadow it fits, the desert gets a saguaro, etc.
//   Listed with repeats to weight the random pick.
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
    scenery: ['tree', 'tree', 'bush', 'flower'],   // leafy & green — the tree's home
    air: { near: 40, far: 72 },                 // open, gentle — the warm-up stage
    play: {},                                   // neutral baseline
  },
  {
    name: 'Sunset',
    bg: ['#ffd194', '#ffae8b', '#ff7a88', '#a85aa3'],
    // Authored darker than the perceived target — the sRGB output lift + warm
    // fog brighten everything a band, so pale hexes here render snow-white.
    fog: 0xffc6a0,
    ground: 0xe6cc8e,
    path: 0xcf9f5e,
    hills: [0xe08a5a, 0xd06a6a, 0xe0a060],
    disc: 0xffd27f,
    obstacles: { jump: ['barrel', 'boulder'], duck: 'bar' },
    scenery: ['saguaro', 'deadbush', 'deadbush', 'desertrock'],   // warm desert
    air: { near: 38, far: 70 },
    play: { gateBias: 1.5 },                    // golden-hour gauntlet: more full-width gates
  },
  {
    name: 'Twilight',
    bg: ['#2b2d5e', '#46337e', '#6d4b8f', '#caa1c9'],
    fog: 0x4a3c6e,
    ground: 0x5a7a8c,
    path: 0x4d4d72,
    hills: [0x4a5a8a, 0x3a4a7a, 0x5a6a9a],
    disc: 0xeef0ff,
    obstacles: { jump: ['crystal', 'tombstone'], duck: 'beam' },
    scenery: ['deadtree', 'deadtree', 'mushroom', 'crystalcluster'],   // spooky night
    air: { near: 34, far: 58 },                 // close, murky — you see hazards later
    play: { hazardBias: 1.25, rollBias: 0.9 },  // tense: more compound hazards, fewer rolls
  },
  {
    name: 'Candyland',
    // Value anchors so pink-on-pink still reads: darker sky top, pale ground,
    // and the berry path as the darkest band — the frame keeps its romance
    // without smothering the hazards.
    bg: ['#ff9ec6', '#ffb9d8', '#ffd4e6', '#ffe9f2'],
    fog: 0xffd0e6,
    ground: 0xf6bfda,
    path: 0xc77bd9,
    hills: [0xe79bc2, 0xdf8fba, 0xf0aed0],
    disc: 0xfff0a0,
    obstacles: { jump: ['candycane', 'gumdrop'], duck: 'licorice' },
    scenery: ['lollipop', 'lollipop', 'candybush', 'peppermint'],   // bright sweets
    air: { near: 42, far: 72 },                 // bright, airy
    play: { rollBias: 1.4, rowMult: 0.92 },     // sugar rush: dense rolls, tighter spacing
  },
  {
    name: 'Frostpeak',
    bg: ['#cdeeff', '#a9d8f0', '#dfeefc', '#cfe0ff'],
    fog: 0xdaf0ff,
    ground: 0xdfeef7,
    path: 0x9fbcd0,
    hills: [0xbcd9ec, 0xa9cce0, 0xd6e9f5],
    disc: 0xeaf6ff,
    obstacles: { jump: ['icespike', 'snowman'], duck: 'frostbar' },
    scenery: ['pine', 'pine', 'snowmound', 'iceshard'],   // icy tundra — snow-capped pines
    air: { near: 34, far: 64 },                 // a crisp, biting blue haze
    play: { hazardBias: 1.15 },                 // frostbite: more compound hazards
  },
  {
    name: 'Ember',
    bg: ['#3a1410', '#6e2410', '#b8431a', '#e08a2a'],
    fog: 0x5a2418,
    ground: 0x8a6560,
    path: 0x5e423a,
    hills: [0x5a2418, 0x7a2e1a, 0x9a3a1a],
    disc: 0xff8a3a,
    obstacles: { jump: ['lavarock', 'emberspire'], duck: 'emberbar' },
    scenery: ['charredtree', 'charredtree', 'basaltrock', 'cinder'],   // volcanic ashlands
    air: { near: 26, far: 52 },                 // choking ash — hazards loom late
    play: { hazardBias: 1.3, rollBias: 0.85 },  // brutal: dense hazards, scarce rolls
  },
  {
    name: 'Reef',
    bg: ['#0a6e8a', '#1894b0', '#5fc8d8', '#bdeef0'],
    fog: 0x3aa9c0,
    ground: 0xe6d8a0,
    path: 0xccb878,
    hills: [0x2f9fb8, 0x49b8c8, 0x7fd0d8],
    disc: 0xfff6c0,
    obstacles: { jump: ['coral', 'clam'], duck: 'kelp' },
    scenery: ['seaweed', 'seaweed', 'coralnub', 'anemone'],   // sunlit coral seabed
    air: { near: 38, far: 68 },                 // clear, sunlit shallows
    play: { rollBias: 1.25, rowMult: 0.95 },    // current sweep: dense rolls, flowing rows
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

// The roadside-scenery roster for a level's biome (weighted kind list). Falls
// back to the Meadow set so a biome without its own scenery still decorates.
export const scenerySet = (level) => biomeOf(level).scenery || BIOMES[0].scenery;

// Resolved gameplay knobs for a level's biome (defaults filled in).
export const biomePlay = (level) => ({ ...PLAY_DEFAULTS, ...(biomeOf(level).play || {}) });
// The fog band for a level's biome.
export const biomeAir = (level) => biomeOf(level).air || { near: 40, far: 72 };

// Fraction (0..1) of the way through the current level.
export const levelProgress = (d) => (d % LEVEL_DIST) / LEVEL_DIST;

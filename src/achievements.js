// Milestones that unlock once and persist. Each declares a `metric()` over a flat
// context (lifetime stats + best score, folded in with the just-finished run) and
// a `goal`; the badge unlocks the moment metric >= goal. Pure data, mirroring the
// UPGRADES style — add a row to add a badge.
//
// Design: the ladder is deliberately spaced across *many* runs, not front-loaded
// into the first one. A few starter badges fall early; the bulk are tiered depth
// (level 5→20), combo (8→30) and lifetime grinds (runs, total rolls, total
// distance) that only fill in over a career. Every row exposes its `metric`/`goal`
// so the grid can draw a live "3 / 10" progress bar — the player always sees both
// *what* to do and *how close* they are.
//
// `reward` is a one-time roll payout, banked into the shop wallet the moment the
// badge is earned — so the achievement grid doubles as a goal list that funds the
// shop, instead of paying nothing but a glow.

import { hasAch, unlock, getStats, getBest } from './save.js';

export const ACHIEVEMENTS = [
  // starters — the first run or two
  { id: 'first',     icon: '🏁', name: 'Off and Running', desc: 'Finish your first run.',            reward: 25,  goal: 1,     unit: 'run',  metric: (c) => c.runs },
  { id: 'power',     icon: '💎', name: 'Power Trip',       desc: 'Grab a power-up.',                  reward: 30,  goal: 1,     unit: '',     metric: (c) => c.power ? 1 : 0 },
  { id: 'level5',    icon: '🌄', name: 'Globetrotter',     desc: 'Reach level 5 in a single run.',    reward: 40,  goal: 5,     unit: 'lvl',  metric: (c) => c.level },
  // depth ladder — deeper runs, spread over practice + upgrades
  { id: 'combo8',    icon: '🔥', name: 'On a Roll',        desc: 'Build an 8-grab combo.',            reward: 40,  goal: 8,     unit: 'x',    metric: (c) => c.combo },
  { id: 'level10',   icon: '🏔️', name: 'Unstoppable',      desc: 'Reach level 10 in a single run.',   reward: 90,  goal: 10,    unit: 'lvl',  metric: (c) => c.level },
  { id: 'combo16',   icon: '⚡', name: 'Cheek Streak',     desc: 'Build a 16-grab combo.',            reward: 90,  goal: 16,    unit: 'x',    metric: (c) => c.combo },
  { id: 'score2000', icon: '⭐', name: 'High Roller',      desc: 'Score 2,000 in one run.',           reward: 70,  goal: 2000,  unit: 'pts',  metric: (c) => c.best },
  { id: 'level15',   icon: '🚀', name: 'Stratospheric',    desc: 'Reach level 15 in a single run.',   reward: 170, goal: 15,    unit: 'lvl',  metric: (c) => c.level },
  { id: 'combo30',   icon: '☄️', name: 'Comet Cheeks',     desc: 'Build a 30-grab combo.',            reward: 220, goal: 30,    unit: 'x',    metric: (c) => c.combo },
  { id: 'score5000', icon: '🌟', name: 'Cheek Legend',     desc: 'Score 5,000 in one run.',           reward: 200, goal: 5000,  unit: 'pts',  metric: (c) => c.best },
  { id: 'level20',   icon: '🛰️', name: 'Escape Velocity',  desc: 'Reach level 20 in a single run.',   reward: 340, goal: 20,    unit: 'lvl',  metric: (c) => c.level },
  // lifetime grinds — only fill in over a whole career of runs
  { id: 'runs10',    icon: '🎽', name: 'Getting Warm',     desc: 'Finish 10 runs.',                   reward: 60,  goal: 10,    unit: 'runs', metric: (c) => c.runs },
  { id: 'dist10k',   icon: '📏', name: 'Marathon Cheeks',  desc: 'Run 10 km in total.',               reward: 100, goal: 10000, unit: 'm',    metric: (c) => c.dist },
  { id: 'rolls2500', icon: '🧻', name: 'Stockpiler',       desc: 'Bank 2,500 rolls in total.',        reward: 120, goal: 2500,  unit: '🧻',   metric: (c) => c.rolls },
  { id: 'runs50',    icon: '🎖️', name: 'Die-hard',         desc: 'Finish 50 runs.',                   reward: 250, goal: 50,    unit: 'runs', metric: (c) => c.runs },
  { id: 'dist50k',   icon: '🗺️', name: 'Globe Cheeks',     desc: 'Run 50 km in total.',               reward: 350, goal: 50000, unit: 'm',    metric: (c) => c.dist },
  { id: 'rolls10k',  icon: '🏦', name: 'Roll Tycoon',      desc: 'Bank 10,000 rolls in total.',       reward: 500, goal: 10000, unit: '🧻',   metric: (c) => c.rolls },
  { id: 'runs100',   icon: '👑', name: 'Centurion',        desc: 'Finish 100 runs.',                  reward: 750, goal: 100,   unit: 'runs', metric: (c) => c.runs },
];

// Build the flat metric context: lifetime stats + best score, merged with a
// just-finished run's peaks when one is supplied. Lifetime maxes already fold in
// the run at game over (stats are bumped first), so at menu time `run` is omitted
// and the same fields read straight from the save. `power` has no lifetime
// counter — a run that grabbed one, or an already-earned badge, satisfies it.
export function achContext(run = null) {
  const s = getStats();
  return {
    runs:  s.runs,
    dist:  s.dist,
    rolls: s.rolls,
    combo: Math.max(s.maxCombo | 0, run?.comboMax | 0),
    level: Math.max(s.maxLevel | 0, run?.level | 0),
    best:  Math.max(getBest(), run?.score | 0),
    power: !!(run && run.gotPower) || hasAch('power'),
  };
}

// Has this context earned the badge?
export const passed = (a, c) => a.metric(c) >= a.goal;

// Live progress toward a badge: current value clamped to the goal, the goal, and
// the 0..1 fraction — enough for the grid to draw a bar and a "cur / goal" label.
export function progressFor(a, c) {
  const cur = Math.max(0, Math.min(a.metric(c), a.goal));
  return { cur, goal: a.goal, frac: a.goal ? cur / a.goal : 1 };
}

// Returns the achievements newly unlocked by this run (and marks them).
export function checkAchievements(run) {
  const c = achContext(run);
  const newly = [];
  for (const a of ACHIEVEMENTS) if (!hasAch(a.id) && passed(a, c)) { unlock(a.id); newly.push(a); }
  return newly;
}

// Total one-time roll reward across a set of just-earned achievements.
export const rewardFor = (list) => list.reduce((s, a) => s + (a.reward || 0), 0);

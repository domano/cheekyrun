// Milestones that unlock once and persist. Each declares a test() over a small
// context built at game over: the just-finished run plus lifetime stats. Pure
// data, mirroring the UPGRADES style — add a row to add a badge.
//
// `reward` is a one-time roll payout, banked into the shop wallet the moment the
// badge is earned — so the achievement grid doubles as a goal list that funds the
// shop, instead of paying nothing but a glow.

import { hasAch, unlock } from './save.js';

export const ACHIEVEMENTS = [
  { id: 'first',     icon: '🏁', name: 'Off and Running', desc: 'Finish your first run.',      reward: 25,  test: (c) => c.stats.runs >= 1 },
  { id: 'level5',    icon: '🌄', name: 'Globetrotter',    desc: 'Reach level 5.',              reward: 40,  test: (c) => c.run.level >= 5 },
  { id: 'level10',   icon: '🏔️', name: 'Unstoppable',     desc: 'Reach level 10.',             reward: 80,  test: (c) => c.run.level >= 10 },
  { id: 'combo8',    icon: '🔥', name: 'On a Roll',       desc: 'Build an 8-grab combo.',      reward: 40,  test: (c) => c.run.comboMax >= 8 },
  { id: 'combo16',   icon: '⚡', name: 'Cheek Streak',    desc: 'Build a 16-grab combo.',      reward: 80,  test: (c) => c.run.comboMax >= 16 },
  { id: 'combo24',   icon: '☄️', name: 'Comet Cheeks',    desc: 'Build a 24-grab combo.',      reward: 150, test: (c) => c.run.comboMax >= 24 },
  { id: 'level15',   icon: '🚀', name: 'Stratospheric',   desc: 'Reach level 15.',             reward: 150, test: (c) => c.run.level >= 15 },
  { id: 'score1500', icon: '⭐', name: 'High Roller',     desc: 'Score 1,500 in one run.',     reward: 60,  test: (c) => c.run.score >= 1500 },
  { id: 'score3000', icon: '🌟', name: 'Cheek Legend',    desc: 'Score 3,000 in one run.',     reward: 120, test: (c) => c.run.score >= 3000 },
  { id: 'power',     icon: '💎', name: 'Power Trip',      desc: 'Grab a power-up.',            reward: 30,  test: (c) => c.run.gotPower },
  { id: 'rolls500',  icon: '🧻', name: 'Stockpiler',      desc: 'Bank 500 rolls in total.',    reward: 60,  test: (c) => c.stats.rolls >= 500 },
  { id: 'dist5k',    icon: '📏', name: 'Marathon Cheeks', desc: 'Run 5 km in total.',          reward: 60,  test: (c) => c.stats.dist >= 5000 },
];

// Returns the achievements newly unlocked by this context (and marks them).
export function checkAchievements(ctx) {
  const newly = [];
  for (const a of ACHIEVEMENTS) if (!hasAch(a.id) && a.test(ctx)) { unlock(a.id); newly.push(a); }
  return newly;
}

// Total one-time roll reward across a set of just-earned achievements.
export const rewardFor = (list) => list.reduce((s, a) => s + (a.reward || 0), 0);

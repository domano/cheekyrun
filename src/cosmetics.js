// Player skins — pure recolours of the character's cheeks, ear linings and
// tail. Bought with rolls, or unlocked free by earning a specific achievement.
// Declarative like UPGRADES: add a row to add a skin.

import { skinOwned, ownSkin, hasAch, spend } from './save.js';

export const SKINS = [
  { id: 'classic', name: 'Classic', cost: 0,                    skin: 0xffdcc6, inner: 0xff92ac, tail: 0xffffff },
  { id: 'choco',   name: 'Choco',   cost: 120,                  skin: 0x9c6a44, inner: 0xd79a64, tail: 0xf3e1c8 },
  { id: 'mint',    name: 'Mint',    cost: 120,                  skin: 0x9fe3bd, inner: 0x59c48a, tail: 0xffffff },
  { id: 'berry',   name: 'Berry',   cost: 220,                  skin: 0xb98cff, inner: 0xff8fd0, tail: 0xfff0ff },
  { id: 'ember',   name: 'Ember',   cost: 320,                  skin: 0xff7a5a, inner: 0xffd25a, tail: 0xffe0c0 },
  { id: 'golden',  name: 'Golden',  cost: 0, ach: 'level10',    skin: 0xffd166, inner: 0xffb347, tail: 0xfff6d0 },
  { id: 'shadow',  name: 'Shadow',  cost: 0, ach: 'combo16',    skin: 0x6a6a8c, inner: 0xa6a6e0, tail: 0xd6d6ff },
];

export const skinById = (id) => SKINS.find((s) => s.id === id) || SKINS[0];

// Owned = free default, an achievement reward you've earned, or a bought skin.
export function skinUnlocked(s) {
  if (s.ach) return hasAch(s.ach);
  return s.cost === 0 || skinOwned(s.id);
}

// Buy a roll-priced skin; returns true on success. Achievement skins aren't buyable.
export function buySkin(id) {
  const s = skinById(id);
  if (s.ach || skinUnlocked(s)) return false;
  if (!spend(s.cost)) return false;
  ownSkin(id);
  return true;
}

// Recolour the live player materials to a skin.
export function applySkin(mats, id) {
  const s = skinById(id);
  mats.skin.color.setHex(s.skin);
  mats.inner.color.setHex(s.inner);
  mats.tail.color.setHex(s.tail);
}

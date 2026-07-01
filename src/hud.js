// Menu / card / shop DOM rendering, split out of main.js.
//
// These are the persistent-screen painters: the roguelite-lab shop, lifetime
// stats, the daily-button label, the achievement grid + unlock fanfare, the
// cosmetics picker, the reset-save flow, and the game-over highlight strip.
// They read the save and other modules directly and write the DOM — they hold
// no live run state. The two things they DO need from the running game (the
// live player materials for skin swaps, and the reduced-motion preference) are
// injected once via configureHud() before the first render.

import { $, buzz, comboMult, dailyKey } from './config.js';
import { UPGRADES, tierOf, nextCost, nextGate, buy, getWallet, META, buyMeta, unlockedPerkIds } from './upgrades.js';
import { perkById } from './perks.js';
import { getBoon, setBoon, getRerolls, getBanishes, poolHas, getBest, getStats, getHistory, hasAch, getDailyBest, getDailyStreak, resetSave, selectedSkin, selectSkin } from './save.js';
import { ACHIEVEMENTS, achContext, progressFor } from './achievements.js';
import { SKINS, skinById, skinUnlocked, buySkin, applySkin } from './cosmetics.js';
import { ensureAudio, sfxCoin, sfxLane } from './audio.js';

// Injected from main.js (see configureHud): the live player materials for skin
// swaps + a reader for the OS reduced-motion preference.
let playerMats = null;
let reduceMotionRef = () => false;
export function configureHud(deps) {
  playerMats = deps.playerMats;
  if (deps.getReduceMotion) reduceMotionRef = deps.getReduceMotion;
}

/* ---------------- meta shop (roguelite lab) ---------------- */
// The wallet now buys roguelite meta: the permanent floor (Cushion, Head Start),
// perk-pool unlocks, reroll/banish charges, and a starting boon.
export function renderShop() {
  const wallet = getWallet();
  // permanent floor upgrades (tiered)
  const floor = UPGRADES.map(u => {
    const l = tierOf(u.id), c = nextCost(u.id), maxed = c === null;
    const gate = maxed ? null : nextGate(u.id);    // a prestige tier still fenced behind a skill milestone
    const afford = !maxed && !gate && wallet >= c;
    const dots = Array.from({ length: u.max }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('');
    const cls = `up${maxed ? ' maxed' : gate ? ' locked' : (afford ? '' : ' poor')}`;
    const tag = maxed ? 'MAX' : gate ? `🔒 ${gate.label}` : c + ' 🧻';
    return `<button class="${cls}" data-id="${u.id}"${maxed || gate ? ' disabled' : ''}>
      <span class="upi">${u.icon}</span><span class="upn">${u.name}</span><span class="upd">${u.desc}</span>
      <span class="upmeta"><span class="updots">${dots}</span><span class="upc">${tag}</span></span>
    </button>`;
  }).join('');
  // meta items: perk-pool unlocks + reroll/banish charge packs
  const metaGrid = META.map(m => {
    const owned = m.kind === 'unlock' && poolHas(m.perk), afford = wallet >= m.cost;
    const have = m.kind === 'reroll' ? getRerolls() : m.kind === 'banish' ? getBanishes() : 0;
    const curse = m.kind === 'unlock' && perkById(m.perk)?.rarity === 'curse';
    const cls = `up${owned ? ' owned' : (afford ? '' : ' poor')}${curse ? ' curse' : ''}`;
    const left = have ? `<span class="updots have">×${have}</span>` : '<span class="updots"></span>';
    const right = owned ? '<span class="upc inpool">IN POOL</span>' : `<span class="upc">${m.cost} 🧻</span>`;
    return `<button class="${cls}" data-meta="${m.id}"${owned ? ' disabled' : ''}>
      <span class="upi">${m.icon}</span><span class="upn">${m.name}</span><span class="upd">${m.desc}</span>
      <span class="upmeta">${left}${right}</span>
    </button>`;
  }).join('');
  // starting boon picker — any unlocked perk, or none
  const boon = getBoon();
  const chips = [`<button class="boonchip${boon ? '' : ' on'}" data-boon="">🚫 none</button>`]
    .concat(unlockedPerkIds().map(id => { const p = perkById(id);
      return `<button class="boonchip${boon === id ? ' on' : ''}" data-boon="${id}">${p.icon} ${p.name}</button>`; })).join('');
  // First-timers have an empty wallet — tell them where rolls come from instead
  // of leaving a wall of greyed-out, unaffordable buttons unexplained.
  const note = wallet === 0
    ? `Grab 🧻 rolls while you run — you'll bank them here to spend.`
    : `Spend your banked 🧻 rolls on permanent boosts and new perks.`;
  document.querySelectorAll('.shop').forEach(root => {
    root.innerHTML = `<div class="shophead"><span>🧪 Roguelite Lab</span><span class="wallet">🧻 ${wallet}</span></div>
      <p class="shopnote">${note}</p>
      <h4 class="shopsub">🛡️ Permanent boosts</h4>
      <div class="shopgrid">${floor}</div>
      <h4 class="shopsub">🔓 Perk unlocks <small>add new cards to your level-up draft</small></h4>
      <div class="shopgrid">${metaGrid}</div>
      <h4 class="shopsub">🎁 Starting boon <small>begin every run with one perk</small></h4>
      <div class="boongrid">${chips}</div>`;
  });
  document.querySelectorAll('.shop .up[data-id]').forEach(b => {
    b.onclick = (e) => { e.stopPropagation(); ensureAudio(); if (buy(b.dataset.id)) { sfxCoin(); buzz(18); renderShop(); renderCosmetics(); } else buzz(25); };
  });
  document.querySelectorAll('.shop .up[data-meta]').forEach(b => {
    b.onclick = (e) => { e.stopPropagation(); ensureAudio(); if (buyMeta(b.dataset.meta)) { sfxCoin(); buzz(18); renderShop(); } else buzz(25); };
  });
  document.querySelectorAll('.shop .boonchip').forEach(b => {
    b.onclick = (e) => { e.stopPropagation(); ensureAudio(); setBoon(b.dataset.boon || null); sfxLane(); buzz(12); renderShop(); };
  });
}

// Paint the highlight chips onto the game-over card (hidden when nothing notable).
// The list itself is computed in main.js (runHighlights) from live run state.
export function renderHighlights(list = []) {
  const box = $('goHighlights'); if (!box) return;
  box.innerHTML = list.map(h => `<span>${h}</span>`).join('');
  box.classList.toggle('hide', list.length === 0);
}

// Lifetime stats + persistent best, shown on the menu and game-over cards.
export function renderStats() {
  const s = getStats(), km = (s.dist / 1000).toFixed(1);
  const html = `<span>🏆 Best ${getBest()}</span><span>🏃 ${s.runs} run${s.runs === 1 ? '' : 's'}</span><span>🧻 ${s.rolls}</span><span>🔥 x${comboMult(s.maxCombo)}</span><span>📏 ${km}km</span>`;
  // A tiny trend strip of recent runs: a legible "beat yesterday" goal even when
  // you're nowhere near your lifetime best. Bars scale to the window's high score.
  const h = getHistory();
  let spark = '';
  if (h.length > 1) {
    const mx = Math.max(...h.map(e => e.score), 1);
    const bars = h.map((e, i) => `<i style="height:${Math.max(10, Math.round(e.score / mx * 100))}%"${i === h.length - 1 ? ' class="last"' : ''} title="Lv ${e.level} · ${e.score}"></i>`).join('');
    spark = `<div class="spark" title="Your last ${h.length} runs">${bars}</div>`;
  }
  document.querySelectorAll('.stats').forEach(el => { el.innerHTML = html + spark; });
}

// The daily-challenge button label carries today's best for this seeded course.
export function renderDaily() {
  const day = dailyKey(), b = getDailyBest(day), st = getDailyStreak(day);
  const streak = st > 1 ? ` · 🔥${st}` : '';
  $('dailyBtn').textContent = b > 0 ? `📅 Daily · best ${b}${streak}` : (st > 1 ? `📅 Daily${streak}` : '📅 Daily Challenge');
}

// Wipe all persistent progress behind a confirm dialog, then rebuild the menu
// so the fresh (empty) save is reflected everywhere at once.
export function bindResetSave() {
  const dlg = $('resetConfirm');
  const close = () => dlg.classList.add('hide');
  $('resetBtn').onclick = () => { ensureAudio(); buzz(12); dlg.classList.remove('hide'); };
  $('resetNo').onclick = () => { buzz(8); close(); };
  dlg.onclick = (e) => { if (e.target === dlg) close(); };   // tap the scrim to dismiss
  $('resetYes').onclick = () => {
    close();
    resetSave();
    applySkin(playerMats, selectedSkin());
    // Rebuild every menu panel so the wiped save shows everywhere at once. The HUD
    // is hidden on the menu, so there's nothing to refresh there.
    renderShop(); renderStats(); renderAchievements(); renderCosmetics(); renderDaily();
    sfxLane(); buzz(25);
  };
}

// Achievement badge grid (locked badges show a padlock), shown on both cards.
// `newIds` are achievements just earned this run — they get a celebratory glow
// and a "new" ribbon right on the game-over card, so the win is felt in place
// instead of via a floating toast that would cover the card.
export function renderAchievements(newIds = []) {
  const fresh = new Set(newIds);
  const ctx = achContext();                       // lifetime metrics for the progress bars
  const got = ACHIEVEMENTS.filter(a => hasAch(a.id)).length;
  const grid = ACHIEVEMENTS.map(a => {
    const on = hasAch(a.id), isNew = fresh.has(a.id);
    const ribbon = isNew ? '<span class="newrib">✨</span>' : '';
    // Locked badges spell out the goal (`desc`) and a live "cur / goal" bar so the
    // player always sees exactly what to do and how close they are — no hovering.
    const meter = on ? '' : (() => {
      const p = progressFor(a, ctx);
      const label = a.unit === '' ? '' : ` ${a.unit}`;
      return `<span class="achd">${a.desc}</span>`
        + `<span class="achbar"><i style="width:${(p.frac * 100).toFixed(0)}%"></i></span>`
        + `<span class="achp">${fmtGoal(p.cur)} / ${fmtGoal(p.goal)}${label}</span>`;
    })();
    return `<div class="ach${on ? ' on' : ''}${isNew ? ' justnew' : ''}" title="${a.desc}">${ribbon}`
      + `<span class="achi">${on ? a.icon : '🔒'}</span><span class="achn">${a.name}</span>${meter}</div>`;
  }).join('');
  const count = fresh.size
    ? `<span class="wallet pop">✨ ${fresh.size} new!</span>`
    : `<span class="wallet">${got}/${ACHIEVEMENTS.length}</span>`;
  document.querySelectorAll('.achievements').forEach(root => {
    root.innerHTML = `<div class="shophead"><span>🏅 Achievements</span>${count}</div><div class="achgrid">${grid}</div>`;
  });
}
// Compact big goal numbers so a progress label stays short: 2500 → 2.5k, 10000 → 10k.
function fmtGoal(n) {
  if (n < 1000) return `${n}`;
  const k = n / 1000;
  return `${k % 1 ? k.toFixed(1) : k}k`;
}

// The post-run unlock fanfare: a full-screen flashy popup listing each badge just
// earned (icon, name, its +roll reward) plus the rolls banked this run — the
// "you got X rolls" beat the player asked for. It sits above the game-over card
// (higher z-index) and taps away to reveal it. Staggered pop-in per badge.
export function showAchUnlock(list, rollCount, achBonus) {
  const rows = list.map((a, i) => `<div class="ubadge" style="animation-delay:${(i * 0.12).toFixed(2)}s">`
    + `<span class="ubi">${a.icon}</span>`
    + `<span class="ubtext"><span class="ubn">${a.name}</span><span class="ubd">${a.desc}</span></span>`
    + `<span class="ubr">+${a.reward} 🧻</span></div>`).join('');
  $('unlockList').innerHTML = rows;
  $('unlockTitle') && ($('unlockTitle').textContent = list.length > 1 ? `${list.length} Achievements Unlocked!` : 'Achievement Unlocked!');
  const bonus = achBonus ? ` <span class="ubonus">+${achBonus} 🏅 bonus</span>` : '';
  $('unlockRolls').innerHTML = `🧻 <b>+${rollCount}</b> rolls banked this run${bonus}`;
  const card = $('achUnlock');
  card.classList.remove('hide');
  card.classList.toggle('rm', reduceMotionRef());   // skip the burst animations when reduced-motion
}
export function dismissAchUnlock() { $('achUnlock').classList.add('hide'); }

// Skin swatch picker. Each swatch shows the skin's colour; click to select an
// owned skin (applies live) or buy a roll-priced one. Achievement skins unlock
// free once earned, and show a lock until then.
export function renderCosmetics() {
  const sel = selectedSkin();
  const cells = SKINS.map(s => {
    const owned = skinUnlocked(s), active = s.id === sel;
    const tag = active ? 'ON' : owned ? 'wear' : s.ach ? '🔒' : s.cost + ' 🧻';
    const swatch = `#${s.skin.toString(16).padStart(6, '0')}`;
    return `<button class="skin${active ? ' active' : ''}${owned ? '' : ' locked'}" data-id="${s.id}">
      <span class="sw" style="background:${swatch}"></span><span class="skn">${s.name}</span><span class="skc">${tag}</span>
    </button>`;
  }).join('');
  document.querySelectorAll('.cosmetics').forEach(root => {
    root.innerHTML = `<div class="shophead"><span>🎨 Skins</span></div><div class="skingrid">${cells}</div>`;
  });
  document.querySelectorAll('.cosmetics .skin').forEach(b => {
    b.onclick = (e) => {
      e.stopPropagation(); ensureAudio();
      const s = skinById(b.dataset.id);
      if (skinUnlocked(s)) { selectSkin(s.id); applySkin(playerMats, s.id); sfxLane(); buzz(12); }
      else if (buySkin(s.id)) { selectSkin(s.id); applySkin(playerMats, s.id); sfxCoin(); buzz(18); renderShop(); }
      else buzz(25);
      renderCosmetics();
    };
  });
}

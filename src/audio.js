// Self-contained chiptune engine + sound effects, built on the Web Audio API.
import { $ } from './config.js';

const BPM = 150, STEP = 60 / BPM / 4;     // 16th-note length
const m2f = (m) => 440 * Math.pow(2, (m - 69) / 12);

// E-minor driving progression (Em - C - G - D), one bar each.
const PROG = [
  { root: 40, t: [64, 67, 71] },
  { root: 36, t: [60, 64, 67] },
  { root: 43, t: [55, 59, 62] },
  { root: 38, t: [62, 66, 69] },
];
const LEAD = [
  71, 0, 0, 71, 74, 0, 71, 0, 67, 0, 0, 69, 71, 0, 74, 0,
  72, 0, 0, 72, 76, 0, 72, 0, 69, 0, 0, 67, 72, 0, 0, 0,
  74, 0, 0, 74, 79, 0, 74, 0, 71, 0, 0, 67, 74, 0, 71, 0,
  73, 0, 0, 73, 78, 0, 74, 0, 69, 0, 0, 66, 62, 0, 0, 0,
];
const KICK = [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0];
const SNARE = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];

let actx, master, musicGain, sfxGain, noiseBuf, audioReady = false, soundOn = true, musicTimer = null;
let nextStepTime = 0, seqStep = 0;

// Injected so the scheduler knows whether the player is racing or idling.
let getState = () => 'menu';
export function initAudio(stateGetter) { getState = stateGetter; }

// Adaptive intensity (0..1), pushed each frame from the game loop (speed +
// combo). The scheduler layers in drums and the lead as it climbs, so the music
// rises with the run instead of being a flat on/off loop.
let intensity = 0;
export function setIntensity(x) { intensity = x < 0 ? 0 : x > 1 ? 1 : x; }
export function getIntensity() { return intensity; }

export function ensureAudio() {
  if (audioReady) { if (actx.state === 'suspended') actx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  actx = new AC();
  const comp = actx.createDynamicsCompressor(); comp.connect(actx.destination);
  master = actx.createGain(); master.gain.value = soundOn ? 0.85 : 0.0; master.connect(comp);
  musicGain = actx.createGain(); musicGain.gain.value = 0.45; musicGain.connect(master);
  sfxGain = actx.createGain(); sfxGain.gain.value = 0.6; sfxGain.connect(master);
  noiseBuf = actx.createBuffer(1, actx.sampleRate * 0.4, actx.sampleRate);
  const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  audioReady = true; actx.resume(); startMusic();
}

function osc(t, freq, dur, type, vol, dest, glide) {
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(1, glide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest || sfxGain); o.start(t); o.stop(t + dur + 0.03);
}
function noise(t, dur, vol, hp, dest) {
  const s = actx.createBufferSource(); s.buffer = noiseBuf;
  const f = actx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 2000;
  const g = actx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(dest || sfxGain); s.start(t); s.stop(t + dur + 0.02);
}
function kick(t) {
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o.connect(g).connect(musicGain); o.start(t); o.stop(t + 0.2);
}
function snare(t) { noise(t, 0.15, 0.35, 1800, musicGain); osc(t, 180, 0.1, 'triangle', 0.2, musicGain); }
function hat(t, acc) { noise(t, acc ? 0.05 : 0.03, acc ? 0.14 : 0.08, 7000, musicGain); }

function scheduleStep(s, t) {
  const bar = Math.floor(s / 16) % 4, st = s % 16, ch = PROG[bar], playing = getState() === 'playing';
  // While racing the energy follows `intensity`; idle menus sit at a low floor.
  const lvl = playing ? intensity : 0;
  // pulse bass on 8ths, with a fifth pop — fills out a touch as it heats up
  if (st % 2 === 0) { const bn = ch.root + (st % 8 === 4 ? 7 : 0); osc(t, m2f(bn), STEP * 1.7, 'square', playing ? 0.2 + 0.08 * lvl : 0.16, musicGain); }
  // arp sparkle on 16ths
  osc(t, m2f(ch.t[s % ch.t.length] + 12), STEP * 0.9, 'square', playing ? 0.06 + 0.04 * lvl : 0.045, musicGain);
  if (!playing) return;
  // Drums kick in once there's a little heat; the lead + hats join at full tilt.
  if (lvl > 0.28) { if (KICK[st]) kick(t); if (SNARE[st]) snare(t); }
  if (lvl > 0.62) {
    const ln = LEAD[s % 64]; if (ln) osc(t, m2f(ln), STEP * 1.6, 'square', 0.1 + 0.08 * lvl, musicGain);
    hat(t, st % 2 === 0);
  }
}
function startMusic() {
  if (!audioReady || musicTimer) return;
  nextStepTime = actx.currentTime + 0.08; seqStep = 0;
  musicTimer = setInterval(() => {
    if (!audioReady) return;
    while (nextStepTime < actx.currentTime + 0.13) { scheduleStep(seqStep, nextStepTime); nextStepTime += STEP; seqStep = (seqStep + 1) % 64; }
  }, 25);
}

export function toggleSound() {
  soundOn = !soundOn;
  if (soundOn && !audioReady) { ensureAudio(); }
  if (master) master.gain.setTargetAtTime(soundOn ? 0.85 : 0.0, actx.currentTime, 0.02);
  $('muteBtn').textContent = soundOn ? '🔊' : '🔇';
}

// SFX — all guarded so they're silent until audio is ready and unmuted.
const A = () => audioReady && soundOn;
export function sfxLane() { if (!A()) return; osc(actx.currentTime, 520, 0.05, 'square', 0.1); }
export function sfxJump(dbl) { if (!A()) return; const t = actx.currentTime; osc(t, dbl ? 620 : 380, 0.16, 'square', 0.18, sfxGain, dbl ? 1150 : 780); }
export function sfxDuck() { if (!A()) return; osc(actx.currentTime, 320, 0.14, 'square', 0.16, sfxGain, 120); }
// Coin chime climbs a pentatonic ladder with the combo (capped) so a hot streak
// audibly rises instead of fatiguing on the same two notes.
const COIN_LADDER = [0, 2, 4, 7, 9, 12, 14, 16];
export function sfxCoin(step = 0) { if (!A()) return; const t = actx.currentTime, o = COIN_LADDER[Math.min(step, COIN_LADDER.length - 1)]; osc(t, m2f(83 + o), 0.07, 'square', 0.16); osc(t + 0.07, m2f(88 + o), 0.14, 'square', 0.16); }
// A short airy whoosh for a near-miss / skim — a filtered noise sweep that sits
// quietly under the coin so it reads as "that was close" without nagging.
export function sfxWhoosh() { if (!A()) return; const t = actx.currentTime; noise(t, 0.16, 0.1, 1200); osc(t, 900, 0.16, 'triangle', 0.05, sfxGain, 2200); }
// A triumphant rising fanfare for a new personal best.
export function sfxFanfare() { if (!A()) return; const t = actx.currentTime;[72, 76, 79, 84, 88].forEach((n, i) => osc(t + i * 0.09, m2f(n), 0.22, 'square', 0.18)); }
export function sfxCrash() { if (!A()) return; const t = actx.currentTime; noise(t, 0.4, 0.5, 400); osc(t, 420, 0.5, 'sawtooth', 0.25, sfxGain, 45); }
export function sfxStart() { if (!A()) return; const t = actx.currentTime;[60, 64, 67, 72].forEach((n, i) => osc(t + i * 0.07, m2f(n), 0.12, 'square', 0.16)); }
export function sfxOver() { if (!A()) return; const t = actx.currentTime;[72, 69, 65, 60].forEach((n, i) => osc(t + i * 0.13, m2f(n), 0.2, 'square', 0.16)); }
export function sfxLevel() { if (!A()) return; const t = actx.currentTime;[72, 76, 79, 84].forEach((n, i) => osc(t + i * 0.08, m2f(n), 0.18, 'square', 0.18)); }
export function sfxShield() { if (!A()) return; const t = actx.currentTime; osc(t, 300, 0.22, 'sawtooth', 0.2, sfxGain, 900); osc(t + 0.04, m2f(79), 0.16, 'square', 0.14); }
// A soft, quiet two-note slide down — the "aw, lost the combo" cue.
export function sfxComboBreak() { if (!A()) return; const t = actx.currentTime; osc(t, m2f(67), 0.12, 'triangle', 0.1, sfxGain, m2f(60)); osc(t + 0.08, m2f(60), 0.16, 'triangle', 0.09, sfxGain, m2f(55)); }

// Input layer: keyboard + touch/swipe wiring, split out of main.js.
//
// This owns only the DISPATCH — which key or gesture maps to which action — not
// the actions themselves. moveLane/jump/duck (and start/pause/draft picks)
// mutate live sim state, so they stay in main.js and are injected here as
// callbacks. Keeping the raw event plumbing and the key/gesture map in their own
// module means the bindings can change without touching the game loop, and the
// module has zero imports — it's a pure function of the handlers it's given.

const SWIPE_TH = 24;   // px of travel before a touch counts as a swipe

// Wire keyboard + touch input to game actions. `d` supplies:
//   canvas         the element that receives touch gestures
//   getState()     the live game-state string ('menu'|'playing'|'paused'|...)
//   moveLane(dir)  jump()  duck()  startGame()  togglePause()
//   pickDraft(i)   rerollDraft()   ensureAudio()
export function bindControls(d) {
  addEventListener('keydown', e => {
    const state = d.getState();
    // Esc / P toggles the in-run pause; only meaningful while playing or paused.
    if ((e.code === 'Escape' || e.code === 'KeyP') && (state === 'playing' || state === 'paused')) { d.togglePause(); return; }
    if (state === 'paused') return;   // swallow all other input while paused (no stray start/jump)
    if (state === 'draft') {
      if (e.code === 'Digit1' || e.code === 'ArrowLeft') d.pickDraft(0);
      else if (e.code === 'Digit2' || e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'Enter') d.pickDraft(1);
      else if (e.code === 'Digit3' || e.code === 'ArrowRight') d.pickDraft(2);
      else if (e.code === 'KeyR') d.rerollDraft();
      return;
    }
    if (state !== 'playing') { if (e.code === 'Space' || e.code === 'Enter') d.startGame(); return; }
    if (e.code === 'ArrowLeft') d.moveLane(-1); else if (e.code === 'ArrowRight') d.moveLane(1);
    // A held key's auto-repeat is not a fresh press: a slide is a deliberate action.
    else if (e.code === 'ArrowUp' || e.code === 'Space') d.jump(); else if (e.code === 'ArrowDown' && !e.repeat) d.duck();
  });
  let sx = 0, sy = 0, fired = false; const el = d.canvas;
  const act = (dx, dy) => { if (Math.abs(dx) > Math.abs(dy)) d.moveLane(dx > 0 ? 1 : -1); else if (dy < 0) d.jump(); else d.duck(); };
  el.addEventListener('touchstart', e => { d.ensureAudio(); const t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; fired = false; }, { passive: true });
  el.addEventListener('touchmove', e => {
    if (d.getState() !== 'playing' || fired) return; const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > SWIPE_TH || Math.abs(dy) > SWIPE_TH) { act(dx, dy); fired = true; }
  }, { passive: true });
  el.addEventListener('touchend', () => { if (d.getState() === 'playing' && !fired) d.jump(); }, { passive: true });
}

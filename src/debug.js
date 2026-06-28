// Test/debug bridge.
//
// The game is a real-time, timing-sensitive endless runner — awkward to test by
// "playing" it. This module attaches a small control surface at `window.cheeky`
// so tests (and the dev console) can drive the game *deterministically* and read
// its state back as plain JSON: no frame-perfect inputs, no screenshots.
//
// It is opt-in. Nothing is exposed unless `?debug` is in the URL (the test
// harness opens the page that way) or `localStorage.cheekydebug` is set. In a
// normal production build there is no global and zero overhead — main.js skips
// building the API entirely.

export function debugEnabled() {
  try {
    return /[?&]debug\b/.test(location.search) || !!localStorage.getItem('cheekydebug');
  } catch {
    return false;
  }
}

// `api` is built in main.js (it closes over the game's module state). We just
// hang it off window when enabled and leave a hint for anyone at the console.
export function installDebug(buildApi) {
  if (!debugEnabled()) return;
  window.cheeky = buildApi();
  // eslint-disable-next-line no-console
  console.info('[cheeky] debug API ready — try cheeky.help() or cheeky.state()');
}

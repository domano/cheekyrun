#!/usr/bin/env bash
# Headless smoke test for Cheeky Run, driven by agent-browser.
#
# Builds the app, serves the preview, then loads the page, starts a run, sends
# a few inputs, and fails if the console logged errors or the score never
# advanced. Catches most regressions (broken imports, runtime throws, a game
# loop that won't start) without a full test runner.
#
# Usage:  npm run smoke   (or)   bash scripts/smoke-test.sh
#
# Honours AGENT_BROWSER_EXECUTABLE_PATH if set. Otherwise falls back to the
# Chromium pre-installed at /opt/pw-browsers/chromium (the agent sandbox), and
# if that is missing lets agent-browser use its own managed Chrome.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT=4173
URL="http://localhost:${PORT}/"
AB="npx agent-browser"

# Point agent-browser at a Chromium if one isn't already configured.
if [ -z "${AGENT_BROWSER_EXECUTABLE_PATH:-}" ] && [ -x /opt/pw-browsers/chromium ]; then
  export AGENT_BROWSER_EXECUTABLE_PATH=/opt/pw-browsers/chromium
fi

cleanup() {
  $AB close >/dev/null 2>&1 || true
  [ -n "${PREVIEW_PID:-}" ] && kill "$PREVIEW_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "→ building"
npm run build >/dev/null

echo "→ serving preview on :${PORT}"
npm run preview >/tmp/cheekyrun-preview.log 2>&1 &
PREVIEW_PID=$!

# Wait for the server to answer.
for i in $(seq 1 30); do
  if curl -sf "$URL" >/dev/null 2>&1; then break; fi
  sleep 0.3
  [ "$i" = 30 ] && { echo "✗ preview did not start"; cat /tmp/cheekyrun-preview.log; exit 1; }
done

echo "→ loading game"
$AB open "$URL" >/dev/null
$AB wait 1000 >/dev/null

echo "→ starting run"
# "Let's go!" is the only start button on the menu overlay.
$AB find role button click --name "Let's go!" >/dev/null
$AB wait 1500 >/dev/null

echo "→ sending inputs (lane, jump, duck)"
$AB press ArrowLeft  >/dev/null
$AB press ArrowUp    >/dev/null
$AB press ArrowRight >/dev/null
$AB press ArrowDown  >/dev/null
$AB wait 1500 >/dev/null

SCORE=$($AB get text "#score" 2>/dev/null | tr -dc '0-9')
ERRORS=$($AB console --error 2>/dev/null | grep -v '^$' || true)

$AB screenshot /tmp/cheekyrun-smoke.png >/dev/null 2>&1 || true

FAIL=0
if [ -n "$ERRORS" ]; then
  echo "✗ console errors:"; echo "$ERRORS"; FAIL=1
fi
if [ -z "${SCORE:-}" ] || [ "${SCORE:-0}" -le 0 ]; then
  echo "✗ score did not advance (got '${SCORE:-}') — the run never really started"; FAIL=1
fi

if [ "$FAIL" = 0 ]; then
  echo "✓ smoke test passed — score ${SCORE}, no console errors (screenshot: /tmp/cheekyrun-smoke.png)"
fi
exit $FAIL

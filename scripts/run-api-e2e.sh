#!/usr/bin/env bash
# run-api-e2e.sh — Start mock server + Next.js dev server, run E2E tests, cleanup.
# This script is the sole owner of mock server and dev server lifecycle.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

E2E_PORT="${E2E_PORT:-13000}"
MOCK_PORT="${MOCK_PORT:-14000}"
HEALTH_URL="http://127.0.0.1:${E2E_PORT}/api/health"
MOCK_HEALTH_URL="http://127.0.0.1:${MOCK_PORT}/mock-httpbin"
MAX_WAIT=30  # seconds

MOCK_PID=""
DEV_PID=""

cleanup() {
  echo "==> Cleaning up..."
  [[ -n "$MOCK_PID" ]] && kill "$MOCK_PID" 2>/dev/null && echo "  Stopped mock server (PID $MOCK_PID)"
  [[ -n "$DEV_PID" ]] && kill "$DEV_PID" 2>/dev/null && echo "  Stopped dev server (PID $DEV_PID)"
  wait 2>/dev/null
}
trap cleanup EXIT

wait_for_url() {
  local url="$1"
  local label="$2"
  local elapsed=0
  echo "==> Waiting for ${label} at ${url}..."
  while ! curl -sf "$url" > /dev/null 2>&1; do
    sleep 1
    elapsed=$((elapsed + 1))
    if [[ $elapsed -ge $MAX_WAIT ]]; then
      echo "ERROR: ${label} not ready after ${MAX_WAIT}s"
      exit 1
    fi
  done
  echo "  ${label} ready (${elapsed}s)"
}

# ---------- 1. Start mock server ----------
echo "==> Starting mock server on port ${MOCK_PORT}..."
MOCK_PORT="$MOCK_PORT" bun "$PROJECT_DIR/tests/e2e/mock-server.ts" &
MOCK_PID=$!
wait_for_url "$MOCK_HEALTH_URL" "Mock server"

# ---------- 2. Start Next.js dev server ----------
echo "==> Starting Next.js dev server on port ${E2E_PORT}..."
cd "$PROJECT_DIR"

# Load env: .env.test (defaults) + .env.test.local (secrets override)
ENV_ARGS="-e .env.test"
[[ -f .env.test.local ]] && ENV_ARGS="$ENV_ARGS -e .env.test.local"

# shellcheck disable=SC2086
bunx dotenv-cli $ENV_ARGS -- next dev --turbopack --port "$E2E_PORT" &
DEV_PID=$!
wait_for_url "$HEALTH_URL" "Dev server"

# ---------- 3. Run E2E tests ----------
echo "==> Running API E2E tests..."
E2E_BASE_URL="http://127.0.0.1:${E2E_PORT}" \
MOCK_SERVER_URL="http://127.0.0.1:${MOCK_PORT}" \
  bun test tests/e2e/

E2E_EXIT=$?

echo ""
if [[ $E2E_EXIT -eq 0 ]]; then
  echo "==> API E2E: ALL PASSED"
else
  echo "==> API E2E: FAILED (exit code $E2E_EXIT)"
fi

exit $E2E_EXIT

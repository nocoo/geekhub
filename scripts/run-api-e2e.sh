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

# E2E test user (must match .env.test values)
E2E_USER_ID="e2e00000-0000-4000-a000-000000000001"
E2E_USER_EMAIL="e2e-test@geekhub.local"

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

# ---------- 0. Load env and seed test user ----------
cd "$PROJECT_DIR"

# Load env: .env.test.local (secrets) first, then .env.test (defaults).
# dotenv-cli does NOT override: first file wins, so secrets must come first.
ENV_ARGS=""
[[ -f .env.test.local ]] && ENV_ARGS="-e .env.test.local"
ENV_ARGS="$ENV_ARGS -e .env.test"

# Read Supabase URL and service key from the loaded env
# shellcheck disable=SC2086
eval "$(bunx dotenv-cli $ENV_ARGS -- bash -c 'echo "SB_URL=$NEXT_PUBLIC_SUPABASE_URL"; echo "SB_SERVICE_KEY=$SUPABASE_SERVICE_KEY"')"

# Probe Supabase reachability so DB-dependent tests can self-skip when needed
# (e.g. CI without local Supabase). Treats placeholder service keys as unavailable.
SUPABASE_AVAILABLE="false"
if [[ -n "${SB_URL:-}" && -n "${SB_SERVICE_KEY:-}" && "$SB_SERVICE_KEY" != placeholder-* ]]; then
  if curl -sf -m 3 "${SB_URL}/auth/v1/health" -H "apikey: ${SB_SERVICE_KEY}" > /dev/null 2>&1; then
    SUPABASE_AVAILABLE="true"
  fi
fi
export SUPABASE_AVAILABLE
echo "==> Supabase available: ${SUPABASE_AVAILABLE}"

if [[ "$SUPABASE_AVAILABLE" == "true" ]]; then
  echo "==> Seeding E2E test user (${E2E_USER_EMAIL})..."
  SEED_RESULT=$(curl -sf "${SB_URL}/auth/v1/admin/users" \
    -H "Authorization: Bearer ${SB_SERVICE_KEY}" \
    -H "apikey: ${SB_SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"id\":\"${E2E_USER_ID}\",\"email\":\"${E2E_USER_EMAIL}\",\"password\":\"test-password-e2e\",\"email_confirm\":true}" 2>&1 || true)

  if echo "$SEED_RESULT" | grep -q '"id"'; then
    echo "  Test user created: ${E2E_USER_ID}"
  elif echo "$SEED_RESULT" | grep -q 'already_exists\|duplicate'; then
    echo "  Test user already exists: ${E2E_USER_ID}"
  else
    echo "  WARN: Could not create test user: ${SEED_RESULT}"
    echo "  (Continuing — tests may fail if auth.users FK is enforced)"
  fi
else
  echo "==> Skipping test-user seed (Supabase unreachable). DB-dependent tests will be skipped."
fi

# ---------- 1. Start mock server ----------
echo "==> Starting mock server on port ${MOCK_PORT}..."
MOCK_PORT="$MOCK_PORT" bun "$PROJECT_DIR/tests/e2e/mock-server.ts" &
MOCK_PID=$!
wait_for_url "$MOCK_HEALTH_URL" "Mock server"

# ---------- 2. Start Next.js dev server ----------
echo "==> Starting Next.js dev server on port ${E2E_PORT}..."

# shellcheck disable=SC2086
bunx dotenv-cli $ENV_ARGS -- next dev --turbopack --port "$E2E_PORT" &
DEV_PID=$!
wait_for_url "$HEALTH_URL" "Dev server"

# ---------- 3. Run E2E tests ----------
echo "==> Running API E2E tests..."
E2E_BASE_URL="http://127.0.0.1:${E2E_PORT}" \
MOCK_SERVER_URL="http://127.0.0.1:${MOCK_PORT}" \
SUPABASE_AVAILABLE="${SUPABASE_AVAILABLE}" \
  bun test ./tests/e2e/*.test.ts

E2E_EXIT=$?

echo ""
if [[ $E2E_EXIT -eq 0 ]]; then
  echo "==> API E2E: ALL PASSED"
else
  echo "==> API E2E: FAILED (exit code $E2E_EXIT)"
fi

exit $E2E_EXIT

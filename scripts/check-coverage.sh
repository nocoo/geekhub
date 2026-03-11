#!/usr/bin/env bash
# check-coverage.sh — Run bun tests with coverage and enforce minimum threshold.
# Used in pre-push hook. Exit 1 if line coverage < threshold.
set -euo pipefail

THRESHOLD="${COVERAGE_THRESHOLD:-90}"
LCOV_FILE="coverage/lcov.info"

echo "==> Running tests with coverage..."
bun test --coverage --coverage-reporter=lcov 2>&1

if [[ ! -f "$LCOV_FILE" ]]; then
  echo "ERROR: $LCOV_FILE not found. Coverage report was not generated."
  exit 1
fi

# Parse lcov: count DA lines (DA:<line>,<hits>)
total=0
covered=0
while IFS= read -r line; do
  if [[ "$line" == DA:* ]]; then
    total=$((total + 1))
    hits="${line##*,}"
    if [[ "$hits" -gt 0 ]]; then
      covered=$((covered + 1))
    fi
  fi
done < "$LCOV_FILE"

if [[ "$total" -eq 0 ]]; then
  echo "ERROR: No coverage data found in $LCOV_FILE."
  exit 1
fi

pct=$((covered * 100 / total))

echo ""
echo "==> Coverage: $covered / $total lines ($pct%)"
echo "==> Threshold: $THRESHOLD%"

if [[ "$pct" -lt "$THRESHOLD" ]]; then
  echo "FAIL: Coverage $pct% is below threshold $THRESHOLD%."
  exit 1
fi

echo "PASS: Coverage meets threshold."

# Retrospective

## 2026-10-01 - Interrupted cleanup edit

A multi-file replacement script stopped because it assumed a test title instead of checking the exact source text. Earlier writes had succeeded, leaving a partial change. Reviewed the diff, completed the remaining edits with context patches, and verified the full change. Check replacement anchors before writing; use context patches for structural edits.

## 2026-10-01 - Registry URLs entered a dependency commit

Bun embedded temporary mirror URLs throughout the lockfile. The inspection command printed the matches but did not block the subsequent commit. Removed the URLs in a follow-up commit without rewriting history. Future dependency commits must use a failing precondition for mirror URLs, not a diagnostic command followed by unconditional staging.

## 2026-10-01 - Local smoke harness setup

The first browser smoke command used Node's stdin flag with Bun, which printed help without executing the check. Switching to Node then exposed a missing Playwright `baseURL` for relative API requests. Corrected both harness settings and reran the checks; neither incomplete attempt counted as passing evidence. Use the documented runtime entrypoint and set the browser context base URL explicitly in standalone probes.

Record the date when known, what happened, its cause, and the follow-up. Do not invent an incident to populate this file. Keep recurring project rules brief in `AGENTS.md`; cross-project lessons belong in global rules or nmem, and deterministic checks belong in hooks or tests.


## 2026-10-01 - Release preflight mismatch

The dependency cleanup updated Wrangler but missed the reusable release workflow's exact-version input. Release preflight caught the 4.131.1 / 4.145.0 mismatch before push or deployment; the workflow rejects this mismatch. Synchronized the input and reviewed generated deployment configuration. Dependency upgrades must search CI/CD pins as well as manifests and lockfiles.

A GitHub API path containing a query string was initially unquoted, so zsh rejected it before execution. Quoted the path and reran the read-only request. Quote API paths that contain shell metacharacters.

The maintenance-entry probe also failed under Bun's data-URL import path before exercising a handler. Reran the isolated handler check with Node's ESM loader and a base64 data URL; HTTP 503 and queue retries passed. A failed harness is not deployment evidence.

## 2026-10-01 - Settings keyboard test raced dialog entry

The release L3 run passed 55 tests but the mobile keyboard-navigation case timed out. Its trace showed immediate programmatic focus and ArrowDown during dialog entry, followed by an unstable tab and a detached dialog while clicking. Wait for the dialog to enter the viewport and finish its own animations before testing keyboard navigation, just as the test already waits for panel animations. Keep the original assertions and rerun the complete browser suite; do not hide the failure with retries or larger timeouts.

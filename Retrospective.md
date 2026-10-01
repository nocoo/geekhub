# Retrospective

## 2026-10-01 - Interrupted cleanup edit

A multi-file replacement script stopped because it assumed a test title instead of checking the exact source text. Earlier writes had succeeded, leaving a partial change. Reviewed the diff, completed the remaining edits with context patches, and verified the full change. Check replacement anchors before writing; use context patches for structural edits.

## 2026-10-01 - Registry URLs entered a dependency commit

Bun embedded temporary mirror URLs throughout the lockfile. The inspection command printed the matches but did not block the subsequent commit. Removed the URLs in a follow-up commit without rewriting history. Future dependency commits must use a failing precondition for mirror URLs, not a diagnostic command followed by unconditional staging.

Record the date when known, what happened, its cause, and the follow-up. Do not invent an incident to populate this file. Keep recurring project rules brief in `AGENTS.md`; cross-project lessons belong in global rules or nmem, and deterministic checks belong in hooks or tests.

# GeekHub

Single-user RSS reader: a Vite/React SPA plus a Hono API on one Cloudflare Worker, with D1 as the source of truth. Brand: GeekHub, production domain `geekhub.hexly.ai`. Human overview: [README.md](README.md). Architecture: [docs/01-architecture.md](docs/01-architecture.md). Reader workflow: [docs/07-reader-workflow.md](docs/07-reader-workflow.md). Profile: ts-worker-web.

## Scope and instruction sources

- This file applies throughout the repository.
- `docs/archieve/` is a historical documentation snapshot outside active build/test/lint; it is not current product documentation.
- Preserve these project instructions when scaffolding or updating frameworks; frameworks must not replace this handbook.
- Maintain this file as the only root handbook; do not recreate `CLAUDE.md`, a symlink, an import or a compatibility alias.
- Source of truth: root `package.json`, the four `tsconfig.*.json` projects, `biome.json`, `wrangler.jsonc`, `vitest.config.ts`, `migrations/`, `.husky/`, `scripts/` and `.github/workflows/ci.yml`. Record drift rather than lowering the contract.

## Setup and commands

Run from the repository root. TypeScript 7.0.2 strict, Bun 1.4.0 (`packageManager`; CI pins Node 26.8.1), Biome 2.5.13, `@nocoo/basalt` 2.1.8 and `@nocoo/next-ai` 0.4.0. Wrangler bindings live in `wrangler.jsonc`; secrets stay in ignored local configuration. Normal local tests need no production Access or AI keys.

```sh
bun install --frozen-lockfile
bun run setup
bun dev
bun run typecheck
bun run lint
bun run build
bun run test:coverage
bun run test:l2
bun x playwright install chromium
bun run test:l3
bun run gate:security
bun run quality
```

`bun run setup` applies local D1 migrations and seeds sample feeds only when none exist; it preserves imported data. G2 needs gitleaks 8.30.1 and osv-scanner 2.5.1 on PATH; CSV import ([docs/04-data-import.md](docs/04-data-import.md)) additionally uses Python 3, with explicit `db:import --check/--local/--remote` targets where remote imports are operational writes. `quality` chains every gate for a full local run.

## Project boundaries

- D1 holds one shared dataset; `migrations/` owns its schema. The published version in root `package.json` must match the UI and `/api/live`. Access authenticates entry; never partition subscriptions, reading state or settings by Access subject, email or legacy `user_id`. Preserve source IDs and shared ownership during imports; changing a feed URL must preserve articles and reading state.
- Verify Access JWT signature, issuer and audience; production fails closed. Local identity and mock AI are restricted to the local environment and loopback requests.
- `src/web` is browser-only; `src/worker` is server-only; `src/shared` is browser-safe. Never import the AI server entry or secrets into the browser bundle.
- Parameterize D1 SQL. Sanitize fetched HTML and validate outbound URLs and redirects. Feed work uses Queues triggered by reader actions; no Cron scheduling. Fetch logs live only in the shared Durable Object memory cache capped at 500 entries. No floating background promises or Worker filesystem storage.
- Use published Basalt 2.1.8 components; read the installed Basalt integration guide before changing application chrome. Use `@nocoo/next-ai` public contracts, React configuration components and the universal `/server` entry. Keep MVVM structure and the existing green identity.
- Keep reading selection, scroll and pagination stable during background updates; updates apply explicitly. Preserve keyboard/input boundaries and responsive layouts.

## Testing and quality contract

Run the checks relevant to the changed scope; hook and CI requirements still apply. Unit tests run in-package Vitest against `tests/unit/`; L2/L3 run isolated local Workers. Statuses: `enforced`, `planned`, `manual`, `N/A`. A partial check does not certify the full requirement.

| Dimension | Required contract | Current status and evidence |
| --- | --- | --- |
| L1 — pre-commit quality | UT with statements, branches, functions and lines each ≥95%; strict types and check-only lint with zero errors/warnings; installed hook on the index snapshot; failure rejection; under 30s. No skipped or focused tests. | planned. `vitest.config.ts` sets v8 thresholds 95/95/95/95 over `src/shared/**`, `src/worker/**` and `src/web/lib/**`. `typecheck` runs `cf-typegen` plus four strict `tsc` projects; `lint` is `biome check --error-on-warnings .`. Pre-commit `bun scripts/hooks.ts commit` runs typecheck, lint and coverage in parallel against the working tree; the CI quality job runs the same lanes. Index-snapshot scope, rejection behavior beyond hook exit codes and the 30s target are unverified, so unified L1 stays planned while its subchecks are configured. |
| L2 — integration | Real local HTTP plus SQLite for every owned endpoint/method | planned. Pre-push and the CI matrix run `bun run test:l2` (`scripts/run-tests.ts l2`) against a local Wrangler/Miniflare Worker on `127.0.0.1:17005` with fresh `.wrangler/tests/l2-*` SQLite. A complete endpoint/method inventory is not established. |
| L3 — system | Critical browser user journeys | enforced. The CI integration matrix runs `bun run test:l3` (Playwright chromium) for desktop/mobile reading and auth journeys on every push and PR. |
| G2 — security | Dependency and secret scans; a missing required scanner fails | enforced. `gate:security` (`scripts/security.ts`) snapshots tracked and unignored files including the archive, scans with pinned gitleaks (inline allow comments disabled) and osv-scanner over `bun.lock`, and fails on missing tools or nonzero exits. It runs in pre-push and the dedicated CI security job. |
| D1 — isolation | Test state separate from production and daily development; guards before fixture writes/cleanup | enforced. `run-tests.ts`, `verify-test-bindings.ts` and `seed.ts` allocate per-run SQLite directories, remove production Cloudflare credentials, verify local bindings, initialize `_test_marker(env=test)` and check it before seed/reset/cleanup. No remote `-test` resources exist. |

Current hooks: pre-commit runs typecheck, lint and coverage in parallel on the working tree; pre-push runs L2 and the security gate in parallel. Neither hook consumes an index snapshot or stdin pushed refs. Target: pre-commit checks the index snapshot for unified L1 in under 30s; pre-push checks stdin push refs for L2 and G2 in under 3 minutes. Those targets are not implemented.

The owner merged former G1 into L1 on 2026-09-21; the framework keeps the 6DQ name: L1, L2, L3, G2 and D1. Use `system0-6dq-l1` for the L1 contract and its S/A/B/F rubric. Do not lower coverage, skip tests, use `.skip`/`.only`, suppress security failures or bypass hooks to pass a gate.

## Resources and operational safety

| Purpose | Target / state | Boundary |
| --- | --- | --- |
| Development | `https://geekhub.dev.hexly.ai` → Caddy → `127.0.0.1:7005`; `.wrangler/state/` | One Vite process runs UI and Worker via the Cloudflare plugin; manual preview uses Caddy with normal TLS verification. Never deploy the local environment. |
| Tests | L2 `http://127.0.0.1:17005`, L3 `http://127.0.0.1:27005`; fresh `.wrangler/tests/l2-*`/`l3-*` | Per-run SQLite; verify local bindings, runtime context and `_test_marker` before seed/reset/cleanup. Keep ports aligned across `vite.config.ts`, `scripts/run-tests.ts`, Wrangler, the Caddyfile and the workflow mirror. |
| Production | `https://geekhub.hexly.ai`; production bindings only | Deployment, remote migration and import are authorized operations, not agent defaults. |

Deployment uses `bun run deploy`, which applies production migrations before build/deploy and rejects local or test targets. Configure production D1, Queue, Access team/AUD and `AI_ENCRYPTION_KEY` first; reader-provided AI keys stay encrypted. Verify the deployed version, health and Access behavior. Runbooks: [docs/05-deployment.md](docs/05-deployment.md), quality evidence: [docs/03-quality.md](docs/03-quality.md).

## Completion and documentation

- Keep one logical change per commit; update README and numbered docs when behavior changes.
- Report commands actually run. Inspected configuration is not a passing test run.
- Accident narratives stay in [Retrospective.md](Retrospective.md). Keep only concise recurring project rules here; cross-project lessons go to global rules/nmem; deterministic checks belong in hooks/tests.

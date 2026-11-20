# GeekHub

Single-user RSS reader: Vite/React SPA and Hono API on one Cloudflare Worker (`geekhub.hexly.ai`), with D1 as source of truth.
Docs: [README.md](README.md) · [Architecture](docs/01-architecture.md) · [Development](docs/02-development.md) · [Quality](docs/03-quality.md) · [Data Import](docs/04-data-import.md) · [Deployment](docs/05-deployment.md) · [Reader Workflow](docs/07-reader-workflow.md) · [Retrospective](Retrospective.md)

## Commands

Run from root with Bun 1.4.0 (`packageManager`; CI pins Node 26.12.1), TypeScript 7.0.2 strict, and Biome. Bindings live in `wrangler.jsonc`; local secret names in `.dev.vars.example` (`.dev.vars.local` stays ignored). Local tests need no production Access or AI keys.

```sh
bun install --frozen-lockfile
bun run setup          # Local D1 migrations + .dev.vars.local + empty-DB seed
bun dev                # https://geekhub.dev.hexly.ai -> 127.0.0.1:7005
bun run typecheck      # S1: cf-typegen + 4 strict tsconfig.*.json projects
bun run lint           # S2: Biome check-only, 0 warnings
bun run test:coverage  # L1: Vitest >= 95% on shared/worker/web/lib
bun run build          # B1: Vite production bundle
bun run test:l2        # L3 (CI): isolated local Worker HTTP + SQLite (:17005)
bun x playwright install chromium && bun run test:l3  # L4 (CI): Playwright E2E (:27005)
bun run gate:security  # G1/G2: gitleaks + osv-scanner on PATH (fails if missing)
bun run quality        # Full local gate sequence
```

`bun run setup` preserves imported data. CSV import (`bun run db:import <dir> --check|--local|--remote`) uses Python 3; `--remote` requires authorization ([Data Import](docs/04-data-import.md)).

## Invariants

- **Shared D1 dataset**: `migrations/` owns schema; `package.json` version matches UI and `/api/live`. Never partition subscriptions, reading state, or settings by Access subject, email, or legacy `user_id`.
- **Import & URL edits**: Preserve source IDs and shared ownership on CSV import; changing a feed URL must preserve articles and reading state.
- **Auth & fail-closed**: Verify Access JWT signature, issuer, and audience; production fails closed. Local identity and mock AI are restricted to local/test loopback requests.
- **Module boundaries**: `src/web` is browser-only, `src/worker` is server-only, `src/shared` is browser-safe; never import AI `/server` entries or secrets into browser code.
- **SQL, HTML & Queues**: Parameterize D1 SQL; sanitize HTML and validate outbound URLs/redirects. Feed work uses action-triggered Queues only (no Cron, floating promises, or Worker FS).
- **Memory logs & types**: Fetch logs live only in `FeedLogCache` DO memory (500-entry cap; migration `0007` dropped retired scheduling/logs). Never add `@cloudflare/workers-types`; `cf-typegen` owns them.
- **UI & AI contracts**: Use published `@nocoo/basalt` components (read `system1-design-basalt` before changing chrome) and `@nocoo/next-ai` public contracts + `/server` entry; keep MVVM and green identity.
- **Reader stability**: Keep selection, scroll anchor, and pagination stable during background updates (apply explicitly); preserve keyboard/input boundaries and responsive layouts.
- **Historical archive**: `docs/archieve/` is a historical snapshot outside active build, lint, and test scope, not current product documentation.
- **Production writes**: `bun run deploy` (remote migrations -> build -> deploy; rejects local/test), remote migrations, and `db:import --remote` require authorization ([Deployment](docs/05-deployment.md)).

## Quality & Local Gates

Follows `system1-quality`; CI slots and pinned `base-ci` revision live in `.github/workflows/quality-slots.yml` (`quality / Z1: Gate` required on `main` and `.github/workflows/release.yml`). Status vocabulary: `enforced`, `planned`, `manual`, `N/A`. Never lower coverage, use `.skip`/`.only`, suppress security failures, or bypass hooks.

- **Coverage & scripts**: `L1` (`enforced`) gates v8 >= 95% on `src/shared/**`, `src/worker/**`, `src/web/lib/**`. `test:l2` runs CI `L3: Integration` (all `src/worker/index.ts` routes); `test:l3` runs CI `L4: E2E`.
- **Slot exceptions**: `L2 Runtime` is `N/A` (Worker/D1/Queue covered by `L3`/`L4`); `P1 Package` is `N/A` (private Worker, not published to npm).
- **Security scan**: `gate:security` (`G1`/`G2`) requires `gitleaks` + `osv-scanner` on PATH (fails if missing), disables inline allow comments, and scans tracked + unignored files including `docs/archieve/`.
- **Pre-commit (`.husky/`)**: Installed via `bun run prepare`; checks lockfile match, runs `S1`/`S2`/`L1` in parallel in a `git checkout-index` snapshot, then cleans up (`G1` staged scan is `planned`).
- **Pre-push (`.husky/`)**: Runs `bun scripts/hooks.ts push` (`test:l2` + `gate:security` in parallel) on the working tree; stdin pushed-ref scoping and `B1`/`L4` gating are `planned`.

## Resources & Isolation

| Lane | Endpoint / State | Boundary |
| --- | --- | --- |
| Dev | `https://geekhub.dev.hexly.ai` -> Caddy -> `127.0.0.1:7005`; `.wrangler/state/` | Single Vite + Cloudflare plugin; daily local data; never deploy local env |
| Tests | L3 `127.0.0.1:17005`, L4 `127.0.0.1:27005`; `.wrangler/tests/l2-*` & `l3-*` | Per-run SQLite, stripped CF creds, `verifyLocalBindings` + `_test_marker(env=test)` before seed/cleanup; align ports in `vite.config.ts`, `scripts/run-tests.ts`, `wrangler.jsonc`, and Caddy |
| Prod | `https://geekhub.hexly.ai`; prod D1, Queue, Access team/AUD, `AI_ENCRYPTION_KEY` | Reader AI keys stay encrypted; read-only checks unless deploy, remote migration, or `db:import --remote` is authorized |

## Retrospective

Record incident narratives in [Retrospective.md](Retrospective.md); promote recurring project constraints to `Invariants` above and deterministic checks to tests or hooks.

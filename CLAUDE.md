# GeekHub

Single-user RSS reader with a Vite/React SPA and Hono API on one Cloudflare Worker.
Profile: ts-worker-web.
Direction: [architecture](docs/01-architecture.md), [reader workflow](docs/07-reader-workflow.md).

## Sources of Truth

This handbook is the contract, together with [AGENTS.md](AGENTS.md); hooks, CI and config are enforcement. Raise weaker gates to the contract. Frameworks must not replace this file.

| Fact | Where |
| --- | --- |
| Human docs | [README.md](README.md), [development/API](docs/02-development.md) |
| Version | Root `package.json`; same version in UI and `/api/live` |
| Enforcement | `.husky/`, `scripts/hooks.ts`, CI, Vitest and test runners |
| Environment | Ignored local variables; `wrangler.jsonc` owns bindings |
| Accidents | [Retrospective.md](Retrospective.md) |

## Project Invariants

- D1 is the source of truth for one shared dataset. Access authenticates entry; never partition subscriptions, reading state or settings by subject/email/legacy `user_id`.
- Verify Access JWT signature, issuer and audience; production fails closed. Local identity and mock AI require local environment and loopback requests.
- `src/web` is browser-only; `src/worker` is server-only; `src/shared` is browser-safe. AI server imports and secrets never enter the bundle.
- Keep SQL parameterized, sanitize fetched HTML and validate outbound URLs/redirects. Queues own feed work; Cron owns scheduling; no floating promises or Worker filesystem storage.
- Use published Basalt 2.1.8 and public `@nocoo/next-ai` contracts/configuration components and `/server` entry. Keep MVVM and the existing green identity.
- Keep reading selection, scroll and pagination stable during background updates; updates apply explicitly. Preserve keyboard/input boundaries and responsive layouts.
- `archieve/` and `docs/archieve/` are historical snapshots, outside active build/test/lint; do not modify legacy code for current features.

## Stack / Layout

| Component | Choice |
| --- | --- |
| Language/tooling | TypeScript 7.0.2 strict, Bun 1.4.0, Node 26.8.1, Biome |
| UI/API | Vite 8, React 19, Hono, Cloudflare Worker |
| State | D1, Queues and Cron; `migrations/` owns schema |
| Checks | `tests/unit/`, `tests/http/`, browser specs; `scripts/` owns gates |

## Commands

Run from root. Setup creates local SQLite/key and adds sample feeds only when none exist; it preserves imported data.

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

G2 needs gitleaks 8.30.1 and osv-scanner 2.5.1; CSV import uses Python 3. Normal local tests need no production Access/AI keys. Follow [data import](docs/04-data-import.md) for explicit `db:import --check/--local/--remote` targets; remote imports are operational writes.

## Verification

6DQ = L1/L2/L3 + G1/G2 + D1. Status: `enforced`, `planned`, `manual`, `N/A`. No `.skip`/`.only`; four L1 metrics each ≥95%.

| Piece | Requirement and current reality | Status | Evidence |
| --- | --- | --- | --- |
| L1 | Four metrics ≥95% on shared/Worker/web-library logic | enforced | `vitest.config.ts`; commit hook and CI |
| L2 | Real HTTP + SQLite for all endpoints/methods | planned | `tests/http/reader.ts` runs in push hook/CI; complete endpoint/method inventory proof still needed |
| L3 | Desktop/mobile reading and auth journeys | enforced | CI l3 job → `scripts/run-tests.ts l3` / Playwright |
| G1 | Four type configs and Biome; zero errors/warnings | enforced | `typecheck`, `lint`, commit hook/CI |
| G2 | Required OSV + gitleaks, fail if absent | enforced | `scripts/security.ts`; push hook/dedicated CI job |
| D1 | Per-run local SQLite, loopback, bindings/marker checks | enforced | `run-tests.ts`, `verify-test-bindings.ts`, `seed.ts` |
| Build | Vite output | enforced | Quality CI and `quality` |
| Docs | Current architecture, import and deployment evidence | manual | Numbered document review |

Current hooks run parallel tasks against the working tree; secret scans snapshot tracked/unignored working files including the archive. Neither hook consumes an index snapshot or stdin pushed refs. Target: check-only index L1/G1 <30s; ref-based L2/G2 <3min. Never bypass commit/branch-push hooks or suppress security/coverage failures.

## Resources / Isolation

| Purpose | Domain / port | State |
| --- | --- | --- |
| Dev | `https://geekhub.dev.hexly.ai` → Caddy → 127.0.0.1:7005 | `.wrangler/state/` |
| L2 | `http://127.0.0.1:17005` | Fresh `.wrangler/tests/l2-*` |
| L3 | `http://127.0.0.1:27005` | Fresh `.wrangler/tests/l3-*` |
| Production | `https://geekhub.hexly.ai` | Production bindings only |

Manual preview uses Caddy with normal TLS verification. Keep ports aligned with `vite.config.ts`, `scripts/run-tests.ts`, Wrangler, `/opt/homebrew/etc/Caddyfile` and the workflow mirror. One Vite process runs UI/Worker. Tests remove production CF credentials, verify local bindings, initialize `_test_marker(env=test)`, then check it before seed/cleanup. Never create remote `-test` resources or reuse daily-dev state.

## Operations / Release

For authorized deployment, `bun run deploy` applies production migrations before build/deploy and rejects local/test targets. Configure production D1, Queue, Access team/AUD and `AI_ENCRYPTION_KEY` first; reader-provided AI keys remain encrypted. Verify deployed version/health and Access behavior; follow [deployment](docs/05-deployment.md) and [quality evidence](docs/03-quality.md).

## Retrospective

Use [Retrospective.md](Retrospective.md) for narratives. Keep recurring project rules brief here; route cross-project lessons to nmem/global rules and deterministic checks to tests/hooks.

- Preserve source IDs and shared ownership during imports; changing feed URLs must preserve articles and reading state.

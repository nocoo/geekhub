# Dependency Cleanup - 2026-10-01

## Scope

Reviewed all 48 open dependency issues (#31-#78) against the active manifest,
lockfile and imports, not their pre-rewrite version snapshots. Source changes
are local commits only: no push, issue closure, release or production operation.
The validated code revision is `679eaed`; subsequent documentation does not change
runtime code, tests or dependencies.

The active architecture remains Vite/React + Basalt, Hono on one Cloudflare
Worker, D1, action-triggered Queues and an in-memory Durable Object log cache.
All 17 runtime dependencies and 21 development dependencies have active roles
in source imports, generated types, build configuration, scripts or tests.
Direct packages decreased from 39 to 38; lockfile entries from 542 to 540.

- Removed the separate `@cloudflare/workers-types` package. Wrangler generates
  bindings and runtime declarations for the configured compatibility date.
- Updated React/React DOM together, React Query, Lucide, Node types, Vitest and
  its matching coverage provider, jsdom, and the Cloudflare development runtime.
- Aligned the direct AI SDK version with next-ai to remove duplicate provider
  dependency chains. Retained the required public SDK and Basalt integrations.
- No new dependency overrides, compatibility layers or direct transitive pins.
  The registry-neutral lockfile contains no machine-specific mirror URLs.
- The 17 issue packages marked absent below were already removed by the rewrite;
  they were not reintroduced merely to satisfy outdated upgrade instructions.
- `docs/archieve/` contains historical Markdown only and remains outside the
  active build. Existing migrations and historical release evidence remain intact.

## Retired Code

Migration `0007` drops `fetch_logs`, `feeds_due`, `refresh_minutes`,
`next_fetch_at` and `failure_count`. Runtime SQL, API contracts, CSV import
mapping, local fixtures and tests no longer read or write these fields.
Obsolete interval updates now return 400. Queue ownership and bounded retry
behavior remain intact; malformed tokenless messages still cannot fetch.

Migration `0008` discards obsolete diagnostic snapshots without body-coverage
data, including reports containing obsolete candidates. Current diagnostics
always include `contentEntries`; the old scoring and display branches are gone.
Only cached reports are discarded, not subscriptions or articles.

Removed an unreferenced placeholder asset, the obsolete `.next` ignore entry,
and the unused Next.js-only SDK patch sections. The patch now changes only the
React controls and universal `/server` entry that GeekHub actually imports.

The schema cleanup is intentionally not backward compatible. Do not serve
requests or run old consumers against the new schema during a future production
rollout; follow [the deployment runbook](05-deployment.md). This run migrated only
local SQLite.

## Issue Disposition

| Issue | Package | Current resolution | Disposition |
| --- | --- | --- | --- |
| [#31](https://github.com/nocoo/geekhub/issues/31) | `@radix-ui/react-dialog` | `1.1.23` | Already satisfied; retained |
| [#32](https://github.com/nocoo/geekhub/issues/32) | `@radix-ui/react-dropdown-menu` | `2.1.24` | Already satisfied; retained |
| [#33](https://github.com/nocoo/geekhub/issues/33) | `@radix-ui/react-label` | `2.1.15` | Already satisfied; retained |
| [#34](https://github.com/nocoo/geekhub/issues/34) | `@radix-ui/react-progress` | `1.1.16` | Already satisfied; retained |
| [#35](https://github.com/nocoo/geekhub/issues/35) | `@radix-ui/react-scroll-area` | `1.2.18` | Already satisfied; retained |
| [#36](https://github.com/nocoo/geekhub/issues/36) | `@radix-ui/react-select` | `2.3.7` | Already satisfied; retained |
| [#37](https://github.com/nocoo/geekhub/issues/37) | `@radix-ui/react-separator` | `1.1.15` | Already satisfied; retained |
| [#38](https://github.com/nocoo/geekhub/issues/38) | `@radix-ui/react-slot` | `1.3.3` | Already satisfied; retained |
| [#39](https://github.com/nocoo/geekhub/issues/39) | `@radix-ui/react-switch` | `1.3.7` | Already satisfied; retained |
| [#40](https://github.com/nocoo/geekhub/issues/40) | `@radix-ui/react-tabs` | `1.1.21` | Already satisfied; retained |
| [#41](https://github.com/nocoo/geekhub/issues/41) | `@radix-ui/react-toast` | Not installed | Absent from current dependency tree |
| [#42](https://github.com/nocoo/geekhub/issues/42) | `@radix-ui/react-tooltip` | `1.2.16` | Already satisfied; retained |
| [#43](https://github.com/nocoo/geekhub/issues/43) | `@supabase/ssr` | Not installed | Absent from current dependency tree |
| [#44](https://github.com/nocoo/geekhub/issues/44) | `@supabase/supabase-js` | Not installed | Absent from current dependency tree |
| [#45](https://github.com/nocoo/geekhub/issues/45) | `@tailwindcss/typography` | Not installed | Absent from current dependency tree |
| [#46](https://github.com/nocoo/geekhub/issues/46) | `@tanstack/react-query` | `5.104.0` | Updated |
| [#47](https://github.com/nocoo/geekhub/issues/47) | `@testing-library/react` | `16.3.3` | Already satisfied; retained |
| [#48](https://github.com/nocoo/geekhub/issues/48) | `@types/jsdom` | Not installed | Absent from current dependency tree |
| [#49](https://github.com/nocoo/geekhub/issues/49) | `@types/node` | `26.6.3` | Updated |
| [#50](https://github.com/nocoo/geekhub/issues/50) | `@types/react` | `19.3.0` | Already satisfied; retained |
| [#51](https://github.com/nocoo/geekhub/issues/51) | `@types/react-dom` | `19.3.0` | Already satisfied; retained |
| [#52](https://github.com/nocoo/geekhub/issues/52) | `@vitest/coverage-v8` | `5.0.3` | Updated |
| [#53](https://github.com/nocoo/geekhub/issues/53) | `@vitest/mocker` | `5.0.3` | Already satisfied; retained |
| [#54](https://github.com/nocoo/geekhub/issues/54) | `autoprefixer` | Not installed | Absent from current dependency tree |
| [#55](https://github.com/nocoo/geekhub/issues/55) | `baseline-browser-mapping` | Not installed | Absent from current dependency tree |
| [#56](https://github.com/nocoo/geekhub/issues/56) | `brace-expansion` | Not installed | Absent from current dependency tree |
| [#57](https://github.com/nocoo/geekhub/issues/57) | `browserslist` | Not installed | Absent from current dependency tree |
| [#58](https://github.com/nocoo/geekhub/issues/58) | `eslint` | Not installed | Absent from current dependency tree |
| [#59](https://github.com/nocoo/geekhub/issues/59) | `eslint-config-next` | Not installed | Absent from current dependency tree |
| [#60](https://github.com/nocoo/geekhub/issues/60) | `html-react-parser` | Not installed | Absent from current dependency tree |
| [#61](https://github.com/nocoo/geekhub/issues/61) | `js-yaml` | Not installed | Absent from current dependency tree |
| [#62](https://github.com/nocoo/geekhub/issues/62) | `jsdom` | `30.1.1` | Updated |
| [#63](https://github.com/nocoo/geekhub/issues/63) | `lucide-react` | `1.49.0` | Updated |
| [#64](https://github.com/nocoo/geekhub/issues/64) | `nanoid` | `3.3.19` | Safe maintained 3.x branch; both advisories fixed |
| [#65](https://github.com/nocoo/geekhub/issues/65) | `next` | Not installed | Absent from current dependency tree |
| [#66](https://github.com/nocoo/geekhub/issues/66) | `openai` | Not installed | Absent from current dependency tree |
| [#67](https://github.com/nocoo/geekhub/issues/67) | `p-limit` | Not installed | Absent from current dependency tree |
| [#68](https://github.com/nocoo/geekhub/issues/68) | `postcss` | `8.5.28` | Already satisfied; retained |
| [#69](https://github.com/nocoo/geekhub/issues/69) | `postcss-selector-parser` | Not installed | Absent from current dependency tree |
| [#70](https://github.com/nocoo/geekhub/issues/70) | `react` | `19.3.0` | Updated |
| [#71](https://github.com/nocoo/geekhub/issues/71) | `react-dom` | `19.3.0` | Updated |
| [#72](https://github.com/nocoo/geekhub/issues/72) | `sharp` | `0.35.4` | Already satisfied; retained |
| [#73](https://github.com/nocoo/geekhub/issues/73) | `sonner` | `2.0.8` | Already satisfied; retained |
| [#74](https://github.com/nocoo/geekhub/issues/74) | `tailwind-merge` | `3.7.0` | Already satisfied; retained |
| [#75](https://github.com/nocoo/geekhub/issues/75) | `tailwindcss` | `4.3.3` | Already satisfied; retained |
| [#76](https://github.com/nocoo/geekhub/issues/76) | `typescript` | `7.0.2` | Already satisfied; retained |
| [#77](https://github.com/nocoo/geekhub/issues/77) | `undici` | `8.11.2`, `7.30.0`, `7.29.1` | Updated; all 7.x and 8.x copies outside affected ranges |
| [#78](https://github.com/nocoo/geekhub/issues/78) | `vitest` | `5.0.3` | Updated |

The security-only nanoid issue names a 5.x target, but its own affected ranges
also identify patched 3.x versions. PostCSS requires the 3.x branch; 3.3.19 fixes
both listed advisories. Likewise, Miniflare pins undici 7.29.1, while other
consumers use 7.30.0 and 8.11.2. Every installed resolution was checked against
every affected range in the 48 issue bodies; none matched. Do not force a major
version outside an upstream contract solely to match an issue title.

## Validation

`bun run quality` exited 0 on the final code revision:

| Check | Result |
| --- | --- |
| Typecheck | Wrangler generation and all four strict TypeScript projects passed |
| Lint | Biome check-only passed, zero errors/warnings |
| Unit tests | 17 files, 191 tests passed, no skips |
| Coverage | Statements 99.72%, branches 97.94%, functions 100%, lines 99.92% |
| Build | Passed; existing chunk-size advisory remains (main client chunk about 617 kB) |
| L2 | 109 real HTTP checks, reported inventory 33/33 endpoints, isolated Worker/SQLite |
| L3 | 56 desktop/mobile browser tests passed in 3.1 minutes |
| Security | gitleaks 8.30.1: no leaks; OSV 2.6.0: no findings across 540 lock entries |

The local OSV version is newer than the handbook's 2.5.1 requirement; this is
reported toolchain drift, not evidence that 2.5.1 was executed. Local runtimes
were Bun 1.4.2 and Node 26.10.0; manifest/CI pins were not changed. Existing
index-snapshot and hook-latency gaps remain; this maintenance is not a new L1 grade.

A fresh temporary directory passed `bun install --frozen-lockfile` through the
approved mirror, without changing its copied lockfile. The universal SDK patch
was reapplied and the unused Next.js entry remained unpatched. The temporary
installation was removed afterward.

After `bun run setup`, local SQLite retained 39 subscriptions, 1,730 articles,
420 read articles, zero stars and zero read-later flags, exactly matching the
read-only pre-migration counts. The retired table and columns are absent.
`bun dev` serves `https://geekhub.dev.hexly.ai` via Caddy with normal TLS checking.
Health reports `ok`, version `1.4.1`, D1 storage, and the session is local.

Chromium checked the real local reader and settings at 1440, 390 and 320 px:
no page/console errors or horizontal overflow. Settings dialogs remain inside
the viewport. Screenshots were visually inspected at desktop and 320 px.
No live AI generation, feed refresh or production data write was performed.

Run artifacts are local and ignored: `test-results/dependency-cleanup/`,
`test-results/security/`, `coverage/`, and `playwright-report/`.
The complete command log is `/tmp/geekhub-quality-20261001.log`.

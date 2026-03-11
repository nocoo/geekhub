# Changelog

## [0.2.1] - 2026-03-11

### Tests

- Implement 4-layer test architecture (L1 UT, L2 Lint, L3 API E2E, L4 BDD E2E)
- Add 67 API E2E tests across 10 test files covering all RESTful endpoints
- Add mock server infrastructure (Bun.serve at port 14000) for AI and external URL routes
- Migrate 3 test files from vitest to bun:test
- Add coverage for useArticleActions hooks, boosting coverage from 87% to 93%

### Chores

- Setup husky with pre-commit (UT + lint) and pre-push (coverage + API E2E) hooks
- Add coverage check script with 90% threshold enforcement
- Strengthen ESLint config with strict rules and zero-warning policy
- Add test, lint, and E2E scripts to package.json

### Fixes

- Fix env loading order for E2E (dotenv-cli first-file-wins)
- Seed test user automatically in E2E runner
- Fix explicit glob path for E2E test discovery (bunfig.toml root workaround)
- Add site_url column and fix auth trigger permissions in DB migration
- Gitignore supabase local temp files

### Docs

- Update testing docs to reflect 4-layer architecture
- Add test improvement plan (docs/08)

## [0.2.0] - 2026-03-11

### Features

- Responsive mobile layout with 3-level navigation
- React performance optimization and database security hardening
- Blog discovery feature
- Dev mode authentication and sidebar UX improvements
- Content translation in ReaderView with auto-translate, queue, and cache
- Batch article translation with concurrent async updates
- AI summary with caching and UI improvements
- Batch fetch all feeds functionality
- Bookmark and read later article features
- Image proxy to bypass anti-hotlinking protection
- User settings system with proxy, AI BYOM, and RssHub support
- Hot-loading, proxy auto-detection, and full content fetching
- Article read tracking with mark-as-read
- SSE real-time logs replacing polling
- Feed management with auto-fetch and improved discovery
- HTML content rendering with html-react-parser
- RSS management system with categories and feeds APIs
- Supabase authentication and database schema

### Refactoring

- MVVM architecture optimization
- Service layer extraction with optimistic update tests
- Migrate from Jest to Bun test runner
- Upgrade to React 19 and Next.js 16 with Turbopack
- Remove i18n, simplify to Chinese-only UI
- Three-layer article architecture redesign
- Migrate article operations to UUID instead of hash

### Chores

- Upgrade @types/node 20 -> 22, jsdom 27 -> 28, tailwind-merge 2.6 -> 3.5, sonner 1.7 -> 2.0
- Remove 6 unused dependencies (including date-fns)
- Update all pinned dependencies to latest patch

### Tests

- Unit test coverage improved to 90% for core modules
- Tests for feed-actions, article-repository, view-models, rss, logger, SSEContext

### Docs

- Comprehensive documentation tree (01-07)
- README restructured with agent development guide

## [0.1.0] - 2025-12-01

- Initial release with Next.js 15, Swagger, RSS parser

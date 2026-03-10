# Changelog

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

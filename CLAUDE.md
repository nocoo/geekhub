# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**GeekHub** is a modern RSS feed reader with AI-powered summaries, built with Next.js 16, React 19, and Supabase. The application features a hybrid storage architecture: metadata in Supabase (PostgreSQL) and article content on the file system for efficient scaling.

## Architecture

### Hybrid Storage Strategy

The codebase uses a dual-layer storage pattern:

- **Supabase (PostgreSQL)**: User auth, categories, feeds, read status, bookmarks, fetch logs
  - Enforced via Row Level Security (RLS) - users can only access their own data
  - Migrations in `supabase/migrations/` (001-016)
  - Key tables: `categories`, `feeds`, `read_articles`, `bookmarked_articles`, `fetch_logs`

- **File System (`data/`)**: Article content and RSS metadata
  - `data/feeds/{url_hash}/` - Per-feed storage (url_hash = MD5(url)[:12])
  - `meta.json` - RSS feed metadata
  - `articles/{YYYY}/{MM}/{article_hash}.json` - Article content (date-sharded)
  - `index.json` - Article index (recent 1000)
  - `cache.json` - Fetch cache with ETag/Last-Modified support

### Key Patterns

- **Repository Pattern**: `ArticleRepository` (file system access), `ReadStatusService` (Supabase)
- **ViewModel**: `ArticleViewModel` transforms data for UI consumption
- **SSE (Server-Sent Events)**: Real-time push for fetch logs and article updates
- **Proxy Detection**: Auto-detects Clash/Clash Verge ports (7890, 7891, 7897, 7898, 10808, 10809)
- **AI Integration**: OpenAI-compatible API for summaries/translation (supports custom base URL)

## Development Commands

```bash
# Development
bun run dev              # Start Next.js dev server (Turbopack)

# Build & Deploy
bun run build           # Production build
bun start              # Start production server

# Testing
bun test               # Run Bun tests

# Linting
bun run lint           # ESLint
```

## Environment Variables

Required in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=           # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=      # Supabase anonymous key
SUPABASE_SERVICE_KEY=               # Service role key (required for admin operations)
```

## Code Structure

```
src/
├── app/api/              # Next.js API routes
├── components/
│   ├── ui/              # shadcn/ui primitives (Dialog, Select, etc.)
│   ├── manage/          # Management dialogs (AddFeed, EditCategory, etc.)
│   ├── ArticleList.tsx  # Article list with infinite scroll
│   ├── ReaderView.tsx   # Immersive reading view (auto-translate, AI summary)
│   ├── Sidebar.tsx      # Category nav + crawler preview terminal
│   └── SettingsDialog.tsx  # Proxy/AI/RSSHub settings
├── contexts/
│   ├── AuthContext.tsx    # Supabase auth state
│   ├── SSEContext.tsx     # Server-Sent Events for real-time updates
│   └── FeedFetchContext.tsx  # Feed fetching state management
├── hooks/                # Custom React hooks
│   ├── useFeedViewModels.ts  # Feed data management
│   ├── useFeedActions.ts     # Feed CRUD operations
│   ├── useArticleActions.ts  # Article read/bookmark actions
│   └── useDatabase.ts        # Supabase database hooks
├── lib/
│   ├── article-repository.ts      # File system data access
│   ├── article-view-model.ts      # UI data transformation
│   ├── article-actions.ts         # Article business logic
│   ├── feed-fetcher.ts            # RSS fetching with proxy support
│   ├── feed-actions.ts            # Feed business logic
│   ├── read-status-service.ts     # Supabase read status management
│   ├── translation-queue.ts       # AI translation queue with cache
│   ├── image-proxy.ts             # Image proxy for hotlink protection
│   ├── rsshub.ts                  # RSSHub route parser
│   ├── settings.ts                # User settings (proxy, AI, RSSHub)
│   ├── rss.ts                     # RSS parsing (rss-parser + cheerio)
│   └── logger.ts                  # Fetch logging utilities
├── schemas/              # Database schemas/types
└── types/                # TypeScript definitions
```

## Key Files to Understand

- `middleware.ts` - Auth guard, redirects unauthenticated users to `/login`
- `docs/file-storage-design.md` - Detailed file storage architecture
- `docs/data-model-layer.md` - Service layer and data model documentation
- `src/lib/rss.ts` - RSS parsing logic (uses rss-parser + cheerio)
- `src/lib/fetch-with-settings.ts` - HTTP fetch with proxy/auto-detect
- `src/lib/feed-fetcher.ts` - RSS feed fetching with proxy support

## Testing

- Framework: Bun test (native)
- Existing tests cover: repository layer, view model, read status service, RSS parsing
- Test files follow `*.test.ts` naming convention
- Use `bun test` to run, target `src/**/*.ts`

## Technology Stack

- **Frontend**: Next.js 16.1 (App Router), React 19.2, TypeScript 5 (strict)
- **UI**: Radix UI primitives + shadcn/ui + TailwindCSS 3.4
- **State**: React Context (AuthContext, SSEContext, FeedFetchContext)
- **Data Fetching**: TanStack Query (React Query)
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **RSS**: rss-parser + cheerio (HTML parsing)
- **AI**: OpenAI SDK (supports custom API base URL)
- **Proxy**: undici + https-proxy-agent
- **Real-time**: Server-Sent Events (SSE)

## Path Aliases

Use `@/` prefix for imports from `src/`:
```typescript
import { ArticleRepository } from '@/lib/article-repository'
```

## Important Notes

- **TypeScript strict mode enabled** - All code must be type-safe
- **File system storage** - Articles stored in `data/feeds/{url_hash}/articles/{YYYY}/{MM}/`
- **Hash generation** - url_hash = MD5(url)[:12], article_hash = MD5(url|title|published_at)
- **RLS enforced** - All Supabase queries respect user isolation
- **Proxy auto-detection** - Checks Clash ports sequentially
- **SSE endpoints** - `/api/logs` (crawler logs), `/api/sse` (fetch events)

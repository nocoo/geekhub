<p align="center">
  <img src="../assets/brand/icon-rounded.png" width="128" height="128" alt="GeekHub" />
</p>

<h1 align="center">GeekHub</h1>

<p align="center">Read RSS subscriptions in one place, with Chinese summaries and translations for foreign-language articles.</p>

<p align="center">
  <a href="https://geekhub.vercel.app">Website</a> ·
  <a href="../README.md">简体中文</a>
</p>

## What it does

GeekHub is an RSS reader that you can deploy yourself. It combines subscriptions, article lists, and a reading view in one web interface, with categories, read states, bookmarks, and read-later lists. Configure an OpenAI-compatible endpoint to generate Chinese summaries and translations.

The application uses Supabase PostgreSQL and Auth for data and sign-in. It works with Supabase Cloud or a self-hosted Supabase instance. AI, proxy, and RSSHub settings live in the current browser; the application server forwards AI requests to the configured endpoint.

## Features

- Add and manage RSS / Atom feeds, browse by category, and resolve `rsshub://` addresses through a configured RSSHub instance.
- Refresh feeds manually and inspect fetch status, article counts, and logs updated through SSE.
- Read articles, request full-page content extraction, and mark items as read, bookmarked, or saved for later.
- Generate Chinese summaries and translate titles, descriptions, and full content; enable automatic translation for individual feeds.
- Adjust reading fonts and themes, and configure an HTTP proxy and image proxying.
- View subscription and storage statistics, and clean up old logs or selected articles.

Full-content extraction depends on the webpage structure and access conditions. RSSHub and AI features each need a reachable instance or endpoint. The repository currently has no separate scheduled feed-fetching service; routine updates are triggered by refresh controls in the interface.

## Usage

Open the [website](https://geekhub.vercel.app) and sign in with Google, or deploy your own instance using the steps below. Add a feed, refresh it, and open an article from the list. Categories, bookmarks, and read-later items are available in the sidebar.

AI features are disabled by default. Turn on AI in settings, enter an API key, base URL, and model, then use the configuration-validation button. These settings, including the key, are stored in the browser's localStorage. Filling only the environment template's `OPENAI_*` variables does not replace the UI configuration.

## Development

Install Bun and prepare a Supabase project. Node.js 24 or newer is recommended.

```bash
git clone https://github.com/nocoo/geekhub.git
cd geekhub
bun install --frozen-lockfile
cp .env.example .env.local
```

In your Supabase project, apply every SQL file in [supabase/migrations/](../supabase/migrations/) in filename order. Enable the Google provider in Supabase Auth and add `http://localhost:3000/auth/callback` to the application's allowed redirect URLs.

| Environment variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Key used by the browser and regular sessions |
| `SUPABASE_SERVICE_KEY` | Server-side service role key for fetching, logging, and data operations |

```bash
bun run dev
bun run lint
bun run typecheck
bun run build
bun run start
```

The default address is `http://localhost:3000`. In production, configure Supabase redirects for the actual site URL. Reverse proxies need to support the SSE connection at `/api/logs/stream`. Most source code lives in `src/app/api/`, `src/components/`, and `src/lib/`.

## Tests

| Layer | Command |
| --- | --- |
| Unit and component tests | `bun run test` |
| HTTP API end-to-end tests | `bun run test:e2e` |

Use `bun run test:coverage` for a unit-test coverage report. The API test script starts Next.js on port `13000` and an RSS / webpage / AI mock server on port `14000`.

Full database scenarios need a separate test Supabase instance. Apply the migrations and put its URL, anon key, and service role key in `.env.test.local`. The script creates a test user and writes and cleans up test data. The default `.env.test` points to `127.0.0.1:54321`. Database-dependent cases are skipped when Supabase is unreachable or still uses placeholder keys; other HTTP cases continue. That result does not validate database behavior. The repository currently has no separate browser-automation test entry point.

## Stack

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-149ECA?logo=react&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)

| Area | Implementation |
| --- | --- |
| Web and UI | Next.js, React, TypeScript, Tailwind CSS, Radix UI, TanStack Query |
| Data and sign-in | Supabase PostgreSQL, Supabase Auth / Google OAuth |
| Fetching and AI | rss-parser, Cheerio, Undici, OpenAI SDK |
| Development and tests | Bun, Vitest, Testing Library, ESLint |

## Documentation

- [Database design](06-database.md)
- [API reference](05-api-reference.md)
- [Architecture](01-architecture.md)
- [Logo usage](09-logo-usage.md)

## License

The repository currently does not include a license file.

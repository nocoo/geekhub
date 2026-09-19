<p align="center"><img src="../public/logo-128.png" width="128" alt="GeekHub logo" /></p>
<h1 align="center">GeekHub</h1>
<p align="center">A single-user RSS reader with subscriptions, read-later lists and AI assistance in a three-pane interface.</p>
<p align="center"><a href="https://geekhub.hexly.ai">Website</a> · <a href="../README.md">简体中文</a></p>

## What it does

GeekHub brings RSS / Atom subscriptions, reading states, AI summaries and translations into one reader. A Cloudflare Worker serves the web interface and Hono API, with all data stored in D1. Cloudflare Access authenticates entry; all authorized identities use the same reading dataset.

## Features

- The settings gear groups subscriptions, categories, reading, AI and data. Edit feed/site URLs, drag to reorder and move feeds between categories.
- RSS, Atom and RSSHub support, curated blog discovery and search; changing a source URL preserves articles and reading states.
- A three-pane reader with full-text retrieval, search, pagination, read/unread, stars and read-later lists.
- AI summaries and translations of titles, introductions and full articles. Per-feed options fetch full text before translating, reusing results saved in D1.
- Public `@nocoo/next-ai` settings components, encrypted AI keys and connection testing.
- Light/dark themes, font and size controls, image preferences, data cleanup and filterable activity logs.
- The bottom-left Basalt avatar uses public lizheng.blog identity; the top-right Activity center groups fetching, translation, summaries, extraction and diagnostics, keeping the latest 500 entries in memory.
- New articles load automatically above the list, with a bottom-right toast and preserved reading position, prose and selection. Automatic translation stays silent.
- Feeds, categories, articles and search have direct URLs. Browser back/forward and reload restore the article, list pagination and reading position.
- Sanitized HTML becomes Markdown with images, links, code and tables, simplifying source layouts. Images load through a restricted proxy.
- Feed diagnostics show connectivity, duration, article count, time range, stale-feed hints and HTTP/HTTPS site and RSS rediscovery. A total score, five metrics and radar chart support keep/review/replace/pause recommendations; replacement preserves historical articles.
- Keyboard shortcuts: `J/K` smoothly move between articles, placing selection 38.2% from the top of the list; `/` searches, `M/S/L` change reading states, `O` opens the original and `R` refreshes. Reader shortcuts stay inactive inside inputs and dialogs.
- A GitHub project link is available in the top-right corner.
- Desktop and mobile layouts retain the GeekHub identity, green accent and decorative details.

## Usage

Open [geekhub.hexly.ai](https://geekhub.hexly.ai), sign in through Cloudflare Access, and use the top-right settings gear to add feeds and configure AI.

### Import existing data

```sh
bun run db:import /path/to/csvs --check
bun run db:import /path/to/csvs --local
bun run db:import /path/to/csvs --remote
```

The directory must contain `blogs_rows.csv`, `categories_rows.csv` and `feeds_rows.csv`. Validate with `--check`; `--local` writes locally and `--remote` writes production data. Imports update original IDs, preserving category relationships, colors, icons, ordering, ratings and automatic translation settings while ignoring legacy `user_id`. Repeated runs do not rebuild or clear articles. Keep original exports out of Git. See [data import](04-data-import.md).

## Development

Requires Bun 1.4.0 and Node.js 26.8.1; CSV imports use the Python 3 standard library.

```sh
bun install --frozen-lockfile
bun run setup
bun dev
```

```sh
bun run typecheck
bun run lint
bun run build
```

Open https://geekhub.dev.hexly.ai through Caddy at `127.0.0.1:7005`. `setup` creates local SQLite and an encryption key, adding sample feeds only when no subscriptions exist and preserving imported data. Wrangler / Miniflare simulate the Worker, D1 and Queues; development state lives in `.wrangler/state/`. Local identity and mock AI require the local environment and loopback requests; real subscriptions can still fetch public websites.

`src/web/` owns the interface, `src/worker/` owns API/authentication/fetching/AI, `src/shared/` holds browser-safe contracts, and `migrations/` owns the D1 schema. `docs/archieve/` contains historical documentation, not current system guidance. See [deployment](05-deployment.md) for production configuration and migrations.

## Tests

```sh
bun run test:coverage
bun run test:l2
bunx playwright install chromium
bun run test:l3
```

Vitest runs unit tests. HTTP and Playwright browser tests use ports 17005 / 27005 and fresh local SQLite per run, without development databases or production Access / AI credentials.

## Stack

| Technology | Role |
| --- | --- |
| React · Vite · Basalt | Responsive reader |
| TypeScript · Bun · Biome | Types, scripts and static checks |
| Hono · Cloudflare Workers | API and authentication |
| D1 · Queues | Storage and reader-triggered RSS fetching |
| @nocoo/next-ai | AI configuration, summaries and translation |
| Vitest · Playwright | Unit, HTTP and browser tests |

## Documentation

- [Architecture](01-architecture.md)
- [Development and API](02-development.md)
- [Test guide](03-quality.md)
- [Data import](04-data-import.md)
- [Deployment](05-deployment.md)
- [Reader updates and feed diagnostics](07-reader-workflow.md)

## License

The repository does not currently provide a standalone LICENSE file. Public source availability does not itself grant an open-source license.

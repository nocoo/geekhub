# GeekHub

Vite / React RSS reader, one Cloudflare Worker serving the SPA and Hono API. D1 is the source of truth. Brand: GeekHub, domain `geekhub.hexly.ai`.

- Use TypeScript 7.0.2 strict, Biome, Bun and `@nocoo/basalt` 2.1.7. Read the installed Basalt integration guide before changing application chrome.
- `src/web` is browser-only; `src/worker` is server-only; `src/shared` contains browser-safe contracts. Never import the AI server entry or secrets into the browser.
- Use `@nocoo/next-ai` public contracts, React configuration components and universal `/server` entry.
- Verify Cloudflare Access JWT signatures, issuer and audience. Local identity and mock AI are restricted to the local environment and loopback requests. Production fails closed.
- GeekHub is a single-user reader: Access authenticates entry, while subscriptions, reading states and settings belong to one shared dataset. Do not partition data by Access subject or legacy `user_id`. Parameterize D1 SQL. Sanitize fetched HTML and validate outbound URLs and redirects.
- Feed work uses Queues; scheduling uses Cron. Do not launch floating background promises or use local filesystem data in the Worker.
- `archieve/` and `docs/archieve/` are historical snapshots, outside active build/test/lint. Do not edit legacy source as part of new features.
- 6DQ: G1 typecheck + Biome with zero warnings; L1 meaningful unit coverage ≥95% all four; L2 real HTTP against isolated Wrangler SQLite; L3 Playwright user flows; G2 gitleaks + OSV; production smoke evidence in docs.
- Test isolation uses local Wrangler / Miniflare Workers and a fresh SQLite persistence directory per run, separate from development. Do not create or deploy remote `-test` resources. Verify local bindings, the runtime context and `_test_marker` before test seed/reset/cleanup.
- Ports: development 7005 (`https://geekhub.dev.hexly.ai` via Caddy), L2 17005, L3 27005. The Vite Cloudflare plugin runs the local Worker without a separate sidecar.
- `bun run setup`, `bun dev`, `bun run quality`. `bun run deploy` builds and deploys production; never deploy the local environment. Apply remote migrations before deploying dependent code.
- Do not lower coverage, skip tests, suppress security failures or bypass hooks to pass a gate.

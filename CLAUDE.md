Read [AGENTS.md](AGENTS.md) and [README.md](README.md).

Local development, manual browser checks and preview links must use **https://geekhub.dev.hexly.ai** through Caddy, with normal TLS verification. The loopback address is the proxy upstream, not the browser development entry.

| Purpose | Domain / port |
| --- | --- |
| Local development | `https://geekhub.dev.hexly.ai` → Caddy → `127.0.0.1:7005` |
| Isolated L2 HTTP tests | `http://127.0.0.1:17005` |
| Isolated L3 Playwright tests | `http://127.0.0.1:27005` |
| Production | `https://geekhub.hexly.ai` |

Keep the ports and domains consistent with `vite.config.ts`, `scripts/run-tests.ts`, `wrangler.jsonc`, `/opt/homebrew/etc/Caddyfile` and the `workflow/caddy/Caddyfile` copy. L2/L3 keep their isolated Worker and SQLite directories; the development Caddy domain points only to port 7005. One Vite process serves the SPA and local Worker; no separate sidecar is needed.

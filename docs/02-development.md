# 开发与 API

## 本地环境

```sh
bun install --frozen-lockfile
bun run setup
bun dev
```

开发环境不需要 Cloudflare 生产凭据。Vite 的 Cloudflare 插件在本地运行真实 workerd runtime，D1 由 Wrangler SQLite 模拟，Queue 也在本地消费。服务器只监听回环地址，端口分配遵循 nmem：

| 用途 | 地址／端口 | SQLite |
| --- | --- | --- |
| 日常开发 | `127.0.0.1:7005` | `.wrangler/state/` |
| Caddy | `https://geekhub.dev.hexly.ai` → 7005 | 同上 |
| L2 | `127.0.0.1:17005` | `.wrangler/tests/l2-<随机值>/` |
| L3 | `127.0.0.1:27005` | `.wrangler/tests/l3-<随机值>/` |

集成插件提供 SPA 与 API，不需要单独的 37005 sidecar。7028 系列属于 Firefly，勿占用。

本机 Caddy 映射位于 `/opt/homebrew/etc/Caddyfile`，TLS 证书在 workflow 仓库的 `certs/`，通配符 `*.dev.hexly.ai` 已解析到 `127.0.0.1`。API 对该域名的本地身份要求回环 peer；任意公网域名或生产环境不能绕过 Access。

`setup` 创建 `.dev.vars.local` 中的随机加密密钥，权限为 0600。该文件和 SQLite 均不进 Git。执行 `setup` 不会覆盖已有订阅；空库才加入 4 个示例源和 24 篇示例文章。真实 RSS 仍可联网抓取，本地示例域名由 fixture 响应。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `bun run setup` | 本地迁移、加密密钥和首次示例数据 |
| `bun dev` | 启动本地 SPA／Worker |
| `bun run typecheck` | Wrangler binding 类型生成及全部严格类型检查 |
| `bun run lint` | Biome，警告也导致失败 |
| `bun run test:coverage` | L1，四项覆盖率均需 ≥95% |
| `bun run test:l2` | 隔离 Worker + SQLite 的真实 HTTP 检查 |
| `bun run test:l3` | 桌面和移动端 Playwright 流程 |
| `bun run gate:security` | gitleaks + OSV |
| `bun run quality` | 全部检查与生产构建 |
| `bun run db:import <目录> --check` | 校验 CSV，输出数量和 SHA-256，不写库 |
| `bun run deploy` | 远程迁移 → 生产构建 → Worker 部署 |

首次跑浏览器测试需要 `bun x playwright install chromium`。Linux CI 使用 `--with-deps`。

## HTTP API

除 `/api/live` 外，生产 API 均要求有效 Access JWT。本地浏览器直接调用同源 `/api`。写操作使用 JSON，最大 64 KiB；错误格式为 `{ "error": "可展示的消息" }`。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/api/live` | 版本与 D1 可用性 |
| GET | `/api/session` | 已验证身份、lizheng.blog 公开姓名／头像、本地环境标志 |
| GET / POST | `/api/categories` | 分类列表／创建 |
| PATCH / DELETE | `/api/categories/:id` | 修改／删除分类 |
| GET / POST | `/api/feeds` | 订阅列表／创建 |
| PATCH / DELETE | `/api/feeds/:id` | 更新设置／删除订阅及文章 |
| POST | `/api/feeds/:id/refresh` | 单源入队，202 |
| POST | `/api/refresh` | 全部启用订阅入队，202 |
| GET | `/api/articles` | 按视图、源、分类、搜索和游标分页 |
| GET / PATCH | `/api/articles/:id` | 正文／修改已读、收藏、稍后阅读 |
| POST | `/api/read-all` | 按源／分类或全局标记已读 |
| POST | `/api/articles/:id/full` | 抓取并清理全文 |
| POST | `/api/articles/:id/ai` | `summary`、`translate`、`translate-title` |
| GET / PATCH | `/api/settings` | 阅读偏好，局部原子更新 |
| GET / PATCH | `/api/ai/settings` | AI 公共设置契约，读取不返回密钥 |
| POST | `/api/ai/test` | 测试服务商连接，本地未配密钥时模拟 |
| GET | `/api/stats` | 阅读和存储统计 |
| POST | `/api/cleanup` | 清理过期文章，保护收藏和稍后阅读 |
| GET / DELETE | `/api/logs` | 筛选抓取日志／清空 |
| GET | `/api/directory` | 精选博客、标签、评分 |
| GET | `/api/images?url=...` | 有类型与大小限制的图片代理 |

文章分页支持 `view=all|unread|starred|later`、`feedId`、`categoryId`、`search`、`cursor`、`limit`（1–50）。搜索按字面处理 `%` 和 `_`。`POST /api/articles/:id/ai` 的 `force=true` 表示主动重新生成；否则优先使用缓存。

RSSHub 支持 `rsshub://namespace/route` 跟随设置中的实例，也保留旧版的 `rsshub://rsshub.example.com/namespace/route` 自定义公开实例写法。两种写法均检查公开 URL，并在每次跳转时重新校验。

## 故障定位

源无法抓取时先看抓取日志，再尝试打开原文。RSSHub 公共实例和部分站点可能返回 403 或超时；可以在设置中更换 RSSHub 实例。CSV 不含历史文章，首次刷新后由队列重新抓取。

Access 返回 401／503 时检查团队名、应用 AUD、JWT 有效期及 JWKS 连通性。修改 AI 服务端加密密钥会使已有密文无法解密，应先导出并制定密钥轮换方案，不要随意重新生成生产密钥。

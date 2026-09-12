# 开发与 API

## 本地环境

```sh
bun install --frozen-lockfile
bun run setup
bun dev
```

本地开发、浏览器验收和提供给用户的预览链接统一使用 **https://geekhub.dev.hexly.ai**，通过 Caddy 访问并保持正常 TLS 校验。

开发环境不需要 Cloudflare 生产凭据。Vite 的 Cloudflare 插件在本地运行真实 workerd runtime，D1 由 Wrangler SQLite 模拟，Queue 也在本地消费。服务器只监听回环地址，端口分配遵循 nmem：

| 用途 | 地址／端口 | SQLite |
| --- | --- | --- |
| 日常开发／浏览器入口 | `https://geekhub.dev.hexly.ai` | `.wrangler/state/` |
| Caddy 上游／Vite 监听 | `127.0.0.1:7005` | 同上 |
| L2 自动化测试 | `http://127.0.0.1:17005` | `.wrangler/tests/l2-<随机值>/` |
| L3 自动化测试 | `http://127.0.0.1:27005` | `.wrangler/tests/l3-<随机值>/` |

生产域名为 `https://geekhub.hexly.ai`。L2／L3 直接连接各自的隔离 Worker；开发 Caddy 域名只代理日常 7005，不能用于测试库的 seed／reset／cleanup。

集成插件提供 SPA 与 API，不需要单独的 37005 sidecar。7028 系列属于 Firefly，勿占用。

本机 Caddy 映射位于 `/opt/homebrew/etc/Caddyfile`，同步副本为 `workflow/caddy/Caddyfile`；两处 GeekHub 配置均为 `geekhub.dev.hexly.ai` → `localhost:7005`，HTTP 自动跳转 HTTPS。TLS 证书在 workflow 仓库的 `certs/`，通配符 `*.dev.hexly.ai` 已解析到 `127.0.0.1`。API 对该域名的本地身份要求回环 peer；任意公网域名或生产环境不能绕过 Access。调整端口或域名时同步核对这两处配置、`vite.config.ts`、`scripts/run-tests.ts` 和 `wrangler.jsonc`。

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
| POST | `/api/categories/reorder` | 完整分类 ID 列表，原子保存排序 |
| GET / POST | `/api/feeds` | 订阅列表／创建 |
| PATCH / DELETE | `/api/feeds/:id` | 修改地址、分类、偏好／删除订阅及文章 |
| POST | `/api/feeds/reorder` | 完整订阅 ID 列表，可同时跨分类移动一个源 |
| POST | `/api/feeds/:id/refresh` | 单源入队，202 |
| GET / POST | `/api/feeds/:id/diagnostics` | 读取最近报告／发起或复用诊断，POST 返回 202 |
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

`PATCH /api/feeds/:id` 接受 `url`、`site_url`、`title`、`category_id`、`refresh_minutes`、`auto_translate`、`is_active`。`site_url: ""` 清除主站，`category_id: null` 移到未分类。换源保留文章与状态；重复或不安全的地址不会覆盖原设置。

两个排序接口接收 `{ "ids": ["id-1", "id-2"] }`，必须包含当前所有项目且不能重复。订阅排序可加 `{ "feedId": "id-1", "categoryId": null }`，同时保存分类移动。数据集合已经变化时返回 409；排序和移动不会部分成功。

诊断 POST 接收 `{}` 或 `{ "siteUrl": "https://example.com/blog/" }`，主站参数用于本次重新发现。GET 返回 `null` 或带有 `queued|running|success|error` 状态的对象。`report.feed` 包含请求地址、最终地址、跳转、HTTP 状态、耗时、返回数量、可读数量、时间范围和距最近发布天数；`sites` 为两个主站协议的结果，`candidates` 为已验证候选及失败原因。检查过程不写入文章。

诊断 ViewModel 通过 `src/web/lib/diagnostic-score.ts` 从已保存的报告派生总分、五项分数和建议，不增加抓取请求或数据库字段。RSS 可用性／新鲜度／条目完整度／响应速度／主站可达性权重为 30／30／20／10／10。未知项从分母中移除，结果标为暂定评分；RSS 不可用、没有可读文章、内容过旧分别限制总分最高 39／49／59 分。可读比例按实际最多 200 条样本计算，日期比例覆盖全量；候选只有可解析、有可读文章、时间已知且未过时、最终地址不同，才可作为替换建议。报告时间和评分保持一致，点击“重新检查”才更新观察结果。视图使用原生 SVG 雷达图和分项文字，未知项不画成零分。

## 故障定位

源无法抓取或疑似停更时，在中栏源标题旁点击诊断，或从设置里的“检查源”进入。报告可区分连接失败、空源、缺失时间和旧内容，并允许从主站寻找新 RSS、保留历史文章换源或暂停更新。RSSHub 公共实例和部分站点可能返回 403 或超时；可以在阅读设置中更换实例。CSV 不含历史文章，首次刷新后由队列重新抓取。

Access 返回 401／503 时检查团队名、应用 AUD、JWT 有效期及 JWKS 连通性。修改 AI 服务端加密密钥会使已有密文无法解密，应先导出并制定密钥轮换方案，不要随意重新生成生产密钥。

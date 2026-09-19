<p align="center"><img src="public/logo-128.png" width="128" alt="GeekHub logo" /></p>
<h1 align="center">GeekHub</h1>
<p align="center">一个单用户 RSS 阅读器，把订阅、稍后阅读和 AI 助手放在三栏界面中。</p>
<p align="center"><a href="https://geekhub.hexly.ai">站点</a> · <a href="docs/README.en.md">English</a></p>

## 这是什么

GeekHub 用于集中阅读 RSS / Atom 订阅、管理阅读状态并生成 AI 摘要和翻译。一个 Cloudflare Worker 提供 Web 界面与 Hono API，D1 保存全部数据；Cloudflare Access 负责登录，所有获准身份使用同一份阅读数据。

## 功能

- 右上角齿轮统一管理订阅、分类、阅读、AI 和数据；支持修改 RSS／主站地址、拖动排序和跨分类移动。
- RSS / Atom / RSSHub、精选博客发现与搜索；修改地址保留已有文章和阅读状态。
- 三栏阅读、全文抓取、搜索与分页、已读／未读、收藏、稍后阅读。
- AI 摘要、标题与简介翻译、全文翻译；订阅可自动获取全文后再翻译，已有结果直接复用并保存在 D1。
- `@nocoo/next-ai` 公共设置面板、加密存储 AI 密钥、连接测试。
- 明暗主题、字体和字号、图片开关、数据清理、可分类筛选的活动日志。
- 左下角 Basalt 头像使用 lizheng.blog 公开资料；右上角 Activity 汇总抓取、翻译、摘要、全文提取与诊断，内存保留最近 500 条。
- 新文章自动加入列表上方并通过右下角 toast 提示；保持当前正文、选区和滚动锚点，自动翻译静默更新。
- 订阅源、分类、文章和搜索拥有可直接打开的路径，支持浏览器前进／后退，刷新恢复当前文章、列表分页和阅读位置。
- HTML 正文整理为 Markdown 排版，保留图片、链接、代码和数据表格，简化源站布局；图片经过受限代理加载。
- 中栏订阅标题旁可打开源诊断：连接、耗时、文章数量、时间范围、停更提示、HTTP／HTTPS 主站和 RSS 重新发现；提供总分、五项评分、雷达图和保留／复查／替换／暂停建议，支持保留历史文章换源。
- `J/K` 平滑切换文章，选中行定位在列表顶部约 38.2%；`/` 搜索、`M/S/L` 管理阅读状态、`O` 原文、`R` 更新；输入框和弹窗内不触发阅读快捷键。
- 右上角提供 GitHub 项目链接。
- 桌面和移动端适配，保留原 GeekHub 标识、绿色强调色和装饰细节。

## 使用

访问 [geekhub.hexly.ai](https://geekhub.hexly.ai)，通过 Cloudflare Access 登录，在右上角齿轮中添加订阅和配置 AI。

### 导入旧数据

```sh
bun run db:import /path/to/csvs --check
bun run db:import /path/to/csvs --local
bun run db:import /path/to/csvs --remote
```

目录需包含 `blogs_rows.csv`、`categories_rows.csv`、`feeds_rows.csv`。先用 `--check` 校验，`--local` 写本地，`--remote` 写生产。导入按原 ID 更新，保留分类关系、颜色、图标、排序、评分和自动翻译设置，忽略旧 `user_id`；重复执行不会重建或清空文章。原始导出不加入 Git。详见 [数据导入](docs/04-data-import.md)。

## 开发

需要 Bun 1.4.0、Node.js 26.8.1；CSV 导入使用 Python 3 标准库。

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

打开 https://geekhub.dev.hexly.ai，通过 Caddy 代理到 `127.0.0.1:7005`。`setup` 创建本地 SQLite 和加密密钥，仅在没有订阅时加入示例数据，保留已有导入内容。Wrangler / Miniflare 模拟 Worker、D1 和 Queues，开发数据位于 `.wrangler/state/`。本地身份与模拟 AI 仅对本地环境和回环请求启用，真实订阅仍可抓取公开网站。

`src/web/` 管界面，`src/worker/` 管 API、认证、抓取与 AI，`src/shared/` 放浏览器安全契约，`migrations/` 管 D1 schema。`docs/archieve/` 是历史文档，不代表当前系统。生产配置和迁移见 [部署说明](docs/05-deployment.md)。

## 测试

```sh
bun run test:coverage
bun run test:l2
bunx playwright install chromium
bun run test:l3
```

Vitest 运行单元测试；HTTP 与 Playwright 浏览器测试分别使用 17005 / 27005，每轮创建独立本地 SQLite，不使用开发数据库或生产 Access / AI 凭据。

## 技术栈

| 技术 | 用途 |
| --- | --- |
| React · Vite · Basalt | 响应式阅读界面 |
| TypeScript · Bun · Biome | 类型、脚本与静态检查 |
| Hono · Cloudflare Workers | API 与身份验证 |
| D1 · Queues | 存储与读者操作触发的 RSS 抓取 |
| @nocoo/next-ai | AI 配置、摘要与翻译 |
| Vitest · Playwright | 单元、HTTP 与浏览器测试 |

## 文档

- [架构](docs/01-architecture.md)
- [开发与 API](docs/02-development.md)
- [测试说明](docs/03-quality.md)
- [数据导入](docs/04-data-import.md)
- [部署](docs/05-deployment.md)
- [阅读更新与订阅诊断](docs/07-reader-workflow.md)

## 许可证

仓库尚未提供独立的 LICENSE 文件；公开源码不代表已授予开源许可。

# GeekHub

一个单用户 RSS 阅读器。把订阅、稍后阅读和 AI 助手放在安静的三栏界面中，为真正感兴趣的内容留出时间。

**v1.2.1** · **生产：** https://geekhub.hexly.ai · **本地：** https://geekhub.dev.hexly.ai

Vite 8 + React 19 + TypeScript **7.0.2** strict，Bun、Biome，`@nocoo/basalt` **2.1.7**。一个 Cloudflare Worker 同时提供 SPA 和 Hono API；D1 保存全部数据，Queues 处理 RSS 抓取，Cron 调度更新。Cloudflare Access 负责登录，所有获准访问的身份使用同一份阅读数据。

## 开始开发

需要 Bun 1.4.0、Node.js 26.8.1。CSV 导入使用 Python 3 标准库；完整安全检查需要 gitleaks 8.30.1 和 osv-scanner 2.5.1。

```sh
bun install --frozen-lockfile
bun run setup
bun dev
```

直接访问 http://127.0.0.1:7005，或通过本机 Caddy 访问 https://geekhub.dev.hexly.ai。`setup` 创建本地 SQLite、生成本地加密密钥，并仅在没有订阅时加入示例阅读集；已有导入数据会保留。

本地使用 Wrangler / Miniflare 模拟 Worker、D1 和 Queues。开发数据在 `.wrangler/state/`；L2、L3 每轮使用各自的临时 SQLite 目录。**不创建或部署远程 `-test` 资源。** 本地身份与模拟 AI 只在本地环境和回环请求下启用；真实订阅仍可抓取公开网站。

## 阅读功能

- 分类和订阅管理、RSS / Atom / RSSHub、精选博客发现与搜索。
- 三栏阅读、全文抓取、搜索与分页、已读／未读、收藏、稍后阅读。
- AI 摘要、标题与简介翻译、全文翻译；结果保存在 D1。
- `@nocoo/next-ai` 公共设置面板、加密存储 AI 密钥、连接测试。
- 明暗主题、字体和字号、图片开关、数据清理、终端风格抓取日志。
- 左下角 Basalt 头像使用 lizheng.blog 公开资料；右上角单行 Activity 可打开加载详情。
- 侧栏搜索支持 `/` 快捷键，折叠时保留图标入口；文章列表头部压缩为标题、更新信息两行。
- 桌面和移动端适配，保留原 GeekHub 标识、绿色强调色和装饰细节。

## 导入旧数据

```sh
bun run db:import /path/to/csvs --check
bun run db:import /path/to/csvs --local
bun run db:import /path/to/csvs --remote
```

目录需要包含 `blogs_rows.csv`、`categories_rows.csv`、`feeds_rows.csv`。导入按原 ID 更新，保留分类关系、颜色、图标、排序、评分和自动翻译设置，忽略旧 `user_id`；重复执行不会重建或清空文章。原始导出文件不会加入 Git。详见 [数据导入](docs/04-data-import.md)。

## 检查与部署

```sh
bun run quality
bun run deploy
```

质量门覆盖 G1、L1、L2、L3、G2 和本地数据隔离。L1 四项覆盖率门槛均为 95%；L2 通过真实 HTTP 请求本地 Worker；L3 运行桌面与移动端浏览器流程。部署脚本先应用远程迁移，再构建并部署生产 Worker，拒绝本地和测试环境。

首次部署需配置生产 D1、Queue、Access 团队／AUD 和 `AI_ENCRYPTION_KEY`。AI 服务密钥由读者在设置中填写。详见 [部署说明](docs/05-deployment.md) 和 [质量证据](docs/03-quality.md)。

## 项目结构

| 目录 | 用途 |
| --- | --- |
| `src/web` | 浏览器界面与 API 适配 |
| `src/worker` | API、身份验证、抓取和 AI 服务 |
| `src/shared` | 浏览器安全的契约、校验与导入转换 |
| `migrations` | D1 schema |
| `tests` | L1、真实 HTTP、浏览器测试 |
| `scripts` | 开发数据、测试隔离、导入、部署和安全门 |
| `archieve` | v0.2.2 旧代码历史快照 |
| `docs/archieve` | 旧文档历史快照 |

旧 Next.js / Supabase 系统归档自 `d8d225b`，不参与新系统构建、测试或部署。当前设计见 [架构](docs/01-architecture.md)、[开发与 API](docs/02-development.md)。

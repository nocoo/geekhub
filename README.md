<p align="center">
  <img src="assets/brand/icon-rounded.png" width="128" height="128" alt="GeekHub" />
</p>

<h1 align="center">GeekHub</h1>

<p align="center">集中阅读 RSS 订阅，用中文摘要和翻译辅助阅读外文内容。</p>

<p align="center">
  <a href="https://geekhub.vercel.app">站点</a> ·
  <a href="docs/README.en.md">English</a>
</p>

## 这是什么

GeekHub 是可自行部署的 RSS 阅读器。它把订阅源、文章列表和正文阅读放在一个 Web 界面中，支持分类、已读状态、收藏和稍后阅读；配置兼容 OpenAI 的接口后，还能生成中文摘要及翻译。

应用使用 Supabase 的 PostgreSQL 与 Auth 保存数据和处理登录。可以连接 Supabase 云服务，也可以自行托管 Supabase。AI、代理和 RSSHub 设置保存在当前浏览器，AI 请求由应用服务端转发到用户配置的接口。

## 功能

- 添加和管理 RSS / Atom 订阅，按分类浏览文章；使用 RSSHub 实例解析 `rsshub://` 地址。
- 手动刷新订阅源，查看抓取状态、文章数量与通过 SSE 更新的日志。
- 在阅读器中查看正文、请求抓取网页全文，标记已读、收藏或稍后阅读。
- 为文章生成中文摘要，翻译标题、描述和正文；按订阅源启用自动翻译。
- 调整阅读字体与主题，配置 HTTP 代理和图片代理。
- 查看订阅与存储统计，清理旧日志或选定范围的文章。

全文提取取决于网页结构与访问条件；RSSHub 和 AI 功能分别需要可访问的实例与接口。仓库当前没有独立的定时抓取服务，日常更新通过界面的刷新操作触发。

## 使用

打开[站点](https://geekhub.vercel.app)并使用 Google 登录，或按下方步骤部署自己的实例。添加一个订阅源，刷新后从列表打开文章；分类、收藏和稍后阅读位于侧栏。

AI 功能默认关闭。在设置中打开「启用 AI 功能」，填写 API Key、Base URL 和模型，再点击「验证配置」。设置包括密钥会保存在该浏览器的 localStorage 中；只填写环境模板里的 `OPENAI_*` 不会替代界面配置。

## 开发

需要 Bun 和可用的 Supabase 项目；Node.js 建议使用 24 或更新版本。

```bash
git clone https://github.com/nocoo/geekhub.git
cd geekhub
bun install --frozen-lockfile
cp .env.example .env.local
```

在自己的 Supabase 项目中，按文件名顺序执行 [supabase/migrations/](supabase/migrations/) 下的全部 SQL。启用 Supabase Auth 的 Google provider，并将 `http://localhost:3000/auth/callback` 加入应用允许的回调地址。

| 环境变量 | 用途 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目地址 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 浏览器与普通会话使用的 key |
| `SUPABASE_SERVICE_KEY` | 服务端抓取、日志与数据操作使用的 service role key |

```bash
bun run dev
bun run lint
bun run typecheck
bun run build
bun run start
```

默认地址为 `http://localhost:3000`。生产环境使用实际站点地址配置 Supabase 回调；代理服务器需要支持 `/api/logs/stream` 的 SSE 连接。源代码主要位于 `src/app/api/`、`src/components/` 和 `src/lib/`。

## 测试

| 测试层 | 命令 |
| --- | --- |
| 单元与组件测试 | `bun run test` |
| HTTP API 端到端测试 | `bun run test:e2e` |

可用 `bun run test:coverage` 生成单元测试覆盖率报告。API 测试脚本自动启动端口 `13000` 的 Next.js 服务和端口 `14000` 的 RSS / 网页 / AI 模拟服务。

完整数据库场景需要独立的测试 Supabase，先应用迁移，再在 `.env.test.local` 填写它的 URL、anon key 和 service role key。脚本会创建测试用户并写入、清理测试数据；默认 `.env.test` 指向 `127.0.0.1:54321`。数据库不可达或仍使用占位 key 时，数据库相关测试会跳过，其他 HTTP 场景继续运行。这种结果不代表数据库功能已经验证。仓库当前没有独立的浏览器自动化测试入口。

## 技术栈

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-149ECA?logo=react&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)

| 部分 | 实现 |
| --- | --- |
| Web 与界面 | Next.js、React、TypeScript、Tailwind CSS、Radix UI、TanStack Query |
| 数据与登录 | Supabase PostgreSQL、Supabase Auth / Google OAuth |
| 抓取与 AI | rss-parser、Cheerio、Undici、OpenAI SDK |
| 开发与测试 | Bun、Vitest、Testing Library、ESLint |

## 文档

- [数据库设计](docs/06-database.md)
- [API 参考](docs/05-api-reference.md)
- [架构说明](docs/01-architecture.md)
- [Logo 使用](docs/09-logo-usage.md)

## 许可证

仓库当前未提供许可证文件。

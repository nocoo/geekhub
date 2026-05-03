# 测试改进计划

> 返回 [README](../README.md) | 参考 [测试规范](04-testing.md)

本文档记录 GeekHub 从当前测试状态到四层测试架构的改进计划。

---

## 目录

- [现状评估](#现状评估)
- [目标架构](#目标架构)
- [API Route 完整清单](#api-route-完整清单)
- [测试环境契约](#测试环境契约)
- [外部依赖 Mock 策略](#外部依赖-mock-策略)
- [Phase 1: 加固 L1 + L2](#phase-1-加固-l1--l2)
- [Phase 2: 搭建 L3 API E2E](#phase-2-搭建-l3-api-e2e)
- [Commit 拆解](#commit-拆解)

---

## 现状评估

### 四层对照

| 层 | 规范要求 | 现状 | 差距 |
|----|---------|------|------|
| L1 UT | 覆盖率 ≥ 95%（branches ≥ 90%），pre-push 门禁 | 338+ tests / 24 files，运行于 vitest，pre-commit 跑 `bun run test`，pre-push 跑 `bun run test:coverage` | ✅ 已就绪 |
| L2 Lint | ESLint strict，零错误零警告，pre-commit | ESLint 仅 Next.js 默认 config，未在 pre-commit 触发 | 非 strict；未集成 hook |
| L3 API E2E | 100% API route 有 E2E，pre-push | 36 个 route / 46 个 handler，0 个 E2E 测试，无 pre-push hook | 从零搭建 |
| L4 BDD E2E | Playwright 核心主干流程，按需 | 无 Playwright，无 BDD | 从零搭建（本期不含） |

### 问题清单

1. **历史 vitest 残留（已解决）**: 早期 3 个测试文件 import `vitest`，但项目当时用其他 runner；现已统一迁移至 vitest，所有 L1 测试统一使用 vitest API
   - `src/lib/feed-actions.test.ts`
   - `src/lib/article-actions.test.ts`
   - `src/hooks/useFeedActions.test.ts`
2. **Git hooks 不可分发**: 当前 pre-commit 写在 `.git/hooks/`（不进版本控制），其他克隆不会获得此 hook
3. **pre-commit 不完整**: 只跑 UT，不跑 Lint，不检查覆盖率
4. **pre-push 不存在**: 无法阻止带有 API 回归的代码推送
5. **Lint 宽松**: 无 `@typescript-eslint/strict`，无零警告要求
6. **36 个 API route / 46 个 handler 零 E2E**: API 协议无任何保护

---

## 目标架构

```
pre-commit (快速，< 30s)
├── L1: bun run test (vitest run, 仅变更文件相关测试)
└── L2: eslint (strict, zero-warning)

pre-push (完整，< 2min)
├── L1: bun run test:coverage (全量 + 覆盖率 ≥ 95%/90% 门禁)
└── L3: API E2E (独立 dev server @ port 13000 + mock server @ port 14000)

on-demand (后续 Phase)
└── L4: Playwright BDD E2E @ port 23000
```

### 端口约定

| 用途 | 端口 |
|------|------|
| Dev server | 3000 |
| L3 API E2E (Next.js dev server) | 13000 |
| L3 Mock server (外部依赖 mock) | 14000 |
| L4 BDD E2E (future) | 23000 |

### Hooks 管理方案

使用 **husky** 管理 git hooks，hooks 配置进入版本控制：

```
.husky/
├── pre-commit      # L1 变更UT + L2 Lint
└── pre-push        # L1 全量覆盖率 + L3 API E2E
```

安装机制：`package.json` 添加 `"prepare": "husky"` 脚本，`bun install` 后自动注册 hooks。

---

## API Route 完整清单

共 **36 个 route 文件 / 46 个 HTTP handler**，按外部依赖类型分四类。

### (D) 纯 Supabase 路由 — 26 个文件

无外部网络调用，E2E 最可控。只需本地 Supabase + auth bypass。

| # | Route | Methods | 说明 |
|---|-------|---------|------|
| 1 | `/api/health` | GET | 健康检查，返回版本号（无 DB 调用） |
| 2 | `/api/articles/[id]/read` | POST | 标记已读 |
| 3 | `/api/articles/[id]/unread` | POST | 标记未读 |
| 4 | `/api/articles/[id]/bookmark` | POST, DELETE | 收藏/取消收藏 |
| 5 | `/api/articles/[id]/read-later` | POST, DELETE | 稍后读/取消 |
| 6 | `/api/feeds` | GET | 获取所有 feeds |
| 7 | `/api/feeds/list` | GET | 获取 feeds + 缓存计数 |
| 8 | `/api/feeds/[id]` | PUT, DELETE | 更新/删除 feed |
| 9 | `/api/feeds/[id]/articles` | GET | 获取 feed 下文章 |
| 10 | `/api/feeds/[id]/logs` | GET | 获取 feed 抓取日志 |
| 11 | `/api/feeds/[id]/mark-all-read` | POST | 批量标记已读 |
| 12 | `/api/feeds/[id]/auto-translate` | PUT | 切换自动翻译 |
| 13 | `/api/feeds/starred/articles` | GET | 收藏文章列表 |
| 14 | `/api/feeds/later/articles` | GET | 稍后读列表 |
| 15 | `/api/categories` | GET, POST | 列表/创建分类 |
| 16 | `/api/categories/[id]` | PUT, DELETE | 更新/删除分类 |
| 17 | `/api/blogs` | GET | 博客发现列表 |
| 18 | `/api/logs` | GET | 最近抓取日志 |
| 19 | `/api/data/stats` | GET | 系统统计 |
| 20 | `/api/data/files` | GET | 数据库表信息 |
| 21 | `/api/data/storage` | GET | 存储用量估算 |
| 22 | `/api/data/logs` | GET | 聚合日志 |
| 23 | `/api/data/health` | GET | 数据库健康（DB ping + 内存） |
| 24 | `/api/data/feeds` | GET | Feed 详细状态 |
| 25 | `/api/data/cleanup` | GET, POST | 检查/执行日志清理 |
| 26 | `/api/data/cleanup-articles` | GET, POST | 检查/执行文章清理 |

### (A) AI API 路由 — 4 个文件

都走 `openai` npm SDK，`baseUrl` + `apiKey` 由请求体传入（非硬编码 OpenAI）。E2E 需要 mock OpenAI server。

| # | Route | Methods | 说明 |
|---|-------|---------|------|
| 27 | `/api/ai/summarize` | POST | AI 摘要（chat.completions.create） |
| 28 | `/api/ai/translate` | POST | AI 批量翻译标题/描述 |
| 29 | `/api/ai/translate-content` | POST | AI 全文翻译 |
| 30 | `/api/ai/validate` | POST | AI 连接校验（models.list） |

### (B) 外部 URL 抓取路由 — 5 个文件

fetch 外部 RSS/图片/网页。E2E 需要 mock HTTP server 提供假数据。

| # | Route | Methods | 说明 |
|---|-------|---------|------|
| 31 | `/api/rss` | GET | RSS 代理（rss-parser 解析外部 URL） |
| 32 | `/api/image-proxy` | GET, POST | 图片代理（fetch 外部图片 URL） |
| 33 | `/api/articles/[id]/fetch-full` | POST | 全文抓取（fetch + cheerio 解析） |
| 34 | `/api/feeds` | POST | 创建 feed（验证 RSS URL 有效性） |
| 35 | `/api/feeds/[id]/fetch` | POST | 触发 feed 抓取（FeedFetcher） |

> 注：`/api/feeds` 的 GET 在 (D) 类，POST 在 (B) 类。

### (C) SSE 流式路由 — 1 个文件

长连接轮询 Supabase，需特殊超时策略。

| # | Route | Methods | 说明 |
|---|-------|---------|------|
| 36 | `/api/logs/stream` | GET | SSE 日志流（3s 轮询 Supabase，15s keepalive） |

### (X) 诊断路由 — 跳过

| Route | 原因 |
|-------|------|
| `/api/test-proxy` | 代理连通性测试，会 `setGlobalDispatcher` 修改全局状态，E2E 无法提供真代理。标记 `@skip`。 |

---

## 测试环境契约

### 认证绕过 — 三层变量全集

项目的 auth bypass 分三层运作，**L3 API E2E 只需 Layer 1 + 2**（纯 HTTP 调用不经过浏览器），L4 BDD 阶段才需要 Layer 3。

#### Layer 1: Middleware (`middleware.ts:29`)

阻止未认证请求被重定向到 `/login`。

```
DEV_MODE_ENABLED=true     # + NODE_ENV=development (next dev 自动设置)
```

#### Layer 2: Server API routes (`src/lib/supabase-server.ts`)

构造 service-key Supabase client（绕 RLS）+ 注入合成用户。

```
DEV_MODE_ENABLED=true
DEV_USER_ID=<supabase-user-uuid>
DEV_USER_EMAIL=<email>
SUPABASE_SERVICE_KEY=<service-role-key>
```

#### Layer 3: Client React context (`src/contexts/AuthContext.tsx`) — L4 阶段才需要

为浏览器端 `useAuth()` 提供假用户。

```
NEXT_PUBLIC_DEV_MODE_ENABLED=true
NEXT_PUBLIC_DEV_USER_ID=<same-uuid>
NEXT_PUBLIC_DEV_USER_EMAIL=<same-email>
```

#### 基础设施变量（所有层都需要）

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-supabase-anon-key>
```

### .env.test 文件与加载机制

两层文件，`dotenv-cli` 按顺序加载（后者覆盖前者）：

| 文件 | 版本控制 | 内容 |
|------|---------|------|
| `.env.test` | 进 git | 默认值（含完整 key 和非敏感默认值，如 `DEV_MODE_ENABLED=true`、`MOCK_SERVER_URL`） |
| `.env.test.local` | 不进 git（`.gitignore`） | 仅覆盖敏感项（`DEV_USER_ID`, `SUPABASE_SERVICE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`） |

**加载方式**：E2E runner 脚本使用 `dotenv-cli` 同时加载两层：

```bash
# scripts/run-api-e2e.sh — 先加载模板默认值，再用本地文件覆盖敏感项
bunx dotenv-cli -e .env.test -e .env.test.local -- next dev --port 13000
```

`dotenv-cli` 多 `-e` 参数时后面的文件优先，所以 `.env.test.local` 中的值会覆盖 `.env.test` 中的同名 key。开发者只需在 `.env.test.local` 中填写 3 个敏感值即可，其余全部由 `.env.test` 提供默认值。

### .env.test 模板（进版本控制，含默认值）

```bash
# === L3 API E2E Test Environment ===
# Non-sensitive defaults. Secrets are overridden by .env.test.local.

# Auth bypass (Layer 1 + 2)
DEV_MODE_ENABLED=true
DEV_USER_ID=00000000-0000-0000-0000-000000000000
DEV_USER_EMAIL=test@geekhub.local

# Supabase (local instance — keys must be overridden in .env.test.local)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-override-in-env-test-local
SUPABASE_SERVICE_KEY=placeholder-override-in-env-test-local

# Mock server
MOCK_SERVER_URL=http://127.0.0.1:14000
```

### .env.test.local 模板（不进版本控制，仅敏感值）

```bash
# === Local overrides — DO NOT commit ===
# Get these values from `supabase status` after starting local Supabase

DEV_USER_ID=                         # Your actual local Supabase user UUID
NEXT_PUBLIC_SUPABASE_ANON_KEY=       # From `supabase status`
SUPABASE_SERVICE_KEY=                # From `supabase status`
```

---

## 外部依赖 Mock 策略

### 设计原则

- **不跑真实外网请求**：所有 AI 和外部 URL 路由的 E2E 通过 mock server 验证
- **Mock server 用 Bun.serve**：轻量、零依赖、启停由 runner 脚本管理
- **固定响应**：mock 返回预定义的 JSON/XML/HTML，确保 E2E 确定性

### Mock Server 架构 (`tests/e2e/mock-server.ts`)

```
Bun.serve @ port 14000
├── /v1/chat/completions   → 假 OpenAI chat response (JSON)
├── /v1/models             → 假 model list (JSON)
├── /mock-rss              → 假 RSS feed (XML)
├── /mock-image.jpg        → 假图片 (1x1 pixel JPEG)
├── /mock-article          → 假文章页面 (HTML with <article> tag)
└── /mock-httpbin          → 假 httpbin/ip response (JSON)
```

### 各类路由的 Mock 映射

| 路由类型 | Mock 策略 | E2E 请求体如何指向 mock |
|---------|----------|----------------------|
| **(A) AI** | E2E 请求体中 `aiSettings.baseUrl` 设为 `http://127.0.0.1:14000/v1` | 请求体参数（无需环境变量） |
| **(B) RSS/fetch** | `feeds POST` 的 RSS URL 参数设为 `http://127.0.0.1:14000/mock-rss` | 请求体参数 |
| **(B) image-proxy** | 图片 URL 参数设为 `http://127.0.0.1:14000/mock-image.jpg` | 请求体参数 |
| **(B) fetch-full** | 文章 URL 参数设为 `http://127.0.0.1:14000/mock-article` | 请求体参数 |
| **(B) feeds/[id]/fetch** | 需要 DB 中 feed 的 URL 指向 mock RSS（在 setup 阶段写入） | 数据库 seed |
| **(C) SSE** | 无需 mock（只读 Supabase），用超时策略测试 | N/A |
| **(X) test-proxy** | 标记 `@skip` | N/A |

### SSE 路由测试策略 (`/api/logs/stream`)

```typescript
// 连接 → 断言 system 事件 → 断言 init 事件 → 主动关闭
// 超时 5s，超时即 fail
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5000);

const response = await fetch(`${BASE_URL}/api/logs/stream`, {
  signal: controller.signal,
});
const reader = response.body!.getReader();
const decoder = new TextDecoder();
const events: string[] = [];

// Read until we get system + init events, then close
while (events.length < 2) {
  const { value, done } = await reader.read();
  if (done) break;
  const text = decoder.decode(value);
  // Parse SSE event names from text...
  events.push(...parsedEventNames);
}

clearTimeout(timeout);
reader.cancel();

expect(events).toContain('system');
expect(events).toContain('init');
```

---

## Phase 1: 加固 L1 + L2

### Step 1.1 — 修复 vitest 残留

将 3 个文件从直接使用 `vitest` 的过渡形态统一到当前项目的 vitest 配置（`vitest.config.ts` + setup）：

| 旧 import | 新 import |
|-----------|----------|
| 散乱的 `import { vi } from 'vitest'` | 统一遵循 vitest API（`vi.fn`, `vi.spyOn`, `vi.mock`） |
| 自定义 mock helpers | 直接使用 vitest 内置 |

验证：`bun run test` 全部通过。

### Step 1.2 — 添加覆盖率门禁脚本

创建 `scripts/check-coverage.sh`：
1. 运行 `bun run test:coverage`（vitest v8 provider 自带阈值检查）
2. vitest 通过 `coverage.thresholds` 拦截不达标的提交
3. 任意指标低于阈值 → 进程 exit 1

> 此脚本在 **pre-push** 阶段调用，不在 pre-commit（保持 pre-commit < 30s）。

### Step 1.3 — 强化 ESLint 配置

升级 `eslint.config.mjs`：
1. 安装 `@typescript-eslint/eslint-plugin` + `@typescript-eslint/parser`（如未安装）
2. 启用 `strict` 规则集
3. 设置 `max-warnings: 0`（零警告策略）

验证：`eslint --max-warnings 0 .` 通过。

### Step 1.4 — 配置 husky + git hooks

1. 安装 `husky` 为 devDependency
2. 添加 `"prepare": "husky"` 到 `package.json` scripts
3. 创建 `.husky/pre-commit`：

```bash
bun run lint
bun run test
```

> pre-commit 仅跑变更相关 UT + lint，不跑覆盖率。保持 < 30s。

4. 创建 `.husky/pre-push`：

```bash
scripts/check-coverage.sh
```

5. 删除旧的 `.git/hooks/pre-commit`（被 husky 替代）

### Step 1.5 — 更新 package.json scripts

```json
{
  "prepare": "husky",
  "test": "vitest run",
  "test:coverage": "vitest run --coverage",
  "test:e2e": "scripts/run-api-e2e.sh",
  "lint": "eslint --max-warnings 0 ."
}
```

---

## Phase 2: 搭建 L3 API E2E

### Step 2.1 — E2E 基础设施

创建目录结构：

```
tests/
└── e2e/
    ├── mock-server.ts     # Bun.serve mock (port 14000)，可独立运行也可被 import
    ├── setup.ts           # E2E 环境初始化 (常量、preload 配置，不启动 server)
    ├── helpers.ts         # 公共工具 (fetch wrapper, auth helper, SSE reader)
    ├── fixtures/          # 固定测试数据
    │   ├── rss-feed.xml   # 假 RSS feed
    │   ├── article.html   # 假文章页面
    │   └── openai.json    # 假 OpenAI 响应
    ├── health.test.ts
    ├── feeds.test.ts
    ├── categories.test.ts
    ├── articles.test.ts
    ├── ai.test.ts
    ├── data.test.ts
    ├── logs.test.ts       # 含 SSE stream 测试
    ├── rss.test.ts
    ├── image-proxy.test.ts
    └── blogs.test.ts
```

创建 `scripts/run-api-e2e.sh`：
1. 启动 mock server（`bun ./tests/e2e/mock-server.ts &`，port 14000，**唯一启动点**）
2. 启动 Next.js dev server（`bunx dotenv-cli -e .env.test -e .env.test.local -- next dev --port 13000`）
3. 等待 server ready（轮询 `/api/health`，超时 30s）
4. 运行 `vitest run tests/e2e/`（L3 E2E 与 L1 同样使用 vitest）
5. 关闭 mock server + dev server，汇报结果

> **Mock server 职责归属**：runner 脚本是 mock server 的唯一启动者。`setup.ts` 仅负责常量定义（BASE_URL、MOCK_URL 等）和 preload 配置，**不**启动 mock server。测试文件通过 `setup.ts` 导出的常量访问 mock server。

创建 `.env.test`（模板，进版本控制）和在 `.gitignore` 中添加 `.env.test.local`。

### Step 2.2 — Mock Server 实现

实现 `tests/e2e/mock-server.ts`，提供所有外部依赖的假响应（见 [Mock 策略](#外部依赖-mock-策略)）。

### Step 2.3 — E2E 测试编写（按优先级）

**P0 — 纯 Supabase 核心 CRUD**

| Route | Methods | 测试要点 |
|-------|---------|---------|
| `/api/health` | GET | 200 + version 字段 |
| `/api/feeds` | GET | 列表返回 |
| `/api/feeds/list` | GET | 列表 + 缓存计数 |
| `/api/feeds/[id]` | PUT, DELETE | 更新/删除 |
| `/api/feeds/[id]/articles` | GET | 文章列表 |
| `/api/feeds/[id]/logs` | GET | 日志列表 |
| `/api/feeds/[id]/mark-all-read` | POST | 批量标记 |
| `/api/feeds/[id]/auto-translate` | PUT | 切换翻译 |
| `/api/feeds/starred/articles` | GET | 收藏列表 |
| `/api/feeds/later/articles` | GET | 稍后读列表 |
| `/api/categories` | GET, POST | 列表、创建 |
| `/api/categories/[id]` | PUT, DELETE | 更新、删除 |
| `/api/articles/[id]/read` | POST | 标记已读 |
| `/api/articles/[id]/unread` | POST | 标记未读 |
| `/api/articles/[id]/bookmark` | POST, DELETE | 收藏 |
| `/api/articles/[id]/read-later` | POST, DELETE | 稍后读 |

**P1 — AI + 外部依赖路由（需 mock server）**

| Route | Methods | 测试要点 | Mock |
|-------|---------|---------|------|
| `/api/ai/summarize` | POST | 摘要调用成功 | mock OpenAI completions |
| `/api/ai/translate` | POST | 翻译调用成功 | mock OpenAI completions |
| `/api/ai/translate-content` | POST | 全文翻译成功 | mock OpenAI completions |
| `/api/ai/validate` | POST | 连接校验成功 | mock OpenAI models.list |
| `/api/feeds` | POST | 创建 feed（URL 校验） | mock RSS feed |
| `/api/feeds/[id]/fetch` | POST | 触发抓取 | mock RSS feed (DB seed) |
| `/api/rss` | GET | RSS 代理 | mock RSS feed |
| `/api/image-proxy` | GET, POST | 图片代理 | mock 图片 |
| `/api/articles/[id]/fetch-full` | POST | 全文抓取 | mock HTML 页面 |

**P2 — 辅助路由**

| Route | Methods | 测试要点 |
|-------|---------|---------|
| `/api/blogs` | GET | 博客列表 |
| `/api/logs` | GET | 日志查询 |
| `/api/logs/stream` | GET | SSE 事件接收（超时 5s，断言 system+init） |
| `/api/data/stats` | GET | 统计数据 |
| `/api/data/health` | GET | DB ping |
| `/api/data/files` | GET | 表信息 |
| `/api/data/storage` | GET | 存储用量 |
| `/api/data/logs` | GET | 聚合日志 |
| `/api/data/feeds` | GET | Feed 状态 |
| `/api/data/cleanup` | GET, POST | 日志清理 |
| `/api/data/cleanup-articles` | GET, POST | 文章清理 |

**跳过**

| Route | 原因 |
|-------|------|
| `/api/test-proxy` | 诊断路由，`setGlobalDispatcher` 修改全局状态，无法在 E2E 中安全测试 |

### Step 2.4 — 更新 pre-push hook

在 `.husky/pre-push` 中追加 API E2E：

```bash
scripts/check-coverage.sh
scripts/run-api-e2e.sh
```

### Step 2.5 — 更新文档

更新 `docs/04-testing.md` 反映四层架构实际状态。

---

## Commit 拆解

以下为原子化 commit 序列，每个 commit 独立可构建、可测试。

### Phase 1 commits (L1 + L2 加固)

| # | Commit message | 内容 | 验证 |
|---|---------------|------|------|
| 1 | ✅ `fix(test): unify 3 test files under vitest` | 修复 feed-actions, article-actions, useFeedActions 的 import 和 mock API | `vitest run` 全通过 |
| 2 | ✅ `chore: add coverage check script` | 创建 `scripts/check-coverage.sh` | 脚本可执行，覆盖率输出正确 |
| 3 | ✅ `chore: strengthen eslint config with strict rules` | 升级 `eslint.config.mjs`，安装所需依赖 | `eslint --max-warnings 0 .` 通过 |
| 4 | ✅ `chore: setup husky and configure git hooks` | 安装 husky，创建 `.husky/pre-commit`（lint + UT）和 `.husky/pre-push`（覆盖率门禁），删除旧 `.git/hooks/pre-commit` | `git commit` 触发 lint + UT；`git push` 触发覆盖率检查 |
| 5 | ✅ `chore: add test and lint scripts to package.json` | 添加 `prepare`, `test:coverage`, `test:e2e`, `lint` scripts | scripts 可执行 |

### Phase 2 commits (L3 API E2E)

| # | Commit message | 内容 | 验证 |
|---|---------------|------|------|
| 6 | ✅ `test(e2e): add mock server and E2E infrastructure` | 创建 `tests/e2e/mock-server.ts`, `setup.ts`, `helpers.ts`, `fixtures/`, `.env.test`, `scripts/run-api-e2e.sh` | mock server 启动返回假响应；runner 脚本能启/停 server |
| 7 | ✅ `test(e2e): add health and feeds CRUD E2E tests` | `health.test.ts` + `feeds.test.ts`（P0 纯 Supabase 部分） | E2E 通过 |
| 8 | ✅ `test(e2e): add categories and articles E2E tests` | `categories.test.ts` + `articles.test.ts` | E2E 通过 |
| 9 | ✅ `test(e2e): add AI route E2E tests with mock OpenAI` | `ai.test.ts`（4 条 AI 路由，请求体 baseUrl 指向 mock） | E2E 通过 |
| 10 | ✅ `test(e2e): add external URL route E2E tests with mock` | `rss.test.ts` + `image-proxy.test.ts` + feeds POST/fetch（请求参数指向 mock） | E2E 通过 |
| 11 | ✅ `test(e2e): add data, logs, blogs E2E tests` | `data.test.ts` + `logs.test.ts`（含 SSE 超时断言）+ `blogs.test.ts` | E2E 通过 |
| 12 | ✅ `chore: add API E2E to pre-push hook` | `.husky/pre-push` 追加 `scripts/run-api-e2e.sh` | push 时自动跑 E2E |
| 13 | ✅ `docs: update testing docs to reflect 4-layer architecture` | 更新 `docs/04-testing.md`，更新 `docs/08-test-improvement-plan.md` 标记已完成 | 文档准确反映现状 |

---

## 覆盖率验证矩阵

执行完毕后，所有可测 handler 应有对应 E2E：

| 类型 | Route 文件数 | Handler 数 | E2E 覆盖 |
|------|-------------|-----------|----------|
| (D) 纯 Supabase | 26 | 34 | 34 |
| (A) AI API | 4 | 4 | 4 |
| (B) 外部 URL | 5 | 6 | 6 |
| (C) SSE | 1 | 1 | 1 |
| (X) 跳过 | 1 | 1 | 0 (@skip) |
| **合计** | **36***| **46** | **45 covered, 1 skipped** |

> *Route 文件数合计为 36（非 37），因为 `/api/feeds/route.ts` 同时出现在 (D) 和 (B) 中（GET 在 D，POST 在 B），但只是一个文件。

---

## 相关文档

- [测试规范](04-testing.md) — 四层测试架构文档
- [API 参考](05-api-reference.md) — 36 个 route 的完整文档
- [开发指南](03-development.md) — 开发环境搭建

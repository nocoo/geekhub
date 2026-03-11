# 测试规范

> 返回 [README](../README.md) | 参考 [测试改进计划](08-test-improvement-plan.md)

本文档介绍 GeekHub 的四层测试架构、规范和最佳实践。

---

## 目录

- [四层测试架构](#四层测试架构)
- [端口约定](#端口约定)
- [Git Hooks 自动化](#git-hooks-自动化)
- [L1 单元测试](#l1-单元测试)
- [L2 Lint 检查](#l2-lint-检查)
- [L3 API E2E 测试](#l3-api-e2e-测试)
- [L4 BDD E2E 测试](#l4-bdd-e2e-测试)
- [测试最佳实践](#测试最佳实践)

---

## 四层测试架构

```
pre-commit (快速，< 30s)
├── L1 UT     bun test                    332+ tests
└── L2 Lint   eslint --max-warnings 0     zero errors, zero warnings

pre-push (完整，2-3 min)
├── L1 UT + 覆盖率   scripts/check-coverage.sh   ≥ 90% 行覆盖率
└── L3 API E2E       scripts/run-api-e2e.sh       45 handlers covered

on-demand (按需)
└── L4 BDD E2E       Playwright (future)
```

| 层 | 目标 | 工具 | 触发时机 |
|----|------|------|---------|
| L1 UT | 业务逻辑 90%+ 覆盖 | bun:test | pre-commit, pre-push |
| L2 Lint | 代码质量零瑕疵 | ESLint strict | pre-commit |
| L3 API E2E | 100% API route 覆盖 | bun:test + Next.js dev server | pre-push |
| L4 BDD E2E | 核心用户流程 | Playwright (future) | 按需 |

---

## 端口约定

| 用途 | 端口 |
|------|------|
| Dev server | 3000 |
| L3 API E2E (Next.js dev server) | 13000 |
| L3 Mock server (外部依赖 mock) | 14000 |
| L4 BDD E2E (future) | 23000 |

---

## Git Hooks 自动化

使用 **husky** 管理，hooks 进入版本控制（`.husky/` 目录）。

```
.husky/
├── pre-commit      # L1 UT + L2 Lint
└── pre-push        # L1 覆盖率门禁 + L3 API E2E
```

安装机制：`package.json` 中 `"prepare": "husky"`，`bun install` 后自动注册。

---

## L1 单元测试

### 框架：bun:test

GeekHub 使用 Bun 内置测试框架，配置在 `bunfig.toml`：

```toml
[test]
preload = ["./src/test/setup.ts"]
root = "./src"
```

### 运行命令

```bash
bun test                    # 运行所有 L1 单元测试
bun test src/lib/rss.test.ts  # 运行单个文件
bun test --filter "RSS"     # 过滤匹配
bun test --watch            # 监听模式
bun test --coverage         # 查看覆盖率
```

### package.json scripts

```bash
bun run test              # bun test
bun run test:coverage     # scripts/check-coverage.sh (90% 门禁)
bun run lint              # eslint --max-warnings 0 .
bun run test:e2e          # scripts/run-api-e2e.sh
```

### 覆盖率要求

| 指标 | 目标 |
|------|------|
| 行覆盖率 | ≥ 90% |

覆盖率门禁脚本 `scripts/check-coverage.sh` 在 pre-push 阶段执行。

### 当前 L1 测试覆盖

| 模块 | 测试文件 | 测试数 |
|------|----------|--------|
| 业务逻辑 | `src/lib/*.test.ts` | 10 个文件 |
| Hooks | `src/hooks/*.test.ts` | 4 个文件 |
| Context | `src/contexts/*.test.tsx` | 2 个文件 |
| 组件 | `src/components/*.test.tsx` | 1 个文件 |
| **合计** | **24 个文件** | **332+ tests** |

### Mock 规范（bun:test）

```typescript
import { mock, spyOn } from 'bun:test'

// 创建 mock 函数
const mockFn = mock(() => 'mocked value')

// spy 现有函数
const spy = spyOn(object, 'method')

// mock 模块
mock.module('module-name', () => ({
  default: mock(() => 'mocked'),
}))
```

> **注意**：不使用 vitest API（`vi.fn()`, `vi.mock()` 等）。所有测试统一使用 `bun:test` API。

---

## L2 Lint 检查

### ESLint 配置

`eslint.config.mjs` 启用 strict 规则：

- `@typescript-eslint/no-explicit-any`: error
- `@typescript-eslint/no-unused-vars`: error（允许 `_` 前缀）
- `@typescript-eslint/ban-ts-comment`: error
- `@typescript-eslint/no-require-imports`: error
- `prefer-const`: error
- 零警告策略：`--max-warnings 0`

```bash
bun run lint    # eslint --max-warnings 0 .
```

---

## L3 API E2E 测试

### 架构

```
tests/
└── e2e/
    ├── mock-server.ts     # Bun.serve mock (port 14000)
    ├── setup.ts           # 常量 (BASE_URL, MOCK_URL, MOCK_AI_SETTINGS)
    ├── helpers.ts         # 工具 (api, apiGet, apiPost, apiPut, apiDelete, readSSEEvents)
    ├── fixtures/
    │   ├── rss-feed.xml
    │   ├── article.html
    │   └── openai.json
    ├── health.test.ts
    ├── feeds.test.ts
    ├── categories.test.ts
    ├── articles.test.ts
    ├── ai.test.ts
    ├── rss.test.ts
    ├── image-proxy.test.ts
    ├── data.test.ts
    ├── logs.test.ts
    └── blogs.test.ts
```

### 运行方式

```bash
bun run test:e2e    # 或直接 bash scripts/run-api-e2e.sh
```

Runner 脚本 `scripts/run-api-e2e.sh` 负责：
1. 启动 mock server（port 14000）
2. 启动 Next.js dev server（port 13000，加载 `.env.test` + `.env.test.local`）
3. 等待 server ready（轮询 `/api/health`，30s 超时）
4. 运行 `bun test tests/e2e/`
5. 清理：关闭所有 server

### 环境配置

两层 env 文件：

| 文件 | 版本控制 | 内容 |
|------|---------|------|
| `.env.test` | 进 git | 默认值（`DEV_MODE_ENABLED=true`、`MOCK_SERVER_URL` 等） |
| `.env.test.local` | 不进 git | 仅覆盖敏感项（`DEV_USER_ID`、`SUPABASE_SERVICE_KEY` 等） |

### Auth Bypass

E2E 测试使用 dev mode 绕过认证：
- Layer 1 (middleware)：`DEV_MODE_ENABLED=true` 跳过登录重定向
- Layer 2 (server API)：`DEV_MODE_ENABLED + DEV_USER_ID + SUPABASE_SERVICE_KEY` 创建 service-role client

### Mock Server

`tests/e2e/mock-server.ts` 使用 `Bun.serve` 提供外部依赖的假响应：

| 路径 | 响应 |
|------|------|
| `/v1/chat/completions` | 假 OpenAI chat response |
| `/v1/models` | 假 model list |
| `/mock-rss` | 假 RSS feed (XML) |
| `/mock-image.jpg` | 1x1 JPEG |
| `/mock-article` | 假文章页面 (HTML) |
| `/mock-httpbin` | 假 httpbin/ip response |

### API 覆盖矩阵

| 类型 | Route 文件数 | Handler 数 | E2E 覆盖 |
|------|-------------|-----------|----------|
| (D) 纯 Supabase | 26 | 34 | 34 |
| (A) AI API | 4 | 4 | 4 |
| (B) 外部 URL | 5 | 6 | 6 |
| (C) SSE | 1 | 1 | 1 |
| (X) 跳过 | 1 | 1 | 0 (@skip) |
| **合计** | **36** | **46** | **45 covered, 1 skipped** |

---

## L4 BDD E2E 测试

> **状态**：未实施（本期不含）

计划使用 Playwright 覆盖核心用户主干流程，port 23000。

---

## 测试最佳实践

### 1. 测试行为，而非实现

```typescript
// ✅ 好：测试行为
test('should mark article as read', async () => {
  await markAsRead(articleId)
  const article = await getArticle(articleId)
  expect(article.isRead).toBe(true)
})

// ❌ 差：测试实现细节
test('should call updateArticle with isRead=true', async () => {
  await markAsRead(articleId)
  expect(updateArticle).toHaveBeenCalledWith({ isRead: true })
})
```

### 2. 有意义的测试名称

```typescript
// ✅ 好
test('should return empty array when no articles match the filter', () => {})

// ❌ 差
test('filter works', () => {})
```

### 3. 边界条件 + 错误场景

```typescript
describe('pagination', () => {
  test('should handle empty result', () => {})
  test('should handle last page', () => {})
})

describe('error handling', () => {
  test('should throw on network error', async () => {})
  test('should throw on invalid RSS format', async () => {})
})
```

### 4. 文件命名

- L1 单元测试：`{source}.test.ts` 或 `{source}.test.tsx`，与源文件同目录
- L3 E2E 测试：`tests/e2e/{route-group}.test.ts`

---

## 相关文档

- [测试改进计划](08-test-improvement-plan.md) — 四层架构完整改进计划
- [开发指南](03-development.md) — 开发环境搭建
- [架构设计](01-architecture.md) — 系统架构
- [API 参考](05-api-reference.md) — 36 个 API route 文档

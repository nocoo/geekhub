# 测试改进计划

> 返回 [README](../README.md) | 参考 [测试规范](04-testing.md)

本文档记录 GeekHub 从当前测试状态到四层测试架构的改进计划。

---

## 目录

- [现状评估](#现状评估)
- [目标架构](#目标架构)
- [Phase 1: 加固 L1 + L2](#phase-1-加固-l1--l2)
- [Phase 2: 搭建 L3 API E2E](#phase-2-搭建-l3-api-e2e)
- [Commit 拆解](#commit-拆解)

---

## 现状评估

### 四层对照

| 层 | 规范要求 | 现状 | 差距 |
|----|---------|------|------|
| L1 UT | 覆盖率 ≥ 90%，pre-commit 门禁 | 332 tests / 24 files，pre-commit 仅跑 `bun test`，无覆盖率门禁 | 无覆盖率阈值拦截；3 个文件误用 vitest API |
| L2 Lint | ESLint strict，零错误零警告，pre-commit | ESLint 仅 Next.js 默认 config，未在 pre-commit 触发 | 非 strict；未集成 hook |
| L3 API E2E | 100% API route 有 E2E，pre-push | 36 个 route，0 个 E2E 测试，无 pre-push hook | 从零搭建 |
| L4 BDD E2E | Playwright 核心主干流程，按需 | 无 Playwright，无 BDD | 从零搭建（本期不含） |

### 问题清单

1. **vitest 残留**: 3 个测试文件 import `vitest`，但项目用 `bun:test`
   - `src/lib/feed-actions.test.ts`
   - `src/lib/article-actions.test.ts`
   - `src/hooks/useFeedActions.test.ts`
2. **pre-commit 不完整**: 只跑 UT，不跑 Lint，不检查覆盖率
3. **pre-push 不存在**: 无法阻止带有 API 回归的代码推送
4. **Lint 宽松**: 无 `@typescript-eslint/strict`，无零警告要求
5. **36 个 API route 零 E2E**: API 协议无任何保护

---

## 目标架构

```
pre-commit (快速，< 30s)
├── L1: bun test + 覆盖率 ≥ 90% 门禁
└── L2: eslint (strict, zero-warning)

pre-push (完整，< 2min)
└── L3: API E2E (独立 dev server @ port 13000)

on-demand (后续 Phase)
└── L4: Playwright BDD E2E @ port 23000
```

### 端口约定

| 用途 | 端口 |
|------|------|
| Dev server | 3000 |
| L3 API E2E | 13000 |
| L4 BDD E2E | 23000 (future) |

### 认证绕过

E2E 测试通过 `DEV_MODE_ENABLED=true` + `DEV_USER_ID` 环境变量绕开 Supabase 认证（项目已有此机制）。

---

## Phase 1: 加固 L1 + L2

### Step 1.1 — 修复 vitest 残留

将 3 个文件从 `vitest` API 迁移到 `bun:test` API：

| vitest | bun:test |
|--------|----------|
| `import { vi } from 'vitest'` | `import { mock, spyOn } from 'bun:test'` |
| `vi.fn()` | `mock()` |
| `vi.spyOn()` | `spyOn()` |
| `vi.mocked()` | 直接类型断言 |
| `vi.clearAllMocks()` | `mock.restore()` / 手动 reset |

验证：`bun test` 全部通过。

### Step 1.2 — 添加覆盖率门禁脚本

创建 `scripts/check-coverage.sh`：
1. 运行 `bun test --coverage --coverage-reporter=lcov`
2. 解析 lcov 报告，计算行覆盖率
3. 低于 90% 则 exit 1

### Step 1.3 — 强化 ESLint 配置

升级 `eslint.config.mjs`：
1. 安装 `@typescript-eslint/eslint-plugin` + `@typescript-eslint/parser`（如未安装）
2. 启用 `strict` 规则集
3. 设置 `max-warnings: 0`（零警告策略）

验证：`eslint --max-warnings 0 .` 通过。

### Step 1.4 — 重写 pre-commit hook

```bash
#!/bin/bash
# L2: Lint (zero-warning)
eslint --max-warnings 0 .

# L1: UT + 覆盖率门禁
scripts/check-coverage.sh
```

### Step 1.5 — 更新 package.json scripts

```json
{
  "test": "bun test",
  "test:coverage": "bun test --coverage",
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
    ├── setup.ts          # E2E 环境初始化
    ├── helpers.ts         # 公共工具 (fetch wrapper, auth helper)
    ├── health.test.ts     # /api/health
    ├── feeds.test.ts      # /api/feeds/*
    ├── categories.test.ts # /api/categories/*
    ├── articles.test.ts   # /api/articles/*
    ├── ai.test.ts         # /api/ai/*
    ├── data.test.ts       # /api/data/*
    └── misc.test.ts       # /api/logs, /api/rss, /api/blogs, /api/image-proxy
```

创建 `scripts/run-api-e2e.sh`：
1. 检查端口 13000 占用，清理
2. 设置 E2E 环境变量（`DEV_MODE_ENABLED=true` 等）
3. 启动独立 Next.js dev server (`next dev --port 13000`)
4. 等待 server ready（轮询 /api/health）
5. 运行 `bun test tests/e2e/`
6. 关闭 server，汇报结果

创建 `.env.test`：E2E 专用环境变量（连本地 Supabase）。

### Step 2.2 — E2E 测试编写（按优先级）

**P0 — 核心 CRUD（先做）**

| Route | Methods | 测试要点 |
|-------|---------|---------|
| `/api/health` | GET | 200 + version 字段 |
| `/api/feeds` | GET, POST | 列表、创建、参数校验 |
| `/api/feeds/[id]` | GET, PUT, DELETE | 单个 CRUD |
| `/api/feeds/[id]/articles` | GET | 文章列表 |
| `/api/feeds/[id]/fetch` | POST | 触发抓取 |
| `/api/feeds/[id]/mark-all-read` | POST | 批量标记 |
| `/api/categories` | GET, POST | 列表、创建 |
| `/api/categories/[id]` | PUT, DELETE | 更新、删除 |
| `/api/articles/[id]/read` | POST | 标记已读 |
| `/api/articles/[id]/bookmark` | POST | 收藏 |
| `/api/articles/[id]/read-later` | POST | 稍后阅读 |

**P1 — 辅助功能**

| Route | Methods | 测试要点 |
|-------|---------|---------|
| `/api/ai/summarize` | POST | 摘要（可 mock AI） |
| `/api/ai/translate` | POST | 翻译（可 mock AI） |
| `/api/ai/validate` | POST | 配置校验 |
| `/api/data/stats` | GET | 统计数据 |
| `/api/data/health` | GET | 数据库健康 |
| `/api/feeds/starred/articles` | GET | 收藏列表 |
| `/api/feeds/later/articles` | GET | 稍后阅读列表 |

**P2 — 其余**

| Route | Methods | 测试要点 |
|-------|---------|---------|
| `/api/rss` | GET | RSS 代理 |
| `/api/blogs` | GET | 博客列表 |
| `/api/image-proxy` | GET | 图片代理 |
| `/api/logs` | GET | 日志查询 |
| `/api/data/*` | 其余 | 文件/存储/清理 |

### Step 2.3 — 创建 pre-push hook

```bash
#!/bin/bash
# L3: API E2E
scripts/run-api-e2e.sh
```

### Step 2.4 — 更新文档

更新 `docs/04-testing.md` 反映四层架构实际状态。

---

## Commit 拆解

以下为原子化 commit 序列，每个 commit 独立可构建、可测试。

### Phase 1 commits

| # | Commit message | 内容 | 验证 |
|---|---------------|------|------|
| 1 | `fix(test): migrate 3 test files from vitest to bun:test` | 修复 feed-actions, article-actions, useFeedActions 的 import 和 mock API | `bun test` 全通过 |
| 2 | `chore: add coverage check script` | 创建 `scripts/check-coverage.sh` | 脚本可执行，覆盖率输出正确 |
| 3 | `chore: strengthen eslint config with strict rules` | 升级 `eslint.config.mjs`，安装所需依赖 | `eslint --max-warnings 0 .` 通过 |
| 4 | `chore: rewrite pre-commit hook with lint and coverage gate` | 重写 `.git/hooks/pre-commit` | 提交时自动跑 Lint + UT + 覆盖率 |
| 5 | `chore: add test and lint scripts to package.json` | 添加 `test:coverage`, `test:e2e` scripts；更新 `lint` 加 `--max-warnings 0` | scripts 可执行 |

### Phase 2 commits

| # | Commit message | 内容 | 验证 |
|---|---------------|------|------|
| 6 | `test(e2e): add API E2E infrastructure and runner script` | 创建 `tests/e2e/` 目录、setup.ts、helpers.ts、`.env.test`、`scripts/run-api-e2e.sh` | runner 脚本能启动/关闭 server |
| 7 | `test(e2e): add health and feeds API E2E tests` | health.test.ts + feeds.test.ts | `bun test tests/e2e/health.test.ts` 通过 |
| 8 | `test(e2e): add categories and articles API E2E tests` | categories.test.ts + articles.test.ts | E2E 通过 |
| 9 | `test(e2e): add AI and data API E2E tests` | ai.test.ts + data.test.ts | E2E 通过 |
| 10 | `test(e2e): add misc API E2E tests` | misc.test.ts (logs, rss, blogs, image-proxy) | E2E 通过 |
| 11 | `chore: add pre-push hook for API E2E` | 创建 `.git/hooks/pre-push` | push 时自动跑 E2E |
| 12 | `docs: update testing docs to reflect 4-layer architecture` | 更新 04-testing.md | 文档准确反映现状 |

---

## 相关文档

- [测试规范](04-testing.md) — 当前测试文档（将在 commit #12 更新）
- [API 参考](05-api-reference.md) — 36 个 route 的完整文档
- [开发指南](03-development.md) — 开发环境搭建

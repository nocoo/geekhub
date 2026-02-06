# 测试规范

> 返回 [README](../README.md)

本文档介绍 GeekHub 的测试策略、规范和最佳实践。

---

## 目录

- [测试概览](#测试概览)
- [覆盖率要求](#覆盖率要求)
- [测试框架](#测试框架)
- [编写测试](#编写测试)
- [运行测试](#运行测试)
- [测试最佳实践](#测试最佳实践)

---

## 测试概览

### 测试金字塔

```
        ┌─────────────┐
        │   E2E 测试   │  少量关键路径
        ├─────────────┤
        │  集成测试    │  API 路由、数据库交互
        ├─────────────┤
        │  单元测试    │  业务逻辑、工具函数
        └─────────────┘
```

### 当前测试覆盖

| 模块 | 测试文件 | 覆盖内容 |
|------|----------|----------|
| 业务逻辑 | `src/lib/*.test.ts` | 10 个测试文件 |
| Hooks | `src/hooks/*.test.ts` | 4 个测试文件 |
| Context | `src/contexts/*.test.tsx` | 2 个测试文件 |
| 组件 | `src/components/*.test.tsx` | 1 个测试文件 |

---

## 覆盖率要求

### 目标覆盖率

| 指标 | 目标 | 说明 |
|------|------|------|
| **行覆盖率** | ≥ 90% | 代码行被执行的比例 |
| **分支覆盖率** | ≥ 85% | 条件分支被覆盖的比例 |
| **函数覆盖率** | ≥ 90% | 函数被调用的比例 |

### 覆盖率例外

以下代码可豁免覆盖率要求：

- UI 组件的样式代码
- 第三方库的类型定义
- 开发环境专用代码

---

## 测试框架

### Bun Test

GeekHub 使用 Bun 内置的测试框架：

```bash
# 运行所有测试
bun test

# 运行单个文件
bun test src/lib/rss.test.ts

# 运行匹配模式的测试
bun test --filter "RSS"

# 监听模式
bun test --watch
```

### 断言

Bun Test 使用 `expect` 断言：

```typescript
import { expect, test, describe } from 'bun:test'

describe('MyFunction', () => {
  test('should return expected value', () => {
    expect(myFunction(1, 2)).toBe(3)
  })
})
```

### Mock

```typescript
import { mock, spyOn } from 'bun:test'

// 创建 mock 函数
const mockFn = mock(() => 'mocked value')

// spy 现有函数
const spy = spyOn(object, 'method')
```

---

## 编写测试

### 文件命名

- 测试文件与源文件同目录
- 命名格式：`{source}.test.ts` 或 `{source}.test.tsx`

```
src/lib/
├── rss.ts
├── rss.test.ts          # ✅ 正确
├── feed-fetcher.ts
└── feed-fetcher.test.ts # ✅ 正确
```

### 测试结构

使用 `describe` 分组，`test` 定义用例：

```typescript
import { expect, test, describe, beforeEach, afterEach } from 'bun:test'

describe('ArticleRepository', () => {
  let repo: ArticleRepository

  beforeEach(() => {
    repo = new ArticleRepository()
  })

  afterEach(() => {
    // 清理
  })

  describe('save', () => {
    test('should save article successfully', async () => {
      const article = { title: 'Test', url: 'https://example.com' }
      const result = await repo.save(article)
      expect(result.id).toBeDefined()
    })

    test('should throw error for invalid article', async () => {
      expect(() => repo.save(null)).toThrow('Invalid article')
    })
  })

  describe('find', () => {
    test('should find article by id', async () => {
      // ...
    })
  })
})
```

### 异步测试

```typescript
test('should fetch feed', async () => {
  const result = await fetchFeed('https://example.com/rss')
  expect(result.items).toHaveLength(10)
})
```

### 测试数据

使用 fixtures 或 factory 函数：

```typescript
// fixtures/article.ts
export const createMockArticle = (overrides = {}) => ({
  id: 'test-id',
  title: 'Test Article',
  url: 'https://example.com/article',
  published_at: new Date().toISOString(),
  ...overrides,
})

// 使用
test('should process article', () => {
  const article = createMockArticle({ title: 'Custom Title' })
  // ...
})
```

---

## 运行测试

### 常用命令

```bash
# 运行所有测试
bun test

# 运行特定文件
bun test src/lib/rss.test.ts

# 运行匹配名称的测试
bun test --filter "should parse RSS"

# 监听模式（文件变化自动运行）
bun test --watch

# 显示详细输出
bun test --verbose
```

### CI/CD 集成

在 CI 中运行：

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test
```

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

### 2. 独立的测试用例

每个测试应独立运行，不依赖其他测试的状态：

```typescript
// ✅ 好：每个测试独立
beforeEach(() => {
  // 重置状态
})

// ❌ 差：测试间有依赖
test('create article', () => { ... })
test('update the created article', () => { ... }) // 依赖上一个测试
```

### 3. 有意义的测试名称

```typescript
// ✅ 好：描述行为和预期
test('should return empty array when no articles match the filter', () => {})

// ❌ 差：模糊的名称
test('filter works', () => {})
```

### 4. 边界条件测试

```typescript
describe('pagination', () => {
  test('should handle empty result', () => {})
  test('should handle single page', () => {})
  test('should handle last page', () => {})
  test('should handle page number exceeding total', () => {})
})
```

### 5. 错误场景测试

```typescript
describe('error handling', () => {
  test('should throw on network error', async () => {
    mock(fetch).mockRejectedValue(new Error('Network error'))
    await expect(fetchFeed(url)).rejects.toThrow('Network error')
  })

  test('should throw on invalid RSS format', async () => {
    await expect(parseRSS('not xml')).rejects.toThrow('Invalid RSS')
  })
})
```

---

## 测试覆盖的模块

### 已覆盖

| 模块 | 文件 | 覆盖内容 |
|------|------|----------|
| RSS 解析 | `rss.test.ts` | 解析、验证 |
| 文章仓库 | `article-repository.test.ts` | CRUD |
| 视图模型 | `article-view-model.test.ts` | 数据转换 |
| 已读状态 | `read-status-service.test.ts` | 状态管理 |
| Feed 抓取 | `feed-fetcher.test.ts` | 抓取逻辑 |
| RSSHub | `rsshub.test.ts` | 路由解析 |
| 翻译队列 | `translation-queue.test.ts` | 队列管理 |
| 日志 | `logger.test.ts` | 日志记录 |
| Feed Actions | `feed-actions.test.ts` | 业务逻辑 |
| Article Actions | `article-actions.test.ts` | 业务逻辑 |

### 待补充

- 更多组件测试
- E2E 测试
- API 路由集成测试

---

## 相关文档

- [开发指南](03-development.md) - 开发环境搭建
- [架构设计](01-architecture.md) - 了解系统架构

# 开发指南

> 返回 [README](../README.md)

本文档介绍如何搭建本地开发环境并参与 GeekHub 开发。

---

## 目录

- [环境准备](#环境准备)
- [本地开发](#本地开发)
- [代码规范](#代码规范)
- [调试技巧](#调试技巧)
- [常见问题](#常见问题)

---

## 环境准备

### 必需工具

| 工具 | 版本要求 | 安装方式 |
|------|----------|----------|
| Bun | 1.0+ | https://bun.sh |
| Node.js | 18+ | 仅用于某些工具 |
| Git | 任意版本 | - |

### 推荐 IDE

- **VS Code** + 插件：
  - ESLint
  - Tailwind CSS IntelliSense
  - TypeScript Vue Plugin (Volar) - 类型提示
  - Prettier

### Supabase 本地开发

**方式一：使用 Supabase Cloud（推荐新手）**

1. 创建免费项目：https://supabase.com
2. 获取 API Keys
3. 配置 `.env.local`

**方式二：本地 Supabase（高级）**

```bash
# 安装 Supabase CLI
brew install supabase/tap/supabase

# 启动本地实例
supabase start

# 查看本地 Keys
supabase status
```

---

## 本地开发

### 1. 克隆项目

```bash
git clone https://github.com/yourusername/geekhub.git
cd geekhub
```

### 2. 安装依赖

```bash
bun install
```

### 3. 配置环境变量

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

```bash
# Supabase 配置（必填）
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key

# AI 配置（可选，用于测试 AI 功能）
OPENAI_API_KEY=sk-xxx
OPENAI_API_BASE=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

### 4. 初始化数据库

在 Supabase Dashboard 的 SQL Editor 中执行迁移文件：

```bash
supabase/migrations/20260113000000_schema.sql
supabase/migrations/20260113000100_fix_feed_counts.sql
supabase/migrations/20260113000200_fix_trigger_auth.sql
supabase/migrations/20260113000300_security_hardening.sql
```

### 5. 启动开发服务器

```bash
bun run dev
```

访问 http://localhost:3000

---

## 代码规范

### TypeScript

- **严格模式**：`tsconfig.json` 已开启 `strict: true`
- **禁止 any**：不允许使用 `any`、`@ts-ignore`、`@ts-expect-error`
- **类型导入**：使用 `import type` 导入类型

```typescript
// ✅ 正确
import type { Feed } from '@/types/feed'
import { fetchFeed } from '@/lib/feed-actions'

// ❌ 错误
import { Feed } from '@/types/feed'  // 类型应使用 import type
```

### 路径别名

使用 `@/` 前缀导入 `src/` 目录下的模块：

```typescript
// ✅ 正确
import { ArticleRepository } from '@/lib/article-repository'

// ❌ 错误
import { ArticleRepository } from '../../../lib/article-repository'
```

### 组件规范

- 使用函数组件 + Hooks
- Props 使用 interface 定义
- 导出命名组件

```typescript
interface ArticleCardProps {
  article: Article
  onRead: (id: string) => void
}

export function ArticleCard({ article, onRead }: ArticleCardProps) {
  return (
    // ...
  )
}
```

### 提交规范

遵循 Conventional Commits：

```bash
<type>: <description>
```

| Type | 用途 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 |
| `docs` | 文档 |
| `test` | 测试 |
| `refactor` | 重构 |
| `chore` | 杂项 |

**示例：**

```bash
git commit -m "feat: add article translation cache"
git commit -m "fix: resolve SSE connection leak"
git commit -m "docs: update API documentation"
```

### 原子化提交

- 每个 commit 只包含**一个**逻辑完整的变更
- 不要混合功能开发和 bug 修复
- 保持 commit 可独立回滚

---

## 调试技巧

### API 调试

使用浏览器开发工具或 curl：

```bash
# 测试订阅源列表
curl http://localhost:3000/api/feeds/list \
  -H "Authorization: Bearer YOUR_TOKEN"

# 测试 AI 摘要
curl -X POST http://localhost:3000/api/ai/summarize \
  -H "Content-Type: application/json" \
  -d '{"articleId": "xxx"}'
```

### SSE 调试

打开浏览器开发工具 → Network → 筛选 EventStream：

- `/api/logs/stream` - 抓取日志流
- 观察事件推送是否正常

### 代理调试

```bash
# 测试代理检测
curl http://localhost:3000/api/test-proxy

# 手动设置代理测试
HTTP_PROXY=http://127.0.0.1:7890 bun run dev
```

### 数据库调试

1. 打开 Supabase Dashboard → Table Editor
2. 直接查看/修改数据
3. 或使用 SQL Editor 执行查询

---

## 常见问题

### Q: 启动时报 Supabase 连接错误？

**A:** 检查 `.env.local` 中的配置：
- `NEXT_PUBLIC_SUPABASE_URL` 格式：`https://xxx.supabase.co`
- 确保 Anon Key 和 Service Key 正确

### Q: 抓取订阅源失败？

**A:** 可能原因：
1. 网络问题 - 尝试配置代理
2. RSS 格式问题 - 检查 URL 是否有效
3. 防盗链 - 某些网站限制访问

### Q: 图片无法显示？

**A:** 图片代理功能需要：
1. 确保 `/api/image-proxy` 端点正常
2. 检查控制台是否有 CORS 错误

### Q: AI 功能不工作？

**A:** 检查 AI 配置：
1. 确保 `OPENAI_API_KEY` 正确
2. 如使用自定义 Base URL，确保格式正确
3. 检查 API 余额是否充足

### Q: 热更新不生效？

**A:** 尝试：
1. 清除 `.next` 缓存：`rm -rf .next`
2. 重启开发服务器
3. 检查文件监听限制：`ulimit -n 10240`

---

## 相关文档

- [测试规范](04-testing.md) - 编写测试
- [架构设计](01-architecture.md) - 了解系统架构
- [API 参考](05-api-reference.md) - API 端点详情

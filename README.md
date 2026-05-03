# 📰 GeekHub

<div align="center">

![GeekHub Preview](https://assets.lizheng.me/wp-content/uploads/2026/01/geekhub-scaled.jpg)

**现代化的自托管 RSS 聚合阅读器，支持 AI 摘要与翻译**

[![Next.js](https://img.shields.io/badge/Next.js-16.1-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?logo=supabase)](https://supabase.com/)
[![Test Coverage](https://img.shields.io/badge/Coverage-90%25-brightgreen)](docs/04-testing.md)

</div>

---

## 📖 目录

- [✨ 特性亮点](#-特性亮点)
- [🚀 快速开始](#-快速开始)
- [📁 项目结构](#-项目结构)
- [🤖 Agent 开发指南](#-agent-开发指南)
- [📚 完整文档](#-完整文档)
- [📄 开源协议](#-开源协议)

---

## ✨ 特性亮点

| 🏠 完全自托管 | 🤖 AI 增强 | 🎨 阅读体验 | 🚀 技术特性 |
|:---:|:---:|:---:|:---:|
| 数据完全本地化 | BYOM 自定义模型 | 沉浸式阅读器 | 智能代理检测 |
| 隐私优先 | 智能摘要 | 深色/浅色主题 | 实时 SSE 更新 |
| 无厂商锁定 | 一键翻译 | 自定义字体 | 图片防盗链代理 |

👉 详细功能介绍请查看 [功能文档](docs/02-features.md)

---

## 🚀 快速开始

### 前置要求

- **Bun** 1.0+ ([安装指南](https://bun.sh))
- **Supabase** 实例 ([自托管](https://supabase.com/docs/guides/self-hosting) 或 [云服务](https://supabase.com))

### 安装与运行

```bash
# 1. 克隆项目
git clone https://github.com/yourusername/geekhub.git
cd geekhub

# 2. 安装依赖
bun install

# 3. 配置环境变量（复制模板并填写）
cp .env.example .env.local

# 4. 启动开发服务器
bun run dev
```

访问 http://localhost:3000 开始使用 🎉

👉 完整部署指南请查看 [部署文档](docs/07-deployment.md)

---

## 📁 项目结构

```
geekhub/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # API 路由（36 个端点）
│   │   └── ...           # 页面路由
│   ├── components/       # React 组件
│   │   ├── ui/           # shadcn/ui 基础组件
│   │   └── manage/       # 管理对话框
│   ├── contexts/         # React Context（Auth, SSE, FeedFetch）
│   ├── hooks/            # 自定义 Hooks
│   ├── lib/              # 核心业务逻辑
│   ├── schemas/          # 数据库 Schema
│   └── types/            # TypeScript 类型定义
├── supabase/
│   └── migrations/       # 数据库迁移文件
├── docs/                 # 项目文档
└── data/                 # 本地数据存储（生产环境）
```

👉 详细架构说明请查看 [架构文档](docs/01-architecture.md)

---

## 🤖 Agent 开发指南

> **本节专为 AI Agent（如 Claude、Cursor、GitHub Copilot）编写**

### 核心命令

| 命令 | 说明 |
|------|------|
| `bun run dev` | 启动开发服务器（Turbopack） |
| `bun run build` | 生产构建 |
| `bun run test` | 运行测试 |
| `bun run test:coverage` | 运行测试并生成覆盖率报告 |
| `bun run lint` | ESLint 检查 |

### 开发规范

#### 1️⃣ 测试要求

- **覆盖率目标**: 95% (statements/functions/lines), 90% (branches)
- **测试框架**: Vitest
- **测试文件命名**: `*.test.ts` / `*.test.tsx`
- **新增代码必须编写对应单元测试**

```bash
# 运行测试
bun run test

# 运行单个测试文件
bun run test src/lib/rss.test.ts
```

#### 2️⃣ 提交规范

- **原子化提交**: 每个 commit 只包含一个逻辑完整的变更
- **Conventional Commits**: `<type>: <description>`
  - `feat`: 新功能
  - `fix`: 修复
  - `docs`: 文档
  - `test`: 测试
  - `refactor`: 重构
  - `chore`: 杂项

```bash
# 正确示例
git commit -m "feat: add article translation cache"
git commit -m "fix: resolve SSE connection leak"
git commit -m "test: add feed-fetcher unit tests"
```

#### 3️⃣ 文档要求

- **代码变更必须更新相应文档**
- **新增 API 需在 [API 文档](docs/05-api-reference.md) 中记录**
- **架构变更需更新 [架构文档](docs/01-architecture.md)**

#### 4️⃣ 代码风格

- **TypeScript strict 模式**: 禁止 `any`、`@ts-ignore`
- **路径别名**: 使用 `@/` 前缀导入
- **组件规范**: 函数组件 + Hooks

```typescript
// ✅ 正确
import { ArticleRepository } from '@/lib/article-repository'

// ❌ 错误
import { ArticleRepository } from '../../../lib/article-repository'
```

### 关键文件索引

| 功能 | 文件路径 |
|------|----------|
| RSS 解析 | `src/lib/rss.ts` |
| 文章仓库 | `src/lib/article-repository.ts` |
| Feed 抓取 | `src/lib/feed-fetcher.ts` |
| AI 翻译 | `src/lib/translation-queue.ts` |
| 代理设置 | `src/lib/settings.ts` |
| 认证上下文 | `src/contexts/AuthContext.tsx` |
| SSE 上下文 | `src/contexts/SSEContext.tsx` |

### 环境变量

```bash
# Supabase 配置（必填）
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key

# AI 配置（可选）
OPENAI_API_KEY=sk-xxx
OPENAI_API_BASE=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

---

## 📚 完整文档

| 文档 | 说明 |
|------|------|
| [📐 架构设计](docs/01-architecture.md) | 系统架构、技术栈、数据流 |
| [✨ 功能详解](docs/02-features.md) | 核心功能介绍 |
| [💻 开发指南](docs/03-development.md) | 本地开发、调试技巧 |
| [🧪 测试规范](docs/04-testing.md) | 测试策略、覆盖率要求 |
| [🔌 API 参考](docs/05-api-reference.md) | API 端点文档 |
| [🗄️ 数据库设计](docs/06-database.md) | 表结构、关系、RLS |
| [🚀 部署指南](docs/07-deployment.md) | 生产环境部署 |

---

## 📄 开源协议

[MIT License](LICENSE)

---

## 🙏 致谢

- [Next.js](https://nextjs.org/) - React 框架
- [Supabase](https://supabase.com/) - 后端即服务
- [shadcn/ui](https://ui.shadcn.com/) - UI 组件库
- [Radix UI](https://www.radix-ui.com/) - 无样式组件库

---

<div align="center">

**如果这个项目对你有帮助，请给它一个 ⭐️**

Made with ❤️ by [lizheng](https://github.com/lizheng)

</div>

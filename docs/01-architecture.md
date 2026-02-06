# 架构设计

> 返回 [README](../README.md)

## 概述

GeekHub 采用**以数据库为中心**的架构设计，使用 Supabase (PostgreSQL) 存储所有数据，通过 Row Level Security (RLS) 实现多用户隔离。

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   抓取层         │    │   存储层         │    │   视图层         │
│  FeedFetcher    │ -> │ Supabase (DB)   │ -> │ React Hooks /   │
│  (RSS 解析)     │    │ (PostgreSQL)    │    │ ViewModel       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **前端框架** | Next.js 16 (App Router) | 服务端渲染、API 路由 |
| **UI 框架** | React 19 | 函数组件 + Hooks |
| **类型系统** | TypeScript 5 (strict) | 严格类型检查 |
| **UI 组件** | Radix UI + shadcn/ui | 无障碍、可定制 |
| **样式** | TailwindCSS 3.4 | 原子化 CSS |
| **状态管理** | React Context | Auth, SSE, FeedFetch |
| **数据获取** | TanStack Query | 缓存、同步、乐观更新 |
| **后端服务** | Supabase | PostgreSQL + Auth + RLS |
| **RSS 解析** | rss-parser + cheerio | 标准 RSS/Atom 支持 |
| **AI 集成** | OpenAI SDK | 摘要、翻译 |
| **代理支持** | undici + https-proxy-agent | Clash 自动检测 |
| **实时通信** | Server-Sent Events | 抓取进度推送 |

---

## 系统架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                           客户端 (Browser)                          │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ ArticleList  │  │ ReaderView   │  │   Sidebar    │   ...        │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                 │                       │
│  ┌──────┴─────────────────┴─────────────────┴───────┐              │
│  │              React Context Layer                  │              │
│  │  (AuthContext, SSEContext, FeedFetchContext)     │              │
│  └──────────────────────┬───────────────────────────┘              │
│                         │                                           │
│  ┌──────────────────────┴───────────────────────────┐              │
│  │              Custom Hooks Layer                   │              │
│  │  (useFeedViewModels, useArticleActions, ...)     │              │
│  └──────────────────────┬───────────────────────────┘              │
└─────────────────────────┼───────────────────────────────────────────┘
                          │ HTTP / SSE
┌─────────────────────────┼───────────────────────────────────────────┐
│                         ▼                                           │
│  ┌──────────────────────────────────────────────────┐              │
│  │              Next.js API Routes                   │   服务端     │
│  │  /api/feeds, /api/articles, /api/ai, ...         │              │
│  └──────────────────────┬───────────────────────────┘              │
│                         │                                           │
│  ┌──────────────────────┴───────────────────────────┐              │
│  │              Service Layer (lib/)                 │              │
│  │  FeedFetcher, ArticleActions, TranslationQueue   │              │
│  └──────────────────────┬───────────────────────────┘              │
│                         │                                           │
│  ┌──────────────────────┴───────────────────────────┐              │
│  │              Data Access Layer                    │              │
│  │  Supabase Client (supabase-server.ts)            │              │
│  └──────────────────────┬───────────────────────────┘              │
└─────────────────────────┼───────────────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────────────┐
│                         ▼                                           │
│  ┌──────────────────────────────────────────────────┐              │
│  │              Supabase (PostgreSQL)                │   数据层     │
│  │  categories, feeds, articles, user_articles      │              │
│  │  + Row Level Security (RLS)                      │              │
│  └──────────────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 目录结构

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # 36 个 API 路由
│   │   ├── feeds/          # 订阅源管理
│   │   ├── articles/       # 文章操作
│   │   ├── categories/     # 分类管理
│   │   ├── ai/             # AI 功能
│   │   ├── data/           # 数据管理
│   │   └── logs/           # 日志相关
│   ├── auth/               # 认证回调
│   ├── login/              # 登录页面
│   ├── layout.tsx          # 根布局
│   └── page.tsx            # 主页面
│
├── components/             # React 组件
│   ├── ui/                 # shadcn/ui 基础组件 (22 个)
│   ├── manage/             # 管理对话框 (6 个)
│   ├── ArticleList.tsx     # 文章列表（无限滚动）
│   ├── ReaderView.tsx      # 沉浸式阅读器
│   ├── Sidebar.tsx         # 侧边栏
│   ├── Header.tsx          # 顶栏
│   └── ...
│
├── contexts/               # React Context
│   ├── AuthContext.tsx     # Supabase 认证状态
│   ├── SSEContext.tsx      # SSE 实时推送
│   └── FeedFetchContext.tsx # 抓取状态管理
│
├── hooks/                  # 自定义 Hooks
│   ├── useFeedViewModels.ts # 订阅源视图模型
│   ├── useFeedActions.ts    # 订阅源 CRUD
│   ├── useArticleActions.ts # 文章操作
│   ├── useDatabase.ts       # 数据库操作
│   └── ...
│
├── lib/                    # 核心业务逻辑
│   ├── feed-fetcher.ts     # RSS 抓取（代理支持）
│   ├── article-actions.ts  # 文章业务逻辑
│   ├── feed-actions.ts     # 订阅源业务逻辑
│   ├── translation-queue.ts # AI 翻译队列
│   ├── rss.ts              # RSS 解析
│   ├── settings.ts         # 用户设置
│   ├── supabase-server.ts  # 服务端 Supabase 客户端
│   ├── supabase-browser.ts # 浏览器端 Supabase 客户端
│   └── ...
│
├── schemas/                # JSON Schema
│   └── rss-cache.schema.json
│
└── types/                  # TypeScript 类型定义
    ├── feed-view-model.ts
    └── article-view-model.ts

supabase/
└── migrations/             # 数据库迁移文件
    ├── 20260113000000_schema.sql
    ├── 20260113000100_fix_feed_counts.sql
    ├── 20260113000200_fix_trigger_auth.sql
    └── 20260113000300_security_hardening.sql
```

---

## 数据流

### 1. 文章列表加载

```
用户点击订阅源
    ↓
useFeedViewModels (Hook)
    ↓
TanStack Query 缓存检查
    ↓ (缓存未命中)
GET /api/feeds/[id]/articles
    ↓
Supabase 查询 (articles + user_articles JOIN)
    ↓
返回 ArticleViewModel[]
    ↓
ArticleList 渲染
```

### 2. RSS 抓取流程

```
用户点击 "刷新"
    ↓
POST /api/feeds/[id]/fetch
    ↓
FeedFetcher.fetch()
    ├── 检测代理（Clash 端口）
    ├── 发起 HTTP 请求
    └── RSS 解析 (rss-parser)
    ↓
文章去重 (MD5 hash)
    ↓
批量插入 articles 表
    ↓
更新 fetch_status 缓存
    ↓
SSE 推送更新事件
    ↓
客户端自动刷新列表
```

### 3. AI 翻译流程

```
用户开启 "自动翻译"
    ↓
文章加载时检查翻译缓存
    ↓ (缓存未命中)
TranslationQueue.add()
    ↓
POST /api/ai/translate-content
    ↓
OpenAI API 调用
    ↓
结果写入翻译缓存
    ↓
UI 显示翻译内容
```

---

## 关键设计决策

### 1. 为什么选择 Supabase？

- **开箱即用的认证系统**：OAuth、邮箱登录
- **Row Level Security (RLS)**：数据库级别的多用户隔离
- **实时订阅**：支持数据库变更通知
- **自托管选项**：完全数据自主

### 2. 为什么使用 React Context 而非 Redux？

- **简洁性**：三个 Context 足以覆盖全部状态需求
- **服务端兼容**：与 Next.js App Router 无缝集成
- **类型安全**：TypeScript 原生支持

### 3. 代理自动检测机制

```typescript
// 检测顺序
const PROXY_PORTS = [7890, 7891, 7897, 7898, 10808, 10809]

// 逻辑
1. 检查环境变量 HTTP_PROXY / HTTPS_PROXY
2. 依次探测 Clash 常用端口
3. 找到可用端口后缓存配置
```

### 4. 文章 Hash 策略

```typescript
// 用于去重
article_hash = MD5(url + '|' + title + '|' + published_at)
```

---

## 相关文档

- [数据库设计](06-database.md) - 表结构、关系、RLS 策略
- [API 参考](05-api-reference.md) - 36 个 API 端点详解
- [开发指南](03-development.md) - 本地开发环境搭建

# GeekHub

<div align="center">

![GeekHub Preview](https://assets.lizheng.me/wp-content/uploads/2026/01/geekhub-scaled.jpg)

**现代化的自托管 RSS 聚合阅读器，支持 AI 摘要与翻译**

[![Next.js](https://img.shields.io/badge/Next.js-16.1-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?logo=supabase)](https://supabase.com/)

</div>

---

## ✨ 特性

### 🏠 完全自托管
- **数据完全本地化**：所有文章内容存储在本地文件系统，元数据存储在自有的 Supabase 实例
- **隐私优先**：无需依赖第三方云端服务，数据完全由你自己掌控
- **无厂商锁定**：可随时迁移数据，支持导出

### 🤖 AI 增强功能
- **BYOM (Bring Your Own Model)**：支持自定义 OpenAI 兼容的 API 端点
- **智能摘要**：自动为文章生成 AI 摘要
- **一键翻译**：集成 AI 翻译功能，打破语言障碍
- **队列管理**：智能缓存机制，避免重复消耗 API 配额

### 🎨 优秀的阅读体验
- **沉浸式阅读器**：专注于内容的阅读界面
- **深色模式**：支持深色/浅色主题切换
- **自定义字体**：可调节阅读字体和字号
- **自动翻译**：可选的自动翻译功能

### 🚀 强大的技术特性
- **智能代理检测**：自动检测 Clash/Clash Verge 端口，无缝抓取海外 RSS
- **实时更新**：基于 SSE 的实时日志推送和抓取进度显示
- **定时抓取**：内置调度器，支持自定义 cron 表达式
- **图片代理**：绕过防盗链，自动处理图片加载

### 📦 混合存储架构
- **文件系统存储**：文章内容按日期分层存储（`data/feeds/{hash}/articles/YYYY/MM/`）
- **数据库存储**：Supabase 管理用户、分类、订阅源、阅读状态
- **高效索引**：基于 Hash 的 O(1) 文件查找

---

## 🛠️ 技术栈

- **前端框架**：Next.js 16 (App Router) + React 19 + TypeScript 5
- **UI 组件**：Radix UI + shadcn/ui + TailwindCSS
- **后端服务**：Supabase (PostgreSQL + Auth + RLS)
- **状态管理**：React Context API
- **数据获取**：TanStack Query (React Query)
- **RSS 解析**：rss-parser + cheerio
- **AI 集成**：OpenAI SDK (支持自定义 API Base URL)

---

## 📦 部署指南

### 前置要求

- Node.js 18+
- Supabase 实例（可使用 [Supabase Cloud](https://supabase.com) 或自托管）

### 1. 克隆项目

```bash
git clone https://github.com/yourusername/geekhub.git
cd geekhub
npm install
```

### 2. 配置 Supabase

在 Supabase Dashboard 中执行 `supabase/migrations/` 目录下的 SQL 迁移文件：

1. `001_initial_schema.sql` - 基础表结构
2. `002_rss_schema.sql` - RSS 相关表
3. `003_core_tables.sql` - 核心业务表
4. `004_read_later_table.sql` - 稍后阅读功能
5. `005_add_auto_translate.sql` - 自动翻译功能

### 3. 配置环境变量

创建 `.env.local` 文件：

```bash
# Supabase 配置（必填）
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key

# AI 配置（可选）
OPENAI_API_KEY=sk-xxx
OPENAI_API_BASE=https://api.openai.com/v1  # 或使用兼容接口如 AIMixHub
OPENAI_MODEL=gpt-4o-mini
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

### 5. 启动 RSS 抓取调度器

```bash
# 默认 15 分钟抓取一次
npm run scheduler

# 立即触发一次抓取
npm run scheduler -- --trigger

# 自定义 cron 表达式（例如每 5 分钟）
npm run scheduler -- --cron '*/5 * * * *'
```

### 6. 生产环境部署

```bash
# 构建
npm run build

# 启动生产服务器
npm start
```

推荐使用 **PM2** 进行进程管理：

```bash
npm install -g pm2

# 启动 Web 服务
pm2 start npm --name "geekhub-web" -- start

# 启动调度器
pm2 start npm --name "geekhub-scheduler" -- run scheduler

# 保存 PM2 配置
pm2 save
pm2 startup
```

---

## 🎯 核心功能

### RSS 订阅管理
- 支持标准 RSS/Atom feeds
- 集成 RSSHub 自定义路由
- 分类管理与文件夹组织
- 批量导入/导出 OPML

### 阅读体验
- 无限滚动文章列表
- 阅读进度保存
- 收藏与稍后阅读
- 已读/未读状态同步

### AI 功能
- 文章摘要生成
- 内容翻译（支持多语言）
- 可配置 AI 模型与参数
- 翻译缓存机制

### 系统特性
- 代理自动检测（Clash 端口）
- 实时抓取日志终端
- 图片防盗链处理
- 响应式设计（移动端适配）

---

## 📁 项目结构

```
geekhub/
├── src/
│   ├── app/              # Next.js App Router
│   ├── components/       # React 组件
│   │   ├── ui/          # shadcn/ui 基础组件
│   │   └── manage/      # 管理对话框
│   ├── contexts/        # React Context (Auth, SSE)
│   ├── hooks/           # 自定义 Hooks
│   ├── lib/             # 核心业务逻辑
│   └── types/           # TypeScript 类型
├── supabase/
│   └── migrations/      # 数据库迁移文件
├── scripts/
│   └── scheduler.ts     # RSS 定时抓取调度器
├── data/                # 文件系统存储（文章内容）
└── docs/                # 项目文档
```

---

## 🧪 测试

```bash
# 运行测试
npm test

# 监视模式
npm run test:watch

# 覆盖率报告
npm run test:coverage
```

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

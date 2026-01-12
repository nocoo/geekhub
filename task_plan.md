# Task Plan: GeekHub Database Migration

## Goal
将 GeekHub 的文章数据从文件系统迁移到 Supabase 数据库，实现完全云端化的数据存储。

**简化策略**：允许数据丢失（可重新抓取），只需保护 Feed 和分类数据，直接切换无需双写/双读模式。

## 当前状态分析

### 现有文件系统结构
```
data/
├── feeds/{url_hash}/
│   ├── index.json          # 文章索引（最近1000篇）
│   ├── cache.json          # 抓取缓存（HTTP状态、统计）
│   ├── fetch.log           # 抓取日志
│   └── articles/{YYYY}/{MM}/{article_hash}.json  # 文章内容
├── 约 45 个订阅源
├── 约 3,185 个 JSON 文件
└── 总大小约 29 MB
```

### 现有数据库表
- `categories` - 用户分类
- `feeds` - RSS 订阅源（含 url_hash、统计等）
- `read_articles` - 已读状态
- `bookmarked_articles` - 收藏
- `read_later_articles` - 稍后阅读

### 关键约束
- ✅ **保护数据**: feeds 表和 categories 表（用户配置，不可丢失）
- ⚠️ **可丢失数据**: articles、logs、cache（可重新抓取生成）
- ✅ **简化流程**: 无需双写/双读，直接切换

### 关键设计原则
1. **正交性** - 每个字段只在一个地方存储
2. **单一数据源** - 文章数据只在 articles 表
3. **用户操作分离** - user_articles 统一管理 read/bookmark/read_later

---

## Phases

### Phase 0: 准备与规划 ✅
- [x] 分析现有数据结构
- [x] 设计新 Schema（正交版）
- [x] 简化迁移计划（直接切换，无需双写/双读）

**确认事项**：
- 保留 `fetch_history` 表
- 统计数据重新计算（不迁移）
- 保留 `auto_translate` 字段
- **允许数据丢失**，直接切换

---

### Phase 1: 创建新表（Migration） 🚧
**目标**: 创建 articles、feed_cache、fetch_history、user_articles 表

- [x] 1.1 创建 `006_add_new_tables.sql`
  - [x] `articles` 表 + 索引
  - [x] `feed_cache` 表 + 索引
  - [x] `fetch_history` 表 + 索引
  - [x] `user_articles` 表 + 索引
  - [x] RLS 策略

- [x] 1.2 创建 `007_migrate_user_articles.sql`
  - [x] 迁移 `read_articles` → `user_articles`
  - [x] 迁移 `bookmarked_articles` → `user_articles`
  - [x] 迁移 `read_later_articles` → `user_articles`

- [ ] 1.3 应用 migration
  - [ ] 本地 Supabase 验证
  - [ ] 远程 Supabase 应用

**验证标准**: 新表创建成功，用户数据迁移完成

---

### Phase 2: 文章数据迁移脚本 ⏭️
**目标**: 将文件系统文章迁移到数据库

**决定**: 跳过迁移，新文章自动写入数据库

- [x] 2.1 创建 `scripts/migrate-articles.ts` (保留但不使用)
- [x] 2.2 创建 `scripts/init-feed-cache.ts` (保留但不使用)

**说明**:
- 现有文章不迁移，可重新抓取
- 新抓取的文章会自动写入数据库
- feeds 和 categories 数据已保留

---

### Phase 3: 代码切换 ✅
**目标**: 修改代码使用数据库，移除文件系统依赖

**已完成**：
- ✅ 3.1 重写 `ArticleRepository` - 完全使用数据库
- ✅ 3.2 修改 `FeedFetcher` - 写入 articles/feed_cache/fetch_history
- ✅ 3.3 修改 `ReadStatusService` - 使用 user_articles 表
- ✅ 3.4 更新相关 API (8 个路由已更新)

- [x] 3.1 重写 `ArticleRepository`
  - [x] 移除文件系统读取
  - [x] 全部改为数据库查询

- [x] 3.2 修改 `FeedFetcher`
  - [x] 写入 articles 表
  - [x] 更新 feed_cache 表
  - [x] 写入 fetch_history 表
  - [x] 移除文件系统写入

- [x] 3.3 修改 `ReadStatusService`
  - [x] 使用 `user_articles` 表

- [ ] 3.4 更新相关 API
  - [x] `/api/feeds/list` - 使用 feed_cache + user_articles
  - [x] `/api/feeds/[id]/mark-all-read` - 使用 articles + user_articles
  - [x] `/api/articles/[id]/read` - 使用 user_articles
  - [x] `/api/articles/[id]/unread` - 使用 user_articles
  - [x] `/api/articles/[id]/bookmark` - 使用 user_articles
  - [x] `/api/articles/[id]/read-later` - 使用 user_articles
  - [x] `/api/feeds/starred/articles` - 使用 user_articles + articles
  - [x] `/api/feeds/later/articles` - 使用 user_articles + articles

**验证标准**: 代码全部切换到数据库

---

### Phase 4: 清理旧表和文件
**目标**: 删除冗余表，保留用户配置

- [x] 4.1 创建 `008_cleanup.sql`
  - [x] 删除 `read_articles` 表 ✅
  - [x] 删除 `bookmarked_articles` 表 ✅
  - [x] 删除 `read_later_articles` 表 ✅
  - [x] 保留 `categories` 和 `feeds` 表（用户配置，不可丢失）

- [ ] 4.2 应用清理 migration
  - [ ] 执行 `008_cleanup.sql`

**验证标准**: 旧数据清理完成

---

### Phase 5: 验证与优化
**目标**: 确保系统正常运行

- [ ] 5.1 功能测试
  - [ ] 订阅源抓取
  - [ ] 文章列表
  - [ ] 阅读状态
  - [ ] 收藏功能

- [ ] 5.2 性能检查
  - [ ] 查询优化
  - [ ] 索引检查

**验证标准**: 所有功能正常

---

## Key Questions

1. **数据丢失风险**？
   → **可接受**: articles 可重新抓取，只有 feeds/categories 不可丢失

2. **回退策略**？
   → **不需要**: 直接切换，有问题重新抓取即可

3. **迁移时间**？
   → **快速**: 预计 1-2 小时完成全部迁移

---

## Decisions Made

- **Schema 设计**: articles + user_articles + feed_cache + fetch_history
- **直接切换**: 无需双写/双读，允许数据丢失
- **简化流程**: 创建新表 → 迁移数据 → 切换代码 → 清理旧数据
- **统计数据**: 重新计算，不迁移旧的 total_articles/unread_count

---

## Errors Encountered

*(待更新)*

---

## Status

**Phase 3 代码切换已完成** ✅

**已完成**：
- ✅ Phase 1: 创建新表 (006 + 007)
- ✅ Phase 2: 跳过迁移 (新文章自动写入)
- ✅ Phase 3: 代码切换 (核心库 + API 路由)

**待完成**：
- Phase 4: 清理旧表
- Phase 5: 验证

---

## Next Action

**Phase 4: 清理旧表（可选）**

创建 `008_cleanup.sql`：
- 删除 `read_articles` 表
- 删除 `bookmarked_articles` 表
- 删除 `read_later_articles` 表

**Phase 5: 验证与测试**

1. 运行 `bun run dev` 启动开发服务器
2. 测试订阅源抓取
3. 测试文章列表、阅读状态、收藏功能

---

## 迁移总结

### 已修改的文件

**核心库**：
- `src/lib/article-repository.ts` - 完全重写为数据库版
- `src/lib/feed-fetcher.ts` - 写入数据库 (articles/feed_cache/fetch_history)
- `src/lib/read-status-service.ts` - 使用 user_articles 表

**API 路由**：
- `src/app/api/feeds/list/route.ts`
- `src/app/api/feeds/[id]/mark-all-read/route.ts`
- `src/app/api/articles/[id]/read/route.ts`
- `src/app/api/articles/[id]/unread/route.ts`
- `src/app/api/articles/[id]/bookmark/route.ts`
- `src/app/api/articles/[id]/read-later/route.ts`
- `src/app/api/feeds/starred/articles/route.ts`
- `src/app/api/feeds/later/articles/route.ts`

**Migration 文件**：
- `supabase/migrations/006_add_new_tables.sql`
- `supabase/migrations/007_migrate_user_articles.sql`

**迁移脚本**（保留但不使用）：
- `scripts/migrate-articles.ts`
- `scripts/init-feed-cache.ts`

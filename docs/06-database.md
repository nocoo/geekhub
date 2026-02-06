# 数据库设计

> 返回 [README](../README.md)

本文档详细介绍 GeekHub 的数据库设计，包括表结构、关系和 Row Level Security (RLS) 策略。

---

## 目录

- [架构概览](#架构概览)
- [核心表结构](#核心表结构)
- [表关系](#表关系)
- [RLS 安全策略](#rls-安全策略)
- [索引设计](#索引设计)
- [迁移文件](#迁移文件)

---

## 架构概览

GeekHub 采用 **Supabase (PostgreSQL)** 作为数据库，所有数据存储在数据库中。

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   categories    │    │     feeds       │    │    articles     │
│   (分类)        │<───│   (订阅源)       │<───│    (文章)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                      │
                                                      ▼
                                              ┌─────────────────┐
                                              │  user_articles  │
                                              │  (用户交互)      │
                                              └─────────────────┘
```

---

## 核心表结构

### categories（分类）

存储用户创建的订阅源分类。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PRIMARY KEY | 主键 |
| `user_id` | UUID | NOT NULL, FK | 用户 ID |
| `name` | VARCHAR(100) | NOT NULL | 分类名称 |
| `color` | VARCHAR(7) | DEFAULT '#10b981' | 颜色代码 |
| `icon` | VARCHAR(50) | DEFAULT '📁' | Emoji 图标 |
| `sort_order` | INTEGER | DEFAULT 0 | 排序顺序 |
| `created_at` | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | 更新时间 |

**约束：**
- `UNIQUE(user_id, name)` - 同一用户下分类名不重复

---

### feeds（订阅源）

存储 RSS 订阅源信息。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PRIMARY KEY | 主键 |
| `user_id` | UUID | NOT NULL, FK | 用户 ID |
| `category_id` | UUID | FK, ON DELETE SET NULL | 分类 ID |
| `title` | VARCHAR(255) | NOT NULL | 订阅源标题 |
| `url` | TEXT | NOT NULL | RSS URL |
| `url_hash` | VARCHAR(12) | UNIQUE | MD5(URL)[:12] |
| `description` | TEXT | | 描述 |
| `favicon_url` | TEXT | | 图标 URL |
| `fetch_interval` | INTEGER | DEFAULT 60 | 抓取间隔（分钟） |
| `is_active` | BOOLEAN | DEFAULT true | 是否激活 |
| `auto_translate` | BOOLEAN | DEFAULT false | 自动翻译 |
| `created_at` | TIMESTAMP | DEFAULT NOW() | 创建时间 |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | 更新时间 |

**约束：**
- `UNIQUE(user_id, url)` - 同一用户下 URL 不重复
- `UNIQUE(url_hash)` - Hash 全局唯一

---

### articles（文章）

存储抓取的文章内容。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PRIMARY KEY | 主键 |
| `feed_id` | UUID | NOT NULL, FK, ON DELETE CASCADE | 订阅源 ID |
| `hash` | TEXT | NOT NULL | 内容 Hash（去重用） |
| `title` | TEXT | NOT NULL | 文章标题 |
| `url` | TEXT | NOT NULL | 原文 URL |
| `link` | TEXT | | 备用链接 |
| `author` | TEXT | | 作者 |
| `published_at` | TIMESTAMP | | 发布时间 |
| `content` | TEXT | | 完整 HTML 内容 |
| `content_text` | TEXT | | 纯文本内容 |
| `summary` | TEXT | | 摘要 |
| `categories` | TEXT[] | | RSS 分类标签 |
| `tags` | TEXT[] | | 处理后的标签 |
| `fetched_at` | TIMESTAMP | DEFAULT NOW() | 抓取时间 |
| `created_at` | TIMESTAMP | DEFAULT NOW() | 创建时间 |

**约束：**
- `UNIQUE(feed_id, hash)` - 同一订阅源下 Hash 不重复

**Hash 生成策略：**
```typescript
hash = MD5(url + '|' + title + '|' + published_at)
```

---

### user_articles（用户文章交互）

存储用户对文章的交互状态（已读、收藏、稍后阅读）。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PRIMARY KEY | 主键 |
| `user_id` | UUID | NOT NULL, FK | 用户 ID |
| `article_id` | UUID | NOT NULL, FK, ON DELETE CASCADE | 文章 ID |
| `is_read` | BOOLEAN | DEFAULT false | 已读状态 |
| `is_bookmarked` | BOOLEAN | DEFAULT false | 收藏状态 |
| `is_read_later` | BOOLEAN | DEFAULT false | 稍后阅读状态 |
| `read_at` | TIMESTAMP | | 阅读时间 |
| `bookmarked_at` | TIMESTAMP | | 收藏时间 |
| `read_later_at` | TIMESTAMP | | 标记稍后阅读时间 |
| `notes` | TEXT | | 用户笔记 |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | 更新时间 |

**约束：**
- `UNIQUE(user_id, article_id)` - 每个用户对每篇文章只有一条记录

---

### fetch_status（抓取状态缓存）

缓存订阅源的统计信息，避免频繁聚合查询。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PRIMARY KEY | 主键 |
| `feed_id` | UUID | NOT NULL, FK, UNIQUE | 订阅源 ID |
| `unread_count` | INTEGER | DEFAULT 0 | 未读数 |
| `total_articles` | INTEGER | DEFAULT 0 | 总文章数 |
| `last_fetch_at` | TIMESTAMP | | 上次抓取时间 |
| `next_fetch_at` | TIMESTAMP | | 下次抓取时间 |
| `last_error` | TEXT | | 上次错误信息 |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | 更新时间 |

---

### fetch_logs（抓取日志）

存储抓取过程的日志，用于监控和调试。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PRIMARY KEY | 主键 |
| `feed_id` | UUID | FK | 订阅源 ID |
| `user_id` | UUID | FK | 用户 ID |
| `level` | VARCHAR(10) | NOT NULL | 日志级别（info/warn/error） |
| `action` | VARCHAR(50) | | 动作类型（fetch/parse/save） |
| `message` | TEXT | | 日志消息 |
| `duration_ms` | INTEGER | | 耗时（毫秒） |
| `metadata` | JSONB | | 额外元数据 |
| `created_at` | TIMESTAMP | DEFAULT NOW() | 创建时间 |

---

### blogs（博客推荐）

存储推荐的博客列表，公共数据。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PRIMARY KEY | 主键 |
| `name` | VARCHAR(255) | NOT NULL | 博客名称 |
| `url` | TEXT | NOT NULL, UNIQUE | 博客 URL |
| `rss_url` | TEXT | | RSS URL |
| `description` | TEXT | | 描述 |
| `category` | VARCHAR(50) | | 分类 |
| `language` | VARCHAR(10) | | 语言 |
| `created_at` | TIMESTAMP | DEFAULT NOW() | 创建时间 |

---

## 表关系

```
auth.users (Supabase Auth)
    │
    ├──< categories (1:N)
    │       │
    │       └──< feeds (1:N, category_id 可为 NULL)
    │               │
    │               ├──< articles (1:N, CASCADE DELETE)
    │               │       │
    │               │       └──< user_articles (1:N, CASCADE DELETE)
    │               │
    │               └──< fetch_status (1:1)
    │               │
    │               └──< fetch_logs (1:N)
    │
    └──< user_articles (1:N)
```

**关键关系说明：**

| 关系 | 行为 |
|------|------|
| 删除 Category | feeds.category_id 设为 NULL |
| 删除 Feed | 级联删除 articles、fetch_status、fetch_logs |
| 删除 Article | 级联删除 user_articles |

---

## RLS 安全策略

所有表（除 `blogs`）都启用了 Row Level Security，确保用户只能访问自己的数据。

### 策略模式

```sql
-- 通用策略模式
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own data"
ON table_name
FOR ALL
USING (user_id = auth.uid());
```

### 各表策略

| 表 | 策略 |
|-----|------|
| `categories` | `user_id = auth.uid()` |
| `feeds` | `user_id = auth.uid()` |
| `articles` | 通过 `feed_id` 关联到 `feeds.user_id` |
| `user_articles` | `user_id = auth.uid()` |
| `fetch_status` | 通过 `feed_id` 关联 |
| `fetch_logs` | `user_id = auth.uid()` |
| `blogs` | 公开读取，管理员写入 |

### articles 特殊策略

由于 `articles` 表没有直接的 `user_id` 字段，通过 JOIN 实现：

```sql
CREATE POLICY "Users can access articles from own feeds"
ON articles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM feeds
    WHERE feeds.id = articles.feed_id
    AND feeds.user_id = auth.uid()
  )
);
```

---

## 索引设计

### 主要索引

```sql
-- 分类查询
CREATE INDEX idx_categories_user_id ON categories(user_id);

-- 订阅源查询
CREATE INDEX idx_feeds_user_id ON feeds(user_id);
CREATE INDEX idx_feeds_category_id ON feeds(category_id);
CREATE INDEX idx_feeds_url_hash ON feeds(url_hash);

-- 文章查询
CREATE INDEX idx_articles_feed_id ON articles(feed_id);
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX idx_articles_hash ON articles(hash);

-- 用户交互查询
CREATE INDEX idx_user_articles_user_id ON user_articles(user_id);
CREATE INDEX idx_user_articles_article_id ON user_articles(article_id);
CREATE INDEX idx_user_articles_is_read ON user_articles(is_read) WHERE is_read = false;
CREATE INDEX idx_user_articles_is_bookmarked ON user_articles(is_bookmarked) WHERE is_bookmarked = true;

-- 抓取日志查询
CREATE INDEX idx_fetch_logs_feed_id ON fetch_logs(feed_id);
CREATE INDEX idx_fetch_logs_created_at ON fetch_logs(created_at DESC);
```

### 全文搜索索引

```sql
-- 博客模糊搜索（使用 pg_trgm）
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_blogs_name_trgm ON blogs USING gin(name gin_trgm_ops);
CREATE INDEX idx_blogs_description_trgm ON blogs USING gin(description gin_trgm_ops);
```

---

## 迁移文件

迁移文件位于 `supabase/migrations/` 目录：

| 文件 | 说明 |
|------|------|
| `20260113000000_schema.sql` | 初始 Schema，创建所有表 |
| `20260113000100_fix_feed_counts.sql` | 修复 Feed 计数逻辑 |
| `20260113000200_fix_trigger_auth.sql` | 修复触发器认证问题 |
| `20260113000300_security_hardening.sql` | 安全加固，完善 RLS |

### 执行迁移

**方式一：Supabase Dashboard**

1. 打开 SQL Editor
2. 依次执行迁移文件

**方式二：Supabase CLI**

```bash
supabase db push
```

---

## 相关文档

- [架构设计](01-architecture.md) - 系统架构
- [API 参考](05-api-reference.md) - API 端点
- [部署指南](07-deployment.md) - 数据库部署

# Data Model Layer Design

GeekHub 数据模型分层设计与优化计划。

## 1. Overview

系统已从最初的混合存储（数据库 + 文本文件）演进为**以数据库为中心（Supabase/PostgreSQL）**的全量存储架构。这种变化带来了更好的查询灵活性、严格的数据一致性以及更简单的 RLS（Row Level Security）实现。

架构概览：
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   抓取层         │    │   存储层         │    │   View Model    │
│  FeedFetcher    │ -> │ Supabase (DB)     │ -> │ React Hook /    │
│  (RSS解析)      │    │ (PostgreSQL)      │    │ ArticleViewModel│
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 2. Core Tables

### 2.1 Category Model (`categories`)

| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK to auth.users, RLS isolation |
| `name` | VARCHAR(100) | Category name, UNIQUE(user_id, name) |
| `color` | VARCHAR(7) | UI color, default `#10b981` |
| `icon` | VARCHAR(50) | Emoji icon, default `📁` |
| `sort_order` | INTEGER | Sort key for cross-device consistency |
| `created_at` | TIMESTAMP | Creation time |
| `updated_at` | TIMESTAMP | Update time |

---

### 2.2 Feed Model (`feeds`)

| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK to auth.users, RLS isolation |
| `category_id` | UUID | FK to categories, ON DELETE SET NULL |
| `title` | VARCHAR(255) | Feed title |
| `url` | TEXT | RSS/Atom URL, UNIQUE(user_id, url) |
| `description` | TEXT | Feed description |
| `url_hash` | VARCHAR(12) | MD5(URL)[:12], UNIQUE, used for quick lookups |
| `favicon_url` | TEXT | Favicon URL |
| `fetch_interval` | INTEGER | Fetch interval in minutes, default 60 |
| `is_active` | BOOLEAN | Whether to continue fetching this feed |
| `auto_translate`| BOOLEAN | Enable AI translation for this feed |
| `created_at` | TIMESTAMP | Creation time |
| `updated_at` | TIMESTAMP | Update time |

---

### 2.3 Article Model (`articles`)

**Hash Strategy**:
```typescript
article_hash = md5(url | title | pubDate) // 32 chars
```

| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID | Primary key |
| `feed_id` | UUID | FK to feeds, ON DELETE CASCADE |
| `hash` | TEXT | Content hash for deduplication, UNIQUE(feed_id, hash) |
| `title` | TEXT | Article title |
| `url` | TEXT | Original article URL |
| `link` | TEXT | Optional alternative link |
| `author` | TEXT | Author name |
| `published_at` | TIMESTAMP | Original publication date |
| `content` | TEXT | Full HTML content (if available) |
| `content_text` | TEXT | Cleaned plain text |
| `summary` | TEXT | Short summary or snippet |
| `categories` | TEXT[] | Article categories (from RSS tags) |
| `tags` | TEXT[] | Processed tags |
| `fetched_at` | TIMESTAMP | When it was last crawled |
| `created_at` | TIMESTAMP | Record creation time |

---

### 2.4 User Interaction Model (`user_articles`)

统一处理用户对文章的所有交互状态。

| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK to auth.users |
| `article_id` | UUID | FK to articles |
| `is_read` | BOOLEAN | Read status |
| `is_bookmarked` | BOOLEAN | Bookmark status |
| `is_read_later` | BOOLEAN | Read later status |
| `read_at` | TIMESTAMP | Timestamp when marked as read |
| `bookmarked_at` | TIMESTAMP | Timestamp when bookmarked |
| `read_later_at` | TIMESTAMP | Timestamp when added to read later |
| `notes` | TEXT | User notes for the article |
| `updated_at` | TIMESTAMP | Record update time |

**Constraint**: `UNIQUE(user_id, article_id)`

---

### 2.5 Fetch Status & Logs

#### `fetch_status` (Cache & Stats)
用于快速显示 Feed 列表中的统计信息，避免大规模聚合查询。
- `unread_count`: 实时/缓存的未读数。
- `total_articles`: 总计文章数。
- `next_fetch_at`: 预计下次抓取时间。

#### `fetch_logs` (Monitoring)
结构化抓取日志，取代了早期的文件日志。
- `level`: info/warn/error。
- `action`: fetch/parse/save。
- `duration_ms`: 耗时监控。

---

## 3. Cross-Model Relationships

```
Category (1) ───< (N) Feed (1) ───< (N) Article (1) ───< (1) UserArticle (N)
                                                                 │
                                                                 └─> Auth.User
```

**Key Improvements**:
- **Cascade Deletes**: 删除 Category 会将 Feed 的 `category_id` 设为 NULL；删除 Feed 会级联删除其下所有 Articles 和关联的 `user_articles`。
- **RLS Policies**: 所有表（除公共 blogs 外）均启用 RLS，强制 `user_id = auth.uid()`。

---

## 4. Data Flow

```
User Action          -->  Backend/Supabase Client  -->  Database (PostgreSQL)
────────────────────────────────────────────────────────────────────────────
Create Feed          -->  Insert into `feeds`      -->  DB Trigger creates `fetch_status`
List Articles        -->  Select `articles`        -->  Left Join `user_articles` for status
Mark Read            -->  Upsert `user_articles`   -->  Update `is_read` & `read_at`
Fetch Service (CRON) -->  Process RSS Feed         -->  Batch Insert `articles` & Update `fetch_status`
```

---

## 5. Optimization Strategy

### 5.1 Unread Count (The performance key)
不再遍历文件。通过 `fetch_status` 缓存基础计数，并结合 `user_articles` 的变化进行增量更新。

### 5.2 Search & Discovery
- `blogs` 表配备了 `pg_trgm` (Trigram) 索引，支持模糊搜索和相似度排名。
- 对 `articles` 表的 `title` 和 `summary` 正在计划全文搜索 (FTS)。

### 5.3 Lazy Content Loading
API 默认可以只加载文章元数据（URL, Title, Date），仅在进入详情页时通过 Article ID 加载 `content` 和 `summary`。

---

## 6. Summary

| Aspect | Old State (Hybrid) | New State (Postgres) |
|--------|-------------------|----------------------|
| **Storage** | DB + JSON Files | Full PostgreSQL |
| **Consistency** | Manual Sync | Database Constraints |
| **Query** | Basic filtering | Complex joins / JSONB support |
| **Scalability** | IO limited | Indexed performance |
| **Security** | File permissions | Row Level Security (RLS) |

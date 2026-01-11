# Data Model Layer Design

GeekHub 数据模型分层设计与优化计划。

## 1. Overview

三层数据架构：

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   抓取层         │    │   存储层         │    │   View Model    │
│  FeedFetcher    │ -> │ ArticleRepo     │ -> │ ArticleViewModel│
│  (RSS解析)      │    │  (磁盘读写)      │    │  (UI适配)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 2. Three Core Models

### 2.1 Category Model

| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID | Primary key |
| `user_id` | UUID | RLS isolation |
| `name` | VARCHAR(100) | Category name, UNIQUE(user_id, name) |
| `color` | VARCHAR(7) | UI color, default `#10b981` |
| `icon` | VARCHAR(50) | Emoji icon, default `📁` |
| `sort_order` | INTEGER | **Sort key** - drag to reorder |
| `created_at` | TIMESTAMP | Creation time |
| `updated_at` | TIMESTAMP | Update time |

**Storage**: PostgreSQL `categories` table

**Sort Strategy**: `ORDER BY sort_order ASC, created_at DESC`

**Index**:
- `idx_categories_user_id` on `user_id`

---

### 2.2 Feed Model

| Field | Type | Purpose |
|-------|------|---------|
| `id` | UUID | Primary key |
| `user_id` | UUID | RLS isolation |
| `category_id` | UUID | FK to categories, ON DELETE SET NULL |
| `title` | VARCHAR(255) | Feed title |
| `url` | TEXT | RSS URL, UNIQUE(user_id, url) |
| `url_hash` | VARCHAR(12) | **Critical** - MD5(URL)[:12], file path |
| `favicon_url` | TEXT | Favicon URL |
| `site_url` | TEXT | Site URL |
| `last_fetched_at` | TIMESTAMP | Last fetch time |
| `fetch_interval_minutes` | INTEGER | Fetch interval, default 60 |
| `is_active` | BOOLEAN | Active status |
| `total_articles` | INTEGER | Cached article count |
| `unread_count` | INTEGER | Cached unread count |

**Storage**: Dual-layer (DB + File System)

**File Structure**:
```
data/feeds/{url_hash}/
├── meta.json          # Feed metadata
├── index.json         # Article index (recent 1000)
├── articles/          # Full articles
│   └── {YYYY}/{MM}/{article_hash}.json
└── cache.json         # Fetch cache
```

**Indexes**:
- `idx_feeds_user_id` on `user_id`
- `idx_feeds_url_hash` on `url_hash` (UNIQUE)

---

### 2.3 Article Model

**Hash Strategy**:
```typescript
url_hash = md5(url).slice(0, 12)           // 12 chars, directory name
article_hash = md5(url | title | pubDate)  // 32 chars, filename
```

**Storage**: File system (primary) + DB (status index)

**File Structure**:
```
data/feeds/{url_hash}/
├── index.json
└── articles/
    └── {YYYY}/{MM}/{article_hash}.json
```

**index.json Structure** (lightweight index, recent 1000):
```json
{
  "last_updated": "2026-01-11T...",
  "total_count": 105,
  "articles": [
    {
      "hash": "0e23479e833b69a0782076b2da398fc3",
      "title": "Article Title",
      "url": "https://example.com/article",
      "link": "https://example.com/article",
      "author": "Author Name",
      "published_at": "Sat, 10 Jan 2026 22:15:35 +0000",
      "summary": "Article summary...",
      "categories": ["News"],
      "fetched_at": "2026-01-11T01:43:39.306Z"
    }
  ]
}
```

**article_hash.json Structure** (full content):
```json
{
  "hash": "a1b2c3d4e5f6...",
  "title": "Article Title",
  "url": "https://example.com/article",
  "author": "John Doe",
  "published_at": "2026-01-10T09:00:00Z",
  "content": "Full HTML content...",
  "content_text": "Plain text version...",
  "summary": "Article summary",
  "categories": ["Tech"],
  "ai_summary": {
    "content": "AI generated summary...",
    "model": "gpt-4o-mini",
    "generated_at": "2026-01-10T10:00:00Z",
    "usage": { "prompt_tokens": 100, "completion_tokens": 50 }
  },
  "fetched_at": "2026-01-10T09:00:00Z"
}
```

**DB Status Tables**:
| Table | Purpose | Constraint |
|-------|---------|------------|
| `read_articles` | Read status | UNIQUE(user_id, article_hash) |
| `bookmarked_articles` | Bookmarks | UNIQUE(user_id, article_hash) |
| `read_later_articles` | Read later | UNIQUE(user_id, article_hash) |

**Indexes**:
- `idx_read_articles_user_feed` on `(user_id, feed_id)`

---

## 3. Cross-Model Relationships

```
Category (1) ───< (N) Feed (1) ───< (N) Article
                           │
                           └──> (N) read_articles (via article_hash)
                           └──> (N) bookmarked_articles
```

**Relationship Maintenance**:
- Feed stores `category_id` FK
- Category delete: `SET NULL` for feeds
- Feed delete: Cascade to `read_articles`, `bookmarked_articles`

**Query Examples**:
```typescript
// Get feeds with category
supabase.from('feeds')
  .select('*, category:categories(*)')
  .eq('user_id', userId)

// Get unread count for a feed
const index = await repo.getIndex(urlHash)
const readHashes = await readStatus.getReadHashes(feedId)
const unreadCount = index.articles.length - readHashes.size
```

---

## 4. Data Flow

```
User Action          -->  API Layer          -->  Data Layer
─────────────────────────────────────────────────────────────
Create Feed          -->  POST /feeds        -->  DB + file: meta.json
List Feeds           -->  GET /feeds/list    -->  DB + file: index.json
Fetch Articles       -->  GET /feeds/...     -->  file: index.json + articles/*.json
Mark Read            -->  POST /articles/..  -->  DB: read_articles
Bookmark             -->  POST /articles/..  -->  DB: bookmarked_articles
Delete Feed          -->  DELETE /feeds/[id] -->  DB + rm -rf data/feeds/{url_hash}
```

---

## 5. Performance Issues

| Issue | Location | Impact | Severity |
|-------|----------|--------|----------|
| **Unread count O(n)** | `/api/feeds/list` | N feeds = N file reads + N DB queries | High |
| **Article content preload** | ArticleViewModel | List page loads all full content | High |
| **No pagination** | `/api/feeds/[id]/articles` | Returns all articles | Medium |
| **index.json uncompressed** | File storage | Large files for big feeds | Low |

### 5.1 Unread Count Calculation (Bottleneck)

```typescript
// Current implementation - O(n) per feed
const feedsWithCounts = await Promise.all(
  feeds.map(async (feed) => {
    const index = await repo.getIndex(feed.url_hash);
    const readHashes = await readStatus.getReadHashes(feed.id);
    return {
      ...feed,
      unread_count: index.articles.length - readHashes.size
    };
  })
);
```

---

## 6. Optimization Plan

### Priority 1: Cache Unread Count

**Problem**: O(n) calculation for each feed

**Solution**: Maintain `unread_count` field in `feeds` table, update incrementally

**Implementation**:
```sql
-- Add/update trigger on read_articles
CREATE OR REPLACE FUNCTION update_unread_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE feeds
    SET unread_count = unread_count - 1
    WHERE id = NEW.feed_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE feeds
    SET unread_count = unread_count + 1
    WHERE id = OLD.feed_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

**Expected**: O(n) → O(1) for list API

---

### Priority 2: Article Content Lazy Load

**Problem**: List page loads full article content

**Solution**: Only load `index.json` for list, load full content on detail view

**Current**:
```typescript
// getArticlesForFeed loads full content for ALL articles
const fullArticle = await this.repo.getArticle(urlHash, article.hash);
```

**Expected**: List API returns only index data, detail API loads content

---

### Priority 3: Pagination Support

**Problem**: `/api/feeds/[id]/articles` returns all articles

**Solution**: Add `limit` and `offset` parameters

**Implementation**:
```typescript
// In repository
async getArticlesForFeed(feedId, urlHash, page = 1, limit = 20) {
  const index = await this.repo.getIndex(urlHash);
  const start = (page - 1) * limit;
  const pagedArticles = index.articles.slice(start, start + limit);
  // Load full content only for paged articles
}
```

---

### Priority 4: Index Compression (Optional)

**Problem**: `index.json` grows large for active feeds

**Solutions**:
1. Gzip compression (transparent to app)
2. Switch to SQLite for indexing
3. Implement article archival (move old to `archives/`)

---

## 7. Test Coverage

Current unit test structure by layer:

| Layer | Test File | Coverage |
|-------|-----------|----------|
| Fetch | `rss.test.ts` | Hash generation, file naming |
| Fetch | `feed-fetcher.test.ts` | Article hash, data conversion |
| Storage | `article-repository.test.ts` | File CRUD operations |
| DB | `read-status-service.test.ts` | Read status CRUD |
| View Model | `article-view-model.test.ts` | Data aggregation |

**Total**: 70 test cases passing (using Bun test)

---

## 8. Summary

| Aspect | Current State | Target State |
|--------|---------------|--------------|
| Storage | Hybrid (DB + File) | Same |
| Article Index | index.json (1000 limit) | Add pagination |
| Unread Count | Real-time O(n) | Cached O(1) |
| Content Loading | All at once | Lazy load |
| Test Coverage | 70 cases (Bun) | Expand for new features |

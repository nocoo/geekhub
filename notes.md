# Notes: GeekHub Database Migration

## Schema 设计参考

### 新表结构概览

```sql
-- 1. articles (文章内容)
CREATE TABLE articles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feed_id         UUID REFERENCES feeds(id) ON DELETE CASCADE NOT NULL,
  hash            TEXT NOT NULL,
  title           TEXT NOT NULL,
  url             TEXT NOT NULL,
  link            TEXT,
  author          TEXT,
  published_at    TIMESTAMPTZ NOT NULL,
  content         TEXT,
  content_text    TEXT,
  summary         TEXT,
  categories      TEXT[],
  tags            TEXT[],
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(feed_id, hash)
);

-- 2. feed_cache (抓取状态缓存)
CREATE TABLE feed_cache (
  feed_id                 UUID PRIMARY KEY REFERENCES feeds(id) ON DELETE CASCADE,
  last_fetch_at           TIMESTAMPTZ,
  last_success_at         TIMESTAMPTZ,
  last_fetch_status       TEXT,
  last_fetch_error        TEXT,
  last_fetch_duration_ms  INTEGER,
  total_articles          INTEGER DEFAULT 0,
  unread_count            INTEGER DEFAULT 0,
  next_fetch_at           TIMESTAMPTZ
);

-- 3. fetch_history (抓取历史)
CREATE TABLE fetch_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feed_id         UUID REFERENCES feeds(id) ON DELETE CASCADE NOT NULL,
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status          TEXT NOT NULL,
  duration_ms     INTEGER,
  articles_found  INTEGER,
  articles_new    INTEGER,
  error_message   TEXT
);

-- 4. user_articles (用户操作统一表)
CREATE TABLE user_articles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  article_id      UUID REFERENCES articles(id) ON DELETE CASCADE NOT NULL,
  is_read         BOOLEAN DEFAULT FALSE,
  is_bookmarked   BOOLEAN DEFAULT FALSE,
  is_read_later   BOOLEAN DEFAULT FALSE,
  read_at         TIMESTAMPTZ,
  bookmarked_at   TIMESTAMPTZ,
  read_later_at   TIMESTAMPTZ,
  notes           TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, article_id)
);
```

### 关键设计决策

| 决策 | 理由 |
|------|------|
| articles.feed_id + hash 唯一 | hash 是 MD5(url|title|published_at) |
| feed_cache 独立表 | 将缓存与数据分离，feeds 表只存配置 |
| user_articles 三状态统一 | 避免三个表结构重复 |
| fetch_history 独立表 | 可选，用于监控和调试 |
| feed_id 冗余消除 | 通过 article_id 关联，无需重复存储 |

---

## 迁移脚本结构

### migrate-articles.ts

```typescript
// 1. 扫描所有 feeds
for (const feedHash of feedHashes) {
  // 2. 读取所有文章文件
  const articles = await readArticleFiles(feedHash);

  // 3. 批量插入数据库
  await supabase.from('articles').insert(articles);

  // 4. 进度显示
  console.log(`Migrated ${articles.length} articles for ${feedHash}`);
}
```

### migrate-user-articles.ts

```typescript
// 1. 迁移 read_articles
const readArticles = await supabase.from('read_articles').select('*');
await supabase.from('user_articles').insert(
  readArticles.map(ra => ({
    user_id: ra.user_id,
    article_id: await getArticleId(ra.article_hash),
    is_read: true,
    read_at: ra.read_at
  }))
);

// 2. 迁移 bookmarked_articles
// 3. 迁移 read_later_articles
```

### migrate-feed-cache.ts

```typescript
// 1. 读取所有 feeds
const feeds = await supabase.from('feeds').select('*');

// 2. 读取 cache.json
for (const feed of feeds) {
  const cache = await readCacheFile(feed.url_hash);
  await supabase.from('feed_cache').upsert({
    feed_id: feed.id,
    last_fetch_at: cache.last_fetch,
    // ...
  });
}

// 3. 计算统计数据 (重新计算)
for (const feed of feeds) {
  const stats = await calculateStats(feed.id);
  await supabase.from('feed_cache').update(stats).eq('feed_id', feed.id);
}
```

---

## 双写模式实现

### feed-fetcher.ts 修改

```typescript
async saveArticle(article: ArticleData, hash: string): Promise<void> {
  // 文件系统写入 (保留)
  await fs.writeFile(articlePath, JSON.stringify(articleData, null, 2), 'utf-8');

  // 数据库写入 (新增)
  if (process.env.DUAL_WRITE_MODE === 'true') {
    await supabase.from('articles').insert({
      feed_id: this.feed.id,
      hash: hash,
      title: article.title,
      // ...
    });
  }
}
```

### 双读模式实现

```typescript
class ArticleRepository {
  async getArticle(urlHash: string, hash: string): Promise<ArticleRaw | null> {
    // 优先从数据库读取
    if (process.env.DB_READ_MODE === 'db' || process.env.DB_READ_MODE === 'dual') {
      try {
        return await this.getFromDB(hash);
      } catch (error) {
        console.warn('DB read failed, falling back to FS', error);
        if (process.env.DB_READ_MODE === 'dual') {
          return await this.getFromFileSystem(urlHash, hash);
        }
      }
    }

    // 回退到文件系统
    return await this.getFromFileSystem(urlHash, hash);
  }
}
```

---

## 数据一致性检查

### 验证脚本

```bash
# 检查文章数量
echo "FS articles: $(find data/feeds/*/articles -name '*.json' | wc -l)"
echo "DB articles: $(psql -c 'SELECT COUNT(*) FROM articles;')"

# 检查用户状态
echo "read_articles: $(psql -c 'SELECT COUNT(*) FROM read_articles;')"
echo "user_articles read: $(psql -c 'SELECT COUNT(*) FROM user_articles WHERE is_read = true;')"
```

---

## 回退策略

1. **快速回退**: 设置环境变量 `DB_READ_MODE=fs`
2. **数据备份**: 迁移前备份 `data/` 目录
3. **保留期**: 文件系统数据保留 30 天

---

## 性能考虑

### 预期数据量

- 当前: ~45 feeds, ~3,185 articles, ~29 MB
- 预计一年: ~100 feeds, ~50,000 articles, ~500 MB

### 索引策略

```sql
-- 高频查询优化
CREATE INDEX idx_articles_feed_published ON articles(feed_id, published_at DESC);
CREATE INDEX idx_user_articles_read ON user_articles(user_id, is_read) WHERE is_read = TRUE;
```

### 批量操作

```typescript
// 使用批量插入提升性能
await supabase.from('articles').insert(articlesBatch); // 每次 100-500 条
```

---

## 待解决问题

1. **article_hash → article_id 映射**: 迁移 user_articles 时需要
2. **统计数据更新频率**: 实时更新 vs 定时批量
3. **fetch_history 保留策略**: 保留多久？是否需要归档？

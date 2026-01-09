# GeekHub RSS 文件存储结构设计

## 目录结构

```
data/
├── feeds/
│   ├── {url_hash}/          # 每个 RSS 源一个文件夹（使用 URL 的 MD5 前12位）
│   │   ├── meta.json        # RSS 源元数据
│   │   ├── articles/        # 文章存储目录
│   │   │   ├── 2026/        # 按年份分组
│   │   │   │   ├── 01/      # 按月份分组
│   │   │   │   │   ├── {article_hash}.json  # 单篇文章
│   │   │   │   │   └── ...
│   │   │   │   └── ...
│   │   │   └── ...
│   │   ├── index.json       # 文章索引（最近1000篇）
│   │   └── cache.json       # RSS 抓取缓存
│   └── ...
├── users/
│   └── {user_id}/
│       ├── read_cache.json      # 已读文章缓存
│       ├── bookmarks.json       # 收藏文章缓存
│       └── preferences.json     # 用户偏好设置
└── logs/
    ├── fetch.log            # RSS 抓取日志
    └── error.log            # 错误日志
```

## 文件格式说明

### 1. RSS 源元数据 (`data/feeds/{url_hash}/meta.json`)

```json
{
  "id": "feed-uuid",
  "url": "https://hnrss.org/newest?points=100",
  "url_hash": "0055c44846cb",
  "title": "Hacker News",
  "description": "Latest Hacker News stories with 100+ points",
  "site_url": "https://news.ycombinator.com",
  "favicon_url": "https://news.ycombinator.com/favicon.ico",
  "language": "en",
  "last_build_date": "2026-01-10T10:30:00Z",
  "last_fetched_at": "2026-01-10T10:30:00Z",
  "last_success_at": "2026-01-10T10:30:00Z",
  "fetch_interval_minutes": 60,
  "total_articles": 1250,
  "etag": "\"abc123def456\"",
  "last_modified": "Wed, 10 Jan 2026 10:30:00 GMT"
}
```

### 2. 文章索引 (`data/feeds/{url_hash}/index.json`)

```json
{
  "last_updated": "2026-01-10T10:30:00Z",
  "total_count": 1250,
  "articles": [
    {
      "hash": "a1b2c3d4e5f6",
      "title": "Article Title",
      "url": "https://example.com/article",
      "published_at": "2026-01-10T09:00:00Z",
      "author": "John Doe",
      "file_path": "2026/01/a1b2c3d4e5f6.json",
      "summary": "Article summary..."
    }
  ]
}
```

### 3. 单篇文章 (`data/feeds/{url_hash}/articles/2026/01/{article_hash}.json`)

```json
{
  "hash": "a1b2c3d4e5f6",
  "title": "Article Title",
  "url": "https://example.com/article",
  "author": "John Doe",
  "published_at": "2026-01-10T09:00:00Z",
  "updated_at": "2026-01-10T09:15:00Z",
  "content": "Full article content in HTML or markdown",
  "content_text": "Plain text version of content",
  "summary": "Article summary",
  "tags": ["technology", "programming"],
  "categories": ["Tech News"],
  "enclosures": [
    {
      "url": "https://example.com/audio.mp3",
      "type": "audio/mpeg",
      "length": 1024000
    }
  ],
  "images": [
    {
      "url": "https://example.com/image.jpg",
      "title": "Image title",
      "width": 800,
      "height": 600
    }
  ],
  "word_count": 1250,
  "reading_time_minutes": 5,
  "fetched_at": "2026-01-10T10:30:00Z"
}
```

### 4. RSS 抓取缓存 (`data/feeds/{url_hash}/cache.json`)

```json
{
  "last_fetch": "2026-01-10T10:30:00Z",
  "etag": "\"abc123def456\"",
  "last_modified": "Wed, 10 Jan 2026 10:30:00 GMT",
  "status": "success",
  "error": null,
  "fetch_duration_ms": 1250,
  "articles_found": 25,
  "articles_new": 3,
  "next_fetch": "2026-01-10T11:30:00Z"
}
```

### 5. 用户已读缓存 (`data/users/{user_id}/read_cache.json`)

```json
{
  "last_updated": "2026-01-10T10:30:00Z",
  "read_articles": {
    "feed_uuid_1": [
      "article_hash_1",
      "article_hash_2"
    ],
    "feed_uuid_2": [
      "article_hash_3"
    ]
  }
}
```

## Hash 生成规则

### URL Hash (用于文件夹命名)
```javascript
function generateUrlHash(url) {
  return crypto.createHash('md5').update(url).digest('hex').substring(0, 12);
}

// 示例
// URL: "https://hnrss.org/newest?points=100"
// Hash: "0055c44846cb"
// 文件夹: data/feeds/0055c44846cb/
```

### 文章 Hash (用于文件命名)
```javascript
function generateArticleHash(article) {
  const content = `${article.url}|${article.title}|${article.published_at}`;
  return crypto.createHash('md5').update(content).digest('hex');
}

// 示例
// Content: "https://example.com/article|Article Title|2026-01-10T09:00:00Z"
// Hash: "a1b2c3d4e5f67890abcdef1234567890"
// 文件: data/feeds/0055c44846cb/articles/2026/01/a1b2c3d4e5f67890abcdef1234567890.json
```

## 检索优化策略

### 1. 内存缓存
- 热门 RSS 源的 index.json 保持在内存中
- 用户的已读状态缓存在内存中
- 最近访问的文章缓存在内存中

### 2. 文件系统优化
- 按年月分组避免单个目录文件过多
- 使用 hash 作为文件名实现 O(1) 查找
- index.json 提供快速文章列表访问

### 3. 数据库索引
- url_hash 字段建立唯一索引
- user_id + article_hash 复合索引用于已读状态
- 分类和时间字段建立索引

## API 设计示例

### 获取 RSS 源文章列表
```
GET /api/feeds/{feed_id}/articles?page=1&limit=20&unread_only=true
```

### 获取单篇文章内容
```
GET /api/articles/{article_hash}?feed_id={feed_id}
```

### 标记文章已读
```
POST /api/articles/{article_hash}/read
```

### 收藏文章
```
POST /api/articles/{article_hash}/bookmark
```

这种设计既保证了数据的快速检索，又避免了数据库存储大量文章内容的问题。
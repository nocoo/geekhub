# API 参考

> 返回 [README](../README.md)

本文档详细介绍 GeekHub 的 36 个 API 端点。

---

## 目录

- [认证](#认证)
- [订阅源管理](#订阅源管理)
- [分类管理](#分类管理)
- [文章操作](#文章操作)
- [AI 功能](#ai-功能)
- [数据管理](#数据管理)
- [系统功能](#系统功能)

---

## 认证

所有 API 需要通过 Supabase Auth 认证。请求头需包含：

```
Authorization: Bearer <access_token>
```

未认证请求将返回 `401 Unauthorized`。

---

## 订阅源管理

### 列出所有订阅源

```http
GET /api/feeds/list
```

**响应示例：**

```json
{
  "feeds": [
    {
      "id": "uuid",
      "title": "Example Blog",
      "url": "https://example.com/rss",
      "unread_count": 5,
      "category_id": "uuid"
    }
  ]
}
```

---

### 创建订阅源

```http
POST /api/feeds
Content-Type: application/json

{
  "url": "https://example.com/rss",
  "title": "Example Blog",
  "category_id": "uuid"  // 可选
}
```

**响应：** `201 Created`

```json
{
  "id": "uuid",
  "title": "Example Blog",
  "url": "https://example.com/rss"
}
```

---

### 获取单个订阅源

```http
GET /api/feeds/{id}
```

---

### 更新订阅源

```http
PATCH /api/feeds/{id}
Content-Type: application/json

{
  "title": "New Title",
  "category_id": "uuid",
  "fetch_interval": 60,
  "auto_translate": true
}
```

---

### 删除订阅源

```http
DELETE /api/feeds/{id}
```

**响应：** `204 No Content`

---

### 获取订阅源文章

```http
GET /api/feeds/{id}/articles?page=1&limit=20
```

**查询参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | number | 1 | 页码 |
| `limit` | number | 20 | 每页数量 |
| `unread_only` | boolean | false | 仅未读 |

---

### 手动抓取订阅源

```http
POST /api/feeds/{id}/fetch
```

触发立即抓取订阅源的最新文章。

**响应：**

```json
{
  "success": true,
  "new_articles": 3
}
```

---

### 标记全部已读

```http
POST /api/feeds/{id}/mark-all-read
```

将订阅源下所有文章标记为已读。

---

### 获取抓取日志

```http
GET /api/feeds/{id}/logs?limit=50
```

获取订阅源的抓取历史日志。

---

### 设置自动翻译

```http
PATCH /api/feeds/{id}/auto-translate
Content-Type: application/json

{
  "enabled": true
}
```

---

### 获取收藏文章

```http
GET /api/feeds/starred/articles
```

获取所有收藏的文章。

---

### 获取稍后阅读

```http
GET /api/feeds/later/articles
```

获取所有标记为"稍后阅读"的文章。

---

## 分类管理

### 列出所有分类

```http
GET /api/categories
```

**响应：**

```json
{
  "categories": [
    {
      "id": "uuid",
      "name": "技术",
      "icon": "💻",
      "color": "#3b82f6",
      "sort_order": 0,
      "feed_count": 5
    }
  ]
}
```

---

### 创建分类

```http
POST /api/categories
Content-Type: application/json

{
  "name": "新分类",
  "icon": "📁",
  "color": "#10b981"
}
```

---

### 更新分类

```http
PATCH /api/categories/{id}
Content-Type: application/json

{
  "name": "Updated Name",
  "icon": "🔧",
  "color": "#ef4444"
}
```

---

### 删除分类

```http
DELETE /api/categories/{id}
```

删除分类时，其下的订阅源将变为未分类。

---

## 文章操作

### 标记已读

```http
POST /api/articles/{id}/read
```

---

### 标记未读

```http
POST /api/articles/{id}/unread
```

---

### 收藏/取消收藏

```http
POST /api/articles/{id}/bookmark
Content-Type: application/json

{
  "bookmarked": true
}
```

---

### 稍后阅读

```http
POST /api/articles/{id}/read-later
Content-Type: application/json

{
  "read_later": true
}
```

---

### 获取完整内容

```http
GET /api/articles/{id}/fetch-full
```

从原网页抓取完整内容（用于 RSS 只提供摘要的情况）。

---

## AI 功能

### 生成摘要

```http
POST /api/ai/summarize
Content-Type: application/json

{
  "article_id": "uuid"
}
```

**响应：**

```json
{
  "summary": "这篇文章讨论了..."
}
```

---

### 翻译标题

```http
POST /api/ai/translate
Content-Type: application/json

{
  "text": "Hello World",
  "target_lang": "zh"
}
```

---

### 翻译内容

```http
POST /api/ai/translate-content
Content-Type: application/json

{
  "article_id": "uuid",
  "target_lang": "zh"
}
```

返回翻译后的文章内容。

---

### 验证 AI 配置

```http
POST /api/ai/validate
Content-Type: application/json

{
  "api_key": "sk-xxx",
  "base_url": "https://api.openai.com/v1",
  "model": "gpt-4o-mini"
}
```

验证 AI 配置是否有效。

---

## 数据管理

### 获取统计信息

```http
GET /api/data/stats
```

**响应：**

```json
{
  "total_feeds": 25,
  "total_articles": 1234,
  "unread_articles": 56,
  "storage_size_mb": 128
}
```

---

### 获取存储信息

```http
GET /api/data/storage
```

获取详细的存储使用情况。

---

### 清理缓存

```http
POST /api/data/cleanup
Content-Type: application/json

{
  "type": "translation_cache"  // 或 "image_cache"
}
```

---

### 清理旧文章

```http
POST /api/data/cleanup-articles
Content-Type: application/json

{
  "older_than_days": 30,
  "only_read": true
}
```

删除指定天数之前的已读文章。

---

### 导出订阅源

```http
GET /api/data/feeds
Accept: application/xml
```

导出 OPML 格式的订阅列表。

---

### 获取文件列表

```http
GET /api/data/files
```

获取数据目录的文件列表。

---

### 获取日志

```http
GET /api/data/logs?level=error&limit=100
```

获取系统日志。

---

## 系统功能

### 健康检查

```http
GET /api/health
```

**响应：**

```json
{
  "status": "ok",
  "database": "connected",
  "version": "0.1.0"
}
```

---

### 数据健康检查

```http
GET /api/data/health
```

检查数据目录和数据库的健康状态。

---

### 图片代理

```http
GET /api/image-proxy?url=https://example.com/image.jpg
```

代理外部图片，绕过防盗链。

---

### 代理测试

```http
GET /api/test-proxy
```

测试代理配置是否正常工作。

---

### RSS 导入

```http
POST /api/rss
Content-Type: multipart/form-data

file: <opml_file>
```

从 OPML 文件批量导入订阅源。

---

### 实时日志流

```http
GET /api/logs/stream
Accept: text/event-stream
```

SSE 端点，实时推送抓取日志。

**事件格式：**

```
event: log
data: {"level":"info","message":"Fetching feed...","timestamp":"2026-01-13T12:00:00Z"}
```

---

### 获取日志

```http
GET /api/logs?level=info&limit=50
```

获取最近的日志记录。

---

### 博客推荐

```http
GET /api/blogs?category=tech&limit=10
```

获取推荐的博客列表。

---

## 错误响应

所有 API 在发生错误时返回统一格式：

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}  // 可选
}
```

**常见错误码：**

| HTTP 状态 | 错误码 | 说明 |
|-----------|--------|------|
| 400 | `BAD_REQUEST` | 请求参数错误 |
| 401 | `UNAUTHORIZED` | 未认证 |
| 403 | `FORBIDDEN` | 无权限 |
| 404 | `NOT_FOUND` | 资源不存在 |
| 429 | `RATE_LIMITED` | 请求过于频繁 |
| 500 | `INTERNAL_ERROR` | 服务器错误 |

---

## 相关文档

- [数据库设计](06-database.md) - 表结构详情
- [架构设计](01-architecture.md) - 系统架构
- [开发指南](03-development.md) - 本地开发

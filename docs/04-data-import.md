# 历史 CSV 导入

2026-09-12 将 Downloads 中三个导出文件导入日常本地 Wrangler SQLite 和生产 D1 `geekhub-db`。这些 CSV 只包含目录与订阅结构，不包含旧文章和阅读状态；文章由新 Worker 重新抓取。

| 文件 | 导入数量 | 内容 |
| --- | --- | --- |
| `blogs_rows.csv` | 1,384 | 精选博客名称、站点、RSS、标签、评分与时间元数据 |
| `categories_rows.csv` | 7 | 自定义分类及颜色、图标、排序 |
| `feeds_rows.csv` | 45 | 订阅、分类关系、描述、刷新间隔、自动翻译与启停 |

45 个订阅中有 8 个 `rsshub://` 路由，全部保留，由抓取时的 RSSHub 实例设置解析。旧 `user_id` 不导入、不用作过滤条件，Access subject 的变化不会产生另一份空阅读库。

目录中 128 个博客没有提供 RSS；另一个 `小吴乐意blog` 的原地址 `http://xiaowuleyi/feed` 缺少公开域名。全部博客记录都保留：不可用 RSS 在 UI 中禁用订阅，原始值保留在 `directory.source_feed_url`，不猜测或改写地址。对应站点仍可访问。可用 RSS 共 1,255 个。

旧 `url_hash` 用于文件缓存，在 D1 中不再需要；旧账号字段和 favicon 缓存地址也不作为新系统的身份或缓存来源。分类与订阅 ID 保持原值。

## 可重复执行

```sh
bun run db:import /Users/nocoo/Downloads --check
bun run db:import /Users/nocoo/Downloads --local
bun run db:import /Users/nocoo/Downloads --remote
```

先用 Python 标准 CSV 解析器处理 BOM、引号与跨行字段，再用 TypeScript 校验字段、公开 URL、重复 ID／名称／订阅地址、分类外键和时间。订阅出现无效 URL 或悬空分类时整批停止。SQL 字符串按 SQLite 规则转义；插入按原 ID upsert，重复导入会更新订阅元数据，保留文章及阅读状态。仅替换五个内置发现示例，不清空现有订阅。

原 CSV 不进入版本库。每次写入保存 SQL、源文件摘要、目标与结果到 `.wrangler/imports/<时间>/`；此目录被 Git 忽略。生产导入要求明确 `--remote`，测试环境拒绝运行该维护脚本。

## 源文件 SHA-256

```text
blogs_rows.csv
20174523bb8bd10ba3aca2ec20c18c1395a1fb8cb2f1e0f09d52a5ac78b36c57

categories_rows.csv
dc5e89eff0cae57be8354ffccaff9c109356f09a39f6a7c99716ced07d2c1b2b

feeds_rows.csv
b92a48febce384b630c10078dbba5edbb56018c65e1bb41b2b8011f3a2c40484
```

两端均核对目录／分类／订阅数量；生产 `PRAGMA foreign_key_check` 返回空结果。早期多用户示例 SQLite 已保存为 `.wrangler/state-before-single-user-20260911T220616Z/`，避免覆盖此前本地状态。

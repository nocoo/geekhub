# Changelog

## v1.2.0 — 2026-09-12

- 将 v0.2.2 Next.js / Supabase 实现与旧文档分别归档到 `archieve/`、`docs/archieve/`。
- 使用 Vite、React、TypeScript 7.0.2、Biome 和 Basalt 2.1.7 重写阅读界面。
- 侧栏版本与健康接口统一读取根 package.json；左下角使用 Basalt 头像并接入 lizheng.blog 公开资料服务。
- Activity 移到顶栏右侧按钮组前，单行显示最新抓取状态，点击打开订阅加载详情。
- 统一迁移到 Cloudflare Worker + Hono + D1；使用 Queues 和 Cron 更新订阅。
- 使用 Cloudflare Access 验证签名、issuer、audience；采用单用户共享阅读数据。
- 接入 next-ai 公共设置组件与服务端配置，支持摘要和翻译，AI 密钥使用 AES-GCM 加密。
- 导入 1,384 个精选博客、7 个分类和 45 个订阅；保留旧分类关系及 RSSHub 路由。
- 建立本地 Wrangler SQLite 测试隔离、95% 四项覆盖率门槛、HTTP／浏览器测试及安全门。
- 本地域名 `geekhub.dev.hexly.ai`，端口 7005；L2 17005、L3 27005，无远程测试资源。

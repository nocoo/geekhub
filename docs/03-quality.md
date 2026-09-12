# 6DQ 质量证据

v1.2.1 的侧栏搜索、导航留白与两行文章头部已完成完整 6DQ，最新记录见 [侧栏与文章头部](06-sidebar-layout.md)。以下保留 v1.2.0 重写与首次上线的证据。

2026-09-12 完成 v1.2.0 的单用户实现、CSV 导入、Basalt 头像和顶栏 Activity 后运行 `bun run quality`，退出码 **0**。完整记录：[quality.log](evidence/quality.log)。

| 维度 | 检查 | 结果 |
| --- | --- | --- |
| G1 | TypeScript 7.0.2 strict + Biome | 通过，零警告 |
| L1 | Vitest + Node SQLite + V8 coverage | 71 项通过；四项均 ≥95% |
| L2 | 真实 HTTP → 本地 workerd → 独立 Wrangler SQLite | 64 项检查，覆盖 29/29 API endpoints |
| L3 | Playwright，桌面 Chromium + Pixel 7 视口 | 8 项通过；包含 WCAG 2 A／AA、2.1 AA 检查 |
| G2 | gitleaks 8.30.1 + OSV 2.5.1 | 无凭据泄漏；453 个依赖包无已知漏洞 |
| D1 隔离 | 本地 bindings、runtime、SQLite marker、清理守卫 | 通过；没有远程 `-test` 资源 |

## L1 范围

| 指标 | 覆盖率 |
| --- | --- |
| Statements | 99.70% |
| Branches | 97.57% |
| Functions | 100% |
| Lines | 100% |

统计范围为所有 `src/worker/**/*.ts`、`src/shared/**/*.ts` 和 `src/web/lib/**/*.ts`。JSX 是视图与查询编排，按薄视图规则由 L3 验证，不计入 L1 分母；历史归档不计入新系统覆盖率。没有跳过测试或降低门槛。报告：[coverage-summary.json](evidence/coverage-summary.json)。

关键检查包括：真实签名的 Access JWT、伪造／过期／错误 issuer 或 audience、拒绝单独邮箱 header；不同已验证 subject 共用阅读库；状态和偏好的并发局部更新；RSS／Atom、HTML 清理、跳转与响应体限制；Queue 租约、重试、去重；AI SDK 请求格式、凭据加密、端点更换后的密钥清除；CSV 外键、重复数据、无效 RSS 和重复导入时保留文章状态。

AI L1 使用真实 SDK 配合 HTTP transport fixture，L2／L3 使用本地明确标记的模拟输出。没有在生产调用付费模型，不声称真实服务商密钥已验证。

## L2／L3 与数据隔离

测试不会直接调用 Hono handler 替代 HTTP。Harness 新建 `.wrangler/tests/<层级>-<随机值>`，检查配置无远程 binding、route 和开发目录共用；创建 `_test_marker` 后才 seed。启动本地 Worker 时注入 `RESOURCE_ENV=test`，每次 API 请求验证运行环境与数据库标记。结束后再次验证标记，只删除本轮目录。

L2 覆盖分类／订阅 CRUD、Queue 消费、全部阅读状态、分页、搜索、清理、偏好和 AI；自动枚举路由，避免新增 endpoint 后遗漏。L3 覆盖阅读、持久化、摘要／翻译、原文、管理、主题、next-ai 面板、日志、发现和移动端导航。

测试端口为 17005／27005，Vite 优化缓存也使用各轮测试目录；日常 7005 的导入数据和模块缓存不会被测试覆盖。开发环境还通过受信的 Caddy HTTPS 做了浏览器实测，实际导入目录及阅读页面无脚本错误：[本地阅读截图](evidence/local-reader.png)、[Activity 详情](evidence/local-activity.png)。移动端验证弹层关闭、顶栏 Activity 单行与按钮顺序，以及侧栏版本显示。

## 安全与归档

gitleaks 扫描受 Git 管理及待加入的文件，也覆盖旧代码／文档归档；忽略真实本地环境文件、SQLite、依赖目录和构建产物。只对已核实的非凭据做精确路径／内容允许项：历史文档中的 `YOUR_TOKEN`、截断 JWT 示例，以及生产配置中的公开 Access audience。真实密钥不在允许项中。

归档校验将 209 个文件与旧提交 `d8d225b` 按字节比较，差异为 0。其中 202 个源文件及文档进入 Git，7 个 Supabase `.temp` 生成文件保留在本地归档并由 Git 忽略。生产浏览器 bundle 未包含 AI 服务端入口、AI SDK 工厂或加密密钥 binding。

## 导入与发布

本地和生产均包含 7 个分类、45 个订阅、1,384 个精选博客；45 个订阅的 ID、URL、分类、自动翻译和刷新间隔逐项匹配 CSV。生产外键检查无异常：[data-import.json](evidence/data-import.json)。

**v1.2.0 已部署**，Worker 版本 `d0b17247-75f3-431e-9c57-0eaf134bb993`，版本标签 `v1.2.0`。生产域名 `geekhub.hexly.ai` 已绑定并启用；D1、队列、Cron 和加密 secret binding 已核对。`workers.dev` 与 preview URL 保持关闭。部署详情：[deployment.json](evidence/deployment.json)。

生产 HTTP 验证：`/api/live` 返回 200、`status=ok`、`version=1.2.0` 和 `storage=d1`；未登录访问首页、会话 API、图片和 JS 均跳转 `nocoo.cloudflareaccess.com`，audience 与配置一致。Cloudflare 和 Google 公共 DNS 均返回新站地址；本机尚有删除记录期间的 NXDOMAIN 缓存，因此验证使用公共解析地址配合 `curl --resolve`，保留域名与 TLS 证书验证。证据：[production-smoke.json](evidence/production-smoke.json)。本次没有可用的生产登录会话，登录后的阅读流程由本地 L3 和真实签名 JWT 测试验证。

[CI 工作流](../.github/workflows/ci.yml) 使用独立本地质量与 HTTP／浏览器任务，[运行结果](https://github.com/nocoo/geekhub/actions/workflows/ci.yml)以 GitHub Actions 为准。Git hooks 保留：pre-commit 执行 G1 + L1，pre-push 执行 L2 + G2。

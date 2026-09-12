# v1.2.1 侧栏与文章头部

2026-09-12 将搜索移到 Basalt 侧栏品牌下方，使用 `SidebarSearch`，折叠后使用 `SidebarIconItem`。点击或按 `/` 打开搜索框，回车查询当前阅读范围；手机提交后关闭侧栏并显示结果列表。搜索可取消，结果可一键清除。

“你的阅读空间”使用 `SidebarPartition`，四个导航项的外层左右各留 12px，与 `SidebarGroup` 对齐。折叠时导航显示图标与提示，左下角保留头像及管理入口。

文章列表头部保留两行：标题与“全部标为已读”图标、更新／搜索状态与文章数。移除列表上方的标语、说明和搜索输入框，长标题与搜索词截断显示。

## 浏览器实测

在 `https://geekhub.dev.hexly.ai` 使用实际导入的本地数据验证，没有重建开发 SQLite。

| 项目 | 桌面 1440px | Pixel 7 |
| --- | --- | --- |
| 列表头部高度 | 79px | 79px |
| 导航项左／右留白 | 12px / 12px | 12px / 12px |
| 搜索自动聚焦与清除 | 通过 | 通过 |
| 横向溢出／脚本错误 | 无 | 无 |

测量记录：[layout.json](evidence/v1.2.1/layout.json)。截图：[桌面](evidence/v1.2.1/sidebar-desktop.png)、[折叠侧栏](evidence/v1.2.1/sidebar-collapsed.png)、[手机侧栏](evidence/v1.2.1/sidebar-mobile.png)、[搜索](evidence/v1.2.1/search-desktop.png)、[手机搜索](evidence/v1.2.1/search-mobile.png)、[手机结果](evidence/v1.2.1/results-mobile.png)。

## 6DQ

`bun run quality` 退出码 0。完整日志：[quality.log](evidence/v1.2.1/quality.log)。

- G1：TypeScript strict 与 Biome 通过，零警告。
- L1：71 项通过；statements 99.70%、branches 97.57%、functions / lines 100%。[覆盖率](evidence/v1.2.1/coverage-summary.json)。
- L2：64 项真实 HTTP 检查，29/29 API endpoints，使用独立本地 Wrangler SQLite。
- L3：桌面与手机共 8 项通过，包括从阅读详情发起搜索、手机展示搜索结果、折叠搜索入口、`/`、取消、清除和 axe。
- G2：gitleaks 无泄漏，OSV 检查 453 个依赖包，无已知漏洞。

测试只使用每轮独立的本地 Worker 与 SQLite，没有远程测试资源。

## 生产发布

v1.2.1 已部署到 `https://geekhub.hexly.ai`，Worker 版本 `2999100a-4a99-4189-b06d-d598503a2ac7`，标签 `v1.2.1`。部署前确认没有待执行的 D1 迁移，队列和 Cron 正常保留。详情：[deployment.json](evidence/v1.2.1/deployment.json)。

生产 `/api/live` 返回 200、`status=ok`、`version=1.2.1`、`storage=d1`；首页、会话 API、图片、新 JS 和 CSS 均跳转 `nocoo.cloudflareaccess.com`，Access audience 与配置一致。验证使用公共 DNS 地址和正常 TLS 校验。证据：[production-smoke.json](evidence/v1.2.1/production-smoke.json)。

本次没有已登录的生产浏览器会话；阅读与搜索交互由本地真实 HTTP 和桌面／手机 L3 验证。

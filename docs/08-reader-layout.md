# 阅读排版与侧栏操作

2026-09-19，本地实现与验证。预览地址：`https://geekhub.dev.hexly.ai`。本轮未部署生产。

## 字体依据

[潮流周刊第 282 期](https://weekly.tw93.fun/posts/282) 的 `--font-fallback` 使用 `TsangerJinKai02`，通过 `/fonts/jinkai.css` 加载 W04 字重的 WOFF2 分片。[Kami](https://github.com/tw93/Kami) 的中文模板同样使用仓耳今楷 02，英文采用 Charter。

阅读器默认的长文字体改为仓耳今楷，英文优先使用系统 Charter；标题和正文保持同一字体层级。界面控件继续使用系统无衬线，代码使用等宽字体；原有无衬线偏好仍可选择。正文默认 18px、1.65 倍行高。

字体的 97 个原始分片共 4,287,644 字节，放在 `public/fonts/jinkai/`；Unicode 范围不变，浏览器仅加载文章涉及的分片，使用 `font-display: swap`。运行时不请求第三方字体服务，不改变 `font-src 'self'`。Chrome 对中文长文的实际字体检查确认：中文由 `TsangerJinKai02-W04` 绘制，英文由 Charter 绘制；该样例请求 20 个分片，全部成功。

字体权利属于仓耳，不适用代码的 MIT 授权。Kami 标明个人使用免费、商业使用需仓耳授权；本项目为个人单用户阅读器。来源与条款链接见 [字体说明](../public/fonts/jinkai/NOTICE.md)。

## 布局

阅读区域采用原生 CSS container query。实际可用宽度达到 820px 时，标题、来源、作者、日期、原文链接和 AI 操作放在左侧信息栏；正文从同一高度开始，行宽不超过 680px。窄屏保持紧凑的上下排列，不挤压正文。折叠导航后也能依据新增空间自动切换。

全站收紧导航、文章卡片、工具栏、弹窗、表单、订阅卡、分类、诊断、日志和正文段落的纵向间距。手机设置保留短字段并排，标签栏单行滚动。桌面订阅卡将状态与操作放在同一行。Lucide 图标沿用 Basalt 色彩：阅读绿、信息蓝、订阅橙、收藏金、稍后阅读与 AI 紫、发现玫红；文字标签、图标形状与选中状态同时保留。

相同视口与内容的测量：

| 项目 | 原来 | 现在 |
| --- | ---: | ---: |
| 桌面正文起点 | 477.8px | 134.4px |
| 桌面首篇文章卡高度 | 179.3px | 139.1px |
| 桌面订阅卡高度 | 150.3px | 96.3px |
| 手机阅读设置内容高度 | 947px | 673px |
| 手机正文起点 | 507.6px | 426.8px |

桌面为 1440×900，手机为 390×844。中文长文另检查 390、768、1024、1440、1920px 宽度，含深色模式；宽屏正文起点为 120px。截图：[桌面](evidence/reader-layout/reader-desktop.png)、[宽屏深色](evidence/reader-layout/reader-wide-dark.png)、[手机](evidence/reader-layout/reader-mobile.png)、[阅读设置](evidence/reader-layout/settings-mobile.png)、[订阅卡](evidence/reader-layout/subscriptions-desktop.png)。

## 订阅右键菜单

侧栏的已分类、未分类订阅均可右键、触屏长按或通过 Shift+F10 打开菜单。使用 Basalt ContextMenu，编辑复用已有 FeedEditor，保存后更新侧栏。删除先显示包含订阅名称及关联数据范围的确认框；取消不发送删除请求，确认后才删除。请求期间禁止重复确认，失败时保留确认框并提示错误。

菜单采用非模态弹层，点击外部或 Escape 关闭，菜单内方向键导航；菜单文字保持正常对比度，编辑与删除图标分别用蓝色和红色。截图：[右键菜单](evidence/reader-layout/sidebar-menu.png)、[手机删除确认](evidence/reader-layout/delete-confirm-mobile.png)。

## 验证

Chrome 经 Caddy HTTPS 正常验证 TLS，检查桌面、手机共 26 个界面、6 个长文视口／主题组合和两种菜单操作，均无水平溢出或 Axe WCAG 2 A/AA、2.1 AA 违规。手动审核脚本拦截写入请求，菜单取消流程确认零写入；不修改日常开发数据库。[审计数据](evidence/reader-layout/audit-summary.json)。

L3 使用独立 Wrangler SQLite，通过真实 HTTP 创建临时订阅，验证右键／长按、编辑并移入分类、刷新后保留、取消删除和确认删除。正文回归验证本地字体成功加载、桌面侧栏与手机堆叠布局，并保留图文、翻译、滚动和键盘导航检查。

本机并行任务曾导致正文分块加载超过默认 5 秒等待，以及完整用户流程超过 30 秒。L3 采用单场景 60 秒、普通断言 10 秒的等待上限，所有功能断言与数据库隔离继续执行。

本轮 G1 严格类型检查与 Biome 零警告通过；L1 共 152 项，语句／分支／函数／行覆盖率为 99.77%／97.93%／100%／99.91%；生产构建通过；L2 95 项真实 HTTP 检查覆盖 33/33 路由；L3 桌面与手机 26 项流程通过。构建保留已有的客户端 chunk 超过 500 kB 提示，未更改告警阈值。证据：[G1／L1／构建／L2](evidence/reader-layout/g1-l1-l2-build.log)、[覆盖率](evidence/reader-layout/coverage-summary.json)、[L2 路由](evidence/reader-layout/l2-endpoints.json)、[L3 完整运行](evidence/reader-layout/l3.log)。

阅读位置用例明确滚动到列表中部，避免删除首行时浏览器在 `scrollTop=0` 的自然边界钳制；调整后桌面、手机两项定向回归均通过，见[阅读位置回归](evidence/reader-layout/l3-position.log)。最终再次执行 G1 和 G2，均通过；[gitleaks](evidence/reader-layout/gitleaks.json) 未发现泄漏，[OSV](evidence/reader-layout/osv.json) 未发现依赖漏洞。本地 HTTPS `/api/live` 返回正常。

## 文章列表顶部

同日追加重设计：用 97px 的三行顶部承载标题与设置、范围统计和操作工具栏。单个订阅的齿轮直接打开订阅编辑；分类与全局视图打开阅读器设置。订阅标题旁提供网站链接，工具栏提供刷新、同步时间／异常状态、搜索、诊断和全部标为已读；快捷键移至搜索提示，不再独占一行。新内容自动载入后通过 toast 提示，工具栏保留同步状态；后台翻译静默显示，不占用更新提示位。

根据对齐反馈，标题、首项统计和同步状态统一左对齐；三项统计使用等宽列，数字使用等宽数字排版。刷新移入右侧工具组，与搜索、诊断、已读等距排列，顶部设置和末尾工具按钮中心线对齐。六组浏览器测量中，左侧起点与右侧中心线误差均为 0px。

文章总量和未读量来自完整订阅统计，按单个订阅、分类或全部订阅汇总，不再把已加载的 30 篇当作总量。点击文章或未读数字切换当前范围的阅读状态筛选；已读比例显示阅读进度。搜索词及匹配数量单独呈现，范围统计保持原义。所有入口复用现有接口和弹窗。

通过 Caddy HTTPS 检查 1440、1024、390、320px 视口，含桌面与手机深浅主题，共 6 组；均无水平溢出、脚本错误和 Axe WCAG 2 A/AA、2.1 AA 违规，设置取消及筛选操作没有写入开发数据。截图：[桌面](evidence/list-header/desktop.png)、[深色顶部](evidence/list-header/1440-dark.png)、[浅色顶部](evidence/list-header/1440-light.png)、[窄屏](evidence/list-header/320-dark.png)；[检查记录](evidence/list-header/audit.json)。

回归同时发现手机长按释放会产生兼容点击及焦点返回，导致打开订阅或关闭菜单。订阅项现在只在菜单已打开时拦截这次点击，并允许焦点回到菜单触发项；短按、外部点击和 Escape 保持正常行为。L3 用 Chromium 原生触屏按下／释放验证长按、编辑、删除确认与取消后的短按导航。

本轮最终 G1、L1、L2、L3、G2 全部通过：152 项单测、95 项 HTTP 检查、28 项桌面／手机流程，覆盖率继续满足四项 95% 门槛。生产构建通过，保留已有的大于 500 kB chunk 提示。[完整质量记录](evidence/list-header/quality.log)、[最终构建](evidence/list-header/build.log)、[原生触屏与菜单无障碍检查](evidence/list-header/touch.json)、[gitleaks](evidence/list-header/gitleaks.json)、[OSV](evidence/list-header/osv.json)。本轮仍仅修改本地，未部署生产。

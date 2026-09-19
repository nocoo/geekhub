# 阅读助手与设置布局

阅读助手现在区分生成操作与已保存结果：摘要可展开/收起，标题可切换原文/中文，全文译文可来回切换。查看缓存不发起生成请求；摘要、标题和全文均可手动重新生成。全文提取完成后回到新正文，并清除基于旧正文的摘要与译文。

中文标题、翻译简介、AI 摘要和正文译文均写入 D1。进入已有结果的文章时，默认显示中文标题与译文，并展开摘要；刷新、直接链接和切换回来都保持这个默认行为。手动切回原文的选择在当前阅读期间保留，数据重新获取不会强制切回译文。Chrome 使用真实开发库结果验证以上流程，新增 AI 请求为 0：[缓存默认展示记录](evidence/ai-reader/cached-defaults.json)、[截图](evidence/ai-reader/cached-defaults.png)。

进行中的操作、错误和重试入口归属于对应文章。切换文章不会把前一篇的加载状态、错误或译文带到新文章。失败原因保留在阅读助手中，配置问题可以直接进入 AI 设置。日常本地与生产都使用真实 AI；未配置服务商密钥时禁用生成入口，已有真实结果仍可阅读。模拟只允许在隔离自动化测试中使用。迁移 `0004` 清除旧 `local-mock` 缓存。

## 按订阅自动翻译全文（2026-09-20，本地未发布）

新增和编辑订阅均有独立的“自动翻译全文”开关，默认关闭，与标题／简介自动翻译分开。打开该订阅的文章时，若有正文、已配置 AI 且没有已有译文，自动调用现有全文翻译接口，成功后显示译文。已保存译文直接读取；手动切回原文不会被元数据轮询改回。

后台翻译成功不发 toast。失败保留原文与文章内重试入口，同一正文不会反复自动发起付费请求；切换文章后结果只写回对应文章。重新提取全文导致正文变化后，可针对新正文自动翻译。未配置 AI、空正文或未开启开关时不触发请求。

迁移 `0005_feed_auto_translate_content.sql` 为共享 `feeds` 表添加布尔字段及默认值，已在开发库执行；部署相关代码前必须先应用生产迁移。生产尚未修改。

## 服务端修复

- OpenAI 兼容服务使用 Chat Completions；Anthropic 协议继续使用 Messages，保留 Bearer 鉴权、HTTPS、跳转拒绝及响应体大小限制。
- 连接测试输出预算由 128 提高到 2,048 tokens，摘要/标题由 2,000 提高到 4,096，给推理模型保留回答空间。请求超时为 90 秒，不自动重试付费生成。
- 区分鉴权、限流、模型/协议配置、超时、空结果和输出截断；不向浏览器返回上游响应正文或密钥。
- 全文翻译传入经过清理的 HTML，保留链接、段落和代码结构；含格式的输入上限为 45,000 字符。输出仍需经过 HTML 清理。
- 空正文不能生成摘要或全文翻译；无效标题、译文和截断结果不落库。生成期间正文被替换时，以条件更新拒绝保存过期结果，已有成功结果保留。

## 设置布局

使用 Basalt 纵向 Tabs：左侧固定五个入口，右侧独立滚动。上下方向键可以切换；关闭弹窗后保持正常焦点返回。桌面左栏 144px，窄屏 72px，320px 宽度仍保留左右布局。AI 表单继续使用 `@nocoo/next-ai` 的公共配置组件。

## 日常本地使用真实 AI

本地开发不再因缺少密钥而自动模拟，连接测试也必须调用配置的服务商。未配置时返回 422 并保留已有内容。只有同时满足本地请求、`ENVIRONMENT=local`、`RESOURCE_ENV=test` 且无密钥的隔离测试会生成模拟输出；测试 API 另有 `_test_marker` 检查。

迁移 `0004` 已在开发库清除 35 篇文章的 `local-mock` 缓存，原有 1,608 篇文章及阅读状态保留。Chrome 通过正常 TLS 验证日常开发的摘要、标题翻译、全文翻译与连接测试均拒绝无密钥请求，设置入口可用，生成按钮明确禁用：[real-local.json](evidence/ai-reader/real-local.json)、[设置截图](evidence/ai-reader/real-local-settings.png)。以上为配置密钥前的验证；真实接入结果见下文。

## 统一 next-ai 与真实服务验证

参照 Gecko 的 `analyze-core.ts` 和 AI 连接接口，GeekHub 统一使用 `@nocoo/next-ai/server` 的 `resolveAiConfig`、`createAiModel`，由 `ai.generateText` 执行请求。应用删除 OpenAI / Anthropic 工厂及直接依赖，设置继续复用 `@nocoo/next-ai/react`。

已发布的 next-ai 0.4.0 缺少传输注入和协议选择，因此使用 [Bun 包补丁](../patches/@nocoo%252Fnext-ai@0.4.0.patch) 给两个服务端入口补充 `AiClientOptions.fetch`、`openaiApi`。默认保持 Responses；GeekHub 显式选择 Chat Completions。补丁同时修复 Anthropic Bearer 模式仍发送 `x-api-key` 的问题。`bun install --frozen-lockfile` 已验证，补丁随安装复现；后续 SDK 正式提供这些选项时可升级并删除补丁。没有修改或发布 Gecko / next-ai 仓库。

自定义服务无法连接的直接原因是 Worker 不支持 `redirect: "error"`，请求在发出前抛出 TypeError。现使用 `manual` 并拒绝所有 3xx，不跟随跳转或转发凭据；回归测试覆盖 301、302、307、308。

2026-09-19，通过本地 Caddy HTTPS 和 Chrome，在 `https://manifest.nocoo.cloud/v1`、OpenAI 协议、`auto` 模型上完成真实连接、摘要、标题翻译及全文翻译。三个文章操作均 HTTP 200，用时约 2.4 / 1.4 / 2.3 秒；返回中文结果，保留正文链接与图片，结果保存到开发 D1，刷新后仍可阅读，无浏览器异常。验证对象是实际订阅中的一篇英文 RSS 节选（619 字符），不据此推断所有长文或模型的输出质量。密钥加密保存于本地 D1，临时明文文件已删除，证据不含密钥：[调用记录](evidence/ai-reader/next-ai-real-provider.json)、[阅读截图](evidence/ai-reader/next-ai-real-results.png)。

## 自动化验证

2026-09-19 最终 `bun run quality` 全部通过：G1 零警告，175 项单元测试，100 项 HTTP 检查，34 项桌面／手机浏览器流程，gitleaks 与 OSV。覆盖率（语句／分支／函数／行）为 99.78%／98.09%／100%／99.91%。构建保留现有客户端 chunk 大于 500 kB 提示。完整输出见 [quality.log](evidence/ai-reader/quality.log)。

- 单元：真实 AI SDK + HTTP 协议夹具，验证 Chat Completions / Anthropic 请求、凭据隔离、输出保存、HTML/JSON 校验、错误分类、截断保护、正文变更竞争和前端文章状态隔离；补充日常开发／生产禁止模拟、缺少密钥不产生成功结果、旧缓存迁移保留真实结果及文章状态的回归测试。
- L2：隔离 Wrangler SQLite 上的 100 项真实 HTTP 检查，覆盖 33/33 API 路由；增加生成缓存、强制重新生成及重复全文提取不清除有效结果的检查。
- L3：桌面和移动端验证摘要、标题翻译、全文翻译、重新生成、刷新后默认展示已存结果、返回文章恢复中文、缓存切换不请求、限流/超时重试、进行中切换文章、提取失败与重试，以及未配置密钥时的入口状态。设置五页包含纵向键盘导航、左右位置、溢出和 Axe 检查。
- 手动浏览器检查使用 Chrome 和正常 TLS 的 `https://geekhub.dev.hexly.ai`，1440 / 390 / 320px，深浅主题。检查脚本拦截写入，没有修改日常开发数据。

截图和检查结果位于 [evidence/ai-reader](evidence/ai-reader/)。自动化门禁使用 HTTP 协议夹具及隔离 Worker 模拟，不读取开发库或真实服务商密钥。另行执行的真实服务调用已记录于上文。生产未部署。

## 本轮验证（2026-09-20）

侧栏修正、自动载入和按订阅自动翻译全文已完成 G1、L1、L2、L3、G2：183 项单元测试、108 项真实 HTTP 检查、38 项桌面／手机浏览器流程通过，覆盖率（语句／分支／函数／行）为 99.71%／97.76%／100%／99.91%。生产未部署；客户端构建仍有原有的大于 500 kB chunk 提示。

第一次完整运行中，诊断弹窗打开后遇到 Vite 开发页面重载；该时段仍在更新文档。停止文件修改后，重新执行整个 L3 的 38 项检查及安全扫描，全部通过，没有跳过或放宽断言。[首次运行](evidence/automatic-reader/initial-quality.log)、[最终 L3](evidence/automatic-reader/l3.log)、[安全扫描](evidence/automatic-reader/security.log)、[覆盖率](evidence/automatic-reader/coverage-summary.json)。

正常 TLS 的本地 HTTPS 浏览器确认了新增设置入口：[订阅设置](evidence/automatic-reader/feed-setting.png)。隔离测试验证自动载入后正文 DOM、选区、滚动位置不变，列表自动锚定现有可见文章；手机从正文返回也保持锚点：[桌面](evidence/automatic-reader/stable-reader-desktop.png)、[手机](evidence/automatic-reader/stable-reader-mobile.png)。全文翻译覆盖开启／关闭、保存后刷新、已存译文不再生成、无密钥／空正文不触发、失败无自动重试循环，以及切换文章后不串结果。

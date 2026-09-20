# Settings 控件与表面层级

2026-09-20，本轮修复纳入 v1.4.1；发布结果见 [发布验证](15-v1.4.1-release.md)。

浅色模式的输入框和选择器使用 `--basalt-bright`，通过 Basalt 的 `--basalt-control-fill` 控制填充；深色模式沿用同一语义 token。外层 Dialog 和 LayerCard 保留原有层级。`--basalt-input` 是边框色，不再被 next-ai 当作输入框背景。

订阅分类、分类颜色、阅读偏好、清理期限和活动筛选均使用 Basalt Select。`SelectField` 只统一字段布局，键盘导航、焦点、表单值和 reset 由库负责；“未分类”使用明确的非空选项并在提交时映射成 null。阅读图片开关使用 Basalt Switch。next-ai 继续使用公共 React 配置组件，在已有 Bun patch 中替换内部 Input/Select，保留已有服务端补丁与配置逻辑。Radix 为表单生成的隐藏原生 select 属于正常实现。

桌面 Settings 最宽 1000 px，保持 4:3，受视口约束；手机按可用高度滚动。分类控件统一为 36 px 高并对齐，订阅数量独占辅助行。保存、删除均为有可访问名称和 title 的 Lucide 图标按钮。颜色值保持完整显示；320 px 窄屏重排为多行。

验证使用受信 HTTPS 本地预览与隔离 SQLite。手工检查覆盖 1440/390/320 px、深浅主题、全部 Settings 页签、订阅编辑/添加、搜索、发现及活动中心；未写开发数据库。L3 覆盖控件层级、桌面比例/对齐、键盘与焦点、表单值、AI 预设/自定义模型、SDK 保存回读及无障碍。几次新增断言修正了主题 data-mode、只读字段恢复、同名日志 fixture 和动画/异步焦点等待，未跳过检查或降低质量门槛。

验证记录见 [evidence/settings-controls](evidence/settings-controls/)：191 项单元测试，覆盖率语句 99.72%、分支 97.97%、函数 100%、行 99.92%；109 项真实 HTTP 检查；56 项桌面/手机浏览器测试；类型、Biome、gitleaks、OSV 和生产构建通过。保留已有的客户端 chunk >500 kB 构建提示。

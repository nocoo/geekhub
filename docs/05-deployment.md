# Cloudflare 部署

## 生产配置

| 项目 | 配置 |
| --- | --- |
| 域名 | `geekhub.hexly.ai` |
| Worker | `geekhub`，SPA 与 API 同域 |
| Account | Zheng Li Workspace |
| D1 | `geekhub-db`，APAC |
| D1 ID | `c502f821-0242-46c5-8bdf-f73dc7ad1ee7` |
| Queue | `geekhub-feed-refresh` |
| Cron | 每 15 分钟 |
| Access team | `nocoo` |
| Access audience | 用户提供的应用 AUD，见根 `wrangler.jsonc` |
| Worker secret | `AI_ENCRYPTION_KEY`，至少 32 字符 |

`workers.dev` 与 preview URL 均禁用。Access 应用需要覆盖整个站点和静态资源，策略只允许预期读者；应用仍独立验证 JWT 签名。若监控需要公开 `/api/live`，在 Access 配置仅针对这个路径的 bypass。

会话接口将已验证的 Access 邮箱规范化并做 SHA-256，再查询 `https://lizheng.blog/api/authors/profile?hash=...` 获取公开姓名和头像。查询有 2.5 秒超时与 16 KiB 响应上限，不传邮箱明文或 JWT，不跟随重定向；异常时回退到 Access 姓名和 Basalt 首字母头像。头像经过公开 URL 校验，通过同源图片代理加载。本地可在 `.dev.vars.local` 设置 `LOCAL_USER_EMAIL` 预览对应公开头像；仅回环本地请求生效，L2／L3 不调用外部头像服务。

版本以根 `package.json` 为唯一来源，侧栏显示 `vX.Y.Z`，`/api/live.version` 和抓取 User-Agent 同步。当前发布为 **v1.2.0**；发布标签与 GitHub Release 使用相同版本。

## 发布

先完成质量检查与 Cloudflare 授权。D1、Queue 必须存在，团队名与 AUD 必须与 Access 应用一致。

```sh
bun run quality
bun run deploy
```

脚本拒绝 `CLOUDFLARE_ENV`、测试持久化目录或测试 runtime，随后按顺序执行：远程迁移、生产构建、Wrangler 部署。迁移失败即停止，不上传依赖新 schema 的代码。

首次发布可以使用 `bun run deploy --secrets-file <生产密钥文件>` 一次上传加密密钥和 Worker 版本。Wrangler 后续发布保留已有 secret；密钥不写入 `wrangler.jsonc`、浏览器或 Git。不要使用本地开发密钥作为生产密钥。首次生成的本机备份在 Git 忽略的 `.wrangler/deploy/production-secrets.json`，权限 0600。

CSV 生产导入是单独的维护操作，使用 `bun run db:import <目录> --remote`。CI 只验证本地模拟环境，不继承生产或远程测试凭据。未经实际运行，不能将本地验证结果表述为 GitHub Actions 已通过。

## 域名切换与回退

重写前域名使用 Vercel，CNAME 为 `123b8172e1be8cba.vercel-dns-017.com.`，页面跳转到 `/login`。该记录是切换前的回退依据；旧 Supabase 数据、Vercel 项目及其密钥未被删除。

Wrangler Custom Domain 将域名绑定到生产 Worker。如果已有 DNS 记录阻止绑定，应仅替换这一条 GeekHub 记录，不修改其他项目。部署后检查公开健康结果、未登录访问、Access 跳转目标、静态资源、安全响应头、D1 和队列。

2026-09-12 发布 v1.2.0 时，用户移除旧记录后已成功绑定新 Worker。公开健康路径正常，其余页面和静态资源由 `nocoo` Access 保护。若本机暂时缓存删除记录期间的 NXDOMAIN，可通过公共 DNS-over-HTTPS 对照；这不代表绑定失败，不应重复修改已正确的 DNS 记录。

后续版本可用 `bun x wrangler rollback <版本 ID>` 回退 Worker。回退代码不会回退 schema；迁移应保持向后兼容。首次架构迁移如需整体回退，应恢复上述 Vercel DNS，并核对对应 Access 策略及旧站可用性。D1 和新订阅数据保留，不因切换 DNS 删除。

## 证据

本地和生产实际结果记录在 [质量证据](03-quality.md) 与 `docs/evidence/`。生产 AI 需要读者在设置中提供真实服务商密钥；部署不会自动发起付费 AI 调用。

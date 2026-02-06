# 部署指南

> 返回 [README](../README.md)

本文档介绍如何将 GeekHub 部署到生产环境。

---

## 目录

- [前置要求](#前置要求)
- [Supabase 配置](#supabase-配置)
- [环境变量](#环境变量)
- [本地构建](#本地构建)
- [部署方案](#部署方案)
- [进程管理](#进程管理)
- [反向代理](#反向代理)
- [监控与维护](#监控与维护)
- [故障排除](#故障排除)

---

## 前置要求

### 服务器要求

| 资源 | 最低要求 | 推荐配置 |
|------|----------|----------|
| CPU | 1 核 | 2+ 核 |
| 内存 | 1 GB | 2+ GB |
| 磁盘 | 10 GB | 20+ GB |
| 系统 | Linux (Ubuntu 22.04+) | - |

### 必需软件

| 软件 | 版本 | 用途 |
|------|------|------|
| Bun | 1.0+ | 运行时 |
| Node.js | 18+ | 构建依赖 |
| Git | 任意 | 代码管理 |
| Nginx | 1.18+ | 反向代理 |

### 安装 Bun

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun --version
```

---

## Supabase 配置

### 方式一：Supabase Cloud（推荐）

1. 访问 https://supabase.com 创建项目
2. 获取 Project URL 和 API Keys
3. 在 SQL Editor 中执行迁移文件

### 方式二：自托管 Supabase

参考官方文档：https://supabase.com/docs/guides/self-hosting

### 执行数据库迁移

在 Supabase Dashboard → SQL Editor 中依次执行：

```
supabase/migrations/20260113000000_schema.sql
supabase/migrations/20260113000100_fix_feed_counts.sql
supabase/migrations/20260113000200_fix_trigger_auth.sql
supabase/migrations/20260113000300_security_hardening.sql
```

---

## 环境变量

创建 `.env.local` 或设置系统环境变量：

```bash
# === 必填 ===

# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# === 可选 ===

# AI 配置
OPENAI_API_KEY=sk-xxx
OPENAI_API_BASE=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

# 服务器配置
PORT=3000
NODE_ENV=production
```

### 环境变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | 匿名密钥（客户端用） |
| `SUPABASE_SERVICE_KEY` | ✅ | 服务端密钥（API 用） |
| `OPENAI_API_KEY` | ❌ | AI 功能所需 |
| `OPENAI_API_BASE` | ❌ | 自定义 API 端点 |
| `OPENAI_MODEL` | ❌ | AI 模型名称 |
| `PORT` | ❌ | 服务端口，默认 3000 |

---

## 本地构建

### 1. 克隆代码

```bash
git clone https://github.com/yourusername/geekhub.git
cd geekhub
```

### 2. 安装依赖

```bash
bun install
```

### 3. 构建生产版本

```bash
bun run build
```

构建产物位于 `.next/` 目录。

### 4. 本地测试

```bash
bun start
```

访问 http://localhost:3000 验证。

---

## 部署方案

### 方案一：直接部署（推荐个人使用）

在服务器上直接运行：

```bash
# 克隆代码
git clone https://github.com/yourusername/geekhub.git
cd geekhub

# 安装依赖
bun install

# 构建
bun run build

# 启动
bun start
```

### 方案二：Docker 部署

创建 `Dockerfile`：

```dockerfile
FROM oven/bun:1 as builder

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM oven/bun:1-slim
WORKDIR /app

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["bun", "start"]
```

构建并运行：

```bash
docker build -t geekhub .
docker run -d -p 3000:3000 --env-file .env.local geekhub
```

### 方案三：Vercel 部署

1. Fork 仓库到 GitHub
2. 登录 Vercel，导入项目
3. 配置环境变量
4. 部署

---

## 进程管理

### PM2（推荐）

安装 PM2：

```bash
bun install -g pm2
```

创建 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [
    {
      name: 'geekhub',
      script: 'bun',
      args: 'start',
      cwd: '/path/to/geekhub',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },
  ],
}
```

启动服务：

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

常用命令：

```bash
pm2 list              # 查看进程
pm2 logs geekhub      # 查看日志
pm2 restart geekhub   # 重启
pm2 stop geekhub      # 停止
pm2 delete geekhub    # 删除
```

### systemd

创建 `/etc/systemd/system/geekhub.service`：

```ini
[Unit]
Description=GeekHub RSS Reader
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/geekhub
ExecStart=/home/user/.bun/bin/bun start
Restart=on-failure
Environment=NODE_ENV=production
EnvironmentFile=/path/to/geekhub/.env.local

[Install]
WantedBy=multi-user.target
```

启用服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable geekhub
sudo systemctl start geekhub
```

---

## 反向代理

### Nginx 配置

创建 `/etc/nginx/sites-available/geekhub`：

```nginx
server {
    listen 80;
    server_name geekhub.example.com;

    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name geekhub.example.com;

    # SSL 证书
    ssl_certificate /etc/letsencrypt/live/geekhub.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/geekhub.example.com/privkey.pem;

    # SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # 代理配置
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # SSE 支持
    location /api/logs/stream {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/geekhub /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 获取 SSL 证书

使用 Let's Encrypt：

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d geekhub.example.com
```

---

## 监控与维护

### 健康检查

定期检查服务状态：

```bash
curl -f http://localhost:3000/api/health
```

### 日志管理

PM2 日志轮转：

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 数据备份

定期备份 Supabase 数据：

1. Supabase Dashboard → Settings → Backups
2. 或使用 `pg_dump` 手动备份

### 更新流程

```bash
cd /path/to/geekhub

# 拉取最新代码
git pull origin main

# 安装依赖
bun install

# 重新构建
bun run build

# 重启服务
pm2 restart geekhub
```

---

## 故障排除

### 启动失败

**症状**：服务无法启动

**排查步骤**：

1. 检查日志：`pm2 logs geekhub`
2. 检查端口：`lsof -i :3000`
3. 检查环境变量：确保 `.env.local` 正确

### 数据库连接失败

**症状**：API 返回 500 错误

**排查步骤**：

1. 验证 Supabase URL 和 Keys
2. 检查 RLS 策略是否正确
3. 查看 Supabase 日志

### SSE 不工作

**症状**：实时更新不生效

**排查步骤**：

1. 确保 Nginx 配置了 SSE 支持
2. 检查 `proxy_buffering off`
3. 验证 `/api/logs/stream` 端点

### AI 功能失败

**症状**：摘要/翻译不工作

**排查步骤**：

1. 检查 `OPENAI_API_KEY` 是否设置
2. 验证 API 余额
3. 测试 API 连通性

### 内存不足

**症状**：服务频繁重启

**解决方案**：

1. 增加服务器内存
2. 调整 PM2 内存限制
3. 优化文章缓存策略

---

## 相关文档

- [开发指南](03-development.md) - 本地开发
- [架构设计](01-architecture.md) - 系统架构
- [数据库设计](06-database.md) - 数据库配置

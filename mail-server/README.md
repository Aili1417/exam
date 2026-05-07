# 爱刷题邮件验证码服务

## 部署到服务器

### 1. 上传文件到服务器

```bash
scp -r mail-server/ root@8.137.119.143:/opt/
```

### 2. 服务器上安装依赖并启动

```bash
ssh root@8.137.119.143
cd /opt/mail-server

# 安装 Node.js（如未安装）
# CentOS/RHEL:
curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
yum install -y nodejs

# Ubuntu/Debian:
# curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
# apt install -y nodejs

# 安装依赖
npm install

# 直接启动（测试用）
node server.js
```

### 3. 使用 PM2 守护进程（推荐）

```bash
npm install -g pm2
pm2 start server.js --name exam-mail-server
pm2 save
pm2 startup
```

### 4. 验证

```bash
# 健康检查
curl http://localhost:3874/health

# 发送测试验证码（替换为你的邮箱）
curl -X POST http://localhost:3874/api/send-code \
  -H "Content-Type: application/json" \
  -d '{"email":"test@qq.com"}'
```

### 5. 防火墙放行端口

```bash
# firewalld
firewall-cmd --add-port=3874/tcp --permanent
firewall-cmd --reload

# iptables
iptables -A INPUT -p tcp --dport 3874 -j ACCEPT
```

### 6. 环境变量

所有配置在 `.env` 文件中，部署前确认：
- `QQ_EMAIL` — QQ 邮箱地址
- `QQ_AUTH_CODE` — QQ 邮箱 SMTP 授权码
- `LEANCLOUD_*` — LeanCloud 应用凭据
- `ALLOWED_ORIGINS` — 允许的前端域名

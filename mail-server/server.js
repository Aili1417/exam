require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const AV = require('leancloud-storage');
const fs = require('fs');
const path = require('path');

// ── 加载环境变量 ──────────────────────────────────────────────
const QQ_EMAIL = process.env.QQ_EMAIL;
const QQ_AUTH_CODE = process.env.QQ_AUTH_CODE;
const LEANCLOUD_APP_ID = process.env.LEANCLOUD_APP_ID;
const LEANCLOUD_APP_KEY = process.env.LEANCLOUD_APP_KEY;
const LEANCLOUD_SERVER_URL = process.env.LEANCLOUD_SERVER_URL;
const PORT = parseInt(process.env.PORT, 10) || 3874;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

// ── 校验必需配置 ──────────────────────────────────────────────
if (!QQ_EMAIL || !QQ_AUTH_CODE) {
  console.error('缺少 QQ_EMAIL 或 QQ_AUTH_CODE 环境变量');
  process.exit(1);
}
if (!LEANCLOUD_APP_ID || !LEANCLOUD_APP_KEY) {
  console.error('缺少 LeanCloud 配置环境变量');
  process.exit(1);
}

// ── 初始化 LeanCloud ──────────────────────────────────────────
AV.init({
  appId: LEANCLOUD_APP_ID,
  appKey: LEANCLOUD_APP_KEY,
  serverURL: LEANCLOUD_SERVER_URL,
});

// ── 初始化 QQ 邮箱 SMTP ───────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: 'smtp.qq.com',
  port: 465,
  secure: true,
  auth: {
    user: QQ_EMAIL,
    pass: QQ_AUTH_CODE,
  },
});

// ── 加载邮件模板 ──────────────────────────────────────────────
const templatePath = path.join(__dirname, 'email-template.html');
const emailTemplate = fs.readFileSync(templatePath, 'utf-8');

// ── Express 应用 ──────────────────────────────────────────────
const app = express();

// JSON body 解析
app.use(express.json());

// CORS
app.use(cors({
  origin: function (origin, callback) {
    // 允许无 origin 的请求 (curl, Postman 等)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    // 允许 localhost 任意端口
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    callback(null, false);
  },
}));

// ── 简易内存限流（同 IP 60 秒内只能请求一次） ─────────────────
const rateLimitMap = new Map();
const RATE_LIMIT_SEC = 60;

function checkRateLimit(ip) {
  const now = Date.now();
  const last = rateLimitMap.get(ip);
  if (last && now - last < RATE_LIMIT_SEC * 1000) {
    return Math.ceil((RATE_LIMIT_SEC * 1000 - (now - last)) / 1000);
  }
  rateLimitMap.set(ip, now);
  return 0;
}

// 定期清理过期限流记录
setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT_SEC * 1000 * 2;
  for (const [ip, time] of rateLimitMap) {
    if (time < cutoff) rateLimitMap.delete(ip);
  }
}, 60000);

// ── 健康检查 ──────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ── 发送验证码 ────────────────────────────────────────────────
app.post('/api/send-code', async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;

  // 限流检查
  const retryAfter = checkRateLimit(ip);
  if (retryAfter > 0) {
    return res.status(429).json({
      success: false,
      message: `请求过于频繁，请${retryAfter}秒后重试`,
    });
  }

  const { email } = req.body;

  // 邮箱格式校验
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      success: false,
      message: '邮箱格式不正确',
    });
  }

  try {
    // 生成6位验证码
    const code = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');

    // 删除该邮箱之前的验证码
    const VerificationCode = AV.Object.extend('VerificationCode');
    const deleteQuery = new AV.Query(VerificationCode);
    deleteQuery.equalTo('email', email);
    try {
      const oldCodes = await deleteQuery.find();
      if (oldCodes.length > 0) {
        await AV.Object.destroyAll(oldCodes);
      }
    } catch (_) {
      // 删除失败不影响新验证码创建
    }

    // 保存新验证码到 LeanCloud（5分钟过期）
    const vcObject = new VerificationCode();
    vcObject.set('email', email);
    vcObject.set('code', code);
    vcObject.set('expiresAt', new Date(Date.now() + 5 * 60 * 1000));
    await vcObject.save();

    // 渲染邮件 HTML
    const toName = email.split('@')[0];
    const html = emailTemplate
      .replace(/\{\{to_name\}\}/g, toName)
      .replace(/\{\{verification_code\}\}/g, code);

    // 发送邮件
    await transporter.sendMail({
      from: `"爱刷题吖" <${QQ_EMAIL}>`,
      to: email,
      subject: '爱刷题吖 - 邮箱验证码',
      html,
    });

    console.log(`[${new Date().toISOString()}] 验证码已发送 -> ${email}`);

    return res.json({
      success: true,
      message: '验证码已发送到您的邮箱，请查收',
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] 发送失败 -> ${email}:`, error.message);
    return res.status(500).json({
      success: false,
      message: '邮件发送失败，请稍后重试',
    });
  }
});

// ── 启动服务 ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`邮件服务已启动: http://0.0.0.0:${PORT}`);
  console.log(`允许的来源: ${ALLOWED_ORIGINS.join(', ') || 'localhost (dev)'}`);
});

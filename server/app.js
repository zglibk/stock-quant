/**
 * 股票量化分析系统 - Express 主入口
 * 纯 Node.js 全栈: Express + MongoDB + Redis + AI Gateway
 */
require('dotenv').config({ path: '../.env' });  // 从 server/ 目录运行时
if (!process.env.MONGO_URI) {
  require('dotenv').config({ path: '.env' });   // 从根目录运行时
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { Server: SocketServer } = require('socket.io');
const logger = require('./utils/logger');
const connectDB = require('./config/db');
const connectRedis = require('./config/redis');

const app = express();
const server = http.createServer(app);

// ===================== Socket.IO =====================
const io = new SocketServer(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});
app.set('io', io);

// ===================== 中间件 =====================
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('short', {
  stream: { write: (msg) => logger.info(msg.trim()) }
}));

// ===================== API 路由 =====================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/stocks', require('./routes/stocks'));
app.use('/api/market', require('./routes/market'));
app.use('/api/strategy', require('./routes/strategy'));
app.use('/api/backtest', require('./routes/backtest'));
app.use('/api/signals', require('./routes/signals'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/admin', require('./routes/admin'));

// ===================== 健康检查 =====================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '0.1.0',
    uptime: process.uptime(),
    memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
    timestamp: new Date().toISOString()
  });
});

// ===================== 错误处理 =====================
app.use((err, req, res, next) => {
  logger.error(`${err.status || 500} - ${err.message}`, { stack: err.stack });
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? '服务器内部错误'
      : err.message
  });
});

// ===================== 启动服务 =====================
const PORT = process.env.PORT || 3000;

async function start() {
  try {
    // 连接数据库
    await connectDB();
    logger.info('✅ MongoDB 连接成功');

    // 连接 Redis (可选)
    const redis = await connectRedis();
    app.set('redis', redis);
    if (redis) {
      logger.info('✅ Redis 连接成功');
    }

    // Socket.IO 连接处理
    require('./socket/handler')(io);

    // 启动定时任务
    if (process.env.NODE_ENV !== 'test') {
      require('./jobs/scheduler').start();
      logger.info('✅ 定时任务已启动');
    }

    server.listen(PORT, () => {
      logger.info(`🚀 服务器启动成功 → http://localhost:${PORT}`);
      logger.info(`📊 环境: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🧠 AI 默认模型: ${process.env.AI_PROVIDER_CHAT || 'deepseek'}`);
    });
  } catch (err) {
    logger.error('❌ 启动失败:', err);
    process.exit(1);
  }
}

start();

module.exports = app;

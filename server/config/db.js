/**
 * MongoDB 连接配置
 * 针对 2核2G 服务器做内存优化
 */
const mongoose = require('mongoose');
const logger = require('../utils/logger');

async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/stock_quant';

  mongoose.set('strictQuery', false);

  await mongoose.connect(uri, {
    // 连接池优化 (2G 内存限制)
    maxPoolSize: 5,          // 默认100，降到5
    minPoolSize: 1,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB 连接错误:', err);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB 连接断开');
  });

  return mongoose.connection;
}

module.exports = connectDB;

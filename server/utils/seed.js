/**
 * 初始化脚本 - 创建管理员账户
 * 运行: cd server && node utils/seed.js
 */
require('dotenv').config({ path: '../.env' });
if (!process.env.MONGO_URI) {
  require('dotenv').config({ path: '../../.env' });  // 从 server/utils/ 运行时
}
const mongoose = require('mongoose');
const User = require('../models/User');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/stock_quant');
  console.log('已连接 MongoDB');

  // 创建管理员
  const exists = await User.findOne({ username: 'admin' });
  if (exists) {
    console.log('管理员账户已存在，跳过');
  } else {
    await User.create({
      username: 'admin',
      password: 'admin123',
      nickname: '系统管理员',
      role: 'admin'
    });
    console.log('✅ 管理员已创建: admin / admin123');
  }

  await mongoose.disconnect();
  console.log('完成');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed 失败:', err);
  process.exit(1);
});

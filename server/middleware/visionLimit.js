/**
 * Vision 并发限制中间件
 * 限制同时进行中的图片分析请求数，防止内存溢出 (OOM)
 */
const aiConfig = require('../config/ai.config');
const logger = require('../utils/logger');

let currentProcessing = 0;
const MAX_CONCURRENT = aiConfig.limits.maxConcurrentVision || 2;

module.exports = (req, res, next) => {
  if (currentProcessing >= MAX_CONCURRENT) {
    logger.warn(`Vision 并发限制: ${currentProcessing}/${MAX_CONCURRENT}`);
    return res.status(503).json({
      success: false,
      message: '服务器正忙，请稍后重试 (并发限制)'
    });
  }

  currentProcessing++;
  
  // 响应结束时减少计数 (无论是正常结束、报错还是连接断开)
  res.on('finish', () => {
    currentProcessing = Math.max(0, currentProcessing - 1);
  });
  
  res.on('close', () => {
    // 防止 finish 没触发的情况
    setTimeout(() => {
      currentProcessing = Math.max(0, currentProcessing - 1);
    }, 1000);
  });

  next();
};

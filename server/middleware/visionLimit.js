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
  
  // 使用标记防止 finish + close 双减
  let decremented = false;
  const decrement = () => {
    if (!decremented) {
      decremented = true;
      currentProcessing = Math.max(0, currentProcessing - 1);
    }
  };

  res.on('finish', decrement);
  res.on('close', decrement);

  next();
};

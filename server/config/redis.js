/**
 * Redis 连接配置 - 可选
 * 没有 Redis 时系统照常运行，只是没有缓存加速
 */
const logger = require('../utils/logger');

let redis = null;

async function connectRedis() {
  // 如果没配置 REDIS_URL 或明确跳过，直接返回 null
  if (process.env.SKIP_REDIS === 'true' || !process.env.REDIS_URL) {
    logger.info('⏭️  Redis 已跳过 (未配置或 SKIP_REDIS=true)');
    return null;
  }

  try {
    const Redis = require('ioredis');
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;  // 3次重试后放弃
        return Math.min(times * 500, 2000);
      },
      lazyConnect: true,
      connectTimeout: 5000,
    });

    redis.on('error', (err) => {
      logger.warn('Redis 连接失败，系统将在无缓存模式下运行:', err.message);
      redis = null;
    });

    await redis.connect();
    return redis;
  } catch (err) {
    logger.warn('⚠️  Redis 连接失败，系统将在无缓存模式下运行');
    redis = null;
    return null;
  }
}

function getRedis() {
  return redis;
}

module.exports = connectRedis;
module.exports.getRedis = getRedis;

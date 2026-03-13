/**
 * 定时任务调度器
 */
const cron = require('node-cron');
const logger = require('../utils/logger');

module.exports = {
  start() {
    // 每天 15:35 收盘后采集日K数据
    cron.schedule('35 15 * * 1-5', async () => {
      logger.info('[Scheduler] ⏰ 收盘数据采集任务开始');
      try {
        const dataFetcher = require('../services/dataFetcher');
        await dataFetcher.syncTodayKlines();
        await dataFetcher.calcIndicators();
      } catch (err) {
        logger.error('[Scheduler] 数据采集失败:', err.message);
      }
    }, { timezone: 'Asia/Shanghai' });

    // 每天 8:50 开盘前更新股票列表
    cron.schedule('50 8 * * 1-5', async () => {
      logger.info('[Scheduler] ⏰ 股票列表更新任务');
      try {
        const dataFetcher = require('../services/dataFetcher');
        await dataFetcher.syncStockList();
      } catch (err) {
        logger.error('[Scheduler] 股票列表更新失败:', err.message);
      }
    }, { timezone: 'Asia/Shanghai' });

    logger.info('📅 定时任务已注册 (收盘采集 15:35 / 列表更新 8:50)');
  }
};

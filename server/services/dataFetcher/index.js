/**
 * 数据采集模块 - 统一接口
 * 纯 Node.js 替代 Python/AKShare
 */
const sinaProvider = require('./providers/sinaProvider');
const neteaseProvider = require('./providers/neteaseProvider');
const eastmoneyProvider = require('./providers/eastmoneyProvider');
const { Stock, DailyKline } = require('../../models/Market');
const logger = require('../../utils/logger');

class DataFetcher {
  // 同步股票列表 (东方财富)
  async syncStockList() {
    try {
      logger.info('[DataFetcher] 开始同步股票列表...');
      const stocks = await eastmoneyProvider.getStockList();
      let updated = 0;
      for (const s of stocks) {
        await Stock.updateOne({ code: s.code }, { $set: s }, { upsert: true });
        updated++;
      }
      logger.info(`[DataFetcher] 股票列表同步完成: ${updated} 只`);
      return { updated };
    } catch (err) {
      logger.error('[DataFetcher] 股票列表同步失败:', err.message);
      throw err;
    }
  }

  // 同步今日K线 (网易)
  async syncTodayKlines(codes, options = {}) {
    try {
      const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
      if (!codes) {
        const stocks = await Stock.find({ isActive: true }).select('code').lean();
        codes = stocks.map(s => s.code);
      }
      logger.info(`[DataFetcher] 开始采集 ${codes.length} 只股票K线...`);

      const currentYear = new Date().getFullYear();
      const years = [currentYear, currentYear - 1, currentYear - 2].map(String);
      let total = 0;
      let codesWithData = 0;
      let failedCodes = 0;
      let processedCodes = 0;
      let noDataCodes = 0;
      if (onProgress) {
        onProgress({
          totalCodes: codes.length,
          processedCodes,
          codesWithData,
          noDataCodes,
          failedCodes,
          total
        });
      }

      // 分批处理，每批 10 只，避免请求过快
      for (let i = 0; i < codes.length; i += 10) {
        const batch = codes.slice(i, i + 10);
        await Promise.all(batch.map(async (code) => {
          try {
            const mergedMap = new Map();
            for (const year of years) {
              const klines = await neteaseProvider.getDailyKline(code, year);
              for (const k of klines) {
                mergedMap.set(`${k.code}_${k.date}`, k);
              }
            }
            const merged = [...mergedMap.values()];
            if (merged.length > 0) {
              const ops = merged.map(k => ({
                updateOne: {
                  filter: { code: k.code, date: k.date },
                  update: { $set: k },
                  upsert: true
                }
              }));
              await DailyKline.bulkWrite(ops);
              total += ops.length;
              codesWithData += 1;
            } else {
              noDataCodes += 1;
            }
          } catch (err) {
            logger.warn(`[DataFetcher] ${code} K线采集失败: ${err.message}`);
            failedCodes += 1;
          } finally {
            processedCodes += 1;
            if (onProgress) {
              onProgress({
                totalCodes: codes.length,
                processedCodes,
                codesWithData,
                noDataCodes,
                failedCodes,
                total
              });
            }
          }
        }));

        // 限流: 每批间隔 500ms
        if (i + 10 < codes.length) {
          await new Promise(r => setTimeout(r, 500));
        }
      }

      logger.info(`[DataFetcher] K线采集完成: ${total} 条, 有数据股票: ${codesWithData}/${codes.length}, 无数据: ${noDataCodes}, 失败: ${failedCodes}`);
      return { total, requestedCodes: codes.length, processedCodes, codesWithData, noDataCodes, failedCodes };
    } catch (err) {
      logger.error('[DataFetcher] K线采集失败:', err.message);
      throw err;
    }
  }

  // 获取实时行情 (新浪)
  async getRealtime(codes) {
    return sinaProvider.getRealtime(codes);
  }

  // 计算技术指标
  async calcIndicators(codes) {
    const indicatorCalc = require('../indicatorCalc');
    return indicatorCalc.calcAll(codes);
  }

  // 数据源健康检查
  async healthCheck() {
    const results = {};
    try {
      await sinaProvider.getRealtime(['000001']);
      results.sina = 'ok';
    } catch { results.sina = 'error'; }

    try {
      await eastmoneyProvider.getStockList(1);
      results.eastmoney = 'ok';
    } catch { results.eastmoney = 'error'; }

    logger.info(`[DataFetcher] 数据源健康检查: ${JSON.stringify(results)}`);
    return results;
  }
}

module.exports = new DataFetcher();

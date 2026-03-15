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
  // 同步股票列表
  async syncStockList(options = {}) {
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    try {
      logger.info('[DataFetcher] 开始同步股票列表...');
      const stocks = await eastmoneyProvider.getStockList(onProgress);
      const total = stocks.length;
      let updated = 0;

      // 批量写入 DB (每批100条)
      for (let i = 0; i < stocks.length; i += 100) {
        const batch = stocks.slice(i, i + 100);
        const ops = batch.map(s => ({
          updateOne: { filter: { code: s.code }, update: { $set: s }, upsert: true }
        }));
        await Stock.bulkWrite(ops);
        updated += batch.length;
        if (onProgress) {
          onProgress({ totalCodes: total, processedCodes: total, validStocks: updated, phase: 'writing' });
        }
      }

      logger.info(`[DataFetcher] 股票列表同步完成: ${updated} 只`);

      // 自动补充行业数据
      try {
        await this.syncIndustry();
      } catch (e) {
        logger.warn(`[DataFetcher] 行业数据补充失败(不影响列表): ${e.message}`);
      }

      return { updated };
    } catch (err) {
      const errDetail = err.response
        ? `HTTP ${err.response.status} - ${err.response.statusText} - ${JSON.stringify(err.response.data || '').slice(0, 200)}`
        : `${err.code || ''} ${err.message || err}`;
      logger.error(`[DataFetcher] 股票列表同步失败: ${errDetail}`);
      throw new Error(`股票列表同步失败: ${errDetail}`);
    }
  }

  /**
   * 从新浪补充行业分类数据
   * 接口: http://vip.stock.finance.sina.com.cn/q/view/newSinaHy.php
   * 返回格式: var S_Finance_bankuai_sinaindustry = {"new_blhy":"new_blhy,玻璃行业,19,...,sz300093,...", ...}
   */
  async syncIndustry() {
    const axios = require('axios');
    const iconv = require('iconv-lite');

    logger.info('[DataFetcher] 开始补充行业分类数据...');
    const { data: rawBuf } = await axios.get('http://vip.stock.finance.sina.com.cn/q/view/newSinaHy.php', {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: { Referer: 'https://finance.sina.com.cn' },
      httpAgent: new (require('http').Agent)({ family: 4 }),
    });

    const text = iconv.decode(rawBuf, 'gbk');
    // 提取 JSON 部分: var S_Finance_bankuai_sinaindustry = {...}
    const match = text.match(/=\s*(\{[\s\S]+\})/);
    if (!match) throw new Error('新浪行业接口返回格式异常');

    const obj = JSON.parse(match[1]);
    // 解析: 每个 value 格式 "key,行业名称,数量,...,sz代码,..." 
    // 从中提取行业名称，然后需要获取该行业下的所有成分股
    // 但这个接口只返回了领涨股，不是全部成分股
    // 需要用另一个接口: http://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData?node=new_blhy&page=1&num=1000
    
    const industryMap = {}; // code -> industry
    const entries = Object.entries(obj);
    let done = 0;

    for (const [key, val] of entries) {
      const parts = String(val).split(',');
      const industryName = parts[1]; // 第2个字段是行业名称
      if (!industryName) continue;

      try {
        // 获取该行业下所有成分股
        const { data: stocksBuf } = await axios.get(
          'http://vip.stock.finance.sina.com.cn/quotes_service/api/json_v2.php/Market_Center.getHQNodeData',
          {
            params: { node: key, page: 1, num: 1000, sort: 'symbol', asc: 1, _s_r_a: 'auto' },
            responseType: 'arraybuffer',
            timeout: 10000,
            headers: { Referer: 'https://finance.sina.com.cn' },
            httpAgent: new (require('http').Agent)({ family: 4 }),
          }
        );
        const stocksText = iconv.decode(stocksBuf, 'gbk');
        // 返回的是 JSON 数组: [{symbol:"sh600000", name:"...", ...}, ...]
        const stocksList = JSON.parse(stocksText);
        if (Array.isArray(stocksList)) {
          for (const s of stocksList) {
            const code = String(s.symbol || '').replace(/^(sh|sz)/i, '');
            if (code.length === 6) {
              industryMap[code] = industryName;
            }
          }
        }
      } catch {}

      done++;
      if (done % 10 === 0) {
        logger.info(`[DataFetcher] 行业进度: ${done}/${entries.length} 板块, 已映射 ${Object.keys(industryMap).length} 只`);
      }

      // 限流 200ms
      await new Promise(r => setTimeout(r, 200));
    }

    // 批量写入 DB
    if (Object.keys(industryMap).length > 0) {
      const ops = Object.entries(industryMap).map(([code, industry]) => ({
        updateOne: { filter: { code }, update: { $set: { industry } } }
      }));
      // 分批写入
      for (let i = 0; i < ops.length; i += 500) {
        await Stock.bulkWrite(ops.slice(i, i + 500));
      }
      logger.info(`[DataFetcher] 行业分类补充完成: ${Object.keys(industryMap).length} 只股票`);
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

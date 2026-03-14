/**
 * 技术指标计算服务
 * 使用 technicalindicators 库计算 MA/MACD/RSI/BOLL/KDJ
 * 从 DailyKline 读取数据，结果写入 Indicator 集合
 */
const TI = require('technicalindicators');
const { DailyKline, Indicator } = require('../models/Market');
const logger = require('../utils/logger');

class IndicatorCalculator {
  /**
   * 计算并存储指定股票的全部技术指标
   * @param {string} code - 股票代码
   * @param {number} limit - 计算最近 N 日 (默认120日，保证长周期指标有足够数据)
   */
  async calcForStock(code, limit = 250) {
    const klines = await DailyKline.find({ code })
      .sort({ date: 1 })
      .limit(limit)
      .lean();

    if (klines.length < 30) {
      return { code, count: 0, reason: 'insufficient data' };
    }

    const closes = klines.map(k => k.close);
    const highs = klines.map(k => k.high);
    const lows = klines.map(k => k.low);
    const volumes = klines.map(k => k.volume);

    // 计算各指标 (返回数组长度可能短于 klines)
    const ma5  = TI.SMA.calculate({ period: 5,  values: closes });
    const ma10 = TI.SMA.calculate({ period: 10, values: closes });
    const ma20 = TI.SMA.calculate({ period: 20, values: closes });
    const ma60 = TI.SMA.calculate({ period: 60, values: closes });

    const macdResult = TI.MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });

    const rsi6  = TI.RSI.calculate({ period: 6,  values: closes });
    const rsi14 = TI.RSI.calculate({ period: 14, values: closes });

    const bollResult = TI.BollingerBands.calculate({
      period: 20,
      stdDev: 2,
      values: closes,
    });

    const kdjResult = TI.Stochastic.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: 9,
      signalPeriod: 3,
    });

    // 对齐数据 — 各指标由于周期不同，结果数组长度不同
    // 我们只存储有完整指标的最近 N 条 (取最短公共长度)
    const minLen = Math.min(
      ma60.length,
      macdResult.length,
      rsi14.length,
      bollResult.length,
      kdjResult.length
    );

    if (minLen === 0) {
      return { code, count: 0, reason: 'no calculable range' };
    }

    const ops = [];
    for (let i = 0; i < minLen; i++) {
      // 从各数组末尾往前取 minLen 条，对齐到 klines 末尾
      const kIdx = klines.length - minLen + i;
      const date = klines[kIdx].date;

      const ma5Idx  = ma5.length  - minLen + i;
      const ma10Idx = ma10.length - minLen + i;
      const ma20Idx = ma20.length - minLen + i;
      const ma60Idx = ma60.length - minLen + i;
      const macdIdx = macdResult.length - minLen + i;
      const rsi6Idx = rsi6.length  - minLen + i;
      const rsi14Idx = rsi14.length - minLen + i;
      const bollIdx = bollResult.length - minLen + i;
      const kdjIdx  = kdjResult.length - minLen + i;

      const doc = {
        code,
        date,
        ma5:  r(ma5[ma5Idx]),
        ma10: r(ma10[ma10Idx]),
        ma20: r(ma20[ma20Idx]),
        ma60: r(ma60[ma60Idx]),
        macd: {
          dif: r(macdResult[macdIdx]?.MACD),
          dea: r(macdResult[macdIdx]?.signal),
          histogram: r(macdResult[macdIdx]?.histogram),
        },
        rsi6:  r(rsi6[rsi6Idx]),
        rsi14: r(rsi14[rsi14Idx]),
        boll: {
          upper: r(bollResult[bollIdx]?.upper),
          mid:   r(bollResult[bollIdx]?.middle),
          lower: r(bollResult[bollIdx]?.lower),
        },
        kdj: {
          k: r(kdjResult[kdjIdx]?.k),
          d: r(kdjResult[kdjIdx]?.d),
          j: kdjResult[kdjIdx] ? r(3 * kdjResult[kdjIdx].k - 2 * kdjResult[kdjIdx].d) : null,
        },
      };

      ops.push({
        updateOne: {
          filter: { code, date },
          update: { $set: doc },
          upsert: true,
        },
      });
    }

    if (ops.length > 0) {
      await Indicator.bulkWrite(ops);
    }

    return { code, count: ops.length };
  }

  /**
   * 批量计算所有活跃股票的指标
   * @param {string[]} codes - 指定股票代码列表，不传则计算所有
   */
  async calcAll(codes) {
    const { Stock } = require('../models/Market');
    if (!codes) {
      const stocks = await Stock.find({ isActive: true }).select('code').lean();
      codes = stocks.map(s => s.code);
    }

    logger.info(`[Indicator] 开始计算 ${codes.length} 只股票的技术指标...`);
    let success = 0;
    let failed = 0;

    // 分批，每批5只
    for (let i = 0; i < codes.length; i += 5) {
      const batch = codes.slice(i, i + 5);
      await Promise.all(batch.map(async (code) => {
        try {
          const result = await this.calcForStock(code);
          if (result.count > 0) success++;
        } catch (err) {
          logger.warn(`[Indicator] ${code} 计算失败: ${err.message}`);
          failed++;
        }
      }));
    }

    logger.info(`[Indicator] 技术指标计算完成: 成功 ${success}, 失败 ${failed}`);
    return { success, failed, total: codes.length };
  }
}

// 保留2位小数
function r(v) {
  if (v == null || isNaN(v)) return null;
  return Math.round(v * 100) / 100;
}

module.exports = new IndicatorCalculator();

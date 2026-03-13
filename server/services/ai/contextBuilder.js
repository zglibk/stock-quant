/**
 * 上下文构建器 - 从 MongoDB 提取数据构建 AI Prompt 上下文
 * 智能压缩: 不发原始数据，提取特征摘要
 */
const { Stock, DailyKline, Indicator } = require('../../models/Market');

class ContextBuilder {
  // 构建个股分析上下文
  async buildStockContext(code) {
    const [stock, klines, indicators] = await Promise.all([
      Stock.findOne({ code }).lean(),
      DailyKline.find({ code }).sort({ date: -1 }).limit(30).lean(),
      Indicator.find({ code }).sort({ date: -1 }).limit(1).lean(),
    ]);

    if (!stock) return { code, error: '股票数据未找到' };

    const latest = klines[0] || {};
    const indicator = indicators[0] || {};
    const klineSummary = this._summarizeKlines(klines.reverse());

    return {
      code: stock.code,
      name: stock.name,
      industry: stock.industry || '未知',
      latestPrice: latest.close,
      changePercent: klines.length >= 2
        ? (((klines[klines.length - 1].close - klines[klines.length - 2].close) / klines[klines.length - 2].close) * 100).toFixed(2)
        : 'N/A',
      klineSummary,
      ma5: indicator.ma5, ma20: indicator.ma20, ma60: indicator.ma60,
      dif: indicator.macd?.dif, dea: indicator.macd?.dea, histogram: indicator.macd?.histogram,
      rsi14: indicator.rsi14,
      bollUp: indicator.boll?.upper, bollMid: indicator.boll?.mid, bollLow: indicator.boll?.lower,
    };
  }

  // K线数据压缩摘要 (30条 → ~100 tokens)
  _summarizeKlines(klines) {
    if (!klines.length) return '暂无K线数据';

    const closes = klines.map(k => k.close);
    const volumes = klines.map(k => k.volume);
    const upDays = klines.filter((k, i) => i > 0 && k.close > klines[i - 1].close).length;
    const downDays = klines.filter((k, i) => i > 0 && k.close < klines[i - 1].close).length;

    return `近${klines.length}日: 最高${Math.max(...closes)} 最低${Math.min(...closes)} ` +
      `涨${upDays}天跌${downDays}天 ` +
      `均量${Math.round(volumes.reduce((a, b) => a + b, 0) / volumes.length)} ` +
      `区间${klines[0].date}~${klines[klines.length - 1].date}`;
  }
}

module.exports = new ContextBuilder();

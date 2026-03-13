const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { DailyKline, Indicator } = require('../models/Market');
const dataFetcher = require('../services/dataFetcher');

const syncState = {
  running: false,
  startedAt: null,
  finishedAt: null,
  result: null,
  error: '',
  scope: 'all',
  scopeLabel: '全部股票',
  progress: {
    percent: 0,
    totalCodes: 0,
    processedCodes: 0,
    codesWithData: 0,
    noDataCodes: 0,
    failedCodes: 0,
    totalRows: 0
  }
};

function normalizeCode(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  const noPrefix = text.replace(/^(sh|sz|bj)/i, '');
  const noSuffix = noPrefix.replace(/\.(SH|SZ|BJ)$/i, '');
  return noSuffix.toUpperCase();
}

function parseCodes(input) {
  if (Array.isArray(input)) return input.map(normalizeCode).filter(Boolean);
  if (typeof input === 'string') {
    return input
      .split(/[\s,，;；]+/)
      .map(normalizeCode)
      .filter(Boolean);
  }
  return [];
}

// GET /api/market/kline/:code - K线数据
router.get('/kline/:code', auth, async (req, res) => {
  try {
    const code = normalizeCode(req.params.code);
    const { period = 'daily', start, end, limit = 250 } = req.query;
    if (!code) return res.status(400).json({ success: false, message: '股票代码不能为空' });

    const query = { code };
    if (start) query.date = { ...query.date, $gte: start };
    if (end)   query.date = { ...query.date, $lte: end };

    let klines = await DailyKline.find(query)
      .sort({ date: -1 })
      .limit(Number(limit))
      .lean();
    if (klines.length === 0 && !start && !end) {
      try {
        const dataFetcher = require('../services/dataFetcher');
        await dataFetcher.syncTodayKlines([code]);
        klines = await DailyKline.find(query)
          .sort({ date: -1 })
          .limit(Number(limit))
          .lean();
      } catch {}
    }

    res.json({ success: true, data: klines.reverse() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/market/indicators/:code - 技术指标
router.get('/indicators/:code', auth, async (req, res) => {
  try {
    const { limit = 60 } = req.query;
    const code = normalizeCode(req.params.code);
    if (!code) return res.status(400).json({ success: false, message: '股票代码不能为空' });
    const indicators = await Indicator.find({ code })
      .sort({ date: -1 })
      .limit(Number(limit))
      .lean();

    res.json({ success: true, data: indicators.reverse() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/market/overview - 市场概览
router.get('/overview', auth, async (req, res) => {
  try {
    const { Stock } = require('../models/Market');
    
    // 统计涨跌分布
    const stocks = await Stock.find({ isActive: true }).select('changePercent industry').lean();
    let up = 0, down = 0, flat = 0;
    const industryMap = {};

    stocks.forEach(s => {
      if (s.changePercent > 0) up++;
      else if (s.changePercent < 0) down++;
      else flat++;

      // 行业统计
      if (s.industry) {
        if (!industryMap[s.industry]) industryMap[s.industry] = { name: s.industry, count: 0, sumChange: 0 };
        industryMap[s.industry].count++;
        industryMap[s.industry].sumChange += (s.changePercent || 0);
      }
    });

    // 计算情绪指数 (简单算法: 涨跌比映射到 0-100)
    const total = up + down + flat || 1;
    const sentiment = Math.round(((up - down) / total) * 50 + 50);

    // 热门行业 (按平均涨幅排序)
    const industries = Object.values(industryMap)
      .map(i => ({ name: i.name, avgChange: Number((i.sumChange / i.count).toFixed(2)) }))
      .sort((a, b) => b.avgChange - a.avgChange)
      .slice(0, 6);

    res.json({ success: true, data: { up, down, flat, sentiment, industries } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/market/sync - 手动触发数据同步 (admin)
router.post('/sync', auth, async (req, res) => {
  if (syncState.running) {
    return res.json({
      success: true,
      data: syncState,
      message: '同步任务进行中，请稍后查看状态'
    });
  }
  syncState.running = true;
  syncState.startedAt = new Date().toISOString();
  syncState.finishedAt = null;
  syncState.result = null;
  syncState.error = '';
  const scope = req.body?.scope === 'codes' ? 'codes' : 'all';
  const scopeLabel = String(req.body?.scopeLabel || '').trim() || (scope === 'codes' ? '自定义范围' : '全部股票');
  const requestedCodes = [...new Set(parseCodes(req.body?.codes))];
  if (scope === 'codes' && requestedCodes.length === 0) {
    syncState.running = false;
    return res.status(400).json({ success: false, message: '请选择或输入需要同步的股票代码' });
  }
  syncState.scope = scope;
  syncState.scopeLabel = scopeLabel;
  syncState.progress = {
    percent: 0,
    totalCodes: 0,
    processedCodes: 0,
    codesWithData: 0,
    noDataCodes: 0,
    failedCodes: 0,
    totalRows: 0
  };

  Promise.resolve()
    .then(() => dataFetcher.syncTodayKlines(scope === 'codes' ? requestedCodes : undefined, {
      onProgress: (p) => {
        const totalCodes = Number(p.totalCodes || 0);
        const processedCodes = Number(p.processedCodes || 0);
        syncState.progress = {
          percent: totalCodes > 0 ? Math.min(99, Math.round((processedCodes / totalCodes) * 100)) : 0,
          totalCodes,
          processedCodes,
          codesWithData: Number(p.codesWithData || 0),
          noDataCodes: Number(p.noDataCodes || 0),
          failedCodes: Number(p.failedCodes || 0),
          totalRows: Number(p.total || 0)
        };
      }
    }))
    .then((result) => {
      syncState.result = result;
      syncState.error = '';
      syncState.progress = {
        percent: 100,
        totalCodes: Number(result.requestedCodes || 0),
        processedCodes: Number(result.processedCodes || 0),
        codesWithData: Number(result.codesWithData || 0),
        noDataCodes: Number(result.noDataCodes || 0),
        failedCodes: Number(result.failedCodes || 0),
        totalRows: Number(result.total || 0)
      };
    })
    .catch((err) => {
      syncState.result = null;
      syncState.error = err.message || '同步失败';
      syncState.progress = {
        ...syncState.progress,
        percent: 100
      };
    })
    .finally(() => {
      syncState.running = false;
      syncState.finishedAt = new Date().toISOString();
    });

  res.json({
    success: true,
    data: syncState,
    message: `已开始后台同步（${syncState.scopeLabel}），请稍后查看结果`
  });
});

router.get('/sync/status', auth, async (req, res) => {
  res.json({ success: true, data: syncState });
});

module.exports = router;

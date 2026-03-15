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

// 股票列表刷新状态（独立于K线同步）
const stockListState = {
  running: false,
  startedAt: null,
  finishedAt: null,
  error: '',
  progress: { percent: 0, totalCodes: 0, processedCodes: 0, validStocks: 0 },
  result: null,
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

// 指标计算状态
const calcState = {
  running: false, startedAt: null, finishedAt: null, error: '',
  progress: { percent: 0, total: 0, success: 0, failed: 0 },
  result: null,
};

// POST /api/market/calc-indicators - 异步触发指标计算
router.post('/calc-indicators', auth, async (req, res) => {
  if (calcState.running) {
    return res.json({ success: true, data: calcState, message: '指标计算进行中' });
  }

  calcState.running = true;
  calcState.startedAt = new Date().toISOString();
  calcState.finishedAt = null;
  calcState.error = '';
  calcState.result = null;
  calcState.progress = { percent: 0, total: 0, success: 0, failed: 0 };

  res.json({ success: true, data: calcState, message: '已开始后台计算指标' });

  // 后台异步执行
  try {
    const codes = req.body.codes;
    const indicatorCalc = require('../services/indicatorCalc');
    const { Stock } = require('../models/Market');

    let targetCodes = codes;
    if (!targetCodes) {
      const stocks = await Stock.find({ isActive: true }).select('code').lean();
      targetCodes = stocks.map(s => s.code);
    }

    calcState.progress.total = targetCodes.length;
    let success = 0, failed = 0;

    // 分批计算，每批5只，同步更新进度
    for (let i = 0; i < targetCodes.length; i += 5) {
      const batch = targetCodes.slice(i, i + 5);
      await Promise.all(batch.map(async (code) => {
        try {
          const r = await indicatorCalc.calcForStock(code);
          if (r.count > 0) success++;
        } catch { failed++; }
      }));
      calcState.progress.success = success;
      calcState.progress.failed = failed;
      calcState.progress.percent = Math.min(99, Math.round(((i + batch.length) / targetCodes.length) * 100));
    }

    calcState.result = { success, failed, total: targetCodes.length };
    calcState.progress = { percent: 100, total: targetCodes.length, success, failed };
  } catch (err) {
    calcState.error = err.message;
    calcState.progress.percent = 100;
  } finally {
    calcState.running = false;
    calcState.finishedAt = new Date().toISOString();
  }
});

// GET /api/market/calc-indicators/status
router.get('/calc-indicators/status', auth, async (req, res) => {
  res.json({ success: true, data: calcState });
});

// GET /api/market/realtime/:codes - 实时行情 (新浪)
router.get('/realtime/:codes', auth, async (req, res) => {
  try {
    const codes = req.params.codes.split(',').map(c => c.trim()).filter(Boolean);
    if (codes.length === 0) return res.status(400).json({ success: false, message: '请提供股票代码' });
    if (codes.length > 50) return res.status(400).json({ success: false, message: '单次最多查询50只' });
    const data = await dataFetcher.getRealtime(codes);
    res.json({ success: true, data });
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

// POST /api/market/sync-stock-list - 异步刷新 A 股列表 (立即返回，后台执行)
router.post('/sync-stock-list', auth, async (req, res) => {
  if (stockListState.running) {
    return res.json({ success: true, data: stockListState, message: '刷新任务进行中' });
  }

  stockListState.running = true;
  stockListState.startedAt = new Date().toISOString();
  stockListState.finishedAt = null;
  stockListState.error = '';
  stockListState.result = null;
  stockListState.progress = { percent: 0, totalCodes: 0, processedCodes: 0, validStocks: 0 };

  // 立即返回
  res.json({ success: true, data: stockListState, message: '已开始后台刷新股票列表' });

  // 后台异步执行
  try {
    const stocks = await dataFetcher.syncStockList({
      onProgress: (p) => {
        stockListState.progress = {
          percent: p.totalCodes > 0 ? Math.min(99, Math.round((p.processedCodes / p.totalCodes) * 100)) : 0,
          totalCodes: p.totalCodes,
          processedCodes: p.processedCodes,
          validStocks: p.validStocks || 0,
        };
      }
    });
    stockListState.result = stocks;
    stockListState.progress.percent = 100;
    stockListState.progress.validStocks = stocks.updated || 0;
  } catch (err) {
    stockListState.error = err.message;
    stockListState.progress.percent = 100;
  } finally {
    stockListState.running = false;
    stockListState.finishedAt = new Date().toISOString();
  }
});

// GET /api/market/sync-stock-list/status - 查询列表刷新进度
router.get('/sync-stock-list/status', auth, async (req, res) => {
  res.json({ success: true, data: stockListState });
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
